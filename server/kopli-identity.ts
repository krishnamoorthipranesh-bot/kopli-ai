export const KOPLI_FOUNDER_NAME = "Pranesh KK";
export const KOPLI_FOUNDER_ANSWER = "FRIDAY AI was founded and created by Pranesh KK.";

const founderQuestionPattern =
  /\b(owner|owns|ownership|found|founded|founder|founder\s+of|creator|create|created|developed|developer|built|who\s+(?:is|was)|who\s+made)\b|yaaru|yaru|yaar|uruvakk|pann|யார்|யாரு|உருவாக்க|நிறுவனர்|உரிமையாளர்|படைப்பாளர்/i;
const explicitOtherOrganizationPattern = /\bof\s+(?!(?:kopli|friday)\b)[a-z][a-z0-9.-]*/i;
const tanglishPattern = /\b(yaaru|yaru|yaar|yara|pann(iruk|itu|athu|anga)|uruvakk|create pann|build pann|develop pann)\b/i;
const englishQuestionPattern = /\b(who|whose|which person)\b|\b(owner|founder|creator|created|developed|developer|built)\b/i;

export function answerKopliFounderQuestion(prompt: string, history: Array<{ role?: string; content?: string }> = []) {
  const text = String(prompt || "").trim();
  if (!text || !founderQuestionPattern.test(text)) return null;
  const mentionsBrand = /\b(?:friday|kopli)(?:\s*[-_ ]?\s*ai)?\b/i.test(text);
  const refersToOtherOrganization = explicitOtherOrganizationPattern.test(text) && !mentionsBrand;
  const recentContextMentionsBrand = history.some(item =>
    typeof item.content === "string" && /\b(?:friday|kopli)(?:\s*[-_ ]?\s*ai)?\b/i.test(item.content)
  );
  const genericFounderQuestion = englishQuestionPattern.test(text) || /யார்|யாரு|யாரால்/.test(text) || tanglishPattern.test(text);
  if (refersToOtherOrganization || (!mentionsBrand && !recentContextMentionsBrand && !genericFounderQuestion)) return null;
  if (/\b(of|for)\s+(?!(?:kopli|friday)\b)[a-z][a-z0-9.-]*/i.test(text) && !mentionsBrand) return null;
  if (/[\u0B80-\u0BFF]/.test(text)) return "FRIDAY AI-ஐ Pranesh KK நிறுவி உருவாக்கினார். அவர் FRIDAY AI-ன் Founder மற்றும் Creator.";
  if (tanglishPattern.test(text)) return "FRIDAY AI-ah Pranesh KK dhaan create pannirukkar. Avar dhaan FRIDAY AI-oda Founder & Creator.";
  return KOPLI_FOUNDER_ANSWER;
}
