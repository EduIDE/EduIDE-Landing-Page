import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const theia = vi.hoisted(() => ({ ping: vi.fn(), launchAndRedirect: vi.fn() }));
const keycloak = vi.hoisted(() => ({
    constructed: [] as unknown[],
    init: vi.fn(),
    login: vi.fn(),
    updateToken: vi.fn(),
    idToken: undefined as string | undefined,
    idTokenParsed: undefined as Record<string, string> | undefined
}));

vi.mock('@eclipse-theiacloud/common', async importOriginal => ({
    ...(await importOriginal<typeof import('@eclipse-theiacloud/common')>()),
    TheiaCloud: theia
}));

vi.mock('keycloak-js', () => ({
    default: class {
        init = keycloak.init;
        login = keycloak.login;
        updateToken = keycloak.updateToken;
        idToken = keycloak.idToken;
        idTokenParsed = keycloak.idTokenParsed;
        createLogoutUrl = (): string => 'https://keycloak.example/logout';
        constructor(config: unknown) {
            keycloak.constructed.push(config);
        }
    }
}));

const JAVA = { serviceAuthToken: 'java-17', appName: 'Java 17' };
const C_MULTI = {
    serviceAuthToken: 'c-lang',
    appName: 'C',
    buildSystems: [
        { id: 'make', label: 'Make' },
        { id: 'bazel', label: 'Bazel' }
    ]
};
const RUST_SINGLE = { serviceAuthToken: 'rust', appName: 'Rust', buildSystems: [{ id: 'cargo', label: 'Cargo' }] };
const HIDDEN = { serviceAuthToken: 'hidden-app', appName: 'Hidden', visible: false };

const BASE_CONFIG = {
    serviceAuthToken: 'service-token',
    appName: 'Default App',
    serviceUrl: 'https://service.example',
    appDefinition: 'default-app',
    useKeycloak: false,
    useEphemeralStorage: true,
    trustedArtemisHosts: ['git.example'],
    additionalApps: [JAVA, C_MULTI, RUST_SINGLE, HIDDEN]
};
const KEYCLOAK_CONFIG = {
    ...BASE_CONFIG,
    useKeycloak: true,
    keycloakAuthUrl: 'https://keycloak.example/auth',
    keycloakRealm: 'realm',
    keycloakClientId: 'client'
};

const LOADING_TEXT = /hang in tight/;
const GIT_URI = 'https://student:SECRET@git.example/org/my-repo.git';
const TRUSTED_URL = 'https://git.example';

// App.tsx keeps one-time init state at module level, so each test needs a fresh copy of it.
async function mountApp(): Promise<void> {
    vi.resetModules();
    const { default: App } = await import('./App');
    const { ThemeProvider } = await import('./contexts/ThemeContext');
    await act(async () => {
        render(
            <StrictMode>
                <ThemeProvider>
                    <App />
                </ThemeProvider>
            </StrictMode>
        );
    });
}

async function renderApp(url = '/', config: unknown = BASE_CONFIG): Promise<void> {
    window.history.pushState({}, '', url);
    vi.stubGlobal('theiaCloudConfig', config);
    await mountApp();
}

function query(params: Record<string, string>): string {
    return `/?${new URLSearchParams(params)}`;
}

async function launchCount(expected: number): Promise<void> {
    await waitFor(() => expect(theia.launchAndRedirect).toHaveBeenCalledTimes(expected));
    await waitFor(() => expect(screen.queryByText(LOADING_TEXT)).toBeNull());
}

async function selectApp(id: string, launches = 1): Promise<void> {
    fireEvent.click(screen.getByTestId(`launch-app-${id}`));
    await launchCount(launches);
}

function launchRequest(call = 0): Record<string, any> {
    return theia.launchAndRedirect.mock.calls[call][0];
}

async function renderAuthenticated(
    url = '/',
    parsedToken: Record<string, string> = { email: 'ada@example.org', preferred_username: 'ada' }
): Promise<void> {
    keycloak.idToken = 'id-token';
    keycloak.idTokenParsed = parsedToken;
    keycloak.init.mockResolvedValue(true);
    await renderApp(url, KEYCLOAK_CONFIG);
    await screen.findByText('Choose your programming language');
}

async function confirmUser(url: string, config: unknown = BASE_CONFIG): Promise<void> {
    await renderApp(url, config);
    fireEvent.click(screen.getByRole('button', { name: 'Continue as this user' }));
}

async function workspaceFor(url: string, config: unknown, appId = 'java-17'): Promise<string> {
    theia.launchAndRedirect.mockClear();
    await confirmUser(url, config);
    await selectApp(appId);
    const { workspaceName } = launchRequest();
    cleanup();
    return workspaceName;
}

