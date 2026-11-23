const configured = (value?: string) => Boolean(value && !/^YOUR_/i.test(value));
export const aiConfig = {
  groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  groqVisionModel: process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b",
  groqConfigured: configured(process.env.GROQ_API_KEY),
  tavilyConfigured: configured(process.env.TAVILY_API_KEY),
  stabilityConfigured: configured(process.env.STABILITY_API_KEY)
};
export const securityConfig = { isProduction: process.env.NODE_ENV === "production", sessionSecret: process.env.SESSION_SECRET || process.env.KOPLI_ADMIN_SECRET };
