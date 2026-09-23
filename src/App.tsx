import './App.css';

import { getTheiaCloudConfig, LaunchRequest, PingRequest, RequestOptions, TheiaCloud } from '@eclipse-theiacloud/common';
import Keycloak, { KeycloakConfig } from 'keycloak-js';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ExtendedAppDefinition, ExtendedTheiaCloudConfig } from './common-extensions/types';
import { getServiceAuthToken } from './common-extensions/types';
import { AppLogo } from './components/AppLogo';
import { ErrorComponent } from './components/ErrorComponent';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Imprint } from './components/Imprint';
import { Info } from './components/Info';
import { LaunchApp } from './components/LaunchApp';
import { Loading } from './components/Loading';
import { LoginButton } from './components/LoginButton';
import { Privacy } from './components/Privacy';
import { SelectApp } from './components/SelectApp';
import { SelectBuildSystem } from './components/SelectBuildSystem';
import type { SessionEndedReason } from './components/SessionEnded';
import { SessionEnded } from './components/SessionEnded';
import { VantaBackground } from './components/VantaBackground';
import type { LaunchDescriptor } from './lastLaunch';
import { clearLastLaunch, readLastLaunch, resetAutoResumeCount, saveLastLaunch } from './lastLaunch';

// global state to be kept between render calls
let initialized = false;
let initialAppName = '';
let initialAppDefinition = '';
let keycloakConfig: KeycloakConfig | undefined = undefined;
const WORKSPACE_SEGMENT_LIMIT = 12;

export type LandingPage = 'home' | 'imprint' | 'privacy' | 'sessionEnded';

/**
 * The launch inputs the workspace name is derived from.
 *
 * Resume passes these explicitly rather than pushing them through setState first: the setters do
 * not update the values this render's handleStartSession closed over, so a launch fired straight
 * after them would compute the workspace name from the OLD (empty) values and silently mount a
 * brand-new empty workspace instead of the student's.
 */
interface LaunchInputs {
    gitUri?: string;
    gitUser?: string;
    gitMail?: string;
    artemisUrl?: string;
    artemisToken?: string;
    anonymousUser?: string;
}

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

function pageFromPath(path: string): LandingPage {
    if (path === '/imprint') {
        return 'imprint';
    }
    if (path === '/privacy') {
        return 'privacy';
    }
    if (path === '/session-ended' || path.startsWith('/session-ended/')) {
        return 'sessionEnded';
    }
    return 'home';
}

/**
 * The gateway can only redirect to a fixed path, so a bare /session-ended carries no reason. The
 * IDE, which knows why the session is ending, appends one.
 */
function reasonFromPath(path: string): SessionEndedReason {
    const reason = path.split('/')[2];
    return reason === 'inactivity' || reason === 'lifetime' ? reason : undefined;
}

function getCurrentRedirectUri(): string {
    return window.location.href;
}

