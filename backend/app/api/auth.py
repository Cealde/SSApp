from fastapi import APIRouter, Depends
from backend.app.auth.authentication import AuthRequest, sign_up_user, sign_in_user, get_current_user

auth = APIRouter(tags=["Authentication"])


@auth.post("/auth/signup")
async def signup(data: AuthRequest):
    result = await sign_up_user(data)
    return {"message": "User registered successfully!", "data": result}


@auth.post("/auth/login")
async def login(data: AuthRequest):
    result = await sign_in_user(data)
    return {
        "access_token": result.get("access_token"),
        "token_type": "bearer",
        "user": result.get("user")
    }


@auth.get("/dashboard")
async def dashboard(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("id")
    email = current_user.get("email")
    return {
        "message": f"Hello {email}, this is your secure dashboard!",
        "user_id": user_id
    }