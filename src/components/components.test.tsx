import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServiceAuthToken } from '../common-extensions/types';
import { ThemeProvider } from '../contexts/ThemeContext';
import { useTheme } from '../contexts/useTheme';
import { AppLogo } from './AppLogo';
import { ConfirmIdentity } from './ConfirmIdentity';
import { ErrorComponent } from './ErrorComponent';
import { Footer } from './Footer';
import { Header } from './Header';
import { Imprint } from './Imprint';
import { Info } from './Info';
import { LaunchApp } from './LaunchApp';
import { Loading } from './Loading';
import { LoginButton } from './LoginButton';
import { Privacy } from './Privacy';
import { SelectApp } from './SelectApp';
import { SelectBuildSystem } from './SelectBuildSystem';
import { Spinner } from './Spinner';
import { ThemeToggle } from './ThemeToggle';

function stubLocation(): { href: string } {
    const location = { href: '' };
    vi.stubGlobal('location', location);
    return location;
}

function logoOf(name: string): string | null {
    return screen.getByRole('img', { name: `${name} logo` }).getAttribute('src');
}

describe('SelectApp', () => {
    it('hides only apps with visible: false', () => {
        render(
            <SelectApp
                appDefinitions={[
                    { appId: 'default', appName: 'Default' },
                    { appId: 'shown', appName: 'Shown', visible: true },
                    { appId: 'hidden', appName: 'Hidden', visible: false }
                ]}
                onSelectApp={vi.fn()}
            />
        );
        screen.getByText('Default');
        screen.getByText('Shown');
        expect(screen.queryByText('Hidden')).toBeNull();
    });

    it.each([
        ['derives from the app name', { appName: 'Java 17  Plus' }, '/assets/logos/java-17-plus-logo.png'],
        ['ignores a blank image', { appName: 'Java', image: '   ' }, '/assets/logos/java-logo.png'],
        ['resolves a plain name', { appName: 'Java', image: 'Open JDK' }, '/assets/logos/open-jdk-logo.png'],
        ['keeps a filename', { appName: 'Java', image: 'jdk.SVG' }, '/assets/logos/jdk.SVG'],
        ['keeps an absolute path', { appName: 'Java', image: '/custom/logo.png' }, '/custom/logo.png']
    ])('logo %s', (_, app, expected) => {
        render(<SelectApp appDefinitions={[{ appId: 'id', ...app }]} onSelectApp={vi.fn()} />);
        expect(screen.getByRole('img').getAttribute('src')).toBe(expected);
    });

    it('selects by serviceAuthToken, falling back to appId', () => {
        const onSelectApp = vi.fn();
        render(
            <SelectApp
                appDefinitions={[
                    { serviceAuthToken: 'token', appId: 'ignored', appName: 'New' },
                    { appId: 'legacy', appName: 'Old' }
                ]}
                onSelectApp={onSelectApp}
            />
        );
        fireEvent.click(screen.getByText('New'));
        fireEvent.click(screen.getByText('Old'));
        expect(onSelectApp.mock.calls).toEqual([
            ['token', 'New'],
            ['legacy', 'Old']
        ]);
    });

    it('renders nothing selectable without apps', () => {
        render(<SelectApp appDefinitions={undefined} onSelectApp={vi.fn()} />);
        expect(screen.queryByRole('button')).toBeNull();
    });
});

describe('SelectBuildSystem', () => {
    const BUILD_SYSTEMS = [
        { id: 'Make File', label: 'GNU Make' },
        { id: 'bazel', label: 'Bazel' }
    ];

    it('derives logos from the id, not the label', () => {
        render(<SelectBuildSystem buildSystems={BUILD_SYSTEMS} onSelect={vi.fn()} onBack={vi.fn()} />);
        screen.getByText('GNU Make');
        expect(logoOf('Make File')).toBe('/assets/logos/make-file-logo.png');
    });

    it('reports the selected id and the way back', () => {
        const onSelect = vi.fn();
        const onBack = vi.fn();
        render(<SelectBuildSystem buildSystems={BUILD_SYSTEMS} onSelect={onSelect} onBack={onBack} />);
        fireEvent.click(screen.getByText('Bazel'));
        expect(onSelect).toHaveBeenCalledWith('bazel');
        fireEvent.click(screen.getByRole('button', { name: /Back/ }));
        expect(onBack).toHaveBeenCalledOnce();
    });
});

