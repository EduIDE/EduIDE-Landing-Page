import { getTheiaCloudConfig } from '@eclipse-theiacloud/common';
import * as Sentry from '@sentry/react';

import type { ExtendedTheiaCloudConfig } from './common-extensions/types';

const DEFAULT_SENTRY_DSN = 'https://a3851baf2ece0c6bec13e1c99fd3111f@sentry.aet.cit.tum.de/13';

export function initializeSentry(): void {
  const config = getTheiaCloudConfig() as ExtendedTheiaCloudConfig | undefined;

  if (!config?.sentryEnable) {
    return;
  }

  const dsn = config.sentryDsn?.trim() || DEFAULT_SENTRY_DSN;
  const tracePropagationTargets = getTracePropagationTargets(config.serviceUrl);

  Sentry.init({
    dsn,
    environment: config.sentryEnvironment,
    integrations: [Sentry.browserTracingIntegration()],
    tracePropagationTargets,
    sendDefaultPii: false,
    tracesSampleRate: 1.0
  });
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
