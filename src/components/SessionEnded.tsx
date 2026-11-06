import type { LastLaunch } from '../lastLaunch';
import type { SessionEndReason } from '../sessionEndReason';

interface SessionEndedProps {
    lastLaunch?: LastLaunch;
    reason?: SessionEndReason;
    onResume: (lastLaunch: LastLaunch) => void;
    onStartNew: () => void;
}

const REASON_TEXT: Record<SessionEndReason, string> = {
    inactivity: 'Your session closed after a period without activity.',
    lifetime: 'Your session reached the maximum time a session may run and was closed.'
};

// The gateway redirects here when a request hits a session that no longer exists.
export const SessionEnded = ({ lastLaunch, reason, onResume, onStartNew }: SessionEndedProps): React.JSX.Element => {
    const canResume = lastLaunch !== undefined && !lastLaunch.ephemeral;

    return (
        <div className='App__session-ended'>
            <p>
                {reason
                    ? REASON_TEXT[reason]
                    : 'Your session is no longer running. Sessions close after a period without activity, or when they reach the maximum time a session may run.'}
            </p>
            {lastLaunch === undefined ? (
                <p>To continue, choose your environment again or follow the link from your exercise.</p>
            ) : canResume ? (
                <p>
                    Your files are saved in your workspace. Resuming opens the same workspace again. Terminals, servers and debug sessions
                    have stopped and need to be started again.
                </p>
            ) : (
                <p>This session ran without a persistent workspace, so its files could not be kept.</p>
            )}
            <div className='App__session-ended-actions'>
                {canResume && (
                    <button className='App__try-now-button' onClick={() => onResume(lastLaunch)}>
                        Resume my session
                    </button>
                )}
                <button className='App__try-now-button' onClick={onStartNew}>
                    {canResume ? 'Start something else' : 'Start a new session'}
                </button>
            </div>
        </div>
    );
};
