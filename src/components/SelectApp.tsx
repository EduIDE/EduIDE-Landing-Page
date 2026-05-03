import React from 'react';

import type { ExtendedAppDefinition } from '../common-extensions/types';
import { AppMode } from '../common-extensions/types';

interface SelectAppProps {
  appDefinitions: ExtendedAppDefinition[] | undefined;
  onSelectApp: (appId: string, appName: string) => void;
  appMode: AppMode;
}

function normalizeLogoName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

function getAppLogoSrc(app: ExtendedAppDefinition): string {
  const configuredImage = app.image ?? app.Image;

  if (!configuredImage || configuredImage.trim().length === 0) {
    return `/assets/logos/${normalizeLogoName(app.appName)}-logo.png`;
  }

  const trimmedImage = configuredImage.trim();

  if (trimmedImage.startsWith('/')) {
    return trimmedImage;
  }

  if (/\.(png|svg|jpe?g|webp|gif)$/i.test(trimmedImage)) {
    return `/assets/logos/${trimmedImage}`;
  }

  return `/assets/logos/${normalizeLogoName(trimmedImage)}-logo.png`;
}

export const SelectApp: React.FC<SelectAppProps> = ({ appDefinitions, onSelectApp, appMode }: SelectAppProps) => (
  <div className='App__grid'>
    {appDefinitions &&
      appDefinitions
        .filter(app => app.visible !== false)
        .map((app, index) => {
          const disabled = appMode === AppMode.AI && !app.aiVariant;
          const token = appMode === AppMode.AI && app.aiVariant ? app.aiVariant : app.serviceAuthToken || app.appId;
          return (<button
            key={index}
            className={`App__grid-item${disabled ? ' App__grid-item--disabled' : ''}`}
            onClick={() => onSelectApp(token, app.appName)}
            disabled={disabled}
            data-testid={`launch-app-${app.serviceAuthToken || app.appId}`}
          >
            <img src={getAppLogoSrc(app)} alt={`${app.appName} logo`} className='App__grid-item-logo' />
            <div className='App__grid-item-launch'>Select</div>
            <div className='App__grid-item-text'>{app.appName}</div>
          </button>);
        })}
  </div>
);

