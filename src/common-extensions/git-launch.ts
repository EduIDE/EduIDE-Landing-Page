import { isTrustedArtemisLink } from '../launch';

/**
 * Checks and helpers for sessions opened from a git link (e.g. the "Open in EduIDE" browser extension), as opposed to
 * links from Artemis, which carry an artemisToken and the student's VCS credentials.
 */

/** Hosts a link that is not an Artemis link may clone from, unless `allowedGitHosts` is configured. */
export const DEFAULT_ALLOWED_GIT_HOSTS = ['github.com', 'gitlab.com'];

/**
 * Why a git link that is not a trusted Artemis link must not be launched, or undefined if it may be. Such a link can
 * come from anywhere on the internet, so EduIDE only clones from known hosts (`allowedHosts` and the Artemis hosts in
 * `trustedHosts`) over HTTPS, and never accepts credentials in it.
 */
export function checkGitLaunchUri(gitUri: string, options: { allowedHosts?: string[]; trustedHosts?: string[] } = {}): string | undefined {
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
    const allowed = [...(options.allowedHosts ?? DEFAULT_ALLOWED_GIT_HOSTS), ...(options.trustedHosts ?? [])]
        .map(host => host.trim().toLowerCase())
        .filter(Boolean);
    if (!allowed.includes(url.host.toLowerCase())) {
        return `Repositories from ${url.host} cannot be opened on this EduIDE.`;
    }
    return undefined;
}

/** GIT_SOURCE: `artemis` for a trusted Artemis link, `external` for any other git link. The link never says so itself. */
export function gitSourceOf(
    gitUri: string | undefined,
    artemisUrl: string | undefined,
    trustedHosts: string[] | undefined
): 'artemis' | 'external' | undefined {
    if (!gitUri) {
        return undefined;
    }
    return isTrustedArtemisLink(gitUri, artemisUrl, trustedHosts) ? 'artemis' : 'external';
}

/** `owner/repo` (or `group/subgroup/repo`) for display, from a repository URL. */
export function repositoryName(gitUri: string | undefined): string | undefined {
    if (!gitUri) {
        return undefined;
    }
    try {
        const segments = new URL(gitUri).pathname
            .replace(/\.git\/?$/, '')
            .split('/')
            .filter(Boolean);
        return segments.length >= 2 ? segments.join('/') : undefined;
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
