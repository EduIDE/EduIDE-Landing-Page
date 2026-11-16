import React from 'react';

import type { ExtendedAppDefinition } from '../common-extensions/types';
import { isEphemeralLaunch } from '../launch';
import { PersistenceBadge } from './PersistenceBadge';

interface SelectAppProps {
    appDefinitions: ExtendedAppDefinition[] | undefined;
    useEphemeralStorage: boolean;
    onSelectApp: (appId: string, appName: string) => void;
}

function normalizeLogoName(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '-');
}

function getAppLogoSrc(app: ExtendedAppDefinition): string {
    const configuredImage = app.image;

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

export const SelectApp: React.FC<SelectAppProps> = ({ appDefinitions, useEphemeralStorage, onSelectApp }: SelectAppProps) => (
    <div className='App__grid'>
        {appDefinitions &&
            appDefinitions
                .filter(app => app.visible !== false)
                .map((app, index) => {
                    const id = app.serviceAuthToken || app.appId;
                    return (
                        <button
                            key={index}
                            className='App__grid-item'
                            onClick={() => onSelectApp(id, app.appName)}
                            data-testid={`launch-app-${id}`}
                            aria-describedby={`persistence-${id}`}
                        >
                            <img src={getAppLogoSrc(app)} alt={`${app.appName} logo`} className='App__grid-item-logo' />
                            <div className='App__grid-item-launch'>Select</div>
                            <div className='App__grid-item-text'>{app.appName}</div>
                            <PersistenceBadge ephemeral={isEphemeralLaunch(app, useEphemeralStorage)} tooltipId={`persistence-${id}`} />
                        </button>
                    );
                })}
    </div>
);
