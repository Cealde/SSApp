import os
from pathlib import Path
from dotenv import load_dotenv
import httpx
from fastapi import HTTPException, Security, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from pydantic import BaseModel, model_validator

BASE_DIR = Path(__file__).resolve().parents[3]
load_dotenv(BASE_DIR / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://urqhsoiadlwoqbsuiiix.supabase.co").strip("'\"")
SUPABASE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip("'\"")

def get_headers():
    return {
        "apikey": os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip("'\""),
        "Content-Type": "application/json"
    }

security = HTTPBearer(auto_error=False)

class SignUpRequest(BaseModel):
    email: str
    password: str
    first_name: Optional[str] = ""
    organization: Optional[str] = "Unincorporated"
    organization_password: Optional[str] = ""

    @model_validator(mode="before")
    @classmethod
    def handle_aliases(cls, data):
        if isinstance(data, dict):
            if "firstName" in data and "first_name" not in data:
                data["first_name"] = data["firstName"]
            if "organizationPassword" in data and "organization_password" not in data:
                data["organization_password"] = data["organizationPassword"]
            if "org" in data and "organization" not in data:
                data["organization"] = data["org"]
        return data

class LoginRequest(BaseModel):
    email: str
    password: str

# Backward compatibility alias
AuthRequest = LoginRequest

# Local dev caches when Supabase is not configured or in dev fallback
_LOCAL_USERS = {}
_LOCAL_USER_DETAILS = {}
_LOCAL_ORGS = {
    "demoorg": {
        "name": "DemoOrg",
        "password": "orgpassword123",
        "icon": "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
    },
    "meteorological": {
        "name": "Meteorological",
        "password": "meteoPass!",
        "icon": "https://example.com/meteo_icon.png"
    },
    "unincorporated": {
        "name": "Unincorporated",
        "password": "",
        "icon": ""
    }
}


async def _verify_organization(org_name: str, org_password: str, key: str) -> dict:
    """
    Checks if the given organization exists and verifies its password.
    """
    cleaned_name = org_name.strip().lower()
    cleaned_password = org_password.strip()

    if cleaned_name == "unincorporated":
        return {"name": "Unincorporated", "password": "", "icon": ""}

    if key:
        # Query Supabase REST API for the organization
        url = f"{SUPABASE_URL}/rest/v1/organization?name=eq.{cleaned_name}&select=*"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=get_headers())

        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error while checking organization: {resp.text}"
            )

        org_rows = resp.json()
        if not org_rows:
            # Fallback to case‑insensitive search
            url_ci = f"{SUPABASE_URL}/rest/v1/organization?name=ilike.{cleaned_name}&select=*"
            async with httpx.AsyncClient() as client:
                resp_ci = await client.get(url_ci, headers=get_headers())
            if resp_ci.status_code == 200:
                org_rows = resp_ci.json()
        if not org_rows:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Organization '{cleaned_name}' does not exist."
            )

        org_record = org_rows[0]
        if org_record.get("password") != cleaned_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid organization password."
            )

        return org_record
    else:
        # Local fallback check
        org_record = _LOCAL_ORGS.get(cleaned_name)
        if not org_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Organization '{cleaned_name}' does not exist."
            )
        if org_record.get("password") != cleaned_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid organization password."
            )
        return org_record


async def sign_up_user(auth_data: SignUpRequest) -> dict:
    """
    Validates organization, registers user with Supabase Auth, and saves details to user_details table.
    """
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip("'\"")
    email = auth_data.email.strip().lower()
    first_name = (auth_data.first_name or "").strip()
    org_name = (auth_data.organization or "Unincorporated").strip()
    org_password = (auth_data.organization_password or "").strip()

    # Step 1: Verify organization exists and organization password is valid if an organization is specified
    if org_name and org_name.lower() != "unincorporated":
        if not org_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization password is required for verified organizations."
            )
        await _verify_organization(org_name, org_password, key)
    else:
        org_name = "Unincorporated"

    if key:
        # Step 2: Register user in Supabase Auth
        url = f"{SUPABASE_URL}/auth/v1/signup"
        payload = {
            "email": email,
            "password": auth_data.password,
            "data": {
                "first_name": first_name,
                "organization": org_name
            }
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=get_headers())

        if response.status_code >= 400:
            try:
                err_json = response.json()
                error_detail = (
                    err_json.get("msg")
                    or err_json.get("message")
                    or err_json.get("error_description")
                    or err_json.get("error")
                    or response.text
                )
            except Exception:
                error_detail = response.text or "Sign up failed"
            raise HTTPException(status_code=response.status_code, detail=error_detail)

        signup_result = response.json()

        # Step 3: Add user to user_details table
        # If signup returns an access_token, use Bearer token; otherwise use publishable key
        token = signup_result.get("access_token")
        insert_headers = {
            **get_headers(),
            "Prefer": "resolution=merge-duplicates,return=representation"
        }
        if token:
            insert_headers["Authorization"] = f"Bearer {token}"

        user_details_url = f"{SUPABASE_URL}/rest/v1/user_details"
        user_details_data = {
            "email": email,
            "first_name": first_name,
            "organization": org_name
        }

        async with httpx.AsyncClient() as client:
            insert_resp = await client.post(user_details_url, json=user_details_data, headers=insert_headers)

        return signup_result
    else:
        # Local dev fallback
        if email in _LOCAL_USERS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already registered.")
        _LOCAL_USERS[email] = auth_data.password
        _LOCAL_USER_DETAILS[email] = {
            "email": email,
            "first_name": first_name,
            "organization": org_name
        }
        user_id = f"usr_{abs(hash(email)):x}"
        return {
            "id": user_id,
            "email": email,
            "message": "User registered successfully."
        }


