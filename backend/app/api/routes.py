from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import List

router = APIRouter()

class TextPayload(BaseModel):
    text: str


@router.post("/submit")
async def submit_text(payload: TextPayload):
    return {"message": f"welcome, {payload.text}"}


@router.post("/give")
async def give_text(payload: TextPayload):
    n = len(payload.text)
    return {"message": f"Testing THIHNG, {payload.text} length is: {n}"}

@router.post("/give-files")
async def give_files(
    text: str = Form(""),
    files: List[UploadFile] = File(default=[]),
):
    received = []
    for file in files:
        contents = await file.read()   
        # Add the functioning after this
        received.append({
            "filename": file.filename,
            "content_type": file.content_type,
            "size_bytes": len(contents),
        })

    return {
        "message": f"Received {len(received)} PDF(s).",
        "text": text,
        "files": received,
    }