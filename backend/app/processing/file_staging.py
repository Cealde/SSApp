from typing import List, Dict, Any, Union
from backend.app.processing.pdf_optimization import OptimizedPDFResult
from backend.app.processing.pptx_optimize import OptimizedPPTXResult

StagedItem = Union[OptimizedPDFResult, OptimizedPPTXResult]


class FileStaging:
    def __init__(self):
        self.queue: List[StagedItem] = []

    def store(self, item: StagedItem) -> None:
        self.queue.append(item)

    def give_to_ai(self, user_prompt: str) -> Dict[str, Any]:
        prepared_documents = []

        for item in self.queue:
            if isinstance(item, OptimizedPDFResult):
                prepared_documents.append(
                    {
                        "doc_type": "pdf",
                        "filename": item.filename,
                        "pages": item.page_count,
                        "size_before": f"{item.original_size_bytes / 1024:.1f} KB",
                        "size_after": f"{item.optimized_size_bytes / 1024:.1f} KB",
                        "format": item.output_format,
                        "image_count": len(item.images),
                        "images": [img.model_dump() for img in item.images],
                        "content": (
                            item.optimized_payload
                            if item.output_format == "markdown"
                            else f"<binary PDF bytes: {len(item.optimized_payload)} bytes>"
                        ),
                    }
                )
            elif isinstance(item, OptimizedPPTXResult):
                full_presentation_text = "\n\n".join(
                    f"--- Slide {s.slide_number} ---\n{s.text}" for s in item.slides_text if s.text
                )
                prepared_documents.append(
                    {
                        "doc_type": "pptx",
                        "filename": item.filename,
                        "slides": item.slide_count,
                        "size_before": f"{item.original_size_bytes / 1024:.1f} KB",
                        "size_after": f"{item.optimized_size_bytes / 1024:.1f} KB",
                        "format": "slides_markdown",
                        "image_count": len(item.images),
                        "images": [img.model_dump() for img in item.images],
                        "content": full_presentation_text,
                    }
                )

        return {
            "status": "ready_for_ai",
            "prompt": user_prompt,
            "total_files_processed": len(self.queue),
            "batch_summary": [
                {
                    "file": d["filename"],
                    "type": d["doc_type"],
                    "images": d["image_count"],
                    "savings": f"{(1 - (item.optimized_size_bytes / max(item.original_size_bytes, 1))) * 100:.1f}%",
                }
                for item, d in zip(self.queue, prepared_documents)
            ],
            "documents": prepared_documents,
        }


# Backwards compatibility alias
pdfStaging = FileStaging