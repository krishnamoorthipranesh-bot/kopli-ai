const memoryStopWords = new Set([
  "about", "after", "again", "been", "before", "continue", "conversation",
  "could", "did", "discuss", "discussed", "from", "have", "help", "last", "later",
  "me", "more", "most", "my", "our", "please", "previous", "remember",
  "same", "tell", "that", "them", "then", "there", "they", "this", "time",
  "told", "what", "when", "where", "which", "with", "were", "would",
  "yesterday", "your"
]);

export function isPastContextQuery(text: string) {
  return /\b(remember|previous|last time|discussed|yesterday|where we stopped|continue|past chat|earlier|my project|what did i|what was|where did we stop|what did we|last chat|previous conversation|resume)\b/i.test(text);
}

export function memoryKeywords(text: string) {
  return text.toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(word => word.length >= 3 && !memoryStopWords.has(word))
    .slice(0, 8);
}

export function containsSensitiveSecret(text: string) {
  return [
    /\b(?:[a-z0-9]+[_ -])*(?:api[_ -]?key|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|password|database[_ -]?url)\s*(?::|=|\bis\b)\s*["']?[^\s"',;]+/i,
    /\bbearer\s+[a-z0-9._~+/-]{16,}/i,
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/i,
    /\b(?:gsk_[a-z0-9_-]{20,}|sk-[a-z0-9_-]{20,})\b/i,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i
  ].some(pattern => pattern.test(text));
}
