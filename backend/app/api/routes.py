from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import List
import os

from backend.app.services.pptx_optimize import (
    optimize_pptx,
    PPTXOptimizationConfig,
)

router = APIRouter()

PDF_MIME = "application/pdf"
PPTX_MIMES = {
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
}

AUDIO_EXTS = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".opus", ".wma"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".mkv", ".avi", ".wmv", ".flv", ".m4v"}


def classify(filename: str, ctype: str) -> str:
    """Return 'audio' | 'video' | 'pdf' | 'pptx' | 'unknown'."""
    ext = os.path.splitext(filename or "")[1].lower()
    ctype = (ctype or "").lower()

    if ctype == PDF_MIME or ext == ".pdf":
        return "pdf"
    if ctype in PPTX_MIMES or ext in {".pptx", ".ppt"}:
        return "pptx"
    if ctype.startswith("audio/") or ext in AUDIO_EXTS:
        return "audio"
    if ctype.startswith("video/") or ext in VIDEO_EXTS:
        return "video"
    return "unknown"


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
        kind = classify(file.filename, file.content_type)    
                                                             
        if kind == "pdf":                                    
            received.append({                                
                "type": "pdf",                               
                "filename": file.filename,                  
                "size_bytes": len(contents),                 
            })                                               

        elif kind == "pptx":
            result = optimize_pptx(
                pptx_bytes=contents,
                filename=file.filename,
                config=PPTXOptimizationConfig(max_slides=None, include_images=True),
            )
            received.append({
                "type": "pptx",
                "filename": result.filename,
                "slide_count": result.slide_count,
                "original_size_bytes": result.original_size_bytes,
                "slides_text": [s.model_dump() for s in result.slides_text],
                "images": [i.model_dump() for i in result.images],
            })

        elif kind == "audio":
            received.append({
                "type": "audio",
                "filename": file.filename,
                "content_type": file.content_type,
                "size_bytes": len(contents),
            })

        elif kind == "video":
            received.append({
                "type": "video",
                "filename": file.filename,
                "content_type": file.content_type,
                "size_bytes": len(contents),
            })

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.content_type} ({file.filename})",
            )

    return {
        "message": f"Processed {len(received)} file(s).",
        "text": text,
        "files": received,
    }