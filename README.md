# KOPLI AI

KOPLI AI is a responsive AI assistant created and owned by Pranesh KK.

## Run locally

1. Install Node.js 20 or newer.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env`.
4. Add provider keys only to the backend `.env` file.
5. Start the application:
   ```bash
   npm run dev
   ```
6. Open `http://localhost:5173`.

The Express API runs on `http://localhost:8787`.

## Demo mode

With no provider keys configured, chat works in clearly labeled demo mode. Search, image, and Groq responses are never simulated as successful external-provider results.

## Provider environment variables

- `GROQ_API_KEY`: Groq text generation
- `GROQ_VISION_MODEL`: optional Groq vision model override; defaults to `qwen/qwen3.8-27b`
- `TAVILY_API_KEY`: real-time web search
- `STABILITY_API_KEY`: Stability text-to-image
- `DATABASE_URL`: PostgreSQL/Prisma persistence for accounts, sessions, conversations, and saved files
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL`: password recovery email delivery; the sender must be verified with Resend
- `APP_URL`: public app origin used in password recovery links; defaults to the production site
- `PORT`: backend port, default `8787`
