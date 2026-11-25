import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { extractTextFromZipArchive, isAllowedOrigin, shouldRejectEphemeralFileStorage } from "./index.js";
import { containsSensitiveSecret, isPastContextQuery, memoryKeywords } from "./memory-utils.js";

describe("Vercel file persistence safety", () => {
  it("rejects permanent file writes on Vercel when Supabase Storage is unavailable", () => {
    expect(shouldRejectEphemeralFileStorage(true, false)).toBe(true);
  });

  it("allows Vercel file writes only when persistent storage is configured", () => {
    expect(shouldRejectEphemeralFileStorage(true, true)).toBe(false);
  });

  it("keeps local development file storage available", () => {
    expect(shouldRejectEphemeralFileStorage(false, false)).toBe(false);
  });
});

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

  it("blocks unconfigured onrender.com subdomains", () => {
    expect(isAllowedOrigin("https://my-kopli-service.onrender.com")).toBe(false);
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

function makeZipFile(fileName: string, text: string) {
  const name = Buffer.from(fileName);
  const data = deflateRawSync(Buffer.from(text));
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(Buffer.byteLength(text), 22);
  local.writeUInt16LE(name.length, 26);
  const localRecord = Buffer.concat([local, name, data]);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(Buffer.byteLength(text), 24);
  central.writeUInt16LE(name.length, 28);
  const centralRecord = Buffer.concat([central, name]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralRecord.length, 12);
  end.writeUInt32LE(localRecord.length, 16);
  return Buffer.concat([localRecord, centralRecord, end]);
}

describe("ZIP attachment text extraction", () => {
  it("reads supported text files from an archive without extracting paths to disk", () => {
    const result = extractTextFromZipArchive(makeZipFile("folder/readme.txt", "KOPLI upload instructions"));
    expect(result).toContain("readme.txt");
    expect(result).toContain("KOPLI upload instructions");
  });

  it("rejects invalid archives and archives without readable text", () => {
    expect(() => extractTextFromZipArchive(Buffer.from("not a zip archive"))).toThrow("invalid");
    expect(() => extractTextFromZipArchive(makeZipFile("image.bin", "binary"))).toThrow("No supported readable text");
  });
});
