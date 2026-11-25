import { app, initializeDatabase } from "../server/index.js";

// Vercel loads this module once per warm function instance. Start the shared
// Supabase/Postgres connection without opening a long-running HTTP listener.
void initializeDatabase();

export default app;
