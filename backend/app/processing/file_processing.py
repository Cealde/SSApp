import io
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel
import pymupdf
import pymupdf4llm

#config for the optimization engine stuff
class PDFOptimizationConfig(BaseModel):
    max_pages: Optional[int] = None
    deflate_images: bool = True
    output_format: Literal["markdown", "binary_pdf"] = "markdown"

#pdf result datatype for ai
class OptimizedPDFResult(BaseModel):
    filename: str
    original_size_bytes: int
    optimized_size_bytes: int
    page_count: int
    output_format: Literal["markdown", "binary_pdf"]
    optimized_payload: str | bytes

def optimize_pdf(
        pdf_bytes: bytes, filename: str, config: PDFOptimizationConfig
) -> OptimizedPDFResult:
    doc = pymupdf.open(stream = pdf_bytes, filetype= "pdf")

    try:
        total_pages = len(doc)
        pages_to_keep = (list(range(min(total_pages, config.max_pages)))
                         if config.max_pages
                         else list(range(total_pages))
                         )
        if(config.output_format == "markdown"):
            extracted_text = pymupdf4llm.to_markdown(
                doc, pages = pages_to_keep
            ).strip()

            return OptimizedPDFResult(
                filename=filename,
                original_size_bytes=len(pdf_bytes),
                optimized_size_bytes=len(extracted_text.encode("utf-8")),
                page_count=len(pages_to_keep),
                output_format="markdown",
                optimized_payload=extracted_text,
            )
        else:
            doc.select(pages_to_keep)
            out_buf = io.BytesIO()
            doc.save(
                out_buf,
                garbage = 4,
                deflate = config.deflate_images,
                clean = True,
                linear = True
            )
            compressed_bytes = out_buf.getvalue()

            return OptimizedPDFResult(
                filename=filename,
                original_size_bytes=len(pdf_bytes),
                optimized_size_bytes=len(compressed_bytes),
                page_count=len(pages_to_keep),
                output_format="binary_pdf",
                optimized_payload=compressed_bytes,
            )

    finally:
        doc.close()