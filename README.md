# FORMA — Music Studio

A responsive, dependency-free single-page music generation app using the documented Suno API at https://docs.sunoapi.org. Designed for Netlify hosting with Node serverless functions.

## Features
- Quick ideas with genre/mood presets; custom song titles and lyrics.
- Vocal or instrumental music; V6, V6 Mini, and V6 Wild models.
- Custom duration, vocal preference, style adherence, creative freedom, and excluded styles.
- AI lyric writing with selectable returned variations.
- Account credit check, asynchronous status polling, partial track playback, audio links, and lyrics.
- Pause/resume status checks; retrieve previous music tasks by ID without regenerating.
- Responsive layout, accessible labels, keyboard controls, reduced-motion support.

## Deploy to Netlify

Use a **Git-backed deploy** or Netlify CLI. Netlify Drop of only the static folder does not deploy the required functions.

1. Upload this project to your repository's `main` branch.
2. In Netlify, choose **Add new project → Import an existing project** and select the repository.
3. Set production branch to **main**, build command to **npm run build**, publish directory to **dist**, and functions directory to **netlify/functions**. `netlify.toml` already contains these settings.
4. Deploy. No API key environment variable is required.
5. Open the deployed HTTPS URL, click **Connect API**, enter your own Suno API key, and generate a track.

Alternative: from the project directory, run `npx netlify-cli deploy --build --prod` and follow Netlify's login/site selection flow.

## Local development

Requires Node 20 or newer (Netlify configuration uses Node 22). No dependencies need installation.

```sh
npm run dev
```

Open **http://localhost:8888** (use localhost, not 127.0.0.1, because the proxy validates the origin). Tests and build:

```sh
npm test
npm run build
```

Generation needs a publicly reachable callback URL. Local development supports the UI, mocked flows, credits and task retrieval, but actual generation should be tested on a Netlify HTTPS deploy because the provider cannot reach localhost callbacks.

## API integration decisions

Reviewed on October 2, 2026. References:
- https://docs.sunoapi.org/suno-api/generate-music
- https://docs.sunoapi.org/suno-api/get-music-generation-details
- https://docs.sunoapi.org/suno-api/get-remaining-credits
- https://docs.sunoapi.org/suno-api/generate-lyrics
- https://docs.sunoapi.org/suno-api/get-lyrics-generation-details
- https://docs.sunoapi.org/suno-api/quickstart

The documentation is inconsistent: the landing page/quickstart identifies `https://api.sunoapi.org` while some endpoint examples use `https://apibox.erweima.ai`. This app uses the documented quickstart base URL and the dedicated endpoint schemas (including the V6-series models and `/generate/credit`). New V6 quick requests include `style` as the required attachment in addition to the description. Custom mode sends actual lyrics in `lyrics`, never a prose description accidentally sung as lyrics. Returned tracks support both `response.sunoData` and `response.data`, and camelCase or snake_case audio/image fields.

The required callback URL points to an acknowledge-only Netlify function. It discards all callback data; the UI retrieves results using authenticated status polling. Music checks run every 7 seconds and pause after 10 minutes. Lyrics checks run every 5 seconds and pause after 5 minutes. No automatic retry of a paid generation submission occurs. An interrupted submission can have been accepted upstream: find the task ID in the provider dashboard and retrieve it before submitting again.

## Key handling and privacy

The provided conversation key is **not used or included**. Each visitor enters their own key in a masked field; connecting checks credits. The key lives only in page memory, never localStorage, sessionStorage, cookies, URLs, files, a database, or environment variables. It is sent over HTTPS to the app's same-origin Netlify function via a header and immediately forwarded to Suno API as a bearer token. The app does not log keys or request contents. Netlify and the API provider process requests as hosting/service providers; configure external monitoring not to capture headers or bodies.

The proxy allows only specific API actions, validates payloads and origins, never accepts an upstream URL, and never follows upstream redirects. Provider parameters are stripped from returned status data. Cover art and audio only accept HTTPS URLs; untrusted titles/lyrics use textContent. No third-party scripts or fonts are loaded.

Refreshing or disconnecting clears keys, task IDs, and generated results in the app. Copy task IDs for later recovery and download tracks before the provider's documented 14-day retention ends. Downloads open provider-hosted audio in a new tab; browser Save/Download controls handle the file without requiring cross-origin fetch permissions.

## Verification and limitations

All 27 Node tests pass: 15 API tests and 12 frontend state tests using the actual app code with a minimal DOM adapter. They cover validation, callbacks, runtime credential forwarding, sanitization, Netlify origins, malformed responses, connection races, disconnect clearing, lyrics, duplicate submissions, pause behavior, and missing audio. Actual local HTTP checks also pass for the page, assets, missing-key rejection, callback, and 404 routing. The DOM adapter does not verify layout, native browser form validation, or real audio playback. JavaScript syntax and the static build pass. Browser UI verification was attempted but blocked: no Chromium binary is installed, its download failed, and the available browser cannot reach localhost. Desktop/mobile rendering and browser interactions therefore remain unverified. No real paid generation or credential validation was performed: users must supply their own key at runtime.

This project was initialized and committed locally on `main`. No remote repository was provided, so no remote push or Netlify deployment has been performed.

## Restore the main branch from the included Git bundle

The source archive includes `forma-main.bundle`, preserving the local commit and `main` branch. To restore a Git checkout:

```sh
git clone forma-main.bundle forma-music-studio
cd forma-music-studio
git branch --show-current
```

To push it, add your own repository remote and run `git push -u origin main`. No remote URL was available in this session.

## Review fixes

The second review fixed key-switch races and preserved task recovery after a failed replacement key, cleared previous-account results on disconnect, rejected empty-audio success responses, improved malformed response errors, restricted localhost origins to local development, validated returned task IDs and balances, and ignored stale responses after pausing or disconnecting.
