const WORKSPACE_SEGMENT_LIMIT = 12;
const LAUNCH_RETRIES = 4;
const GATEWAY_ERRORS = [502, 503, 504];
const NO_RESPONSE_CODES = ['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'];

function createDeterministicId(value: string): string {
    let hash = 0;

    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }

    return Math.abs(hash).toString(16).padStart(8, '0');
}

function sanitizeWorkspaceSegment(value: string | undefined, fallback: string): string {
    const sanitized = (value ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');

    const normalized = sanitized.length > 0 ? sanitized : fallback;
    return normalized.substring(0, Math.min(normalized.length, WORKSPACE_SEGMENT_LIMIT));
}

export function createAnonymousUser(): string {
    const random = Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => byte.toString(16).padStart(2, '0')).join('');
    return `anonymous-${random}`;
}

// The user and the full app key go into the hash because their segments are cut off at 12 characters.
export function createWorkspaceName(
    appDefinition: string,
    buildSystemId: string | undefined,
    workspaceUser: string | undefined,
    gitUri: string | undefined
): string {
    // Fold the selected build system (template) into the workspace identity so
    // that, e.g., the Bazel and Make variants of the same app definition get
    // separate persistent workspaces instead of sharing (and merging) one.
    const appKey = buildSystemId ? `${appDefinition}-${buildSystemId}` : appDefinition;
    const appSegment = sanitizeWorkspaceSegment(appKey, 'app');
    const userSegment = sanitizeWorkspaceSegment(workspaceUser, 'user');

    if (!gitUri) {
        return `ws-${appSegment}-playground-${userSegment}-${createDeterministicId(`${workspaceUser}-${appKey}-playground`)}`;
    }

    const repoName = gitUri
        .split('/')
        .pop()
        ?.replace(/\.git$/, '');
    const repoSegment = sanitizeWorkspaceSegment(repoName, 'repo');
    return `ws-${appSegment}-${repoSegment}-${userSegment}-${createDeterministicId(`${workspaceUser}-${appKey}-${gitUri}`)}`;
}

export function createLaunchEnv(link: {
    artemisToken?: string;
    artemisUrl?: string;
    gitUri?: string;
    gitRef?: string;
    gitSource?: string;
    gitUser?: string;
    gitMail?: string;
    buildSystemId?: string;
    sessionEnv?: Record<string, string>;
}): Record<string, string> {
    // Installation-wide variables first, so a launch's own values win.
    const env: Record<string, string> = { ...link.sessionEnv, THEIA: 'true' };
    if (link.artemisToken) {
        env.ARTEMIS_TOKEN = link.artemisToken;
    }
    if (link.artemisUrl) {
        env.ARTEMIS_URL = link.artemisUrl;
    }
    if (link.gitUri) {
        env.GIT_URI = link.gitUri;
    }
    if (link.gitUser) {
        env.GIT_USER = link.gitUser;
    }
    if (link.gitMail) {
        env.GIT_MAIL = link.gitMail;
    }
    if (link.gitRef) {
        env.GIT_REF = link.gitRef;
    }
    if (link.gitSource) {
        env.GIT_SOURCE = link.gitSource;
    }
    if (link.buildSystemId) {
        env.TEMPLATE = link.buildSystemId;
    }
    return env;
}

export function getHostname(url: string | undefined): string | undefined {
    try {
        return url ? new URL(url).hostname.toLowerCase() : undefined;
    } catch {
        return undefined;
    }
}

export function isTrustedArtemisLink(gitUri: string, artemisUrl: string | undefined, trustedHosts: string[] = []): boolean {
    const trusted = trustedHosts.map(host => host.trim().toLowerCase());
    return [gitUri, artemisUrl].every(url => {
        const hostname = getHostname(url);
        return hostname !== undefined && trusted.includes(hostname);
    });
}

function isGatewayOrTimeoutError(err: unknown): boolean {
    const { status, originalError } = err as { status?: number; originalError?: { code?: string } };
    return GATEWAY_ERRORS.includes(status as number) || NO_RESPONSE_CODES.includes(originalError?.code as string);
}

// A slow start outlasts the gateway's timeout while the service keeps working, so a later
// request picks up the running session. Every other error is final. The random wait stops
// a whole lecture from retrying in step.
export async function launchWithRetry<T>(
    launch: () => Promise<T>,
    wait: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 7000))
): Promise<T> {
    for (let retriesLeft = LAUNCH_RETRIES; ; retriesLeft -= 1) {
        try {
            return await launch();
        } catch (err) {
            if (retriesLeft === 0 || !isGatewayOrTimeoutError(err)) {
                throw err;
            }
            await wait();
        }
    }
}