beforeEach(() => {
    vi.clearAllMocks();
    theia.ping.mockReset().mockResolvedValue(true);
    theia.launchAndRedirect.mockReset().mockResolvedValue(undefined);
    keycloak.constructed.length = 0;
    keycloak.init.mockReset().mockResolvedValue(false);
    keycloak.updateToken.mockReset().mockResolvedValue(true);
    keycloak.idToken = undefined;
    keycloak.idTokenParsed = undefined;
    // VantaBackground polls for these CDN globals until they exist.
    vi.stubGlobal('VANTA', { BIRDS: () => undefined });
    vi.stubGlobal('THREE', {});
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('configuration', () => {
    const FATAL = 'FATAL: Theia Cloud configuration could not be found.';

    it('shows the fatal message when config.js is missing', async () => {
        await mountApp();
        screen.getByText(FATAL);
        expect(screen.queryByText('EduIDE Cloud')).toBeNull();
    });

    it.each(['appName', 'serviceUrl', 'appDefinition', 'useKeycloak', 'useEphemeralStorage'])(
        'shows the fatal message without %s',
        async key => {
            await renderApp('/', { ...BASE_CONFIG, [key]: undefined });
            screen.getByText(FATAL);
        }
    );

    it('shows the fatal message without serviceAuthToken and appId', async () => {
        await renderApp('/', { ...BASE_CONFIG, serviceAuthToken: undefined });
        screen.getByText(FATAL);
    });

    it('accepts the deprecated appId in place of serviceAuthToken', async () => {
        await renderApp('/', { ...BASE_CONFIG, serviceAuthToken: undefined, appId: 'legacy-token' });
        await selectApp('java-17');
        expect(launchRequest().appId).toBe('legacy-token');
    });

    it('uses the default title unless pageTitle is set', async () => {
        await renderApp();
        expect(document.title).toBe('EduIDE Cloud');
        cleanup();
        await renderApp('/', { ...BASE_CONFIG, pageTitle: 'Custom title' });
        expect(document.title).toBe('Custom title');
    });

    it('shows the info message from the config, and hides it with disableInfo', async () => {
        await renderApp('/', { ...BASE_CONFIG, infoTitle: 'Hello', infoText: 'Welcome' });
        screen.getByText('Hello');
        screen.getByText('Welcome');
        cleanup();
        await renderApp('/', { ...BASE_CONFIG, infoTitle: 'Hello', disableInfo: true });
        expect(screen.queryByText('Hello')).toBeNull();
    });

    it('mounts through main.tsx with Sentry off', async () => {
        window.history.pushState({}, '', '/');
        vi.stubGlobal('theiaCloudConfig', BASE_CONFIG);
        vi.resetModules();
        document.body.innerHTML = '<div id="root"></div>';
        await act(async () => {
            await import('./main');
        });
        await screen.findByText('Choose your programming language');
        // main.tsx offers no way to unmount, so just take it out of the document.
        document.body.innerHTML = '';
    });
});

describe('page routing', () => {
    it.each([
        ['/imprint', 'Imprint'],
        ['/privacy', 'Datenschutzerklärung / Privacy Policy']
    ])('opens %s directly', async (url, heading) => {
        await renderApp(url);
        screen.getByRole('heading', { level: 1, name: heading });
    });

    it('navigates from the footer and back without a reload', async () => {
        await renderApp();
        fireEvent.click(screen.getByRole('button', { name: 'Privacy' }));
        screen.getByRole('heading', { level: 1, name: 'Datenschutzerklärung / Privacy Policy' });
        expect(window.location.pathname).toBe('/privacy');

        fireEvent.click(screen.getByRole('button', { name: '← Back' }));
        screen.getByText('Choose your programming language');
        expect(window.location.pathname).toBe('/');
    });

    it('opens /imprint/ with a trailing slash', async () => {
        await renderApp('/imprint/');
        screen.getByRole('heading', { level: 1, name: 'Imprint' });
    });

    it('keeps the exercise link in the URL while reading the legal pages', async () => {
        const link = query({ gitUri: 'https://git.example/r.git' });
        await renderApp(link);
        fireEvent.click(screen.getByRole('button', { name: 'Privacy' }));
        fireEvent.click(screen.getByRole('button', { name: '← Back' }));
        expect(window.location.pathname + window.location.search).toBe(link);
    });

    it('follows browser back and forward', async () => {
        await renderApp();
        window.history.pushState({}, '', '/imprint');
        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'));
        });
        screen.getByRole('heading', { level: 1, name: 'Imprint' });
    });
});

