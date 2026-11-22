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
- `TAVILY_API_KEY`: real-time web search
- `STABILITY_API_KEY`: Stability text-to-image
- `DATABASE_URL`: reserved PostgreSQL/Prisma integration
- `PORT`: backend port, default `8787`
