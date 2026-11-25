import { app, initializeDatabase } from "../server/index.ts";

let databaseInitialization: Promise<void> | undefined;

export default async function handler(req: any, res: any) {
  databaseInitialization ??= initializeDatabase();
  await databaseInitialization;
  return app(req, res);
}
