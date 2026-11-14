import './App.css';

import { getTheiaCloudConfig, LaunchRequest, PingRequest, RequestOptions, TheiaCloud } from '@eclipse-theiacloud/common';
import Keycloak, { KeycloakConfig } from 'keycloak-js';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ExtendedAppDefinition, ExtendedTheiaCloudConfig } from './common-extensions/types';
import { getServiceAuthToken } from './common-extensions/types';
import { AppLogo } from './components/AppLogo';
import { ConfirmIdentity } from './components/ConfirmIdentity';
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
import { SessionEnded } from './components/SessionEnded';
import type { LastLaunch, LaunchInputs } from './lastLaunch';
import { clearLastLaunch, readLastLaunch, saveLastLaunch } from './lastLaunch';
import { createAnonymousUser, createLaunchEnv, createWorkspaceName, isTrustedArtemisLink, launchWithRetry } from './launch';
import type { SessionEndReason } from './sessionEndReason';
import { findSessionEndReason } from './sessionEndReason';

// global state to be kept between render calls
let initialized = false;
let initialAppName = '';
let initialAppDefinition = '';
let keycloakConfig: KeycloakConfig | undefined = undefined;
// Holds the signed-in client, so a launch can refresh its token.
let keycloakClient: Keycloak | undefined = undefined;
// Matches the gateway's request timeout (gateway.serviceRouteRequestTimeout in the chart).
const LAUNCH_REQUEST_TIMEOUT = 60000;

// Drop the fragment: after login it holds Keycloak's state/code, and Keycloak rejects any redirect URI with a fragment (breaks logout).
function getCurrentRedirectUri(): string {
    return window.location.href.split('#')[0];
}

type Page = 'home' | 'imprint' | 'privacy' | 'sessionEnded';

function pageFromPath(pathname: string): Page {
    const path = pathname.replace(/\/+$/, '');
    if (path === '/imprint') {
        return 'imprint';
    }
    if (path === '/privacy') {
        return 'privacy';
    }
    return path === '/session-ended' ? 'sessionEnded' : 'home';
}

