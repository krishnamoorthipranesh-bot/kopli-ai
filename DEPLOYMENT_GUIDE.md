# KOPLI AI – Production Deployment Guide (Render)

This guide provides step-by-step instructions to deploy **KOPLI AI** to **Render** with high reliability and zero downtime.

---

## 1. Prerequisites

1. A free or paid account at [Render.com](https://render.com).
2. GitHub repository access to `https://github.com/krishnamoorthipranesh-bot/kopli-ai.git`.
3. API credentials for full feature activation (optional for initial deployment; KOPLI AI boots in demo mode without them):
   - **Groq API Key**: [console.groq.com](https://console.groq.com)
   - **Tavily API Key**: [app.tavily.com](https://app.tavily.com)
   - **Stability AI API Key**: [platform.stability.ai](https://platform.stability.ai)
   - **PostgreSQL Database URL**: Any PostgreSQL provider (Neon, Supabase, or Render Postgres).

---

## 2. Deployment Method A: Blueprint Deployment (Recommended)

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** in the top navigation and select **Blueprint**.
3. Connect your GitHub account and select repository:
   `krishnamoorthipranesh-bot/kopli-ai`
4. Render will read `render.yaml` from the repository root:
   - **Service Name**: `kopli-ai`
   - **Runtime**: `Docker`
   - **Health Check Path**: `/api/status`
   - **Auto-generated Secrets**: `KOPLI_ADMIN_SECRET`, `SESSION_SECRET`
5. In the environment variables prompt, enter your values:
   - `GROQ_API_KEY`: Your Groq API key
   - `TAVILY_API_KEY`: Your Tavily API key
   - `STABILITY_API_KEY`: Your Stability AI API key
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `KOPLI_OWNER_EMAIL`: Your primary admin email (e.g. `owner@example.com`)
6. Click **Apply**.
7. Render will build the Docker container and deploy the service.

---

## 3. Deployment Method B: Manual Web Service Deployment

If you prefer to configure the Web Service manually:

1. Click **New +** -> **Web Service**.
2. Select your repository: `krishnamoorthipranesh-bot/kopli-ai`.
3. Configure the service settings:
   - **Name**: `kopli-ai`
   - **Region**: Choose the closest region (e.g., Singapore, Frankfurt, Oregon, Ohio).
   - **Branch**: `master`
   - **Runtime**: **Docker**
   - **Instance Type**: **Free**
4. Expand **Advanced**:
   - **Health Check Path**: `/api/status`
5. Under **Environment Variables**, add the following keys:
   | Key | Value / Instructions |
   |---|---|
   | `GROQ_API_KEY` | Your Groq API key |
   | `TAVILY_API_KEY` | Your Tavily API key |
   | `STABILITY_API_KEY` | Your Stability AI API key |
   | `DATABASE_URL` | Your PostgreSQL database URL |
   | `KOPLI_OWNER_EMAIL` | Owner email address |
   | `KOPLI_ADMIN_SECRET` | 32+ character random string |
   | `SESSION_SECRET` | 32+ character random string |
   | `GROQ_MODEL` | `openai/gpt-oss-120b` (or `llama-3.3-70b-versatile`) |
6. Click **Create Web Service**.

---

## 4. Database Setup & Automated Migrations

When you supply a PostgreSQL `DATABASE_URL`:
- The server automatically executes `npx prisma migrate deploy` on startup.
- All tables, indexes, constraints, and relations defined in `prisma/migrations/0_init/migration.sql` are applied immediately.
- If you use **Supabase** or **Neon**:
  - In Supabase, use the **Transaction / Session pooling** connection string or Direct URL on port 5432 / 6543.
  - In Neon, use the connection string with `?sslmode=require`.

---

## 5. Post-Deployment Verification Checklist

1. **Check Live Status**: Visit `https://<your-service-name>.onrender.com/api/status`. Ensure it returns HTTP 200 with JSON:
   ```json
   {
     "groq": true,
     "tavily": true,
     "stability": true,
     "database": true,
     "demo": false,
     "model": "openai/gpt-oss-120b"
   }
   ```
2. **Load Web App**: Open `https://<your-service-name>.onrender.com`. Ensure the dashboard loads without layout shift or console errors.
3. **Register Owner Account**:
   - Click "Sign in or create account".
   - Register using the email configured in `KOPLI_OWNER_EMAIL`.
   - Your account is automatically granted `owner` role.
4. **Test AI Chat**: Send a message in "Smart" mode and confirm real-time streaming tokens.
5. **Test Web Search**: Send a message in "Research" mode or visit "Web Search" and confirm live web results.
6. **Test Explore Tools**: Generate a sample DOCX, PDF, PPTX or Image.
