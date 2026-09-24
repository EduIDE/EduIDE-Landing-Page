/**
 * Local type extensions for @eclipse-theiacloud/common
 * These extend the npm package types with EduIDE-specific functionality
 */

import type { AppDefinition, TheiaCloudConfig } from '@eclipse-theiacloud/common';

/**
 * Footer link configuration structure
 */
export interface FooterLinksConfig {
    attribution?: {
        text?: string;
        url?: string;
        version?: string;
    };
    bugReport?: {
        text: string;
        url: string;
        target?: string;
        rel?: string;
    };
    featureRequest?: {
        text: string;
        url: string;
        target?: string;
        rel?: string;
    };
    about?: {
        text: string;
        url: string;
        target?: string;
        rel?: string;
    };
}

/**
 * A single build system option for a language app
 */
export interface BuildSystemOption {
    id: string;
    label: string;
}

/**
 * Extended AppDefinition with service authentication token
 * Bridges the gap between the package's ServiceConfig and legacy usage
 */
export type ExtendedAppDefinition = AppDefinition & {
    serviceAuthToken?: string;
    buildSystems?: BuildSystemOption[];
    image?: string;
    Image?: string;
    visible?: boolean;
};

/**
 * What the privacy page may state about this installation.
 *
 * Every field except scientificUse is derived by the Helm chart from the value
 * that actually produces the behaviour - the garbage collector's WORKSPACE_TTL,
 * landingPage.ephemeralStorage, appDefinitions.defaults.timeout. They are not
 * restated anywhere, so a retention change cannot leave this page asserting the
 * old figure.
 *
 * All fields are optional: an installation running an older chart sends none of
 * them, and the page falls back to the TUM production values it has always
 * shown.
 */
export interface PrivacyConfig {
    /** False when the workspace volume is discarded together with the session. */
    workspacePersistent?: boolean;
    /** False when no garbage collector runs, so workspaces are not reaped on a schedule. */
    workspaceGarbageCollected?: boolean;
    /** Days a workspace is kept after its last session. */
    workspaceRetentionDays?: number;
    /** Hard cap on a single session, in minutes. */
    sessionMaxMinutes?: number;
    /** Idle minutes after which a session is shut down. */
    sessionIdleMinutes?: number;
    /** Whether anonymised usage data may also be used for scientific research. */
    scientificUse?: boolean;
    /**
     * Who is accountable for the data. Not derivable from anything - only the
     * operator knows - so the chart ships obvious placeholders rather than a
     * guess, and an unconfigured installation renders visibly unfilled instead
     * of naming the wrong institution.
     */
    controller?: {
        organisation?: string;
        representative?: string;
        address?: string;
        email?: string;
    };
    /** The data protection officer, a distinct contact point under the GDPR. */
    dataProtectionOfficer?: {
        name?: string;
        email?: string;
    };
}

/**
 * Extended TheiaCloudConfig with additional EduIDE properties
 * Uses intersection type since TheiaCloudConfig is a type alias
 */
export type ExtendedTheiaCloudConfig = Omit<TheiaCloudConfig, 'additionalApps'> & {
    additionalApps?: ExtendedAppDefinition[];
    footerLinks?: FooterLinksConfig;
    pageTitle?: string;
    sentryEnable?: boolean;
    sentryEnvironment?: string;
    sentryDsn?: string;
    privacy?: PrivacyConfig;
};

/**
 * Helper to get service auth token from config or app definition
 * Handles both 'appId' (from npm package) and 'serviceAuthToken' (legacy)
 */
export function getServiceAuthToken(config: TheiaCloudConfig | ExtendedTheiaCloudConfig | ExtendedAppDefinition): string {
    if ('serviceAuthToken' in config && typeof config.serviceAuthToken === 'string') {
        return config.serviceAuthToken;
    }
    if ('appId' in config && typeof config.appId === 'string') {
        return config.appId;
    }
    throw new Error('Unable to extract service auth token from config');
}
