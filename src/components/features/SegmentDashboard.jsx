import React, { useMemo } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, Target,
    BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Factory, Package, Download
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ComposedChart, Line
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import KpiCard from '../common/KpiCard';
import { getTransactionDreCategory } from '../../utils/helpers';

const SegmentDashboard = ({ transactions, prevTransactions = [], segmentName, units }) => {
    // 1. Processamento de Dados Agregados
    const segmentData = useMemo(() => {
        const dataByUnit = {};
        const expenseTotals = {
            'Custos Operacionais': 0,
            'Despesas de Transporte': 0,
            'Tributos e Impostos': 0,
            'Despesas Administrativas': 0,
            'Investimentos': 0
        };

        units.forEach(unit => {
            dataByUnit[unit] = { revenue: 0, expense: 0, balance: 0, margin: 0, production: 0, sales: 0 };
        });

        // Filtrar transações do segmento
        transactions.forEach(t => {
            const tSegment = t.segment || '';
            const isMatch = units.some(u => tSegment.includes(u));

            if (isMatch) {
                const unitMatch = units.find(u => tSegment.includes(u));
                if (t.type === 'revenue') dataByUnit[unitMatch].revenue += (t.value || 0);
                if (t.type === 'expense') {
                    const val = (t.value || 0);
                    dataByUnit[unitMatch].expense += val;

                    // Consolidação de Despesas por Bloco DRE
                    const cat = getTransactionDreCategory(t, unitMatch);
                    if (cat === 'Custo Operacional' || cat === 'Custo Máquinas e Equipamentos' || cat === 'Outras Despesas') {
                        expenseTotals['Custos Operacionais'] += val;
                    } else if (cat.includes('(Transporte)')) {
                        expenseTotals['Despesas de Transporte'] += val;
                    } else if (cat === 'Total de Impostos') {
                        expenseTotals['Tributos e Impostos'] += val;
                    } else if (cat === 'Rateio Administrativo Central' || cat === 'Multas e Taxas') {
                        expenseTotals['Despesas Administrativas'] += val;
                    } else if (cat === 'Investimentos E Consórcios') {
                        expenseTotals['Investimentos'] += val;
                    }
                }
                if (t.type === 'metric' && t.metricType === 'producao') dataByUnit[unitMatch].production += (t.value || 0);
                if (t.type === 'metric' && t.metricType === 'vendas') dataByUnit[unitMatch].sales += (t.value || 0);
            }
        });

        const totals = { revenue: 0, expense: 0, balance: 0, margin: 0 };
        const chartData = Object.entries(dataByUnit).map(([name, data]) => {
            data.balance = data.revenue - data.expense;
            data.margin = data.revenue > 0 ? (data.balance / data.revenue) * 100 : 0;
            data.avgPrice = data.sales > 0 ? data.revenue / data.sales : 0;

            totals.revenue += data.revenue;
            totals.expense += data.expense;

            return {
                name: name.split('-').pop().trim(),
                fullName: name,
                ...data
            };
        }).sort((a, b) => b.revenue - a.revenue);

        totals.balance = totals.revenue - totals.expense;
        totals.margin = totals.revenue > 0 ? (totals.balance / totals.revenue) * 100 : 0;

        const expenseGroupsChart = Object.entries(expenseTotals)
            .filter(([_, val]) => val > 0)
            .map(([name, val]) => ({ name, value: val }))
            .sort((a, b) => b.value - a.value);

        return { chartData, totals, expenseGroupsChart, expenseTotals };
    }, [transactions, segmentName, units]);

    const prevSegmentData = useMemo(() => {
        const prevTotals = { revenue: 0, expense: 0, balance: 0, margin: 0 };
        prevTransactions.forEach(t => {
            const tSegment = t.segment || '';
            const isMatch = units.some(u => tSegment.includes(u));

            if (isMatch) {
                if (t.type === 'revenue') prevTotals.revenue += (t.value || 0);
                if (t.type === 'expense') prevTotals.expense += (t.value || 0);
            }
        });

        prevTotals.balance = prevTotals.revenue - prevTotals.expense;
        prevTotals.margin = prevTotals.revenue > 0 ? (prevTotals.balance / prevTotals.revenue) * 100 : 0;

        return { totals: prevTotals };
    }, [prevTransactions, segmentName, units]);

    const calcTrend = (curr, prev) => {
        if (prev === 0) return curr > 0 ? 100 : (curr < 0 ? -100 : 0);
        return ((curr - prev) / Math.abs(prev)) * 100;
    };

    const { chartData, totals, expenseGroupsChart, expenseTotals } = segmentData;
    const { totals: prevTotals } = prevSegmentData;

    const handleDownloadPDF = () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFillColor(79, 70, 229); // Indigo 600
        doc.rect(0, 0, pageWidth, 40, 'F');

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(segmentName, 14, 20);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Visão Consolidada do Segmento', 14, 28);
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 14, 28, { align: 'right' });

        let yPos = 50;

        // KPIs Summary
        doc.setTextColor(30, 41, 59); // Slate 800
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Indicadores Consolidados', 14, yPos);
        yPos += 10;

        const kpiData = [
            ['Faturamento Total', totals.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
            ['Custo Total', totals.expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
            ['Resultado Líquido', totals.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
            ['Margem Média', `${totals.margin.toFixed(1)}%`]
        ];

        autoTable(doc, {
            startY: yPos,
            body: kpiData,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 2 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { halign: 'left' } }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Comparative Table
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Performance por Unidade', 14, yPos);
        yPos += 8;

        const tableBody = chartData.map(u => [
            u.fullName.split('-').pop().trim(),
            u.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            u.expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            u.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            `${u.margin.toFixed(1)}%`
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Unidade', 'Faturamento', 'Custos', 'Resultado', 'Margem']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], textColor: 255 },
            styles: { fontSize: 8 },
            columnStyles: {
                1: { halign: 'right' },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right' }
            }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Produção, Vendas e Preço Médio
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Produção, Vendas e Preço Médio', 14, yPos);
        yPos += 8;

        const totalProduction = chartData.reduce((acc, u) => acc + (u.production || 0), 0);
        const totalSales = chartData.reduce((acc, u) => acc + (u.sales || 0), 0);
        const totalAvgPrice = totalSales > 0 ? totals.revenue / totalSales : 0;

        const prodTableBody = chartData.map(u => [
            u.fullName.split('-').pop().trim(),
            u.production.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
            u.sales.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
            u.avgPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        ]);

        prodTableBody.push([
            'TOTAL',
            totalProduction.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
            totalSales.toLocaleString('pt-BR', { maximumFractionDigits: 2 }),
            totalAvgPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Unidade', 'Produção', 'Vendas', 'Preço Médio']],
            body: prodTableBody,
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129], textColor: 255 },
            styles: { fontSize: 8 },
            columnStyles: {
                1: { halign: 'right' },
                2: { halign: 'right' },
                3: { halign: 'right' }
            },
            willDrawCell: function (data) {
                if (data.row.index === prodTableBody.length - 1 && data.section === 'body') {
                    doc.setFont('helvetica', 'bold');
                    doc.setFillColor(241, 245, 249);
                }
            }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Expense Groups
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Consolidado de Despesas (DRE)', 14, yPos);
        yPos += 8;

        const expenseTable = Object.entries(expenseTotals)
            .filter(([_, val]) => val > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([name, val]) => [name, val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), `${((val / totals.expense) * 100).toFixed(1)}%`]);

        autoTable(doc, {
            startY: yPos,
            head: [['Grupo de Despesa', 'Valor Total', '% do Custo']],
            body: expenseTable,
            theme: 'striped',
            headStyles: { fillColor: [244, 63, 94], textColor: 255 },
            styles: { fontSize: 9 },
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } }
        });

        doc.save(`Segmento_${segmentName.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header com Contexto */}
            <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                                <Factory size={24} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest opacity-80">Visão Consolidada do Segmento</span>
                        </div>
                        <h2 className="text-4xl font-black mb-2">{segmentName}</h2>
                        <p className="text-indigo-100 max-w-xl">Análise agregada de <strong>{units.length} unidades</strong>. Visualizando performance consolidada e comparativo de mercado interno.</p>
                    </div>

                    <button
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-2xl font-black hover:bg-indigo-50 transition-all shadow-lg active:scale-95 whitespace-nowrap"
                    >
                        <Download size={20} /> PDF
                    </button>
                </div>
                <div className="absolute top-[-20%] right-[-5%] opacity-10 rotate-12 scale-150 pointer-events-none">
                    <BarChart3 size={300} />
                </div>
            </div>

            {/* KPIs Consolidados */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Faturamento Total" value={totals.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={TrendingUp} color="emerald" trend={calcTrend(totals.revenue, prevTotals.revenue)} prefix="" suffix="" />
                <KpiCard title="Custo Total" value={totals.expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={TrendingDown} color="rose" reverseColor={true} trend={calcTrend(totals.expense, prevTotals.expense)} prefix="" suffix="" />
                <KpiCard title="Resultado Líquido" value={totals.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={DollarSign} color={totals.balance >= 0 ? 'indigo' : 'rose'} trend={calcTrend(totals.balance, prevTotals.balance)} prefix="" suffix="" />
                <KpiCard title="Margem Média" value={totals.margin.toFixed(1)} suffix="%" icon={Target} color="amber" trend={calcTrend(totals.margin, prevTotals.margin)} prefix="" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Comparativo de Faturamento (2/3) */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border dark:border-slate-700">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-6 uppercase text-sm tracking-widest flex items-center gap-2">
                        <BarChart3 size={18} className="text-indigo-500" /> Comparativo de Faturamento por Unidade
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                                <XAxis type="number" tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                />
                                <Bar dataKey="revenue" name="Receita" radius={[0, 4, 4, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={'#6366f1'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. Grupo de Despesas (1/3) */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border dark:border-slate-700">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-6 uppercase text-sm tracking-widest flex items-center gap-2">
                        <DollarSign size={18} className="text-rose-500" /> Grupo de Despesas
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={expenseGroupsChart} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                                <XAxis type="number" tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} itemStyle={{ color: '#fff' }} formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                                <Bar dataKey="value" name="Valor" radius={[0, 4, 4, 0]} barSize={20}>
                                    {expenseGroupsChart.map((entry, index) => (
                                        <Cell key={`cell-exp-${index}`} fill={'#f43f5e'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3. Produção vs Vendas (1/3) */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border dark:border-slate-700">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-6 uppercase text-sm tracking-widest flex items-center gap-2">
                        <Package size={18} className="text-emerald-500" /> Produção vs Vendas por Unidade
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={60} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                <YAxis tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                                <Bar dataKey="production" name="Produção" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                <Line type="monotone" dataKey="sales" name="Vendas" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 4. Preço Médio (1/3) */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border dark:border-slate-700">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-6 uppercase text-sm tracking-widest flex items-center gap-2">
                        <DollarSign size={18} className="text-amber-500" /> Preço Médio por Unidade
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={60} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                <YAxis tickFormatter={(val) => `R$ ${val}`} tick={{ fontSize: 10 }} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                />
                                <Bar dataKey="avgPrice" name="Preço Médio" radius={[4, 4, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`avg-${index}`} fill={'#f59e0b'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 5. Ranking (1/3) */}
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
