import { describe, expect, it } from 'vitest';

import { checkGitLaunchUri, repositoryName, sanitizeGitRef, sanitizeGitSource, sessionEnvFromConfig } from './git-launch';

describe('checkGitLaunchUri', () => {
    it('accepts an HTTPS link to an allowed host', () => {
        expect(checkGitLaunchUri('https://github.com/org/repo.git')).toBeUndefined();
        expect(checkGitLaunchUri('https://git.example/org/repo', [' Git.Example '])).toBeUndefined();
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

    it('allows only github.com by default', () => {
        expect(checkGitLaunchUri('https://gitlab.com/org/repo.git')).toMatch(/cannot be opened/);
    });
});

describe('repositoryName', () => {
    it.each([
        ['https://github.com/org/repo.git', 'org/repo'],
        ['https://github.com/org/repo/', 'org/repo'],
        ['https://github.com/org/repo/tree/main', 'org/repo']
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

describe('sanitizeGitSource', () => {
    it.each([
        ['artemis', 'artemis'],
        ['GitHub', 'github'],
        [' other ', 'other']
    ])('maps %j to %s', (source, expected) => {
        expect(sanitizeGitSource(source)).toBe(expected);
    });

    it.each([undefined, '', 'gitlab'])('drops %j', source => {
        expect(sanitizeGitSource(source)).toBeUndefined();
    });
});

describe('sessionEnvFromConfig', () => {
    it('keeps string values with environment variable names', () => {
        expect(sessionEnvFromConfig({ SCORPIO_GITHUB_CLIENT_ID: 'id', lower: 'x', 'BAD-NAME': 'x', NUMBER: 1, _OK: 'y' })).toEqual({
            SCORPIO_GITHUB_CLIENT_ID: 'id',
            _OK: 'y'
        });
    });

    it.each([undefined, 'text', 42])('is empty for %j', value => {
        expect(sessionEnvFromConfig(value)).toEqual({});
    });
});