describe('URL parameters', () => {
    it('passes every session parameter on as an environment variable', async () => {
        await renderApp(
            query({
                gitUri: GIT_URI,
                gitUser: 'ada',
                gitMail: 'ada@example.org',
                artemisUrl: TRUSTED_URL,
                artemisToken: 'artemis-secret',
                appDef: 'java-17'
            })
        );
        await launchCount(1);
        expect(launchRequest().env.fromMap).toEqual({
            THEIA: 'true',
            GIT_URI: GIT_URI,
            GIT_USER: 'ada',
            GIT_MAIL: 'ada@example.org',
            ARTEMIS_URL: TRUSTED_URL,
            ARTEMIS_TOKEN: 'artemis-secret'
        });
    });

    it('sends only THEIA without parameters', async () => {
        await renderApp();
        await selectApp('java-17');
        expect(launchRequest().env.fromMap).toEqual({ THEIA: 'true' });
    });

    it('auto-launches the selected appDef once when gitUri and artemisToken are both present', async () => {
        await renderApp(query({ appDef: 'java-17', gitUri: GIT_URI, artemisToken: 'token', artemisUrl: TRUSTED_URL }));
        await launchCount(1);
        expect(launchRequest().appDefinition).toBe('java-17');
        screen.getByText('Launch your Online IDE');
        screen.getByRole('button', { name: /Launch Java 17/ });
    });

    it('also reads the lower-case appdef', async () => {
        await renderApp(query({ appdef: 'java-17', gitUri: GIT_URI, artemisToken: 'token', artemisUrl: TRUSTED_URL }));
        await launchCount(1);
        expect(launchRequest().appDefinition).toBe('java-17');
    });

    it('auto-launches the default app definition without appDef', async () => {
        await renderApp(query({ gitUri: GIT_URI, artemisToken: 'token', artemisUrl: TRUSTED_URL }));
        await launchCount(1);
        expect(launchRequest().appDefinition).toBe('default-app');
    });

    it.each([[{ gitUri: GIT_URI }], [{ artemisToken: 'token' }], [{ appDef: 'java-17' }]])(
        'does not auto-launch with only %j',
        async params => {
            await renderApp(query(params));
            screen.getByText('Choose your programming language');
            expect(theia.ping).not.toHaveBeenCalled();
        }
    );

    it.each([
        ['the repository host is not trusted', { gitUri: 'https://evil.example/r.git', artemisUrl: TRUSTED_URL }],
        ['the Artemis host is not trusted', { gitUri: GIT_URI, artemisUrl: 'https://evil.example' }],
        ['the link has no Artemis URL', { gitUri: GIT_URI }]
    ])('waits for a click when %s', async (_, params) => {
        await renderApp(query({ appDef: 'java-17', artemisToken: 'token', ...params }));
        const launch = screen.getByRole('button', { name: /Launch Java 17/ });
        screen.getByText(/This link opens a repository from/);
        expect(theia.ping).not.toHaveBeenCalled();
        fireEvent.click(launch);
        await launchCount(1);
    });

    it('offers launching again after a failed auto-launch', async () => {
        theia.launchAndRedirect.mockRejectedValueOnce(new Error('launch failed'));
        await renderApp(query({ appDef: 'java-17', gitUri: GIT_URI, artemisToken: 'token', artemisUrl: TRUSTED_URL }));
        await launchCount(1);
        await screen.findByText('ERROR: launch failed');
        fireEvent.click(screen.getByRole('button', { name: /Launch Java 17/ }));
        await launchCount(2);
        expect(screen.queryByText('ERROR: launch failed')).toBeNull();
    });

    it('launches an app hidden from the list through appDef', async () => {
        await renderApp(query({ appDef: 'hidden-app', gitUri: GIT_URI, artemisToken: 'token', artemisUrl: TRUSTED_URL }));
        await launchCount(1);
        expect(launchRequest().appDefinition).toBe('hidden-app');
    });

    describe('default selection', () => {
        it('rejects an unknown appDef', async () => {
            await renderApp(query({ appDef: 'unknown' }));
            screen.getByText('ERROR: Invalid default selection value: unknown');
        });

        it('rejects an empty appDef', async () => {
            await renderApp('/?appDef=');
            screen.getByText(/Invalid default selection value/);
        });

        it('accepts the configured appDefinition even if it is not in the list', async () => {
            await renderApp(query({ appDef: 'default-app' }));
            expect(screen.queryByText(/Invalid default selection value/)).toBeNull();
        });

        it('accepts any appDef when no additional apps are configured', async () => {
            await renderApp(query({ appDef: 'anything', gitUri: GIT_URI, artemisToken: 'token', artemisUrl: TRUSTED_URL }), {
                ...BASE_CONFIG,
                additionalApps: []
            });
            await launchCount(1);
            expect(launchRequest().appDefinition).toBe('anything');
        });

        // Bug: isDefaultSelectionValueValid (App.tsx) checks serviceAuthToken only, while everything else also takes appId.
        it('accepts an appDef for an app configured with appId', async () => {
            await renderApp(query({ appDef: 'legacy' }), {
                ...BASE_CONFIG,
                additionalApps: [{ appId: 'legacy', appName: 'Legacy' }]
            });
            expect(screen.queryByText(/Invalid default selection value/)).toBeNull();
        });

        // Bug: the auto-start effect (App.tsx) ignores the validation error, launches the default app and clears the error.
        it('does not auto-launch something else after rejecting appDef', async () => {
            await renderApp(query({ appDef: 'unknown', gitUri: GIT_URI, artemisToken: 'token', artemisUrl: TRUSTED_URL }));
            await waitFor(() => expect(screen.queryByText(LOADING_TEXT)).toBeNull());
            expect(theia.launchAndRedirect).not.toHaveBeenCalled();
        });
    });
});

