# SatyaSetu Engine

A web platform that takes uploaded documents and turns them into presentations, websites, diagrams and social media posts in any language, all from a single prompt.

---

## Setup

### Requirements

- Windows
- Python 3.11 or 3.12 from [python.org](https://www.python.org/downloads/)

### Steps

**1. Add the API keys**

Open `keys.txt` in the root of the project. Copy the values inside into `.env` (also in the root). The `.env` file is already there with empty fields, just paste in the values.

**2. Run the app**

Double-click `start_windows.bat`.

It will automatically create a virtual environment, install all dependencies and start the server. This may take a minute on first run.

**3. Open the app**

Once the server is running, open your browser and go to:

```
http://127.0.0.1:8000
```

---

## Using the App

1. Log in with your organisation credentials
2. From the dashboard, click New Project
3. Upload a PDF, PowerPoint or any document
4. Select your output formats on the right (presentation, website, diagram, Twitter post, LinkedIn post)
5. Set language, tone, audience and other options in the settings panel
6. Type a prompt and hit send
7. Download individual outputs or the full ZIP bundle

---

## Output Formats

| Format | What you get |
|---|---|
| Presentation | Interactive 16:9 slide deck + downloadable .pptx |
| Website | Self-contained responsive HTML page |
| Mermaid Diagram | Flowchart, bar chart or sequence diagram |
| Twitter / X Post | Copy-paste ready tweet or thread |
| LinkedIn Post | Copy-paste ready LinkedIn post |

---

## Tech Stack

FastAPI backend, Google Gemini for AI generation, python-pptx for PowerPoint export, PyMuPDF for PDF processing, Mermaid.js for diagrams, vanilla HTML/CSS/JS frontend.

---

## Stopping the Server

Press `Ctrl+C` in the terminal window that opened when you ran `start_windows.bat`.
