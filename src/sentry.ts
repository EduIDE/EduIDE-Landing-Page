import { getTheiaCloudConfig } from '@eclipse-theiacloud/common';
import * as Sentry from '@sentry/react';

import type { ExtendedTheiaCloudConfig } from './common-extensions/types';

const DEFAULT_SENTRY_DSN = 'https://a3851baf2ece0c6bec13e1c99fd3111f@sentry.aet.cit.tum.de/13';
const DEFAULT_TRACES_SAMPLE_RATE = 0.2;

// Query parameters that may carry secrets (credentials, tokens) and must never
// leave the browser inside a Sentry event. gitUri can embed `user:token@host`,
// and artemisToken is a bearer token.
const SENSITIVE_QUERY_PARAMS = ['gitUri', 'artemisToken', 'token', 'access_token', 'id_token', 'code'];
const REDACTED = '[Filtered]';

export function initializeSentry(): void {
    const config = getTheiaCloudConfig() as ExtendedTheiaCloudConfig | undefined;

    if (!config?.sentryEnable) {
        return;
    }

    const dsn = config.sentryDsn?.trim() || DEFAULT_SENTRY_DSN;
    const tracePropagationTargets = getTracePropagationTargets(config.serviceUrl);
    const tracesSampleRate = typeof config.sentryTracesSampleRate === 'number' ? config.sentryTracesSampleRate : DEFAULT_TRACES_SAMPLE_RATE;

    Sentry.init({
        dsn,
        environment: config.sentryEnvironment,
        integrations: [Sentry.browserTracingIntegration()],
        tracePropagationTargets,
        sendDefaultPii: false,
        tracesSampleRate,
        beforeSend: scrubEvent,
        // `TransactionEvent` is not re-exported by @sentry/react, so the handler
        // works on the `Event` supertype and is cast back for the option slot.
        beforeSendTransaction: event => scrubTransaction(event) as typeof event
    });
}

// Remove embedded credentials and redact sensitive query parameters from a URL
// string. Returns the input unchanged if it cannot be parsed as a URL.
function scrubUrl(value: string): string {
    try {
        const url = new URL(value, window.location.origin);
        if (url.username || url.password) {
            url.username = '';
            url.password = '';
        }
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
    if (event.breadcrumbs) {
        for (const crumb of event.breadcrumbs) {
            const data = crumb.data;
            if (!data) {
                continue;
            }
            for (const key of ['url', 'to', 'from']) {
                if (typeof data[key] === 'string') {
                    data[key] = scrubUrl(data[key] as string);
                }
            }
        }
    }
    return event;
}

function scrubTransaction(event: Sentry.Event): Sentry.Event {
    scrubEvent(event);

    // Transaction names from browser tracing are URLs; drop any query string so
    // a secret-bearing parameter never becomes the transaction identity.
    if (typeof event.transaction === 'string') {
        event.transaction = event.transaction.split('?')[0];
    }

    if (event.spans) {
        for (const span of event.spans) {
            const data = span.data as Record<string, unknown> | undefined;
            if (data && typeof data['http.url'] === 'string') {
                data['http.url'] = scrubUrl(data['http.url'] as string);
            }
            if (typeof span.description === 'string' && span.description.includes('?')) {
                span.description = scrubUrl(span.description);
            }
        }
    }
    return event;
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
