import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Loader2, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import dbService from '../../../../services/dbService';
import { fetchConsolidatedTransactions } from '../../../../utils/rateioTransactions';

export default function ResumoSegmento({ filter, user }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedGeral, setExpandedGeral] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await fetchConsolidatedTransactions(user);
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

        // 1. Array base (sem separar)
        const baseGroups = Object.keys(groups).map(k => {
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
        });

        const totalGlobal = baseGroups.reduce((acc, g) => acc + g.total, 0);

        // 2. Calcula a % do Total em cada grupo e ordena
        const enrichedGroups = baseGroups.map(g => ({
            ...g,
            percTotal: totalGlobal > 0 ? (g.total / totalGlobal) * 100 : 0
        })).sort((a, b) => b.total - a.total);

        return {
            geral: enrichedGroups.find(g => g.name === 'Geral'),
            demais: enrichedGroups.filter(g => g.name !== 'Geral'),
            totalGlobal
        };

    }, [transactions, filter]);

    const formatterCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatterPerc = (val) => `${val.toFixed(1)}%`;

    if (loading) {
        return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
    }

    const { geral, demais, totalGlobal } = groupedData;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h3 className="text-xl font-bold dark:text-white flex items-center gap-2 mb-6">
                <Layers className="text-indigo-500" />
                Resumo Consolidado por Segmento
            </h3>

            {/* Tabela 1: GERAL (Com Rateio Fixo em Drill Down) */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border dark:border-slate-700 overflow-hidden mb-8">
                <div className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 px-6 py-3">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300">Rateio Administrativo - Despesas Indiretas</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 text-slate-500 font-bold uppercase text-[10px]">
                            <tr>
                                <th className="px-6 py-4 w-1/4">Segmento</th>
                                <th className="px-6 py-4 text-right">Custos Diretos</th>
                                <th className="px-6 py-4 text-right">Custos Indiretos</th>
                                <th className="px-6 py-4 text-right">Custo Total</th>
                                <th className="px-6 py-4 text-right">% do Total</th>
                                <th className="px-6 py-4 text-right">Var % (MoM)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {!geral ? (
                                <tr><td colSpan="6" className="p-8 text-center text-slate-400">Nenhum custo classificado no escopo Geral neste período.</td></tr>
                            ) : (
                                <React.Fragment>
                                    <tr
                                        onClick={() => setExpandedGeral(!expandedGeral)}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4 font-black flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                            <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center shrink-0">
                                                {expandedGeral ? '-' : '+'}
                                            </div>
                                            GERAL
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">{formatterCurrency(geral.diretos)}</td>
                                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">{formatterCurrency(geral.indiretos)}</td>
                                        <td className="px-6 py-4 text-right font-black text-slate-800 dark:text-white">{formatterCurrency(geral.total)}</td>
                                        <td className="px-6 py-4 text-right font-bold text-indigo-600 dark:text-indigo-400">{formatterPerc(geral.percTotal)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className={`flex items-center justify-end gap-1 font-bold ${geral.varPerc > 0 ? 'text-rose-500' : geral.varPerc < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                {geral.varPerc > 0 ? <ArrowUpRight size={16} /> : geral.varPerc < 0 ? <ArrowDownRight size={16} /> : <Minus size={16} />}
                                                {Math.abs(geral.varPerc).toFixed(1)}%
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedGeral && [
                                        { name: 'Construtora', perc: 60.0 },
                                        { name: 'Pedreiras', perc: 28.5 },
                                        { name: 'Concreteiras / Fábrica de Tubos', perc: 10.0 },
                                        { name: 'Portos de Areia', perc: 1.5 }
                                    ].map(sub => {
                                        const subDiretos = geral.diretos * (sub.perc / 100);
                                        const subIndiretos = geral.indiretos * (sub.perc / 100);
                                        const subTotal = geral.total * (sub.perc / 100);
                                        const subPercTotalGlobal = totalGlobal > 0 ? (subTotal / totalGlobal) * 100 : 0;

                                        return (
                                            <tr key={sub.name} className="bg-indigo-50/30 dark:bg-indigo-900/10 text-sm hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-12 py-3 font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                    <ArrowDownRight size={14} className="text-slate-400" />
                                                    {sub.name} <span className="text-[10px] text-slate-400 ml-1">({sub.perc}%)</span>
                                                </td>
                                                <td className="px-6 py-3 text-right text-slate-500">{formatterCurrency(subDiretos)}</td>
                                                <td className="px-6 py-3 text-right text-slate-500">{formatterCurrency(subIndiretos)}</td>
                                                <td className="px-6 py-3 text-right font-bold text-slate-700 dark:text-slate-300">{formatterCurrency(subTotal)}</td>
                                                <td className="px-6 py-3 text-right text-slate-500">{formatterPerc(subPercTotalGlobal)}</td>
                                                <td className="px-6 py-3 text-right text-slate-400">-</td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Tabela 2: DEMAIS SEGMENTOS */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border dark:border-slate-700 overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 px-6 py-3">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300">Custos Diretos Operacionais</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 text-slate-500 font-bold uppercase text-[10px]">
                            <tr>
                                <th className="px-6 py-4 w-1/4">Segmento</th>
                                <th className="px-6 py-4 text-right">Custos Diretos</th>
                                <th className="px-6 py-4 text-right">Custos Indiretos</th>
                                <th className="px-6 py-4 text-right">Custo Total</th>
                                <th className="px-6 py-4 text-right">% do Total</th>
                                <th className="px-6 py-4 text-right">Var % (MoM)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {demais.length === 0 ? (
                                <tr><td colSpan="6" className="p-8 text-center text-slate-400">Nenhum custo operacional direto classificado neste período.</td></tr>
                            ) : (
                                demais.map((row) => (
                                    <tr key={row.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{row.name}</td>
                                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">{formatterCurrency(row.diretos)}</td>
                                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">{formatterCurrency(row.indiretos)}</td>
                                        <td className="px-6 py-4 text-right font-black text-slate-800 dark:text-white">{formatterCurrency(row.total)}</td>
                                        <td className="px-6 py-4 text-right font-bold text-indigo-600 dark:text-indigo-400">{formatterPerc(row.percTotal)}</td>
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
                        <tfoot className="bg-slate-50 dark:bg-slate-900 font-bold border-t border-t-2 dark:border-slate-700">
                            <tr>
                                <td className="px-6 py-4 text-slate-800 dark:text-white uppercase">Custo Total</td>
                                <td className="px-6 py-4 text-right text-slate-800 dark:text-white">
                                    {formatterCurrency((geral?.diretos || 0) + demais.reduce((acc, r) => acc + r.diretos, 0))}
                                </td>
                                <td className="px-6 py-4 text-right text-slate-800 dark:text-white">
                                    {formatterCurrency((geral?.indiretos || 0) + demais.reduce((acc, r) => acc + r.indiretos, 0))}
                                </td>
                                <td className="px-6 py-4 text-right text-indigo-600 dark:text-indigo-400 text-lg">
                                    {formatterCurrency(totalGlobal)}
                                </td>
                                <td className="px-6 py-4 text-right text-indigo-600 dark:text-indigo-400 text-lg">
                                    {totalGlobal > 0 ? "100.0%" : "0.0%"}
                                </td>
                                <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

        </div>
    );
}
