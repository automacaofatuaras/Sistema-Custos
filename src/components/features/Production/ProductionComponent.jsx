import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Package, DollarSign, PlusCircle, Save, X, Target, TrendingUp, TrendingDown, Trash2, Calendar, Layout, FileText, CheckCircle } from 'lucide-react';

const FormItem = ({ label, children, className }) => (
    <div className={`space-y-2 relative ${className || ''}`}>
        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-2">
            {label}
        </label>
        <div className="relative">
            {children}
        </div>
    </div>
);

const ProductionComponent = ({ transactions, measureUnit, onAddMetric, onDeleteMetric }) => {
    const [showAdjust, setShowAdjust] = useState(false);
    const [adjustDate, setAdjustDate] = useState(new Date().toISOString().slice(0, 10));
    const [adjustType, setAdjustType] = useState('producao'); // producao | vendas
    const [adjustCategory, setAdjustCategory] = useState('Areia Fina');
    const [adjustValue, setAdjustValue] = useState('');

    const handleSaveAdjust = () => {
        if (!adjustValue) return;
        const val = parseFloat(adjustValue);
        if (isNaN(val)) return;

        const metricData = {
            date: adjustDate,
            metricType: adjustType,
            value: val,
            materialDescription: adjustCategory,
            description: `Lançamento Manual de ${adjustType.replace('_', ' ')}`
        };

        if (onAddMetric) {
            onAddMetric(metricData);
            setAdjustValue('');
            setShowAdjust(false);
        }
    };

    const data = useMemo(() => {
        const relevant = transactions.filter(t =>
            (t.type === 'metric' && ['producao', 'vendas', 'meta_producao', 'meta_vendas'].includes(t.metricType)) ||
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
                    MetaProdução: null,
                    MetaVendas: null,
                    Faturamento: 0,
                    Custo: 0,
                    sortKey: d.getTime()
                };
            }

            if (t.type === 'metric' && t.metricType === 'producao') grouped[key].Produção += t.value;
            if (t.type === 'metric' && t.metricType === 'vendas') grouped[key].Vendas += t.value;
            if (t.type === 'metric' && t.metricType === 'meta_producao') grouped[key].MetaProdução = (grouped[key].MetaProdução || 0) + t.value;
            if (t.type === 'metric' && t.metricType === 'meta_vendas') grouped[key].MetaVendas = (grouped[key].MetaVendas || 0) + t.value;
            if (t.type === 'revenue') grouped[key].Faturamento += t.value;
            if (t.type === 'expense') grouped[key].Custo += t.value;
        });

        return Object.values(grouped).sort((a, b) => a.sortKey - b.sortKey);
    }, [transactions]);

    const kpis = useMemo(() => {
        let prod = 0, vendas = 0, metaProd = 0, metaVendas = 0;
        transactions.forEach(t => {
            if (t.type === 'metric') {
                if (t.metricType === 'producao') prod += t.value;
                if (t.metricType === 'vendas') vendas += t.value;
                if (t.metricType === 'meta_producao') metaProd += t.value;
                if (t.metricType === 'meta_vendas') metaVendas += t.value;
            }
        });

        return {
            prod,
            vendas,
            metaProd,
            metaVendas,
            gapProd: prod - metaProd,
            gapVendas: vendas - metaVendas
        };
    }, [transactions]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-l-4 border-l-indigo-500 dark:border-slate-700">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-sm uppercase">Volume de Produção</p>
                        <Package className="text-indigo-500" size={20} />
                    </div>
                    <h3 className="text-3xl font-bold dark:text-white mb-1">
                        {kpis.prod.toLocaleString()} <span className="text-lg font-normal text-slate-400">{measureUnit}</span>
                    </h3>
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t dark:border-slate-700 border-slate-100 text-sm">
                        {kpis.metaProd > 0 ? (
                            <>
                                <span className={kpis.gapProd >= 0 ? "text-emerald-500 font-bold flex items-center" : "text-rose-500 font-bold flex items-center"}>
                                    {kpis.gapProd >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                                    {Math.abs(kpis.gapProd).toLocaleString()} {measureUnit} {kpis.gapProd >= 0 ? 'acima' : 'abaixo'} da meta
                                </span>
                                <span className="text-slate-400 ml-auto font-bold">Meta: {kpis.metaProd.toLocaleString()}</span>
                            </>
                        ) : (
                            <span className="text-slate-400">Meta não definida no período</span>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-l-4 border-l-emerald-500 dark:border-slate-700">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-sm uppercase">Volume de Vendas</p>
                        <Target className="text-emerald-500" size={20} />
                    </div>
                    <h3 className="text-3xl font-bold dark:text-white mb-1">
                        {kpis.vendas.toLocaleString()} <span className="text-lg font-normal text-slate-400">{measureUnit}</span>
                    </h3>
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t dark:border-slate-700 border-slate-100 text-sm">
                        {kpis.metaVendas > 0 ? (
                            <>
                                <span className={kpis.gapVendas >= 0 ? "text-emerald-500 font-bold flex items-center" : "text-rose-500 font-bold flex items-center"}>
                                    {kpis.gapVendas >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                                    {Math.abs(kpis.gapVendas).toLocaleString()} {measureUnit} {kpis.gapVendas >= 0 ? 'acima' : 'abaixo'} da meta
                                </span>
                                <span className="text-slate-400 ml-auto font-bold">Meta: {kpis.metaVendas.toLocaleString()}</span>
                            </>
                        ) : (
                            <span className="text-slate-400">Meta não definida no período</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between mb-4 mt-6">
                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                    <Package className="text-indigo-500" size={20} />
                    Quantitativo: Produção vs Vendas ({measureUnit})
                </h3>
                <button
                    onClick={() => setShowAdjust(!showAdjust)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 font-bold rounded-lg hover:bg-indigo-100 transition-colors"
                >
                    {showAdjust ? <X size={16} /> : <PlusCircle size={16} />}
                    {showAdjust ? 'Cancelar Lançamento' : 'Lançar Volume'}
                </button>
            </div>

            {showAdjust && (
                <div className="bg-white dark:bg-slate-900 w-full rounded-[2rem] shadow-[0_15px_60px_rgba(0,0,0,0.08)] border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-4 duration-500 mb-8 overflow-hidden">
                    {/* Header Inline Form */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                                <Package className="text-indigo-500" size={24} />
                                Lançamento de Volumes
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Lançamento local de Realizado e Metas</p>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                            {/* TIPO */}
                            <FormItem label="TIPO">
                                <select
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 font-bold text-slate-700 dark:text-white outline-none transition-all appearance-none"
                                    value={adjustType}
                                    onChange={(e) => setAdjustType(e.target.value)}
                                >
                                    <option value="producao">Real: Produção</option>
                                    <option value="vendas">Real: Venda</option>
                                    <option value="meta_producao">Meta: Produção</option>
                                    <option value="meta_vendas">Meta: Venda</option>
                                </select>
                                <Layout className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                            </FormItem>

                            {/* CATEGORIA */}
                            <FormItem label="CATEGORIA">
                                <select
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 font-bold text-slate-700 dark:text-white outline-none transition-all appearance-none"
                                    value={adjustCategory}
                                    onChange={(e) => setAdjustCategory(e.target.value)}
                                >
                                    <option value="Areia Fina">Areia Fina</option>
                                    <option value="Areia Grossa">Areia Grossa</option>
                                    <option value="Areia Suja">Areia Suja</option>
                                </select>
                                <FileText className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                            </FormItem>

                            {/* MÊS / DATA */}
                            <FormItem label="DATA DO LANÇAMENTO">
                                <input
                                    type="date"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 font-bold text-slate-700 dark:text-white outline-none transition-all"
                                    value={adjustDate}
                                    onChange={(e) => setAdjustDate(e.target.value)}
                                />
                                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                            </FormItem>

                            {/* VOLUME TOTAL */}
                            <FormItem label={`VOLUME TOTAL (${measureUnit})`}>
                                <div className="relative">
                                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
                                    <input
                                        type="number"
                                        placeholder="Ex: 8500"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 rounded-2xl p-4 pl-12 font-black text-emerald-600 dark:text-emerald-400 outline-none transition-all"
                                        value={adjustValue}
                                        onChange={(e) => setAdjustValue(e.target.value)}
                                    />
                                </div>
                            </FormItem>
                        </div>

                        {/* Footer Ações */}
                        <div className="flex justify-end gap-4 pt-4 border-t dark:border-slate-800">
                            <button
                                onClick={() => setShowAdjust(false)}
                                className="px-8 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 uppercase tracking-wider text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveAdjust}
                                disabled={!adjustValue}
                                className={`px-8 py-3.5 text-white font-extrabold rounded-xl transition-all shadow-xl active:scale-95 uppercase tracking-wider flex items-center gap-3 text-sm disabled:opacity-50
                                ${adjustType.includes('vendas') ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' : 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20'}`}
                            >
                                <CheckCircle size={18} />
                                Confirmar Lançamento
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-4 mt-6">
                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                    <Package className="text-indigo-500" size={20} />
                    Histórico Desempenho Físico Mensal
                </h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 p-6">
                    <h3 className="font-bold text-lg mb-4 dark:text-white flex items-center gap-2">
                        <Package className="text-indigo-500" size={20} />
                        Histórico de Produção ({measureUnit})
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                    cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                                />
                                <Legend />
                                <Bar name={`Produção (${measureUnit})`} dataKey="Produção" fill="#8884d8" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                <Line name="Meta Produção" type="step" dataKey="MetaProdução" stroke="#4f46e5" strokeDasharray="5 5" strokeWidth={3} dot={{ r: 4 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 p-6">
                    <h3 className="font-bold text-lg mb-4 dark:text-white flex items-center gap-2">
                        <Target className="text-emerald-500" size={20} />
                        Histórico de Vendas ({measureUnit})
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                <XAxis dataKey="name" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                    cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                                />
                                <Legend />
                                <Bar name={`Vendas (${measureUnit})`} dataKey="Vendas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                <Line name="Meta Venda" type="step" dataKey="MetaVendas" stroke="#059669" strokeDasharray="5 5" strokeWidth={3} dot={{ r: 4 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
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

            {/* Tabela de Lançamentos Físicos */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 p-6">
                <h3 className="font-bold text-lg mb-4 dark:text-white flex items-center gap-2">
                    <Package className="text-slate-400" size={20} />
                    Histórico de Lançamentos
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-bold uppercase text-[10px]">
                            <tr>
                                <th className="p-4">Data do Lançamento</th>
                                <th className="p-4">Tipo</th>
                                <th className="p-4">Categoria</th>
                                <th className="p-4 text-right">Volume</th>
                                <th className="p-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {transactions
                                .filter(t => t.type === 'metric' && ['producao', 'vendas', 'meta_producao', 'meta_vendas'].includes(t.metricType))
                                .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
                                .map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4 text-slate-600 dark:text-slate-300 font-medium">
                                            {new Date(t.date).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                                                ${t.metricType.includes('vendas') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                                                {t.metricType.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-500 dark:text-slate-400 font-medium">
                                            {t.materialDescription}
                                        </td>
                                        <td className="p-4 text-right font-black text-slate-700 dark:text-slate-200">
                                            {t.value.toLocaleString()} {measureUnit}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center">
                                                <button
                                                    onClick={() => onDeleteMetric && onDeleteMetric(t.id)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                    title="Excluir Lançamento"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {transactions.filter(t => t.type === 'metric' && ['producao', 'vendas', 'meta_producao', 'meta_vendas'].includes(t.metricType)).length === 0 && (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-400">Nenhum lançamento físico ou de meta encontrado no período.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProductionComponent;
