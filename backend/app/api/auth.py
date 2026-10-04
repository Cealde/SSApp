from pydantic import BaseModel
from fastapi import APIRouter, Depends
from backend.app.auth.authentication import (
    SignUpRequest,
    LoginRequest,
    sign_up_user,
    sign_in_user,
    get_current_user,
    resend_confirmation_email,
)

auth = APIRouter(tags=["Authentication"])

class ResendRequest(BaseModel):
    email: str

@auth.post("/auth/resend")
async def resend_email_verification(data: ResendRequest):
    return await resend_confirmation_email(data.email)

@auth.post("/auth/signup")
async def signup(data: SignUpRequest):
    result = await sign_up_user(data)
    org_info = result.get("organization") or {}
    return {
        "message": result.get("message", "User registered successfully!"),
        "requires_confirmation": result.get("requires_confirmation", False),
        "access_token": result.get("access_token"),
        "token_type": result.get("token_type", "bearer"),
        "user": result.get("user"),
        "organization": org_info,
        "organization_name": result.get("organization_name") or org_info.get("name", ""),
        "organization_icon": result.get("organization_icon") or org_info.get("icon", ""),
        "icon": result.get("icon") or org_info.get("icon", ""),
        "data": result
    }

@auth.post("/auth/login")
async def login(data: LoginRequest):
    result = await sign_in_user(data)
    org_info = result.get("organization") or {}
    org_icon = result.get("organization_icon") or result.get("icon") or org_info.get("icon", "")
    org_name = result.get("organization_name") or org_info.get("name", "")
    return {
        "access_token": result.get("access_token"),
        "token_type": result.get("token_type", "bearer"),
        "user": result.get("user"),
        "organization": org_info,
        "organization_name": org_name,
        "organization_icon": org_icon,
        "icon": org_icon,
        "data": result
    }

@auth.get("/dashboard")
async def dashboard(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id")
    email = current_user.get("email")
    return {
        "message": f"Hello {email}, this is your secure dashboard!",
        "user_id": user_id
    }