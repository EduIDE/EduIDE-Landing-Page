import * as Sentry from '@sentry/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initializeSentry } from './sentry';

const envelopes = vi.hoisted(() => [] as unknown[]);

// The real SDK runs in full, with only the network call replaced.
vi.mock('@sentry/react', async importOriginal => {
    const actual = await importOriginal<typeof import('@sentry/react')>();
    return {
        ...actual,
        init: (options: Parameters<typeof actual.init>[0]) =>
            actual.init({
                ...options,
                transport: () => ({
                    send: async envelope => {
                        envelopes.push(envelope);
                        return {};
                    },
                    flush: async () => true
                })
            })
    };
});

const DSN = 'https://public@sentry.example/1';

function stubConfig(sentryConfig: Record<string, unknown>): void {
    vi.stubGlobal('theiaCloudConfig', {
        serviceAuthToken: 'service-token',
        appName: 'EduIDE',
        serviceUrl: 'https://service.example/api',
        appDefinition: 'java-17',
        useKeycloak: false,
        useEphemeralStorage: true,
        ...sentryConfig
    });
}

async function sentEnvelopes(): Promise<string> {
    await Sentry.flush(1000);
    return JSON.stringify(envelopes);
}

function sentItems(type: string): Record<string, any>[] {
    return envelopes
        .flatMap(envelope => (envelope as [unknown, [{ type: string }, any][]])[1])
        .filter(([header]) => header.type === type)
        .map(([, payload]) => payload);
}

// The SDK wraps fetch once per process, so the stub has to be in place before the first init and stay there.
beforeAll(() => {
    window.fetch = (async () => new Response('ok')) as typeof fetch;
});

beforeEach(() => {
    envelopes.length = 0;
    window.history.pushState({}, '', '/');
});

afterEach(async () => {
    // A pageload left open would become the active span of the next test.
    const active = Sentry.getActiveSpan();
    if (active) {
        Sentry.getRootSpan(active).end();
    }
    await Sentry.close();
    Sentry.getIsolationScope().clearBreadcrumbs();
    Sentry.getCurrentScope().setClient(undefined);
});

describe('starting Sentry', () => {
    it('stays off by default', () => {
        stubConfig({});
        initializeSentry();
        expect(Sentry.getClient()).toBeUndefined();
    });

    it('stays off when the Theia Cloud config is missing', () => {
        initializeSentry();
        expect(Sentry.getClient()).toBeUndefined();
    });

    it.each([['true'], [1], [false], [{}]])('stays off when sentryEnable is %j', sentryEnable => {
        stubConfig({ sentryEnable, sentryDsn: DSN });
        initializeSentry();
        expect(Sentry.getClient()).toBeUndefined();
    });

    it.each([[undefined], [''], ['   ']])('stays off with a warning when the DSN is %j', sentryDsn => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        stubConfig({ sentryEnable: true, sentryDsn });
        initializeSentry();
        expect(Sentry.getClient()).toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('sentryDsn is missing'));
    });

    it('starts with a configured DSN and environment', () => {
        stubConfig({ sentryEnable: true, sentryDsn: `  ${DSN}  `, sentryEnvironment: 'staging' });
        initializeSentry();
        const options = Sentry.getClient()?.getOptions();
        expect(options?.dsn).toBe(DSN);
        expect(options?.environment).toBe('staging');
    });

    it.each([
        [0.5, 0.5],
        [0, 0],
        [1.5, 0.2],
        [-1, 0.2],
        ['1', 0.2],
        [undefined, 0.2]
    ])('uses sentryTracesSampleRate %j as a rate of %j', (sentryTracesSampleRate, expected) => {
        stubConfig({ sentryEnable: true, sentryDsn: DSN, sentryTracesSampleRate });
        initializeSentry();
        expect(Sentry.getClient()?.getOptions().tracesSampleRate).toBe(expected);
    });

    it('propagates traces only to the service URL', () => {
        stubConfig({ sentryEnable: true, sentryDsn: DSN });
        initializeSentry();
        const [target] = Sentry.getClient()?.getOptions().tracePropagationTargets as RegExp[];
        expect(target.test('https://service.example/api/launch')).toBe(true);
        expect(target.test('https://service.example/apifoo')).toBe(false);
        expect(target.test('https://evil.example/api/launch')).toBe(false);
    });
});

