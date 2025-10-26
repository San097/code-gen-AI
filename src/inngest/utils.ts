import { Sandbox } from '@e2b/code-interpreter';
import { AgentResult, TextMessage, type Message } from '@inngest/agent-kit';
import { SANDBOX_TIMEOUT } from './types';

export async function getSandbox(sandboxId: string) {
  const sandbox = await Sandbox.connect(sandboxId);
  await sandbox.setTimeout(SANDBOX_TIMEOUT);
  return sandbox;
}

export function lastAssistantTextMessageContent(result: AgentResult) {
  const lastAssistantTextMessageIndex = result.output.findLastIndex(
    (message) => message.role === 'assistant'
  );
  const message = result.output[lastAssistantTextMessageIndex] as TextMessage | undefined;

  return message?.content
    ? typeof message.content === 'string'
      ? message.content
      : message.content.map((c) => c.text).join('')
    : undefined;
}

/**
 * Safely parses the agent output array into a readable string.
 * Supports both text and tool messages.
 */
export const parseAgentOutput = (value: Message[]) => {
  const output = value[0];
  if (!output) return '';

  // Text message type
  if (output.type === 'text') {
    const textMsg = output as TextMessage;
    if (typeof textMsg.content === 'string') {
      return textMsg.content;
    }
    if (Array.isArray(textMsg.content)) {
      return textMsg.content.map((c) => (typeof c === 'string' ? c : c.text)).join(' ');
    }
    return '';
  }

  // Tool result messages (no content field)
  if ('result' in output) {
    return JSON.stringify(output.result);
  }

  // Tool call messages or others
  if ('tool' in output) {
    return `Tool call: ${output.tool}`;
  }

  // fallback
  return '';
};
