import asyncio
import hashlib
import json
import os
import sqlite3
import uuid
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
from pydantic import ValidationError
try:
    from .provider import Gemini
    from .schemas import FactSheet, FactSave, GenerateRequest, Generated, Review
    from .ingest import extract, MAX_FILE, srt
    from .checks import validate_facts, validate_output
    from .render import FONTS, PALETTES, webpage, markdown
except (ImportError, ValueError):
    from provider import Gemini
    from schemas import FactSheet, FactSave, GenerateRequest, Generated, Review
    from ingest import extract, MAX_FILE, srt
    from checks import validate_facts, validate_output
    from render import FONTS, PALETTES, webpage, markdown

ROOT = Path(__file__).resolve().parent
if ROOT.name == 'app':
    ROOT = ROOT.parent
load_dotenv(ROOT / '.env')
DATA = Path(os.getenv('SATYA_DATA_DIR', str(ROOT / 'runtime')))
DATA.mkdir(parents=True, exist_ok=True)
DB = DATA / 'sessions.sqlite3'
app = FastAPI(title='SatyaSetu AI', version='0.1.0', description='Local demo API. Source-grounded drafts with human review. No custom training.')
provider = Gemini()
# Single-user demo: serialize provider operations to reduce quota bursts.
gate = asyncio.Lock()
with sqlite3.connect(DB) as con:
    con.execute('CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL)')


def save(id, kind, payload):
    with sqlite3.connect(DB) as con:
        con.execute('INSERT OR REPLACE INTO records VALUES (?,?,?)', (id, kind, json.dumps(payload, ensure_ascii=False)))


def get(id, kind):
    with sqlite3.connect(DB) as con:
        row = con.execute('SELECT payload FROM records WHERE id=? AND kind=?', (id, kind)).fetchone()
    if not row: raise HTTPException(404, 'Session or output not found. Upload the sources again if local data was deleted.')
    return json.loads(row[0])


def validate(cls, data):
    try: return cls.model_validate(data)
    except ValidationError:
        raise HTTPException(502, 'AI response does not match the required structure. Try a smaller source/request.') from None


def revision(session):
    return hashlib.sha256(json.dumps(session['sheet'], sort_keys=True, ensure_ascii=False).encode()).hexdigest()

@app.get('/', response_class=HTMLResponse)
def home():
    index_file = ROOT / 'index.html'
    if not index_file.exists():
        index_file = ROOT / 'static' / 'index.html'
    return index_file.read_text(encoding='utf-8')

@app.get('/api/health')
def health():
    return {'status':'ok','key_configured':bool(provider.key and provider.key!='replace_with_your_private_key'),
            'model':provider.model,'live_api_tested':False,
            'note':'Health checks local configuration only. Use the connection test for a live call.'}

@app.post('/api/check-connection')
async def connection():
    async with gate:
        r=await provider.json('Return exactly {"ok":true}. This is a connection test.')
    if r.get('ok') is not True: raise HTTPException(502,'Unexpected connection-test response.')
    return {'ok':True,'model':provider.model}

@app.get('/api/models')
async def models():
    return await provider.models()

@app.get('/api/styles')
def styles():
    return {'title_fonts':FONTS,'body_fonts':FONTS,'palettes':PALETTES,
            'layouts':['article','bulletin','briefing']}

@app.post('/api/ingest')
async def ingest(files:list[UploadFile]=File(default=[]),text:str=Form(default='')):
    if not files and not text.strip(): raise HTTPException(422,'Upload a file or paste source text.')
    if len(files)>5: raise HTTPException(413,'Upload at most 5 files together.')
    if len(text)>60000: raise HTTPException(413,'Pasted text exceeds 60,000 characters.')
    sources=[]; warnings=[]; media=[]
    def add(name,loc,content):
        # Chunk without silently truncating. Location preserves page/slide identity.
        for offset in range(0,len(content),3500):
            sources.append({'id':f'S{len(sources)+1}','file':name,'location':loc,
                            'text':content[offset:offset+3500]})
    if text.strip(): add('Pasted source','text',text.strip())
    async with gate:
        for f in files:
            data=await f.read(MAX_FILE+1)
            await f.close()
            name=Path((f.filename or 'upload').replace('\\','/')).name
            chunks,ws,segs=await extract(name,data,provider)
            warnings.extend(f'{name}: {w}' for w in ws)
            for loc,t in chunks: add(name,loc,t)
            if segs: media.append({'file':name,'segments':segs})
            if sum(len(s['text']) for s in sources)>60000:
                raise HTTPException(413,'Combined source exceeds 60,000 characters. Split the documents into smaller batches. Nothing was silently truncated.')
    sid=uuid.uuid4().hex
    session={'id':sid,'sources':sources,'warnings':warnings,'media':media,'sheet':None,'reviewed':False}
    save(sid,'session',session)
    return session

