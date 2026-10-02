import io
from typing import List, Literal, Optional
from pydantic import BaseModel
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE


class PPTXOptimizationConfig(BaseModel):
    max_slides: Optional[int] = None
    include_images: bool = True


class SlideText(BaseModel):
    slide_number: int
    text: str


class SlideImage(BaseModel):
    slide_number: int
    filename: str
    ext: str
    size_bytes: int
   


class ExtractedImage(BaseModel):
    slide_number: int
    filename: str
    ext: str
    size_bytes: int
    data_b64: str          


class OptimizedPPTXResult(BaseModel):
    filename: str
    original_size_bytes: int
    slide_count: int
    slides_text: List[SlideText]
    images: List[ExtractedImage]


def optimize_pptx(
    pptx_bytes: bytes, filename: str, config: PPTXOptimizationConfig
) -> OptimizedPPTXResult:
    import base64

    prs = Presentation(io.BytesIO(pptx_bytes))
    total = len(prs.slides)

    slides_to_keep = (
        list(range(min(total, config.max_slides)))
        if config.max_slides
        else list(range(total))
    )

    slides_text: List[SlideText] = []
    images: List[ExtractedImage] = []

    for idx in slides_to_keep:
        slide = prs.slides[idx]
        slide_num = idx + 1
        texts = []

        for shape in slide.shapes:
            # text
            if shape.has_text_frame:
                t = shape.text_frame.text.strip()
                if t:
                    texts.append(t)

            # image
            if config.include_images and shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
                img = shape.image
                blob = img.blob  # raw bytes
                images.append(ExtractedImage(
                    slide_number=slide_num,
                    filename=f"slide{slide_num}_img{shape.shape_id}.{img.ext}",
                    ext=img.ext,
                    size_bytes=len(blob),
                    data_b64=base64.b64encode(blob).decode("ascii"),
                ))

        slides_text.append(SlideText(
            slide_number=slide_num,
            text="\n".join(texts),
        ))

    return OptimizedPPTXResult(
        filename=filename,
        original_size_bytes=len(pptx_bytes),
        slide_count=len(slides_to_keep),
        slides_text=slides_text,
        images=images,
    )