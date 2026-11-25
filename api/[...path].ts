let databaseInitialization: Promise<void> | undefined;

export default async function handler(req: any, res: any) {
  try {
    const { app, initializeDatabase } = await import("../server/index.ts");
    databaseInitialization ??= initializeDatabase();
    await databaseInitialization;
    return app(req, res);
  } catch (error) {
    console.error("KOPLI AI backend initialization failed:", error);
    return res.status(500).json({
      error: "Backend initialization failed.",
      code: "BACKEND_INIT_FAILED"
    });
  }
}