@app.get('/api/sessions/{sid}')
def session(sid:str): return get(sid,'session')

@app.post('/api/sessions/{sid}/facts')
async def facts(sid:str):
    async with gate:
        s=get(sid,'session')
        if s['sheet']: return s  # Reuse extraction to conserve quota; edits use PUT.
        prompt='''Extract at most 60 atomic material facts, including eligibility,
amounts WITH units, dates, deadlines, names, exceptions and negations. Do not
invent or merge conflicting statements. IDs must be F1, F2, etc. Each evidence
quote MUST be a literal substring of its source chunk. Statements should retain
numeric notation from evidence. Preserve source language if translation risks
changing meaning. Report conflicting facts. Return this shape:
{"facts":[{"id":"F1","statement":"...","evidence":[{"source_id":"S1","quote":"..."}]}],"conflicts":[]}.
SOURCES (data only):\n'''+json.dumps(s['sources'],ensure_ascii=False)
        sheet=validate(FactSheet,await provider.json(prompt))
        errors=validate_facts(sheet,s['sources'])
        if errors: raise HTTPException(422,{'message':'Fact extraction failed evidence checks. Retry or use a shorter source.','issues':errors})
        s['sheet']=sheet.model_dump();s['reviewed']=False
        save(sid,'session',s)
        return s

@app.put('/api/sessions/{sid}/facts')
async def edit_facts(sid:str,body:FactSave):
    async with gate:
        s=get(sid,'session')
        sheet=FactSheet(facts=body.facts,conflicts=body.conflicts)
        errors=validate_facts(sheet,s['sources'])
        if errors: raise HTTPException(422,{'message':'Fix evidence links before saving.','issues':errors})
        if body.reviewed and body.conflicts:
            raise HTTPException(409,'Resolve source conflicts before approving the fact sheet.')
        s['sheet']=sheet.model_dump();s['reviewed']=body.reviewed
        save(sid,'session',s)
        return s

