import { describe, it, expect } from 'vitest';
import {
  buildChatRequest,
  parseNonStream,
  parseStreamLine,
  BASE_USER_INSTRUCTION,
  type ContentPart,
} from '../lib/llm-client';
import type { LlmConfig } from '../lib/types';

const BASE_CONFIG: LlmConfig = {
  baseUrl: 'http://localhost:11434/v1',
  apiKey: '',
  model: 'qwen2.5-vl',
  systemPrompt: 'system prompt',
};
const IMAGE_DATA_URL = 'data:image/png;base64,iVBORw0KGgo';

function userImagePart(config: LlmConfig) {
  const request = buildChatRequest({ config, imageDataUrl: IMAGE_DATA_URL });
  const userMessage = request.body.messages.find((message) => message.role === 'user')!;
  const parts = userMessage.content as ContentPart[];
  return parts.find((part) => part.type === 'image_url');
}

function userPromptText(userText?: string): string {
  const request = buildChatRequest({ config: BASE_CONFIG, imageDataUrl: IMAGE_DATA_URL, userText });
  const userMessage = request.body.messages.find((message) => message.role === 'user')!;
  const part = (userMessage.content as ContentPart[]).find((part) => part.type === 'text');
  return part && part.type === 'text' ? part.text : '';
}

describe('buildChatRequest', () => {
  it('sends the image as an OpenAI image_url content part', () => {
    const part = userImagePart(BASE_CONFIG);
    expect(part).toEqual({ type: 'image_url', image_url: { url: IMAGE_DATA_URL } });
  });

  it('targets the chat/completions endpoint and the configured model', () => {
    const request = buildChatRequest({ config: BASE_CONFIG, imageDataUrl: IMAGE_DATA_URL });
    expect(request.url).toBe(`${BASE_CONFIG.baseUrl}/chat/completions`);
    expect(request.body.model).toBe(BASE_CONFIG.model);
  });

  it('omits the Authorization header when no API key is set', () => {
    const request = buildChatRequest({ config: BASE_CONFIG, imageDataUrl: IMAGE_DATA_URL });
    expect(request.headers.Authorization).toBeUndefined();
  });

  it('sends a Bearer token when an API key is set', () => {
    const apiKey = 'sk-test-key';
    const request = buildChatRequest({
      config: { ...BASE_CONFIG, apiKey },
      imageDataUrl: IMAGE_DATA_URL,
    });
    expect(request.headers.Authorization).toBe(`Bearer ${apiKey}`);
  });

  it('does not double the slash when the base URL ends with one', () => {
    const request = buildChatRequest({
      config: { ...BASE_CONFIG, baseUrl: 'http://localhost:11434/v1/' },
      imageDataUrl: IMAGE_DATA_URL,
    });
    expect(request.url).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('uses the base instruction when no direction is given', () => {
    expect(userPromptText()).toContain(BASE_USER_INSTRUCTION);
  });

  it("keeps the base instruction and appends the user's direction", () => {
    const direction = 'Reply sarcastically, in under 10 words.';
    const prompt = userPromptText(direction);
    expect(prompt).toContain(BASE_USER_INSTRUCTION);
    expect(prompt).toContain(direction);
  });
});

describe('parseNonStream', () => {
  it('returns the assistant message content', () => {
    const content = 'analysis and reply';
    expect(parseNonStream({ choices: [{ message: { content } }] })).toBe(content);
  });
});

describe('parseStreamLine', () => {
  it('extracts the delta text from a data line', () => {
    const delta = 'wor';
    const line = `data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}`;
    expect(parseStreamLine(line)).toBe(delta);
  });

  it('returns null for the [DONE] sentinel and non-data lines', () => {
    expect(parseStreamLine('data: [DONE]')).toBeNull();
    expect(parseStreamLine('')).toBeNull();
    expect(parseStreamLine(': keep-alive comment')).toBeNull();
  });

  it('tolerates a malformed JSON payload without throwing', () => {
    expect(() => parseStreamLine('data: {not json')).not.toThrow();
    expect(parseStreamLine('data: {not json')).toBeNull();
  });

  it('accumulates streamed deltas into the full message', () => {
    const parts = ['He', 'llo', ' world'];
    const text = parts
      .map((part) => parseStreamLine(`data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}`))
      .join('');
    expect(text).toBe(parts.join(''));
  });
});