describe('authentication', () => {
    describe('with Keycloak', () => {
        it('checks the session silently, keeping the query string in the redirect URI', async () => {
            const url = query({ gitUri: GIT_URI, artemisToken: 'token', artemisUrl: TRUSTED_URL });
            await renderApp(url, KEYCLOAK_CONFIG);
            expect(keycloak.constructed).toEqual([{ url: 'https://keycloak.example/auth', realm: 'realm', clientId: 'client' }]);
            expect(keycloak.init).toHaveBeenCalledTimes(1);
            expect(keycloak.init).toHaveBeenCalledWith({
                onLoad: 'check-sso',
                redirectUri: window.location.href,
                checkLoginIframe: false
            });
            expect(window.location.href).toContain(url);
        });

        it('asks anonymous visitors to log in and does not auto-launch', async () => {
            await renderApp(query({ gitUri: GIT_URI, artemisToken: 'token', artemisUrl: TRUSTED_URL }), KEYCLOAK_CONFIG);
            screen.getByText('Login to use EduIDE');
            screen.getByTestId('loginButton');
            screen.getByText('Login & launch Session');
            expect(theia.ping).not.toHaveBeenCalled();
        });

        it('logs in on demand and keeps the query string through the round trip', async () => {
            const url = query({ gitUri: GIT_URI, artemisToken: 'token', artemisUrl: TRUSTED_URL });
            await renderApp(url, KEYCLOAK_CONFIG);
            await act(async () => {
                fireEvent.click(screen.getByTestId('loginButton'));
            });
            expect(keycloak.login).toHaveBeenCalledWith({ redirectUri: window.location.href });
            expect(window.location.href).toContain(url);
        });

        it('offers login from the header too', async () => {
            await renderApp('/', KEYCLOAK_CONFIG);
            await act(async () => {
                fireEvent.click(screen.getAllByRole('button', { name: 'Login' })[0]);
            });
            expect(keycloak.login).toHaveBeenCalledTimes(1);
        });

        it('shows the user after an interactive login that finds a session', async () => {
            await renderApp('/', KEYCLOAK_CONFIG);
            keycloak.idToken = 'id-token';
            keycloak.idTokenParsed = { email: 'ada@example.org', preferred_username: 'ada' };
            keycloak.init.mockResolvedValue(true);
            await act(async () => {
                fireEvent.click(screen.getByTestId('loginButton'));
            });
            await screen.findByText('ada@example.org');
            screen.getByTestId('logoutButton');
            expect(keycloak.login).not.toHaveBeenCalled();
        });

        it('reports a failed interactive login', async () => {
            await renderApp('/', KEYCLOAK_CONFIG);
            keycloak.init.mockRejectedValue(new Error('down'));
            await act(async () => {
                fireEvent.click(screen.getByTestId('loginButton'));
            });
            screen.getByText('ERROR: Authentication failed');
        });

        it('stays on the login view when the silent check fails', async () => {
            keycloak.init.mockRejectedValue(new Error('down'));
            await renderApp('/', KEYCLOAK_CONFIG);
            screen.getByText('Login to use EduIDE');
            expect(screen.queryByText(/ERROR/)).toBeNull();
        });

        it('launches as the verified user with the ID token', async () => {
            await renderAuthenticated();
            screen.getByText('ada@example.org');
            await selectApp('java-17');
            expect(launchRequest().user).toBe('ada@example.org');
            expect(theia.launchAndRedirect.mock.calls[0][1]).toEqual({ timeout: 60000, retries: 0, accessToken: 'id-token' });
        });

        it('names the workspace after the username, falling back to the email', async () => {
            await renderAuthenticated();
            await selectApp('rust');
            expect(launchRequest().workspaceName).toMatch(/^ws-rust-cargo-playground-ada-[0-9a-f]+$/);

            cleanup();
            theia.launchAndRedirect.mockClear();
            await renderAuthenticated('/', { email: 'ada@example.org' });
            await selectApp('rust');
            expect(launchRequest().workspaceName).toMatch(/^ws-rust-cargo-playground-ada-example-+[0-9a-f]+$/);
        });

        it('refreshes the token right before launching', async () => {
            await renderAuthenticated();
            await selectApp('java-17');
            expect(keycloak.updateToken).toHaveBeenCalledWith(30);
        });

        it('asks for a new login when the token cannot be refreshed', async () => {
            await renderAuthenticated();
            keycloak.updateToken.mockRejectedValue(new Error('session gone'));
            await selectApp('java-17').catch(() => undefined);
            await screen.findByText(/Your login has expired/);
            screen.getByTestId('loginButton');
            expect(theia.launchAndRedirect).not.toHaveBeenCalled();
        });

        it('ignores ?user= because the identity comes from the token', async () => {
            await renderAuthenticated(query({ user: 'victim' }));
            expect(screen.queryByText('Confirm your identity')).toBeNull();
            await selectApp('java-17');
            expect(launchRequest().user).toBe('ada@example.org');
        });

        it('auto-launches once the user is known', async () => {
            keycloak.idToken = 'id-token';
            keycloak.idTokenParsed = { email: 'ada@example.org', preferred_username: 'ada' };
            keycloak.init.mockResolvedValue(true);
            await renderApp(query({ appDef: 'java-17', gitUri: GIT_URI, artemisToken: 'token', artemisUrl: TRUSTED_URL }), KEYCLOAK_CONFIG);
            await launchCount(1);
            expect(launchRequest().user).toBe('ada@example.org');
        });

        // Bug: launchUser is `email!` (App.tsx), so without an email claim LaunchRequest invents a random user for every launch.
        it('launches as the username when the token has no email', async () => {
            await renderAuthenticated('/', { preferred_username: 'ada' });
            await selectApp('java-17');
            expect(launchRequest().user).toBe('ada');
        });
    });

    describe('without Keycloak', () => {
        it('invents an anonymous user and suppresses the Keycloak UI', async () => {
            await renderApp();
            expect(keycloak.constructed).toEqual([]);
            expect(screen.queryByRole('button', { name: 'Login' })).toBeNull();
            expect(screen.queryByTestId('logoutButton')).toBeNull();
            screen.getByText('Launch session');
            await selectApp('java-17');
            expect(launchRequest().user).toMatch(/^anonymous-[a-z0-9]+$/);
            expect(theia.launchAndRedirect.mock.calls[0][1].accessToken).toBeUndefined();
        });

        it('does not adopt ?user= until it is confirmed', async () => {
            await renderApp(query({ user: 'victim' }));
            screen.getByText('Confirm your identity');
            expect(screen.queryByTestId('launch-app-java-17')).toBeNull();

            fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'me' } });
            fireEvent.click(screen.getByRole('button', { name: 'Continue as this user' }));
            await selectApp('java-17');
            expect(launchRequest().user).toBe('me');
        });

        it('does not auto-launch until ?user= is confirmed', async () => {
            await renderApp(query({ user: 'victim', gitUri: GIT_URI, artemisToken: 'token', artemisUrl: TRUSTED_URL }));
            expect(theia.ping).not.toHaveBeenCalled();
            fireEvent.click(screen.getByRole('button', { name: 'Continue as this user' }));
            await launchCount(1);
            expect(launchRequest().user).toBe('victim');
        });

        it('treats a blank ?user= as absent', async () => {
            await renderApp('/?user=%20%20');
            await selectApp('java-17');
            expect(launchRequest().user).toMatch(/^anonymous-/);
        });
    });
});

