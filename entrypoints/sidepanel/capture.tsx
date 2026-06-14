import { useState } from 'react';
import { captureFocusedTweet } from '../../lib/capture';
import { buildChatRequest, streamChat } from '../../lib/llm-client';
import { getSettings } from '../../lib/settings';
import { GET_FOCUSED_TWEET_RECT, isErrorResponse, type ContentResponse } from '../../lib/messaging';

type Phase = 'idle' | 'capturing' | 'streaming' | 'done' | 'error';

interface CaptureState {
  phase: Phase;
  text: string;
  image?: string;
  error?: string;
}

export function CaptureView() {
  const [state, setState] = useState<CaptureState>({ phase: 'idle', text: '' });

  const onCapture = async () => {
    setState({ phase: 'capturing', text: '' });
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab to capture.');

      let response: ContentResponse | undefined;
      try {
        response = (await browser.tabs.sendMessage(tab.id, {
          type: GET_FOCUSED_TWEET_RECT,
        })) as ContentResponse;
      } catch {
        throw new Error('Open x.com in the active tab, then capture.');
      }
      if (isErrorResponse(response)) throw new Error(response?.error ?? 'No tweet found.');

      const imageDataUrl = await captureFocusedTweet(response.rect, response.viewport);
      setState({ phase: 'streaming', text: '', image: imageDataUrl });

      const settings = await getSettings();
      const request = buildChatRequest({ config: settings.llm, imageDataUrl });

      let accumulated = '';
      for await (const delta of streamChat(request)) {
        accumulated += delta;
        setState((current) => ({ ...current, text: accumulated }));
      }
      setState((current) => ({ ...current, phase: 'done' }));
    } catch (error) {
      setState({
        phase: 'error',
        text: '',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const busy = state.phase === 'capturing' || state.phase === 'streaming';

  return (
    <section>
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
