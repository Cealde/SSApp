# SatyaSetu AI — local SIH prototype

A Python FastAPI service and a local test workbench for transforming documents into source-grounded drafts using the Gemini API. This project uses a hosted pretrained model. It contains no custom-trained weights and makes no mathematical guarantee of factual correctness.

## Start on Windows

1. Extract the ZIP fully into a folder, for example `D:\SatyaSetu_AI`. Do not run inside the ZIP preview.
2. Install Python 3.11 or 3.12 if needed (include the Python launcher).
3. Double-click `start_windows.bat`. The first run installs dependencies.
4. Notepad opens `.env`. Replace `replace_with_your_private_key` with your NEW Gemini key. Save and close Notepad. Never share this file or upload it to GitHub.
5. Open http://127.0.0.1:8000. Keep the terminal open.
6. Click **Test API connection**. This is a real API call using your local key.
7. Click **Load example**, then **Read sources**, then **Extract facts**.
8. Compare the fact sheet with the extracted passages. Correct facts/evidence as necessary and click **I reviewed these facts · approve**.
9. Choose format, language and audience, then **Generate and check**. For a webpage, choose fonts, palette and layout first.
10. Review the draft and flagged issues. Download the draft and its JSON check report. Successful checks do not replace human review.

The key stays on your server. Source text/media is sent to Google's API for inference. Free-tier content may be used by Google to improve products under its terms. Use public demo material.

If `.env` already exists and needs editing, open it manually in Notepad and restart the server. Ensure it is named `.env`, not `.env.txt`.

## macOS/Linux or manual start

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env locally and add your key.
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Windows manual equivalent: use `py -3 -m venv .venv` and `.venv\Scripts\activate` in Command Prompt.

## What this version supports

| Area | Implemented behaviour | Limits |
|---|---|---|
| Text, Markdown, CSV | UTF-8 text ingestion | CSV is treated as text, not analysed as a database |
| PDF | Page-linked text extraction | No OCR, figures, chart interpretation or reliable complex-table layout |
| Word | DOCX body paragraphs/tables in order | No legacy DOC, image OCR, headers or text boxes |
| PowerPoint | PPTX slide text/tables and grouped text | No legacy PPT, images, charts or notes |
| Multiple inputs | Up to 5 files and pasted text together | 8 MB/file; 60,000 extracted characters total; no silent truncation |
| Audio/video | Gemini transcription; video visual description | Short clips recommended; media quality and timing not live-tested here |
| Subtitles | SRT download from transcript timestamps | Approximate AI timestamps, no forced alignment; check manually |
| Generation | Summary, FAQ, scripts, proposed storyboards, document, translation, tweet thread | Outputs need review; prompts cannot guarantee word counts or translation quality |
| Languages | English, Hindi, Malayalam, Tamil requested through the model | No language-specific accuracy benchmark yet |
| Diagrams | Mermaid top-down flowchart source and text explanation | No diagram rendering or full Mermaid parser included; check in a Mermaid editor |
| Webpages | Select fonts, palette, layout before content generation | Safe template renderer; not arbitrary AI-generated JavaScript or bespoke layouts |
| Documents | Markdown download | No DOCX/PDF output export in this build |
| Fact sheet | Editable facts with literal evidence quotes, review gate | Extraction can omit or misinterpret facts; reviewer must compare with originals |
| Verification | Number checks per cited fact, source-ID checks, whole-output AI semantic audit | Same-model audit is fallible; no NLI/back-translation implementation or trust percentage |
| Export | Download drafts and JSON check reports | No publishing, WhatsApp integration, RSS, URL ingestion or TTS audio generation |

Use this feature table when presenting the demo. The wider PPT is a roadmap; targets in it are not measured results.

## How verification works

1. Extract source passages and assign stable passage IDs within a session.
2. Ask Gemini for facts with evidence quotes.
3. Verify each quote exists in the stated source and check numbers against the quote.
4. Require a human to review/approve the fact sheet. Explicit conflicts block approval.
5. Generate output from the approved facts; each block cites fact IDs.
6. Check unknown citations and numbers absent from cited facts, normalising Unicode decimal digits and comma grouping.
7. Audit the entire output, including title/diagram, against source passages and facts using another Gemini call.
8. Flag failures as `blocked`; otherwise use `needs_human_review`. Human approval marks an output `approved` but does not publish anything.

