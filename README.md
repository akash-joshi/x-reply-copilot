# X-Reply Copilot

A local "Reply Guy co-pilot" for X/Twitter. It visually captures the tweet you're
looking at (screen capture, not DOM scraping), sends it to a vision-capable LLM, and
shows an analysis plus a suggested reply in a Chrome side panel. It also overlays
green/red "viral reply potential" pills on timeline tweets.

The LLM backend is any OpenAI-compatible API. It defaults to a local
[Ollama](https://ollama.com) vision model so it's free; point it at OpenAI / vLLM /
LM Studio by changing the base URL and model in settings.

## Develop

```bash
npm install
npm run dev          # launches Chrome with the extension loaded
npm run build        # outputs .output/chrome-mv3 for "Load unpacked"
npm test             # unit tests (scoring, LLM client, crop math, DOM parsing)
```

### Local model

```bash
ollama pull qwen3.5:9b     # the default vision model; or qwen2.5vl:3b for a lighter one
ollama serve               # http://localhost:11434
```

The default settings target `http://localhost:11434/v1` with `qwen3.5:9b`. Change the
base URL, model, API key, and system prompt in the side panel's Settings section to use
a different model or a hosted OpenAI-compatible provider.

### Allow the extension's origin

Ollama rejects requests whose `Origin` isn't allow-listed, and a browser extension's
origin is `chrome-extension://<id>`, so out of the box the extension gets HTTP 403. Allow
it once:

```bash
launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"
```

then fully quit and reopen Ollama.app. To make it survive reboots, add a LaunchAgent that
re-applies it at login (see `com.local.ollama-origins.plist`).

### End-to-end check

1. `npm run build`, then load `.output/chrome-mv3` via `chrome://extensions` → Load unpacked.
2. Serve the saved timeline: `python3 -m http.server --directory test/fixtures 3000`, open
   `http://localhost:3000/timeline.html`. Green/red pills should appear on the tweets.
3. Click the extension icon to open the side panel, centre a tweet, click **Capture focused
   tweet**, and pick the tab in the share picker. The panel shows the cropped image, then a
   streamed analysis and suggested reply.

The screen-capture picker and side-panel gesture require a human, so this last step is manual.

### Developing against a saved timeline (no live X)

The DOM-coupled features (timeline pills) are developed against a static snapshot of an
X timeline at `test/fixtures/timeline.html`, served locally — the capture→vision path uses
screen pixels and is unaffected by X markup. Live X is only needed for a final selector
check: paste `scripts/drift-probe.js` into the DevTools console on a real timeline to see,
per tweet, which `tweet-dom` selectors still resolve. If most come back missing, refresh
the fixture and update `lib/tweet-dom.ts`.

## Architecture

- `entrypoints/background.ts` — service worker: opens the side panel, routes messages.
- `entrypoints/content.ts` — runs on X (and localhost in dev): tweet detection,
  signal extraction, pill injection.
- `entrypoints/sidepanel/` — the UI; owns the screen-capture user gesture and the LLM calls.
- `lib/` — framework-agnostic modules: `capture`, `llm-client`, `scoring`, `tweet-dom`,
  `settings`, `messaging`, `types`.
