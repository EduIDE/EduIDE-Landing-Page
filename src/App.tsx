import './App.css';

import { getTheiaCloudConfig, LaunchRequest, PingRequest, RequestOptions, TheiaCloud } from '@eclipse-theiacloud/common';
import Keycloak, { KeycloakConfig } from 'keycloak-js';
import { useCallback, useEffect, useState } from 'react';

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
import { VantaBackground } from './components/VantaBackground';

// global state to be kept between render calls
let initialized = false;
let initialAppName = '';
let initialAppDefinition = '';
let keycloakConfig: KeycloakConfig | undefined = undefined;
const WORKSPACE_SEGMENT_LIMIT = 12;

function createDeterministicId(value: string): string {
    let hash = 0;

    for (let i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
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

function getCurrentRedirectUri(): string {
    return window.location.href;
}

function App(): JSX.Element {
    const [config] = useState<ExtendedTheiaCloudConfig | undefined>(() => getTheiaCloudConfig());
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState<'home' | 'imprint' | 'privacy'>('home');

    // Handle URL routing
    useEffect(() => {
        const updatePageFromUrl = (): void => {
            const path = window.location.pathname;
            if (path === '/imprint') {
                setCurrentPage('imprint');
            } else if (path === '/privacy') {
                setCurrentPage('privacy');
            } else {
                setCurrentPage('home');
            }
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
    const handleNavigation = (page: 'home' | 'imprint' | 'privacy'): void => {
        const path = page === 'home' ? '/' : `/${page}`;

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
                url: config.keycloakAuthUrl,
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
        (appDefinition: string): void => {
            setLoading(true);
            setError(undefined);

            // first check if the service is available. if not we are doing maintenance and should adapt the error message accordingly
            TheiaCloud.ping(PingRequest.create(config.serviceUrl, getServiceAuthToken(config)))
                .then(() => {
                    // ping successful continue with launch
                    let workspace: string;
                    const workspaceUser = config.useKeycloak ? username : user;
                    const workspaceUserSegment = sanitizeWorkspaceSegment(workspaceUser, 'user');
                    const workspaceAppSegment = sanitizeWorkspaceSegment(appDefinition, 'app');

                    if (!gitUri) {
                        workspace =
                            'ws-' +
                            workspaceAppSegment +
                            '-playground-' +
                            workspaceUserSegment +
                            '-' +
                            createDeterministicId(`${workspaceUser}-${appDefinition}-playground`);
                        console.log(
                            `Prepared persistent workspace ${workspace} for ${appDefinition} (playground fallback)`
                        );
                    } else {
                        const repoName = gitUri.split('/').pop()?.replace(/\.git$/, '');
                        const repoSegment = sanitizeWorkspaceSegment(repoName, 'repo');
                        workspace =
                            'ws-' +
                            workspaceAppSegment +
                            '-' +
                            repoSegment +
                            '-' +
                            workspaceUserSegment +
                            '-' +
                            createDeterministicId(gitUri);
                        console.log(`Prepared persistent workspace ${workspace} for ${appDefinition}`);
                    }

                    const requestOptions: RequestOptions = {
                        timeout: 60000,
                        retries: 5,
                        accessToken: token
                    };

                    /*
        const sessionStartRequest: SessionStartRequest = {
          serviceUrl: config.serviceUrl,
          appId: config.appId,
          user: config.useKeycloak ? email! : user!,
          appDefinition,
          workspaceName: workspace,
          timeout: 180,
          env: {
            fromMap: {
              THEIA: 'true',
              ARTEMIS_TOKEN: artemisToken!,
              ARTEMIS_CLONE_URL: gitUri!
            }
          }
        };

        TheiaCloud.Session.startSession(
          sessionStartRequest,
          requestOptions
        ).catch((err: Error) => {
          if (err && (err as any).status === 473) {
              setError(
                `The app definition '${appDefinition}' is not available in the cluster.\n` +
                  'Please try launching another application.'
              );
              return;
            }
            setError(err.message);
          })
          .finally(() => {
            setLoading(false);
          });
        */

                    const launchEnv = {
                        fromMap: {
                            THEIA: 'true',
                            ARTEMIS_TOKEN: artemisToken!,
                            ARTEMIS_URL: artemisUrl!,
                            GIT_URI: gitUri!,
                            GIT_USER: gitUser!,
                            GIT_MAIL: gitMail!
                        }
                    };
                    const launchUser = config.useKeycloak ? email! : user!;
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
                        ...LaunchRequest.ephemeral(
                            config.serviceUrl,
                            serviceAuthToken,
                            appDefinition,
                            undefined,
                            launchUser
                        ),
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

                    // `useEphemeralStorage` means "prefer ephemeral when possible".
                    // App definitions that require a shared workspace are retried with a PVC-backed workspace.
                    const launchPromise = config.useEphemeralStorage
                        ? (() => {
                            console.log(`Attempting ephemeral launch for ${appDefinition}`);
                            return TheiaCloud.launchAndRedirect(createEphemeralLaunchRequest(), requestOptions).catch((err: Error) => {
                                if (!isWorkspaceRequiredFallbackError(err)) {
                                    throw err;
                                }

                                console.log(
                                    `Ephemeral launch for ${appDefinition} requires a shared workspace, retrying with ${workspace}`
                                );
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

    useEffect(() => {
        if (!initialized) {
            return;
        }

        if (config.useKeycloak && !username) {
            return;
        }

        if (selectedAppDefinition && gitUri && artemisToken && !loading) {
            // authenticate();
            setAutoStart(true);
            handleStartSession(selectedAppDefinition);
        } else {
            setAutoStart(false);
        }
    }, [username, user, selectedAppDefinition, gitUri, artemisToken, loading, handleStartSession, config.useKeycloak]);

    /* eslint-enable react-hooks/rules-of-hooks */

    document.title = config.pageTitle || 'EduIDE Cloud';

    const authenticate: () => void = (): void => {
        const keycloak = new Keycloak(keycloakConfig);

        keycloak
            .init({
                redirectUri: getCurrentRedirectUri(),
                checkLoginIframe: false
            })
            .then((authenticated: boolean) => {
                if (!authenticated) {
                    keycloak.login({
                        redirectUri: getCurrentRedirectUri(),
                        action: 'webauthn-register-passwordless:skip_if_exists'
                    });
                } else {
                    // If we are already authenticated (e.g. session existed but UI wasn't updated), update state
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

    // Render different pages based on currentPage state
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
                                <h2 className='App__title'>Choose your Programming Language</h2>
                                <div>
                                    {needsLogin ? (
                                        <LoginButton login={authenticate} />
                                    ) : autoStart ? (
                                        <LaunchApp
                                            appName={selectedAppName}
                                            appDefinition={selectedAppDefinition}
                                            onStartSession={handleStartSession}
                                        />
                                    ) : (
                                        <SelectApp appDefinitions={config.additionalApps} onStartSession={handleStartSession} />
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
        return additionalApps.map(def => def.serviceAuthToken).filter(serviceAuthToken => serviceAuthToken === defaultSelection).length > 0;
    }
    // If there are no additional apps explicitly configured, we accept any app definition given via url parameter
    return true;
}

export default App;
