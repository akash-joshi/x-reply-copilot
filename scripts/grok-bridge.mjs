// Local OpenAI-compatible bridge to the Grok CLI.
//
// Lets the extension use Grok (via your `grok login` session — no API key) for the
// vision call. The extension already speaks the OpenAI chat/completions shape, so point
// its base URL at this bridge (Settings → Base URL: http://localhost:11435/v1) and it
// "just works". The bridge decodes the tweet image, writes it to a temp file, runs
// `grok -p "<file> <prompt>" --output-format json`, and streams the answer back as SSE.
//
// Requires the Grok CLI installed and authenticated (`grok login`).
// Run: node scripts/grok-bridge.mjs   (or: npm run grok-bridge)

import http from 'node:http';
import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.GROK_BRIDGE_PORT ?? 11435);

/** Pull the system text, user text, and image data URL out of an OpenAI request body. */
export function extractPrompt(body) {
  const messages = body?.messages ?? [];
  const system = messages.find((message) => message.role === 'system');
  const user = messages.find((message) => message.role === 'user');
  const systemText = typeof system?.content === 'string' ? system.content : '';

  let userText = '';
  let imageDataUrl;
  const userContent = user?.content;
  if (typeof userContent === 'string') {
    userText = userContent;
  } else if (Array.isArray(userContent)) {
    for (const part of userContent) {
      if (part.type === 'text') userText += part.text;
      else if (part.type === 'image_url') imageDataUrl = part.image_url?.url;
    }
  }
  return { systemText, userText, imageDataUrl };
}

/** Decode a base64 data URL to bytes + a file extension. */
function decodeDataUrl(dataUrl) {
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/is.exec(dataUrl ?? '');
  if (!match) return undefined;
  const ext = match[1] === 'image/jpeg' ? 'jpg' : match[1].split('/')[1];
  return { buffer: Buffer.from(match[2], 'base64'), ext };
}

function runGrok(prompt, cwd) {
  return new Promise((resolve, reject) => {
    execFile(
      'grok',
      ['-p', prompt, '--output-format', 'json', '--cwd', cwd],
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => {
        // grok logs warnings to stderr (e.g. unreachable MCP servers); ignore those and
        // parse the JSON object from stdout.
        const text = stdout?.toString() ?? '';
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) {
          reject(error ?? new Error('Grok CLI returned no JSON'));
          return;
        }
        try {
          resolve(JSON.parse(text.slice(start, end + 1)));
        } catch (parseError) {
          reject(parseError);
        }
      },
    );
  });
}

function sendSse(res, content) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }
  if (!req.url?.endsWith('/chat/completions') || req.method !== 'POST') {
    res.writeHead(404).end();
    return;
  }

  let raw = '';
  req.on('data', (chunk) => (raw += chunk));
  req.on('end', async () => {
    let imagePath;
    try {
      const { systemText, userText, imageDataUrl } = extractPrompt(JSON.parse(raw));
      const image = decodeDataUrl(imageDataUrl);
      if (!image) throw new Error('Request did not contain an image.');

      imagePath = join(tmpdir(), `xrc-${randomUUID()}.${image.ext}`);
      await writeFile(imagePath, image.buffer);

      const prompt = `${imagePath} ${systemText}\n\n${userText}`.trim();
      console.log(`[grok-bridge] running grok on ${imagePath}`);
      const result = await runGrok(prompt, tmpdir());
      sendSse(res, result.text ?? '(no response)');
    } catch (error) {
      console.error('[grok-bridge] error:', error.message);
      sendSse(res, `Grok bridge error: ${error.message}`);
    } finally {
      if (imagePath) unlink(imagePath).catch(() => {});
    }
  });
});

// Only listen when run directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith('grok-bridge.mjs')) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[grok-bridge] OpenAI-compatible Grok bridge on http://localhost:${PORT}/v1`);
    console.log('[grok-bridge] set the extension Base URL to that, leave API key empty.');
  });
}
