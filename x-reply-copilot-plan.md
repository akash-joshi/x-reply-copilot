# X-Reply Copilot — Local Tweet-Vision Chrome Extension

## Context

We're building a local clone of the "X-Reply-Extension" from Steve Hanov's blog
(https://stevehanov.ca/blog/i-built-a-chrome-extension-that-lets-an-llm-see-tweets) — a
"Reply Guy co-pilot" for X/Twitter. The original sends tweets to a hosted LLM; we run it
against **local Ollama** to make it free, while keeping the backend swappable to OpenAI /
vLLM / LM Studio.

What it does:
1. **Visual capture** — grabs the focused tweet as an image via `getDisplayMedia()` +
   `ImageCapture.grabFrame()`, cropped to the tweet. Deliberately avoids broad
   `<all_urls>`/`captureVisibleTab` permissions; reads memes/charts/screenshots as pixels.
2. **Vision analysis + reply** — sends the image to a vision LLM, returns an analysis and a
   suggested reply in a side panel.
3. **Viral-potential pills** — a client-side scorer overlays green/red pills on timeline
   tweets (freshness, reply saturation, account authority).

**Locked decisions** (from clarifying questions):
- Process: native plan + autonomous loop (no `specify`, no GSD scaffold).
- Scope: full co-pilot (capture→vision→reply **and** scoring pills).
- Model backend: **OpenAI-compatible API only** — one `{ baseUrl, apiKey, model }` config,
  default `http://localhost:11434/v1`. Vision via the OpenAI `image_url` content part with a
  base64 data URL (verified: Ollama `/v1/chat/completions` accepts the canonical object
  shape + streaming, base64 only).
- Capture: `getDisplayMedia` + `ImageCapture` (matching the blog), **not** DOM scraping.

**Key architecture decisions** (from research):
- Capture runs **in the side panel** (persistent DOM page, hosts the user gesture). No
  offscreen document (it doesn't auto-focus the target tab); no popup (closes on the share
  picker). Service worker is only a message router + `sidePanel.open` host + storage broker.
- Scorer is a **deterministic heuristic**, not a transformer (YAGNI), behind a `scoreTweet`
  seam so ML can be swapped in later.
- Tooling: **WXT** (Vite-based MV3 framework, file-based entrypoints) + **TypeScript** +
  **Preact** for the panel UI + **Vitest**. `lib/` modules are framework-agnostic.

Project root: `/Users/efem/code/x-reply-copilot`. Greenfield — `git init` as the first step.

**Development without live X.** X bans scripted automation (Playwright/Puppeteer bots, auto-posting,
API scraping) — but this extension is none of that: a human clicks it, it never auto-posts (you
copy-paste the suggested reply), makes no automated requests to X, and the pills inject into your
own local DOM. The X-facing footprint is effectively nil. To keep iteration off the live site, we
develop against a **local static snapshot of an X timeline** — with eyes open about what it does
and doesn't reproduce.

The mock is for fast inner-loop iteration and parser regression tests, **not** a parity guarantee.
A frozen `outerHTML` snapshot cannot prove production fidelity because: (1) X ships A/B layouts and
changes markup, so a snapshot drifts silently; (2) the live timeline is a virtualised SPA that
mounts/unmounts tweets on scroll, which a static file does not reproduce — so it validates pill
injection into an existing node, not continuous insertion as tweets stream in; (3) geometry/crop
alignment is only realistic if the snapshot includes X's CSS.

Where the risk sits and how it's contained:
- The high-value path (capture → vision → reply) reads **screen pixels** via `getDisplayMedia`, not
  the DOM, so markup drift cannot break it. Only the **pills** are DOM-coupled — the least essential
  feature — so fidelity risk is concentrated on the lowest-value surface.
- Selector robustness comes from keying on stable `data-testid` hooks (`tweet`, `reply`, `retweet`,
  `like`, `User-Name`, `<time datetime>`) + throw-safe optional getters, not from the mock.
- The real fidelity gate is a **one-time live selector probe** (see "Optional final smoke test"),
  not the snapshot.

Mechanics:
- Capture one timeline the human way and save with assets ("Save Page As → Complete" or the
  SingleFile extension, so CSS/geometry is realistic) to `test/fixtures/timeline.html`. One-time
  manual save, not automation.
- Serve it locally (`npx serve` / `python -m http.server`) and add a **dev-only** content-script
  match for `http://localhost:*/*`. DOM/pill/capture work iterates against this mock.
- Pure modules (`tweet-dom`, `scoring`, `llm-client`, crop math) are Vitest fixtures — no browser.
  The observer's per-node handler is unit-tested in jsdom with a fixture node; continuous
  scroll-insertion is accepted as live-only behaviour.
- `getDisplayMedia` captures any page, so capture+crop is exercised against the local mock.
- A dev-mode **drift probe** (run once on live X) fires every `tweet-dom` selector and logs which
  signals resolved per tweet — turning "did X change their markup?" into a 10-second console check.

## Project layout

```
x-reply-copilot/
  wxt.config.ts                # manifest: scoped matches, sidePanel, storage perms, icons
  src/
    entrypoints/
      background.ts            # service worker: routing, sidePanel open, storage broker
      content.ts               # x.com/twitter.com: focused-tweet detection, signals, pills
      sidepanel/{index.html, main.ts, App.tsx, settings.tsx}
    lib/
      messaging.ts             # typed discriminated-union message contracts
      capture.ts               # getDisplayMedia -> grabFrame -> DPR-aware crop
      llm-client.ts            # OpenAI-compatible build/parse/stream
      scoring.ts               # deterministic viral-potential heuristic (pure)
      tweet-dom.ts             # X selectors (throw-safe, all optional)
      settings.ts              # chrome.storage.sync get/set + defaults + version
      types.ts                 # LlmConfig, TweetSignals, CaptureResult
    assets/{pill.css, icons}
  test/{scoring,llm-client,capture-crop,tweet-dom,settings}.test.ts
```

**Manifest:** `permissions: [sidePanel, storage, activeTab, scripting]`; content script
matches scoped to `https://x.com/*` + `https://twitter.com/*` (plus `http://localhost:*/*` in
**dev builds only**, for the local mock); `host_permissions` includes `http://localhost:11434/*`;
**no** `tabs`/`<all_urls>`/`captureVisibleTab`.

**What's unit-testable vs manual:** `scoring`, `llm-client` (build/parse), `capture` crop
math, `tweet-dom` parsers (HTML fixtures), `settings` merge → Vitest. `getDisplayMedia`,
side-panel gesture, pill injection/MutationObserver, live LLM round-trip → manual only.

---

✅ Commit 1: Project scaffold + loadable empty extension

### Brief requirement
A buildable WXT+TS project that loads in Chrome and opens an empty side panel on icon click.

### How the implementation satisfies it
`npm create wxt`, TS + Vitest config, `.gitignore`, README stub. `wxt.config.ts` declares the
manifest (scoped matches, `sidePanel` + `storage` perms, icons). `background.ts` calls
`sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`. Empty `sidepanel/index.html`.

### Red phase
No unit tests (pure scaffold). Verification is the build + load.

### Green phase
Scaffold the project, write `wxt.config.ts` + minimal `background.ts` + empty panel HTML.

### Verification
`npm run build` succeeds; `chrome://extensions` → Load unpacked `.output/chrome-mv3`;
clicking the icon opens an empty side panel.

COMMIT, then proceed to commit 2.

---
✅ Commit 2: Settings storage + settings UI

### Brief requirement
Persist `{ baseUrl, apiKey, model, systemPrompt }` and edit them in the panel.

### How the implementation satisfies it
`lib/types.ts` defines `LlmConfig` with defaults (`baseUrl=http://localhost:11434/v1`,
`model=qwen2.5-vl`, empty apiKey, default systemPrompt). `lib/settings.ts` wraps
`chrome.storage.sync` with default-merging + a `version` field. `sidepanel/settings.tsx` is a
form bound to those values.

### Red phase
`test/settings.test.ts`: stored partial config merges over defaults; missing keys fall back;
version field present. Mock `chrome.storage.sync`. Confirm failing first.

### Green phase
Implement `getSettings`/`setSettings` and the form until tests pass.

### Verification
`npm test`; manually round-trip the form (edit → reload panel → values persist).

COMMIT, then proceed to commit 3.

---
✅ Commit 3: Scoring heuristic (pure, fully TDD)

### Brief requirement
`scoreTweet(signals)` returns `{ score, tier: green|red, reasons[] }` from DOM-derived signals.

### How the implementation satisfies it
Weighted sum of **freshness** (decay over hours), **reply saturation** (fewer replies →
higher, log-dampened), **account authority** (verified / follower count if visible).
Normalized 0..1, thresholded into a tier. Missing signals degrade gracefully (neutral
contribution, never throw). Threshold lives in settings. This is the YAGNI replacement for
the blog's "Light Transformer" — same `scoreTweet` interface, swap ML behind it later.

### Red phase
`test/scoring.test.ts`, table-driven, with input signals and expected tier hoisted to shared
constants: fresh+low-replies+authority → green; stale+saturated → red; empty/partial signals
→ no throw, neutral. Confirm failing first.

### Green phase
Implement `lib/scoring.ts` until green.

### Verification
`npm test`.

COMMIT, then proceed to commit 4.

---
✅ Commit 4: Tweet DOM extraction + content-script signal reading

### Brief requirement
Extract `TweetSignals` (author, reply/repost/like counts, timestamp→age, verified, hasMedia)
from a tweet `<article>`, resiliently — developed against a local X snapshot, not live X.

### How the implementation satisfies it
First, save a one-time timeline snapshot to `test/fixtures/timeline.html` (DevTools copy
`outerHTML` from a normal X session) and add a dev-only `http://localhost:*/*` content-script
match so the same content script runs against the locally-served mock. `lib/tweet-dom.ts`
isolates all X selectors (`[data-testid]`, `<time datetime>`); every getter is optional and
throw-safe so X layout churn degrades gracefully. `content.ts` queries articles, builds signals,
logs to console (no pills yet).

### Red phase
`test/tweet-dom.test.ts` against the saved fixture (fixture string → expected signals, both
sides referencing shared constants). Layout-variant fixture → no throw. Confirm failing first.

### Green phase
Implement the parsers + content-script wiring + dev-mode localhost match until green.

### Verification
`npm test`; serve `test/fixtures/timeline.html` locally, open it, console shows plausible signals
per tweet. (No live X needed.)

COMMIT, then proceed to commit 5.

---
✅ Commit 5: Inject scoring pills into the timeline

### Brief requirement
Render green/red pills (with reason tooltips) on timeline tweets, live as you scroll.

### How the implementation satisfies it
`content.ts` runs a `MutationObserver` on the timeline, dedupes seen `<article>` nodes via a
`WeakSet`, batches work in `requestAnimationFrame`, and injects a styled pill (`assets/pill.css`)
into each tweet's action bar using `scoreTweet`.

### Red phase
`test/pill-inject.test.ts` (jsdom): the per-node handler, given a fixture tweet node, injects
exactly one pill with the tier from `scoreTweet` and is idempotent on re-call (WeakSet dedupe).
Continuous scroll-insertion is accepted as live-only and not unit-tested. Confirm failing first.

### Green phase
Implement the observer + injection (handler extracted so it's testable without a live timeline).

### Verification
Open the locally-served `timeline.html`: pills appear, colours match intuition, tooltips show
reasons, no duplicates, no scroll jank. (No live X needed.)

COMMIT, then proceed to commit 6.

---
✅ Commit 6: LLM client (request builder + parser, TDD)

### Brief requirement
Build an OpenAI-compatible vision chat request and parse streamed + non-streamed responses.

### How the implementation satisfies it
`lib/llm-client.ts`: `buildChatRequest({config, systemPrompt, imageDataUrl, userText?})`
emits `messages:[{role:system}, {role:user, content:[{type:text}, {type:image_url,
image_url:{url:dataUrl}}]}]`; `Authorization` header only when apiKey is set. `parseNonStream`
and `parseStreamChunk` handle SSE `data:` lines + `[DONE]`.

### Red phase
`test/llm-client.test.ts`: assert request body shape (the load-bearing Ollama/OpenAI format),
auth header presence/absence, streamed-chunk accumulation, malformed-chunk tolerance. Values
shared between fixture and expectation via constants. Confirm failing first.

### Green phase
Implement until green.

### Verification
`npm test`. (Live network call deferred to commit 8.)

COMMIT, then proceed to commit 7.

---
⬜ Commit 7: Capture + crop (crop math TDD, capture manual)

### Brief requirement
Capture the focused tweet as a cropped base64 PNG via screen capture.

### How the implementation satisfies it
`lib/capture.ts`: `getDisplayMedia({ video, preferCurrentTab: true })` →
`ImageCapture(track).grabFrame()` (with `<video>`+canvas fallback) → crop to the tweet rect.
Scale factor computed from **actual** `frame.width / viewport.innerWidth` (not a blind `dpr`),
crop via offscreen canvas → `toDataURL("image/png")`; `track.stop()` in `finally`.

### Red phase
`test/capture-crop.test.ts`: pure crop-coordinate function (rect + frame dims + viewport →
canvas sx/sy/sw/sh). This is the bug-prone math and is unit-testable in isolation. Confirm
failing first.

### Green phase
Implement the crop math, then the capture wrapper around it.

### Verification
`npm test` for crop math; live `getDisplayMedia` verified in commit 8.

COMMIT, then proceed to commit 8.

---
⬜ Commit 8: Wire full capture→vision→reply flow + results UI

### Brief requirement
End-to-end: click "Capture focused tweet" → cropped image → streamed analysis + suggested
reply in the panel.

### How the implementation satisfies it
Finalize `messaging.ts` contracts. `content.ts` handles `GET_FOCUSED_TWEET_RECT` (article
nearest viewport-center). `sidepanel/main.ts` + `App.tsx`: capture button (gesture #2 after the
icon-click gesture #1 that opened the panel — no auto-capture) → request rect → `capture.ts` →
`llm-client` streaming → render analysis + reply + Copy button + loading/error states.

### Red phase
No new unit tests (pieces already covered). Full manual E2E is the gate — note in commit.

### Green phase
Wire the orchestration + UI.

### Verification
Manual E2E with Ollama against the locally-served `timeline.html` (see Verification section
below) — live X only as an optional final smoke test.

COMMIT, then proceed to commit 9.

---
⬜ Commit 9: Polish, resilience & README

### Brief requirement
Graceful failure paths, image downscaling, configurable scoring threshold, setup docs.

### How the implementation satisfies it
Surface clean errors (Ollama down, model not pulled, no tweet focused, picker cancelled);
downscale images to ~1024px long edge before base64; expose scoring threshold + a pills
on/off toggle in settings; README covers Ollama model pull, load-unpacked steps, and the
permissions rationale.

### Red phase
No new unit tests. Manual exercise of each failure path.

### Green phase
Implement the error handling, downscaling, settings additions, and docs.

### Verification
Exercise each failure path manually; confirm README steps reproduce a working install.

COMMIT — done.

---

## Verification (end-to-end with Ollama)

```bash
ollama pull qwen2.5-vl          # or: ollama pull llama3.2-vision
ollama serve                    # http://localhost:11434

# Confirm the vision endpoint format BEFORE touching the extension:
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{ "model":"qwen2.5-vl", "stream":false, "messages":[{"role":"user","content":[
        {"type":"text","text":"Describe this image."},
        {"type":"image_url","image_url":{"url":"data:image/png;base64,iVBORw0KGgo..."}}]}] }'
# Expect 200 + a description.

cd /Users/efem/code/x-reply-copilot && npm install && npm run build
# chrome://extensions -> Developer mode -> Load unpacked -> .output/chrome-mv3

# Serve the local X snapshot (the primary dev/test target — no live X):
npx serve test/fixtures      # or: python -m http.server --directory test/fixtures
# open http://localhost:3000/timeline.html
```

In the browser, against the **local mock** (`timeline.html`):
1. Confirm green/red pills on the mock timeline, tooltips show reasons, no scroll lag.
2. Click the extension icon → side panel opens.
3. Centre a tweet, click **Capture focused tweet** → pick the current tab in the picker.
4. Confirm: cropped tweet image (debug), then a streamed analysis (incl. any meme/chart) and a
   suggested reply; **Copy** works.
5. Settings: bad model → clean error in panel; point baseUrl at OpenAI + apiKey → same flow
   works (after adding the host permission).
6. Failure paths: stop `ollama serve` → connection error; cancel picker → no-op; no tweet on
   screen → "no focused tweet".

**Optional final smoke test on live X** — once, by hand like a normal user (logged in, manual
clicks): repeat steps 1–4 on a real timeline. Run the **drift probe** (dev-mode command that fires
every `tweet-dom` selector and logs which signals resolved per tweet, e.g. "18/20 tweets, follower
count missing on N") — this is the actual fidelity gate the mock can't be. Also confirm continuous
pill injection works as the timeline streams new tweets on scroll (the one behaviour the static mock
doesn't reproduce). If selectors have drifted, refresh `test/fixtures/timeline.html` from a new
snapshot and fix `tweet-dom.ts`.

## Execution

Complete one commit at a time. After each commit's tests pass, commit the changes, mark the
commit with ✅ in this plan file, then proceed to the next commit. (Note: I do not commit
unless you've approved this plan, per your git guidelines — approving this plan is that
authorization.) After approval this can be handed to a `/loop` or `ralph-prompt` run to grind
through the commits autonomously.
```

## Risks (carry into execution)

- **Gesture chain**: open panel from icon (gesture 1), capture from in-panel button (gesture
  2). No auto-capture on load. Prototype this first in commit 8 if nervous.
- **Crop DPR/scaling**: compute scale from real frame dims, not `devicePixelRatio`; add a debug
  view rendering the crop so you can eyeball alignment.
- **X DOM churn**: only the pills depend on the DOM; the capture path is pixels, so it's immune.
  Keep selectors isolated + throw-safe.
- **Ollama format drift**: send canonical `image_url` object shape; surface raw 4xx errors;
  README documents the model pull.
