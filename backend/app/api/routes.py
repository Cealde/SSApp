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


TEXT_EXTS = {".txt", ".md", ".csv", ".json", ".xml", ".html", ".htm", ".py", ".js", ".css", ".ts", ".yaml", ".yml", ".log"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".bmp"}


def classify(filename: str, ctype: str) -> str:
    """Return 'pdf' | 'pptx' | 'audio' | 'video' | 'text' | 'image' | 'unknown'."""
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
    if ctype.startswith("text/") or ext in TEXT_EXTS or ctype == "application/json":
        return "text"
    if ctype.startswith("image/") or ext in IMAGE_EXTS:
        return "image"
    return "text"

from typing import List, Dict, Any, Optional
import json
import base64
from fastapi.responses import Response
from backend.app.ai.gemini_service import generate_content
from backend.app.processing.presentation_generator import parse_slides_from_markdown, generate_pptx_bytes

class TextPayload(BaseModel):
    text: str
    config: Optional[Dict[str, Any]] = None

class ExportPPTXRequest(BaseModel):
    markdown: str
    theme: Optional[str] = "amber"
    org_name: Optional[str] = "SatyaSetu"
    org_icon_url: Optional[str] = "/assets/logo.svg"

@router.post("/export-pptx")
async def export_pptx_endpoint(payload: ExportPPTXRequest):
    try:
        slides = parse_slides_from_markdown(payload.markdown)
        pptx_bytes = generate_pptx_bytes(
            slides,
            theme_name=payload.theme or "amber",
            org_name=payload.org_name or "SatyaSetu",
            org_icon_url=payload.org_icon_url or "/assets/logo.svg"
        )
        return Response(
            content=pptx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": "attachment; filename=presentation.pptx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/give")
async def submit_text(payload: TextPayload):
    config = payload.config or {}
    staging_data = {"documents": []}
    
    try:
        ai_result = await generate_content(payload.text, staging_data, config)
        
        # If it's step 1 of website generation, try parsing JSON
        if "website" in config.get("formats", []) and "palette" not in config:
            try:
                # Attempt to parse json from markdown block if any
                clean_json = ai_result.strip()
                if clean_json.startswith('```json'):
                    clean_json = clean_json.split('```json')[1].split('```')[0].strip()
                parsed = json.loads(clean_json)
                return {"ai_result": parsed, "message": "Select design options."}
            except Exception as e:
                pass

        formats = config.get("formats", [])
        is_pres = "presentation" in formats or any(kw in payload.text.lower() for kw in ["presentation", "slides", "slide deck", "powerpoint"])
        
        pptx_base64 = None
        slides_data = None
        if is_pres and isinstance(ai_result, str):
            try:
                slides_data = parse_slides_from_markdown(ai_result)
                if slides_data:
                    theme = config.get("presTheme", "amber")
                    org_name = config.get("orgName", "SatyaSetu")
                    org_icon_url = config.get("orgIconUrl", "/assets/logo.svg")
                    pptx_bytes = generate_pptx_bytes(slides_data, theme_name=theme, org_name=org_name, org_icon_url=org_icon_url)
                    pptx_base64 = base64.b64encode(pptx_bytes).decode("ascii")
            except Exception as e:
                print("Failed to auto-generate PPTX:", e)

        resp = {
            "ai_result": ai_result,
            "message": "Generated successfully.",
            "is_presentation": is_pres and bool(pptx_base64),
        }
        if pptx_base64:
            resp["pptx_base64"] = pptx_base64
            resp["slides"] = slides_data

        return resp
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/give-code")
@router.get("/give-code")
async def get_html():
    html = """"""
    return {"code": html}

@router.post("/give-files")
async def give_files(
    text: str = Form(""),
    config: str = Form("{}"),
    files: List[UploadFile] = File(default=[]),
):
    try:
        config_data = json.loads(config)
    except:
        config_data = {}
        
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

        elif kind == "text":
            text_str = contents.decode("utf-8", errors="replace")
            staging.store({
                "type": "text",
                "filename": file.filename or "unknown.txt",
                "content": text_str,
                "size_bytes": len(contents),
            })
            received.append({
                "type": "text",
                "filename": file.filename,
                "content_type": file.content_type,
                "size_bytes": len(contents),
            })

        else:
            # Fallback for images or arbitrary files
            try:
                text_str = contents.decode("utf-8")
                staging.store({
                    "type": "text",
                    "filename": file.filename or "document.txt",
                    "content": text_str,
                    "size_bytes": len(contents),
                })
            except Exception:
                pass
            received.append({
                "type": kind,
                "filename": file.filename,
                "content_type": file.content_type,
                "size_bytes": len(contents),
            })

    final_output = staging.give_to_ai(user_prompt=text)

    try:
        ai_result = await generate_content(text, final_output, config_data)
        
        # If it's step 1 of website generation, try parsing JSON
        if "website" in config_data.get("formats", []) and "palette" not in config_data:
            try:
                clean_json = ai_result.strip()
                if clean_json.startswith('```json'):
                    clean_json = clean_json.split('```json')[1].split('```')[0].strip()
                parsed = json.loads(clean_json)
                return {"ai_result": parsed, "message": "Select design options."}
            except Exception as e:
                pass
                
        formats = config_data.get("formats", [])
        is_pres = "presentation" in formats or any(kw in text.lower() for kw in ["presentation", "slides", "slide deck", "powerpoint"])
        
        pptx_base64 = None
        slides_data = None
        if is_pres and isinstance(ai_result, str):
            try:
                slides_data = parse_slides_from_markdown(ai_result)
                if slides_data:
                    theme = config_data.get("presTheme", "amber")
                    org_name = config_data.get("orgName", "SatyaSetu")
                    org_icon_url = config_data.get("orgIconUrl", "/assets/logo.svg")
                    pptx_bytes = generate_pptx_bytes(slides_data, theme_name=theme, org_name=org_name, org_icon_url=org_icon_url)
                    pptx_base64 = base64.b64encode(pptx_bytes).decode("ascii")
            except Exception as e:
                print("Failed to auto-generate PPTX in give-files:", e)

        resp = {
            "message": f"Processed {len(received)} file(s) and generated output.",
            "text": text,
            "files": received,
            "final_output": final_output,
            "ai_result": ai_result,
            "is_presentation": is_pres and bool(pptx_base64),
        }
        if pptx_base64:
            resp["pptx_base64"] = pptx_base64
            resp["slides"] = slides_data

        return resp
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))