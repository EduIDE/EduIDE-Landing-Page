import { describe, expect, it, vi } from 'vitest';

import {
    createAnonymousUser,
    createLaunchEnv,
    createWorkspaceName,
    isEphemeralLaunch,
    isTrustedArtemisLink,
    launchWithRetry,
    requireSessionUrl
} from './launch';

const noWait = (): Promise<void> => Promise.resolve();
const failure = (status: number, code?: string): object => ({ status, originalError: { code } });

describe('launchWithRetry', () => {
    it.each([
        ['a gateway timeout', failure(504)],
        ['a bad gateway', failure(502)],
        ['an unavailable service', failure(503)],
        ['a client timeout, reported as 500 without a response', failure(500, 'ECONNABORTED')],
        ['a network error', failure(500, 'ERR_NETWORK')]
    ])('tries again after %s', async (_, error) => {
        const launch = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('url');
        await expect(launchWithRetry(launch, noWait)).resolves.toBe('url');
        expect(launch).toHaveBeenCalledTimes(2);
    });

    it.each([
        [400, failure(400)],
        [401, failure(401)],
        [473, failure(473)],
        [500, failure(500)]
    ])('does not repeat a %i', async (_, error) => {
        const launch = vi.fn().mockRejectedValue(error);
        await expect(launchWithRetry(launch, noWait)).rejects.toBe(error);
        expect(launch).toHaveBeenCalledTimes(1);
    });

    it('tries again when the service answers without a session URL', async () => {
        const launch = vi.fn().mockResolvedValueOnce('').mockResolvedValue('session.example');
        await expect(launchWithRetry(() => requireSessionUrl(launch()), noWait)).resolves.toBe('session.example');
        expect(launch).toHaveBeenCalledTimes(2);
    });

    it('gives up after five attempts and waits between them', async () => {
        const error = failure(504);
        const launch = vi.fn().mockRejectedValue(error);
        const wait = vi.fn(noWait);
        await expect(launchWithRetry(launch, wait)).rejects.toBe(error);
        expect(launch).toHaveBeenCalledTimes(5);
        expect(wait).toHaveBeenCalledTimes(4);
    });
});

describe('isTrustedArtemisLink', () => {
    const git = 'https://artemis.example/git/p/r.git';
    const artemis = 'https://artemis.example';

    it('needs both hosts on the list', () => {
        expect(isTrustedArtemisLink(git, artemis, ['artemis.example'])).toBe(true);
        expect(isTrustedArtemisLink('https://evil.example/r.git', artemis, ['artemis.example'])).toBe(false);
        expect(isTrustedArtemisLink(git, 'https://evil.example', ['artemis.example'])).toBe(false);
        expect(isTrustedArtemisLink(git, undefined, ['artemis.example'])).toBe(false);
    });

    it('trusts nothing by default', () => {
        expect(isTrustedArtemisLink(git, artemis)).toBe(false);
    });

    it('is not fooled by look-alike hosts or embedded credentials', () => {
        expect(isTrustedArtemisLink('https://artemis.example@evil.example/r.git', artemis, ['artemis.example'])).toBe(false);
        expect(isTrustedArtemisLink('https://artemis.example.evil.example/r.git', artemis, ['artemis.example'])).toBe(false);
    });

    it('rejects a value that is not a URL', () => {
        expect(isTrustedArtemisLink('git@artemis.example:r.git', artemis, ['artemis.example'])).toBe(false);
    });

    it('ignores the case and spacing of the configured hosts', () => {
        expect(isTrustedArtemisLink(git, artemis, [' Artemis.Example '])).toBe(true);
    });
});

describe('createWorkspaceName', () => {
    const repo = 'https://git.example/org/repo.git';

    it('separates users that share the first 12 characters', () => {
        expect(createWorkspaceName('java', undefined, 'alexandra-miller', repo)).not.toBe(
            createWorkspaceName('java', undefined, 'alexandra-milner', repo)
        );
    });

    it('separates apps that share the first 12 characters', () => {
        expect(createWorkspaceName('java-17-templates-a', undefined, 'ada', repo)).not.toBe(
            createWorkspaceName('java-17-templates-b', undefined, 'ada', repo)
        );
    });

    it('stays the same for the same input', () => {
        expect(createWorkspaceName('java', 'maven', 'ada', repo)).toBe(createWorkspaceName('java', 'maven', 'ada', repo));
    });
});

describe('createAnonymousUser', () => {
    it('creates a different id each time', () => {
        expect(createAnonymousUser()).toMatch(/^anonymous-[0-9a-f]{16}$/);
        expect(createAnonymousUser()).not.toBe(createAnonymousUser());
    });
});

describe('createWorkspaceName with a ref', () => {
    const name = (gitRef?: string): string => createWorkspaceName('java-17', undefined, 'ada', 'https://github.com/o/r.git', gitRef);

    it('separates workspaces by ref and keeps the name without one', () => {
        expect(name('main')).not.toBe(name('solution'));
        expect(name('main')).not.toBe(name());
        // The name main gave this link before refs existed: changing it would orphan existing workspaces.
        expect(name()).toBe('ws-java-17-r-ada-24716729');
    });
});

describe('createLaunchEnv', () => {
    it('passes gitRef and gitSource as GIT_REF and GIT_SOURCE', () => {
        expect(createLaunchEnv({ gitUri: 'https://github.com/o/r.git', gitRef: 'main', gitSource: 'external' })).toEqual({
            THEIA: 'true',
            GIT_URI: 'https://github.com/o/r.git',
            GIT_REF: 'main',
            GIT_SOURCE: 'external'
        });
    });

    it('leaves out what the link does not set', () => {
        expect(createLaunchEnv({})).toEqual({ THEIA: 'true' });
    });
});

describe('isEphemeralLaunch', () => {
    it.each([
        [undefined, true, true],
        [undefined, false, false],
        [{}, true, true],
        [{ ephemeral: false }, true, false],
        [{ ephemeral: true }, false, true],
        [{ ephemeral: 'false' }, true, true],
        [{ ephemeral: 'true' }, false, false]
    ])('app %j with installation default %s gives %s', (app, installation, expected) => {
        expect(isEphemeralLaunch(app, installation)).toBe(expected);
    });
});