function App(): React.JSX.Element {
    const [config] = useState<ExtendedTheiaCloudConfig | undefined>(() => getTheiaCloudConfig());
    const [error, setError] = useState<string>();
    const [loading, setLoading] = useState(false);
    // Read synchronously, so the auto-start effect already knows on its first run that this is /session-ended.
    const [currentPage, setCurrentPage] = useState<Page>(() => pageFromPath(window.location.pathname));

    // Handle URL routing
    useEffect(() => {
        const updatePageFromUrl = (): void => setCurrentPage(pageFromPath(window.location.pathname));

        // Listen for browser back/forward navigation
        window.addEventListener('popstate', updatePageFromUrl);

        return () => {
            window.removeEventListener('popstate', updatePageFromUrl);
        };
    }, []);

    // Navigation handler that updates both state and URL
    const handleNavigation = (page: 'home' | 'imprint' | 'privacy'): void => {
        const path = page === 'home' ? '/' : `/${page}`;

        // Keep the query: a later login returns to this URL, and it holds the exercise link.
        window.history.pushState({}, '', path + window.location.search);

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
    // In anonymous mode the workspace identity must be confirmed before use.
    // suggestedUser holds the (untrusted) value proposed via `?user=`.
    const [identityConfirmed, setIdentityConfirmed] = useState<boolean>(false);
    const [suggestedUser, setSuggestedUser] = useState<string>();

    const [gitUri, setGitUri] = useState<string>();
    const [gitUser, setGitUser] = useState<string>();
    const [gitMail, setGitMail] = useState<string>();
    const [artemisToken, setArtemisToken] = useState<string>();
    const [artemisUrl, setArtemisUrl] = useState<string>();

    const [autoStart, setAutoStart] = useState<boolean>(false);
    const [invalidAppDef, setInvalidAppDef] = useState<boolean>(false);
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
                setInvalidAppDef(true);
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

        // Workspace identity for anonymous mode (Keycloak disabled).
        //
        // The `?user=` query parameter is untrusted: because the persistent
        // workspace is addressed deterministically from the identity, silently
        // adopting `?user=<victim>` would drop the visitor into the victim's
        // workspace. So we do NOT auto-adopt it. If it is present we surface it
        // for explicit confirmation (see ConfirmIdentity); if it is absent we
        // mint a fresh random anonymous identity, which is not spoofable and
        // therefore needs no confirmation. With Keycloak enabled the identity
        // comes from the verified token and this gate does not apply.
        if (!config.useKeycloak) {
            const userParam = urlParams.get('user')?.trim();
            if (userParam) {
                setSuggestedUser(userParam);
            } else {
                setUser(createAnonymousUser());
                setIdentityConfirmed(true);
            }
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
                        applyLogin(keycloak);
                    }
                })
                .catch(() => {
                    console.error('Authentication Failed');
                });
        }
        initialized = true;
    }

    const applyLogin = (client: Keycloak): void => {
        const parsedToken = client.idTokenParsed;
        if (parsedToken) {
            const userMail = parsedToken.email;
            keycloakClient = client;
            setToken(client.idToken);
            setEmail(userMail);
            setUsername(parsedToken.preferred_username ?? userMail);
            setLogoutUrl(client.createLogoutUrl());
        }
    };

    const handleStartSession = useCallback(
        // Resume passes the stored inputs as `replay`. Setting them as state first would not reach
        // this callback before it runs, and the workspace name would come out different.
        (appDefinition: string, buildSystemId?: string, replay?: LaunchInputs): void => {
            const inputs: LaunchInputs = replay ?? { gitUri, gitUser, gitMail, artemisUrl, artemisToken, anonymousUser: user };
            setLoading(true);
            setError(undefined);

            const launchSession = (accessToken: string | undefined): void => {
                TheiaCloud.ping(PingRequest.create(config.serviceUrl, getServiceAuthToken(config)))
                    .then(() => {
                        // ping successful continue with launch
                        const workspaceUser = config.useKeycloak ? username : inputs.anonymousUser;
                        const workspace = createWorkspaceName(appDefinition, buildSystemId, workspaceUser, inputs.gitUri);

                        const requestOptions: RequestOptions = {
                            timeout: LAUNCH_REQUEST_TIMEOUT,
                            retries: 0,
                            accessToken
                        };

                        const envFromMap = createLaunchEnv({ ...inputs, buildSystemId });

                        const launchEnv = { fromMap: envFromMap };
                        const launchUser = config.useKeycloak ? (email ?? username)! : inputs.anonymousUser!;
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
                        const tryEphemeral = config.useEphemeralStorage && !buildSystemId;
                        const rememberLaunch = (ephemeral: boolean): void =>
                            saveLastLaunch({
                                ...inputs,
                                anonymousUser: config.useKeycloak ? undefined : inputs.anonymousUser,
                                appDefinition,
                                buildSystemId,
                                ephemeral
                            });
                        rememberLaunch(tryEphemeral);

                        const launchPromise = tryEphemeral
                            ? (() => {
                                  console.log(`Attempting ephemeral launch for ${appDefinition}`);
                                  return launchWithRetry(() =>
                                      TheiaCloud.launchAndRedirect(createEphemeralLaunchRequest(), requestOptions)
                                  ).catch((err: Error) => {
                                      if (!isWorkspaceRequiredFallbackError(err)) {
                                          throw err;
                                      }

                                      console.log(
                                          `Ephemeral launch for ${appDefinition} requires a shared workspace, retrying with ${workspace}`
                                      );
                                      rememberLaunch(false);
                                      return launchWithRetry(() =>
                                          TheiaCloud.launchAndRedirect(createWorkspaceLaunchRequest(), requestOptions)
                                      );
                                  });
                              })()
                            : (() => {
                                  console.log(`Launching ${appDefinition} with persistent workspace ${workspace}`);
                                  return launchWithRetry(() =>
                                      TheiaCloud.launchAndRedirect(createWorkspaceLaunchRequest(), requestOptions)
                                  );
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
                                    // The ended session can still be shutting down and count against the per-user limit.
                                    setError('Your previous session is still shutting down.\nPlease try again in a few seconds.');
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
            };

            // A page left open outlives the login token, so refresh it right before using it.
            const accessTokenPromise = keycloakClient
                ? keycloakClient.updateToken(30).then(() => keycloakClient?.idToken)
                : Promise.resolve(undefined);

            accessTokenPromise.then(launchSession, () => {
                keycloakClient = undefined;
                setToken(undefined);
                setError('Your login has expired. Please log in again.');
                setLoading(false);
            });
        },
        [config, gitUri, username, user, artemisToken, artemisUrl, gitUser, gitMail, email]
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

    // Only Keycloak users can list their workspaces, and only a stored launch says which one ended.
    const [sessionEndReason, setSessionEndReason] = useState<SessionEndReason>();
    useEffect(() => {
        const launch = currentPage === 'sessionEnded' ? readLastLaunch() : undefined;
        if (!config?.useKeycloak || !username || !keycloakClient || !launch || launch.ephemeral) {
            return;
        }
        const workspace = createWorkspaceName(launch.appDefinition, launch.buildSystemId, username, launch.gitUri);
        const client = keycloakClient;
        client
            .updateToken(30)
            .then(() =>
                TheiaCloud.Workspace.listWorkspaces(
                    { serviceUrl: config.serviceUrl, appId: getServiceAuthToken(config), user: email ?? username },
                    { accessToken: client.idToken }
                )
            )
            .then(workspaces => setSessionEndReason(findSessionEndReason(workspaces, workspace, launch.savedAt)))
            .catch(() => {
                // The general explanation stays.
            });
    }, [config, currentPage, username, email]);

    const handleConfirmIdentity = (confirmedUser: string): void => {
        setUser(confirmedUser);
        setIdentityConfirmed(true);
    };

    useEffect(() => {
        if (!initialized) {
            return;
        }

        if (config.useKeycloak && !username) {
            autoStartRequestedRef.current = false;
            return;
        }

        // Resuming an ended session always takes a click.
        if (currentPage === 'sessionEnded') {
            autoStartRequestedRef.current = false;
            return;
        }

        // Do not auto-launch in anonymous mode until the identity is confirmed.
        if (!config.useKeycloak && !identityConfirmed) {
            autoStartRequestedRef.current = false;
            return;
        }

        if (selectedAppDefinition && gitUri && artemisToken && !invalidAppDef) {
            setAutoStart(true);
            // Anyone can write a link with a token in it, so only trusted hosts start without a click.
            if (!autoStartRequestedRef.current && isTrustedArtemisLink(gitUri, artemisUrl, config.trustedArtemisHosts)) {
                autoStartRequestedRef.current = true;
                handleStartSession(selectedAppDefinition);
            }
        } else {
            autoStartRequestedRef.current = false;
            setAutoStart(false);
        }
    }, [
        username,
        user,
        selectedAppDefinition,
        gitUri,
        artemisToken,
        artemisUrl,
        invalidAppDef,
        handleStartSession,
        config.useKeycloak,
        config.trustedArtemisHosts,
        identityConfirmed,
        currentPage
    ]);

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
                    applyLogin(keycloak);
                }
            })
            .catch(() => {
                console.error('Authentication Failed');
                setError('Authentication failed');
            });
    };

    const needsLogin = config.useKeycloak && !token;
    const needsIdentityConfirmation = !config.useKeycloak && !identityConfirmed;
    const logoFileExtension = config.logoFileExtension ?? 'svg';

    if (currentPage === 'imprint') {
        return (
            <div className='App'>
                <Imprint onNavigate={handleNavigation} />
            </div>
        );
    }

    if (currentPage === 'privacy') {
        return (
            <div className='App'>
                <Privacy onNavigate={handleNavigation} />
            </div>
        );
    }

    const isSessionEnded = currentPage === 'sessionEnded';
    const lastLaunch = isSessionEnded ? readLastLaunch() : undefined;
    const resume = (launch: LastLaunch): void => handleStartSession(launch.appDefinition, launch.buildSystemId, launch);
    const startNew = (): void => {
        clearLastLaunch();
        handleNavigation('home');
    };

    const standaloneAppBuildSystems =
        config.additionalApps?.find(a => (a.serviceAuthToken || a.appId) === standaloneAppDef)?.buildSystems ?? [];

    return (
        <div className='App'>
            <Header
                email={config.useKeycloak ? email : undefined}
                authenticate={config.useKeycloak ? authenticate : undefined}
                logoutUrl={config.useKeycloak ? logoutUrl : undefined}
            />
            <div className='body'>
                {loading ? (
                    <Loading text={config.loadingText} />
                ) : (
                    <div>
                        <div>
                            <div style={{ marginTop: '2rem' }}></div>
                            <AppLogo fileExtension={logoFileExtension} />
                            <h2 className='App__title'>
                                {isSessionEnded
                                    ? 'Your session has ended'
                                    : needsLogin
                                      ? 'Login to use EduIDE'
                                      : needsIdentityConfirmation
                                        ? 'Confirm your identity'
                                        : autoStart
                                          ? 'Launch your Online IDE'
                                          : standaloneWizardStep === 'buildSystem'
                                            ? 'Choose your build system'
                                            : 'Choose your programming language'}
                            </h2>
                            <div>
                                {needsLogin ? (
                                    <LoginButton login={authenticate} />
                                ) : isSessionEnded ? (
                                    <SessionEnded
                                        lastLaunch={lastLaunch}
                                        reason={sessionEndReason}
                                        onResume={resume}
                                        onStartNew={startNew}
                                    />
                                ) : needsIdentityConfirmation ? (
                                    <ConfirmIdentity suggestedUser={suggestedUser ?? ''} onConfirm={handleConfirmIdentity} />
                                ) : autoStart ? (
                                    <LaunchApp
                                        appName={selectedAppName}
                                        appDefinition={selectedAppDefinition}
                                        gitUri={gitUri}
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
        </div>
    );
}

function isDefaultSelectionValueValid(defaultSelection: string, appDefinition: string, additionalApps?: ExtendedAppDefinition[]): boolean {
    if (defaultSelection === appDefinition) {
        return true;
    }
    if (additionalApps && additionalApps.length > 0) {
        return additionalApps.some(def => (def.serviceAuthToken || def.appId) === defaultSelection);
    }
    // If there are no additional apps explicitly configured, we accept any app definition given via url parameter
    return true;
}

export default App;
