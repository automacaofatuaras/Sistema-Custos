import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Download, Filter, BarChart2 } from 'lucide-react';
import dbService from '../../../../services/dbService';

export default function AnaliseDetalhada({ filter }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [groupBy, setGroupBy] = useState('costCenter'); // costCenter, segment, accountClass

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await dbService.getAll(null, 'rateio_adm_transactions');
                setTransactions(data || []);
            } catch (err) {
                console.error('Erro ao buscar rateios:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredData = useMemo(() => {
        return transactions.filter(t => {
            if (!t.date || t.date.length < 10) return false;
            let y, m;
            if (t.date.includes('/')) {
                const parts = t.date.split('/');
                y = parseInt(parts[2]);
                m = parseInt(parts[1]) - 1;
            } else {
                y = parseInt(t.date.substring(0, 4));
                m = parseInt(t.date.substring(5, 7)) - 1;
            }
            if (y !== filter.year) return false;
            if (filter.type === 'month' && m !== filter.month) return false;

            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!t.costCenter?.toLowerCase().includes(q) &&
                    !t.description?.toLowerCase().includes(q) &&
                    !t.planDescription?.toLowerCase().includes(q) &&
                    !t.segment?.toLowerCase().includes(q)) {
                    return false;
                }
            }

            return true;
        });
    }, [transactions, filter, searchQuery]);

    const groupedView = useMemo(() => {
        const groups = {};
        filteredData.forEach(t => {
            let key = t[groupBy] || 'Não definido';
            if (groupBy === 'accountClass') {
                key = t.planDescription || t.accountClass || 'Não definido';
            }
            if (!groups[key]) {
                groups[key] = { items: [], total: 0 };
            }
            groups[key].items.push(t);
            groups[key].total += t.value;
        });

        return Object.keys(groups).map(k => ({
            name: k,
            total: groups[k].total,
            count: groups[k].items.length,
            items: groups[k].items
        })).sort((a, b) => b.total - a.total);
    }, [filteredData, groupBy]);

    const formatterCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const exportCsv = () => {
        if (filteredData.length === 0) return;
        const headers = ["Data", "CC", "Classe", "Valor", "Descricao", "Segmento", "Tipo"];
        const rows = filteredData.map(t => [
            t.date, t.costCenter, t.planDescription || t.accountClass, t.value.toFixed(2).replace('.', ','),
            t.description, t.segment, t.type
        ].map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(';'));

        const csvContent = headers.join(';') + '\n' + rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `analise_detalhada_rateio_${filter.month + 1}_${filter.year}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                    <BarChart2 className="text-indigo-500" />
                    Análise Detalhada
                </h3>

                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Pesquisar CC, desc, etc..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                        />
                    </div>

                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        <button onClick={() => setGroupBy('costCenter')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${groupBy === 'costCenter' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Por CC</button>
                        <button onClick={() => setGroupBy('accountClass')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${groupBy === 'accountClass' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Por Classe</button>
                        <button onClick={() => setGroupBy('segment')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${groupBy === 'segment' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>Por Segmento</button>
                    </div>

                    <button
                        onClick={exportCsv}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                        title="Exportar CSV"
                    >
                        <Download size={16} />
                        Exportar
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {groupedView.length === 0 ? (
                    <div className="p-8 bg-slate-50 dark:bg-slate-800 rounded-xl border dark:border-slate-700 text-center text-slate-400">
                        Nenhum registro encontrado para essa combinação de filtros.
                    </div>
                ) : (
                    groupedView.map(group => (
                        <details key={group.name} className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm group">
                            <summary className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center justify-between transition-colors list-none">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                                        <Filter size={12} className="text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{group.name}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">
                                        {group.count} lançamentos
                                    </span>
                                </div>
                                <div className="font-black text-slate-800 dark:text-white">
                                    {formatterCurrency(group.total)}
                                </div>
                            </summary>

                            <div className="border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs whitespace-nowrap">
                                        <thead className="text-slate-400 dark:text-slate-500 uppercase">
                                            <tr>
                                                <th className="px-3 py-2">Data</th>
                                                <th className="px-3 py-2">CC</th>
                                                <th className="px-3 py-2">Classe</th>
                                                <th className="px-3 py-2 max-w-[200px]">Descrição</th>
                                                <th className="px-3 py-2">Tipo</th>
                                                <th className="px-3 py-2 text-right">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                            {group.items.map((item, idx) => (
                                                <tr key={item.id || idx} className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{item.date}</td>
                                                    <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">{item.costCenter}</td>
                                                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={item.planDescription}>{item.planDescription || item.accountClass}</td>
                                                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={item.description}>{item.description}</td>
                                                    <td className="px-3 py-2 text-slate-500">{item.type}</td>
                                                    <td className="px-3 py-2 text-right font-medium text-rose-500">{formatterCurrency(item.value)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </details>
                    ))
                )}
            </div>
        </div>
    );
}
