import { useState } from 'react';
import { captureFocusedTweet } from '../../lib/capture';
import { buildChatRequest, streamChat } from '../../lib/llm-client';
import { getSettings } from '../../lib/settings';
import type { ContentResponse } from '../../lib/messaging';

/**
 * Runs in the X page via scripting.executeScript. Must be fully self-contained
 * (no imports/outer references) because it's serialised and injected. Returns the
 * tweet nearest the viewport centre.
 */
function findFocusedTweetRect(): ContentResponse {
  const centreY = window.innerHeight / 2;
  let best: { rect: DOMRect; handle?: string } | undefined;
  let bestDistance = Infinity;
  for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
    const rect = article.getBoundingClientRect();
    if (rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) continue;
    const distance = Math.abs((rect.top + rect.bottom) / 2 - centreY);
    if (distance < bestDistance) {
      bestDistance = distance;
      const text = article.querySelector('[data-testid="User-Name"]')?.textContent ?? '';
      best = { rect, handle: (text.match(/@(\w+)/) ?? [])[1] };
    }
  }
  if (!best) return { error: 'No tweet is currently in view.' };
  const { rect, handle } = best;
  return {
    rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    handle,
  };
}

type Phase = 'idle' | 'capturing' | 'streaming' | 'done' | 'error';

interface CaptureState {
  phase: Phase;
  text: string;
  image?: string;
  error?: string;
}

export function CaptureView() {
  const [state, setState] = useState<CaptureState>({ phase: 'idle', text: '' });
  const [direction, setDirection] = useState('');

  const onCapture = async () => {
    setState({ phase: 'capturing', text: '' });
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab to capture.');

      let response: ContentResponse | undefined;
      try {
        const [injection] = await browser.scripting.executeScript({
          target: { tabId: tab.id },
          func: findFocusedTweetRect,
        });
        response = injection?.result as ContentResponse | undefined;
      } catch {
        throw new Error('Open an X timeline or post in the active tab, then capture.');
      }
      if (!response) throw new Error('No tweet found on the page.');
      if ('error' in response) throw new Error(response.error);

      const imageDataUrl = await captureFocusedTweet(response.rect, response.viewport);
      setState({ phase: 'streaming', text: '', image: imageDataUrl });

      const settings = await getSettings();
      const request = buildChatRequest({
        config: settings.llm,
        imageDataUrl,
        userText: direction.trim() || undefined,
      });

      let accumulated = '';
      for await (const delta of streamChat(request)) {
        accumulated += delta;
        setState((current) => ({ ...current, text: accumulated }));
      }
      setState((current) => ({ ...current, phase: 'done' }));
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      // fetch() rejects with a terse "Failed to fetch" when the model server is unreachable.
      const message = /failed to fetch/i.test(raw)
        ? 'Could not reach the model server. Is Ollama running on the configured base URL?'
        : raw;
      setState({ phase: 'error', text: '', error: message });
    }
  };

  const busy = state.phase === 'capturing' || state.phase === 'streaming';

  return (
    <section>
      <textarea
        value={direction}
        onChange={(event) => setDirection(event.target.value)}
        placeholder="Optional: how should it reply? e.g. 'be funny and concise', 'agree and add a stat', 'reply in French'"
        rows={2}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          marginBottom: 8,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
        }}
      />
      <button onClick={onCapture} disabled={busy} style={{ padding: '8px 12px', fontSize: 14 }}>
        {busy ? 'Working…' : 'Capture focused tweet'}
      </button>

      {state.image && (
        <img
          src={state.image}
          alt="Captured tweet"
          style={{ display: 'block', maxWidth: '100%', marginTop: 12, border: '1px solid #ddd' }}
        />
      )}

      {state.error && (
        <p style={{ color: '#b00', marginTop: 12 }}>{state.error}</p>
      )}

      {state.text && (
        <div style={{ marginTop: 12 }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'system-ui, sans-serif', margin: 0 }}>
            {state.text}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(state.text)}
            style={{ marginTop: 8 }}
          >
            Copy
          </button>
        </div>
      )}
    </section>
  );
}
