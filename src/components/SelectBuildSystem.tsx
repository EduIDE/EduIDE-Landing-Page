import React from 'react';

import type { BuildSystemOption } from '../common-extensions/types';

interface SelectBuildSystemProps {
    buildSystems: BuildSystemOption[];
    onSelect: (buildSystemId: string) => void;
    onBack: () => void;
}

export const SelectBuildSystem: React.FC<SelectBuildSystemProps> = ({ buildSystems, onSelect, onBack }) => (
    <div>
        <div className='Build-System__list'>
            {buildSystems.map((option, index) => (
                <button
                    key={index}
                    className='App__grid-item'
                    onClick={() => onSelect(option.id)}
                    data-testid={`build-system-${option.id}`}
                >
                    <img
                        src={`/assets/logos/${option.id.toLowerCase().replace(/\s+/g, '-')}-logo.png`}
                        alt={`${option.id} logo`}
                        className='App__grid-item-logo'
                    />
                    <div className='App__grid-item-launch'>Select</div>
                    <div className='App__grid-item-text'>{option.label}</div>
                </button>
            ))}
        </div>
        <button className='App__try-now-button App__back-button' onClick={onBack}>
            &larr; Back
        </button>
    </div>
);
