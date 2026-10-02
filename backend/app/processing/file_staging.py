from typing import List, Dict, Any
from backend.app.processing.file_processing import OptimizedPDFResult

class pdfStaging:
    def __init__(self):
        self.queue: List[OptimizedPDFResult] = []

    def store(self, item: OptimizedPDFResult) -> None:
        self.queue.append(item)

    def give_to_ai(self, user_prompt: str) -> Dict[str, Any]:
        prepared_documents = []

        for item in self.queue:
            prepared_documents.append(
                {
                    "filename": item.filename,
                    "pages": item.page_count,
                    "size_before": f"{item.original_size_bytes / 1024:.1f} KB",
                    "size_after": f"{item.optimized_size_bytes / 1024:.1f} KB",
                    "format": item.output_format,
                    "content": (
                        item.optimized_payload
                        if item.output_format == "markdown"
                        else f"<binary PDF bytes: {len(item.optimized_payload)} bytes>"
                    ),
                }
            )

        return {
            "status": "ready_for_ai",
            "prompt": user_prompt,
            "total_files_processed": len(self.queue),
            "batch_summary": [
                {
                    "file": d["filename"],
                    "savings": f"{(1 - (item.optimized_size_bytes / max(item.original_size_bytes, 1))) * 100:.1f}%",
                }
                for item, d in zip(self.queue, prepared_documents)
            ],
            "documents": prepared_documents,
        }