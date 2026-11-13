import { PersistenceBadge } from './PersistenceBadge';
import { Spinner } from './Spinner';

interface LoadingProps {
    text?: string;
    ephemeral?: boolean;
}
export const Loading: React.FC<LoadingProps> = ({ text, ephemeral }: LoadingProps): React.JSX.Element => {
    const calculatedText = text ?? 'We are launching a dedicated session for you, hang in tight, this might take up to 3 minutes.';
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                width: '100%',
                minHeight: '100%'
            }}
        >
            <Spinner />
            <p className='Loading__description'>{calculatedText}</p>
            {ephemeral !== undefined && (
                <p className='Loading__persistence'>
                    <PersistenceBadge ephemeral={ephemeral} inline />
                </p>
            )}
        </div>
    );
};
