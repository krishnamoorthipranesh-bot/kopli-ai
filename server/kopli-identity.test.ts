import { describe, expect, it } from "vitest";
import { answerKopliFounderQuestion, KOPLI_FOUNDER_ANSWER } from "./kopli-identity.js";

describe("FRIDAY AI permanent founder identity", () => {
  it("answers direct English owner and creator questions", () => {
    expect(answerKopliFounderQuestion("Who is the owner of FRIDAY AI?")).toBe(KOPLI_FOUNDER_ANSWER);
    expect(answerKopliFounderQuestion("Who created FRIDAY AI?")).toBe(KOPLI_FOUNDER_ANSWER);
    expect(answerKopliFounderQuestion("Who owns FRIDAY AI?")).toBe(KOPLI_FOUNDER_ANSWER);
    expect(answerKopliFounderQuestion("Who founded FRIDAY AI?")).toBe(KOPLI_FOUNDER_ANSWER);
    expect(answerKopliFounderQuestion("Who developed FRIDAY AI?")).toBe(KOPLI_FOUNDER_ANSWER);
    expect(answerKopliFounderQuestion("Who built FRIDAY AI?")).toBe(KOPLI_FOUNDER_ANSWER);
    expect(answerKopliFounderQuestion("Who is the founder?")).toBe(KOPLI_FOUNDER_ANSWER);
  });
  it("answers Tanglish identity questions naturally", () => {
    expect(answerKopliFounderQuestion("Friday AI yaaru create pannathu?")).toContain("Pranesh KK");
    expect(answerKopliFounderQuestion("FRIDAY AI owner yaar?")).toContain("dhaan create pannirukkar");
  });
  it("answers Tamil-script identity questions in Tamil", () => {
    expect(answerKopliFounderQuestion("யார் FRIDAY AI உருவாக்கியது?")).toContain("Pranesh KK");
    expect(answerKopliFounderQuestion("யார் நிறுவனர்?")).toContain("Pranesh KK");
  });
  it("retains recognition of the former product name for historical context", () => {
    expect(answerKopliFounderQuestion("Who created KOPLI AI?")).toBe(KOPLI_FOUNDER_ANSWER);
  });
  it("understands a short follow-up when recent chat context is about FRIDAY AI", () => {
    expect(answerKopliFounderQuestion("Who is the founder?", [{ role: "user", content: "Tell me about FRIDAY AI" }])).toBe(KOPLI_FOUNDER_ANSWER);
  });
  it("does not misattribute another organization's founder", () => {
    expect(answerKopliFounderQuestion("Who is the founder of OpenAI?")).toBeNull();
  });
  it("does not answer unrelated messages", () => {
    expect(answerKopliFounderQuestion("How does FRIDAY AI work?")).toBeNull();
  });
});
