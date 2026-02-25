import React, { useMemo } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, Target,
    BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Factory
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';

const SegmentDashboard = ({ transactions, segmentName, units }) => {
    // 1. Processamento de Dados Agregados
    const segmentData = useMemo(() => {
        const dataByUnit = {};
        units.forEach(unit => {
            dataByUnit[unit] = { revenue: 0, expense: 0, balance: 0, margin: 0 };
        });

        // Filtrar transações do segmento (as transações têm campo segment formatado como "SEGMENT:UNIT" ou apenas "UNIT")
        transactions.forEach(t => {
            const tSegment = t.segment || '';
            const isMatch = units.some(u => tSegment.includes(u));

            if (isMatch) {
                const unitMatch = units.find(u => tSegment.includes(u));
                if (t.type === 'revenue') dataByUnit[unitMatch].revenue += (t.value || 0);
                if (t.type === 'expense') dataByUnit[unitMatch].expense += (t.value || 0);
            }
        });

        const totals = { revenue: 0, expense: 0, balance: 0, margin: 0 };
        const chartData = Object.entries(dataByUnit).map(([name, data]) => {
            data.balance = data.revenue - data.expense;
            data.margin = data.revenue > 0 ? (data.balance / data.revenue) * 100 : 0;

            totals.revenue += data.revenue;
            totals.expense += data.expense;

            return {
                name: name.split('-').pop().trim(), // Nome curto para o gráfico
                fullName: name,
                ...data
            };
        }).sort((a, b) => b.revenue - a.revenue);

        totals.balance = totals.revenue - totals.expense;
        totals.margin = totals.revenue > 0 ? (totals.balance / totals.revenue) * 100 : 0;

        return { chartData, totals };
    }, [transactions, segmentName, units]);

    const { chartData, totals } = segmentData;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header com Contexto */}
            <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                            <Factory size={24} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest opacity-80">Visão Consolidada do Segmento</span>
                    </div>
                    <h2 className="text-4xl font-black mb-2">{segmentName}</h2>
                    <p className="text-indigo-100 max-w-xl">Análise agregada de <strong>{units.length} unidades</strong>. Visualizando performance consolidada e comparativo de mercado interno.</p>
                </div>
                <div className="absolute top-[-20%] right-[-5%] opacity-10 rotate-12 scale-150">
                    <BarChart3 size={300} />
                </div>
            </div>

            {/* KPIs Consolidados */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border dark:border-slate-700">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg"><TrendingUp className="text-emerald-500" size={20} /></div>
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full flex items-center gap-1">TOTAL</span>
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Faturamento Total</p>
                    <h3 className="text-2xl font-black dark:text-white">{totals.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border dark:border-slate-700">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded-lg"><TrendingDown className="text-rose-500" size={20} /></div>
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Custo Total</p>
                    <h3 className="text-2xl font-black dark:text-white">{totals.expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border dark:border-slate-700">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg"><DollarSign className="text-indigo-500" size={20} /></div>
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Resultado Líquido</p>
                    <h3 className={`text-2xl font-black ${totals.balance >= 0 ? 'text-indigo-500' : 'text-rose-500'}`}>{totals.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border dark:border-slate-700">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg"><Target className="text-amber-500" size={20} /></div>
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Margem Média</p>
                    <h3 className="text-2xl font-black dark:text-white">{totals.margin.toFixed(1)}%</h3>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Gráfico de Performance por Unidade */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border dark:border-slate-700">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-6 uppercase text-sm tracking-widest flex items-center gap-2">
                        <BarChart3 size={18} className="text-indigo-500" /> Comparativo de Faturamento por Unidade
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={60} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                <YAxis tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{
                                        backgroundColor: '#1e293b',
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: '#fff',
                                        fontSize: '12px'
                                    }}
                                    formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                />
                                <Bar dataKey="revenue" name="Receita" radius={[4, 4, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#818cf8'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Tabela de Ranking */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border dark:border-slate-700">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-6 uppercase text-sm tracking-widest flex items-center gap-2">
                        <PieChart size={18} className="text-indigo-500" /> Ranking de Performance
                    </h3>
                    <div className="space-y-4">
                        {chartData.slice(0, 5).map((unit, idx) => (
                            <div key={unit.fullName} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-500">
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold dark:text-white truncate max-w-[120px]">{unit.fullName.split('-').pop()}</p>
                                        <p className="text-[10px] text-slate-400 font-medium">Margem: {unit.margin.toFixed(1)}%</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-black text-indigo-500">{unit.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</p>
                                    <div className={`flex items-center justify-end gap-0.5 text-[9px] font-black ${unit.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {unit.balance >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                        {unit.balance.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="w-full mt-6 py-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-400 hover:text-indigo-500 hover:border-indigo-500 transition-all uppercase tracking-widest">
                        Ver Ranking Completo
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SegmentDashboard;