describe('workspace naming', () => {
    const PERSISTENT = { ...BASE_CONFIG, useEphemeralStorage: false };
    const url = (user: string, gitUri?: string): string => query({ user, ...(gitUri ? { gitUri } : {}) });

    it('builds a playground name from app and user', async () => {
        expect(await workspaceFor(url('Ada'), PERSISTENT)).toMatch(/^ws-java-17-playground-ada-[0-9a-f]{8}$/);
    });

    it('builds a repository name from app, repository and user, without credentials', async () => {
        const name = await workspaceFor(url('ada', GIT_URI), PERSISTENT);
        expect(name).toMatch(/^ws-java-17-my-repo-ada-[0-9a-f]{8}$/);
        expect(name).not.toContain('secret');
    });

    it('falls back to a generic segment when the repository has no name', async () => {
        expect(await workspaceFor(url('ada', 'https://git.example/org/'), PERSISTENT)).toMatch(/^ws-java-17-repo-ada-/);
    });

    it('sanitizes and truncates segments to what Kubernetes accepts', async () => {
        const name = await workspaceFor(
            url('--Ada.Lovelace_of_London--'),
            {
                ...PERSISTENT,
                additionalApps: [{ serviceAuthToken: 'Very_Long.App-Definition', appName: 'Long' }]
            },
            'Very_Long.App-Definition'
        );
        expect(name).toMatch(/^ws-very-long-ap-playground-ada-lovelace-[0-9a-f]{8}$/);
    });

    it('is stable across launches', async () => {
        expect(await workspaceFor(url('ada'), PERSISTENT)).toBe(await workspaceFor(url('ada'), PERSISTENT));
    });

    it('differs per user and per app', async () => {
        const ada = await workspaceFor(url('ada'), PERSISTENT);
        expect(await workspaceFor(url('grace'), PERSISTENT)).not.toBe(ada);
        const withPython = { ...PERSISTENT, additionalApps: [JAVA, { serviceAuthToken: 'python', appName: 'Python' }] };
        expect(await workspaceFor(url('ada'), withPython, 'python')).not.toBe(ada);
    });

    it('tells apart users whose names only differ after the truncation in a playground', async () => {
        expect(await workspaceFor(url('alexandra-miller'), PERSISTENT)).not.toBe(await workspaceFor(url('alexandra-milner'), PERSISTENT));
    });

    // Bug: the repository workspace hash (App.tsx) covers only gitUri and the build system, unlike the playground one.
    // Two users sharing a 12 character prefix therefore get the same workspace for the same repository.
    it('tells apart users whose names only differ after the truncation for a repository', async () => {
        expect(await workspaceFor(url('alexandra-miller', GIT_URI), PERSISTENT)).not.toBe(
            await workspaceFor(url('alexandra-milner', GIT_URI), PERSISTENT)
        );
    });
});

