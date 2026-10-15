# VibeFinance Deployment Guide

This guide provides complete instructions to deploy the VibeFinance full-stack application (FastAPI backend + Vite React frontend).

---

## Architecture Overview in Production

The production architecture is configured for **zero-friction single-service deployment**:

```
[ User Browser ]
       │
       ▼ HTTPS (Port 443)
[ Render Web Service / Container ]
   │
   ├─► /                  ──► Vite React Single Page Application (frontend/dist/index.html)
   ├─► /assets/*          ──► Static CSS, JavaScript, SVGs
   ├─► /portfolio, etc.   ──► SPA Fallback routing (index.html)
   ├─► /api/v1/*          ──► FastAPI REST Endpoints (stocks, trading, AI orchestrator)
   ├─► /health            ──► Automated health check probe (HTTP 200)
   └─► /docs              ──► Interactive OpenAPI / Swagger UI
```

This unified deployment eliminates CORS configuration issues and gives you a single, clean URL on Render's free tier.

---

## Method 1: Render 1-Click Blueprint (Recommended)

Render offers a free tier for Web Services and automated Git deployments.

### Prerequisites
1. A GitHub account with this repository pushed to your remote:
   `https://github.com/PranaviSenthil/Fin-Alpha`
2. A free [Render account](https://render.com).
3. A Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/).

### Deployment Steps

1. **Commit and Push your changes to GitHub**:
   ```bash
   git add .
   git commit -m "Configure production deployment for Render and Vercel"
   git push origin master
   ```

2. **Open Render Dashboard**:
   - Go to [dashboard.render.com](https://dashboard.render.com).
   - In the top right, click **New +** and select **Blueprint**.

3. **Connect Repository**:
   - Select your repository `PranaviSenthil/Fin-Alpha`.
   - Render will detect the included [`render.yaml`](render.yaml) file automatically.

4. **Review & Configure Environment Variables**:
   - Service Name: `vibefinance` (or your preferred name)
   - Runtime: `Docker`
   - Plan: `Free`
   - Set the `GEMINI_API_KEY` environment variable with your Gemini API key.
   - `SECRET_KEY` will be generated automatically.

5. **Click "Apply"**:
   - Render will build the multi-stage Docker container (compiling the frontend and setting up the Python backend).
   - Once build completes, your application will be live at:
     `https://vibefinance-<unique-id>.onrender.com`

---

## Method 2: Render Manual Web Service (Without Blueprint)

If you prefer to configure the Web Service manually in the Render UI:

1. In Render Dashboard, click **New +** -> **Web Service**.
2. Connect `PranaviSenthil/Fin-Alpha`.
3. Choose **Docker** as the Runtime:
   - **Dockerfile Path**: `Dockerfile`
   - **Instance Type**: `Free`
   - **Health Check Path**: `/health`
4. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: `<Your Gemini Key>`
   - `GEMINI_MODEL`: `gemini-2.5-flash`
   - `SECRET_KEY`: `<A random secure 32+ character string>`
5. Click **Deploy Web Service**.

---

## Method 3: Split Deployment (Vercel Frontend + Render Backend)

If you prefer deploying the frontend onto Vercel's global CDN:

### Part A: Deploy Backend on Render
1. Create a Web Service on Render pointing to your repo.
2. In the Render Web Service settings:
   - Build Command: `pip install -r backend/requirements.txt`
   - Start Command: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Health Check Path: `/health`
3. Note your backend URL (e.g. `https://vibefinance-backend.onrender.com`).

### Part B: Deploy Frontend on Vercel
1. Go to [vercel.com](https://vercel.com) and click **Add New** -> **Project**.
2. Import `PranaviSenthil/Fin-Alpha`.
3. Configure the project:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add Environment Variable:
   - `VITE_API_BASE_URL`: `https://vibefinance-backend.onrender.com`
5. Click **Deploy**. Vercel will deploy your frontend with automatic HTTPS and global CDN.

---

## Method 4: Local Production Testing

To test the compiled production build locally before pushing:

1. Build the frontend:
   ```powershell
   npm run build:all
   ```

2. Start the unified production server:
   ```powershell
   .\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```
   *(Run from within the `backend` directory)*

3. Open `http://127.0.0.1:8000` in your web browser. You will see the full application running with static SPA serving and API routing unified on a single port.

---

## Verification & Health Check Endpoints

Once deployed, you can verify your service status using:

- **Web Application**: `https://<your-service-url>/`
- **Health Check**: `https://<your-service-url>/health`
- **Interactive OpenAPI Documentation**: `https://<your-service-url>/docs`
- **Stocks Universe API**: `https://<your-service-url>/api/v1/stocks`
