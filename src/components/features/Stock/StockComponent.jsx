import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Package } from 'lucide-react';

const StockComponent = ({ transactions, measureUnit, globalCostPerUnit, currentFilter }) => {
    const stockData = useMemo(() => {
        const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
        const avgCost = globalCostPerUnit || 0;

        let balances = {
            'Areia Fina': 0,
            'Areia Grossa': 0,
            'Areia Suja': 0
        };

        const fullEvolution = [];

        sorted.forEach(t => {
            let category = null;
            const desc = (t.materialDescription || t.description || '').toLowerCase();

            if (desc.includes('fina')) category = 'Areia Fina';
            else if (desc.includes('grossa')) category = 'Areia Grossa';
            else if (desc.includes('suja')) category = 'Areia Suja';

            if (!category) return;

            if (t.type === 'metric') {
                const val = t.value;
                if (t.metricType === 'producao') balances[category] += val;
                else if (t.metricType === 'vendas') balances[category] -= val;
                else if (t.metricType === 'estoque') balances[category] = val;
            }

            const totalMoment = Object.values(balances).reduce((a, b) => a + b, 0);

            if (t.type === 'metric') {
                fullEvolution.push({
                    dateObj: new Date(t.date),
                    displayDate: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                    Estoque: totalMoment
                });
            }
        });

        let filteredEvolution = fullEvolution;

        if (currentFilter && currentFilter.type === 'month') {
            filteredEvolution = fullEvolution.filter(item => item.dateObj.getMonth() === currentFilter.month);
        } else if (currentFilter && currentFilter.type === 'quarter') {
            const startMonth = (currentFilter.quarter - 1) * 3;
            const endMonth = startMonth + 2;
            filteredEvolution = fullEvolution.filter(item => item.dateObj.getMonth() >= startMonth && item.dateObj.getMonth() <= endMonth);
        } else if (currentFilter && currentFilter.type === 'semester') {
            const isFirstSem = currentFilter.semester === 1;
            filteredEvolution = fullEvolution.filter(item => isFirstSem ? item.dateObj.getMonth() < 6 : item.dateObj.getMonth() >= 6);
        }

        const totalFinal = Object.values(balances).reduce((a, b) => a + b, 0);

        return {
            total: totalFinal,
            fina: balances['Areia Fina'],
            grossa: balances['Areia Grossa'],
            suja: balances['Areia Suja'],
            avgCost,
            totalValue: totalFinal * avgCost,
            valFina: balances['Areia Fina'] * avgCost,
            valGrossa: balances['Areia Grossa'] * avgCost,
            valSuja: balances['Areia Suja'] * avgCost,
            evolution: filteredEvolution
        };
    }, [transactions, globalCostPerUnit, currentFilter]);

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none">
                    <p className="text-indigo-200 text-xs font-bold uppercase mb-2">Estoque Físico Total</p>
                    <h3 className="text-3xl font-bold">{stockData.total.toLocaleString()} <span className="text-lg font-normal opacity-80">{measureUnit}</span></h3>
                    <div className="mt-4 pt-4 border-t border-indigo-500/50 flex justify-between items-center text-sm">
                        <span>Custo Médio</span>
                        <span className="font-bold bg-indigo-500 px-2 py-1 rounded">R$ {stockData.avgCost.toFixed(2)}</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border dark:border-slate-700 shadow-sm col-span-2 flex flex-col justify-center">
                    <p className="text-slate-500 text-xs font-bold uppercase mb-2">Valor Financeiro em Estoque</p>
                    <h3 className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                        {stockData.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">Baseado no Custo Médio x Volume Calculado</p>
                </div>
            </div>

            <div className="flex items-center gap-2 mt-8">
                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                    <Package className="text-indigo-500" /> Detalhamento por Tipo
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 border-l-amber-400 shadow-sm border dark:border-slate-700">
                    <div className="flex justify-between mb-2">
                        <span className="font-bold text-slate-700 dark:text-slate-200">Areia Fina</span>
                        <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded">FINA</span>
                    </div>
                    <p className="text-2xl font-bold dark:text-white mt-2">{stockData.fina.toLocaleString()} <span className="text-sm text-slate-400">{measureUnit}</span></p>
                    <p className="text-xs text-emerald-600 font-bold mt-1">{stockData.valFina.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 border-l-blue-500 shadow-sm border dark:border-slate-700">
                    <div className="flex justify-between mb-2">
                        <span className="font-bold text-slate-700 dark:text-slate-200">Areia Grossa</span>
                        <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">GROSSA</span>
                    </div>
                    <p className="text-2xl font-bold dark:text-white mt-2">{stockData.grossa.toLocaleString()} <span className="text-sm text-slate-400">{measureUnit}</span></p>
                    <p className="text-xs text-emerald-600 font-bold mt-1">{stockData.valGrossa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 border-l-stone-500 shadow-sm border dark:border-slate-700">
                    <div className="flex justify-between mb-2">
                        <span className="font-bold text-slate-700 dark:text-slate-200">Areia Suja</span>
                        <span className="text-xs font-bold bg-stone-100 text-stone-700 px-2 py-1 rounded">SUJA</span>
                    </div>
                    <p className="text-2xl font-bold dark:text-white mt-2">{stockData.suja.toLocaleString()} <span className="text-sm text-slate-400">{measureUnit}</span></p>
                    <p className="text-xs text-emerald-600 font-bold mt-1">{stockData.valSuja.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 h-80 mt-6">
                <h3 className="font-bold mb-4 dark:text-white">Evolução do Estoque (Período Selecionado)</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stockData.evolution}>
                        <defs>
                            <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="displayDate" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                        <Area type="step" dataKey="Estoque" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorStock)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default StockComponent;
