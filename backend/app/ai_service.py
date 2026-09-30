from backend.app.config import settings

class AIService:
    """
    Placeholder service for AI assistant integration.
    AI API key is optional and not required to run the application.
    """
    def __init__(self):
        self.api_key = settings.AI_API_KEY

    async def generate_response(self, prompt: str) -> str:
        if not self.api_key:
            return "AI API key placeholder (not configured)"
        return f"AI Response: {prompt}"

ai_service = AIService()