Number checks are conservative string/value checks: written-out numbers, equivalent units, date wording and decimal formats can cause false flags or misses. Swapped attribution or negation requires semantic/human review. Citation presence alone does not establish entailment. Do not claim a mathematical guarantee or measured 99% preservation.

Fact edits invalidate old approval eligibility. All downloads retain draft status, including after approval. Blocked drafts can be downloaded for debugging but cannot be approved by the API.

## API integration for your backend teammates

Interactive endpoint documentation: http://127.0.0.1:8000/docs

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Configuration only, not a live inference test |
| POST | `/api/check-connection` | Live API test |
| GET | `/api/models` | Provider model list (does not prove free quota) |
| GET | `/api/styles` | Available fonts, colour palettes and layouts |
| POST | `/api/ingest` | Multipart `files` list and optional `text` |
| GET | `/api/sessions/{id}` | Reload source session |
| POST | `/api/sessions/{id}/facts` | Extract/reuse fact sheet |
| PUT | `/api/sessions/{id}/facts` | Save `{facts, conflicts, reviewed}` |
| POST | `/api/sessions/{id}/generate` | Generate a selected format and run checks |
| GET | `/api/outputs/{id}` | Full result and check report |
| POST | `/api/outputs/{id}/approve` | Human-review approval if unblocked and current |
| GET | `/api/outputs/{id}/download` | MD, MMD or HTML draft |
| GET | `/api/outputs/{id}/preview` | Sandboxed HTML preview |
| GET | `/api/sessions/{id}/subtitles/{index}` | SRT for zero-based media index |

Example generation request:

```json
{
  "kind": "webpage",
  "language": "English",
  "audience": "students",
  "instruction": "Explain eligibility and the deadline clearly.",
  "title_font": "Georgia",
  "body_font": "Arial",
  "palette": "ocean",
  "layout": "article"
}
```

Call this service from your existing backend or use a same-origin reverse proxy. CORS is intentionally not opened to every website. This build is single-user, localhost-only: do not expose it directly to the internet. Add authentication, per-user storage, upload scanning, request quotas and deployment review before public hosting. Run one server process/worker because the provider lock is in-process.

## API usage and errors

An initial text workflow usually costs 1 call for fact extraction plus 2 calls per new output. Each media file adds a transcription call. The connection check adds 1 call. Identical output requests are cached locally; no automatic repeated retries or paid-provider fallback is enabled. Model availability/free quota can differ by project.

Default configuration uses `gemini-3.1-flash-lite`, listed with a free tier in Google's pricing documentation when this package was prepared. Confirm availability in YOUR project. If it returns 404, consult `/api/models` and AI Studio, select an available model that explicitly has free quota, change `GEMINI_MODEL`, and restart. The model list alone does not indicate pricing. Do not enable billing for a free-only demo.

- **429**: quota/rate limit. Wait for the relevant quota reset or reduce requests. Switching blindly to a paid model is not the fix.
- **401/403**: check key/project permissions locally; never share the key in screenshots.
- **400**: unsupported model/input settings; try the small text example and verify the model ID.
- **502**: malformed/blocked provider output or service problem. Try a smaller request. Errors never expose raw API keys/provider payloads.
- **413**: upload/text too large. Split the input.
- **409**: review facts first, resolve conflicts, or regenerate after editing facts.
- **422**: unreadable file, invalid evidence, unsupported JSON edits, or empty transcription. Check the input.

## Testing and current status

```bash
python -m pytest -q
```

Automated tests cover multi-file Office extraction, source/evidence validation, unsupported uploads, number and semantic-issue blocking, review gates, cache reuse, stale fact revisions, HTML escaping, subtitle formatting, Unicode numerals and the provider request/error contract. Model responses are simulated in these tests. They do NOT establish language quality, factual accuracy, real media transcription quality, free-tier availability, or live latency.

No live request using your new key was run during packaging. Use the local connection test and sample flow first. Windows launcher instructions were prepared here but have not been executed on a Windows machine. `requirements-tested.txt` records the dependency versions used for local tests; `requirements.txt` allows compatible version ranges.

## GitHub

Create a repository and push the extracted source folder. Keep `.gitignore` present. Verify `.env`, `runtime/`, `.venv/`, uploads and private screenshots are excluded before pushing. `runtime/sessions.sqlite3` contains your local sources and results; delete `runtime/` while the server is stopped to clear demo data. There is no trained-model binary to upload.

## Official API references

- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/terms

Dependencies and the hosted provider remain subject to their respective licences and terms. Review those before distributing a modified project publicly.
