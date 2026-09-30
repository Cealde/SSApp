from backend.app.config import settings

class AIService:
    """
    Placeholder service for AI assistant integration.
    Replace with actual AI client implementation (e.g., OpenAI, Anthropic, Gemini).
    """
    def __init__(self):
        self.api_key = settings.AI_API_KEY

    async def generate_response(self, prompt: str) -> str:
        if not self.api_key:
            return "AI API key is not configured. Please set AI_API_KEY in .env file."
        # Add AI API interaction logic here
        return f"AI Placeholder response for: '{prompt}'"

ai_service = AIService()
