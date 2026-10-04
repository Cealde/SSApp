import os
import json
import google.generativeai as genai
from typing import Dict, Any, List

import asyncio

def get_gemini_model(model_name: str = None):
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        genai.configure(api_key=api_key)
    
    target_model = model_name or os.getenv("GEMINI_MODEL", "gemini-flash-latest")
    target_model = target_model.removeprefix("models/")
    return genai.GenerativeModel(target_model)

def format_system_instruction(config: Dict[str, Any], is_website_step_1: bool = False) -> str:
    formats = config.get("formats", [])
    audience = config.get("audience", "")
    tone = config.get("tone", "professional")
    level = config.get("level", "standard")
    style = config.get("style", "")
    org_name = config.get("orgName", "")
    org_icon = config.get("orgIconUrl", "")
    
    instructions = [
        "You are an expert AI content transformation engine.",
        f"Tone: {tone}",
        f"Level of Detail: {level}",
    ]
    if org_name and org_name.lower() != "unincorporated":
        instructions.append(f"Organization Name: {org_name}")
        if org_icon:
            instructions.append(f"Organization Logo URL: {org_icon}")
    if audience:
        instructions.append(f"Target Audience: {audience}")
    if style:
        instructions.append(f"Content Style: {style}")

    if is_website_step_1:
        instructions.append(
            "The user has requested a Website. You need to first provide design options. "
            "Return ONLY a raw JSON object with the following structure, containing exactly 3 color palettes (hex codes) and 6 Google Fonts (3 for title, 3 for body): "
            '{"palettes": [["#hex1", "#hex2"], ["#hex3", "#hex4"], ["#hex5", "#hex6"]], "fonts": [{"name": "Font1", "type": "title"}, {"name": "Font2", "type": "body"}]}'
        )
    else:
        instructions.append(
            "Your task is to generate the specific outputs requested by the user based on the provided context."
        )
        if "website" in formats:
            instructions.append(
                "For the 'website' output, output ONLY valid, self-contained HTML/CSS/JS code in a markdown block (or just raw HTML). "
                "Ensure it is fully responsive and uses modern design principles. Use images from Unsplash (e.g. https://images.unsplash.com/photo-12345?auto=format&fit=crop&w=800) for stock imagery. "
                "The page should reference the organization name if requested."
            )
        if "presentation" in formats:
            instructions.append(
                "For 'presentation', output a structured presentation in HTML or Markdown slide cards with headings and bullet points. "
                "Include a title slide with the organization details. Suggest Unsplash stock images for visual appeal."
            )
        if "mermaid" in formats or "infographic" in formats:
            instructions.append(
                "For 'mermaid' or 'infographic', output valid top-down Mermaid flowchart code inside a ```mermaid markdown block. "
                "Ensure it uses alphabetic node IDs and quoted text labels."
            )
        if "pdf" in formats or "advisory" in formats:
            instructions.append(
                "For documents, structure them professionally in Markdown. Include headers for the organization if specified."
            )
        
    return "\n".join(instructions)

async def generate_content(prompt: str, staging_data: Dict[str, Any], config: Dict[str, Any]) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        genai.configure(api_key=api_key)
        
    docs_context = ""
    for idx, doc in enumerate(staging_data.get("documents", [])):
        docs_context += f"\n--- Document {idx+1}: {doc.get('filename', 'Unknown')} ---\n{doc.get('content', '')}\n"
    
    is_website = "website" in config.get("formats", [])
    has_design_choices = "palette" in config
    
    system_instruction = format_system_instruction(config, is_website_step_1=(is_website and not has_design_choices))
    
    full_prompt = f"System Instructions:\n{system_instruction}\n\n"
    if docs_context:
        full_prompt += f"Context Documents:\n{docs_context}\n\n"
        
    full_prompt += f"User Request:\n{prompt}\n"
    
    if is_website and has_design_choices:
        full_prompt += (
            f"\nPlease build the website using the following design choices:\n"
            f"Palette: {config['palette']}\n"
            f"Title Font: {config['titleFont']}\n"
            f"Body Font: {config['bodyFont']}\n"
        )

    candidate_models = [
        os.getenv("GEMINI_MODEL", "gemini-flash-latest").removeprefix("models/"),
        "gemini-flash-latest",
        "gemini-3.8-flash",
        "gemini-3.1-flash-lite",
    ]
    candidate_models = list(dict.fromkeys(candidate_models))

    last_error = None
    for model_name in candidate_models:
        try:
            model = genai.GenerativeModel(model_name)
            response = await asyncio.to_thread(model.generate_content, full_prompt)
            if response and response.text:
                return response.text
        except Exception as e:
            last_error = e
            continue

    if last_error:
        raise last_error
    return "No response generated from AI model."