describe('launching', () => {
    function rejection(status: number, extra: Record<string, unknown> = {}, message = 'rejected'): Error {
        return Object.assign(new Error(message), {
            status,
            request: { kind: 'launchRequest', ephemeral: true },
            ...extra
        });
    }

    it('pings the service with the service token first', async () => {
        await renderApp();
        await selectApp('java-17');
        expect(theia.ping.mock.calls[0][0]).toMatchObject({ serviceUrl: 'https://service.example', appId: 'service-token' });
        expect(launchRequest()).toMatchObject({ serviceUrl: 'https://service.example', appId: 'service-token', appDefinition: 'java-17' });
    });

    it('prefers an ephemeral session when useEphemeralStorage is on', async () => {
        await renderApp();
        await selectApp('java-17');
        expect(launchRequest().ephemeral).toBe(true);
        expect(launchRequest().workspaceName).toBeUndefined();
    });

    it('launches on a workspace when useEphemeralStorage is off', async () => {
        await renderApp('/', { ...BASE_CONFIG, useEphemeralStorage: false });
        await selectApp('java-17');
        expect(launchRequest().ephemeral).toBe(false);
        expect(launchRequest().workspaceName).toMatch(/^ws-java-17-playground-anonymous-/);
    });

    it('shows the loading text while launching', async () => {
        let finish: () => void = () => undefined;
        theia.launchAndRedirect.mockReturnValue(
            new Promise<void>(resolve => {
                finish = resolve;
            })
        );
        await renderApp('/', { ...BASE_CONFIG, loadingText: 'Please wait' });
        fireEvent.click(screen.getByTestId('launch-app-java-17'));
        await screen.findByText('Please wait');
        expect(screen.queryByText('Launch session')).toBeNull();

        await act(async () => finish());
        expect(screen.queryByText('Please wait')).toBeNull();
    });

    it('shows the maintenance message when the service does not answer', async () => {
        theia.ping.mockRejectedValue(new Error('unreachable'));
        await renderApp();
        fireEvent.click(screen.getByTestId('launch-app-java-17'));
        await screen.findByText(/performing some maintenance/);
        expect(theia.launchAndRedirect).not.toHaveBeenCalled();
    });

    it('explains an app definition missing from the cluster', async () => {
        theia.launchAndRedirect.mockRejectedValue(rejection(473));
        await renderApp();
        await selectApp('java-17');
        await screen.findByText(/The app definition 'java-17' is not available in the cluster/);
    });

    it('shows other launch errors and hides the info message', async () => {
        theia.launchAndRedirect.mockRejectedValue(rejection(500, {}, 'kaputt'));
        await renderApp();
        await selectApp('java-17');
        await screen.findByText('ERROR: kaputt');
        expect(screen.queryByText('Launch session')).toBeNull();
        expect(theia.launchAndRedirect).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['names the workspace requirement', { serverError: { reason: 'App requires a workspace-backed session' } }],
        ['has no reason body', {}]
    ])('retries on a workspace when a 400 %s', async (_, extra) => {
        theia.launchAndRedirect.mockRejectedValueOnce(rejection(400, extra));
        await renderApp();
        await selectApp('java-17', 2);
        expect(launchRequest(0).ephemeral).toBe(true);
        expect(launchRequest(1).ephemeral).toBe(false);
        expect(launchRequest(1).workspaceName).toMatch(/^ws-java-17-playground-/);
        expect(launchRequest(1).env).toEqual(launchRequest(0).env);
        expect(screen.queryByText(/ERROR/)).toBeNull();
    });

    it.each([
        ['has another reason', 400, { serverError: { reason: 'Quota exceeded' } }],
        ['is not a 400', 500, {}],
        ['was not for an ephemeral launch', 400, { request: { kind: 'launchRequest', ephemeral: false } }],
        ['was not for a launch', 400, { request: { kind: 'somethingElse', ephemeral: true } }]
    ])('does not retry when the rejection %s', async (_, status, extra) => {
        theia.launchAndRedirect.mockRejectedValue(rejection(status, extra));
        await renderApp();
        await selectApp('java-17');
        await screen.findByText('ERROR: rejected');
        expect(theia.launchAndRedirect).toHaveBeenCalledTimes(1);
    });

    it('reports a failed workspace retry', async () => {
        theia.launchAndRedirect.mockRejectedValueOnce(rejection(400)).mockRejectedValueOnce(new Error('retry failed'));
        await renderApp();
        await selectApp('java-17', 2);
        await screen.findByText('ERROR: retry failed');
    });
});

