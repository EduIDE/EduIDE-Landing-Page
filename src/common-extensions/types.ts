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
  buildSystems?: BuildSystemOption[]
};

/**
 * Extended TheiaCloudConfig with additional EduIDE properties
 * Uses intersection type since TheiaCloudConfig is a type alias
 */
export type ExtendedTheiaCloudConfig = Omit<TheiaCloudConfig, 'additionalApps'> & {
  additionalApps?: ExtendedAppDefinition[];
  footerLinks?: FooterLinksConfig;
  pageTitle?: string;
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