describe('scrubbing', () => {
    const QUERY_SECRETS = {
        gitUri: 'https://student:GIT-CREDENTIAL@git.example/org/repo.git',
        artemisToken: 'ARTEMIS-SECRET',
        token: 'TOKEN-SECRET',
        access_token: 'ACCESS-SECRET',
        id_token: 'ID-SECRET',
        code: 'CODE-SECRET'
    };
    const FORBIDDEN = ['GIT-CREDENTIAL', 'ARTEMIS-SECRET', 'TOKEN-SECRET', 'ACCESS-SECRET', 'ID-SECRET', 'CODE-SECRET', 'FRAGMENT-SECRET'];

    function expectNoSecrets(payload: string): void {
        for (const secret of FORBIDDEN) {
            expect(payload).not.toContain(secret);
        }
    }

    function startOnSecretUrl(): void {
        const secretUrl = `/start?${new URLSearchParams(QUERY_SECRETS)}#code=FRAGMENT-SECRET&state=abc`;
        window.history.pushState({}, '', secretUrl);
        stubConfig({ sentryEnable: true, sentryDsn: DSN, sentryTracesSampleRate: 1 });
        initializeSentry();
    }

    // An idle pageload without children is dropped, so give it one and end it now rather than waiting.
    function finishPageload(): void {
        const active = Sentry.getActiveSpan();
        expect(active).toBeDefined();
        Sentry.startInactiveSpan({ name: 'child' }).end();
        if (active) {
            Sentry.getRootSpan(active).end();
        }
    }

    function sentTransaction(): Record<string, any> {
        const [transaction] = sentItems('transaction');
        expect(transaction).toBeDefined();
        return transaction;
    }

    it('reports errors to Sentry without any secret from the page URL', async () => {
        startOnSecretUrl();
        Sentry.captureException(new Error('boom'));

        const payload = await sentEnvelopes();
        expectNoSecrets(payload);

        const [event] = sentItems('event');
        expect(event.exception.values[0].value).toBe('boom');
        expect(event.request.url).toContain('/start');
    });

    it('strips a secret-bearing referrer from errors', async () => {
        vi.spyOn(document, 'referrer', 'get').mockReturnValue(`https://lms.example/?artemisToken=ARTEMIS-SECRET#code=FRAGMENT-SECRET`);
        startOnSecretUrl();
        Sentry.captureException(new Error('boom'));

        expectNoSecrets(await sentEnvelopes());
        expect(sentItems('event')[0].request.headers?.Referer).toBeUndefined();
    });

    it('scrubs breadcrumb URLs and URL attributes on errors', async () => {
        startOnSecretUrl();
        Sentry.addBreadcrumb({
            category: 'fetch',
            data: {
                url: 'https://student:GIT-CREDENTIAL@git.example/?code=CODE-SECRET#FRAGMENT-SECRET',
                'http.query': '?token=TOKEN-SECRET',
                'http.fragment': 'FRAGMENT-SECRET'
            }
        });
        Sentry.addBreadcrumb({ category: 'navigation', data: { from: '/?id_token=ID-SECRET', to: '/#code=FRAGMENT-SECRET' } });
        Sentry.captureException(new Error('boom'));

        expectNoSecrets(await sentEnvelopes());
        const crumbs: Record<string, any>[] = sentItems('event')[0].breadcrumbs;
        expect(crumbs.find(crumb => crumb.category === 'fetch')?.data.url).toContain('git.example');
    });

    it('sends the pageload as a transaction without any secret from the page URL', async () => {
        startOnSecretUrl();
        finishPageload();

        expectNoSecrets(await sentEnvelopes());
        const transaction = sentTransaction();
        expect(transaction.contexts.trace.op).toBe('pageload');
        expect(transaction.contexts.trace.data['url.full']).toContain('/start');
    });

    it('scrubs the spans of real fetch calls', async () => {
        startOnSecretUrl();
        await fetch('https://service.example/api/ping?token=TOKEN-SECRET&keep=1#FRAGMENT-SECRET');
        finishPageload();

        expectNoSecrets(await sentEnvelopes());
        const spans: Record<string, any>[] = sentTransaction().spans;
        const fetchSpan = spans.find(span => span.op === 'http.client');
        expect(fetchSpan?.data['url.full']).toContain('service.example/api/ping');
    });

    it('scrubs a navigation that happens after startup', async () => {
        startOnSecretUrl();
        window.history.pushState({}, '', '/next?artemisToken=ARTEMIS-SECRET#code=FRAGMENT-SECRET');
        finishPageload();
        Sentry.captureException(new Error('after navigation'));

        expectNoSecrets(await sentEnvelopes());
        expect(sentTransaction()).toBeDefined();
        expect(sentItems('event')[0].breadcrumbs.some((crumb: Record<string, any>) => crumb.category === 'navigation')).toBe(true);
    });

    it('scrubs every URL attribute and description on a span', async () => {
        startOnSecretUrl();
        const secretUrl = 'https://student:GIT-CREDENTIAL@git.example/repo?token=TOKEN-SECRET&keep=1#FRAGMENT-SECRET';
        Sentry.startInactiveSpan({
            name: `GET ${secretUrl}`,
            attributes: {
                'http.url': secretUrl,
                'url.full': secretUrl,
                url: secretUrl,
                'http.query': '?access_token=ACCESS-SECRET&keep=1',
                'url.query': 'id_token=ID-SECRET&keep=1',
                'http.fragment': 'FRAGMENT-SECRET',
                'url.fragment': 'FRAGMENT-SECRET'
            }
        }).end();
        finishPageload();

        expectNoSecrets(await sentEnvelopes());

        const spans: Record<string, any>[] = sentTransaction().spans;
        const span = spans.find(candidate => candidate.data['http.query']);
        expect(span?.description).toBe('GET https://git.example/repo?token=%5BFiltered%5D&keep=1');
        expect(span?.data['http.query']).toBe('?access_token=%5BFiltered%5D&keep=1');
        expect(span?.data['url.query']).toBe('id_token=%5BFiltered%5D&keep=1');
    });

    // Keycloak rewrites the URL when it strips its callback fragment, which records a navigation.
    it('keeps personal data from the query out of navigation breadcrumbs', async () => {
        startOnSecretUrl();
        window.history.replaceState({}, '', '/start?gitUser=ada&gitMail=ada@example.org&user=ada');
        Sentry.captureException(new Error('boom'));

        expect(await sentEnvelopes()).not.toContain('ada@example.org');
        expect(sentItems('event')[0].breadcrumbs.some((crumb: Record<string, any>) => crumb.category === 'navigation')).toBe(true);
    });

    it('scrubs URL attributes set on the pageload span itself', async () => {
        startOnSecretUrl();
        const active = Sentry.getActiveSpan();
        if (active) {
            Sentry.getRootSpan(active).setAttributes({
                'http.query': '?artemisToken=ARTEMIS-SECRET',
                'http.fragment': 'FRAGMENT-SECRET'
            });
        }
        finishPageload();

        expectNoSecrets(await sentEnvelopes());
        expect(sentTransaction().contexts.trace.data['http.query']).toBe('?artemisToken=%5BFiltered%5D');
    });
});
