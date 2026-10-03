import os
from typing import List
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from backend.app.processing.pdf_optimization import optimize_pdf, PDFOptimizationConfig
from backend.app.processing.pptx_optimize import (
    optimize_pptx,
    PPTXOptimizationConfig,
)
from backend.app.processing.file_staging import FileStaging

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

@router.post("/give")
async def submit_text(payload: TextPayload):
    n = len(payload.text)
    return {"message": f"Testing THIHNG, {payload.text} length is: {n}"}

@router.post("/give-code")
@router.get("/give-code")
async def get_html():
    html = """"""
    return {"code": html}

@router.post("/give-files")
async def give_files(
    text: str = Form(""),
    files: List[UploadFile] = File(default=[]),
):
    staging = FileStaging()
    pdf_config = PDFOptimizationConfig(
        max_pages=None,
        deflate_images=True,
        extract_images=True,
        output_format="markdown",
    )
    pptx_config = PPTXOptimizationConfig(
        max_slides=None,
        include_images=True,
    )
    received = []

    for file in files:
        contents = await file.read()
        kind = classify(file.filename or "", file.content_type or "")

        if kind == "pdf":
            optimized_result = optimize_pdf(
                pdf_bytes=contents,
                filename=file.filename or "unknown.pdf",
                config=pdf_config,
            )
            staging.store(optimized_result)
            received.append({
                "type": "pdf",
                "filename": file.filename,
                "size_bytes": len(contents),
                "image_count": len(optimized_result.images),
                "images": [img.model_dump() for img in optimized_result.images],
            })

        elif kind == "pptx":
            result = optimize_pptx(
                pptx_bytes=contents,
                filename=file.filename or "unknown.pptx",
                config=pptx_config,
            )
            staging.store(result)
            received.append({
                "type": "pptx",
                "filename": result.filename,
                "slide_count": result.slide_count,
                "original_size_bytes": result.original_size_bytes,
                "image_count": len(result.images),
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

    final_output = staging.give_to_ai(user_prompt=text)

    print("\n========== FINAL OUTPUT (STAGING) ==========")
    print(final_output)
    print("============================================\n")

    return {
        "message": f"Processed {len(received)} file(s) successfully.",
        "text": text,
        "files": received,
        "final_output": final_output,
        "ai_result": None,
    }