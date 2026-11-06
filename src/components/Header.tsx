import './Header.css';

import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
    email?: string;
    authenticate?: () => void;
    logoutUrl?: string;
}

export const Header = ({ email, authenticate, logoutUrl }: HeaderProps): React.JSX.Element => (
    <div className='header'>
        <div className='header__app-name'>
            <h1 className='header__title'>EduIDE Cloud</h1>
        </div>
        <div className='header__actions'>
            <ThemeToggle />
            {email ? (
                <div className='header__user-info'>
                    <span className='header__email'>{email}</span>
                </div>
            ) : authenticate ? (
                <button className='header__login-btn' onClick={authenticate}>
                    Login
                </button>
            ) : undefined}
            {logoutUrl && (
                <button className='header__logout-btn' onClick={() => (window.location.href = logoutUrl)} data-testid='logoutButton'>
                    Logout
                </button>
            )}
        </div>
    </div>
);
