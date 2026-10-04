import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    AI_API_KEY: str = os.getenv("AI_API_KEY", "")

settings = Settings()
