import React, { useState, useEffect, useMemo } from 'react';
import { PlusCircle, Search, Edit2, Trash2 } from 'lucide-react';
import { formatDate } from '../../../../../utils/formatters';
import RateioManualEntryModal from '../../../../modals/RateioManualEntryModal';
import dbService from '../../../../../services/dbService';

export default function LancamentosManuais({ filter, user, showToast }) {
    const [transactions, setTransactions] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Buscando transações na collection específica ou filtrando a geral
            // Como criamos o modal salvando em 'rateio_transactions', vamos buscar dela
            const data = await dbService.getAll(user, 'rateio_transactions');
            setTransactions(data || []);
        } catch (error) {
            console.error('Erro ao buscar lançamentos de rateio:', error);
            if (showToast) showToast('Erro ao carregar lançamentos', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [user]);

    const handleEdit = (tx) => {
        setEditingTx(tx);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Tem certeza que deseja excluir este lançamento?')) {
            try {
                await dbService.delete(user, 'rateio_transactions', String(id));
                if (showToast) showToast('Lançamento excluído', 'success');
                loadData();
            } catch (error) {
                if (showToast) showToast('Erro ao excluir', 'error');
            }
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingTx(null);
    };

    const filteredData = useMemo(() => {
        return transactions.filter(t => {
            // Filtro por termo de busca
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                (t.costCenter || '').toLowerCase().includes(searchLower) ||
                (t.costCenterDescription || '').toLowerCase().includes(searchLower) ||
                (t.classification || '').toLowerCase().includes(searchLower) ||
                (t.observation || '').toLowerCase().includes(searchLower);

            // Filtro por período (mês/ano) se aplicável
            let matchesPeriod = true;
            if (filter && t.date) {
                let y, m;
                if (typeof t.date === 'string' && t.date.length >= 7) {
                    y = parseInt(t.date.substring(0, 4));
                    m = parseInt(t.date.substring(5, 7)) - 1;
                } else {
                    const d = new Date(t.date);
                    y = d.getFullYear();
                    m = d.getMonth();
                }

                if (y !== filter.year) matchesPeriod = false;
                if (filter.type === 'month' && m !== filter.month) matchesPeriod = false;
            }

            return matchesSearch && matchesPeriod;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [transactions, searchTerm, filter]);

    const totalValue = filteredData.reduce((acc, curr) => acc + (curr.value || 0), 0);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border dark:border-slate-700">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input
                        type="text"
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-lg outline-none text-sm dark:text-white"
                        placeholder="Buscar por CC, Descrição, Classe ou Observação..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-500 uppercase">Total Selecionado</p>
                        <p className="font-black text-indigo-600 dark:text-indigo-400">
                            {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shadow-md hover:bg-indigo-700 transition-colors whitespace-nowrap"
                    >
                        <PlusCircle size={18} />
                        Novo Lançamento
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 text-slate-500 font-bold uppercase text-[10px]">
                            <tr>
                                <th className="p-4">Data</th>
                                <th className="p-4">Centro de Custo</th>
                                <th className="p-4">Descrição CC</th>
                                <th className="p-4">Classe</th>
                                <th className="p-4">Observação</th>
                                <th className="p-4 text-right">Valor</th>
                                <th className="p-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-slate-500">
                                        Carregando lançamentos...
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-slate-500">
                                        Nenhum lançamento encontrado para os filtros atuais.
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4 dark:text-white font-medium">
                                            {t.date ? formatDate(t.date) : '-'}
                                        </td>
                                        <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                                            {t.costCenter}
                                        </td>
                                        <td className="p-4 text-slate-600 dark:text-slate-400">
                                            {t.costCenterDescription}
                                        </td>
                                        <td className="p-4 text-indigo-600 dark:text-indigo-400 font-medium">
                                            {t.classification}
                                        </td>
                                        <td className="p-4 text-slate-500 dark:text-slate-400 text-xs truncate max-w-[150px]" title={t.observation}>
                                            {t.observation || '-'}
                                        </td>
                                        <td className="p-4 text-right font-black text-slate-700 dark:text-white">
                                            {(t.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(t)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(t.id)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <RateioManualEntryModal
                    onClose={handleCloseModal}
                    onSave={loadData}
                    user={user}
                    initialData={editingTx}
                    showToast={showToast}
                />
            )}
        </div>
    );
}
