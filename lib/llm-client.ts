import type { LlmConfig } from './types';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface ChatBody {
  model: string;
  stream: boolean;
  messages: ChatMessage[];
}

export interface ChatRequest {
  url: string;
  headers: Record<string, string>;
  body: ChatBody;
}

const trimTrailingSlash = (url: string) => url.replace(/\/+$/, '');

/** The always-present ask. An optional user direction is appended to it. */
export const BASE_USER_INSTRUCTION = 'Analyse this tweet and suggest a reply.';

export function buildChatRequest(params: {
  config: LlmConfig;
  imageDataUrl: string;
  userText?: string;
  stream?: boolean;
}): ChatRequest {
  const { config, imageDataUrl, userText, stream = true } = params;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  const promptText = userText
    ? `${BASE_USER_INSTRUCTION}\n\nAdditional direction for the reply: ${userText}`
    : BASE_USER_INSTRUCTION;

  const userContent: ContentPart[] = [
    { type: 'text', text: promptText },
    { type: 'image_url', image_url: { url: imageDataUrl } },
  ];

  return {
    url: `${trimTrailingSlash(config.baseUrl)}/chat/completions`,
    headers,
    body: {
      model: config.model,
      stream,
      messages: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: userContent },
      ],
    },
  };
}

/** Extract the assistant content from a non-streamed chat/completions response. */
export function parseNonStream(response: unknown): string {
  const choice = (response as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0];
  return choice?.message?.content ?? '';
}

/**
 * Parse one SSE line from a streamed response into its delta text.
 * Returns null for the [DONE] sentinel, comments, blank lines, and malformed
 * payloads, so the caller can simply skip nulls.
 */
export function parseStreamLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;
  const payload = trimmed.slice('data:'.length).trim();
  if (payload === '' || payload === '[DONE]') return null;
  try {
    const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
    return parsed.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null;
  }
}

/**
 * POST the request and yield assistant text deltas as they stream in.
 * Not unit-tested (network + ReadableStream); exercised manually against Ollama.
 */
export async function* streamChat(
  request: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`LLM request failed (${response.status}): ${await response.text()}`);
  }
  if (!response.body) {
    yield parseNonStream(await response.json());
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const delta = parseStreamLine(line);
      if (delta) yield delta;
    }
  }
}
