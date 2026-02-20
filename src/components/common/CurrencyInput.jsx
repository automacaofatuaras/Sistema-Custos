import React from 'react';

const CurrencyInput = ({ value, onChange, disabled, className }) => {
    const handleChange = (e) => {
        const rawValue = e.target.value.replace(/\D/g, "");
        const numberValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;
        onChange(numberValue);
    };

    const displayValue = value
        ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : 'R$ 0,00';

    return (
        <input
            type="text"
            value={displayValue}
            onChange={handleChange}
            disabled={disabled}
            className={className}
            placeholder="R$ 0,00"
        />
    );
};

export default CurrencyInput;
