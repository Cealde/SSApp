from typing import List
from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

from backend.app.processing.file_processing import optimize_pdf, PDFOptimizationConfig
from backend.app.processing.file_staging import pdfStaging

router = APIRouter()

class TextPayload(BaseModel):
    text: str

@router.post("/give")
async def submit_text(payload: TextPayload):
    n = len(payload.text)
    return {"message": f"Testing THIHNG, {payload.text} length is: {n}"}

@router.post("/give-files")
async def give_files(
    text: str = Form(""),
    files: List[UploadFile] = File(default=[]),
):
    staging = pdfStaging()
    config = PDFOptimizationConfig(
        max_pages=None,
        deflate_images=True,
        output_format="markdown",
    )
    for file in files:
        contents = await file.read()
        
        optimized_result = optimize_pdf(
            pdf_bytes=contents,
            filename=file.filename or "unknown.pdf",
            config=config,
        )
        

        staging.store(optimized_result)

    final_output = staging.give_to_ai(user_prompt=text)

    print("\n========== FINAL OUTPUT ==========")
    print(final_output)
    print("===================================\n")
    return {
        "message": f"Processed {len(files)} PDF(s) successfully.",
        "final_output": final_output,
    }