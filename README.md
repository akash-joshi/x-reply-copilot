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
ollama pull qwen2.5-vl     # or: llama3.2-vision
ollama serve               # http://localhost:11434
```

### Developing against a saved timeline (no live X)

The DOM-coupled features (timeline pills) are developed against a static snapshot of an
X timeline at `test/fixtures/timeline.html`, served locally — see the plan for why and
how. Live X is only needed for a final manual selector check.

## Architecture

- `entrypoints/background.ts` — service worker: opens the side panel, routes messages.
- `entrypoints/content.ts` — runs on X (and localhost in dev): tweet detection,
  signal extraction, pill injection.
- `entrypoints/sidepanel/` — the UI; owns the screen-capture user gesture and the LLM calls.
- `lib/` — framework-agnostic modules: `capture`, `llm-client`, `scoring`, `tweet-dom`,
  `settings`, `messaging`, `types`.
