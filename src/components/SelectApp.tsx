import type { ExtendedAppDefinition } from '../common-extensions/types';

interface SelectAppProps {
  appDefinitions: ExtendedAppDefinition[] | undefined;
  onStartSession: (appDefinition: string) => void;
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

export const SelectApp: React.FC<SelectAppProps> = ({ appDefinitions, onStartSession }: SelectAppProps) => (
  <div className='App__grid'>
    {appDefinitions &&
        appDefinitions.map((app, index) => (
          <button
            key={index}
            className='App__grid-item'
            onClick={() => onStartSession(app.serviceAuthToken || app.appId)}
            data-testid={`launch-app-${app.serviceAuthToken || app.appId}`}
          >
            <img
              src={getAppLogoSrc(app)}
              alt={`${app.appName} logo`}
              className='App__grid-item-logo'
            />
            <div className='App__grid-item-launch'>Launch</div>
            <div className='App__grid-item-text'>{app.appName}</div>
          </button>
        ))}
  </div>
);
