import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiProviderError, isTransientProviderError, streamGeminiResponse } from "./gemini-provider.js";

afterEach(() => vi.unstubAllGlobals());

async function collect(stream: AsyncGenerator<string>) {
  const chunks: string[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

describe("Gemini streaming provider", () => {
  it("streams text and sends conversation, image, and API key through the backend request", async () => {
    const encoder = new TextEncoder();
    const responseText = [
      `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "A clear " }] } }] })}`,
      `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "answer." }] } }] })}`
    ].join("\n\n") + "\n\n";
    const fetchMock = vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(responseText.slice(0, 43)));
        controller.enqueue(encoder.encode(responseText.slice(43)));
        controller.close();
      }
    }), { status: 200, headers: { "content-type": "text/event-stream" } }));
    vi.stubGlobal("fetch", fetchMock);

    const chunks = await collect(streamGeminiResponse({
      apiKey: "server-only-test-key",
      systemInstruction: "You are KOPLI AI.",
      history: [
        { role: "user", content: "Earlier question" },
        { role: "assistant", content: "Earlier answer" }
      ],
      prompt: "What is in this picture?",
      images: [{ mimeType: "image/png", dataUrl: "data:image/png;base64,aW1hZ2U=" }]
    }));

    expect(chunks).toEqual(["A clear ", "answer."]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/models/gemini-3.8-flash:streamGenerateContent?alt=sse");
    expect(new Headers(init.headers).get("x-goog-api-key")).toBe("server-only-test-key");
    const body = JSON.parse(String(init.body));
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "Earlier question" }] },
      { role: "model", parts: [{ text: "Earlier answer" }] },
      {
        role: "user",
        parts: [
          { text: "What is in this picture?" },
          { inlineData: { mimeType: "image/png", data: "aW1hZ2U=" } }
        ]
      }
    ]);
  });

  it("maps Gemini quota failures to a safe message without exposing provider response details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: "private provider detail" } }),
      { status: 429, headers: { "content-type": "application/json" } }
    )));

    await expect(collect(streamGeminiResponse({
      apiKey: "server-only-test-key",
      systemInstruction: "You are KOPLI AI.",
      history: [],
      prompt: "Hello"
    }))).rejects.toMatchObject({
      name: "GeminiProviderError",
      status: 429,
      message: "Gemini rate limit or quota was reached. Please try again later."
    } satisfies Partial<GeminiProviderError>);
  });

  it("only treats temporary failures and rate limits as Groq fallback candidates", () => {
    expect(isTransientProviderError({ status: 429 })).toBe(true);
    expect(isTransientProviderError({ status: 503 })).toBe(true);
    expect(isTransientProviderError(new TypeError("fetch failed"))).toBe(true);
    expect(isTransientProviderError({ status: 401 })).toBe(false);
    expect(isTransientProviderError({ status: 400 })).toBe(false);
  });
});
