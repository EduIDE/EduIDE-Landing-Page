// Env-driven config for the landing backend.
// Mirror the getPort() pattern used in EduIDE-data-bridge/src/app.ts.

function getPort(): number {
    const raw = process.env.LANDING_BACKEND_PORT ?? process.env.PORT;
    if (raw) {
        const n = parseInt(raw, 10);
        if (!isNaN(n) && n >= 1 && n <= 65535) {
            return n;
        }
    }
    return 8090;
}

function getCookieMaxAge(): number {
    const raw = process.env.COOKIE_MAX_AGE;
    if (raw) {
        const n = parseInt(raw, 10);
        if (!isNaN(n) && n > 0) {
            return n;
        }
    }
    // 10 minutes - enough time to authenticate with Keycloak and return to the SPA
    return 600;
}

export const config = {
    isProd: process.env.NODE_ENV === "production",
    port: getPort(),
    // Where to redirect the browser after storing the cookie.
    // Set to the public URL of the landing page (e.g. "https://eduidec.example.com/").
    // Defaults to "/" which works when both the backend and the SPA are served from
    // the same host via path-based ingress routing.
    landingPageUrl: process.env.LANDING_PAGE_URL ?? "/",
    // Cookie configuration
    cookieName: process.env.COOKIE_NAME ?? "eduide_launch",
    // Set to false only in local dev (HTTP). Always true in production (HTTPS).
    cookieSecure: (process.env.COOKIE_SECURE ?? "true") !== "false",
    // Optional. Only needed when the backend and SPA are on different subdomains.
    cookieDomain: process.env.COOKIE_DOMAIN,
    cookieMaxAge: getCookieMaxAge(),
};
