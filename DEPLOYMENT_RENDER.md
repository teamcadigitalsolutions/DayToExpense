# 🚀 Deploying DayToExpense on Render.com with PostgreSQL

This guide provides complete step-by-step instructions for hosting your **FastAPI Backend**, **Render PostgreSQL Database**, and **React Frontend** on [Render.com](https://render.com).

---

## 🏗️ Deployment Architecture Overview

```mermaid
graph TD
    User([Browser Client]) -->|HTTPS Requests| Frontend[React Static Site\ndaytoexpense-frontend.onrender.com]
    User -->|API Calls /api/v1| Backend[FastAPI Web Service\ndaytoexpense-backend.onrender.com]
    Backend -->|Async PostgreSQL Driver| Database[(Render Managed PostgreSQL\ndaytodayexpenses)]
```

- **Frontend**: Render Static Site (Vite React + Tailwind CSS)
- **Backend**: Render Python Web Service (FastAPI + Uvicorn + SQLAlchemy Async)
- **Database**: Render Managed PostgreSQL Database (`daytodayexpenses`)

---

## ⚡ Method A: 1-Click Render Blueprint (Recommended)

Render supports Blueprint configuration via `render.yaml` (which has already been added to your project root).

### Step 1: Push Project to GitHub
1. Push your repository to GitHub (or GitLab):
   ```bash
   git add .
   git commit -m "Add Render deployment config and PostgreSQL support"
   git push origin main
   ```

### Step 2: Deploy Blueprint on Render
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click the **New +** button in the top right corner and select **Blueprint**.
3. Connect your GitHub repository.
4. Render will automatically detect `render.yaml` and provision:
   - 🗄️ **PostgreSQL Database** (`daytoexpense-postgres`)
   - 🐍 **FastAPI Backend** (`daytoexpense-backend`)
   - ⚛️ **React Frontend** (`daytoexpense-frontend`)
5. Click **Apply**. Render will automatically build and link all services!

---

## 🛠️ Method B: Manual Step-by-Step Deployment

If you prefer configuring each service manually in the Render UI:

### Step 1: Create PostgreSQL Database
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **PostgreSQL**.
3. Fill in details:
   - **Name**: `daytoexpense-postgres`
   - **Database**: `daytodayexpenses`
   - **User**: `daytoexpense_admin`
   - **Region**: Choose closest to you (e.g. Singapore / Frankfurt / Oregon)
   - **Plan**: Free / Starter
4. Click **Create Database**.
5. Once created, copy the **Internal Database URL** (e.g., `postgres://daytoexpense_admin:password@dpg-xxx-a/daytodayexpenses`).

---

### Step 2: Deploy FastAPI Backend
1. Click **New +** -> **Web Service**.
2. Connect your GitHub repo.
3. Configure settings:
   - **Name**: `daytoexpense-backend`
   - **Language**: `Python 3`
   - **Branch**: `main`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
4. Add **Environment Variables**:
   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `APP_NAME` | `DayToExpense` | App name |
   | `APP_ENV` | `production` | Enables production mode |
   | `DEBUG` | `false` | Disables debug logs |
   | `DATABASE_URL` | *(Paste Internal Database URL from Step 1)* | Render PostgreSQL connection |
   | `JWT_SECRET_KEY` | *(Generate a random 64-char string)* | JWT signing key |
   | `JWT_REFRESH_SECRET_KEY` | *(Generate a random 64-char string)* | JWT refresh key |
   | `CORS_ORIGINS` | `https://daytoexpense-frontend.onrender.com` | Frontend URL |
5. Click **Create Web Service**.

---

### Step 3: Deploy React Frontend
1. Click **New +** -> **Static Site**.
2. Connect your GitHub repo.
3. Configure settings:
   - **Name**: `daytoexpense-frontend`
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist` (or `frontend/dist` if root is not set)
4. Add **Redirects / Rewrites** under **Redirects/Rewrites** tab:
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - **Action**: `Rewrite`
5. Click **Create Static Site**.

---

## 🔑 Post-Deployment Automatic Setup

On initial startup, the backend automatically runs `init_db()`, which:
1. Creates all PostgreSQL tables (`app_users`, `workspaces`, `accounts`, `transactions`, `loans`, `investments`, `subscriptions`).
2. Seeds the default **Admin Account**:
   - **Email**: `admin@daytoexpense.com` (or username `admin`)
   - **Password**: `DayToExpense@2024`

> 💡 **Custom User Registration**:
> Users can also click **Sign Up** on your live URL to create brand-new accounts stored in your Render PostgreSQL database!
