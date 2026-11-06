import { getHostname } from '../launch';

interface LaunchAppProps {
    appName: string;
    appDefinition: string;
    gitUri?: string;
    onStartSession: (appDefinition: string) => void;
}
export const LaunchApp: React.FC<LaunchAppProps> = ({ appName, appDefinition, gitUri, onStartSession }: LaunchAppProps) => {
    const repositoryHost = getHostname(gitUri);
    return (
        <>
            {repositoryHost && <p className='App__launch-source'>This link opens a repository from {repositoryHost}.</p>}
            <button className='App__try-now-button' onClick={() => onStartSession(appDefinition)}>
                Launch {appName} &nbsp;&nbsp;&rarr;
            </button>
        </>
    );
};
