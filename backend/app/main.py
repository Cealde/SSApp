from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.app.api.routes import router as api_router
from backend.app.api.auth import auth as api_authenticator

app = FastAPI(title="SSApp")
FRONTEND_DIR = BASE_DIR / "frontend"

app.include_router(api_router, prefix="/api")
app.include_router(api_authenticator, prefix="/api")

@app.get("/")
@app.get("/index.html")
async def serve_index():
    return FileResponse(FRONTEND_DIR / "pages" / "index.html")

@app.get("/dashboard")
@app.get("/dashboard.html")
async def serve_dashboard():
    return FileResponse(FRONTEND_DIR / "pages" / "dashboard.html")

@app.get("/prompt")
@app.get("/prompt.html")
async def serve_prompt():
    return FileResponse(FRONTEND_DIR / "pages" / "prompt.html")

@app.get("/login")
@app.get("/login.html")
async def serve_login():
    return FileResponse(FRONTEND_DIR / "pages" / "login.html")

@app.get("/loading")
@app.get("/loading.html")
async def serve_loading():
    return FileResponse(FRONTEND_DIR / "pages" / "loading.html")

app.mount("/css", StaticFiles(directory=FRONTEND_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=FRONTEND_DIR / "js"), name="js")
app.mount("/", StaticFiles(directory=FRONTEND_DIR / "pages", html=True), name="pages")
