import { describe, expect, it } from 'vitest';

import { checkGitLaunchUri, gitLinkKind, gitSourceOf, repositoryName, sanitizeGitRef } from './git-launch';

describe('checkGitLaunchUri', () => {
    it('accepts an HTTPS link to an allowed host', () => {
        expect(checkGitLaunchUri('https://github.com/org/repo.git')).toBeUndefined();
        expect(checkGitLaunchUri('https://git.example/org/repo', { allowedHosts: [' Git.Example '] })).toBeUndefined();
    });

    it('accepts GitLab by default and an Artemis host from trustedHosts', () => {
        expect(checkGitLaunchUri('https://gitlab.com/group/sub/repo.git')).toBeUndefined();
        expect(checkGitLaunchUri('https://artemis.example/o/r.git', { trustedHosts: ['artemis.example'] })).toBeUndefined();
    });

    it('counts a port as part of the host only when the list has it', () => {
        expect(checkGitLaunchUri('https://git.example:3000/o/r.git', { allowedHosts: ['git.example:3000'] })).toBeUndefined();
        expect(checkGitLaunchUri('https://git.example:3000/o/r.git', { allowedHosts: ['git.example'] })).toMatch(/cannot be opened/);
    });

    it('never echoes credentials', () => {
        expect(checkGitLaunchUri('https://user:SECRET@evil.example/o/r.git')).not.toContain('SECRET');
    });

    it('accepts a backslash link, which the URL parser reads as a path', () => {
        expect(checkGitLaunchUri('https://github.com\\@evil.example/x.git')).toBeUndefined();
        expect(new URL('https://github.com\\@evil.example/x.git').href).toBe('https://github.com/@evil.example/x.git');
    });

    it.each([
        ['not a URL', 'not a url', /not a valid URL/],
        ['credentials', 'https://user:token@github.com/org/repo.git', /must not contain credentials/],
        ['a user name only', 'https://user@github.com/org/repo.git', /must not contain credentials/],
        ['plain HTTP', 'http://github.com/org/repo.git', /Only HTTPS/],
        ['SSH', 'ssh://git@github.com/org/repo.git', /credentials/],
        ['an unknown host', 'https://evil.example/org/repo.git', /evil\.example cannot be opened/],
        ['a look-alike host', 'https://github.com.evil.example/org/repo.git', /cannot be opened/],
        ['a host with a port', 'https://github.com:8443/org/repo.git', /cannot be opened/]
    ])('refuses %s', (_, uri, reason) => {
        expect(checkGitLaunchUri(uri)).toMatch(reason);
    });

    it('allows only the configured hosts', () => {
        expect(checkGitLaunchUri('https://gitlab.com/org/repo.git', { allowedHosts: ['github.com'] })).toMatch(/cannot be opened/);
    });
});

describe('git links off', () => {
    it('refuses every link while allowedGitHosts is empty', () => {
        expect(checkGitLaunchUri('https://github.com/o/r.git', { allowedHosts: [' '] })).toMatch(/not enabled/);
        expect(checkGitLaunchUri('https://artemis.example/o/r.git', { allowedHosts: [], trustedHosts: ['artemis.example'] })).toMatch(
            /not enabled/
        );
    });
});

describe('gitLinkKind', () => {
    const untrusted = { gitUri: 'https://git.example/o/r.git', artemisUrl: 'https://git.example', artemisToken: 't' };

    it('keeps an untrusted link with a token as legacy only while git links are off', () => {
        expect(gitLinkKind(untrusted, { allowedGitHosts: [] })).toBe('legacy');
        expect(gitLinkKind(untrusted, {})).toBe('external');
        expect(gitLinkKind({ ...untrusted, artemisToken: undefined }, { allowedGitHosts: [] })).toBe('external');
    });

    it('reports a trusted Artemis link as artemis either way', () => {
        expect(gitLinkKind(untrusted, { allowedGitHosts: [], trustedArtemisHosts: ['git.example'] })).toBe('artemis');
    });
});

describe('repositoryName', () => {
    it.each([
        ['https://github.com/org/repo.git', 'org/repo'],
        ['https://github.com/org/repo/', 'org/repo'],
        ['https://gitlab.com/group/sub/repo.git', 'group/sub/repo']
    ])('names %s as %s', (uri, name) => {
        expect(repositoryName(uri)).toBe(name);
    });

    it.each([undefined, '', 'https://github.com/org', 'not a url'])('has no name for %j', uri => {
        expect(repositoryName(uri)).toBeUndefined();
    });
});

describe('sanitizeGitRef', () => {
    it.each(['main', 'feature/x', 'v1.2.3', 'a1b2c3d'])('keeps %s', ref => {
        expect(sanitizeGitRef(ref)).toBe(ref);
    });

    it('trims spaces', () => {
        expect(sanitizeGitRef(' main ')).toBe('main');
    });

    it.each([undefined, '', '--upload-pack=x', 'a..b', 'a b', 'a~1', 'a^', 'a:b', 'a?', 'a*', 'a[b', 'a\\b', 'a@{1}', 'x'.repeat(256)])(
        'drops %j',
        ref => {
            expect(sanitizeGitRef(ref)).toBeUndefined();
        }
    );
});

describe('gitSourceOf', () => {
    const trusted = ['git.example'];

    it('is artemis for a trusted Artemis link', () => {
        expect(gitSourceOf('https://git.example/o/r.git', 'https://git.example', trusted)).toBe('artemis');
    });

    it.each([
        ['an untrusted repository host', 'https://github.com/o/r.git', 'https://git.example'],
        ['no Artemis URL', 'https://git.example/o/r.git', undefined]
    ])('is external for %s', (_, gitUri, artemisUrl) => {
        expect(gitSourceOf(gitUri, artemisUrl, trusted)).toBe('external');
    });

    it('is unset without a gitUri', () => {
        expect(gitSourceOf(undefined, 'https://git.example', trusted)).toBeUndefined();
    });
});
