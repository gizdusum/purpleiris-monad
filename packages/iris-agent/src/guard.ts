import type Anthropic from "@anthropic-ai/sdk";

const CITATION_PATTERN =
  /\(Class [123]|Source:\s+\w|Class [123] on-chain|Class [123] derived|Class [123] estimate|·\s*Class [123]/i;

// Sentences that contain numbers but are clearly non-factual (meta-commentary, questions, etc.)
const NON_FACTUAL_PATTERNS = [
  /^\s*\[⚠ Report issue\]/,
  /^>/, // blockquotes
  /formula\s+v\d/i, // formula version refs
  /\d{4}-\d{2}-\d{2}/, // ISO dates alone are not data claims
];

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isDataClaim(sentence: string): boolean {
  if (NON_FACTUAL_PATTERNS.some((p) => p.test(sentence))) return false;
  // Sentence contains a number in a factual context
  return /\b\d+(?:\.\d+)?%|\b\d[\d,]*\s*MON|\b\d+\s+validator|\b\d+\s+block|\b\d+\s+epoch|\bAPY|\bsuccess rate|\bcommission|\bstake|\buptime/i.test(
    sentence
  );
}

export type GuardResult = {
  passed: boolean;
  violations: string[];
};

export async function checkCitations(responseText: string, haiku: Anthropic): Promise<GuardResult> {
  // Fast regex pre-check first
  const sentences = splitSentences(responseText);
  const potentialViolations = sentences.filter((s) => isDataClaim(s) && !CITATION_PATTERN.test(s));

  if (potentialViolations.length === 0) {
    return { passed: true, violations: [] };
  }

  // Use haiku to judge ambiguous cases
  const prompt = `You are a strict citation auditor for a validator intelligence platform.

A response contains these sentences that may have data claims without class citations.
A class citation looks like: (Class 1, on-chain), (Class 2, derived), (Class 3, estimate), or "Source: tool_name".

For each sentence, determine if it IS a factual data claim that's missing a citation.
Return JSON: { "violations": ["sentence if missing citation", ...] }
Return an empty array if all sentences either have citations or are not data claims.

Sentences to check:
${potentialViolations.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;

  try {
    const result = await haiku.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = result.content[0]?.type === "text" ? result.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { passed: true, violations: [] };

    const parsed = JSON.parse(match[0]) as { violations?: string[] };
    const violations = parsed.violations ?? [];
    return { passed: violations.length === 0, violations };
  } catch {
    // Fail open — if guardrail itself errors, don't block the response
    return { passed: true, violations: [] };
  }
}

export function ensureReportLink(text: string): string {
  if (text.includes("[⚠ Report issue]")) return text;
  return `${text.trimEnd()}\n\n[⚠ Report issue](/transparency/new)`;
}
