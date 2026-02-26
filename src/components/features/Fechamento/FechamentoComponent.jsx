import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    ChevronDown,
    ChevronRight,
    Printer,
    FileText,
    FileSpreadsheet,
    TrendingUp,
    TrendingDown,
    Wrench,
    Calculator,
    AlertTriangle,
    Wallet,
    Target,
    Activity,
    Factory,
    Truck,
    Receipt,
    Banknote,
    Zap
} from 'lucide-react';
import { COST_CENTER_RULES } from '../../../constants/costCenterRules';

const FechamentoComponent = ({ transactions, totalSales, totalProduction, measureUnit, filter, selectedUnit }) => {
    const [expanded, setExpanded] = useState({
        'receitas': true,
        'custo_operacional': true,
        'manutencao': false
    });

    const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

    const getPeriodLabel = () => {
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        if (filter.type === 'month') return `${months[filter.month]}/${filter.year}`;
        if (filter.type === 'quarter') return `${filter.quarter}º Trimestre/${filter.year}`;
        if (filter.type === 'semester') return `${filter.semester}º Semestre/${filter.year}`;
        return `Ano de ${filter.year}`;
    };

    const unitLabel = selectedUnit.includes(':') ? selectedUnit.split(':')[1].trim() : selectedUnit;
    const dynamicTitle = `DRE: ${unitLabel} - ${getPeriodLabel()}`;

    const data = useMemo(() => {
        const totalRevenue = transactions.filter(t => t.type === 'revenue').reduce((acc, t) => acc + t.value, 0);
        const sum = (fn) => transactions.filter(fn).reduce((acc, t) => acc + t.value, 0);

        const isInRuleGroup = (t, groupName, subGroupName = null) => {
            const rules = COST_CENTER_RULES["Portos de Areia"]; // Fixo para Portos por enquanto
            if (!rules || !rules[groupName]) return false;
            const ccCode = t.costCenter ? parseInt(t.costCenter.split(' ')[0]) : 0;
            if (subGroupName) {
                return rules[groupName][subGroupName]?.includes(ccCode);
            }
            return Object.values(rules[groupName]).flat().includes(ccCode);
        };

        const recMaterial = sum(t => t.type === 'revenue' && (t.description.toLowerCase().includes('retira') || t.description.toLowerCase().includes('entrega') || t.accountPlan === '01.01'));
        const recFrete = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('frete'));
        const subsidio = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('subsídio'));
        const recRetira = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('retira'));
        const recEntrega = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('entrega'));
        const freteCarreta = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('carreta'));
        const freteTruck = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('truck'));
        const freteTerceiros = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('terceiros') && t.description.toLowerCase().includes('frete'));

        const despUnidade = sum(t => t.type === 'expense' && isInRuleGroup(t, 'DESPESAS DA UNIDADE'));
        const combustivel = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && (t.description.toLowerCase().includes('combustivel') || t.description.toLowerCase().includes('diesel') || t.accountPlan === '03.07.01'));
        const totalCustoOperacional = despUnidade + combustivel;

        const margemContribuicao = totalRevenue - totalCustoOperacional;

        const manutencaoTotal = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05'));
        const manuPrev = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('preventiva'));
        const manuCorr = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('corretiva'));
        const manuReform = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('reforma'));
        const manuFrete = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('frete'));
        const manuPneus = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('pneu'));
        const manuRessolado = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('ressolado'));
        const manuNovos = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('novos'));

        const totalTransporteGroup = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE'));
        const residualTransporte = totalTransporteGroup - combustivel - manutencaoTotal;

        const transpTerceiros = sum(t => t.type === 'expense' && t.description.toLowerCase().includes('transporte terceiros'));
        const impostos = sum(t => t.type === 'expense' && (t.accountPlan.startsWith('02') || t.description.toLowerCase().includes('imposto')));

        const resultOperacional = margemContribuicao - manutencaoTotal - residualTransporte - transpTerceiros - impostos;

        const rateioAdm = sum(t => t.type === 'expense' && t.description.toLowerCase().includes('rateio despesas'));
        const multas = sum(t => t.type === 'expense' && (t.description.toLowerCase().includes('multa') || t.description.toLowerCase().includes('taxa')));
        const frotaParada = sum(t => t.type === 'expense' && t.description.toLowerCase().includes('frota parada'));

        const resultPosDespesas = resultOperacional - rateioAdm - multas - frotaParada;

        const investimentos = sum(t => t.type === 'expense' && (t.accountPlan.startsWith('06') || t.description.toLowerCase().includes('consórcio') || t.description.toLowerCase().includes('investimento')));
        const resultFinal = resultPosDespesas - investimentos;

        return {
            totalRevenue, recMaterial, recRetira, recEntrega, recFrete, freteCarreta, freteTruck, freteTerceiros, subsidio,
            totalCustoOperacional, despUnidade, combustivel, margemContribuicao,
            manutencaoTotal, manuPrev, manuCorr, manuReform, manuFrete, manuPneus, manuRessolado, manuNovos,
            residualTransporte, transpTerceiros, impostos, resultOperacional, rateioAdm, multas, frotaParada,
            resultPosDespesas, investimentos, resultFinal
        };
    }, [transactions]);

    const handleExportExcel = () => {
        // Create an array of rows
        const rows = [
            ['DRE Gerencial', unitLabel, getPeriodLabel()],
            [''],
            ['Descrição', 'Valor (R$)', '%', 'R$/ton'],
            ['Receitas', '', '', ''],
            ['Total Receitas (Faturamento Bruto)', data.totalRevenue, '100%', formatPerUnit(data.totalRevenue).replace('R$', '').trim()],
            ['Receita de Material', data.recMaterial, formatPct(data.recMaterial), formatPerUnit(data.recMaterial).replace('R$', '').trim()],
            ['Receita Retira', data.recRetira, formatPct(data.recRetira), formatPerUnit(data.recRetira).replace('R$', '').trim()],
            ['Receita Entrega', data.recEntrega, formatPct(data.recEntrega), formatPerUnit(data.recEntrega).replace('R$', '').trim()],
            ['Receita de Frete', data.recFrete, formatPct(data.recFrete), formatPerUnit(data.recFrete).replace('R$', '').trim()],
            ['Frete Carreta', data.freteCarreta, formatPct(data.freteCarreta), formatPerUnit(data.freteCarreta).replace('R$', '').trim()],
            ['Frete Truck', data.freteTruck, formatPct(data.freteTruck), formatPerUnit(data.freteTruck).replace('R$', '').trim()],
            ['Frete Terceiros', data.freteTerceiros, formatPct(data.freteTerceiros), formatPerUnit(data.freteTerceiros).replace('R$', '').trim()],
            ['Subsídio de Terceiros', data.subsidio, formatPct(data.subsidio), formatPerUnit(data.subsidio).replace('R$', '').trim()],
            [''],
            ['Custos Operacionais', '', '', ''],
            ['Total Custos Operacionais', data.totalCustoOperacional, formatPct(data.totalCustoOperacional), formatPerUnit(data.totalCustoOperacional).replace('R$', '').trim()],
            ['Despesas da Unidade', data.despUnidade, formatPct(data.despUnidade), formatPerUnit(data.despUnidade).replace('R$', '').trim()],
            ['Combustível Transporte', data.combustivel, formatPct(data.combustivel), formatPerUnit(data.combustivel).replace('R$', '').trim()],
            [''],
            ['Margem de Contribuição', data.margemContribuicao, formatPct(data.margemContribuicao), formatPerUnit(data.margemContribuicao).replace('R$', '').trim()],
            [''],
            ['Manutenção Transporte', data.manutencaoTotal, formatPct(data.manutencaoTotal), formatPerUnit(data.manutencaoTotal).replace('R$', '').trim()],
            ['Manutenção Preventiva', data.manuPrev, formatPct(data.manuPrev), formatPerUnit(data.manuPrev).replace('R$', '').trim()],
            ['Manutenção Corretiva', data.manuCorr, formatPct(data.manuCorr), formatPerUnit(data.manuCorr).replace('R$', '').trim()],
            ['Manutenção Reforma', data.manuReform, formatPct(data.manuReform), formatPerUnit(data.manuReform).replace('R$', '').trim()],
            ['Fretes compras p/ manutenção', data.manuFrete, formatPct(data.manuFrete), formatPerUnit(data.manuFrete).replace('R$', '').trim()],
            ['Serviços de Pneus/Borracharia', data.manuPneus, formatPct(data.manuPneus), formatPerUnit(data.manuPneus).replace('R$', '').trim()],
            ['Pneus Ressolados', data.manuRessolado, formatPct(data.manuRessolado), formatPerUnit(data.manuRessolado).replace('R$', '').trim()],
            ['Pneus Novos', data.manuNovos, formatPct(data.manuNovos), formatPerUnit(data.manuNovos).replace('R$', '').trim()],
            [''],
            ['Total Despesas Transportes Frota Própria', data.residualTransporte, formatPct(data.residualTransporte), formatPerUnit(data.residualTransporte).replace('R$', '').trim()],
            ['Total Despesas Transportes Terceiros', data.transpTerceiros, formatPct(data.transpTerceiros), formatPerUnit(data.transpTerceiros).replace('R$', '').trim()],
            ['Impostos', data.impostos, formatPct(data.impostos), formatPerUnit(data.impostos).replace('R$', '').trim()],
            [''],
            ['Resultado Operacional', data.resultOperacional, formatPct(data.resultOperacional), formatPerUnit(data.resultOperacional).replace('R$', '').trim()],
            [''],
            ['Rateio Despesas Administrativas', data.rateioAdm, formatPct(data.rateioAdm), formatPerUnit(data.rateioAdm).replace('R$', '').trim()],
            ['Despesas Multas e Taxas', data.multas, formatPct(data.multas), formatPerUnit(data.multas).replace('R$', '').trim()],
            ['Frota Parada', data.frotaParada, formatPct(data.frotaParada), formatPerUnit(data.frotaParada).replace('R$', '').trim()],
            [''],
            ['Resultado Pós Despesas', data.resultPosDespesas, formatPct(data.resultPosDespesas), formatPerUnit(data.resultPosDespesas).replace('R$', '').trim()],
            [''],
            ['Investimentos / Consórcios', data.investimentos, formatPct(data.investimentos), formatPerUnit(data.investimentos).replace('R$', '').trim()],
            [''],
            ['Resultado Líquido Final', data.resultFinal, formatPct(data.resultFinal), formatPerUnit(data.resultFinal).replace('R$', '').trim()],
        ];

        // Format rules for CSV
        const csvContent = rows.map(e => e.join(";")).join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);

        // Clean up file name
        const cleanUnit = unitLabel.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/ /g, '_');
        const cleanPeriod = getPeriodLabel().replace(/ /g, '_').replace(/\//g, '_');
        link.setAttribute("download", `DRE_${cleanUnit}_${cleanPeriod}.csv`);

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const colorIndigo = [79, 70, 229];
        const colorTextDark = [15, 23, 42];

        doc.setFontSize(16);
        doc.setTextColor(...colorIndigo);
        doc.text(dynamicTitle, 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(...colorTextDark);
        doc.text(`Produção Total: ${totalProduction.toLocaleString()} ton`, 14, 28);
        doc.text(`Vendas Totais: ${totalSales.toLocaleString()} ton`, 14, 34);
        doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 14, 40);

        const buildRow = (label, val, isHeader = false, isResult = false) => {
            const percentStr = formatPct(val);
            const rpwStr = formatPerUnit(val).replace('R$', '').trim();
            const valStr = formatBRL(val);

            let styles = {};
            if (isResult) {
                styles = { fontStyle: 'bold', fillColor: val >= 0 ? [240, 253, 244] : [255, 241, 242], textColor: val >= 0 ? [21, 128, 61] : [225, 29, 72] };
            } else if (isHeader) {
                styles = { fontStyle: 'bold', fillColor: [248, 250, 252], textColor: [15, 23, 42] };
            }

            return [
                { content: label, styles },
                { content: valStr, styles: { ...styles, halign: 'right' } },
                { content: percentStr, styles: { ...styles, halign: 'right' } },
                { content: rpwStr, styles: { ...styles, halign: 'right' } }
            ];
        };

        const tBody = [
            buildRow('Total Receitas (Faturamento Bruto)', data.totalRevenue, true),
            buildRow('   Receita de Material', data.recMaterial),
            buildRow('      Receita Retira', data.recRetira),
            buildRow('      Receita Entrega', data.recEntrega),
            buildRow('   Receita de Frete', data.recFrete),
            buildRow('      Frete Carreta', data.freteCarreta),
            buildRow('      Frete Truck', data.freteTruck),
            buildRow('      Frete Terceiros', data.freteTerceiros),
            buildRow('   Subsídio de Terceiros', data.subsidio),

            buildRow('Custos Operacionais', data.totalCustoOperacional, true),
            buildRow('   Despesas da Unidade', data.despUnidade),
            buildRow('   Combustível Transporte', data.combustivel),

            buildRow('MARGEM DE CONTRIBUIÇÃO', data.margemContribuicao, false, true),

            buildRow('Manutenção Transporte', data.manutencaoTotal, true),
            buildRow('   Manutenção Preventiva', data.manuPrev),
            buildRow('   Manutenção Corretiva', data.manuCorr),
            buildRow('   Manutenção Reforma', data.manuReform),
            buildRow('   Fretes compras p/ manutenção', data.manuFrete),
            buildRow('   Serviços de Pneus/Borracharia', data.manuPneus),
            buildRow('   Pneus Ressolados', data.manuRessolado),
            buildRow('   Pneus Novos', data.manuNovos),

            buildRow('Total Despesas Transportes Frota Própria', data.residualTransporte, true),
            buildRow('Total Despesas Transportes Terceiros', data.transpTerceiros, true),
            buildRow('Impostos', data.impostos, true),

            buildRow('RESULTADO OPERACIONAL', data.resultOperacional, false, true),

            buildRow('Rateio Despesas Administrativas', data.rateioAdm, true),
            buildRow('Despesas Multas e Taxas', data.multas, true),
            buildRow('Frota Parada', data.frotaParada, true),

            buildRow('RESULTADO PÓS DESPESAS', data.resultPosDespesas, false, true),

            buildRow('Investimentos / Consórcios', data.investimentos, true),

            buildRow('RESULTADO LÍQUIDO FINAL', data.resultFinal, false, true),
        ];

        autoTable(doc, {
            startY: 46,
            head: [['Descrição', 'Valor (R$)', '%', 'R$/ton']],
            body: tBody,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, lineColor: [226, 232, 240] },
            headStyles: { fillColor: colorIndigo, textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 35, halign: 'right' },
                2: { cellWidth: 20, halign: 'right' },
                3: { cellWidth: 25, halign: 'right' }
            }
        });

        const cleanUnit = unitLabel.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/ /g, '_');
        const cleanPeriod = getPeriodLabel().replace(/ /g, '_').replace(/\//g, '_');
        doc.save(`DRE_${cleanUnit}_${cleanPeriod}.pdf`);
    };

    // Formatters
    const formatBRL = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formatPct = (val) => {
        if (data.totalRevenue === 0) return '-';
        return `${((val / data.totalRevenue) * 100).toFixed(2)}%`;
    };
    const formatPerUnit = (val) => {
        if (totalSales === 0) return '-';
        return formatBRL(val / totalSales);
    };

    // Card Row Component
    const DataRow = ({ icon: Icon, label, value, isSub = false, color = "text-slate-700", bg = "bg-transparent", isBold = false, onClick, expanded, hasArrow }) => {
        const isClickable = !!onClick;

        return (
            <div
                onClick={onClick}
                className={`flex flex-col sm:flex-row items-start sm:items-center p-3 transition-colors select-none ${isClickable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50' : ''} ${bg} rounded-lg ${isSub ? 'ml-8 sm:ml-12 mt-1 !py-2 border-l-2 border-slate-200 dark:border-slate-700' : 'border-b border-slate-100 dark:border-slate-800'}`}
            >
                <div className="flex-1 min-w-[200px] flex items-center gap-3">
                    {hasArrow && (
                        <div className={`p-1 rounded-md transition-transform duration-200 ${expanded ? 'bg-slate-200 dark:bg-slate-700' : 'bg-slate-100 dark:bg-slate-800'}`}>
                            {expanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                        </div>
                    )}
                    {Icon && !hasArrow && <Icon size={isSub ? 14 : 18} className={`${color} opacity-70`} />}
                    <span className={`${isBold ? 'font-bold' : 'font-medium text-sm'} ${color} dark:text-slate-200`}>
                        {label}
                    </span>
                </div>

                <div className="w-full sm:w-auto flex justify-between sm:justify-end items-center gap-4 sm:gap-8 mt-2 sm:mt-0 pl-7 sm:pl-0">
                    <div className="w-16 sm:w-20 text-right">
                        <span className="text-xs font-mono text-slate-400 dark:text-slate-500 block sm:hidden">R$/ton</span>
                        <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{formatPerUnit(value)}</span>
                    </div>
                    <div className="w-16 sm:w-20 text-right">
                        <span className="text-xs font-mono text-slate-400 dark:text-slate-500 block sm:hidden">%</span>
                        <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{formatPct(value)}</span>
                    </div>
                    <div className="w-24 sm:w-32 text-right">
                        <span className="text-xs font-mono text-slate-400 dark:text-slate-500 block sm:hidden">Valor</span>
                        <span className={`text-base ${(isBold && !isSub) ? 'font-black' : 'font-bold'} ${color} dark:text-slate-100`}>
                            {value === 0 && isSub ? '-' : formatBRL(value)}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    // Result Highlight Component
    const ResultRow = ({ icon: Icon, label, value, colorType }) => {
        let bgClass, textClass, iconClass;

        switch (colorType) {
            case 'emerald':
                bgClass = 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
                textClass = 'text-emerald-700 dark:text-emerald-400';
                iconClass = 'text-emerald-500 dark:text-emerald-400';
                break;
            case 'blue':
                bgClass = 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800';
                textClass = 'text-indigo-700 dark:text-indigo-400';
                iconClass = 'text-indigo-500 dark:text-indigo-400';
                break;
            case 'slate':
            default:
                bgClass = 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700';
                textClass = 'text-slate-800 dark:text-slate-200';
                iconClass = 'text-slate-500 dark:text-slate-400';
                break;
        }

        const isNegative = value < 0;
        if (isNegative && colorType !== 'rose') {
            // Override if negative result
            bgClass = 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800';
            textClass = 'text-rose-700 dark:text-rose-400';
            iconClass = 'text-rose-500 dark:text-rose-400';
        }

        return (
            <div className={`flex flex-col sm:flex-row justify-between items-center p-4 sm:p-5 my-4 rounded-xl border shadow-sm ${bgClass}`}>
                <div className="flex items-center gap-3 w-full sm:w-auto mb-2 sm:mb-0">
                    <div className={`p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm ${iconClass}`}>
                        {Icon && <Icon size={24} />}
                    </div>
                    <span className={`text-lg font-black uppercase tracking-wide ${textClass}`}>
                        {label}
                    </span>
                </div>
                <div className="flex w-full sm:w-auto justify-between sm:justify-end items-center gap-4 sm:gap-8">
                    <div className="text-right hidden sm:block">
                        <span className="text-xs uppercase font-bold text-slate-400 dark:text-slate-500 block">R$/ton</span>
                        <span className={`font-mono font-medium ${textClass}`}>{formatPerUnit(value)}</span>
                    </div>
                    <div className="text-right hidden sm:block">
                        <span className="text-xs uppercase font-bold text-slate-400 dark:text-slate-500 block">%</span>
                        <span className={`font-mono font-medium ${textClass}`}>{formatPct(value)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-xs uppercase font-bold text-slate-400 dark:text-slate-500 block mb-1">Resultado Líquido</span>
                        <span className={`text-2xl sm:text-3xl font-black ${textClass}`}>
                            {formatBRL(value)}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 print:bg-white print:p-0">
            <style>{`
                @media print {
                    aside, header, button.no-print { display: none !important; }
                    main { padding: 0 !important; overflow: visible !important; }
                    body { background: white !important; }
                    .print\\:shadow-none { box-shadow: none !important; }
                    .print\\:border-none { border: none !important; }
                    .print\\:p-0 { padding: 0 !important; }
                    .print\\:bg-white { background: transparent !important; }
                    .print\\:text-black { color: black !important; }
                    .shadow-sm, .shadow-md, .shadow-lg { box-shadow: none !important; }
                }
            `}</style>

            {/* Export Buttons Container */}
            <div className="flex justify-end gap-2 w-full mb-4">
                <button
                    onClick={handleExportPDF}
                    className="no-print flex-1 md:flex-none flex justify-center items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 rounded-xl transition-colors font-medium text-sm shadow-sm"
                    aria-label="Exportar PDF"
                >
                    <FileText size={18} />
                    <span>Exportar PDF</span>
                </button>
                <button
                    onClick={handleExportExcel}
                    className="no-print flex-1 md:flex-none flex justify-center items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-400 rounded-xl transition-colors font-medium text-sm shadow-sm"
                    aria-label="Exportar Excel"
                >
                    <FileSpreadsheet size={18} />
                    <span>Exportar Excel</span>
                </button>
            </div>

            {/* Header Card */}
            <div className="px-6 py-6 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 print:border-b-2 print:border-slate-800 print:shadow-none print:rounded-none print:mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                            <Activity size={24} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white print:text-black">{dynamicTitle}</h2>
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-12">Demonstrativo de Resultados do Exercício (Gerencial)</p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                        <Factory className="text-slate-400" size={20} />
                        <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Produção Total</span>
                            <span className="font-black text-slate-700 dark:text-slate-200">{totalProduction.toLocaleString()} <span className="text-xs font-normal">ton</span></span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                        <Truck className="text-emerald-500 dark:text-emerald-400" size={20} />
                        <div>
                            <span className="text-[10px] uppercase font-bold text-emerald-600/70 dark:text-emerald-500/70 block leading-tight">Vendas Totais</span>
                            <span className="font-black text-emerald-700 dark:text-emerald-400">{totalSales.toLocaleString()} <span className="text-xs font-normal">ton</span></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* DRE Body Grid Header */}
            <div className="hidden sm:flex justify-end gap-8 px-5 mb-2 mr-[14px]">
                <span className="w-20 text-right text-xs uppercase font-bold text-slate-400 dark:text-slate-500">R$/ton</span>
                <span className="w-20 text-right text-xs uppercase font-bold text-slate-400 dark:text-slate-500">%</span>
                <span className="w-32 text-right text-xs uppercase font-bold text-slate-400 dark:text-slate-500">Valor (R$)</span>
            </div>

            {/* Receitas Accordion */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-4 overflow-hidden print:border-none print:shadow-none print:bg-transparent">
                <DataRow
                    label="Total Receitas (Faturamento Bruto)"
                    value={data.totalRevenue}
                    hasArrow
                    expanded={expanded['receitas']}
                    onClick={() => toggle('receitas')}
                    isBold
                    color="text-sky-700 dark:text-sky-400"
                    bg="bg-sky-50/50 dark:bg-sky-900/10"
                />

                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded['receitas'] ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="pb-3 pt-1">
                        <DataRow icon={Banknote} label="Receita de Material" value={data.recMaterial} isSub color="text-sky-600 dark:text-sky-300" />
                        <DataRow label="Receita Retira" value={data.recRetira} isSub color="text-sky-500 dark:text-sky-400" indent level={2} />
                        <DataRow label="Receita Entrega" value={data.recEntrega} isSub color="text-sky-500 dark:text-sky-400" indent level={2} />

                        <DataRow icon={Truck} label="Receita de Frete" value={data.recFrete} isSub color="text-sky-600 dark:text-sky-300" />
                        <DataRow label="Frete Carreta" value={data.freteCarreta} isSub color="text-sky-500 dark:text-sky-400" indent level={2} />
                        <DataRow label="Frete Truck" value={data.freteTruck} isSub color="text-sky-500 dark:text-sky-400" indent level={2} />
                        <DataRow label="Frete Terceiros" value={data.freteTerceiros} isSub color="text-sky-500 dark:text-sky-400" indent level={2} />

                        <DataRow icon={Receipt} label="Subsídio de Terceiros" value={data.subsidio} isSub color="text-sky-600 dark:text-sky-300" />
                    </div>
                </div>
            </div>

            {/* Custos Operacionais Accordion */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-4 overflow-hidden print:border-none print:shadow-none print:bg-transparent">
                <DataRow
                    label="Custos Operacionais"
                    value={data.totalCustoOperacional}
                    hasArrow
                    expanded={expanded['custo_operacional']}
                    onClick={() => toggle('custo_operacional')}
                    isBold
                    color="text-rose-600 dark:text-rose-400"
                    bg="bg-rose-50/50 dark:bg-rose-900/10"
                />

                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded['custo_operacional'] ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="pb-3 pt-1">
                        <DataRow icon={Factory} label="Despesas da Unidade" value={data.despUnidade} isSub color="text-rose-500 dark:text-rose-400" />
                        <DataRow icon={Zap} label="Combustível Transporte" value={data.combustivel} isSub color="text-rose-500 dark:text-rose-400" />
                    </div>
                </div>
            </div>

            {/* MARGEM DE CONTRIBUIÇÃO */}
            <ResultRow
                icon={Target}
                label="Margem de Contribuição"
                value={data.margemContribuicao}
                colorType="blue"
            />

            {/* Despesas Diretas */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-4 overflow-hidden print:border-none print:shadow-none print:bg-transparent">
                <DataRow icon={Wrench} label="Manutenção Transporte" value={data.manutencaoTotal} hasArrow expanded={expanded['manutencao']} onClick={() => toggle('manutencao')} isBold color="text-rose-600 dark:text-rose-400" />

                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded['manutencao'] ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="pb-3 pt-1">
                        <DataRow label="Manutenção Preventiva" value={data.manuPrev} isSub color="text-rose-500 dark:text-rose-400" />
                        <DataRow label="Manutenção Corretiva" value={data.manuCorr} isSub color="text-rose-500 dark:text-rose-400" />
                        <DataRow label="Manutenção Reforma" value={data.manuReform} isSub color="text-rose-500 dark:text-rose-400" />
                        <DataRow label="Fretes compras p/ manutenção" value={data.manuFrete} isSub color="text-rose-500 dark:text-rose-400" />
                        <DataRow label="Serviços de Pneus/Borracharia" value={data.manuPneus} isSub color="text-rose-500 dark:text-rose-400" />
                        <DataRow label="Pneus Ressolados" value={data.manuRessolado} isSub color="text-rose-500 dark:text-rose-400" />
                        <DataRow label="Pneus Novos" value={data.manuNovos} isSub color="text-rose-500 dark:text-rose-400" />
                    </div>
                </div>

                <DataRow icon={Truck} label="Total Despesas Transportes Frota Própria - (Sem Diesel/ Sem Manutenção)" value={data.residualTransporte} isBold color="text-rose-600 dark:text-rose-400" />
                <DataRow icon={Receipt} label="Total Despesas Transportes Terceiros" value={data.transpTerceiros} isBold color="text-rose-600 dark:text-rose-400" />
                <DataRow icon={Calculator} label="Impostos" value={data.impostos} isBold color="text-rose-600 dark:text-rose-400" />
            </div>

            {/* RESULTADO OPERACIONAL */}
            <ResultRow
                icon={Activity}
                label="Resultado Operacional"
                value={data.resultOperacional}
                colorType="slate"
            />

            {/* Despesas Indiretas e Administrativas */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-4 overflow-hidden print:border-none print:shadow-none print:bg-transparent">
                <DataRow icon={Wallet} label="Rateio Despesas Administrativas" value={data.rateioAdm} isBold color="text-rose-600 dark:text-rose-400" />
                <DataRow icon={AlertTriangle} label="Despesas Multas e Taxas" value={data.multas} isBold color="text-rose-600 dark:text-rose-400" />
                <DataRow icon={AlertTriangle} label="Frota Parada" value={data.frotaParada} isBold color="text-rose-600 dark:text-rose-400" />
            </div>

            {/* RESULTADO PÓS DESPESAS */}
            <ResultRow
                icon={TrendingUp}
                label="Resultado Pós Despesas"
                value={data.resultPosDespesas}
                colorType={data.resultPosDespesas >= 0 ? "emerald" : "rose"}
            />

            {/* Investimentos */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-4 overflow-hidden print:border-none print:shadow-none print:bg-transparent">
                <DataRow icon={TrendingDown} label="Investimentos / Consórcios" value={data.investimentos} isBold color="text-rose-600 dark:text-rose-400" />
            </div>

            {/* RESULTADO LIQUIDO FINAL */}
            <ResultRow
                icon={Banknote}
                label="Resultado Líquido Final"
                value={data.resultFinal}
                colorType={data.resultFinal >= 0 ? "emerald" : "rose"}
            />

        </div>
    );
};

export default FechamentoComponent;
