interface LaunchAppProps {
    appName: string;
    appDefinition: string;
    onStartSession: (appDefinition: string) => void;
    /** Button text instead of "Launch <appName>". */
    label?: string;
}
export const LaunchApp: React.FC<LaunchAppProps> = ({ appName, appDefinition, onStartSession, label }: LaunchAppProps) => (
    <button className='App__try-now-button' onClick={() => onStartSession(appDefinition)}>
        {label ?? `Launch ${appName}`} &nbsp;&nbsp;&rarr;
    </button>
);
