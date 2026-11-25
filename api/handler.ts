let databaseInitialization: Promise<void> | undefined;

export default async function handler(req: any, res: any) {
  try {
    const originalPathValue = req.query?.__originalPath;
    const originalPath = typeof originalPathValue === "string" && originalPathValue.startsWith("/")
      ? originalPathValue
      : "/api/health";
    const requestUrl = new URL(req.url || "/", `https://${req.headers?.host || "localhost"}`);
    requestUrl.searchParams.delete("__originalPath");
    const query = requestUrl.searchParams.toString();
    req.url = originalPath + (query ? `?${query}` : "");

    const { app, initializeDatabase } = await import("../server/index.ts");
    databaseInitialization ??= initializeDatabase();
    await databaseInitialization;
    return app(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error("KOPLI AI backend initialization failed:", name, message);
    return res.status(500).json({
      error: "Backend initialization failed.",
      code: "BACKEND_INIT_FAILED",
      ...(process.env.VERCEL_ENV === "preview" ? { diagnostic: { name, message: message.slice(0, 300) } } : {})
    });
  }
}
