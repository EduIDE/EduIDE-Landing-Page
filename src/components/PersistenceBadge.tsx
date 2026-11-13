import { persistenceHint } from '../launch';

interface PersistenceBadgeProps {
    ephemeral: boolean;
    /** Id of the tooltip, so a focusable parent can point at it with aria-describedby. */
    tooltipId?: string;
    /** Print the hint as text after the badge instead of in a tooltip. */
    inline?: boolean;
}

export const PersistenceBadge: React.FC<PersistenceBadgeProps> = ({ ephemeral, tooltipId, inline }: PersistenceBadgeProps) => (
    <>
        <span className='App__badge' data-persistence={ephemeral ? 'temporary' : 'saved'}>
            {ephemeral ? 'Temporary' : 'Saved'}
            {/* aria-hidden: the parent's aria-describedby already reads it, so it must not be read twice as content. */}
            {!inline && (
                <span role='tooltip' id={tooltipId} className='App__badge-tooltip' aria-hidden='true'>
                    {persistenceHint(ephemeral)}
                </span>
            )}
        </span>
        {inline && ` ${persistenceHint(ephemeral)}`}
    </>
);