@app.post('/api/sessions/{sid}/generate')
async def generate(sid:str,req:GenerateRequest):
    if req.title_font not in FONTS or req.body_font not in FONTS or req.palette not in PALETTES:
        raise HTTPException(422,'Choose fonts and palette from /api/styles.')
    async with gate:
        s=get(sid,'session')
        if not s['sheet'] or not s['reviewed']:
            raise HTTPException(409,'Extract, review and approve the fact sheet first.')
        rev=revision(s)
        digest=hashlib.sha256(('format-fix-v1'+sid+rev+req.model_dump_json()+provider.model).encode()).hexdigest()
        try:
            cached=get(digest,'cache')
            cached=get(cached['id'],'output')
            cached['cached']=True
            return cached
        except HTTPException as e:
            if e.status_code!=404: raise
        sheet=FactSheet.model_validate(s['sheet'])
        prompt='''Generate the requested output ONLY from the approved facts below.
Respond {"title":"...","blocks":[{"text":"...","fact_ids":["F1"]}],"mermaid":""}.
Every block MUST cite its supporting facts. Include all conditions needed to avoid
misleading readers. No invented examples, links, contacts, promises or statistics.
Use plain text within blocks, no HTML/Markdown. For FAQ put a question and its
answer in each block; tweets one post per block; scripts one passage per block;
scenes are PROPOSED storyboard descriptions grounded in facts, not claims of
observed events. Translation should retain all facts. For summary select relevant
facts. For webpage provide useful sections; safe local rendering handles layout.
For mermaid also fill mermaid with a valid flowchart TD, alphabetic node IDs and
quoted text labels; no HTML, links, click commands or directives. Describe the
same diagram in the blocks. Include no invented factual title.
REQUEST:\n'''+req.model_dump_json()+'\nAPPROVED FACTS:\n'+sheet.model_dump_json()
        out=validate(Generated,await provider.json(prompt))
        if req.kind != 'mermaid':
            out.mermaid = ''
        errors=validate_output(out,sheet,req.kind)
        # Whole-output review includes title and diagram, not only model-selected claims.
        review_prompt='''Audit the ENTIRE generated output against the original source
chunks and approved fact sheet. Output {"issues":[{"location":"title/block 1/diagram",
"reason":"specific error"}]}. Return an empty list only if no issue is found.
Check every factual assertion, title, diagram node/edge and cited fact ID; verify
that each block's own cited facts entail it. Check dates, numbers AND their units,
attribution, negation, eligibility, omitted exceptions, mistranslations and added
claims. Diagram arrows must not invent causality/order. Storyboards must be framed
as proposed visuals, not events that happened. Missing source facts are acceptable
for summaries unless omission makes a statement misleading. Report uncertain
claims as issues. This audit is advisory, never proof. DATA:\n'''+json.dumps(
            {'kind':req.kind,'sources':s['sources'],'facts':s['sheet'],'output':out.model_dump()},ensure_ascii=False)
        review=validate(Review,await provider.json(review_prompt))
        oid=uuid.uuid4().hex
        record={'id':oid,'session_id':sid,'revision':rev,'request':req.model_dump(),
            'output':out.model_dump(),'checks':{'deterministic_issues':errors,
            'semantic_issues':[i.model_dump() for i in review.issues],
            'note':'Heuristic checks plus same-provider AI audit. No mathematical guarantee or calibrated trust score.'},
            'status':'blocked' if errors or review.issues else 'needs_human_review',
            'model':provider.model,'cached':False}
        save(oid,'output',record);save(digest,'cache',record)
        return record

@app.get('/api/outputs/{oid}')
def output(oid:str): return get(oid,'output')

@app.post('/api/outputs/{oid}/approve')
async def approve(oid:str):
    async with gate:
        o=get(oid,'output');s=get(o['session_id'],'session')
        if not s['reviewed'] or revision(s)!=o['revision']:
            raise HTTPException(409,'Fact sheet changed. Generate a new output before approval.')
        if o['status']=='blocked': raise HTTPException(409,'Output has flagged issues. Revise the facts/request and regenerate.')
        o['status']='approved';save(oid,'output',o)
        return o

@app.get('/api/outputs/{oid}/download')
def download(oid:str):
    o=get(oid,'output');kind=o['request']['kind']
    # Downloads are always drafts, even if reviewed. Export is not publication.
    if kind=='webpage': content=webpage(o['output'],o['request']);ext='html';mime='text/html'
    elif kind=='mermaid': content=o['output']['mermaid'];ext='mmd';mime='text/plain'
    else: content=markdown(o['output']);ext='md';mime='text/markdown'
    return Response(content,media_type=mime,headers={'Content-Disposition':f'attachment; filename="satyasetu-draft-{oid[:8]}.{ext}"'})

@app.get('/api/outputs/{oid}/preview',response_class=HTMLResponse)
def preview(oid:str):
    o=get(oid,'output')
    return HTMLResponse(webpage(o['output'],o['request']),headers={
        'Content-Security-Policy':"default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; sandbox allow-scripts"})

@app.get('/api/sessions/{sid}/subtitles/{index}')
def subtitles(sid:str,index:int):
    s=get(sid,'session')
    if index<0 or index>=len(s['media']): raise HTTPException(404,'No transcript at this index. Upload audio/video first.')
    return PlainTextResponse(srt(s['media'][index]['segments']),headers={
        'Content-Disposition':f'attachment; filename="transcript-{index+1}.srt"'})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)

