import type { AgentMessage } from "@mariozechner/pi-agent-core";

type AssistantContentBlock = Extract<AgentMessage, { role: "assistant" }>["content"][number];
type AssistantMessage = Extract<AgentMessage, { role: "assistant" }>;

export function isAssistantMessageWithContent(message: AgentMessage): message is AssistantMessage {
  return (
    !!message &&
    typeof message === "object" &&
    message.role === "assistant" &&
    Array.isArray(message.content)
  );
}

function findLatestAssistantMessageIndex(messages: AgentMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (isAssistantMessageWithContent(messages[i])) {
      return i;
    }
  }
  return -1;
}

/**
 * Strip all `type: "thinking"` content blocks from assistant messages.
 *
 * If an assistant message becomes empty after stripping, it is replaced with
 * a synthetic `{ type: "text", text: "" }` block to preserve turn structure
 * (some providers require strict user/assistant alternation).
 *
 * When `preserveLatestAssistant` is enabled, the most recent assistant turn is
 * left untouched. Anthropic-backed endpoints require the latest assistant
 * message to preserve its original `thinking` blocks on replay.
 *
 * Returns the original array reference when nothing was changed (callers can
 * use reference equality to skip downstream work).
 */
export function dropThinkingBlocks(
  messages: AgentMessage[],
  opts?: { preserveLatestAssistant?: boolean },
): AgentMessage[] {
  let touched = false;
  const out: AgentMessage[] = [];
  const latestAssistantIndex = opts?.preserveLatestAssistant
    ? findLatestAssistantMessageIndex(messages)
    : -1;
  for (let index = 0; index < messages.length; index += 1) {
    const msg = messages[index];
    if (!isAssistantMessageWithContent(msg)) {
      out.push(msg);
      continue;
    }
    if (index === latestAssistantIndex) {
      out.push(msg);
      continue;
    }
    const nextContent: AssistantContentBlock[] = [];
    let changed = false;
    for (const block of msg.content) {
      if (block && typeof block === "object" && (block as { type?: unknown }).type === "thinking") {
        touched = true;
        changed = true;
        continue;
      }
      nextContent.push(block);
    }
    if (!changed) {
      out.push(msg);
      continue;
    }
    // Preserve the assistant turn even if all blocks were thinking-only.
    const content =
      nextContent.length > 0 ? nextContent : [{ type: "text", text: "" } as AssistantContentBlock];
    out.push({ ...msg, content });
  }
  return touched ? out : messages;
}
