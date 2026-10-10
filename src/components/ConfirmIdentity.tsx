import { useState } from 'react';

interface ConfirmIdentityProps {
    suggestedUser: string;
    onConfirm: (user: string) => void;
}

// Shown in anonymous mode (Keycloak disabled) when the workspace identity comes
// from the untrusted `?user=` query parameter. Workspaces are personal and
// persistent, so the identity is surfaced and must be confirmed explicitly
// instead of being adopted silently from the URL.
export const ConfirmIdentity: React.FC<ConfirmIdentityProps> = ({ suggestedUser, onConfirm }: ConfirmIdentityProps) => {
    const [value, setValue] = useState<string>(suggestedUser);
    const trimmed = value.trim();

    const submit = (): void => {
        if (trimmed.length > 0) {
            onConfirm(trimmed);
        }
    };

    return (
        <div className='App__confirm-identity'>
            <p>
                This link opens a personal, persistent workspace as <strong className='App__confirm-identity-name'>{suggestedUser}</strong>.
                Confirm the username you want to use before continuing.
            </p>
            <input
                className='App__confirm-identity-input'
                type='text'
                value={value}
                onChange={event => setValue(event.target.value)}
                onKeyDown={event => {
                    if (event.key === 'Enter') {
                        submit();
                    }
                }}
                aria-label='Username'
                autoComplete='off'
                spellCheck={false}
            />
            <button className='App__try-now-button' type='button' onClick={submit} disabled={trimmed.length === 0}>
                Continue as this user
            </button>
        </div>
    );
};
