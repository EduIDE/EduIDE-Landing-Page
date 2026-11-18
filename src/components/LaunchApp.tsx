import { getHostname } from '../launch';
import { PersistenceBadge } from './PersistenceBadge';

interface LaunchAppProps {
    appName: string;
    appDefinition: string;
    gitUri?: string;
    ephemeral?: boolean;
    onStartSession: (appDefinition: string) => void;
    /** Button text instead of "Launch <appName>". */
    label?: string;
}
export const LaunchApp: React.FC<LaunchAppProps> = ({
    appName,
    appDefinition,
    gitUri,
    ephemeral,
    onStartSession,
    label
}: LaunchAppProps) => {
    const repositoryHost = getHostname(gitUri);
    return (
        <>
            {repositoryHost && <p className='App__launch-source'>This link opens a repository from {repositoryHost}.</p>}
            {ephemeral !== undefined && (
                <p className='App__launch-persistence'>
                    <PersistenceBadge ephemeral={ephemeral} inline />
                </p>
            )}
            <button className='App__try-now-button' onClick={() => onStartSession(appDefinition)}>
                {label ?? `Launch ${appName}`} &nbsp;&nbsp;&rarr;
            </button>
        </>
    );
};
