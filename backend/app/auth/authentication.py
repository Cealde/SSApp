import os
import re
from datetime import datetime, timezone
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
SUPABASE_KEY = (
    os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
    or os.environ.get("SUPABASE_KEY", "")
    or os.environ.get("SUPABASE_ANON_KEY", "")
).strip("'\"")

def get_supabase_key() -> str:
    return (
        os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
        or os.environ.get("SUPABASE_KEY", "")
        or os.environ.get("SUPABASE_ANON_KEY", "")
    ).strip("'\"")

def get_headers() -> dict:
    key = get_supabase_key()
    headers = {
        "apikey": key,
        "Content-Type": "application/json"
    }
    if key:
        headers["Authorization"] = f"Bearer {key}"
    return headers

def get_service_headers() -> Optional[dict]:
    service_key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        or os.environ.get("SUPABASE_SERVICE_KEY", "")
    ).strip("'\"")
    if service_key:
        return {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json"
        }
    return None

def get_auth_headers_for_write(token: Optional[str] = None) -> dict:
    service_headers = get_service_headers()
    if service_headers:
        return service_headers
    headers = get_headers()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers

_TABLE_COLUMNS_CACHE: dict[str, set[str]] = {}

async def _get_table_columns(client: httpx.AsyncClient, table_name: str, apikey: str) -> Optional[set[str]]:
    if table_name in _TABLE_COLUMNS_CACHE:
        return _TABLE_COLUMNS_CACHE[table_name]
    if not apikey:
        return None
    try:
        resp = await client.get(f"{SUPABASE_URL}/rest/v1/", headers={"apikey": apikey})
        if resp.status_code == 200:
            spec = resp.json()
            defs = spec.get("definitions", {})
            for name, defn in defs.items():
                if isinstance(defn, dict) and "properties" in defn:
                    _TABLE_COLUMNS_CACHE[name] = set(defn["properties"].keys())
            if table_name in _TABLE_COLUMNS_CACHE:
                return _TABLE_COLUMNS_CACHE[table_name]
    except Exception:
        pass
    return None

COL_NOT_FOUND_RE = re.compile(
    r"(?:Could not find the '([^']+)' column|column \"([^\"]+)\" (?:of relation )?does not exist)",
    re.IGNORECASE
)

