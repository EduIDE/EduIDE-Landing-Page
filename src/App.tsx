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
import { SelectBuildSystem } from './components/SelectBuildSystem';
import { VantaBackground } from './components/VantaBackground';

// global state to be kept between render calls
let initialized = false;
let initialAppName = '';
let initialAppDefinition = '';
let keycloakConfig: KeycloakConfig | undefined = undefined;

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
                url: config.keycloakAuthUrl,
                realm: config.keycloakRealm!,
                clientId: config.keycloakClientId!
            };
            const keycloak = new Keycloak(keycloakConfig);

            keycloak
                .init({
                    onLoad: 'check-sso',
                    redirectUri: window.location.href,
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
        (appDefinition: string, buildSystemId?: string): void => {
            setLoading(true);
            setError(undefined);

            TheiaCloud.ping(PingRequest.create(config.serviceUrl, getServiceAuthToken(config)))
                .then(() => {
                    let workspace: string | undefined;

                    if (config.useEphemeralStorage) {
                        workspace = undefined;
                    } else {
                        if (!gitUri) {
                            if (buildSystemId) {
                                workspace = 'ws-' + appDefinition + '-standalone-' + (config.useKeycloak ? username : user);
                            } else {
                                workspace = undefined;
                            }
                        } else {
                            const repoName = gitUri?.split('/').pop()?.split('-')[0] ?? Math.random().toString().substring(2, 10);
                            workspace = 'ws-' + appDefinition + '-' + repoName + '-' + (config.useKeycloak ? username : user);
                        }
                    }

                    const requestOptions: RequestOptions = {
                        timeout: 60000,
                        retries: 5,
                        accessToken: token
                    };

                    const envFromMap: Record<string, string> = {
                        THEIA: 'true',
                        ARTEMIS_TOKEN: artemisToken!,
                        ARTEMIS_URL: artemisUrl!,
                        GIT_URI: gitUri!,
                        GIT_USER: gitUser!,
                        GIT_MAIL: gitMail!
                    };
                    if (buildSystemId) {
                        envFromMap.STANDALONE_MODE = 'true';
                        envFromMap.BUILD_SYSTEM = buildSystemId;
                    }

                    const launchRequest = {
                        serviceUrl: config.serviceUrl,
                        appId: getServiceAuthToken(config),
                        user: config.useKeycloak ? email! : user!,
                        appDefinition: appDefinition,
                        workspaceName: workspace,
                        env: {
                            fromMap: envFromMap
                        }
                    } satisfies LaunchRequest;

                    TheiaCloud.launchAndRedirect(launchRequest, requestOptions)
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

    const handleAppSelected = (appId: string, appName: string): void => {
        const isStandaloneMode = !artemisToken && !gitUri;
        if (isStandaloneMode) {
            const appDef = config.additionalApps?.find(a => (a.serviceAuthToken || a.appId) === appId);
            const buildSystems = appDef?.buildSystems ?? [];
            if (buildSystems.length <= 1) {
                handleStartSession(appId, buildSystems[0]?.id ?? 'none');
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

    document.title = config.pageTitle || 'TUM Theia Cloud';

    const authenticate: () => void = (): void => {
        const keycloak = new Keycloak(keycloakConfig);
        const redirectUri = window.location.origin + window.location.pathname + window.location.search;

        keycloak
            .init({
                redirectUri,
                checkLoginIframe: false
            })
            .then((authenticated: boolean) => {
                if (!authenticated) {
                    keycloak.login({
                        redirectUri,
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
        return additionalApps.map(def => def.serviceAuthToken).filter(serviceAuthToken => serviceAuthToken === defaultSelection).length > 0;
    }
    // If there are no additional apps explicitly configured, we accept any app definition given via url parameter
    return true;
}

export default App;
