# Capsian AI

Adaptive programming tutor with a FastAPI backend, static HTML frontend, and learner-behavior classifier.

## Project layout

```text
backend_server.py       FastAPI application and API routes
qwen_main.html          Main application page
qwen_learn.html         Learning page
qwen_practice.html      Practice page
learner_classifier.pkl  Trained classifier loaded by the backend
ml_model_trainer.py     Model training script
telemetry_dataset.csv   Training data
requirements.txt        Python dependencies
render.yaml             Render deployment definition
.env.example            Safe local environment template
```

## Run locally

1. Create and activate a Python virtual environment.
2. Install dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

3. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`.
4. Start the server:

   ```powershell
   uvicorn backend_server:app --host 0.0.0.0 --port 8000
   ```

Open `http://localhost:8000`.

## Deploy on Render

Create a new **Blueprint** from this repository. Render reads `render.yaml`, installs `requirements.txt`, and starts the FastAPI service. Add `GEMINI_API_KEY` in the Render dashboard as a secret environment variable. Do not commit `.env` or a real API key.

The health endpoint is `GET /api/health`.

## Train the classifier

Run this only when the dataset or training logic changes:

```powershell
python ml_model_trainer.py
```