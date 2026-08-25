import { User, UserManager, WebStorageStateStore } from 'oidc-client-ts';

import type { ExtendedTheiaCloudConfig } from './common-extensions/types';

// Session storage key used to preserve the original query string (gitUri/appDef/...)
// across the OIDC redirect round trip. The redirect_uri registered in Gitea is a
// static origin + pathname without query params, so the deep-link parameters would
// otherwise be lost when Gitea redirects back to the landing page.
const GITEA_REDIRECT_SEARCH_KEY = 'eduide.gitea.redirectSearch';

// Capture the URL the page was loaded with. On a redirect callback this still holds
// the `code`/`state` query params that oidc-client-ts needs to complete the login,
// even after we restore the original query string via history.replaceState.
const initialHref = window.location.href;

let userManager: UserManager | undefined;
let currentUser: User | undefined;

function getRedirectUri(): string {
    return window.location.origin + window.location.pathname;
}

/**
 * Lazily create the shared UserManager from the landing page config.
 * Relies on Gitea OIDC discovery at `<giteaIssuerUrl>/.well-known/openid-configuration`.
 */
export function initGitea(config: ExtendedTheiaCloudConfig): UserManager {
    if (userManager) {
        return userManager;
    }

    userManager = new UserManager({
        authority: config.giteaIssuerUrl ?? '',
        client_id: config.giteaClientId ?? '',
        redirect_uri: getRedirectUri(),
        response_type: 'code',
        scope: 'openid email profile read:repository',
        // PKCE is enabled by default for the authorization code flow.
        userStore: new WebStorageStateStore({ store: window.sessionStorage })
    });

    return userManager;
}

/** True when the current URL is an OIDC redirect callback (contains `code` and `state`). */
export function isGiteaRedirectCallback(): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.has('code') && params.has('state');
}

/**
 * When returning from the OIDC redirect, restore the original query string (gitUri/appDef/...)
 * that was saved before the redirect. This rewrites the browser URL via history.replaceState
 * so the synchronous query-param parsing in App picks the deep-link parameters back up.
 * Returns the restored search string (may be empty).
 */
export function restoreGiteaRedirectSearch(): string {
    if (!isGiteaRedirectCallback()) {
        return window.location.search;
    }

    const savedSearch = window.sessionStorage.getItem(GITEA_REDIRECT_SEARCH_KEY) ?? '';
    window.sessionStorage.removeItem(GITEA_REDIRECT_SEARCH_KEY);
    window.history.replaceState({}, '', window.location.origin + window.location.pathname + savedSearch);
    return savedSearch;
}

/**
 * Complete a login if returning from a redirect, otherwise attempt a silent sign-in.
 * Returns the authenticated user or null.
 */
export async function giteaCheckSso(): Promise<User | undefined> {
    if (!userManager) {
        return undefined;
    }

    try {
        if (isGiteaRedirectCallback()) {
            currentUser = await userManager.signinRedirectCallback(initialHref);
            return currentUser;
        }

        const existing = await userManager.getUser();
        if (existing && !existing.expired) {
            currentUser = existing;
            return currentUser;
        }

        const silent = await userManager.signinSilent();
        currentUser = silent ?? undefined;
        return currentUser;
    } catch (error) {
        console.error('Gitea SSO check failed', error);
        return undefined;
    }
}

/**
 * Start the interactive login. Preserves the current query string across the redirect
 * so that gitUri/appDef survive the round trip.
 */
export async function giteaLogin(): Promise<void> {
    if (!userManager) {
        return;
    }

    window.sessionStorage.setItem(GITEA_REDIRECT_SEARCH_KEY, window.location.search);

    try {
        await userManager.signinRedirect();
    } catch (error) {
        console.error('Gitea login failed', error);
        throw error;
    }
}

export function getGiteaAccessToken(): string | undefined {
    return currentUser?.access_token;
}

export function getGiteaEmail(): string | undefined {
    return currentUser?.profile?.email;
}

export function getGiteaPreferredUsername(): string | undefined {
    return currentUser?.profile?.preferred_username;
}
