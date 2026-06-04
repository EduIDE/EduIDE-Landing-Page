# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (legacy-peer-deps required due to Node 26 / npm 11 arborist bug)
npm install

# Type-check only (no emit)
npm run ts:check

# Run tests (node:test, no extra dependencies)
npm test

# Development server with hot reload
npm run dev

# Production bundle (runs ts:check first, then esbuild)
npm run build

# Fast dev bundle (no ts:check, non-minified, includes source maps)
npm run build:dev

# Run the bundled server
npm start
```

Test the running server:
```bash
# JSON body (programmatic / curl testing)
curl -i -X POST http://localhost:8090/ \
  -H 'content-type: application/json' \
  -d '{"git":{"gitUri":"https://github.com/org/repo.git"},"parameters":{"appDef":"java-17-latest","artemisToken":"tok"}}'

# Readiness probe
curl http://localhost:8090/health
```

`COOKIE_SECURE=false` must be set when running locally over HTTP:
```bash
COOKIE_SECURE=false npm start
```

## Architecture

This is the credential-handoff backend for the EduIDE landing page. Its only job is to receive a POST from Artemis (via a browser form submission), store the credentials in a browser cookie, and redirect the browser to the SPA — keeping secrets out of the URL query string.

**Full flow:**
1. Artemis submits a self-submitting HTML form (browser navigation, not a server-side fetch) to `POST /`
2. This backend validates the body, writes a `eduide_launch` cookie, and responds `303 → /`
3. The SPA (nginx-served React app in `../`) loads, reads the cookie via `document.cookie`, and runs its normal Keycloak auth + `TheiaCloud.launchAndRedirect` flow
4. After a successful launch the SPA calls `clearLaunchCookie()` — the cookie's `Max-Age=600` is the fallback cleanup

**Why the cookie is not `httpOnly`:** the SPA is a client-side React app that reads it via `document.cookie`. See `../src/launchParameters.ts` for the read/clear helpers.

**Cookie encoding:** `setCookie` from `hono/cookie` URL-encodes the value automatically. The SPA's `readLaunchCookie` does one `decodeURIComponent` + `JSON.parse`. Do NOT pre-encode the value before passing it to `setCookie` — that produces double-encoding.

### Source layout

| File | Role |
|---|---|
| `src/schema.ts` | arktype schema for the POST body. `git` section holds git credentials; `parameters` holds everything else (appDef, artemisUrl, artemisToken, user, extras). All fields optional for forward/backward compatibility. |
| `src/config.ts` | Reads all config from env vars. Change defaults here. |
| `src/app.ts` | Hono app. `parsePayload` handles three body transports (JSON, form with `payload` field, flat form fields). `GIT_FIELD_NAMES` controls which flat fields route to the `git` section. |
| `src/index.ts` | Entrypoint: calls `createApp()` and `serve()`. |

### Accepted POST body formats

All three formats produce the same `LaunchPayload` and are handled by `parsePayload` in `app.ts`:

1. **JSON** (`Content-Type: application/json`): `{ "git": { "gitUri": "...", ... }, "parameters": { "appDef": "...", ... } }`
2. **Form with `payload` field**: a single hidden field whose value is the JSON string above
3. **Flat form fields**: individual `<input>` fields; keys in `GIT_FIELD_NAMES` (`gitUri`, `gitUser`, `gitMail`, `gitToken`) go to `git`, everything else goes to `parameters`

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `LANDING_BACKEND_PORT` / `PORT` | `8090` | Listening port |
| `LANDING_PAGE_URL` | `/` | Redirect target after cookie is set |
| `COOKIE_NAME` | `eduide_launch` | Cookie name (must match `launchParameters.ts`) |
| `COOKIE_SECURE` | `true` | Set `false` for local HTTP dev |
| `COOKIE_DOMAIN` | _(unset)_ | Only needed when backend and SPA are on different subdomains |
| `COOKIE_MAX_AGE` | `600` | Cookie lifetime in seconds |

### Build tooling

esbuild (`esbuild.js`) bundles everything into a single `dist/index.js` (ESM, Node platform). TypeScript is checked separately via `tsc --noEmit`; esbuild does not type-check. The `.npmrc` sets `legacy-peer-deps=true` permanently so plain `npm install` works without the flag.
