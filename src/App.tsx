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
import { VantaBackground } from './components/VantaBackground';
import { giteaCheckSso, giteaLogin, initGitea, restoreGiteaRedirectSearch } from './gitea-oidc';

// global state to be kept between render calls
let initialized = false;
let initialAppName = '';
let initialAppDefinition = '';
let keycloakConfig: KeycloakConfig | undefined = undefined;
const WORKSPACE_SEGMENT_LIMIT = 12;

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
    const [extraEnv, setExtraEnv] = useState<Record<string, string>>({});
    const [appDefFromUrl, setAppDefFromUrl] = useState<boolean>(false);

    const [autoStart, setAutoStart] = useState<boolean>(false);
    const autoStartRequestedRef = useRef(false);

    const [standaloneWizardStep, setStandaloneWizardStep] = useState<'language' | 'buildSystem'>('language');
    const [standaloneAppDef, setStandaloneAppDef] = useState<string>();

    if (!initialized) {
        // When Gitea OIDC is enabled, restore the original query string (gitUri/appDef/...)
        // that was preserved across the OIDC redirect before parsing the URL parameters.
        if (config.useGiteaOidc) {
            initGitea(config);
            restoreGiteaRedirectSearch();
        }

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
                setAppDefFromUrl(true);
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

        // Collect arbitrary environment variables passed via `env.<KEY>` query params
        // (e.g. env.ARTEMIS_TOKEN, env.MY_VAR). Any external system can supply these.
        // Keys are validated against the Kubernetes C_IDENTIFIER rule so that invalid
        // names never reach the deployment (they would be rejected by the K8s API).
        const ENV_PREFIX = 'env.';
        const VALID_ENV_KEY = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        const collectedEnv: Record<string, string> = {};
        urlParams.forEach((value, key) => {
            if (key.startsWith(ENV_PREFIX) && value) {
                const envKey = key.slice(ENV_PREFIX.length);
                if (VALID_ENV_KEY.test(envKey)) {
                    collectedEnv[envKey] = value;
                } else {
                    console.warn(`Ignoring env var with invalid key: ${envKey}`);
                }
            }
        });
        if (Object.keys(collectedEnv).length > 0) {
            setExtraEnv(collectedEnv);
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
        } else if (config.useGiteaOidc) {
            giteaCheckSso()
                .then(giteaUser => {
                    if (giteaUser) {
                        const mail = giteaUser.profile?.email;
                        const preferredUsername = giteaUser.profile?.preferred_username;
                        setToken(giteaUser.access_token);
                        if (mail) {
                            setEmail(mail);
                        }
                        setUsername(preferredUsername ?? mail);
                        // Fall back to the Gitea claims for git author identity when the
                        // deep link did not already provide them via URL parameters.
                        if (!urlParams.has('gitUser') && preferredUsername) {
                            setGitUser(preferredUsername);
                        }
                        if (!urlParams.has('gitMail') && mail) {
                            setGitMail(mail);
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
        (appDefinition: string, buildSystemId?: string): void => {
            setLoading(true);
            setError(undefined);

            TheiaCloud.ping(PingRequest.create(config.serviceUrl, getServiceAuthToken(config)))
                .then(() => {
                    // ping successful continue with launch
                    let workspace: string;
                    const workspaceUser = config.useKeycloak ? username : config.useGiteaOidc ? email : user;
                    const workspaceUserSegment = sanitizeWorkspaceSegment(workspaceUser, 'user');
                    // Fold the selected build system (template) into the workspace identity so
                    // that, e.g., the Bazel and Make variants of the same app definition get
                    // separate persistent workspaces instead of sharing (and merging) one.
                    const appKey = buildSystemId ? `${appDefinition}-${buildSystemId}` : appDefinition;
                    const workspaceAppSegment = sanitizeWorkspaceSegment(appKey, 'app');

                    if (!gitUri) {
                        workspace =
                            'ws-' +
                            workspaceAppSegment +
                            '-playground-' +
                            workspaceUserSegment +
                            '-' +
                            createDeterministicId(`${workspaceUser}-${appKey}-playground`);
                        console.log(`Prepared persistent workspace ${workspace} for ${appDefinition} (playground fallback)`);
                    } else {
                        const repoName = gitUri
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
                            createDeterministicId(`${gitUri}${buildSystemId ? `-${buildSystemId}` : ''}`);
                        console.log(`Prepared persistent workspace ${workspace} for ${appDefinition}`);
                    }

                    const requestOptions: RequestOptions = {
                        timeout: 60000,
                        retries: 5,
                        accessToken: token
                    };

                    // Seed from the arbitrary env.<KEY> params (which now carry ARTEMIS_TOKEN,
                    // ARTEMIS_URL, and anything an external system provides), then apply the
                    // still-hardcoded git/template values, and set THEIA last so it stays guaranteed.
                    const envFromMap: Record<string, string> = { ...extraEnv };
                    if (gitUri) {
                        envFromMap.GIT_URI = gitUri;
                    }
                    if (gitUser) {
                        envFromMap.GIT_USER = gitUser;
                    }
                    if (gitMail) {
                        envFromMap.GIT_MAIL = gitMail;
                    }
                    if (buildSystemId) {
                        envFromMap.TEMPLATE = buildSystemId;
                    }
                    envFromMap.THEIA = 'true';
                    if (config.useGiteaOidc && token) {
                        // Passed to the session so it can clone the private Gitea repo. Do not log.
                        envFromMap.GIT_TOKEN = token;
                    }

                    const launchEnv = { fromMap: envFromMap };
                    const launchUser = config.useKeycloak ? email! : config.useGiteaOidc ? email! : user!;
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

                    // `useEphemeralStorage` means "prefer ephemeral when possible".
                    // App definitions that require a shared workspace are retried with a PVC-backed workspace.
                    // Template launches always use workspace-backed sessions so that env vars
                    // are set directly on the container (eager/ephemeral sessions inject env
                    // vars via data bridge which arrives after the entrypoint has already run).
                    const launchPromise =
                        config.useEphemeralStorage && !buildSystemId
                            ? (() => {
                                  console.log(`Attempting ephemeral launch for ${appDefinition}`);
                                  return TheiaCloud.launchAndRedirect(createEphemeralLaunchRequest(), requestOptions).catch(
                                      (err: Error) => {
                                          if (!isWorkspaceRequiredFallbackError(err)) {
                                              throw err;
                                          }

                                          console.log(
                                              `Ephemeral launch for ${appDefinition} requires a shared workspace, retrying with ${workspace}`
                                          );
                                          return TheiaCloud.launchAndRedirect(createWorkspaceLaunchRequest(), requestOptions);
                                      }
                                  );
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
        [config, gitUri, username, user, token, extraEnv, gitUser, gitMail, email]
    );

    const handleAppSelected = (appId: string, _: string): void => {
        const isStandaloneMode = !gitUri && Object.keys(extraEnv).length === 0;
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

        if (config.useGiteaOidc && !token) {
            autoStartRequestedRef.current = false;
            return;
        }

        // Auto-launch only for external deep links: the app definition must come from the
        // URL (not the always-truthy default), plus either at least one injected env var
        // (the Artemis case now carries ARTEMIS_TOKEN via env.*) or the Gitea OIDC + gitUri flow.
        if (
            appDefFromUrl &&
            selectedAppDefinition &&
            (Object.keys(extraEnv).length > 0 || (gitUri && config.useGiteaOidc))
        ) {
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
    }, [username, user, token, selectedAppDefinition, appDefFromUrl, gitUri, extraEnv, handleStartSession, config.useKeycloak, config.useGiteaOidc]);

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

    const loginWithGitea: () => void = (): void => {
        giteaLogin().catch(() => {
            console.error('Authentication Failed');
            setError('Authentication failed');
        });
    };

    const login = config.useGiteaOidc ? loginWithGitea : authenticate;
    const needsLogin = (config.useKeycloak || config.useGiteaOidc) && !token;
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

    const standaloneAppBuildSystems =
        config.additionalApps?.find(a => (a.serviceAuthToken || a.appId) === standaloneAppDef)?.buildSystems ?? [];

    return (
        <div className='App'>
            <VantaBackground>
                <Header
                    email={config.useKeycloak || config.useGiteaOidc ? email : undefined}
                    authenticate={config.useKeycloak || config.useGiteaOidc ? login : undefined}
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
                                        <LoginButton login={login} />
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
