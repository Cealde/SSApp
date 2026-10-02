from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import List

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
        ctype = (file.content_type or "").lower()

        # pdf
        if ctype == PDF_MIME:
            # pdf processing
            received.append({
                "type": "pdf",
                "filename": file.filename,
                "size_bytes": len(contents),
            })

        # ppt
        elif ctype in PPTX_MIMES:
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

        # other
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {ctype} ({file.filename})",
            )

    return {
        "message": f"Processed {len(received)} file(s).",
        "text": text,
        "files": received,
    }