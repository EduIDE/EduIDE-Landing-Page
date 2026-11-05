import type { FooterLinksConfig } from '../common-extensions/types';

interface FooterProps {
    selectedAppDefinition: string;
    onNavigate?: (page: 'home' | 'imprint' | 'privacy') => void;
    footerLinks?: FooterLinksConfig;
}

const ISSUES_URL = 'https://github.com/EduIDE/EduIDE-Cloud/issues';

interface ConfiguredLinkProps {
    link?: { text: string; url: string; target?: string; rel?: string };
    fallback: { text: string; url: string };
    icon?: string;
    className?: string;
}

const ConfiguredLink = ({ link, fallback, icon = '', className }: ConfiguredLinkProps): React.JSX.Element => (
    <a href={(link ?? fallback).url} target={link?.target || '_blank'} rel={link?.rel || 'noreferrer'} className={className}>
        {icon}
        {(link ?? fallback).text}
    </a>
);

export const Footer = ({ selectedAppDefinition, onNavigate, footerLinks }: FooterProps): React.JSX.Element => {
    const handleNavigation = (page: 'home' | 'imprint' | 'privacy'): void => {
        if (onNavigate) {
            onNavigate(page);
        } else {
            // Fallback to URL navigation
            window.location.href = page === 'home' ? '/' : `/${page}`;
        }
    };

    return (
        <div className='App__footer'>
            {selectedAppDefinition !== '' && (
                <p>
                    <label htmlFor='selectapp'> {selectedAppDefinition} </label>
                </p>
            )}

            <div className='App__footer__content'>
                <div className='App__footer__attribution'>
                    <a href={footerLinks?.attribution?.url || 'https://aet.cit.tum.de/'} target='_blank' rel='noreferrer'>
                        {footerLinks?.attribution?.text || 'Built by TUM AET Team 👨‍💻'}
                    </a>
                    <span className='App__footer__separator'> · </span>
                    <span>{footerLinks?.attribution?.version || 'v1.0.0'}</span>
                </div>

                <div className='App__footer__issues'>
                    <ConfiguredLink link={footerLinks?.bugReport} fallback={{ text: 'Report a bug', url: ISSUES_URL }} icon='🐞 ' />
                    {' or '}
                    <ConfiguredLink
                        link={footerLinks?.featureRequest}
                        fallback={{ text: 'Request a feature', url: ISSUES_URL }}
                        icon='💡 '
                    />
                </div>

                <div className='App__footer__legal'>
                    <ConfiguredLink
                        link={footerLinks?.about}
                        fallback={{ text: 'About', url: 'https://aet.cit.tum.de/' }}
                        className='App__footer__link'
                    />
                    <span className='App__footer__separator'>|</span>
                    <button onClick={() => handleNavigation('imprint')} className='App__footer__link App__footer__button'>
                        Imprint
                    </button>
                    <span className='App__footer__separator'>|</span>
                    <button onClick={() => handleNavigation('privacy')} className='App__footer__link App__footer__button'>
                        Privacy
                    </button>
                </div>
            </div>
        </div>
    );
};
