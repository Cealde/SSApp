from fastapi import APIRouter
from pydantic import BaseModel
from backend.app.ai_service import ai_service

router = APIRouter()

class TextPayload(BaseModel):
    text: str

@router.post("/submit")
async def submit_text(payload: TextPayload):
    # Process text and return "welcome, <inputted text>"
    ai_status = await ai_service.generate_response(payload.text)
    return {
        "message": f"welcome, {payload.text}",
        "ai_status": ai_status
    }
