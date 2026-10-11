export {
  runDelegatorIris,
  runOperatorIris,
  streamDelegatorIris,
  streamOperatorIris,
} from "./agent";
export type { IrisMessage, IrisResponse, StreamDelegatorMeta, StreamOperatorMeta } from "./agent";
export { checkCitations, ensureReportLink } from "./guard";
export type { GuardResult } from "./guard";
export {
  getDelegatorToolDefinitions,
  getOperatorToolDefinitions,
  executeTool,
} from "./tools/index";
export { DELEGATOR_SYSTEM_PROMPT } from "./prompts/delegator";
export {
  OPERATOR_BASE_PROMPT,
  OPERATOR_PLAYBOOK,
  getOperatorSystemPrompt,
} from "./prompts/operator";
export * from "./public-api/index";
export { INDEX_BACKED_TOOLS, toToolFreshness } from "./tools/index";
export type { ToolFreshness, ToolResult } from "./tools/types";
