import { isTrustedArtemisLink } from '../launch';

/**
 * Checks and helpers for sessions opened from a git link (e.g. the "Open in EduIDE" browser extension), as opposed to
 * links from Artemis, which carry an artemisToken and the student's VCS credentials.
 */

/**
 * Why a git link that is not a trusted Artemis link must not be launched, or undefined if it may be. Such a link can
 * come from anywhere on the internet, so EduIDE only clones from known hosts (`allowedHosts` and the Artemis hosts in
 * `trustedHosts`) over HTTPS, and never accepts credentials in it.
 */
export function checkGitLaunchUri(gitUri: string, options: { allowedHosts?: string[]; trustedHosts?: string[] } = {}): string | undefined {
    if (!gitLinksEnabled(options.allowedHosts)) {
        return 'Opening repositories from a link is not enabled on this EduIDE.';
    }
    let url: URL;
    try {
        url = new URL(gitUri);
    } catch {
        return 'The repository link is not a valid URL.';
    }
    if (url.username || url.password) {
        return 'Repository links must not contain credentials. Remove them from the link; EduIDE opens public repositories only.';
    }
    if (url.protocol !== 'https:') {
        return 'Only HTTPS repository links can be opened.';
    }
    const allowed = [...(options.allowedHosts ?? []), ...(options.trustedHosts ?? [])]
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

/**
 * Links to repositories outside Artemis are an alpha feature, on only while `allowedGitHosts` lists a host. A config
 * without the key (a chart that predates it) counts as off, so its Artemis links keep working.
 */
export function gitLinksEnabled(allowedHosts: string[] | undefined): boolean {
    return (allowedHosts ?? []).some(host => host.trim());
}

/**
 * How the page treats a link with a gitUri. While git links are off, a link that is not a trusted Artemis link but
 * carries an artemisToken works as it did before git links (`legacy`: a click, every parameter passed on, no
 * GIT_SOURCE), so installations without trustedArtemisHosts keep their Artemis links. Once git links are on, only
 * trustedArtemisHosts makes a link an Artemis link, so a crafted link cannot pass as one by adding a token.
 */
export function gitLinkKind(
    link: { gitUri?: string; artemisUrl?: string; artemisToken?: string },
    config: { allowedGitHosts?: string[]; trustedArtemisHosts?: string[] }
): 'artemis' | 'external' | 'legacy' | undefined {
    const source = gitSourceOf(link.gitUri, link.artemisUrl, config.trustedArtemisHosts);
    if (source === 'external' && link.artemisToken && !gitLinksEnabled(config.allowedGitHosts)) {
        return 'legacy';
    }
    return source;
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

/** A branch, tag or commit for GIT_REF; anything that could be read as an option, a range or a control character is dropped. */
export function sanitizeGitRef(ref: string | undefined): string | undefined {
    const value = ref?.trim();
    // eslint-disable-next-line no-control-regex
    if (!value || value.length > 255 || value.startsWith('-') || /[\s~^:?*[\\\x00-\x1f\x7f]|\.\.|@\{/.test(value)) {
        return undefined;
    }
    return value;
}