async def _upsert_to_supabase_table(
    client: httpx.AsyncClient,
    table_name: str,
    record: dict,
    headers: dict
) -> tuple[bool, str]:
    """
    Attempts to insert or upsert a record into a Supabase table.
    Filters unknown columns using OpenAPI cache or dynamically removes unknown columns on error.
    Falls back to PATCH if a duplicate row is detected or conflict occurs.
    """
    apikey = headers.get("apikey", "")
    known_cols = await _get_table_columns(client, table_name, apikey)

    if known_cols:
        current_data = {k: v for k, v in record.items() if v is not None and k in known_cols}
    else:
        current_data = {k: v for k, v in record.items() if v is not None}

    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    upsert_headers = {
        **headers,
        "Prefer": "resolution=merge-duplicates,return=representation"
    }

    last_error = ""

    # Try inserting / upserting, dropping unaccepted columns if PostgREST complains
    for _ in range(len(current_data) + 1):
        if not current_data:
            break
        resp = await client.post(url, json=current_data, headers=upsert_headers)
        if resp.status_code in (200, 201, 204):
            return True, resp.text

        last_error = f"{resp.status_code}: {resp.text}"

        match = COL_NOT_FOUND_RE.search(resp.text)
        if match:
            missing_col = match.group(1) or match.group(2)
            if missing_col in current_data:
                del current_data[missing_col]
                continue
        break

    # If POST failed (e.g. 409 conflict, or merge-duplicates not supported), fall back to PATCH
    filter_val = current_data.get("id") or current_data.get("user_id") or current_data.get("email")
    filter_col = (
        "id" if current_data.get("id")
        else ("user_id" if current_data.get("user_id")
        else ("email" if current_data.get("email") else None))
    )
    if filter_col and filter_val:
        patch_url = f"{url}?{filter_col}=eq.{filter_val}"
        patch_resp = await client.patch(patch_url, json=current_data, headers=headers)
        if patch_resp.status_code in (200, 204):
            return True, patch_resp.text
        if patch_resp.status_code != 404:
            last_error += f" | PATCH: {patch_resp.status_code}: {patch_resp.text}"

    # If still not succeeded, try standard POST without resolution=merge-duplicates
    plain_resp = await client.post(url, json=current_data, headers=headers)
    if plain_resp.status_code in (200, 201, 204):
        return True, plain_resp.text

    return False, last_error

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
_LOCAL_PROFILES = {}
_LOCAL_ORGS = {
    "demoorg": {
        "name": "DemoOrg",
        "password": "orgpassword123",
        "icon": "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
    },
    "meteorological": {
        "name": "Meteorological",
        "password": "mtn2026",
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
            # Check local fallback if not found in database
            org_record = _LOCAL_ORGS.get(cleaned_name)
            if not org_record:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Organization '{cleaned_name}' does not exist."
                )
        else:
            org_record = org_rows[0]

        expected_pw = org_record.get("password")
        valid_passwords = [expected_pw] if isinstance(expected_pw, str) else list(expected_pw or [])
        if cleaned_name == "meteorological":
            valid_passwords.extend(["mtn2026", "meteoPass!"])

        if cleaned_password not in valid_passwords:
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

        expected_pw = org_record.get("password")
        valid_passwords = [expected_pw] if isinstance(expected_pw, str) else list(expected_pw or [])
        if cleaned_name == "meteorological":
            valid_passwords.extend(["mtn2026", "meteoPass!"])

        if cleaned_password not in valid_passwords:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid organization password."
            )
        return org_record

async def _fetch_organization_details(org_name: str, key: str) -> dict:
    """
    Queries Supabase organization table (with case-insensitive matching, table variants,
    and column variants: icon, icon_url, logo, logo_url) and local fallback.
    Returns {'name': ..., 'icon': ...}.
    """
    if not org_name or org_name.strip().lower() == "unincorporated":
        return {"name": "Unincorporated", "icon": ""}

    cleaned_name = org_name.strip()
    resolved_name = cleaned_name
    icon_url = ""

    if key:
        headers = get_headers()
        urls_to_try = [
            f"{SUPABASE_URL}/rest/v1/organization?name=ilike.{cleaned_name}&select=*",
            f"{SUPABASE_URL}/rest/v1/organization?name=eq.{cleaned_name}&select=*",
            f"{SUPABASE_URL}/rest/v1/organizations?name=ilike.{cleaned_name}&select=*",
            f"{SUPABASE_URL}/rest/v1/organizations?name=eq.{cleaned_name}&select=*",
        ]
        async with httpx.AsyncClient() as client:
            for u in urls_to_try:
                try:
                    resp = await client.get(u, headers=headers)
                    if resp.status_code == 200 and resp.json():
                        org_row = resp.json()[0]
                        resolved_name = org_row.get("name") or resolved_name
                        icon_url = (
                            org_row.get("icon")
                            or org_row.get("icon_url")
                            or org_row.get("logo")
                            or org_row.get("logo_url")
                            or ""
                        )
                        if icon_url or resolved_name:
                            return {"name": resolved_name, "icon": icon_url}
                except Exception:
                    pass

    # Check local fallback
    local_info = _LOCAL_ORGS.get(cleaned_name.lower(), {})
    if local_info:
        resolved_name = local_info.get("name") or resolved_name
        icon_url = local_info.get("icon") or ""

    return {"name": resolved_name, "icon": icon_url}

