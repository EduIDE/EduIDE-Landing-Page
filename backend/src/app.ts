import { Hono, type Context } from "hono";
import { setCookie } from "hono/cookie";
import { type } from "arktype";
import { GIT_FIELD_NAMES, launchPayloadSchema, type LaunchPayload } from "./schema.ts";
import { config } from "./config.ts";

// Simple console-based logger (no VSCode deps unlike the data-bridge logger).
const log = {
    info: (msg: string) => console.log(`[INFO]  [${new Date().toISOString()}] ${msg}`),
    warn: (msg: string) => console.warn(`[WARN]  [${new Date().toISOString()}] ${msg}`),
    error: (msg: string, err?: unknown) => {
        const detail = err instanceof Error ? `: ${err.message}` : err !== undefined ? `: ${String(err)}` : "";
        console.error(`[ERROR] [${new Date().toISOString()}] ${msg}${detail}`);
    },
    debug: (msg: string) => console.debug(`[DEBUG] [${new Date().toISOString()}] ${msg}`),
};

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

// Re-construct a LaunchPayload from a flat form submission where each field is
// either a known git key (gitUri, gitUser, gitMail, gitToken) or a parameter.
// This lets Artemis use plain <input type="hidden" name="gitUri" value="..."> fields
// without having to JSON-serialize anything.
function payloadFromFlatForm(fields: Record<string, string | string[]>): LaunchPayload {
    const git: Record<string, string> = Object.create(null) as Record<string, string>;
    const parameters: Record<string, string> = Object.create(null) as Record<string, string>;

    for (const [key, value] of Object.entries(fields)) {
        if (key === "payload" || DANGEROUS_KEYS.has(key)) continue;
        // parseBody({ all: true }) returns an array when a field appears more than once;
        // take the first occurrence and ignore duplicates.
        const scalar = Array.isArray(value) ? value[0] : value;
        if (scalar === undefined || scalar === "") continue;

        if (GIT_FIELD_NAMES.has(key)) {
            git[key] = scalar;
        } else {
            parameters[key] = scalar;
        }
    }

    // Spread rather than { git: ..., parameters: ... } so that empty sections are
    // absent from the object entirely, not present as undefined. JSON.stringify
    // would strip undefined either way, but arktype validates the object before
    // serialization and treats an absent key differently from an explicit undefined.
    return {
        ...(Object.keys(git).length > 0 ? { git } : {}),
        ...(Object.keys(parameters).length > 0 ? { parameters } : {}),
    };
}

// Parse the incoming request into a LaunchPayload regardless of Content-Type.
// Supports three transports:
//   1. application/json             - body is { git?, parameters? } directly
//   2. form with a "payload" field  - the field value is a JSON-encoded LaunchPayload
//   3. form with flat fields        - gitUri/gitUser/gitMail/gitToken → git section,
//                                     everything else → parameters section
async function parsePayload(c: Context): Promise<LaunchPayload | { error: string }> {
    const contentType = c.req.header("content-type") ?? "";

    if (contentType.includes("application/json")) {
        try {
            return (await c.req.json()) as LaunchPayload;
        } catch {
            return { error: "Invalid JSON body" };
        }
    }

    // Form submission (application/x-www-form-urlencoded or multipart/form-data)
    let fields: Record<string, string | string[]>;
    try {
        // { all: true } collects repeated field names into arrays instead of
        // silently keeping only the last value — safe even if callers send
        // each field exactly once.
        fields = await c.req.parseBody({ all: true });
    } catch {
        return { error: "Could not parse form body" };
    }

    // Check for a pre-serialized "payload" field first (structured form approach)
    if (typeof fields["payload"] === "string" && fields["payload"]) {
        try {
            return JSON.parse(fields["payload"]) as LaunchPayload;
        } catch {
            return { error: 'The "payload" field is not valid JSON' };
        }
    }

    // Fall back to flat field reconstruction
    return payloadFromFlatForm(fields);
}

export function createApp(): Hono {
    const app = new Hono();

    // Request logging middleware (same pattern as data-bridge)
    app.use("*", async (c, next) => {
        const start = Date.now();
        await next();
        const duration = Date.now() - start;
        log.debug(`${c.req.method} ${c.req.path} ${c.res.status} (${duration}ms)`);
    });

    // POST / — receive credentials from Artemis, store in cookie, redirect to SPA
    app.post("/", async (c) => {
        const raw = await parsePayload(c);

        if ("error" in raw) {
            log.warn(`Bad request: ${raw.error}`);
            return c.json({ error: raw.error }, 400);
        }

        const parsed = launchPayloadSchema(raw);
        if (parsed instanceof type.errors) {
            log.warn(`Validation error: ${parsed.summary}`);
            return c.json({ error: parsed.summary }, 400);
        }

        const cookieValue = JSON.stringify(parsed);

        setCookie(c, config.cookieName, cookieValue, {
            path: "/",
            sameSite: "Lax",
            secure: config.cookieSecure,
            maxAge: config.cookieMaxAge,
            // httpOnly is intentionally omitted (defaults to false) so the SPA
            // can read the cookie via document.cookie.
            ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
        });

        log.info(`Launch cookie set; redirecting to ${config.landingPageUrl}`);
        // 303 See Other: the browser always follows with GET, regardless of the
        // original method - exactly what we want after a form POST.
        return c.redirect(config.landingPageUrl, 303);
    });

    // GET /health — readiness check (matches data-bridge convention)
    app.get("/health", (c) => c.text("OK", 200));

    // 404 handler
    app.notFound((c) => {
        log.warn(`404 - Not found: ${c.req.path}`);
        return c.json({ error: "Not found", path: c.req.path }, 404);
    });

    // Error handler
    app.onError((err, c) => {
        log.error("Internal server error", err);
        const body = config.isProd
            ? { error: "Internal server error" }
            : { error: "Internal server error", message: err.message };
        return c.json(body, 500);
    });

    return app;
}
