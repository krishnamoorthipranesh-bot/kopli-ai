import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./index.js";
import { containsSensitiveSecret, isPastContextQuery, memoryKeywords } from "./memory-utils.js";

describe("origin and CORS security", () => {
  it("allows requests with no origin header (same-origin / curl / server)", () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
    expect(isAllowedOrigin("")).toBe(true);
  });

  it("allows localhost and 127.0.0.1 development origins on any port", () => {
    expect(isAllowedOrigin("http://localhost:5173")).toBe(true);
    expect(isAllowedOrigin("http://localhost:8787")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:3000")).toBe(true);
    expect(isAllowedOrigin("https://localhost:5173")).toBe(true);
  });

  it("allows onrender.com subdomains for production deployment", () => {
    expect(isAllowedOrigin("https://kopli-ai.onrender.com")).toBe(true);
    expect(isAllowedOrigin("https://my-kopli-service.onrender.com")).toBe(true);
  });

  it("allows same-host origin based on host header", () => {
    expect(isAllowedOrigin("https://custom-kopli.example.com", "custom-kopli.example.com")).toBe(true);
    expect(isAllowedOrigin("http://internal-host:8080", "internal-host:8080")).toBe(true);
  });

  it("blocks unauthorized cross-origin domains", () => {
    expect(isAllowedOrigin("https://malicious-site.com")).toBe(false);
    expect(isAllowedOrigin("https://evil-phishing.org", "kopli-ai.onrender.com")).toBe(false);
  });
});

describe("security sensitive secret detection", () => {
  it("detects database connection strings with credentials", () => {
    expect(containsSensitiveSecret("DATABASE_URL=postgresql://admin:secret123@db.render.com:5432/kopli")).toBe(true);
  });

  it("detects Groq API keys", () => {
    expect(containsSensitiveSecret("GROQ_API_KEY=gsk_1234567890abcdef1234567890abcdef")).toBe(true);
  });

  it("detects OpenAI / Tavily / Stability format keys", () => {
    expect(containsSensitiveSecret("sk-1234567890abcdef1234567890abcdef")).toBe(true);
  });

  it("allows harmless conversational text containing the word password", () => {
    expect(containsSensitiveSecret("How do I choose a strong password for my account?")).toBe(false);
  });
});

describe("past context and memory query parsing", () => {
  it("identifies past context prompts", () => {
    expect(isPastContextQuery("what did we talk about yesterday?")).toBe(true);
    expect(isPastContextQuery("remember where we stopped")).toBe(true);
    expect(isPastContextQuery("continue our previous chat")).toBe(true);
  });

  it("extracts meaningful keywords while filtering stopwords", () => {
    const keywords = memoryKeywords("Can you remember the python script for data processing?");
    expect(keywords).toContain("python");
    expect(keywords).toContain("script");
    expect(keywords).toContain("data");
    expect(keywords).toContain("processing");
    expect(keywords).not.toContain("you");
    expect(keywords).not.toContain("the");
    expect(keywords).not.toContain("for");
  });
});
