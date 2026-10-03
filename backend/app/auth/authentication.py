import os
from pathlib import Path
from dotenv import load_dotenv
import httpx
from fastapi import HTTPException, Security, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://urqhsoiadlwoqbsuiiix.supabase.co").strip("'\"")
SUPABASE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip("'\"")

def get_headers():
    return {
        "apikey": os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip("'\""),
        "Content-Type": "application/json"
    }

def _check_supabase_config():
    url = os.environ.get("SUPABASE_URL", "https://urqhsoiadlwoqbsuiiix.supabase.co").strip("'\"")
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip("'\"")
    if not url or not key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set in .env."
        )

security = HTTPBearer(auto_error=False)

class AuthRequest(BaseModel):
    email: str
    password: str

async def sign_up_user(auth_data: AuthRequest) -> dict:
    """
    Registers a new user with Supabase.
    """
    _check_supabase_config()
    url = f"{SUPABASE_URL}/auth/v1/signup"
    payload = {
        "email": auth_data.email,
        "password": auth_data.password
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
        
    return response.json()


async def sign_in_user(auth_data: AuthRequest) -> dict:
    _check_supabase_config()
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    payload = {
        "email": auth_data.email,
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
        
    return response.json()


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    _check_supabase_config()
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
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