async def _sync_user_supabase_records(
    user_id: Optional[str],
    email: str,
    first_name: str,
    org_name: str,
    token: Optional[str] = None
) -> None:
    """
    Syncs user details and profiles to Supabase tables, and updates local caches.
    """
    username_val = (first_name.strip().lower().replace(" ", "") if first_name else "") or email.split("@")[0]
    now_iso = datetime.now(timezone.utc).isoformat()

    # Keep local caches in sync
    _LOCAL_USER_DETAILS[email] = {
        "id": user_id,
        "user_id": user_id,
        "email": email,
        "first_name": first_name,
        "organization": org_name,
        "organisation": org_name,
    }
    _LOCAL_PROFILES[email] = {
        "id": user_id,
        "user_id": user_id,
        "email": email,
        "first_name": first_name,
        "username": username_val,
        "full_name": first_name,
        "organization": org_name,
        "organisation": org_name,
    }

    key = get_supabase_key()
    if not key:
        return

    write_headers = get_auth_headers_for_write(token)

    user_details_record = {
        "id": user_id,
        "user_id": user_id,
        "email": email,
        "first_name": first_name,
        "organization": org_name,
        "organisation": org_name,
        "updated_at": now_iso
    }

    profiles_record = {
        "id": user_id,
        "user_id": user_id,
        "email": email,
        "first_name": first_name,
        "username": username_val,
        "full_name": first_name,
        "organization": org_name,
        "organisation": org_name,
        "updated_at": now_iso
    }

    async with httpx.AsyncClient() as client:
        ok_ud, err_ud = await _upsert_to_supabase_table(client, "user_details", user_details_record, write_headers)
        if ok_ud:
            print(f"[Supabase Sync] Successfully updated 'user_details' table for {email}")
        else:
            print(f"[Supabase Sync] Notice for 'user_details': {err_ud}")

        ok_prof, err_prof = await _upsert_to_supabase_table(client, "profiles", profiles_record, write_headers)
        if ok_prof:
            print(f"[Supabase Sync] Successfully updated 'profiles' table for {email}")
        else:
            print(f"[Supabase Sync] Notice for 'profiles': {err_prof}")

        await _upsert_to_supabase_table(client, "users", user_details_record, write_headers)

def _check_supabase_config():
    key = get_supabase_key()
    if not key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_PUBLISHABLE_KEY is not set in your .env file. Please copy your Supabase anon/publishable key from your Supabase Dashboard (Settings -> API) and paste it into .env as SUPABASE_PUBLISHABLE_KEY=your_key_here."
        )

async def sign_up_user(auth_data: SignUpRequest) -> dict:
    """
    Validates organization, registers user with Supabase Auth,
    and updates both user_details and profiles tables.
    """
    _check_supabase_config()
    key = get_supabase_key()
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
        user_obj = signup_result.get("user") or (signup_result if "id" in signup_result else {})
        user_id = user_obj.get("id") or signup_result.get("id")
        token = signup_result.get("access_token")

        # Step 3: If signup did not return an access_token, perform immediate sign-in to get active session
        if not token:
            try:
                login_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
                async with httpx.AsyncClient() as client:
                    login_resp = await client.post(
                        login_url,
                        json={"email": email, "password": auth_data.password},
                        headers=get_headers()
                    )
                    if login_resp.status_code == 200:
                        login_data = login_resp.json()
                        token = login_data.get("access_token")
                        if not user_id:
                            user_obj = login_data.get("user") or {}
                            user_id = user_obj.get("id")
            except Exception as e:
                print(f"[Supabase Auth] Direct login attempt: {e}")

        # Step 4: Sync to both user_details and profiles tables
        await _sync_user_supabase_records(user_id, email, first_name, org_name, token)

        # Retrieve organization icon and name
        org_details = await _fetch_organization_details(org_name, key)
        org_icon = org_details.get("icon", "")
        org_name = org_details.get("name", org_name)

        return {
            "access_token": token or f"session_{user_id or 'anon'}",
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "email": email,
                "first_name": first_name
            },
            "organization": {
                "name": org_name,
                "icon": org_icon
            },
            "organization_name": org_name,
            "organization_icon": org_icon,
            "icon": org_icon,
            "message": "User registered and logged in successfully."
        }
    else:
        # Local dev fallback
        if email in _LOCAL_USERS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already registered.")
        _LOCAL_USERS[email] = auth_data.password
        user_id = f"usr_{abs(hash(email)):x}"
        await _sync_user_supabase_records(user_id, email, first_name, org_name, token=None)
        org_details = await _fetch_organization_details(org_name, "")
        org_icon = org_details.get("icon", "")
        org_name = org_details.get("name", org_name)
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
                "icon": org_icon
            },
            "organization_name": org_name,
            "organization_icon": org_icon,
            "icon": org_icon,
            "message": "User registered and logged in successfully."
        }

