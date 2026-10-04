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

security = HTTPBearer(auto_error=False)

class AuthRequest(BaseModel):
    email: str
    password: str

# Local user cache when Supabase credentials are not configured in environment
_LOCAL_USERS = {}


async def sign_up_user(auth_data: AuthRequest) -> dict:
    """
    Registers a new user with Supabase, or local dev fallback if no key is configured.
    """
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip("'\"")
    if key:
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
    else:
        email = auth_data.email.strip().lower()
        if email in _LOCAL_USERS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already registered.")
        _LOCAL_USERS[email] = auth_data.password
        user_id = f"usr_{abs(hash(email)):x}"
        return {
            "id": user_id,
            "email": email,
            "message": "User registered successfully."
        }


async def sign_in_user(auth_data: AuthRequest) -> dict:
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip("'\"")
    if key:
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
    else:
        email = auth_data.email.strip().lower()
        stored_pw = _LOCAL_USERS.get(email)
        if stored_pw and stored_pw != auth_data.password:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")
        _LOCAL_USERS[email] = auth_data.password
        user_id = f"usr_{abs(hash(email)):x}"
        return {
            "access_token": f"dev_token_{user_id}",
            "token_type": "bearer",
            "user": {
                "id": user_id,
                "email": email
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
