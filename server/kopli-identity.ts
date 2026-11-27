export const KOPLI_FOUNDER_NAME = "Pranesh KK";
export const KOPLI_FOUNDER_ANSWER = "KOPLI AI was founded and created by Pranesh KK.";

const founderQuestionPattern =
  /\b(owner|owns|ownership|found|founded|founder|founder\s+of|creator|create|created|developed|developer|built|who\s+(?:is|was)|who\s+made)\b|yaaru|yaru|yaar|uruvakk|pann|யார்|யாரு|உருவாக்க|நிறுவனர்|உரிமையாளர்|படைப்பாளர்/i;

const explicitOtherOrganizationPattern = /\bof\s+(?!kopli\b)[a-z][a-z0-9.-]*/i;
const tanglishPattern = /\b(yaaru|yaru|yaar|yara|pann(iruk|itu|athu|anga)|uruvakk|create pann|build pann|develop pann)\b/i;
const englishQuestionPattern = /\b(who|whose|which person)\b|\b(owner|founder|creator|created|developed|developer|built)\b/i;

export function answerKopliFounderQuestion(prompt: string, history: Array<{ role?: string; content?: string }> = []) {
  const text = String(prompt || "").trim();
  if (!text || !founderQuestionPattern.test(text)) return null;

  const mentionsKopli = /\bkopli(?:\s*[-_ ]?\s*ai)?\b/i.test(text);
  const refersToOtherOrganization = explicitOtherOrganizationPattern.test(text) && !mentionsKopli;
  const recentContextMentionsKopli = history.some(item =>
    typeof item.content === "string" && /\bkopli(?:\s*[-_ ]?\s*ai)?\b/i.test(item.content)
  );
  const genericFounderQuestion = englishQuestionPattern.test(text) || /யார்|யாரு|யாரால்/.test(text) || tanglishPattern.test(text);
  if (refersToOtherOrganization || (!mentionsKopli && !recentContextMentionsKopli && !genericFounderQuestion)) {
    return null;
  }

  if (/\b(of|for)\s+(?!kopli\b)[a-z][a-z0-9.-]*/i.test(text) && !mentionsKopli) return null;

  if (/[\u0B80-\u0BFF]/.test(text)) {
    return "KOPLI AI-ஐ Pranesh KK நிறுவி உருவாக்கினார். அவர் KOPLI AI-ன் Founder மற்றும் Creator.";
  }
  if (tanglishPattern.test(text)) {
    return "KOPLI AI-ah Pranesh KK dhaan create pannirukkar. Avar dhaan KOPLI AI-oda Founder & Creator.";
  }
  return KOPLI_FOUNDER_ANSWER;
}