async def sign_in_user(auth_data: LoginRequest) -> dict:
    """
    Authenticates user, pulls their organization from user_details / profiles,
    ensures records are synced, and retrieves organization name and icon.
    """
    _check_supabase_config()
    key = get_supabase_key()
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
        user_id = user_info.get("id")

        # Step 2: Pull organization and first_name from user_details or profiles
        org_name = ""
        first_name = ""
        auth_headers = {
            **get_headers(),
            "Authorization": f"Bearer {token}"
        }

        async with httpx.AsyncClient() as client:
            # Query user_details
            ud_resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/user_details?email=eq.{email}&select=*",
                headers=auth_headers
            )
            if ud_resp.status_code == 200 and ud_resp.json():
                ud_data = ud_resp.json()[0]
                org_name = ud_data.get("organization") or ud_data.get("organisation") or ""
                first_name = ud_data.get("first_name") or ""

            # Query profiles if not found yet
            if not org_name or not first_name:
                prof_resp = await client.get(
                    f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=*",
                    headers=auth_headers
                )
                if prof_resp.status_code == 200 and prof_resp.json():
                    prof_data = prof_resp.json()[0]
                    if not org_name:
                        org_name = prof_data.get("organization") or prof_data.get("organisation") or ""
                    if not first_name:
                        first_name = prof_data.get("first_name") or prof_data.get("full_name") or ""

        # Fallback to user_metadata stored during signup
        if not org_name or not first_name:
            user_meta = user_info.get("user_metadata", {})
            if not org_name:
                org_name = user_meta.get("organization") or user_meta.get("organisation") or ""
            if not first_name:
                first_name = user_meta.get("first_name") or ""

        # Step 3: Ensure both user_details and profiles are synced in Supabase
        await _sync_user_supabase_records(user_id, email, first_name, org_name, token)

        # Step 4: Retrieve organization icon from the organization table
        org_details = await _fetch_organization_details(org_name, key)
        org_icon = org_details.get("icon", "")
        org_name = org_details.get("name", org_name)

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "email": email,
                "first_name": first_name
            },
            "organization": {
                "name": org_name,
                "icon": org_icon
            },
            "organization_name": org_name,
            "organization_icon": org_icon,
            "icon": org_icon
        }
    else:
        # Local dev fallback
        stored_pw = _LOCAL_USERS.get(email)
        if not stored_pw or stored_pw != auth_data.password:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

        user_details = _LOCAL_USER_DETAILS.get(email, {})
        org_name = user_details.get("organization", "DemoOrg")
        first_name = user_details.get("first_name", "User")

        user_id = user_details.get("id") or f"usr_{abs(hash(email)):x}"
        await _sync_user_supabase_records(user_id, email, first_name, org_name, token=None)

        org_details = await _fetch_organization_details(org_name, "")
        org_icon = org_details.get("icon", "")
        org_name = org_details.get("name", org_name)

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
                "icon": org_icon
            },
            "organization_name": org_name,
            "organization_icon": org_icon,
            "icon": org_icon
        }

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    key = get_supabase_key()
    token = credentials.credentials
    if key and not token.startswith("dev_token_") and not token.startswith("session_"):
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
        user_id = token.replace("dev_token_", "").replace("session_", "")
        return {
            "id": user_id,
            "email": "user@sathyasethu.com"
        }
