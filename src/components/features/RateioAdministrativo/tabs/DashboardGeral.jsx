import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, AlertTriangle, TrendingUp, TrendingDown, Layers, Building, Loader2, Send } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import dbService from '../../../../services/dbService';
import reportService from '../../../../services/reportService';

const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#06b6d4'];

const KpiCard = ({ title, value, icon: Icon, colorClass, subtitle }) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border dark:border-slate-700 shadow-sm flex items-start justify-between">
        <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{title}</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-1">{value}</h3>
            {subtitle && <p className="text-xs text-slate-400 font-medium">{subtitle}</p>}
        </div>
        <div className={`p-4 rounded-xl ${colorClass}`}>
            <Icon size={24} />
        </div>
    </div>
);

export default function DashboardGeral({ filter }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

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

    // Filter by period
    const filteredData = useMemo(() => {
        return transactions.filter(t => {
            if (!t.date || t.date.length < 10) return false;
            // Assuming format DD/MM/YYYY or YYYY-MM-DD
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
            if (filter.type === 'quarter' && (Math.floor(m / 3) + 1) !== filter.quarter) return false;
            if (filter.type === 'semester' && (m < 6 ? 1 : 2) !== filter.semester) return false;

            return true;
        });
    }, [transactions, filter]);

    // Calculate KPIs
    const KPIs = useMemo(() => {
        const total = filteredData.reduce((acc, t) => acc + t.value, 0);
        const diretos = filteredData.filter(t => t.type?.toLowerCase() === 'direto').reduce((acc, t) => acc + t.value, 0);
        const indiretos = filteredData.filter(t => t.type?.toLowerCase() === 'indireto').reduce((acc, t) => acc + t.value, 0);

        return {
            total,
            diretos,
            indiretos,
            diretosPerc: total > 0 ? (diretos / total) * 100 : 0
        };
    }, [filteredData]);

    // Chart Data
    const segmentChartData = useMemo(() => {
        const groups = {};
        filteredData.forEach(t => {
            const seg = t.segment || 'Outros';
            if (!groups[seg]) groups[seg] = 0;
            groups[seg] += t.value;
        });
        return Object.keys(groups).map(k => ({ name: k, Valor: groups[k] }))
            .sort((a, b) => b.Valor - a.Valor).slice(0, 10);
    }, [filteredData]);

    const pieData = [
        { name: 'Diretos', value: KPIs.diretos },
        { name: 'Indiretos', value: KPIs.indiretos }
    ].filter(item => item.value > 0);

    const formatterCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const handleSendReport = async () => {
        setSending(true);
        try {
            const summary = reportService.generateExecutiveSummary(filter, KPIs);
            const resEmail = await reportService.sendEmailReport(summary);
            const resWpp = await reportService.sendWhatsAppReport(summary);
            alert(`Envio Concluído!\n${resEmail.message}\n${resWpp.message}`);
        } catch (e) {
            alert('Erro ao enviar relatório.');
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={48} /></div>;
    }

    if (filteredData.length === 0) {
        return (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                <AlertTriangle size={48} className="mb-4 text-amber-400" />
                <h3 className="text-xl font-bold mb-2 text-slate-700 dark:text-slate-300">Nenhum dado encontrado</h3>
                <p>Não há lançamentos de rateio para o período selecionado.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Actions */}
            <div className="flex justify-between items-center bg-indigo-50 dark:bg-slate-800 p-4 rounded-xl border border-indigo-100 dark:border-slate-700">
                <div>
                    <h3 className="font-bold text-indigo-900 dark:text-indigo-400">Resumo do Período - {filter.month + 1}/{filter.year}</h3>
                    <p className="text-xs text-indigo-700 dark:text-slate-400">Visão consolidada para rateio corporativo</p>
                </div>
                <button
                    onClick={handleSendReport}
                    disabled={sending}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Enviar Relatório
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KpiCard
                    title="Custo Total Rateado"
                    value={formatterCurrency(KPIs.total)}
                    icon={DollarSign}
                    colorClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400"
                    subtitle="Todos os segmentos consolidados"
                />
                <KpiCard
                    title="Custos Diretos"
                    value={formatterCurrency(KPIs.diretos)}
                    icon={Layers}
                    colorClass="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
                    subtitle={`${KPIs.diretosPerc.toFixed(1)}% do total`}
                />
                <KpiCard
                    title="Custos Indiretos"
                    value={formatterCurrency(KPIs.indiretos)}
                    icon={Building}
                    colorClass="bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400"
                    subtitle={`${(100 - KPIs.diretosPerc).toFixed(1)}% do total`}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl border dark:border-slate-700 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold mb-6 dark:text-white flex items-center gap-2">
                        <TrendingUp size={20} className="text-indigo-500" />
                        Custos por Segmento
                    </h3>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={segmentChartData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
                                <XAxis type="number" tickFormatter={(val) => `R$ ${(val / 1000)}k`} />
                                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, fill: '#64748b' }} />
                                <Tooltip
                                    formatter={(value) => formatterCurrency(value)}
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                                />
                                <Bar dataKey="Valor" radius={[0, 6, 6, 0]}>
                                    {segmentChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border dark:border-slate-700 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold mb-6 dark:text-white flex items-center gap-2">
                        <TrendingDown size={20} className="text-indigo-500" />
                        Direto vs Indireto
                    </h3>
                    <div className="flex-1 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.name === 'Diretos' ? '#f59e0b' : '#a855f7'} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatterCurrency(value)} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
