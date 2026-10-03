import base64
import io
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel
import pymupdf
import pymupdf4llm
from PIL import Image


#image data model for AI/frontend sendable payload
class PDFImage(BaseModel):
    page_number: int
    filename: str
    ext: str
    size_bytes: int
    data_b64: str


#config for the optimization engine
class PDFOptimizationConfig(BaseModel):
    max_pages: Optional[int] = None
    deflate_images: bool = True
    extract_images: bool = True
    max_image_dim: int = 1600
    image_quality: int = 80
    output_format: Literal["markdown", "binary_pdf"] = "markdown"


#PDF result datatype for AI
class OptimizedPDFResult(BaseModel):
    filename: str
    original_size_bytes: int
    optimized_size_bytes: int
    page_count: int
    output_format: Literal["markdown", "binary_pdf"]
    optimized_payload: str | bytes
    images: List[PDFImage] = []


def _optimize_image_bytes(
    image_bytes: bytes,
    ext: str,
    max_dim: int = 1600,
    quality: int = 80,
) -> tuple[bytes, str]:
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            format_lower = ext.lower().replace("jpg", "jpeg")
            if format_lower == "jpeg" and img.mode in ("RGBA", "P", "LA"):
                img = img.convert("RGB")

            if max(img.size) > max_dim:
                img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

            out_buf = io.BytesIO()
            if format_lower == "jpeg" or (img.mode == "RGB" and format_lower not in ("png", "gif")):
                img.save(out_buf, format="JPEG", quality=quality, optimize=True)
                return out_buf.getvalue(), "jpeg"
            else:
                img.save(out_buf, format="PNG", optimize=True)
                return out_buf.getvalue(), "png"
    except Exception:
        return image_bytes, ext


def extract_and_optimize_pdf_images(
    doc: pymupdf.Document,
    pages_to_keep: List[int],
    config: PDFOptimizationConfig,
) -> List[PDFImage]:
    if not config.extract_images:
        return []

    extracted_images: List[PDFImage] = []
    seen_xrefs = set()

    for page_idx in pages_to_keep:
        page = doc[page_idx]
        page_number = page_idx + 1
        image_list = page.get_images(full=True)

        for img_idx, img_info in enumerate(image_list):
            xref = img_info[0]
            if xref in seen_xrefs:
                continue
            seen_xrefs.add(xref)

            try:
                base_img = doc.extract_image(xref)
                if not base_img:
                    continue

                raw_bytes = base_img.get("image", b"")
                raw_ext = base_img.get("ext", "png")

                #optimize and compress image bytes
                optimized_bytes, final_ext = _optimize_image_bytes(
                    image_bytes=raw_bytes,
                    ext=raw_ext,
                    max_dim=config.max_image_dim,
                    quality=config.image_quality,
                )

                data_b64 = base64.b64encode(optimized_bytes).decode("ascii")

                extracted_images.append(
                    PDFImage(
                        page_number=page_number,
                        filename=f"page{page_number}_img{img_idx + 1}_{xref}.{final_ext}",
                        ext=final_ext,
                        size_bytes=len(optimized_bytes),
                        data_b64=data_b64,
                    )
                )
            except Exception:
                continue

    return extracted_images


def optimize_pdf(
    pdf_bytes: bytes, filename: str, config: PDFOptimizationConfig
) -> OptimizedPDFResult:
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")

    try:
        total_pages = len(doc)
        pages_to_keep = (
            list(range(min(total_pages, config.max_pages)))
            if config.max_pages
            else list(range(total_pages))
        )

        extracted_images = extract_and_optimize_pdf_images(doc, pages_to_keep, config)

        if config.output_format == "markdown":
            extracted_text = pymupdf4llm.to_markdown(
                doc, pages=pages_to_keep
            ).strip()

            return OptimizedPDFResult(
                filename=filename,
                original_size_bytes=len(pdf_bytes),
                optimized_size_bytes=len(extracted_text.encode("utf-8")),
                page_count=len(pages_to_keep),
                output_format="markdown",
                optimized_payload=extracted_text,
                images=extracted_images,
            )
        else:
            doc.select(pages_to_keep)
            out_buf = io.BytesIO()
            doc.save(
                out_buf,
                garbage=4,
                deflate=config.deflate_images,
                clean=True,
                linear=True,
            )
            compressed_bytes = out_buf.getvalue()

            return OptimizedPDFResult(
                filename=filename,
                original_size_bytes=len(pdf_bytes),
                optimized_size_bytes=len(compressed_bytes),
                page_count=len(pages_to_keep),
                output_format="binary_pdf",
                optimized_payload=compressed_bytes,
                images=extracted_images,
            )

    finally:
        doc.close()