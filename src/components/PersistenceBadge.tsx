import { persistenceHint } from '../launch';

interface PersistenceBadgeProps {
    ephemeral: boolean;
    /** Id of the tooltip, so a focusable parent can point at it with aria-describedby. */
    tooltipId?: string;
}

export const PersistenceBadge: React.FC<PersistenceBadgeProps> = ({ ephemeral, tooltipId }: PersistenceBadgeProps) => (
    <span className='App__badge' data-persistence={ephemeral ? 'temporary' : 'saved'}>
        {ephemeral ? 'Temporary' : 'Saved'}
        <span role='tooltip' id={tooltipId} className='App__badge-tooltip'>
            {persistenceHint(ephemeral)}
        </span>
    </span>
);
