import { describe, expect, it } from "vitest";
import { answerKopliFounderQuestion, KOPLI_FOUNDER_ANSWER } from "./kopli-identity.js";

describe("KOPLI AI permanent founder identity", () => {
  it("answers direct English owner and creator questions", () => {
    expect(answerKopliFounderQuestion("Who is the owner of KOPLI AI?")).toBe(KOPLI_FOUNDER_ANSWER);
    expect(answerKopliFounderQuestion("Who created KOPLI AI?")).toBe(KOPLI_FOUNDER_ANSWER);
    expect(answerKopliFounderQuestion("Who is the founder?")).toBe(KOPLI_FOUNDER_ANSWER);
  });

  it("answers Tanglish identity questions naturally", () => {
    expect(answerKopliFounderQuestion("Kopli AI yaaru create pannathu?")).toContain("Pranesh KK");
    expect(answerKopliFounderQuestion("KOPLI AI owner yaar?")).toContain("Pranesh KK");
  });

  it("answers Tamil-script identity questions in Tamil", () => {
    expect(answerKopliFounderQuestion("யார் KOPLI AI உருவாக்கியது?")).toContain("Pranesh KK");
  });

  it("understands a short follow-up when recent chat context is about KOPLI AI", () => {
    expect(answerKopliFounderQuestion("Who is the founder?", [{ role: "user", content: "Tell me about KOPLI AI" }])).toBe(KOPLI_FOUNDER_ANSWER);
  });

  it("does not misattribute another organization's founder", () => {
    expect(answerKopliFounderQuestion("Who is the founder of OpenAI?")).toBeNull();
  });

  it("does not answer unrelated messages", () => {
    expect(answerKopliFounderQuestion("How does KOPLI AI work?")).toBeNull();
  });
});
