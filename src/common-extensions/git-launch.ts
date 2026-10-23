/**
 * Checks and helpers for sessions opened from a git link (e.g. the "Open in EduIDE" browser extension), as opposed to
 * links from Artemis, which carry an artemisToken and the student's VCS credentials.
 */

/** Hosts a link without an Artemis token may clone from, unless `allowedGitHosts` is configured. */
export const DEFAULT_ALLOWED_GIT_HOSTS = ['github.com'];

/**
 * Why a git link without an Artemis token must not be launched, or undefined if it may be. Such a link can come from
 * anywhere on the internet, so EduIDE only clones from known hosts, over HTTPS, and never accepts credentials in it.
 */
export function checkGitLaunchUri(gitUri: string, allowedHosts: string[] = DEFAULT_ALLOWED_GIT_HOSTS): string | undefined {
    let url: URL;
    try {
        url = new URL(gitUri);
    } catch {
        return 'The repository link is not a valid URL.';
    }
    if (url.username || url.password) {
        return 'Repository links must not contain credentials. Open the repository without them; EduIDE asks you to sign in when needed.';
    }
    if (url.protocol !== 'https:') {
        return 'Only HTTPS repository links can be opened.';
    }
    const allowed = allowedHosts.map(host => host.trim().toLowerCase()).filter(Boolean);
    if (!allowed.includes(url.host.toLowerCase())) {
        return `Repositories from ${url.host} cannot be opened on this EduIDE.`;
    }
    return undefined;
}

/** `owner/repo` for display, from a repository URL. */
export function repositoryName(gitUri: string | undefined): string | undefined {
    if (!gitUri) {
        return undefined;
    }
    try {
        const segments = new URL(gitUri).pathname
            .replace(/\.git\/?$/, '')
            .split('/')
            .filter(Boolean);
        return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : undefined;
    } catch {
        return undefined;
    }
}

/** A branch, tag or commit for GIT_REF; anything that could be read as an option or a range is dropped. */
export function sanitizeGitRef(ref: string | undefined): string | undefined {
    const value = ref?.trim();
    if (!value || value.length > 255 || value.startsWith('-') || /[\s~^:?*[\\]|\.\.|@\{/.test(value)) {
        return undefined;
    }
    return value;
}

/** GIT_SOURCE: where the link came from, as Scorpio understands it. */
export function sanitizeGitSource(source: string | undefined): 'artemis' | 'github' | 'other' | undefined {
    const value = source?.trim().toLowerCase();
    return value === 'artemis' || value === 'github' || value === 'other' ? value : undefined;
}

/**
 * Per-installation variables added to every session (`landingPage.sessionEnv` in the chart), e.g. Scorpio's
 * SCORPIO_GITHUB_CLIENT_ID. Only string values with environment-variable names are passed on.
 */
export function sessionEnvFromConfig(sessionEnv: unknown): Record<string, string> {
    const env: Record<string, string> = {};
    if (!sessionEnv || typeof sessionEnv !== 'object') {
        return env;
    }
    for (const [key, value] of Object.entries(sessionEnv as Record<string, unknown>)) {
        if (/^[A-Z_][A-Z0-9_]*$/.test(key) && typeof value === 'string') {
            env[key] = value;
        }
    }
    return env;
}