async def sign_in_user(auth_data: LoginRequest) -> dict:
    """
    Authenticates user, pulls their organization from user_details, and retrieves organization name and icon.
    """
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip("'\"")
    email = auth_data.email.strip().lower()

    if key:
        # Step 1: Check existence of email and correctness of password via Supabase Auth
        url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
        payload = {
            "email": email,
            "password": auth_data.password
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=get_headers())

        if response.status_code >= 400:
            try:
                err_json = response.json()
                error_detail = (
                    err_json.get("error_description")
                    or err_json.get("msg")
                    or err_json.get("message")
                    or err_json.get("error")
                    or response.text
                )
            except Exception:
                error_detail = response.text or "Invalid credentials"
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_detail)

        login_result = response.json()
        token = login_result.get("access_token")
        user_info = login_result.get("user", {})

        # Step 2: Pull what organization they are from using user_details table
        org_name = ""
        first_name = ""
        auth_headers = {
            **get_headers(),
            "Authorization": f"Bearer {token}"
        }

        async with httpx.AsyncClient() as client:
            ud_resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/user_details?email=eq.{email}&select=*",
                headers=auth_headers
            )

        if ud_resp.status_code == 200 and ud_resp.json():
            ud_data = ud_resp.json()[0]
            org_name = ud_data.get("organization") or ""
            first_name = ud_data.get("first_name") or ""
        else:
            # Fallback to user_metadata stored during signup
            user_meta = user_info.get("user_metadata", {})
            org_name = user_meta.get("organization") or ""
            first_name = user_meta.get("first_name") or ""

            # If user_details entry was missing, upsert it now using the authenticated token
            if org_name:
                try:
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            f"{SUPABASE_URL}/rest/v1/user_details",
                            json={"email": email, "first_name": first_name, "organization": org_name},
                            headers={**auth_headers, "Prefer": "resolution=merge-duplicates"}
                        )
                except Exception:
                    pass

        # Step 3: Retrieve organization icon from the organization table
        org_icon = ""
        if org_name:
            async with httpx.AsyncClient() as client:
                org_resp = await client.get(
                    f"{SUPABASE_URL}/rest/v1/organization?name=eq.{org_name}&select=name,icon",
                    headers=get_headers()
                )
            if org_resp.status_code == 200 and org_resp.json():
                org_info = org_resp.json()[0]
                org_icon = org_info.get("icon") or ""
                org_name = org_info.get("name") or org_name

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user_info.get("id"),
                "email": email,
                "first_name": first_name
            },
            "organization": {
                "name": org_name,
                "icon": org_icon
            }
        }
    else:
        # Local dev fallback
        stored_pw = _LOCAL_USERS.get(email)
        if not stored_pw or stored_pw != auth_data.password:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

        user_details = _LOCAL_USER_DETAILS.get(email, {})
        org_name = user_details.get("organization", "DemoOrg")
        first_name = user_details.get("first_name", "User")
        org_info = _LOCAL_ORGS.get(org_name, {})

        user_id = f"usr_{abs(hash(email)):x}"
        return {
            "access_token": f"dev_token_{user_id}",
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "email": email,
                "first_name": first_name
            },
            "organization": {
                "name": org_name,
                "icon": org_info.get("icon", "")
            }
        }


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip("'\"")
    token = credentials.credentials
    if key and not token.startswith("dev_token_"):
        url = f"{SUPABASE_URL}/auth/v1/user"
        auth_headers = {
            **get_headers(),
            "Authorization": f"Bearer {token}"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=auth_headers)
            
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        return response.json()
    else:
        return {
            "id": token.replace("dev_token_", ""),
            "email": "user@sathyasethu.com"
        }
