import base64
import io
from typing import Tuple
from PIL import Image


def optimize_image_bytes(
    image_bytes: bytes,
    ext: str,
    max_dim: int = 1600,
    quality: int = 80,
) -> Tuple[bytes, str, str]:
    final_bytes = image_bytes
    final_ext = ext.lower().lstrip(".").replace("jpg", "jpeg")

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            if final_ext == "jpeg" and img.mode in ("RGBA", "P", "LA"):
                img = img.convert("RGB")

            if max(img.size) > max_dim:
                img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

            out_buf = io.BytesIO()
            if final_ext == "jpeg" or (img.mode == "RGB" and final_ext not in ("png", "gif", "webp")):
                img.save(out_buf, format="JPEG", quality=quality, optimize=True)
                final_ext = "jpeg"
            else:
                img.save(out_buf, format="PNG", optimize=True)
                final_ext = "png"
            final_bytes = out_buf.getvalue()
    except Exception:
        pass

    data_b64 = base64.b64encode(final_bytes).decode("ascii")
    return final_bytes, final_ext, data_b64
