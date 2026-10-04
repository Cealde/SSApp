import os
from pathlib import Path
from dotenv import load_dotenv
import httpx
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://urqhsoiadlwoqbsuiiix.supabase.co").strip("'\"")
SUPABASE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip("'\"")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

security = HTTPBearer()

class SignUpRequest(BaseModel):
    first_name: str
    email: str
    password: str
    organization: str
    organization_password: str

class LoginRequest(BaseModel):
    email: str
    password: str

async def verify_organization(org_name: str, org_password: str) -> dict:
    """Verifies that the organization exists and the password matches."""
    url = f"{SUPABASE_URL}/rest/v1/organization?name=eq.{org_name}&select=name,password,icon"
    
    async with httpx.AsyncClient() as client:
        res = await client.get(url, headers=HEADERS)
        
    if res.status_code != 200:
        raise HTTPException(status_code=500, detail="Database error verifying organization.")
        
    orgs = res.json()
    if not orgs:
        raise HTTPException(status_code=400, detail=f"Organization '{org_name}' not found.")
        
    org = orgs[0]
    if org.get("password") != org_password:
        raise HTTPException(status_code=400, detail="Invalid organization password.")
        
    return org

async def sign_up_user(data: SignUpRequest) -> dict:
    # 1. First, verify organization existence and password
    org = await verify_organization(data.organization, data.organization_password)
    
    # 2. Register user with Supabase Auth
    signup_url = f"{SUPABASE_URL}/auth/v1/signup"
    signup_payload = {
        "email": data.email,
        "password": data.password
    }
    
    async with httpx.AsyncClient() as client:
        auth_res = await client.post(signup_url, json=signup_payload, headers=HEADERS)
        
    if auth_res.status_code >= 400:
        err = auth_res.json()
        error_detail = err.get("message") or err.get("msg") or err.get("error_description") or "Sign up failed"
        raise HTTPException(status_code=auth_res.status_code, detail=error_detail)
        
    auth_data = auth_res.json()
    
    # 3. Insert user into user_details table
    details_url = f"{SUPABASE_URL}/rest/v1/user_details"
    details_payload = {
        "email": data.email,
        "first_name": data.first_name,
        "organisation": data.organization
    }
    
    async with httpx.AsyncClient() as client:
        details_res = await client.post(
            details_url, 
            json=details_payload, 
            headers={**HEADERS, "Prefer": "return=representation"}
        )
        
    return {
        "auth": auth_data,
        "organization": {
            "name": org.get("name"),
            "icon": org.get("icon")
        }
    }

async def sign_in_user(data: LoginRequest) -> dict:
    # 1. Authenticate with Supabase using email and password
    token_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    payload = {
        "email": data.email,
        "password": data.password
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.post(token_url, json=payload, headers=HEADERS)
        
    if res.status_code >= 400:
        err = res.json()
        error_detail = err.get("error_description") or err.get("message") or err.get("msg") or "Invalid email or password"
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_detail)
        
    auth_result = res.json()
    access_token = auth_result.get("access_token")
    user_email = auth_result.get("user", {}).get("email") or data.email

    # 2. Fetch the user's organization from user_details
    details_url = f"{SUPABASE_URL}/rest/v1/user_details?email=eq.{user_email}&select=first_name,organisation"
    org_name = None
    first_name = ""
    
    async with httpx.AsyncClient() as client:
        details_res = await client.get(details_url, headers=HEADERS)
        if details_res.status_code == 200 and details_res.json():
            user_data = details_res.json()[0]
            org_name = user_data.get("organisation")
            first_name = user_data.get("first_name", "")

    # 3. Fetch the organization's icon from the organization table
    org_icon = None
    if org_name:
        org_url = f"{SUPABASE_URL}/rest/v1/organization?name=eq.{org_name}&select=icon"
        async with httpx.AsyncClient() as client:
            org_res = await client.get(org_url, headers=HEADERS)
            if org_res.status_code == 200 and org_res.json():
                org_icon = org_res.json()[0].get("icon")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "email": user_email,
            "first_name": first_name,
            "organization": {
                "name": org_name,
                "icon": org_icon
            }
        }
    }

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    url = f"{SUPABASE_URL}/auth/v1/user"
    
    auth_headers = {
        **HEADERS,
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
