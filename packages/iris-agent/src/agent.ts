import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages.js";
import { DELEGATOR_SYSTEM_PROMPT } from "./prompts/delegator";
import { getDelegatorToolDefinitions, executeTool } from "./tools/index";
import { checkCitations, ensureReportLink } from "./guard";

const MAX_TOOL_ROUNDS = 8;
const MAX_GUARD_RETRIES = 2;

export type IrisMessage = {
  role: "user" | "assistant";
  content: string;
};

export type IrisResponse = {
  text: string;
  tool_calls: { tool: string; input: unknown; output: unknown }[];
  guard_passed: boolean;
  guard_violations: string[];
};

function getClient(): Anthropic {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey: key });
}

export async function runDelegatorIris(messages: IrisMessage[]): Promise<IrisResponse> {
  const client = getClient();
  const tools = getDelegatorToolDefinitions();
  const toolCallLog: IrisResponse["tool_calls"] = [];

  // Build Anthropic message history
  let apiMessages: MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let finalText = "";
  let rounds = 0;

  // Agentic tool-use loop
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: DELEGATOR_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools,
      messages: apiMessages,
    });

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      finalText = textBlock?.type === "text" ? textBlock.text : "";
      break;
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
      if (toolUseBlocks.length === 0) break;

      // Execute all tool calls in this round
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          if (block.type !== "tool_use") throw new Error("unreachable");
          const output = await executeTool(block.name, block.input);
          toolCallLog.push({ tool: block.name, input: block.input, output: JSON.parse(output) });
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: output,
          };
        })
      );

      // Append assistant turn + tool results to message history
      apiMessages = [
        ...apiMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
      continue;
    }

    // max_tokens or other stop reason
    const textBlock = response.content.find((b) => b.type === "text");
    finalText = textBlock?.type === "text" ? textBlock.text : "";
    break;
  }

  // Guardrail loop — re-prompt up to MAX_GUARD_RETRIES times if citations are missing
  let guardPassed = false;
  let guardViolations: string[] = [];

  for (let attempt = 0; attempt < MAX_GUARD_RETRIES; attempt++) {
    const guardResult = await checkCitations(finalText, client);
    guardPassed = guardResult.passed;
    guardViolations = guardResult.violations;

    if (guardPassed) break;

    // Re-prompt Iris to add missing citations
    const rePromptMessages: MessageParam[] = [
      ...apiMessages,
      { role: "assistant", content: finalText },
      {
        role: "user",
        content: `Your response contained factual claims without data-class citations. Please revise, ensuring every number is accompanied by its source and class label (Class 1, 2, or 3). Missing citations were found in:\n\n${guardViolations.map((v) => `- ${v}`).join("\n")}`,
      },
    ];

    const retryResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [
        { type: "text", text: DELEGATOR_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools,
      messages: rePromptMessages,
    });

    const textBlock = retryResponse.content.find((b) => b.type === "text");
    finalText = textBlock?.type === "text" ? textBlock.text : finalText;
  }

  // Ensure the ⚠ Report issue link is always present
  finalText = ensureReportLink(finalText);

  return {
    text: finalText,
    tool_calls: toolCallLog,
    guard_passed: guardPassed,
    guard_violations: guardViolations,
  };
}
