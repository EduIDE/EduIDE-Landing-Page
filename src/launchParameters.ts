// Helpers for reading and clearing the launch cookie set by the landing backend.
// The cookie carries the structured launch payload posted by Artemis, allowing
// secrets to travel via a secure POST body + cookie rather than the URL query string.
//
// Backward compatibility: when the cookie is absent the SPA falls back to reading
// the legacy URL query parameters, so existing deep-links keep working unchanged.

const COOKIE_NAME = "eduide_launch";

// Git-section field names - mirrors backend/src/schema.ts GIT_FIELD_NAMES.
export const GIT_FIELD_NAMES = new Set(["gitUri", "gitUser", "gitMail", "gitToken"]);

// Shape of the cookie value - matches the backend's LaunchPayload type.
interface LaunchCookie {
    git?: Record<string, string>;
    parameters?: Record<string, string>;
}

// Read and parse the launch cookie.
// Returns undefined if the cookie is absent, expired, or malformed.
export function readLaunchCookie(): LaunchCookie | undefined {
    try {
        const match = document.cookie
            .split("; ")
            .find((row) => row.startsWith(`${COOKIE_NAME}=`));
        if (!match) return undefined;

        const encoded = match.slice(COOKIE_NAME.length + 1);
        return JSON.parse(decodeURIComponent(encoded)) as LaunchCookie;
    } catch {
        // Malformed cookie - treat as absent
        return undefined;
    }
}

// Delete the launch cookie.
// Called once the session launch has been initiated so the credentials are not
// left in the browser beyond their useful life.
export function clearLaunchCookie(): void {
    const base = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
    // Host-only deletion (covers the common case where COOKIE_DOMAIN is unset).
    document.cookie = base;
    // If the backend was configured with COOKIE_DOMAIN (e.g. ".example.com" to share
    // the cookie across subdomains), the host-only deletion above won't remove it.
    // Also attempt deletion scoped to the inferred parent domain to cover that case.
    const parts = document.location.hostname.split(".");
    if (parts.length >= 2) {
        const rootDomain = parts.slice(-2).join(".");
        document.cookie = `${base}; Domain=${rootDomain}`;
    }
}

// Return the value for a given key, preferring the cookie over the URL.
// Cookie git section is checked before cookie parameters; the URL is the fallback.
// This is the single call-site for every param the app currently reads via
// URLSearchParams, ensuring backward compatibility with legacy deep-links.
export function resolveLaunchValue(
    key: string,
    cookieMap: Record<string, string>,
    urlParams: URLSearchParams,
): string | null {
    if (Object.prototype.hasOwnProperty.call(cookieMap, key)) {
        return cookieMap[key] ?? null;
    }
    return urlParams.get(key);
}
