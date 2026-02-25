import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

const SearchableSelect = ({ options, value, onChange, placeholder, label, icon: Icon, disabled, showSearch = true }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="space-y-2 relative" ref={containerRef}>
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-2">
                {label}
            </label>

            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full bg-slate-50 dark:bg-slate-800 border-2 ${isOpen ? 'border-indigo-500' : 'border-transparent'} rounded-2xl p-4 font-bold text-slate-700 dark:text-white outline-none transition-all cursor-pointer flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <div className="flex items-center gap-3 w-full">
                    {Icon && <Icon className="text-slate-400 shrink-0" size={18} />}
                    <span className="leading-tight py-1">{selectedOption ? selectedOption.label : placeholder}</span>
                </div>
                <ChevronDown className={`text-slate-400 transition-transform shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} size={18} />
            </div>

            {isOpen && (
                <div className="absolute z-[100] w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.3)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {showSearch && (
                        <div className="p-4 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    autoFocus
                                    className="w-full pl-9 pr-4 py-3 bg-white dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-sm outline-none focus:border-indigo-500 transition-all font-medium dark:text-white"
                                    placeholder="Pesquisar..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                />
                            </div>
                        </div>
                    )}

                    <div className="max-h-[400px] overflow-y-auto p-2 space-y-1 custom-scrollbar scroll-smooth whitespace-normal">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(opt => (
                                <div
                                    key={opt.value}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onChange(opt.value);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all ${value === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                                >
                                    <span className="font-bold text-sm leading-snug pr-4">{opt.label}</span>
                                    {value === opt.value && <Check className="shrink-0" size={14} />}
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-slate-400 text-xs font-medium">
                                Nenhum resultado encontrado.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
