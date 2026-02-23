import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Loader2, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import dbService from '../../../../services/dbService';

export default function ResumoSegmento({ filter }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

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

    const groupedData = useMemo(() => {
        // Simple grouping logic for the current filter
        const currentData = transactions.filter(t => {
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
            return true;
        });

        const groups = {};
        currentData.forEach(t => {
            const seg = t.segment || 'Outros';
            if (!groups[seg]) {
                groups[seg] = { diretos: 0, indiretos: 0, total: 0 };
            }
            if (t.type?.toLowerCase() === 'direto') groups[seg].diretos += t.value;
            else groups[seg].indiretos += t.value;

            groups[seg].total += t.value;
        });

        // To calculate MoM (Month over Month) variation, we need previous month data
        const prevMonthData = transactions.filter(t => {
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
            // previous month logic
            const prevM = filter.month === 0 ? 11 : filter.month - 1;
            const prevY = filter.month === 0 ? filter.year - 1 : filter.year;

            if (y !== prevY) return false;
            if (filter.type === 'month' && m !== prevM) return false;
            return true;
        });

        const prevGroups = {};
        prevMonthData.forEach(t => {
            const seg = t.segment || 'Outros';
            if (!prevGroups[seg]) prevGroups[seg] = 0;
            prevGroups[seg] += t.value;
        });

        return Object.keys(groups).map(k => {
            const currentTotal = groups[k].total;
            const prevTotal = prevGroups[k] || 0;
            const varAbs = currentTotal - prevTotal;
            const varPerc = prevTotal > 0 ? (varAbs / prevTotal) * 100 : (currentTotal > 0 ? 100 : 0);

            return {
                name: k,
                ...groups[k],
                prevTotal,
                varAbs,
                varPerc
            }
        }).sort((a, b) => b.total - a.total);

    }, [transactions, filter]);

    const formatterCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    if (loading) {
        return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h3 className="text-xl font-bold dark:text-white flex items-center gap-2 mb-6">
                <Layers className="text-indigo-500" />
                Resumo Consolidado por Segmento
            </h3>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 text-slate-500 font-bold uppercase text-[10px]">
                            <tr>
                                <th className="px-6 py-4">Segmento</th>
                                <th className="px-6 py-4 text-right">Custos Diretos</th>
                                <th className="px-6 py-4 text-right">Custos Indiretos</th>
                                <th className="px-6 py-4 text-right">Custo Total (Mês Atual)</th>
                                <th className="px-6 py-4 text-right">Mês Anterior</th>
                                <th className="px-6 py-4 text-right">Var % (MoM)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {groupedData.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-slate-400">Nenhum dado encontrado para o período.</td></tr>
                            ) : (
                                groupedData.map((row) => (
                                    <tr key={row.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{row.name}</td>
                                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">{formatterCurrency(row.diretos)}</td>
                                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">{formatterCurrency(row.indiretos)}</td>
                                        <td className="px-6 py-4 text-right font-black text-slate-800 dark:text-white">{formatterCurrency(row.total)}</td>
                                        <td className="px-6 py-4 text-right text-slate-500">{formatterCurrency(row.prevTotal)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className={`flex items-center justify-end gap-1 font-bold ${row.varPerc > 0 ? 'text-rose-500' : row.varPerc < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                {row.varPerc > 0 ? <ArrowUpRight size={16} /> : row.varPerc < 0 ? <ArrowDownRight size={16} /> : <Minus size={16} />}
                                                {Math.abs(row.varPerc).toFixed(1)}%
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {groupedData.length > 0 && (
                            <tfoot className="bg-slate-50 dark:bg-slate-900 font-bold border-t border-t-2 dark:border-slate-700">
                                <tr>
                                    <td className="px-6 py-4 text-slate-800 dark:text-white">Total Geral</td>
                                    <td className="px-6 py-4 text-right text-slate-800 dark:text-white">{formatterCurrency(groupedData.reduce((acc, r) => acc + r.diretos, 0))}</td>
                                    <td className="px-6 py-4 text-right text-slate-800 dark:text-white">{formatterCurrency(groupedData.reduce((acc, r) => acc + r.indiretos, 0))}</td>
                                    <td className="px-6 py-4 text-right text-indigo-600 dark:text-indigo-400 text-lg">{formatterCurrency(groupedData.reduce((acc, r) => acc + r.total, 0))}</td>
                                    <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">{formatterCurrency(groupedData.reduce((acc, r) => acc + r.prevTotal, 0))}</td>
                                    <td className="px-6 py-4"></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
