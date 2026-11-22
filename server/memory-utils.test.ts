import { describe, expect, it } from "vitest";
import { containsSensitiveSecret, isPastContextQuery, memoryKeywords } from "./memory-utils.js";

describe("memory query helpers", () => {
  it("recognizes generic recall prompts and falls back to recent conversations", () => {
    const query = "What did we discuss last time?";
    expect(isPastContextQuery(query)).toBe(true);
    expect(memoryKeywords(query)).toEqual([]);
  });

  it("keeps project terms while dropping conversational filler", () => {
    expect(memoryKeywords("Continue my KOPLI website project")).toEqual(["kopli", "website", "project"]);
  });

  it("detects credential values without rejecting ordinary mentions", () => {
    expect(containsSensitiveSecret("GROQ_API_KEY=sample-secret-value")).toBe(true);
    expect(containsSensitiveSecret("DATABASE_URL=postgresql://user:pass@localhost/app")).toBe(true);
    expect(containsSensitiveSecret("I prefer not to discuss my password in chat.")).toBe(false);
  });
});
