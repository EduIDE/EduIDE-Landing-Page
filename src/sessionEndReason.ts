export type SessionEndReason = 'inactivity' | 'lifetime';

// EduIDE-Cloud's operator stamps these on the workspace when it stops a session. The published
// client types predate them.
interface StampedWorkspace {
    name: string;
    lastSessionEndReason?: string;
    lastSessionEndTime?: string;
}

export function findSessionEndReason(
    workspaces: StampedWorkspace[],
    workspaceName: string,
    launchedAt: number
): SessionEndReason | undefined {
    const workspace = workspaces.find(w => w.name === workspaceName);
    const reason = workspace?.lastSessionEndReason;
    if (reason !== 'inactivity' && reason !== 'lifetime') {
        return undefined;
    }
    // A stamp from before this tab's launch belongs to an earlier session on the same workspace.
    return Date.parse(workspace?.lastSessionEndTime ?? '') >= launchedAt ? reason : undefined;
}
