import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Package, DollarSign } from 'lucide-react';

const ProductionComponent = ({ transactions, measureUnit }) => {
    const data = useMemo(() => {
        const relevant = transactions.filter(t =>
            (t.type === 'metric' && (t.metricType === 'producao' || t.metricType === 'vendas')) ||
            (t.type === 'revenue' || t.type === 'expense')
        );

        const grouped = {};

        relevant.forEach(t => {
            const d = new Date(t.date);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            const label = d.toLocaleString('default', { month: 'short' });

            if (!grouped[key]) {
                grouped[key] = {
                    name: label,
                    Produção: 0,
                    Vendas: 0,
                    Faturamento: 0,
                    Custo: 0,
                    sortKey: d.getTime()
                };
            }

            if (t.type === 'metric' && t.metricType === 'producao') grouped[key].Produção += t.value;
            if (t.type === 'metric' && t.metricType === 'vendas') grouped[key].Vendas += t.value;
            if (t.type === 'revenue') grouped[key].Faturamento += t.value;
            if (t.type === 'expense') grouped[key].Custo += t.value;
        });

        return Object.values(grouped).sort((a, b) => a.sortKey - b.sortKey);
    }, [transactions]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 p-6">
                <h3 className="font-bold text-lg mb-4 dark:text-white flex items-center gap-2">
                    <Package className="text-indigo-500" size={20} />
                    Quantitativo: Produção vs Vendas ({measureUnit})
                </h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Legend />
                            <Line name={`Produção (${measureUnit})`} type="monotone" dataKey="Produção" stroke="#8884d8" strokeWidth={3} dot={{ r: 4 }} />
                            <Line name={`Vendas (${measureUnit})`} type="monotone" dataKey="Vendas" stroke="#82ca9d" strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 p-6">
                <h3 className="font-bold text-lg mb-4 dark:text-white flex items-center gap-2">
                    <DollarSign className="text-emerald-500" size={20} />
                    Financeiro: Custo de Produção vs Faturamento
                </h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis
                                stroke="#94a3b8"
                                tickFormatter={(val) => `R$${(val / 1000).toFixed(0)}k`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                formatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Legend />
                            <Line name="Faturamento" type="monotone" dataKey="Faturamento" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                            <Line name="Custo Total" type="monotone" dataKey="Custo" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default ProductionComponent;
