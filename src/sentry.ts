import { getTheiaCloudConfig } from '@eclipse-theiacloud/common';
import * as Sentry from '@sentry/react';

import type { ExtendedTheiaCloudConfig } from './common-extensions/types';

const DEFAULT_TRACES_SAMPLE_RATE = 0.2;

// Query parameters that may carry secrets (credentials, tokens) and must never
// leave the browser inside a Sentry event. gitUri can embed `user:token@host`,
// and artemisToken is a bearer token.
const SENSITIVE_QUERY_PARAMS = ['gitUri', 'artemisToken', 'token', 'access_token', 'id_token', 'code'];
const REDACTED = '[Filtered]';

export function initializeSentry(): void {
    const config = getTheiaCloudConfig() as ExtendedTheiaCloudConfig | undefined;

    if (config?.sentryEnable !== true) {
        return;
    }

    const dsn = config.sentryDsn?.trim();
    if (!dsn) {
        console.warn('Sentry stays disabled: sentryEnable is set, but sentryDsn is missing.');
        return;
    }

    const tracePropagationTargets = getTracePropagationTargets(config.serviceUrl);
    const configuredSampleRate = config.sentryTracesSampleRate;
    const tracesSampleRate =
        typeof configuredSampleRate === 'number' &&
        Number.isFinite(configuredSampleRate) &&
        configuredSampleRate >= 0 &&
        configuredSampleRate <= 1
            ? configuredSampleRate
            : DEFAULT_TRACES_SAMPLE_RATE;

    Sentry.init({
        dsn,
        environment: config.sentryEnvironment,
        // Console messages can hold usernames, so they stay out of breadcrumbs.
        integrations: defaults => [...defaults.filter(integration => integration.name !== 'Console'), Sentry.browserTracingIntegration()],
        tracePropagationTargets,
        // Sentry 11 replaced sendDefaultPii, and collects all of these unless told not to.
        dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
        tracesSampleRate,
        // Sentry 11 streams spans by default, and a streamed span never reaches
        // beforeSendTransaction, so the page URL would go out unscrubbed.
        traceLifecycle: 'static',
        beforeSend: scrubEvent,
        // `TransactionEvent` is not re-exported by @sentry/react, so the handler
        // works on the `Event` supertype and is cast back for the option slot.
        beforeSendTransaction: event => scrubTransaction(event) as typeof event
    });
}

// Remove embedded credentials and the fragment, and redact sensitive query
// parameters from a URL string. Keycloak returns its authorization code in the
// fragment, and Sentry starts before Keycloak has processed that callback. Returns the input unchanged if it cannot be parsed as a URL.
function scrubUrl(value: string): string {
    try {
        const url = new URL(value, window.location.origin);
        if (url.username || url.password) {
            url.username = '';
            url.password = '';
        }
        url.hash = '';
        for (const key of SENSITIVE_QUERY_PARAMS) {
            if (url.searchParams.has(key)) {
                url.searchParams.set(key, REDACTED);
            }
        }
        return url.toString();
    } catch {
        return value;
    }
}

function scrubEvent<T extends Sentry.Event>(event: T): T {
    if (event.request?.url) {
        event.request.url = scrubUrl(event.request.url);
    }
    if (event.request?.query_string) {
        event.request.query_string = REDACTED;
    }
    // Sentry copies document.referrer here, and it can be a secret-bearing URL.
    if (event.request?.headers) {
        delete event.request.headers.Referer;
    }
    if (event.breadcrumbs) {
        for (const crumb of event.breadcrumbs) {
            const data = crumb.data;
            if (!data) {
                continue;
            }
            for (const key of ['to', 'from']) {
                if (typeof data[key] === 'string') {
                    data[key] = scrubUrl(data[key] as string);
                }
            }
            scrubUrlAttributes(data);
        }
    }
    return event;
}

function scrubUrlAttributes(data: Record<string, unknown>): void {
    for (const key of ['http.url', 'url.full', 'url']) {
        if (typeof data[key] === 'string') {
            data[key] = scrubUrl(data[key] as string);
        }
    }
    // Sentry 11 reports these as url.*, older versions as http.*.
    delete data['http.fragment'];
    delete data['url.fragment'];
    for (const key of ['http.query', 'url.query']) {
        if (typeof data[key] === 'string') {
            data[key] = scrubQuery(data[key] as string);
        }
    }
}

function scrubTransaction(event: Sentry.Event): Sentry.Event {
    scrubEvent(event);

    // The pageload span's attributes end up here, including the full page URL.
    const traceData = event.contexts?.trace?.data;
    if (traceData) {
        scrubUrlAttributes(traceData);
    }

    // Transaction names from browser tracing are URLs; drop any query string and
    // fragment so a secret never becomes the transaction identity.
    if (typeof event.transaction === 'string') {
        event.transaction = event.transaction.split(/[?#]/)[0];
    }

    if (event.spans) {
        for (const span of event.spans) {
            const data = span.data as Record<string, unknown> | undefined;
            if (data) {
                scrubUrlAttributes(data);
            }
            // Descriptions look like `GET https://host/path?query`, so scrub only the URL part.
            if (typeof span.description === 'string') {
                span.description = span.description.replace(/\S*[?#@]\S*/g, scrubUrl);
            }
        }
    }
    return event;
}

// Redact sensitive parameters from a query string. Browser tracing stores the
// query on its own span attribute (`http.query`), including the leading `?`.
function scrubQuery(value: string): string {
    const prefix = value.startsWith('?') ? '?' : '';
    const params = new URLSearchParams(value.slice(prefix.length));
    for (const key of SENSITIVE_QUERY_PARAMS) {
        if (params.has(key)) {
            params.set(key, REDACTED);
        }
    }
    return prefix + params.toString();
}

function getTracePropagationTargets(serviceUrl: string): (string | RegExp)[] {
    const normalizedServiceUrl = serviceUrl.replace(/\/+$/, '');

    try {
        const url = new URL(normalizedServiceUrl, window.location.href);
        return [new RegExp(`^${escapeRegExp(url.origin + url.pathname)}(?:/|$)`)];
    } catch {
        return [normalizedServiceUrl];
    }
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
