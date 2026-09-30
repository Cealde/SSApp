from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class TextPayload(BaseModel):
    text: str

@router.post("/submit")
async def submit_text(payload: TextPayload):
    return {"message": f"welcome, {payload.text}"}
