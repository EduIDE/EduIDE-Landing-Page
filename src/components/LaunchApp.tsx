import { getHostname } from '../launch';

interface LaunchAppProps {
    appName: string;
    appDefinition: string;
    gitUri?: string;
    onStartSession: (appDefinition: string) => void;
    /** Button text instead of "Launch <appName>". */
    label?: string;
}
export const LaunchApp: React.FC<LaunchAppProps> = ({ appName, appDefinition, gitUri, onStartSession, label }: LaunchAppProps) => {
    const repositoryHost = getHostname(gitUri);
    return (
        <>
            {repositoryHost && <p className='App__launch-source'>This link opens a repository from {repositoryHost}.</p>}
            <button className='App__try-now-button' onClick={() => onStartSession(appDefinition)}>
                {label ?? `Launch ${appName}`} &nbsp;&nbsp;&rarr;
            </button>
        </>
    );
};
