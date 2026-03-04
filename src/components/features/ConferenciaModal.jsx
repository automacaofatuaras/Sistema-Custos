import React, { useState, useMemo } from 'react';
import { X, ClipboardCheck, ArrowDownCircle, ArrowUpCircle, Component } from 'lucide-react';

const ConferenciaModal = ({ isOpen, onClose, transactions, periodDesc }) => {
    const [filterType, setFilterType] = useState('ALL');

    if (!isOpen) return null;

    const filteredTransactions = useMemo(() => {
        let list = transactions;
        if (filterType !== 'ALL') {
            if (filterType === 'ENTRADAS') {
                list = list.filter(t => (t.source && t.source === 'SAE134-1') || (t.importBatchId && t.importBatchId.includes('SAE134-1')) || (t.sourceFile && t.sourceFile.includes('SAE134-1')));
            } else if (filterType === 'SAIDAS') {
                list = list.filter(t => (t.source && t.source === 'SAE127-1') || (t.importBatchId && t.importBatchId.includes('SAE127-1')) || (t.sourceFile && t.sourceFile.includes('SAE127-1')));
            } else if (filterType === 'OUTROS') {
                list = list.filter(t => {
                    const isNewEntry = t.source === 'SAE134-1';
                    const isNewExit = t.source === 'SAE127-1';
                    const idString = t.importBatchId || t.sourceFile || '';
                    return !isNewEntry && !isNewExit && !idString.includes('SAE134-1') && !idString.includes('SAE127-1');
                });
            }
        }
        return list;
    }, [transactions, filterType]);

    // Agrupar e somar por planDescription (Classe)
    const classSummary = filteredTransactions.reduce((acc, t) => {
        const className = t.planDescription || 'Sem Classe / Não Classificado';
        if (!acc[className]) {
            acc[className] = 0;
        }
        // Se for receita soma, se for despesa também soma em valor absoluto
        // Mas como queremos ver o volume por classe, podemos somar o valor absoluto direto.
        // O padrão geralmente é somar as contas independente do tipo para conferência.
        acc[className] += t.value;
        return acc;
    }, {});

    // Ordenar do maior para o menor
    const sortedClasses = Object.entries(classSummary).sort((a, b) => b[1] - a[1]);

    // Total Geral
    const totalGeral = sortedClasses.reduce((acc, [_, val]) => acc + val, 0);

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                            <ClipboardCheck size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                Conferência de Classes
                            </h2>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                                RESUMO POR CLASSE ({periodDesc})
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Filtros Internos do Modal */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setFilterType('ALL')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap border ${filterType === 'ALL' ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50'}`}
                    >
                        Todos
                    </button>
                    <button
                        onClick={() => setFilterType('ENTRADAS')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap border ${filterType === 'ENTRADAS' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50'}`}
                    >
                        <ArrowDownCircle size={16} className={filterType === 'ENTRADAS' ? 'text-emerald-500' : ''} />
                        Entradas
                    </button>
                    <button
                        onClick={() => setFilterType('SAIDAS')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap border ${filterType === 'SAIDAS' ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50'}`}
                    >
                        <ArrowUpCircle size={16} className={filterType === 'SAIDAS' ? 'text-rose-500' : ''} />
                        Saídas
                    </button>
                    <button
                        onClick={() => setFilterType('OUTROS')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap border ${filterType === 'OUTROS' ? 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50'}`}
                    >
                        <Component size={16} className={filterType === 'OUTROS' ? 'text-amber-500' : ''} />
                        Outros
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-slate-500 uppercase font-black tracking-widest border-b-2 border-slate-100 dark:border-slate-800">
                            <tr>
                                <th className="pb-4 pt-2">Classe</th>
                                <th className="pb-4 pt-2 text-right">Valor Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {sortedClasses.length > 0 ? (
                                sortedClasses.map(([className, value], index) => (
                                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="py-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-xs truncate max-w-[300px]">
                                            {className}
                                        </td>
                                        <td className="py-4 text-right font-black text-slate-900 dark:text-white">
                                            {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="2" className="py-8 text-center text-slate-500">
                                        Nenhum registro para exibir neste período.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer (Total) */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div className="text-sm font-black text-slate-500 uppercase tracking-widest">
                        Total Geral
                    </div>
                    <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                        {totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-white dark:bg-slate-900 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
                    >
                        Fechar
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ConferenciaModal;
