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

## Logging In

**1. Create an account**

On the login page, click Sign Up. Use a real email address you have access to, choose any first name and choose a password. After submitting you will receive a confirmation email. Open that email and click the confirmation link before trying to log in.

**2. Set up your organisation**

After confirming your email, log in and you will be asked for an organisation name and organisation password.

Use these credentials:

```
Organisation Name:     Meteorological
Organisation Password: mtn2026
```

**3. You are in**

You will land on the dashboard. Click New Project to start generating content.

---

## Using the App

1. From the dashboard, click New Project
2. Upload a PDF, PowerPoint or any document
3. Select your output formats on the right (presentation, website, diagram, Twitter post, LinkedIn post)
4. Set language, tone, audience and other options in the settings panel
5. Type a prompt and hit send
6. Download individual outputs or the full ZIP bundle

---

## Output Formats

- **Presentation** - Interactive 16:9 slide deck with downloadable .pptx
- **Website** - Self-contained responsive HTML page with custom colour and font selection
- **Mermaid Diagram** - Flowchart, bar chart or sequence diagram
- **Twitter / X Post** - Copy-paste ready tweet or thread
- **LinkedIn Post** - Copy-paste ready LinkedIn post

---

## Tech Stack

FastAPI backend, Google Gemini for AI generation, python-pptx for PowerPoint export, PyMuPDF for PDF processing, Mermaid.js for diagrams, vanilla HTML/CSS/JS frontend.

---

## Stopping the Server

Press `Ctrl+C` in the terminal window that opened when you ran `start_windows.bat`.
