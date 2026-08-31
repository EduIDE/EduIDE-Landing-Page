import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.ts';

interface ParsedCookie {
    name: string;
    value: string;
    path?: string;
    maxAge?: number;
    sameSite?: string;
    secure: boolean;
    domain?: string;
}

// Minimal Set-Cookie header parser used to assert on individual cookie attributes.
// Uses indexOf('=') rather than split('=') so that base64-padded or URL-encoded
// values containing literal '=' characters are captured whole.
function parseCookie(header: string): ParsedCookie {
    const [nameValue = '', ...rest] = header.split('; ');
    const eqPos = nameValue.indexOf('=');
    const name = nameValue.slice(0, eqPos);
    const value = nameValue.slice(eqPos + 1);
    const cookie: ParsedCookie = { name, value, secure: false };

    for (const part of rest) {
        const partEq = part.indexOf('=');
        const key = (partEq === -1 ? part : part.slice(0, partEq)).toLowerCase().trim();
        const val = partEq === -1 ? '' : part.slice(partEq + 1);
        if (key === 'path') cookie.path = val;
        else if (key === 'max-age') cookie.maxAge = parseInt(val, 10);
        else if (key === 'samesite') cookie.sameSite = val;
        else if (key === 'secure') cookie.secure = true;
        else if (key === 'domain') cookie.domain = val;
    }

    return cookie;
}

function decodeCookieValue(value: string): unknown {
    return JSON.parse(decodeURIComponent(value));
}

function formBody(fields: Record<string, string>): string {
    return new URLSearchParams(fields).toString();
}

// ── GET /health ────────────────────────────────────────────────────────────

describe('GET /health', () => {
    test('returns 200 with body OK', async () => {
        const app = createApp();
        const res = await app.request('/health');
        assert.equal(res.status, 200);
        assert.equal(await res.text(), 'OK');
    });
});

// ── 404 handler ───────────────────────────────────────────────────────────

describe('404 handler', () => {
    test('unknown path returns 404 JSON with path field', async () => {
        const app = createApp();
        const res = await app.request('/nonexistent');
        assert.equal(res.status, 404);
        const body = await res.json() as { error: string; path: string };
        assert.equal(body.error, 'Not found');
        assert.equal(body.path, '/nonexistent');
    });
});

// ── POST / – JSON body ────────────────────────────────────────────────────

describe('POST / - JSON body', () => {
    test('full payload → 303 redirect to / with eduide_launch cookie', async () => {
        const app = createApp();
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                git: { gitUri: 'https://github.com/org/repo.git', gitToken: 'secret' },
                parameters: { appDef: 'java-17-latest', artemisToken: 'atk' },
            }),
        });
        assert.equal(res.status, 303);
        assert.equal(res.headers.get('location'), '/');
        const rawCookie = res.headers.get('set-cookie');
        assert.ok(rawCookie, 'Set-Cookie header must be present');
        assert.equal(parseCookie(rawCookie).name, 'eduide_launch');
    });

    test('cookie value round-trips to the original payload', async () => {
        const payload = {
            git: { gitUri: 'https://github.com/org/repo.git', gitToken: 'tok' },
            parameters: { appDef: 'java-17', artemisToken: 'atk' },
        };
        const app = createApp();
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const rawCookie = res.headers.get('set-cookie');
        assert.ok(rawCookie);
        assert.deepEqual(decodeCookieValue(parseCookie(rawCookie).value), payload);
    });

    test('cookie has correct security attributes (defaults)', async () => {
        const app = createApp();
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        const rawCookie = res.headers.get('set-cookie');
        assert.ok(rawCookie);
        const cookie = parseCookie(rawCookie);
        assert.equal(cookie.path, '/');
        assert.equal(cookie.sameSite, 'Lax');
        assert.equal(cookie.maxAge, 600);
        assert.equal(cookie.secure, true);
        assert.equal(cookie.domain, undefined);
    });

    test('git-only payload is accepted', async () => {
        const app = createApp();
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ git: { gitUri: 'https://github.com/org/repo.git' } }),
        });
        assert.equal(res.status, 303);
    });

    test('empty object is accepted (all schema fields are optional)', async () => {
        const app = createApp();
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        assert.equal(res.status, 303);
    });

    test('malformed JSON body → 400', async () => {
        const app = createApp();
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{not valid json',
        });
        assert.equal(res.status, 400);
        const body = await res.json() as { error: string };
        assert.ok(body.error);
    });

    test('wrong type for git.gitUri (number instead of string) → 400', async () => {
        const app = createApp();
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ git: { gitUri: 123 } }),
        });
        assert.equal(res.status, 400);
    });

    test('wrong type for parameters value (number instead of string) → 400', async () => {
        const app = createApp();
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parameters: { appDef: 42 } }),
        });
        assert.equal(res.status, 400);
    });
});

