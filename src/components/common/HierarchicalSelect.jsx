import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, Folder, FolderOpen } from 'lucide-react';

const HierarchicalSelect = ({ value, onChange, options, placeholder = "Selecione...", isFilter = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [expanded, setExpanded] = useState({});
    const ref = useRef(null);

    const hierarchy = useMemo(() => {
        const map = {};
        if (!options || !Array.isArray(options) || options.length === 0) return {};

        options.forEach(opt => {
            if (!opt || !opt.name) return;

            const parts = opt.name.split(':');
            const segment = parts.length > 1 ? parts[0].trim() : 'Geral';
            const unitName = parts.length > 1 ? parts[1].trim() : opt.name;

            if (!map[segment]) map[segment] = [];
            map[segment].push({ fullValue: opt.name, label: unitName });
        });

        return Object.keys(map).sort().reduce((obj, key) => {
            obj[key] = map[key].sort((a, b) => a.label.localeCompare(b.label));
            return obj;
        }, {});
    }, [options]);

    useEffect(() => {
        const clickOut = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
        document.addEventListener("mousedown", clickOut);
        return () => document.removeEventListener("mousedown", clickOut);
    }, []);

    const toggleFolder = (seg, e) => {
        if (e) e.stopPropagation();
        setExpanded(prev => ({ ...prev, [seg]: !prev[seg] }));
    };

    const handleSelect = (val) => {
        onChange(val);
        setIsOpen(false);
    };

    let displayText = placeholder;
    if (value && value !== 'ALL') {
        if (value.includes(':')) displayText = value.split(':')[1].trim();
        else displayText = value;
    }

    return (
        <div className="relative w-full md:w-auto z-[50]" ref={ref}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between w-full md:w-64 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg p-2.5 transition-all ${isOpen ? 'ring-2 ring-indigo-500 border-transparent' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                type="button"
            >
                <span className="truncate font-medium">{displayText}</span>
                <ChevronDown size={16} className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-[300px] max-h-[400px] overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-100">

                    {isFilter && (
                        <div onClick={() => handleSelect('ALL')} className="p-3 border-b dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 text-xs font-bold uppercase tracking-wider text-center">
                            Mostrar Tudo
                        </div>
                    )}

                    {Object.entries(hierarchy).map(([segment, units]) => (
                        <div key={segment}>
                            <div
                                onClick={(e) => isFilter ? handleSelect(segment) : toggleFolder(segment, e)}
                                className={`flex items-center gap-2 p-2 px-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm font-bold border-b dark:border-slate-700 transition-colors ${value === segment ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}
                            >
                                <div onClick={(e) => toggleFolder(segment, e)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded">
                                    {expanded[segment] || isFilter ? <FolderOpen size={16} className="text-amber-500" /> : <Folder size={16} className="text-amber-500" />}
                                </div>
                                <span className="flex-1">{segment}</span>
                            </div>

                            {(expanded[segment] || isFilter) && (
                                <div className="bg-slate-50 dark:bg-slate-900/30 border-l-2 border-slate-200 dark:border-slate-700 ml-4 my-1">
                                    {units.map(u => (
                                        <div
                                            key={u.fullValue}
                                            onClick={() => handleSelect(u.fullValue)}
                                            className={`py-2 px-3 text-xs cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-600 dark:text-slate-400 transition-colors flex items-center gap-2 ${value === u.fullValue ? 'font-bold text-indigo-600 bg-indigo-50 dark:text-indigo-300' : ''}`}
                                        >
                                            <div className={`w-1.5 h-1.5 rounded-full ${value === u.fullValue ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                                            {u.label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {Object.keys(hierarchy).length === 0 && (
                        <div className="p-4 text-center text-slate-400 text-sm">Nenhuma opção disponível</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default HierarchicalSelect;
