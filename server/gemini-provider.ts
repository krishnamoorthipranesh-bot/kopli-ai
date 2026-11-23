export interface GeminiHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GeminiImageInput {
  mimeType: string;
  dataUrl: string;
}

export interface GeminiStreamOptions {
  apiKey: string;
  model?: string;
  systemInstruction: string;
  history: GeminiHistoryMessage[];
  prompt: string;
  images?: GeminiImageInput[];
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export class GeminiProviderError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "GeminiProviderError";
  }
}

const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export function isTransientProviderError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if (error instanceof TypeError) return true;
  const details = error as { status?: unknown; code?: unknown; name?: unknown };
  const status = Number(details.status);
  if (status === 408 || status === 429 || status >= 500) return true;
  if (details.name === "AbortError" || details.name === "TimeoutError") return true;
  return ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND"].includes(String(details.code || ""));
}

function providerError(status: number): GeminiProviderError {
  if (status === 401 || status === 403) {
    return new GeminiProviderError(status, "Gemini rejected its server credentials. Check GEMINI_API_KEY.");
  }
  if (status === 429) {
    return new GeminiProviderError(status, "Gemini rate limit or quota was reached. Please try again later.");
  }
  if (status >= 500 || status === 408) {
    return new GeminiProviderError(status, "Gemini is temporarily unavailable. Please try again.");
  }
  return new GeminiProviderError(status, `Gemini request failed (HTTP ${status}).`);
}

function eventText(event: string): string {
  const data = event
    .split(/\r?\n/)
    .filter(line => line.startsWith("data:"))
    .map(line => line.slice(5).trim())
    .join("\n");
  if (!data || data === "[DONE]") return "";
  let payload: any;
  try {
    payload = JSON.parse(data);
  } catch {
    throw new GeminiProviderError(502, "Gemini returned an invalid streaming response.");
  }
  const parts = payload?.candidates?.flatMap((candidate: any) => candidate?.content?.parts || []) || [];
  return parts.map((part: any) => typeof part?.text === "string" ? part.text : "").join("");
}

export async function* streamGeminiResponse(options: GeminiStreamOptions): AsyncGenerator<string> {
  const model = options.model?.trim() || DEFAULT_GEMINI_MODEL;
  const contents = [
    ...options.history.map(item => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }]
    })),
    {
      role: "user",
      parts: [
        { text: options.prompt },
        ...(options.images || []).map(image => ({
          inlineData: {
            mimeType: image.mimeType,
            data: image.dataUrl.replace(/^data:[^;,]+;base64,/, "")
          }
        }))
      ]
    }
  ];
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": options.apiKey
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: options.systemInstruction }] },
          contents,
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens ?? 2048
          }
        }),
        signal: options.signal
      }
    );
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new GeminiProviderError(503, "Gemini network request failed. Please try again.");
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw providerError(response.status);
  }
  if (!response.body) throw new GeminiProviderError(502, "Gemini returned an empty streaming response.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";
      for (const event of events) {
        const text = eventText(event);
        if (text) yield text;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const text = eventText(buffer);
      if (text) yield text;
    }
  } catch (error) {
    if (error instanceof GeminiProviderError) throw error;
    if (options.signal?.aborted) throw error;
    throw new GeminiProviderError(503, "Gemini streaming connection was interrupted.");
  } finally {
    reader.releaseLock();
  }
}
