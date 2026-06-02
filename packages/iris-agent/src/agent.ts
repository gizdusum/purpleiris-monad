import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages.js";
import { DELEGATOR_SYSTEM_PROMPT } from "./prompts/delegator";
import { getOperatorSystemPrompt } from "./prompts/operator";
import {
  getDelegatorToolDefinitions,
  getOperatorToolDefinitions,
  executeTool,
} from "./tools/index";
import { checkCitations, ensureReportLink } from "./guard";

const MAX_TOOL_ROUNDS = 8;
const MAX_GUARD_RETRIES = 2;
const MODEL_STRONG = "claude-sonnet-4-6";
const MODEL_FAST = "claude-haiku-4-5-20251001";

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

const COMPLEX_SIGNALS = [
  "compare",
  "vs",
  "versus",
  "against",
  "diversif",
  "underdog",
  "recent",
  "assignment",
  "epoch",
  "history",
  "simulate",
  "why",
  "neden",
  "analiz",
  "deep",
  "derin",
  "karşılaştır",
];

const SIMPLE_WHITELIST = [
  "network",
  "overview",
  "health",
  "list",
  "find validator",
  "find me",
  "estimate",
  "how much would i earn",
  "ne kadar kazanır",
  "release",
  "version",
  "update",
  "latest monad",
];

function getDelegatorModel(messages: IrisMessage[]): typeof MODEL_FAST | typeof MODEL_STRONG {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return MODEL_STRONG;
  const text = last.content.toLowerCase();
  if (COMPLEX_SIGNALS.some((s) => text.includes(s))) return MODEL_STRONG;
  if (SIMPLE_WHITELIST.some((s) => text.includes(s))) return MODEL_FAST;
  return MODEL_STRONG;
}

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
  const firstTurnModel = getDelegatorModel(messages);

  // Agentic tool-use loop
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const response = await client.messages.create({
      model: rounds === 1 ? firstTurnModel : MODEL_STRONG,
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
      model: MODEL_STRONG,
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

export async function runOperatorIris(messages: IrisMessage[]): Promise<IrisResponse> {
  const client = getClient();
  const tools = getOperatorToolDefinitions();
  const toolCallLog: IrisResponse["tool_calls"] = [];
  const { base, playbook } = getOperatorSystemPrompt(messages);
  const baseBlock = {
    type: "text" as const,
    text: base,
    cache_control: { type: "ephemeral" as const },
  };
  const operatorSystem = playbook
    ? [
        baseBlock,
        { type: "text" as const, text: playbook, cache_control: { type: "ephemeral" as const } },
      ]
    : [baseBlock];

  let apiMessages: MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let finalText = "";
  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const response = await client.messages.create({
      model: MODEL_STRONG,
      max_tokens: 4096,
      system: operatorSystem,
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

      apiMessages = [
        ...apiMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
      continue;
    }

    const textBlock = response.content.find((b) => b.type === "text");
    finalText = textBlock?.type === "text" ? textBlock.text : "";
    break;
  }

  finalText = ensureReportLink(finalText);

  return {
    text: finalText,
    tool_calls: toolCallLog,
    guard_passed: true,
    guard_violations: [],
  };
}

export type StreamOperatorMeta = {
  tool_calls: IrisResponse["tool_calls"];
};

export async function streamOperatorIris(
  messages: IrisMessage[],
  onDelta: (chunk: string) => void
): Promise<StreamOperatorMeta> {
  const client = getClient();
  const tools = getOperatorToolDefinitions();
  const toolCallLog: IrisResponse["tool_calls"] = [];
  const { base, playbook } = getOperatorSystemPrompt(messages);
  const baseBlock = {
    type: "text" as const,
    text: base,
    cache_control: { type: "ephemeral" as const },
  };
  const operatorSystem = playbook
    ? [
        baseBlock,
        { type: "text" as const, text: playbook, cache_control: { type: "ephemeral" as const } },
      ]
    : [baseBlock];

  let apiMessages: MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let finalText = "";
  let rounds = 0;
  let madeToolCalls = false;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    if (madeToolCalls) {
      const s = client.messages.stream({
        model: MODEL_STRONG,
        max_tokens: 4096,
        system: operatorSystem,
        tools,
        messages: apiMessages,
      });

      for await (const event of s) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          onDelta(event.delta.text);
          finalText += event.delta.text;
        }
      }

      const fm = await s.finalMessage();

      if (fm.stop_reason === "tool_use") {
        const toolUseBlocks = fm.content.filter((b) => b.type === "tool_use");
        const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
          toolUseBlocks.map(async (block) => {
            if (block.type !== "tool_use") throw new Error("unreachable");
            const output = await executeTool(block.name, block.input);
            toolCallLog.push({ tool: block.name, input: block.input, output: JSON.parse(output) });
            return { type: "tool_result" as const, tool_use_id: block.id, content: output };
          })
        );
        apiMessages = [
          ...apiMessages,
          { role: "assistant", content: fm.content },
          { role: "user", content: toolResults },
        ];
        finalText = "";
        continue;
      }

      break;
    }

    const response = await client.messages.create({
      model: MODEL_STRONG,
      max_tokens: 4096,
      system: operatorSystem,
      tools,
      messages: apiMessages,
    });

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      finalText = textBlock?.type === "text" ? textBlock.text : "";
      onDelta(finalText);
      break;
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
      if (toolUseBlocks.length === 0) break;

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          if (block.type !== "tool_use") throw new Error("unreachable");
          const output = await executeTool(block.name, block.input);
          toolCallLog.push({ tool: block.name, input: block.input, output: JSON.parse(output) });
          return { type: "tool_result" as const, tool_use_id: block.id, content: output };
        })
      );

      apiMessages = [
        ...apiMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
      madeToolCalls = true;
      continue;
    }

    const textBlock = response.content.find((b) => b.type === "text");
    finalText = textBlock?.type === "text" ? textBlock.text : "";
    onDelta(finalText);
    break;
  }

  finalText = ensureReportLink(finalText);

  return { tool_calls: toolCallLog };
}

