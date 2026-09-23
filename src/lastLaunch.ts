/**
 * Remembers what the last session was launched with, so that a student whose session ended can be
 * put back into the same workspace.
 *
 * Deliberately sessionStorage, not localStorage. `gitUri` can carry credentials and `artemisToken`
 * is a bearer token, and this only has to survive one same-tab navigation: the gateway redirect
 * from the instance host back to here, plus any Keycloak round trip (which returns to the same
 * origin, so the tab's storage is intact). sessionStorage dies with the tab; localStorage would
 * leave a Git credential on disk indefinitely. Web Storage is partitioned by origin, so the
 * session host cannot read this either way.
 */

const STORAGE_KEY = 'eduide.lastLaunch.v1';

// Beyond this the tokens are stale and the student is better served by starting fresh.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface LaunchDescriptor {
    appDefinition: string;
    appName: string;
    buildSystemId?: string;
    gitUri?: string;
    gitUser?: string;
    gitMail?: string;
    artemisUrl?: string;
    artemisToken?: string;
    /** Ephemeral sessions have no volume, so there is nothing to resume into. */
    ephemeral: boolean;
    savedAt: number;
}

export function saveLastLaunch(descriptor: Omit<LaunchDescriptor, 'savedAt'>): void {
    try {
        const stored: LaunchDescriptor = { ...descriptor, savedAt: Date.now() };
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
        // Storage can be unavailable (private mode, blocked site data). Resume then degrades to
        // the normal app picker, which is a worse experience but not a broken one.
    }
}

export function readLastLaunch(): LaunchDescriptor | undefined {
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return undefined;
        }

        const parsed = JSON.parse(raw) as LaunchDescriptor;
        if (!parsed?.appDefinition || typeof parsed.savedAt !== 'number') {
            return undefined;
        }
        if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
            clearLastLaunch();
            return undefined;
        }

        return parsed;
    } catch {
        return undefined;
    }
}

export function clearLastLaunch(): void {
    try {
        window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // See saveLastLaunch.
    }
}

/**
 * How many times in a row we have resumed without the student doing anything themselves.
 *
 * Two automatic resumes with no interaction between them means nobody is at the keyboard: the
 * session we started went idle and timed out again. At that point we stop and wait for a click,
 * so a tab left open on an unattended screen cannot cycle pods indefinitely. The oauth2-proxy
 * error page uses the same counter trick for its retry loop.
 */
const AUTO_RESUME_COUNT_KEY = 'eduide.autoResumeCount.v1';

export const MAX_CONSECUTIVE_AUTO_RESUMES = 2;

export function readAutoResumeCount(): number {
    try {
        const parsed = Number.parseInt(window.sessionStorage.getItem(AUTO_RESUME_COUNT_KEY) ?? '0', 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    } catch {
        return 0;
    }
}

export function recordAutoResume(): void {
    try {
        window.sessionStorage.setItem(AUTO_RESUME_COUNT_KEY, String(readAutoResumeCount() + 1));
    } catch {
        // See saveLastLaunch.
    }
}

/** Called whenever the student acts deliberately - a click, or cancelling the countdown. */
export function resetAutoResumeCount(): void {
    try {
        window.sessionStorage.removeItem(AUTO_RESUME_COUNT_KEY);
    } catch {
        // See saveLastLaunch.
    }
}
