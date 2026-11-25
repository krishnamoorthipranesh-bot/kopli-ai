import type { Express } from "express";

export const app: Express;
export function initializeDatabase(): Promise<void>;