// ── POST / – form with payload field ─────────────────────────────────────

describe('POST / - form with payload field', () => {
    test('JSON payload field → 303 with correct cookie value', async () => {
        const payload = {
            git: { gitUri: 'https://github.com/org/repo.git' },
            parameters: { appDef: 'java-17' },
        };
        const app = createApp();
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formBody({ payload: JSON.stringify(payload) }),
        });
        assert.equal(res.status, 303);
        const rawCookie = res.headers.get('set-cookie');
        assert.ok(rawCookie);
        assert.deepEqual(decodeCookieValue(parseCookie(rawCookie).value), payload);
    });

    test('invalid JSON in payload field → 400 mentioning "payload"', async () => {
        const app = createApp();
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formBody({ payload: '{bad json}' }),
        });
        assert.equal(res.status, 400);
        const body = await res.json() as { error: string };
        assert.ok(body.error.includes('"payload"'));
    });
});

// ── POST / – flat form fields ─────────────────────────────────────────────

describe('POST / - flat form fields', () => {
    test('git fields route to git section, other fields to parameters', async () => {
        const app = createApp();
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formBody({
                gitUri: 'https://github.com/org/repo.git',
                gitToken: 'secret',
                appDef: 'java-17',
                artemisToken: 'atk',
            }),
        });
        assert.equal(res.status, 303);
        const rawCookie = res.headers.get('set-cookie');
        assert.ok(rawCookie);
        const val = decodeCookieValue(parseCookie(rawCookie).value) as {
            git: Record<string, string>;
            parameters: Record<string, string>;
        };
        assert.deepEqual(val.git, { gitUri: 'https://github.com/org/repo.git', gitToken: 'secret' });
        assert.deepEqual(val.parameters, { appDef: 'java-17', artemisToken: 'atk' });
    });

    test('all four git fields (gitUri, gitUser, gitMail, gitToken) are recognized', async () => {
        const app = createApp();
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formBody({
                gitUri: 'https://github.com/org/repo.git',
                gitUser: 'alice',
                gitMail: 'alice@example.com',
                gitToken: 'tok',
            }),
        });
        assert.equal(res.status, 303);
        const rawCookie = res.headers.get('set-cookie');
        assert.ok(rawCookie);
        const val = decodeCookieValue(parseCookie(rawCookie).value) as {
            git: Record<string, string>;
            parameters: unknown;
        };
        assert.deepEqual(val.git, {
            gitUri: 'https://github.com/org/repo.git',
            gitUser: 'alice',
            gitMail: 'alice@example.com',
            gitToken: 'tok',
        });
        assert.equal(val.parameters, undefined);
    });

    test('empty string field values are omitted from the payload', async () => {
        const app = createApp();
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formBody({ gitUri: 'https://github.com/org/repo.git', gitToken: '' }),
        });
        assert.equal(res.status, 303);
        const rawCookie = res.headers.get('set-cookie');
        assert.ok(rawCookie);
        const val = decodeCookieValue(parseCookie(rawCookie).value) as {
            git: Record<string, string>;
            parameters: unknown;
        };
        assert.deepEqual(val.git, { gitUri: 'https://github.com/org/repo.git' });
        assert.equal(val.parameters, undefined);
    });

    test('"payload" field with empty value falls through to flat mode and is not forwarded', async () => {
        // empty payload="" is falsy so the JSON-parse branch is skipped;
        // payloadFromFlatForm then skips the "payload" key via `if (key === "payload") continue`
        const app = createApp();
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formBody({ gitUri: 'https://github.com/org/repo.git', payload: '' }),
        });
        assert.equal(res.status, 303);
        const rawCookie = res.headers.get('set-cookie');
        assert.ok(rawCookie);
        const val = decodeCookieValue(parseCookie(rawCookie).value) as {
            git: Record<string, string>;
            parameters?: Record<string, string>;
        };
        assert.deepEqual(val.git, { gitUri: 'https://github.com/org/repo.git' });
        assert.equal(val.parameters?.['payload'], undefined);
    });

    test('parameters-only form (no git fields) leaves git section absent', async () => {
        const app = createApp();
        const res = await app.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formBody({ appDef: 'java-17', user: 'alice' }),
        });
        assert.equal(res.status, 303);
        const rawCookie = res.headers.get('set-cookie');
        assert.ok(rawCookie);
        const val = decodeCookieValue(parseCookie(rawCookie).value) as {
            git: unknown;
            parameters: Record<string, string>;
        };
        assert.equal(val.git, undefined);
        assert.deepEqual(val.parameters, { appDef: 'java-17', user: 'alice' });
    });
});