describe('build-system picker', () => {
    async function pickBuildSystem(id: string): Promise<void> {
        fireEvent.click(screen.getByTestId('launch-app-c-lang'));
        screen.getByText('Choose your build system');
        expect(theia.ping).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId(`build-system-${id}`));
        await launchCount(theia.launchAndRedirect.mock.calls.length + 1);
    }

    it('appears with two or more build systems and launches the choice', async () => {
        await renderApp();
        await pickBuildSystem('bazel');
        expect(launchRequest().appDefinition).toBe('c-lang');
        expect(launchRequest().env.fromMap.TEMPLATE).toBe('bazel');
    });

    it('goes back to the language list', async () => {
        await renderApp();
        fireEvent.click(screen.getByTestId('launch-app-c-lang'));
        fireEvent.click(screen.getByRole('button', { name: /Back/ }));
        screen.getByText('Choose your programming language');
        screen.getByTestId('launch-app-c-lang');
    });

    it('auto-selects a single build system', async () => {
        await renderApp();
        await selectApp('rust');
        expect(screen.queryByText('Choose your build system')).toBeNull();
        expect(launchRequest().env.fromMap.TEMPLATE).toBe('cargo');
    });

    it('does not set TEMPLATE without build systems', async () => {
        await renderApp();
        await selectApp('java-17');
        expect(launchRequest().env.fromMap.TEMPLATE).toBeUndefined();
    });

    it.each([[{ gitUri: GIT_URI }], [{ artemisToken: 'token' }]])('is skipped with %j', async params => {
        await renderApp(query(params));
        await selectApp('c-lang');
        expect(screen.queryByText('Choose your build system')).toBeNull();
        expect(launchRequest().env.fromMap.TEMPLATE).toBeUndefined();
    });

    it('does not auto-select a single build system with gitUri', async () => {
        await renderApp(query({ gitUri: GIT_URI }));
        await selectApp('rust');
        expect(launchRequest().env.fromMap.TEMPLATE).toBeUndefined();
    });

    it('never launches a build system ephemerally, even with useEphemeralStorage on', async () => {
        await renderApp();
        await pickBuildSystem('make');
        expect(launchRequest().ephemeral).toBe(false);
        expect(launchRequest().workspaceName).toBeDefined();
    });

    it('never launches an auto-selected build system ephemerally', async () => {
        await renderApp();
        await selectApp('rust');
        expect(launchRequest().ephemeral).toBe(false);
    });

    it('gives each build system its own workspace', async () => {
        await confirmUser(query({ user: 'ada' }));
        await pickBuildSystem('make');
        await waitFor(() => screen.getByText('Choose your build system'));
        fireEvent.click(screen.getByTestId('build-system-bazel'));
        await launchCount(2);

        expect(launchRequest(0).workspaceName).toMatch(/^ws-c-lang-make-playground-ada-/);
        expect(launchRequest(1).workspaceName).toMatch(/^ws-c-lang-bazel-playground-ada-/);
    });
});

