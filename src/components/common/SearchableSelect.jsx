import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';

export default function SearchableSelect({ options, value, onChange, placeholder = "Selecione...", onBlur }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    useEffect(() => {
        // Obter label inicial se houver valor selecionado e options contiver
        const selectedOption = options.find(opt => typeof opt === 'object' ? opt.value === value : opt === value);
        if (selectedOption && !isOpen) {
            setSearchTerm(typeof selectedOption === 'object' ? selectedOption.label : selectedOption);
        } else if (!value && !isOpen) {
            setSearchTerm('');
        }
    }, [value, options, isOpen]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
                if (onBlur) onBlur();

                // Restaura o termo de busca para o valor selecionado caso clique fora
                const selectedOption = options.find(opt => typeof opt === 'object' ? opt.value === value : opt === value);
                if (selectedOption) {
                    setSearchTerm(typeof selectedOption === 'object' ? selectedOption.label : selectedOption);
                } else {
                    setSearchTerm('');
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [value, options, onBlur]);

    const handleSelect = (option) => {
        const optionValue = typeof option === 'object' ? option.value : option;
        const optionLabel = typeof option === 'object' ? option.label : option;

        setSearchTerm(optionLabel);
        onChange(optionValue);
        setIsOpen(false);
    };

    const filteredOptions = options.filter(option => {
        const label = typeof option === 'object' ? option.label : option;
        return label.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="relative" ref={containerRef}>
            <div
                className="flex items-center w-full border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition-all cursor-text text-sm"
                onClick={() => setIsOpen(true)}
            >
                {isOpen ? (
                    <Search className="ml-3 text-slate-400 shrink-0" size={16} />
                ) : (
                    <div className="ml-3 text-slate-400 shrink-0 select-none">
                        <ChevronDown size={16} />
                    </div>
                )}

                <input
                    type="text"
                    className="w-full p-2 outline-none bg-transparent dark:text-white"
                    placeholder={placeholder}
                    value={isOpen ? searchTerm : (value ? searchTerm : '')} // Mostra search apenas se aberto ou com valor
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {filteredOptions.length > 0 ? (
                        <ul className="py-1">
                            {filteredOptions.map((option, idx) => {
                                const optionValue = typeof option === 'object' ? option.value : option;
                                const optionLabel = typeof option === 'object' ? option.label : option;

                                return (
                                    <li
                                        key={`${optionValue}-${idx}`}
                                        onClick={() => handleSelect(option)}
                                        className={`px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-sm dark:text-slate-200 transition-colors
                                            ${value === optionValue ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold' : ''}
                                        `}
                                    >
                                        {optionLabel}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="p-4 text-center text-sm text-slate-500">
                            Nenhum resultado encontrado
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
