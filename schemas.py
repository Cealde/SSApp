from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid')

class Evidence(Strict):
    source_id: str
    quote: str = Field(min_length=1, max_length=4000)

class Fact(Strict):
    id: str
    statement: str = Field(min_length=1, max_length=4000)
    evidence: list[Evidence] = Field(min_length=1, max_length=8)

class FactSheet(Strict):
    facts: list[Fact] = Field(min_length=1, max_length=60)
    conflicts: list[str] = Field(default_factory=list, max_length=30)

class FactSave(FactSheet):
    reviewed: bool = False

class Block(Strict):
    text: str = Field(min_length=1, max_length=8000)
    fact_ids: list[str] = Field(min_length=1, max_length=60)

class Generated(Strict):
    title: str = Field(min_length=1, max_length=300)
    blocks: list[Block] = Field(min_length=1, max_length=60)
    mermaid: str = Field(default='', max_length=15000)

class GenerateRequest(Strict):
    kind: Literal['summary','faq','script','scenes','document','translation','tweets','mermaid','webpage']
    language: Literal['English','Hindi','Malayalam','Tamil'] = 'English'
    audience: Literal['general','students','children','officials'] = 'general'
    instruction: str = Field(default='', max_length=2000)
    title_font: str = 'Georgia'
    body_font: str = 'Arial'
    palette: str = 'ocean'
    layout: Literal['article','bulletin','briefing'] = 'article'

class Issue(Strict):
    location: str
    reason: str

class Review(Strict):
    issues: list[Issue] = Field(max_length=100)

class Segment(Strict):
    start: float = Field(ge=0, le=3600)
    end: float = Field(gt=0, le=3600)
    text: str = Field(min_length=1, max_length=2000)

class Transcript(Strict):
    segments: list[Segment] = Field(min_length=1, max_length=400)
    visual_description: str = Field(default='', max_length=12000)