describe('LaunchApp', () => {
    it('starts the given app definition', () => {
        const onStartSession = vi.fn();
        render(<LaunchApp appName='Java' appDefinition='java-17' onStartSession={onStartSession} />);
        fireEvent.click(screen.getByRole('button', { name: /Launch Java/ }));
        expect(onStartSession).toHaveBeenCalledWith('java-17');
    });
});

describe('ConfirmIdentity', () => {
    const renderConfirm = (suggestedUser = 'ada'): ReturnType<typeof vi.fn> => {
        const onConfirm = vi.fn();
        render(<ConfirmIdentity suggestedUser={suggestedUser} onConfirm={onConfirm} />);
        return onConfirm;
    };

    it('names the suggested user and confirms it only on request', () => {
        const onConfirm = renderConfirm();
        screen.getByText('ada');
        expect(onConfirm).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Continue as this user' }));
        expect(onConfirm).toHaveBeenCalledWith('ada');
    });

    it('confirms an edited, trimmed name with Enter', () => {
        const onConfirm = renderConfirm();
        const input = screen.getByLabelText('Username');
        fireEvent.change(input, { target: { value: '  grace ' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onConfirm).toHaveBeenCalledWith('grace');
    });

    it('refuses a blank name', () => {
        const onConfirm = renderConfirm();
        const input = screen.getByLabelText('Username');
        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Continue as this user' }).disabled).toBe(true);
        expect(onConfirm).not.toHaveBeenCalled();
    });
});

describe('ErrorComponent', () => {
    it('shows a message, and nothing without one', () => {
        const { container, rerender } = render(<ErrorComponent />);
        expect(container.innerHTML).toBe('');
        rerender(<ErrorComponent message='kaputt' />);
        screen.getByText('ERROR: kaputt');
    });
});

describe('Footer', () => {
    it('falls back to the default links and shows no made-up version', () => {
        render(<Footer selectedAppDefinition='' />);
        expect(screen.getByRole('link', { name: /Built by TUM AET Team/ }).getAttribute('href')).toBe('https://aet.cit.tum.de/');
        expect(screen.getByRole('link', { name: /Report a bug/ }).getAttribute('href')).toBe(
            'https://github.com/EduIDE/EduIDE-Cloud/issues'
        );
        screen.getByRole('link', { name: /Request a feature/ });
        screen.getByRole('link', { name: 'About' });
        expect(screen.queryByText('·')).toBeNull();
    });

    it('uses the configured links and version', () => {
        render(
            <Footer
                selectedAppDefinition=''
                footerLinks={{
                    attribution: { text: 'Built by us', url: 'https://us.example', version: 'v9' },
                    bugReport: { text: 'Bugs', url: 'https://bugs.example' },
                    featureRequest: { text: 'Ideas', url: 'https://ideas.example', target: '_self', rel: 'nofollow' },
                    about: { text: 'Us', url: 'https://about.example' }
                }}
            />
        );
        expect(screen.getByRole('link', { name: 'Built by us' }).getAttribute('href')).toBe('https://us.example');
        screen.getByText('v9');
        const bugs = screen.getByRole('link', { name: /Bugs/ });
        expect([bugs.getAttribute('href'), bugs.getAttribute('target'), bugs.getAttribute('rel')]).toEqual([
            'https://bugs.example',
            '_blank',
            'noreferrer'
        ]);
        const ideas = screen.getByRole('link', { name: /Ideas/ });
        expect([ideas.getAttribute('target'), ideas.getAttribute('rel')]).toEqual(['_self', 'nofollow']);
        expect(screen.getByRole('link', { name: 'Us' }).getAttribute('href')).toBe('https://about.example');
    });

    it('labels the selected app definition only when there is one', () => {
        const { rerender } = render(<Footer selectedAppDefinition='' />);
        expect(screen.queryByText('java-17')).toBeNull();
        rerender(<Footer selectedAppDefinition='java-17' />);
        screen.getByText('java-17');
    });

    it('navigates through onNavigate, or the URL without it', () => {
        const onNavigate = vi.fn();
        const { rerender } = render(<Footer selectedAppDefinition='' onNavigate={onNavigate} />);
        fireEvent.click(screen.getByRole('button', { name: 'Imprint' }));
        fireEvent.click(screen.getByRole('button', { name: 'Privacy' }));
        expect(onNavigate.mock.calls).toEqual([['imprint'], ['privacy']]);

        const location = stubLocation();
        rerender(<Footer selectedAppDefinition='' />);
        fireEvent.click(screen.getByRole('button', { name: 'Privacy' }));
        expect(location.href).toBe('/privacy');
    });
});

describe('Header', () => {
    const renderHeader = (props: React.ComponentProps<typeof Header>): void => {
        render(
            <ThemeProvider>
                <Header {...props} />
            </ThemeProvider>
        );
    };

    it('shows neither login nor user without Keycloak', () => {
        renderHeader({});
        screen.getByRole('heading', { name: 'EduIDE Cloud' });
        expect(screen.queryByRole('button', { name: 'Login' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Logout' })).toBeNull();
    });

    it('offers login until the user is known', () => {
        const authenticate = vi.fn();
        renderHeader({ authenticate });
        fireEvent.click(screen.getByRole('button', { name: 'Login' }));
        expect(authenticate).toHaveBeenCalledOnce();
    });

    it('shows the user instead of login, and logs out through the logout URL', () => {
        const location = stubLocation();
        renderHeader({ email: 'ada@example.org', authenticate: vi.fn(), logoutUrl: 'https://keycloak.example/logout' });
        screen.getByText('ada@example.org');
        expect(screen.queryByRole('button', { name: 'Login' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
        expect(location.href).toBe('https://keycloak.example/logout');
    });
});

describe('Info', () => {
    it('adapts the defaults to whether login is needed', () => {
        const { rerender } = render(<Info usesLogin={true} />);
        screen.getByText('Login & launch Session');
        screen.getByText(/top right corner to login/);
        rerender(<Info usesLogin={false} />);
        screen.getByText('Launch session');
        expect(screen.queryByText(/top right corner to login/)).toBeNull();
    });

    it('prefers configured texts and can be disabled', () => {
        const { container, rerender } = render(<Info usesLogin={false} title='Title' text='Text' />);
        screen.getByText('Title');
        screen.getByText('Text');
        rerender(<Info usesLogin={false} title='Title' disable={true} />);
        expect(container.innerHTML).toBe('');
    });
});

describe('Loading and Spinner', () => {
    it('shows the default or the configured text with a spinner', () => {
        const { container, rerender } = render(<Loading />);
        screen.getByText(/hang in tight/);
        expect(container.querySelector('.circular-spinner')).not.toBeNull();
        rerender(<Loading text='Please wait' />);
        screen.getByText('Please wait');
    });

    it('Spinner renders on its own', () => {
        const { container } = render(<Spinner />);
        expect(container.querySelector('.circular-spinner')).not.toBeNull();
    });
});

describe('LoginButton', () => {
    it('logs in', () => {
        const login = vi.fn();
        render(<LoginButton login={login} />);
        fireEvent.click(screen.getByRole('button', { name: 'Login' }));
        expect(login).toHaveBeenCalledOnce();
    });
});

describe('AppLogo', () => {
    it('uses the configured file extension', () => {
        const { container } = render(<AppLogo fileExtension='png' />);
        expect(container.querySelector('img')?.getAttribute('src')).toBe('/images/logos/theia-logo.png');
    });
});

describe('ThemeToggle', () => {
    const renderToggle = (): void => {
        render(
            <ThemeProvider>
                <ThemeToggle />
            </ThemeProvider>
        );
    };

    beforeEach(() => {
        localStorage.clear();
        document.documentElement.removeAttribute('data-theme');
    });

    it('starts light and toggles back and forth, remembering the choice', () => {
        renderToggle();
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');

        fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        expect(localStorage.getItem('theme')).toBe('dark');

        fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        expect(localStorage.getItem('theme')).toBe('light');
    });

    it('still works when the browser blocks storage', () => {
        const blocked = (): never => {
            throw new DOMException('blocked', 'SecurityError');
        };
        vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, clear: () => undefined });
        renderToggle();
        fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        vi.unstubAllGlobals();
    });

    it('ignores a saved theme it does not know', () => {
        localStorage.setItem('theme', 'neon');
        renderToggle();
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('follows the system preference without a saved choice', () => {
        vi.stubGlobal('matchMedia', () => ({ matches: true }));
        renderToggle();
        screen.getByRole('button', { name: 'Switch to light mode' });
    });

    it('prefers the saved choice over the system preference', () => {
        localStorage.setItem('theme', 'light');
        vi.stubGlobal('matchMedia', () => ({ matches: true }));
        renderToggle();
        screen.getByRole('button', { name: 'Switch to dark mode' });
    });

    it('useTheme refuses to work outside the provider', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const Consumer = (): React.JSX.Element => <span>{useTheme().theme}</span>;
        expect(() => render(<Consumer />)).toThrow('useTheme must be used within a ThemeProvider');
    });
});

describe('Imprint', () => {
    it('goes back through onNavigate, or the browser history without it', () => {
        const onNavigate = vi.fn();
        const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
        const { rerender } = render(<Imprint onNavigate={onNavigate} />);
        screen.getByRole('heading', { level: 1, name: 'Imprint' });
        fireEvent.click(screen.getByRole('button', { name: /Back/ }));
        expect(onNavigate).toHaveBeenCalledWith('home');
        expect(back).not.toHaveBeenCalled();

        rerender(<Imprint />);
        fireEvent.click(screen.getByRole('button', { name: /Back/ }));
        expect(back).toHaveBeenCalledOnce();
    });
});

describe('Privacy', () => {
    const renderPrivacy = (privacy?: unknown, onNavigate?: () => void): string => {
        vi.stubGlobal('theiaCloudConfig', {
            serviceAuthToken: 'token',
            appName: 'EduIDE',
            serviceUrl: 'https://service.example',
            appDefinition: 'app',
            useKeycloak: false,
            useEphemeralStorage: true,
            privacy
        });
        return render(<Privacy onNavigate={onNavigate} />).container.textContent ?? '';
    };

    it('goes back through onNavigate, or the browser history without it', () => {
        const onNavigate = vi.fn();
        const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
        renderPrivacy(undefined, onNavigate);
        fireEvent.click(screen.getByRole('button', { name: /Back/ }));
        expect(onNavigate).toHaveBeenCalledWith('home');
        expect(back).not.toHaveBeenCalled();
    });

    it('falls back to the history without onNavigate', () => {
        const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
        renderPrivacy();
        fireEvent.click(screen.getByRole('button', { name: /Back/ }));
        expect(back).toHaveBeenCalledOnce();
    });

    describe('scientificUse', () => {
        it('rules out research by default', () => {
            const text = renderPrivacy();
            expect(text).toContain('Data is processed solely');
            expect(text).toContain('ausschließlich');
            expect(text).not.toContain('Scientific use:');
            expect(text).not.toContain('Wissenschaftliche Nutzung:');
        });

        it('declares research when set', () => {
            const text = renderPrivacy({ scientificUse: true });
            expect(text).toContain('Anonymised usage data is additionally analysed');
            expect(text).toContain('Scientific use:');
            expect(text).toContain('Wissenschaftliche Nutzung:');
            expect(text).not.toContain('Data is processed solely');
        });
    });

    describe('contacts', () => {
        it('admits to having none rather than inventing one', () => {
            const text = renderPrivacy();
            expect(text).toContain('No data controller has been configured');
            expect(text).toContain('Für diese Installation wurde keine verantwortliche Stelle hinterlegt.');
            expect(text).toContain('No data protection officer has been configured');
        });

        it('needs both organisation and email for a controller', () => {
            expect(renderPrivacy({ controller: { email: 'dpo@example.org' } })).toContain('No data controller has been configured');
        });

        it('names the configured controller and officer', () => {
            const text = renderPrivacy({
                controller: { organisation: 'Uni', representative: 'The President', address: 'Main St', email: 'privacy@uni.example' },
                dataProtectionOfficer: { name: 'Dr. Who', email: 'dpo@uni.example' }
            });
            expect(text).toContain('The data controller within the meaning of the GDPR is Uni, represented by The President, Main St.');
            expect(text).toContain('privacy@uni.example');
            expect(text).toContain('The Data Protection Officer (Dr. Who) can be reached');
            expect(text).toContain('dpo@uni.example');
        });

        it('leaves out the optional controller fields when unset', () => {
            const text = renderPrivacy({ controller: { organisation: 'Uni', email: 'privacy@uni.example' } });
            expect(text).toContain('GDPR is Uni. For data protection');
        });
    });

    describe('retention', () => {
        it('states the production figures by default', () => {
            const text = renderPrivacy();
            expect(text).toContain('after 60 minutes without activity, and after 1 day at the latest');
            expect(text).toContain('nach 60 Minuten ohne Aktivität, spätestens nach einem Tag');
            expect(text).toContain(
                'Workspace data is discarded when the session ends; any remaining workspace records are removed after 14 days.'
            );
            expect(text).toContain('nach 14 Tagen entfernt');
        });

        it.each([
            [172800, '2 days', '2 Tagen'],
            [129600, '1.5 days', '1,5 Tagen'],
            [3600, '1 hour', 'einer Stunde'],
            [7200, '2 hours', '2 Stunden']
        ])('words a retention of %d seconds', (workspaceRetentionSeconds, en, de) => {
            const text = renderPrivacy({ workspacePersistent: true, workspaceRetentionSeconds });
            expect(text).toContain(`is deleted ${en} after the last session`);
            expect(text).toContain(`werden ${de} nach der letzten Sitzung`);
        });

        it.each([
            [2880, '2 days', '2 Tagen'],
            [60, '1 hour', 'einer Stunde'],
            [120, '2 hours', '2 Stunden'],
            [90, '90 minutes', '90 Minuten']
        ])('words a session cap of %d minutes', (sessionMaxMinutes, en, de) => {
            const text = renderPrivacy({ sessionMaxMinutes });
            expect(text).toContain(`and after ${en} at the latest`);
            expect(text).toContain(`spätestens nach ${de}`);
        });

        it('promises no deletion schedule without a garbage collector', () => {
            expect(renderPrivacy({ workspacePersistent: true, workspaceGarbageCollected: false })).toContain(
                'and is not deleted automatically.'
            );
        });

        it('mentions no leftover cleanup for discarded workspaces without a garbage collector', () => {
            expect(renderPrivacy({ workspacePersistent: false, workspaceGarbageCollected: false })).toContain(
                'Workspace data is discarded when the session ends.'
            );
        });
    });
});

describe('getServiceAuthToken', () => {
    it('prefers serviceAuthToken, then appId, and throws without either', () => {
        expect(getServiceAuthToken({ serviceAuthToken: 'token', appId: 'legacy', appName: 'App' })).toBe('token');
        expect(getServiceAuthToken({ appId: 'legacy', appName: 'App' })).toBe('legacy');
        expect(() => getServiceAuthToken({ appName: 'App' } as never)).toThrow('Unable to extract service auth token');
    });
});
