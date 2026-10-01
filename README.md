# SSApp - FastAPI + Uvicorn + HTML/CSS/JS Template

A starter project template featuring a FastAPI backend with Uvicorn server, static HTML (`pages/`), CSS, and JavaScript frontend.

## Project Layout

```
├── .env.example
├── .env
├── .gitignore
├── README.md
├── requirements.txt
├── main.py
├── backend/
│   └── app/
│       ├── __init__.py
│       ├── main.py
│       ├── config.py
│       └── api/
│           ├── __init__.py
│           └── routes.py
└── frontend/
    ├── pages/
    │   └── index.html
    ├── css/
    │   └── style.css
    └── js/
        └── main.js
```

## How to Run

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the application:**
   ```bash
   python main.py
   ```
   *Alternatively, run with uvicorn directly:*
   ```bash
   uvicorn backend.app.main:app --reload
   ```

3. **Access the application:**
   Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your web browser.


im gay not
