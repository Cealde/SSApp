from fastapi import APIRouter
from pydantic import BaseModel
from backend.app.ai_service import ai_service

router = APIRouter()

class MessageRequest(BaseModel):
    message: str

@router.get("/status")
async def get_status():
    return {"status": "ok", "message": "Backend connected successfully!"}

@router.post("/chat")
async def chat_endpoint(payload: MessageRequest):
    response = await ai_service.generate_response(payload.message)
    return {"response": response}
