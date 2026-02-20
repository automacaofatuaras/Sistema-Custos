import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Printer } from 'lucide-react';
import { COST_CENTER_RULES } from '../../../constants/costCenterRules';

const FechamentoComponent = ({ transactions, totalSales, totalProduction, measureUnit, filter, selectedUnit }) => {
    const [expanded, setExpanded] = useState({
        'receitas': true,
        'custo_operacional': true,
        'manutencao': true
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
    const dynamicTitle = `Fechamento: ${unitLabel} - ${getPeriodLabel()}`;

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

    const Row = ({ label, val, isHeader = false, isResult = false, isSub = false, colorClass = "text-slate-700", bgClass = "", indent = 0, onClick = null, hasArrow = false, expanded = false }) => {
        const percent = data.totalRevenue > 0 ? (val / data.totalRevenue) * 100 : 0;
        const perUnit = totalSales > 0 ? val / totalSales : 0;
        let finalColor = colorClass;
        if (isResult) finalColor = val >= 0 ? 'text-emerald-600' : 'text-rose-600';

        return (
            <tr className={`${bgClass} border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer`} onClick={onClick}>
                <td className={`p-2 py-3 flex items-center ${finalColor} dark:text-slate-200`} style={{ paddingLeft: `${indent * 20 + 10}px` }}>
                    {hasArrow && (expanded ? <ChevronDown size={14} className="mr-2" /> : <ChevronRight size={14} className="mr-2" />)}
                    <span className={`${isHeader ? 'font-bold uppercase text-sm' : 'text-xs font-medium'}`}>{label}</span>
                </td>
                <td className={`p-2 text-right font-bold ${finalColor} dark:text-slate-200`}>
                    {isSub && val === 0 ? '-' : val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="p-2 text-right text-xs font-mono text-slate-500 dark:text-slate-400">{percent === 0 ? '-' : `${percent.toFixed(2)}%`}</td>
                <td className="p-2 text-right text-xs font-mono text-slate-500 dark:text-slate-400">{perUnit === 0 ? '-' : perUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            </tr>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden animate-in fade-in print:shadow-none print:border-none">
            <style>{`
                @media print {
                    aside, header, button.no-print { display: none !important; }
                    main { padding: 0 !important; overflow: visible !important; }
                    body { background: white !important; }
                    .print\\:shadow-none { box-shadow: none !important; }
                    .print\\:border-none { border: none !important; }
                    tbody tr { display: table-row !important; } 
                }
            `}</style>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-lg dark:text-white">{dynamicTitle}</h3>
                    <button onClick={() => window.print()} className="no-print p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Exportar PDF / Imprimir">
                        <Printer size={20} />
                    </button>
                </div>

                <div className="flex gap-4">
                    <div className="bg-white dark:bg-slate-800 px-3 py-1 rounded border dark:border-slate-700 text-sm">
                        <span className="text-slate-500 mr-2">Produção Total:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalProduction.toLocaleString()} ton</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 px-3 py-1 rounded border dark:border-slate-700 text-sm">
                        <span className="text-slate-500 mr-2">Vendas Totais:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{totalSales.toLocaleString()} ton</span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs uppercase">
                        <tr>
                            <th className="p-3 pl-4">Descrição</th>
                            <th className="p-3 text-right">Valor</th>
                            <th className="p-3 text-right">%</th>
                            <th className="p-3 text-right">R$ / ton</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                        <Row label="Total Receitas" val={data.totalRevenue} isHeader colorClass="text-blue-600" onClick={() => toggle('receitas')} hasArrow expanded={expanded['receitas']} />
                        {expanded['receitas'] && (
                            <>
                                <Row label="Receita de Material" val={data.recMaterial} indent={1} colorClass="text-blue-500" />
                                <Row label="Receita Retira" val={data.recRetira} indent={2} isSub colorClass="text-blue-400" />
                                <Row label="Receita Entrega" val={data.recEntrega} indent={2} isSub colorClass="text-blue-400" />
                                <Row label="Receita de Frete" val={data.recFrete} indent={1} colorClass="text-blue-500" />
                                <Row label="Frete Carreta" val={data.freteCarreta} indent={2} isSub colorClass="text-blue-400" />
                                <Row label="Frete Truck" val={data.freteTruck} indent={2} isSub colorClass="text-blue-400" />
                                <Row label="Frete Terceiros" val={data.freteTerceiros} indent={2} isSub colorClass="text-blue-400" />
                                <Row label="Subsídio de Terceiros" val={data.subsidio} indent={1} colorClass="text-blue-500" />
                            </>
                        )}
                        <Row label="Custo Operacional" val={data.totalCustoOperacional} isHeader colorClass="text-rose-600" onClick={() => toggle('custo_operacional')} hasArrow expanded={expanded['custo_operacional']} />
                        {expanded['custo_operacional'] && (
                            <>
                                <Row label="Despesas da Unidade" val={data.despUnidade} indent={1} colorClass="text-rose-500" />
                                <Row label="Custo Administrativo" val={0} indent={1} colorClass="text-rose-500" />
                                <Row label="Combustível Transporte" val={data.combustivel} indent={1} colorClass="text-rose-500" />
                            </>
                        )}
                        <Row label="Margem de Contribuição" val={data.margemContribuicao} isHeader isResult bgClass="bg-blue-50 dark:bg-blue-900/20" />
                        <Row label="Despesas Comerciais" val={0} indent={0} colorClass="text-rose-600" />
                        <Row label="Manutenção Transporte" val={data.manutencaoTotal} isHeader colorClass="text-rose-600" onClick={() => toggle('manutencao')} hasArrow expanded={expanded['manutencao']} indent={0} />
                        {expanded['manutencao'] && (
                            <>
                                <Row label="Manutenção Preventiva" val={data.manuPrev} indent={1} isSub colorClass="text-rose-500" />
                                <Row label="Manutenção Corretiva" val={data.manuCorr} indent={1} isSub colorClass="text-rose-500" />
                                <Row label="Manutenção Reforma" val={data.manuReform} indent={1} isSub colorClass="text-rose-500" />
                                <Row label="Fretes compras p/ manutenção" val={data.manuFrete} indent={1} isSub colorClass="text-rose-500" />
                                <Row label="Serviços de Pneus/Borracharia" val={data.manuPneus} indent={1} isSub colorClass="text-rose-500" />
                                <Row label="Pneus Ressolados" val={data.manuRessolado} indent={1} isSub colorClass="text-rose-500" />
                                <Row label="Pneus Novos" val={data.manuNovos} indent={1} isSub colorClass="text-rose-500" />
                            </>
                        )}
                        <Row label="Total Despesas Transportes (Residual)" val={data.residualTransporte} indent={0} colorClass="text-rose-600 font-bold" />
                        <Row label="Total Desp. Transp. Terceiros" val={data.transpTerceiros} indent={0} colorClass="text-rose-600" />
                        <Row label="Impostos" val={data.impostos} indent={0} colorClass="text-rose-600" />
                        <Row label="Resultado Operacional" val={data.resultOperacional} isHeader isResult bgClass="bg-slate-200 dark:bg-slate-700" />
                        <Row label="Rateio Despesas Administrativas" val={data.rateioAdm} indent={0} colorClass="text-rose-600" />
                        <Row label="Despesas Multas e Taxas" val={data.multas} indent={0} colorClass="text-rose-600" />
                        <Row label="Frota Parada" val={data.frotaParada} indent={0} colorClass="text-rose-600" />
                        <Row label="Resultado Pós Despesas" val={data.resultPosDespesas} isHeader isResult bgClass="bg-slate-200 dark:bg-slate-700" />
                        <Row label="Investimentos / Consórcios" val={data.investimentos} indent={0} colorClass="text-rose-600" />
                        <Row label="Resultado Pós Investimentos" val={data.resultFinal} isHeader isResult bgClass="bg-slate-300 dark:bg-slate-600" />
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FechamentoComponent;
