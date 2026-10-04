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
            "Return ONLY a raw JSON object with the following structure, containing exactly 3 color palettes (each with 5 hex color codes: background, primary, secondary, accent, dark) and 6 Google Fonts (3 for title, 3 for body): "
            '{"palettes": [["#235E5E", "#558968", "#a2af9f", "#EFECDE", "#381A1A"], ["#2f00b1", "#195981", "#6fffa2", "#d5ffef", "#220035"], ["#1a1610", "#e2a221", "#f5b73d", "#dfd4c0", "#fbf7ee"]], "fonts": [{"name": "Playfair Display", "type": "title"}, {"name": "Montserrat", "type": "title"}, {"name": "Roboto Slab", "type": "title"}, {"name": "DM Sans", "type": "body"}, {"name": "Open Sans", "type": "body"}, {"name": "Lato", "type": "body"}]}'
        )
    else:
        instructions.append(
            "Your task is to generate the specific outputs requested by the user based on the provided context."
        )
        if len(formats) > 1 or any(kw in str(config).lower() for kw in ["website", "presentation", "mermaid", "diagram"]):
            instructions.append(
                "CRITICAL: When multiple outputs (e.g. presentation, website, diagram) are requested, you MUST cleanly separate each output under its own distinct top-level header: "
                "'## Deliverable: Presentation', '## Deliverable: Website', '## Deliverable: Mermaid Diagram'. "
                "Never mix website HTML code or Mermaid code into the presentation slides."
            )

        if "presentation" in formats or "presentation" in str(config).lower():
            instructions.append(
                "For 'presentation', output structured presentation slides separated by '---'. "
                "Slide 1 must be the Title Slide. "
                "Each subsequent slide must start with '## Slide Title' followed by bullet points. "
                "Do NOT write 'Image Suggestion: ...' as a bullet point. If an image is relevant, include it on its own line using markdown image syntax: `![Image topic](https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800)`."
            )
        if "website" in formats or "website" in str(config).lower():
            instructions.append(
                "For 'website', output ONLY valid, self-contained HTML/CSS/JS code inside a ```html markdown code block. "
                "Ensure it is fully responsive, modern, and beautiful. Do NOT put website code inside presentation slides."
            )
        if "mermaid" in formats or "infographic" in formats or "diagram" in str(config).lower():
            instructions.append(
                "For 'mermaid' or 'infographic' or 'diagram', output valid Mermaid code inside a ```mermaid markdown block. "
                "Do NOT put mermaid diagrams inside presentation slides."
            )
        if "pdf" in formats or "advisory" in formats or "exec_summary" in formats:
            instructions.append(
                "For documents, structure them professionally in Markdown with clear sections."
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
