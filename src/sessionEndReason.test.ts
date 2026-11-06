import { describe, expect, it } from 'vitest';

import { findSessionEndReason } from './sessionEndReason';

const LAUNCHED_AT = Date.parse('2026-11-06T10:00:00Z');

function workspace(name: string, reason?: string, time?: string): any {
    return { name, label: name, user: 'ada', active: false, lastSessionEndReason: reason, lastSessionEndTime: time };
}

describe('findSessionEndReason', () => {
    it.each(['inactivity', 'lifetime'])('reads %s from the launched workspace', reason => {
        const workspaces = [workspace('other', 'lifetime', '2026-11-06T11:00:00Z'), workspace('ws-a', reason, '2026-11-06T11:00:00Z')];
        expect(findSessionEndReason(workspaces, 'ws-a', LAUNCHED_AT)).toBe(reason);
    });

    it('ignores a stamp from an earlier session', () => {
        expect(findSessionEndReason([workspace('ws-a', 'inactivity', '2026-11-06T09:00:00Z')], 'ws-a', LAUNCHED_AT)).toBeUndefined();
    });

    it.each([
        ['an unknown reason', workspace('ws-a', 'deleted', '2026-11-06T11:00:00Z')],
        ['a missing time', workspace('ws-a', 'inactivity')],
        ['no stamp at all', workspace('ws-a')]
    ])('gives no reason for %s', (_, ws) => {
        expect(findSessionEndReason([ws], 'ws-a', LAUNCHED_AT)).toBeUndefined();
    });

    it('gives no reason when the workspace is missing', () => {
        expect(findSessionEndReason([], 'ws-a', LAUNCHED_AT)).toBeUndefined();
    });
});