describe('session ended', () => {
    const WORKSPACE_CONFIG = { ...BASE_CONFIG, useEphemeralStorage: false };
    const TRUSTED_LINK = { appDef: 'java-17', gitUri: GIT_URI, artemisToken: 'token', artemisUrl: TRUSTED_URL };
    const ENDED = 'Your session has ended';

    beforeEach(() => window.sessionStorage.clear());

    async function launchThenEnd(config: unknown = WORKSPACE_CONFIG): Promise<void> {
        await renderApp('/', config);
        await selectApp('java-17');
        cleanup();
        await renderApp('/session-ended', config);
        screen.getByText(ENDED);
    }

    it('resumes into the same workspace with the same link', async () => {
        await renderApp(query(TRUSTED_LINK), WORKSPACE_CONFIG);
        await launchCount(1);
        cleanup();

        await renderApp('/session-ended', WORKSPACE_CONFIG);
        fireEvent.click(screen.getByRole('button', { name: 'Resume my session' }));
        await launchCount(2);
        expect(launchRequest(1).workspaceName).toBe(launchRequest(0).workspaceName);
        expect(launchRequest(1).user).toBe(launchRequest(0).user);
        expect(launchRequest(1).env).toEqual(launchRequest(0).env);
    });

    it('waits for a click, even with a trusted link in the URL', async () => {
        await renderApp(`/session-ended?${new URLSearchParams(TRUSTED_LINK)}`, WORKSPACE_CONFIG);
        screen.getByText(ENDED);
        expect(theia.launchAndRedirect).not.toHaveBeenCalled();
    });

    it('offers no resume after an ephemeral session', async () => {
        await launchThenEnd(BASE_CONFIG);
        screen.getByText(/could not be kept/);
        expect(screen.queryByRole('button', { name: 'Resume my session' })).toBeNull();
    });

    it('offers a resume when an ephemeral launch fell back to a workspace', async () => {
        theia.launchAndRedirect.mockRejectedValueOnce(
            Object.assign(new Error('rejected'), { status: 400, request: { kind: 'launchRequest', ephemeral: true } })
        );
        await renderApp();
        await selectApp('java-17', 2);
        cleanup();
        await renderApp('/session-ended');
        screen.getByRole('button', { name: 'Resume my session' });
    });

    it('sends a tab without a stored launch back to the start page', async () => {
        await renderApp('/session-ended', WORKSPACE_CONFIG);
        screen.getByText(/choose your environment again/);
        fireEvent.click(screen.getByRole('button', { name: 'Start a new session' }));
        screen.getByText('Choose your programming language');
        expect(window.location.pathname).toBe('/');
    });

    it('forgets the launch when the student starts something else', async () => {
        await launchThenEnd();
        fireEvent.click(screen.getByRole('button', { name: 'Start something else' }));
        cleanup();
        await renderApp('/session-ended', WORKSPACE_CONFIG);
        expect(screen.queryByRole('button', { name: 'Resume my session' })).toBeNull();
    });

    it('offers no resume a day later', async () => {
        await renderApp('/', WORKSPACE_CONFIG);
        await selectApp('java-17');
        cleanup();
        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 25 * 60 * 60 * 1000);
        await renderApp('/session-ended', WORKSPACE_CONFIG);
        expect(screen.queryByRole('button', { name: 'Resume my session' })).toBeNull();
        vi.mocked(Date.now).mockRestore();
    });

    it('explains a previous session that is still shutting down', async () => {
        await launchThenEnd();
        theia.launchAndRedirect.mockRejectedValue(Object.assign(new Error('limit'), { status: 553 }));
        fireEvent.click(screen.getByRole('button', { name: 'Resume my session' }));
        await screen.findByText(/previous session is still shutting down/);
    });
});
