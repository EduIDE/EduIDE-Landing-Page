// What the last session in this tab was launched with, so /session-ended can start it again.
//
// sessionStorage, not localStorage: gitUri can carry credentials and artemisToken is a bearer token.
// The value only has to survive the redirect back to this origin in the same tab, and sessionStorage
// dies with the tab instead of leaving a Git credential on disk.

const STORAGE_KEY = 'eduide.lastLaunch.v1';

// Past this the Artemis token is likely stale, so starting fresh is the better offer.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface LaunchInputs {
    gitUri?: string;
    gitUser?: string;
    gitMail?: string;
    artemisUrl?: string;
    artemisToken?: string;
    // Only without Keycloak: the random anonymous user feeds the workspace name.
    anonymousUser?: string;
}

export interface LastLaunch extends LaunchInputs {
    appDefinition: string;
    buildSystemId?: string;
    // An ephemeral session had no volume, so there is nothing to resume.
    ephemeral: boolean;
    savedAt: number;
}

export function saveLastLaunch(launch: Omit<LastLaunch, 'savedAt'>): void {
    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...launch, savedAt: Date.now() }));
    } catch {
        // Storage can be blocked. /session-ended then offers a fresh start only.
    }
}

export function readLastLaunch(): LastLaunch | undefined {
    try {
        const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? 'null') as LastLaunch | undefined;
        if (!parsed?.appDefinition || typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > MAX_AGE_MS) {
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
