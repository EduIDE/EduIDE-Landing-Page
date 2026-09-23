import './SessionEnded.css';

import React, { useCallback, useEffect, useState } from 'react';

import type { LaunchDescriptor } from '../lastLaunch';
import { MAX_CONSECUTIVE_AUTO_RESUMES, readAutoResumeCount, recordAutoResume, resetAutoResumeCount } from '../lastLaunch';

export type SessionEndedReason = 'inactivity' | 'lifetime' | undefined;

interface SessionEndedProps {
    reason: SessionEndedReason;
    descriptor?: LaunchDescriptor;
    onResume: (descriptor: LaunchDescriptor) => void;
    onStartNew: () => void;
}

const COUNTDOWN_SECONDS = 5;

/** The student is actually looking at this tab - not merely that it is the active tab in a hidden window. */
function isInForeground(): boolean {
    return document.visibilityState === 'visible' && document.hasFocus();
}

function describeReason(reason: SessionEndedReason): string {
    switch (reason) {
        case 'inactivity':
            return 'Your session was closed because it had been idle for a while. Idle sessions are shut down so the computing resources go to students who are working.';
        case 'lifetime':
            return 'Your session reached the maximum time a single session may run and was closed.';
        default:
            return 'Your session is no longer running. This usually means it was closed after being idle, or it reached the maximum time a session may run.';
    }
}

/**
 * Shown after the gateway redirects a request for a session that no longer exists, and after the
 * IDE sends the browser here when it knows the session is ending.
 *
 * The automatic resume only fires while the tab is genuinely in front of the student - visible AND
 * focused. A backgrounded tab waits, so an abandoned one never starts a pod on its own.
 */
export const SessionEnded: React.FC<SessionEndedProps> = ({ reason, descriptor, onResume, onStartNew }) => {
    const canResume = descriptor !== undefined;
    // An ephemeral session had no volume, so there is no work to return to - only a fresh start.
    const workPreserved = canResume && !descriptor.ephemeral;
    const autoResumeAllowed = workPreserved && readAutoResumeCount() < MAX_CONSECUTIVE_AUTO_RESUMES;

    const [countdown, setCountdown] = useState<number | undefined>(undefined);
    const [cancelled, setCancelled] = useState(false);
    const [foreground, setForeground] = useState(() => isInForeground());

    const resume = useCallback(
        (automatic: boolean): void => {
            if (!descriptor) {
                return;
            }
            if (automatic) {
                recordAutoResume();
            } else {
                resetAutoResumeCount();
            }
            onResume(descriptor);
        },
        [descriptor, onResume]
    );

    // Hold until the student is actually looking at this tab.
    useEffect(() => {
        if (!autoResumeAllowed || cancelled || countdown !== undefined) {
            return;
        }

        const startIfInFront = (): void => {
            if (isInForeground()) {
                setCountdown(COUNTDOWN_SECONDS);
            }
        };

        startIfInFront();
        window.addEventListener('visibilitychange', startIfInFront);
        window.addEventListener('focus', startIfInFront);

        return () => {
            window.removeEventListener('visibilitychange', startIfInFront);
            window.removeEventListener('focus', startIfInFront);
        };
    }, [autoResumeAllowed, cancelled, countdown]);

    // Tracks the foreground state so the countdown effect re-evaluates when it changes.
    useEffect(() => {
        const sync = (): void => setForeground(isInForeground());
        window.addEventListener('visibilitychange', sync);
        window.addEventListener('focus', sync);
        window.addEventListener('blur', sync);

        return () => {
            window.removeEventListener('visibilitychange', sync);
            window.removeEventListener('focus', sync);
            window.removeEventListener('blur', sync);
        };
    }, []);

    useEffect(() => {
        if (countdown === undefined || cancelled) {
            return;
        }

        // The foreground check is re-made on every tick, not just when the countdown starts. A
        // student who switches away mid-countdown must not have a pod started behind their back -
        // the countdown simply stands still until they come back.
        if (!isInForeground()) {
            return;
        }

        if (countdown <= 0) {
            resume(true);
            return;
        }

        const timer = window.setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [countdown, cancelled, resume, foreground]);

    const cancelAutoResume = (): void => {
        setCancelled(true);
        setCountdown(undefined);
        resetAutoResumeCount();
    };

    return (
        <div className='session-ended'>
            <div className='session-ended__card'>
                <h1>Your session has ended</h1>
                <p className='session-ended__reason'>{describeReason(reason)}</p>

                {canResume ? (
                    workPreserved ? (
                        <p className='session-ended__work session-ended__work--preserved'>
                            Your files are saved in your workspace. Resuming opens the same workspace again, with your work as you left it.
                            Anything that was only running - terminals, servers, debug sessions - has stopped and needs to be started again.
                        </p>
                    ) : (
                        <p className='session-ended__work session-ended__work--lost'>
                            This session ran without a persistent workspace, so its files could not be kept. Starting again gives you a
                            fresh environment.
                        </p>
                    )
                ) : (
                    <p className='session-ended__work session-ended__work--preserved'>
                        We no longer have the details of your last session in this tab, so we cannot reopen it for you. Pick your
                        environment below, or follow the link from your exercise again.
                    </p>
                )}

                <div className='session-ended__actions'>
                    {workPreserved && (
                        <button className='session-ended__btn session-ended__btn--primary' onClick={() => resume(false)}>
                            Resume my session
                        </button>
                    )}
                    <button className='session-ended__btn session-ended__btn--secondary' onClick={onStartNew}>
                        {workPreserved ? 'Start something else' : 'Start a new session'}
                    </button>
                </div>

                {countdown !== undefined && !cancelled && (
                    <p className='session-ended__countdown'>
                        {foreground ? `Resuming automatically in ${countdown}s.` : 'Resuming when you return to this tab.'}{' '}
                        <button className='session-ended__btn session-ended__btn--secondary' onClick={cancelAutoResume}>
                            Cancel
                        </button>
                    </p>
                )}
            </div>
        </div>
    );
};