export type StreamDelegatorMeta = {
  tool_calls: IrisResponse["tool_calls"];
  guard_passed: boolean;
  guard_violations: string[];
};

export async function streamDelegatorIris(
  messages: IrisMessage[],
  onDelta: (chunk: string) => void
): Promise<StreamDelegatorMeta> {
  const client = getClient();
  const tools = getDelegatorToolDefinitions();
  const toolCallLog: IrisResponse["tool_calls"] = [];

  let apiMessages: MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let finalText = "";
  let rounds = 0;
  let madeToolCalls = false;
  const firstTurnModel = getDelegatorModel(messages);

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    if (madeToolCalls) {
      // Final answer turn — stream it
      const s = client.messages.stream({
        model: MODEL_STRONG,
        max_tokens: 4096,
        system: [
          { type: "text", text: DELEGATOR_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        tools,
        messages: apiMessages,
      });

      for await (const event of s) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          onDelta(event.delta.text);
          finalText += event.delta.text;
        }
      }

      const fm = await s.finalMessage();

      if (fm.stop_reason === "tool_use") {
        // Unexpected extra tool call — execute and loop again
        const toolUseBlocks = fm.content.filter((b) => b.type === "tool_use");
        const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
          toolUseBlocks.map(async (block) => {
            if (block.type !== "tool_use") throw new Error("unreachable");
            const output = await executeTool(block.name, block.input);
            toolCallLog.push({ tool: block.name, input: block.input, output: JSON.parse(output) });
            return { type: "tool_result" as const, tool_use_id: block.id, content: output };
          })
        );
        apiMessages = [
          ...apiMessages,
          { role: "assistant", content: fm.content },
          { role: "user", content: toolResults },
        ];
        finalText = "";
        continue;
      }

      break;
    }

    // Non-streaming tool rounds
    const response = await client.messages.create({
      model: rounds === 1 ? firstTurnModel : MODEL_STRONG,
      max_tokens: 4096,
      system: [
        { type: "text", text: DELEGATOR_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools,
      messages: apiMessages,
    });

    if (response.stop_reason === "end_turn") {
      // No tool calls — emit text as single chunk
      const textBlock = response.content.find((b) => b.type === "text");
      finalText = textBlock?.type === "text" ? textBlock.text : "";
      onDelta(finalText);
      break;
    }

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
      if (toolUseBlocks.length === 0) break;

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          if (block.type !== "tool_use") throw new Error("unreachable");
          const output = await executeTool(block.name, block.input);
          toolCallLog.push({ tool: block.name, input: block.input, output: JSON.parse(output) });
          return { type: "tool_result" as const, tool_use_id: block.id, content: output };
        })
      );

      apiMessages = [
        ...apiMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
      madeToolCalls = true;
      continue;
    }

    const textBlock = response.content.find((b) => b.type === "text");
    finalText = textBlock?.type === "text" ? textBlock.text : "";
    onDelta(finalText);
    break;
  }

  // Guardrail check
  let guardPassed = false;
  let guardViolations: string[] = [];

  for (let attempt = 0; attempt < MAX_GUARD_RETRIES; attempt++) {
    const guardResult = await checkCitations(finalText, client);
    guardPassed = guardResult.passed;
    guardViolations = guardResult.violations;
    if (guardPassed) break;

    const rePromptMessages: MessageParam[] = [
      ...apiMessages,
      { role: "assistant", content: finalText },
      {
        role: "user",
        content: `Your response contained factual claims without data-class citations. Please revise, ensuring every number is accompanied by its source and class label (Class 1, 2, or 3). Missing citations were found in:\n\n${guardViolations.map((v) => `- ${v}`).join("\n")}`,
      },
    ];

    const retryResponse = await client.messages.create({
      model: MODEL_STRONG,
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

  finalText = ensureReportLink(finalText);

  return { tool_calls: toolCallLog, guard_passed: guardPassed, guard_violations: guardViolations };
}