function App(): React.JSX.Element {
    const [config] = useState<ExtendedTheiaCloudConfig | undefined>(() => getTheiaCloudConfig());
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState(false);
    // Resolved from the URL synchronously: if this defaulted to 'home', a first visit to
    // /session-ended carrying appDef+gitUri+artemisToken would let the auto-start effect launch
    // before the routing effect corrected the page.
    const [currentPage, setCurrentPage] = useState<LandingPage>(() => pageFromPath(window.location.pathname));
    const [sessionEndedReason, setSessionEndedReason] = useState<SessionEndedReason>(() => reasonFromPath(window.location.pathname));

    // Handle URL routing
    useEffect(() => {
        const updatePageFromUrl = (): void => {
            setCurrentPage(pageFromPath(window.location.pathname));
            setSessionEndedReason(reasonFromPath(window.location.pathname));
        };

        // Initial load
        updatePageFromUrl();

        // Listen for browser back/forward navigation
        window.addEventListener('popstate', updatePageFromUrl);

        return () => {
            window.removeEventListener('popstate', updatePageFromUrl);
        };
    }, []);

    // Navigation handler that updates both state and URL
    const PAGE_PATHS: Record<LandingPage, string> = {
        home: '/',
        imprint: '/imprint',
        privacy: '/privacy',
        sessionEnded: '/session-ended'
    };

    const handleNavigation = (page: LandingPage): void => {
        const path = PAGE_PATHS[page];

        // Update URL without page reload
        window.history.pushState({}, '', path);

        // Update state
        setCurrentPage(page);
    };

    if (config === undefined) {
        return (
            <div className='App'>
                <strong>FATAL: Theia Cloud configuration could not be found.</strong>
            </div>
        );
    }

    if (!initialized) {
        initialAppName = config.appName;
        initialAppDefinition = config.appDefinition;
    }

    // ignore ESLint conditional rendering warnings.
    // If config === undefined, this is an unremediable situation anyway.
    /* eslint-disable react-hooks/rules-of-hooks */
    const [selectedAppName, setSelectedAppName] = useState<string>(initialAppName);
    const [selectedAppDefinition, setSelectedAppDefinition] = useState<string>(initialAppDefinition);

    const [email, setEmail] = useState<string>();
    const [username, setUsername] = useState<string>();
    const [token, setToken] = useState<string>();
    const [logoutUrl, setLogoutUrl] = useState<string>();
    const [user, setUser] = useState<string>();

    const [gitUri, setGitUri] = useState<string>();
    const [gitUser, setGitUser] = useState<string>();
    const [gitMail, setGitMail] = useState<string>();
    const [artemisToken, setArtemisToken] = useState<string>();
    const [artemisUrl, setArtemisUrl] = useState<string>();

    const [autoStart, setAutoStart] = useState<boolean>(false);
    const autoStartRequestedRef = useRef(false);

    const [standaloneWizardStep, setStandaloneWizardStep] = useState<'language' | 'buildSystem'>('language');
    const [standaloneAppDef, setStandaloneAppDef] = useState<string>();

    if (!initialized) {
        const urlParams = new URLSearchParams(window.location.search);

        // Get appDef parameter from URL and set it as the default selection
        if (urlParams.has('appDef') || urlParams.has('appdef')) {
            const pathBlueprintSelection = urlParams.get('appDef') || urlParams.get('appdef');
            if (
                pathBlueprintSelection &&
                isDefaultSelectionValueValid(pathBlueprintSelection, config.appDefinition, config.additionalApps)
            ) {
                if (config.additionalApps && config.additionalApps.length > 0) {
                    const appDefinition = config.additionalApps.find(
                        appDef => (appDef.serviceAuthToken || appDef.appId) === pathBlueprintSelection
                    );
                    setSelectedAppName(appDefinition ? appDefinition.appName : pathBlueprintSelection);
                    setSelectedAppDefinition(
                        appDefinition ? appDefinition.serviceAuthToken || appDefinition.appId : pathBlueprintSelection
                    );
                } else {
                    setSelectedAppDefinition(pathBlueprintSelection);
                    setSelectedAppName(pathBlueprintSelection);
                }
            } else {
                setError('Invalid default selection value: ' + pathBlueprintSelection);
                console.error('Invalid default selection value: ' + pathBlueprintSelection);
            }
        }

        // Get gitUri parameter from URL.
        if (urlParams.has('gitUri')) {
            const gitUriParam = urlParams.get('gitUri');
            if (gitUriParam) {
                setGitUri(gitUriParam);
            }
        }

        // Get artemisToken parameter from URL.
        if (urlParams.has('artemisToken')) {
            const artemisTokenParam = urlParams.get('artemisToken');
            if (artemisTokenParam) {
                setArtemisToken(artemisTokenParam);
            }
        }

        // Get artemisUrl parameter from URL.
        if (urlParams.has('artemisUrl')) {
            const artemisUrlParam = urlParams.get('artemisUrl');
            if (artemisUrlParam) {
                setArtemisUrl(artemisUrlParam);
            }
        }

        // Get gitUser parameter from URL.
        if (urlParams.has('gitUser')) {
            const gitUserParam = urlParams.get('gitUser');
            if (gitUserParam) {
                setGitUser(gitUserParam);
            }
        }

        // Get gitMail parameter from URL.
        if (urlParams.has('gitMail')) {
            const gitMailParam = urlParams.get('gitMail');
            if (gitMailParam) {
                setGitMail(gitMailParam);
            }
        }

        // Get user parameter from URL (for anonymous mode when Keycloak is disabled).
        if (urlParams.has('user')) {
            const userParam = urlParams.get('user');
            if (userParam) {
                setUser(userParam);
            }
        }

        // Set default user for anonymous mode when Keycloak is disabled
        if (!config.useKeycloak && !urlParams.has('user')) {
            const randomId = Math.random().toString(36).substring(2, 10);
            setUser(`anonymous-${randomId}`);
        }

        if (config.useKeycloak) {
            keycloakConfig = {
                url: config.keycloakAuthUrl!,
                realm: config.keycloakRealm!,
                clientId: config.keycloakClientId!
            };
            const keycloak = new Keycloak(keycloakConfig);

            keycloak
                .init({
                    onLoad: 'check-sso',
                    redirectUri: getCurrentRedirectUri(),
                    checkLoginIframe: false
                })
                .then(authenticated => {
                    if (authenticated) {
                        const parsedToken = keycloak.idTokenParsed;
                        if (parsedToken) {
                            const userMail = parsedToken.email;
                            setToken(keycloak.idToken);
                            setEmail(userMail);
                            setUsername(parsedToken.preferred_username ?? userMail);
                            setLogoutUrl(keycloak.createLogoutUrl());
                        }
                    }
                })
                .catch(() => {
                    console.error('Authentication Failed');
                });
        }
        initialized = true;
    }

    const handleStartSession = useCallback(
        (appDefinition: string, buildSystemId?: string, overrides?: LaunchInputs): void => {
            setLoading(true);
            setError(undefined);

            // Overrides win when resuming; otherwise the current state is the source of truth.
            const launchGitUri = overrides?.gitUri ?? gitUri;
            const launchGitUser = overrides?.gitUser ?? gitUser;
            const launchGitMail = overrides?.gitMail ?? gitMail;
            const launchArtemisUrl = overrides?.artemisUrl ?? artemisUrl;
            const launchArtemisToken = overrides?.artemisToken ?? artemisToken;
            const launchAnonymousUser = overrides?.anonymousUser ?? user;

            TheiaCloud.ping(PingRequest.create(config.serviceUrl, getServiceAuthToken(config)))
                .then(() => {
                    // ping successful continue with launch
                    let workspace: string;
                    const workspaceUser = config.useKeycloak ? username : launchAnonymousUser;
                    const workspaceUserSegment = sanitizeWorkspaceSegment(workspaceUser, 'user');
                    // Fold the selected build system (template) into the workspace identity so
                    // that, e.g., the Bazel and Make variants of the same app definition get
                    // separate persistent workspaces instead of sharing (and merging) one.
                    const appKey = buildSystemId ? `${appDefinition}-${buildSystemId}` : appDefinition;
                    const workspaceAppSegment = sanitizeWorkspaceSegment(appKey, 'app');

                    if (!launchGitUri) {
                        workspace =
                            'ws-' +
                            workspaceAppSegment +
                            '-playground-' +
                            workspaceUserSegment +
                            '-' +
                            createDeterministicId(`${workspaceUser}-${appKey}-playground`);
                        console.log(`Prepared persistent workspace ${workspace} for ${appDefinition} (playground fallback)`);
                    } else {
                        const repoName = launchGitUri
                            .split('/')
                            .pop()
                            ?.replace(/\.git$/, '');
                        const repoSegment = sanitizeWorkspaceSegment(repoName, 'repo');
                        workspace =
                            'ws-' +
                            workspaceAppSegment +
                            '-' +
                            repoSegment +
                            '-' +
                            workspaceUserSegment +
                            '-' +
                            createDeterministicId(`${launchGitUri}${buildSystemId ? `-${buildSystemId}` : ''}`);
                        console.log(`Prepared persistent workspace ${workspace} for ${appDefinition}`);
                    }

                    const requestOptions: RequestOptions = {
                        timeout: 60000,
                        retries: 5,
                        accessToken: token
                    };

                    const envFromMap: Record<string, string> = { THEIA: 'true' };
                    if (launchArtemisToken) {
                        envFromMap.ARTEMIS_TOKEN = launchArtemisToken;
                    }
                    if (launchArtemisUrl) {
                        envFromMap.ARTEMIS_URL = launchArtemisUrl;
                    }
                    if (launchGitUri) {
                        envFromMap.GIT_URI = launchGitUri;
                    }
                    if (launchGitUser) {
                        envFromMap.GIT_USER = launchGitUser;
                    }
                    if (launchGitMail) {
                        envFromMap.GIT_MAIL = launchGitMail;
                    }
                    if (buildSystemId) {
                        envFromMap.TEMPLATE = buildSystemId;
                    }

                    const launchEnv = { fromMap: envFromMap };
                    const launchUser = config.useKeycloak ? email! : launchAnonymousUser!;
                    const serviceAuthToken = getServiceAuthToken(config);
                    const createWorkspaceLaunchRequest = (): LaunchRequest => ({
                        ...LaunchRequest.createWorkspace(
                            config.serviceUrl,
                            serviceAuthToken,
                            appDefinition,
                            undefined,
                            launchUser,
                            workspace
                        ),
                        env: launchEnv
                    });
                    const createEphemeralLaunchRequest = (): LaunchRequest => ({
                        ...LaunchRequest.ephemeral(config.serviceUrl, serviceAuthToken, appDefinition, undefined, launchUser),
                        env: launchEnv
                    });

                    const isWorkspaceRequiredFallbackError = (err: Error): boolean => {
                        const status = (err as any)?.status;
                        const serverReason = (err as any)?.serverError?.reason;
                        const request = (err as any)?.request;

                        if (status !== 400 || request?.kind !== LaunchRequest.KIND || request?.ephemeral !== true) {
                            return false;
                        }

                        if (typeof serverReason === 'string') {
                            return serverReason.includes('workspace-backed session');
                        }

                        // Some service deployments currently return this rejection as an unstructured 400
                        // without a JSON reason body, so we fall back to a workspace-backed launch.
                        return true;
                    };

                    // Remember what this launch was, so that a session which later ends can be
                    // resumed into the same workspace. The workspace name is derived from these
                    // inputs, so reproducing them reproduces the volume.
                    const attemptEphemeral = Boolean(config.useEphemeralStorage && !buildSystemId);
                    const rememberLaunch = (ephemeral: boolean): void =>
                        saveLastLaunch({
                            appDefinition,
                            appName:
                                config.additionalApps?.find(a => (a.serviceAuthToken || a.appId) === appDefinition)?.appName ??
                                appDefinition,
                            buildSystemId,
                            gitUri: launchGitUri,
                            gitUser: launchGitUser,
                            gitMail: launchGitMail,
                            artemisUrl: launchArtemisUrl,
                            artemisToken: launchArtemisToken,
                            anonymousUser: config.useKeycloak ? undefined : launchAnonymousUser,
                            ephemeral
                        });
                    rememberLaunch(attemptEphemeral);

                    // `useEphemeralStorage` means "prefer ephemeral when possible".
                    // App definitions that require a shared workspace are retried with a PVC-backed workspace.
                    // Template launches always use workspace-backed sessions so that env vars
                    // are set directly on the container (eager/ephemeral sessions inject env
                    // vars via data bridge which arrives after the entrypoint has already run).
                    const launchPromise = attemptEphemeral
                        ? (() => {
                              console.log(`Attempting ephemeral launch for ${appDefinition}`);
                              return TheiaCloud.launchAndRedirect(createEphemeralLaunchRequest(), requestOptions).catch((err: Error) => {
                                  if (!isWorkspaceRequiredFallbackError(err)) {
                                      throw err;
                                  }

                                  console.log(
                                      `Ephemeral launch for ${appDefinition} requires a shared workspace, retrying with ${workspace}`
                                  );
                                  // It is workspace-backed after all, so the work is resumable.
                                  rememberLaunch(false);
                                  return TheiaCloud.launchAndRedirect(createWorkspaceLaunchRequest(), requestOptions);
                              });
                          })()
                        : (() => {
                              console.log(`Launching ${appDefinition} with persistent workspace ${workspace}`);
                              return TheiaCloud.launchAndRedirect(createWorkspaceLaunchRequest(), requestOptions);
                          })();

                    launchPromise
                        .catch((err: Error) => {
                            if (err && (err as any).status === 473) {
                                setError(
                                    `The app definition '${appDefinition}' is not available in the cluster.\n` +
                                        'Please try launching another application.'
                                );
                                return;
                            }
                            if (err && (err as any).status === 553) {
                                // The previous session is still terminating and still counts against the
                                // per-user limit. Common when resuming straight after a timeout.
                                setError('Your previous session is still shutting down.\n' + 'Please try again in a few seconds.');
                                return;
                            }
                            setError(err.message);
                        })
                        .finally(() => {
                            setLoading(false);
                        });
                })
                .catch((_err: Error) => {
                    setError(
                        'Sorry, we are performing some maintenance at the moment.\n' +
                            "Please try again later. Usually maintenance won't last longer than 60 minutes.\n\n"
                    );
                    setLoading(false);
                });
        },
        [config, gitUri, username, user, token, artemisToken, artemisUrl, gitUser, gitMail, email]
    );

    const handleAppSelected = (appId: string, _: string): void => {
        const isStandaloneMode = !artemisToken && !gitUri;
        if (isStandaloneMode) {
            const appDef = config.additionalApps?.find(a => (a.serviceAuthToken || a.appId) === appId);
            const buildSystems = appDef?.buildSystems ?? [];
            if (buildSystems.length <= 1) {
                handleStartSession(appId, buildSystems.length === 1 ? buildSystems[0].id : undefined);
            } else {
                setStandaloneAppDef(appId);
                setStandaloneWizardStep('buildSystem');
            }
        } else {
            handleStartSession(appId);
        }
    };

    useEffect(() => {
        if (!initialized) {
            return;
        }

        if (config.useKeycloak && !username) {
            autoStartRequestedRef.current = false;
            return;
        }

        // On /session-ended the descriptor rehydrates exactly these three values, which would make
        // this effect launch immediately - bypassing the focus gate and the auto-resume limit.
        if (currentPage === 'sessionEnded') {
            autoStartRequestedRef.current = false;
            setAutoStart(false);
            return;
        }

        if (selectedAppDefinition && gitUri && artemisToken) {
            // authenticate();
            setAutoStart(true);
            if (!autoStartRequestedRef.current) {
                autoStartRequestedRef.current = true;
                handleStartSession(selectedAppDefinition);
            }
        } else {
            autoStartRequestedRef.current = false;
            setAutoStart(false);
        }
    }, [username, user, selectedAppDefinition, gitUri, artemisToken, handleStartSession, config.useKeycloak, currentPage]);

    /* eslint-enable react-hooks/rules-of-hooks */

    document.title = config.pageTitle || 'EduIDE Cloud';

    const authenticate: () => void = (): void => {
        const keycloak = new Keycloak(keycloakConfig!);

        keycloak
            .init({
                redirectUri: getCurrentRedirectUri(),
                checkLoginIframe: false
            })
            .then((authenticated: boolean) => {
                if (!authenticated) {
                    keycloak.login({
                        redirectUri: getCurrentRedirectUri()
                    });
                } else {
                    const parsedToken = keycloak.idTokenParsed;
                    if (parsedToken) {
                        const userMail = parsedToken.email;
                        setToken(keycloak.idToken);
                        setEmail(userMail);
                        setUsername(parsedToken.preferred_username ?? userMail);
                        setLogoutUrl(keycloak.createLogoutUrl());
                    }
                }
            })
            .catch(() => {
                console.error('Authentication Failed');
                setError('Authentication failed');
            });
    };

    const needsLogin = config.useKeycloak && !token;
    const logoFileExtension = config.logoFileExtension ?? 'svg';

    if (currentPage === 'imprint') {
        return (
            <div className='App'>
                <VantaBackground>
                    <Imprint onNavigate={handleNavigation} />
                </VantaBackground>
            </div>
        );
    }

    if (currentPage === 'privacy') {
        return (
            <div className='App'>
                <VantaBackground>
                    <Privacy onNavigate={handleNavigation} />
                </VantaBackground>
            </div>
        );
    }

    if (currentPage === 'sessionEnded') {
        const descriptor = readLastLaunch();
        const resumeSession = (toResume: LaunchDescriptor): void => {
            // Hand the inputs straight to the launch. Going through setState would leave this
            // render's handleStartSession closed over the old values and rebuild the workspace name
            // from nothing, and navigating home first would let the auto-start effect fire a second
            // launch. The descriptor is left in place until the new launch rewrites it, so a failed
            // ping does not strip the student of their way back.
            handleStartSession(toResume.appDefinition, toResume.buildSystemId, {
                gitUri: toResume.gitUri,
                gitUser: toResume.gitUser,
                gitMail: toResume.gitMail,
                artemisUrl: toResume.artemisUrl,
                artemisToken: toResume.artemisToken,
                anonymousUser: toResume.anonymousUser
            });
        };

        return (
            <div className='App'>
                <VantaBackground>
                    <Header
                        email={config.useKeycloak ? email : undefined}
                        authenticate={config.useKeycloak ? authenticate : undefined}
                        logoutUrl={config.useKeycloak ? logoutUrl : undefined}
                    />
                    <div className='body'>
                        {loading ? (
                            <Loading logoFileExtension={logoFileExtension} text={config.loadingText} />
                        ) : needsLogin ? (
                            <LoginButton login={authenticate} />
                        ) : (
                            <SessionEnded
                                reason={sessionEndedReason}
                                descriptor={descriptor}
                                onResume={resumeSession}
                                onStartNew={() => {
                                    resetAutoResumeCount();
                                    clearLastLaunch();
                                    handleNavigation('home');
                                }}
                            />
                        )}
                        <ErrorComponent message={error} />
                    </div>
                    <Footer selectedAppDefinition={''} onNavigate={handleNavigation} footerLinks={config.footerLinks} />
                </VantaBackground>
            </div>
        );
    }

    const standaloneAppBuildSystems =
        config.additionalApps?.find(a => (a.serviceAuthToken || a.appId) === standaloneAppDef)?.buildSystems ?? [];

    return (
        <div className='App'>
            <VantaBackground>
                <Header
                    email={config.useKeycloak ? email : undefined}
                    authenticate={config.useKeycloak ? authenticate : undefined}
                    logoutUrl={config.useKeycloak ? logoutUrl : undefined}
                />
                <div className='body'>
                    {loading ? (
                        <Loading logoFileExtension={logoFileExtension} text={config.loadingText} />
                    ) : (
                        <div>
                            <div>
                                <div style={{ marginTop: '2rem' }}></div>
                                <AppLogo fileExtension={logoFileExtension} />
                                <h2 className='App__title'>
                                    {standaloneWizardStep === 'buildSystem' ? 'Choose your build system' : 'Choose your Online IDE'}
                                </h2>
                                <div>
                                    {needsLogin ? (
                                        <LoginButton login={authenticate} />
                                    ) : autoStart ? (
                                        <LaunchApp
                                            appName={selectedAppName}
                                            appDefinition={selectedAppDefinition}
                                            onStartSession={handleStartSession}
                                        />
                                    ) : standaloneWizardStep === 'buildSystem' ? (
                                        <SelectBuildSystem
                                            buildSystems={standaloneAppBuildSystems}
                                            onSelect={buildSystemId => handleStartSession(standaloneAppDef!, buildSystemId)}
                                            onBack={() => setStandaloneWizardStep('language')}
                                        />
                                    ) : (
                                        <SelectApp appDefinitions={config.additionalApps} onSelectApp={handleAppSelected} />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <ErrorComponent message={error} />
                    {!error && !loading && (
                        <Info usesLogin={config.useKeycloak} disable={config.disableInfo} text={config.infoText} title={config.infoTitle} />
                    )}
                </div>
                <Footer
                    selectedAppDefinition={autoStart ? selectedAppDefinition : ''}
                    onNavigate={handleNavigation}
                    footerLinks={config.footerLinks}
                />
            </VantaBackground>
        </div>
    );
}

function isDefaultSelectionValueValid(defaultSelection: string, appDefinition: string, additionalApps?: ExtendedAppDefinition[]): boolean {
    if (defaultSelection === appDefinition) {
        return true;
    }
    if (additionalApps && additionalApps.length > 0) {
        return additionalApps.some(def => def.serviceAuthToken === defaultSelection);
    }
    // If there are no additional apps explicitly configured, we accept any app definition given via url parameter
    return true;
}

export default App;
