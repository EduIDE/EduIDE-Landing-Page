import { getHostname } from '../launch';
import { PersistenceBadge } from './PersistenceBadge';

interface LaunchAppProps {
    appName: string;
    appDefinition: string;
    gitUri?: string;
    ephemeral?: boolean;
    onStartSession: (appDefinition: string) => void;
}
export const LaunchApp: React.FC<LaunchAppProps> = ({ appName, appDefinition, gitUri, ephemeral, onStartSession }: LaunchAppProps) => {
    const repositoryHost = getHostname(gitUri);
    return (
        <>
            {repositoryHost && <p className='App__launch-source'>This link opens a repository from {repositoryHost}.</p>}
            {ephemeral !== undefined && (
                <p className='App__launch-persistence'>
                    <PersistenceBadge ephemeral={ephemeral} />
                </p>
            )}
            <button className='App__try-now-button' onClick={() => onStartSession(appDefinition)}>
                Launch {appName} &nbsp;&nbsp;&rarr;
            </button>
        </>
    );
};
