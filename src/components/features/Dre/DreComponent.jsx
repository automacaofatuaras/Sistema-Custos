import React, { useState, useMemo } from 'react';
import {
    Download, TrendingUp, TrendingDown, Target, FileSpreadsheet,
    Factory, ShoppingCart, Banknote, Receipt, Truck, Briefcase, Zap, Package
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { COST_CENTER_RULES } from '../../../constants/costCenterRules';
import { ADMIN_CC_CODES } from '../../../constants/business';
import { getParentSegment } from '../../../utils/helpers';
import { formatCurrency } from '../../../utils/formatters';

const DreComponent = ({ transactions, totalSales, totalProduction, measureUnit, filter, selectedUnit }) => {

    // Calcula os totais com base nas regras de negócio (COST_CENTER_RULES)
    const dreData = useMemo(() => {
        const totalRevenue = transactions.filter(t => t.type === 'revenue').reduce((acc, t) => acc + t.value, 0);
        const sum = (fn) => transactions.filter(fn).reduce((acc, t) => acc + t.value, 0);

        const parentSeg = getParentSegment(selectedUnit) || "Geral";
        const rules = COST_CENTER_RULES[parentSeg];

        const isInRuleGroup = (t, groupName, subGroupName = null) => {
            if (!rules || !rules[groupName]) return false;
            const ccCode = t.costCenter ? parseInt(t.costCenter.split(' ')[0]) : 0;
            if (subGroupName) {
                return rules[groupName][subGroupName]?.includes(ccCode);
            }
            return Object.values(rules[groupName]).flat().includes(ccCode);
        };

        // 1. Receitas Detalhadas
        const recMaterial = sum(t => t.type === 'revenue' && (t.description?.toLowerCase().includes('retira') || t.description?.toLowerCase().includes('entrega') || t.accountPlan === '01.01'));
        const recFrete = sum(t => t.type === 'revenue' && t.description?.toLowerCase().includes('frete'));
        const subsidio = sum(t => t.type === 'revenue' && t.description?.toLowerCase().includes('subsídio'));

        // 2. Custos Operacionais
        const despUnidade = sum(t => t.type === 'expense' && isInRuleGroup(t, 'DESPESAS DA UNIDADE'));

        // 3. Custos de Transporte
        const totalTransporteGroup = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE'));
        const combustivel = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && (t.description?.toLowerCase().includes('combustivel') || t.description?.toLowerCase().includes('diesel') || t.accountPlan === '03.07.01'));
        const manutencaoTotal = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan?.startsWith('03.05'));
        const transpTerceiros = sum(t => t.type === 'expense' && t.description?.toLowerCase().includes('transporte terceiros'));
        const frotaParada = sum(t => t.type === 'expense' && t.description?.toLowerCase().includes('frota parada'));
        const residualTransporte = Math.max(0, totalTransporteGroup - combustivel - manutencaoTotal); // O que sobrou do grupo de transporte

        const totalTransporteFinal = totalTransporteGroup + transpTerceiros + frotaParada;

        // 4. Administrativo
        const rateioAdm = sum(t => t.type === 'expense' && (t.isRateio || t.description?.toLowerCase().includes('rateio despesas') || isInRuleGroup(t, 'ADMINISTRATIVO')));
        const multas = sum(t => t.type === 'expense' && (t.description?.toLowerCase().includes('multa') || t.description?.toLowerCase().includes('taxa')));

        const totalAdministrativo = rateioAdm + multas;

        // 5. Tributos/Impostos
        const impostos = sum(t => t.type === 'expense' && (t.accountPlan?.startsWith('02') || t.description?.toLowerCase().includes('imposto') || t.accountPlan === '02.01'));

        // 6. Outras Despesas (Fallback)
        const outrasDespesas = sum(t => {
            if (t.type !== 'expense') return false;
            const isDespUnidade = isInRuleGroup(t, 'DESPESAS DA UNIDADE');
            const isTransporteGroup = isInRuleGroup(t, 'TRANSPORTE');
            const isRateioAdm = t.isRateio || t.description?.toLowerCase().includes('rateio despesas') || isInRuleGroup(t, 'ADMINISTRATIVO');
            const isMulta = t.description?.toLowerCase().includes('multa') || t.description?.toLowerCase().includes('taxa');
            const isImposto = t.accountPlan?.startsWith('02') || t.description?.toLowerCase().includes('imposto') || t.accountPlan === '02.01';
            const isInvestimento = t.accountPlan?.startsWith('06') || t.description?.toLowerCase().includes('consórcio') || t.description?.toLowerCase().includes('investimento');
            const isTranspTerc = t.description?.toLowerCase().includes('transporte terceiros');
            const isFrota = t.description?.toLowerCase().includes('frota parada');
            return !isDespUnidade && !isTransporteGroup && !isRateioAdm && !isMulta && !isImposto && !isInvestimento && !isTranspTerc && !isFrota;
        });

        const totalCustoOperacional = despUnidade + outrasDespesas;

        // Resultados
        const margemContribuicao = totalRevenue - totalCustoOperacional;
        const resultOperacional = margemContribuicao - totalTransporteFinal - impostos;
        const resultPosDespesas = resultOperacional - totalAdministrativo;

        // Outros
        const investimentos = sum(t => t.type === 'expense' && (t.accountPlan?.startsWith('06') || t.description?.toLowerCase().includes('consórcio') || t.description?.toLowerCase().includes('investimento')));
        const resultFinal = resultPosDespesas - investimentos;

        // Novos Resultados Específicos
        const resultadoMaterial = recMaterial - totalCustoOperacional - impostos - totalAdministrativo;
        const resultadoFrete = recFrete - totalTransporteFinal;

        return {
            totalRevenue, recMaterial, recFrete, subsidio,
            despUnidade, outrasDespesas, totalCustoOperacional,
            totalTransporteGroup, combustivel, manutencaoTotal, residualTransporte, transpTerceiros, frotaParada, totalTransporteFinal,
            rateioAdm, multas, totalAdministrativo,
            impostos,
            investimentos,
            margemContribuicao, resultOperacional, resultPosDespesas, resultFinal,
            resultadoMaterial, resultadoFrete
        };
    }, [transactions, selectedUnit]);

    const formatBRLValue = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const pct = (val, base) => {
        if (!base || base === 0) return '0.0%';
        return ((val / base) * 100).toFixed(1) + '%';
    };

    const rp = (val) => {
        if (!totalProduction || totalProduction === 0) return 'R$ 0,00';
        return (val / totalProduction).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // Card Component Auxiliar
    const SummaryCard = ({ title, value, subtext, icon: Icon, colorClass, highlight = false }) => (
        <div className={`p-5 rounded-2xl border ${highlight ? `${colorClass} text-white shadow-lg` : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm'} transition-transform hover:-translate-y-1`}>
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-xl ${highlight ? 'bg-white/20' : 'bg-slate-50 dark:bg-slate-700/50 text-slate-500'}`}>
                    <Icon size={20} className={highlight ? 'text-white' : colorClass.split(' ')[0].replace('bg-', 'text-')} />
                </div>
            </div>
            <div>
                <p className={`text-sm font-bold uppercase tracking-wider ${highlight ? 'text-white/80' : 'text-slate-500'}`}>{title}</p>
                <h4 className={`text-2xl font-black mt-1 ${highlight ? 'text-white' : 'dark:text-white'}`}>{formatBRLValue(value)}</h4>
                {subtext && <p className={`text-xs mt-2 font-medium ${highlight ? 'text-white/70' : 'text-slate-400'}`}>{subtext}</p>}
            </div>
        </div>
    );

    const TableRow = ({ label, value, isHeader = false, isSub = false, isTotal = false }) => (
        <div className={`flex items-center justify-between py-3 px-4 ${isHeader ? 'bg-slate-50 dark:bg-slate-800/50 rounded-lg mb-1' : 'border-b border-slate-100 dark:border-slate-700/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'} ${isSub ? 'pl-8' : ''}`}>
            <span className={`${isHeader ? 'font-bold text-slate-700 dark:text-slate-300' : isTotal ? 'font-black text-slate-800 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-400'} text-sm flex-1`}>
                {label}
            </span>
            <div className="flex gap-4 text-right">
                <span className={`w-24 text-xs font-bold ${isHeader ? 'text-slate-400' : 'text-slate-500'}`}>{isHeader ? '% REC' : pct(value, dreData.totalRevenue)}</span>
                <span className={`w-28 text-xs font-bold ${isHeader ? 'text-slate-400' : 'text-indigo-500'}`}>{isHeader ? `R$/${measureUnit}` : rp(value)}</span>
                <span className={`w-32 text-sm ${isHeader ? 'font-bold text-slate-400' : isTotal ? 'font-black text-slate-800 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                    {isHeader ? 'VALOR' : formatBRLValue(value)}
                </span>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Destaques */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard title="Resultado Material" value={dreData.resultadoMaterial} icon={Factory} colorClass={dreData.resultadoMaterial >= 0 ? "bg-emerald-500" : "bg-rose-500"} highlight />
                <SummaryCard title="Resultado Frete" value={dreData.resultadoFrete} icon={Truck} colorClass={dreData.resultadoFrete >= 0 ? "bg-sky-500" : "bg-rose-500"} highlight />
                <SummaryCard title="Resultado Líquido" value={dreData.resultFinal} icon={Target} colorClass={dreData.resultFinal >= 0 ? "bg-indigo-600" : "bg-rose-600"} highlight />
            </div>

            {/* KPIs Físicos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                        <Factory size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Produção Total</p>
                        <h4 className="text-2xl font-black dark:text-white">{totalProduction?.toLocaleString()} <span className="text-sm text-slate-400 lowercase">{measureUnit}</span></h4>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-sky-50 dark:bg-sky-900/30 rounded-xl text-sky-600 dark:text-sky-400">
                        <ShoppingCart size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Vendas Totais</p>
                        <h4 className="text-2xl font-black dark:text-white">{totalSales?.toLocaleString()} <span className="text-sm text-slate-400 lowercase">{measureUnit}</span></h4>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400">
                        <Package size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Evolução do Estoque</p>
                        <h4 className="text-2xl font-black dark:text-white">
                            {((totalProduction || 0) - (totalSales || 0)) > 0 ? "+" : ""}{((totalProduction || 0) - (totalSales || 0)).toLocaleString()} <span className="text-sm text-slate-400 lowercase">{measureUnit}</span>
                        </h4>
                    </div>
                </div>
            </div>

            {/* DRE Completo */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                        <FileSpreadsheet className="text-indigo-500" size={20} />
                        Demonstrativo de Resultados (DRE)
                    </h3>
                    <div className="flex gap-2">
                        <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors">
                            <Download size={16} /> PDF
                        </button>
                    </div>
                </div>

                <div className="p-6 flex-1 overflow-x-auto min-w-[800px]">
                    <div className="min-w-full">
                        <TableRow label="CLASSIFICAÇÃO" isHeader />

                        {/* 1. RECEITAS */}
                        <div className="mt-4 mb-2 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black">
                            <Banknote size={16} /> 1. RECEITAS
                        </div>
                        <TableRow label="Receita Bruta Total" value={dreData.totalRevenue} isTotal />
                        <TableRow label="Venda de Materiais" value={dreData.recMaterial} isSub />
                        <TableRow label="Receita de Fretes" value={dreData.recFrete} isSub />
                        <TableRow label="Outras Receitas / Subsídios" value={dreData.subsidio} isSub />

                        {/* 2. CUSTOS OPERACIONAIS */}
                        <div className="mt-6 mb-2 flex items-center gap-2 text-amber-500 font-black">
                            <Factory size={16} /> 2. CUSTOS OPERACIONAIS
                        </div>
                        <TableRow label="Total Custo Operacional (Onde a regra do CC se aplica)" value={dreData.despUnidade} isSub />
                        <TableRow label="Outras Despesas (Sem classificação exata no CC)" value={dreData.outrasDespesas} isSub />
                        <TableRow label="Total Custo Operacional (Direto + Outros)" value={dreData.totalCustoOperacional} isTotal />

                        {/* MARGEM DE CONTRIBUIÇÃO */}
                        <div className="mt-6 mb-2 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                            <TableRow label="MARGEM DE CONTRIBUIÇÃO (1 - 2)" value={dreData.margemContribuicao} isTotal />
                        </div>

                        {/* 3. TRANSPORTE */}
                        <div className="mt-6 mb-2 flex items-center gap-2 text-orange-500 font-black">
                            <Truck size={16} /> 3. DESPESAS DE TRANSPORTE
                        </div>
                        <TableRow label="Total Transporte" value={dreData.totalTransporteFinal} isTotal />
                        <TableRow label="Combustíveis e Lubrificantes" value={dreData.combustivel} isSub />
                        <TableRow label="Manutenção Frota" value={dreData.manutencaoTotal} isSub />
                        <TableRow label="Outras Despesas Frota" value={dreData.residualTransporte} isSub />
                        <TableRow label="Fretes Terceiros / Agregados" value={dreData.transpTerceiros} isSub />
                        <TableRow label="Custo Frota Parada" value={dreData.frotaParada} isSub />

                        {/* 4. TRIBUTOS */}
                        <div className="mt-6 mb-2 flex items-center gap-2 text-rose-500 font-black">
                            <Receipt size={16} /> 4. TRIBUTOS E IMPOSTOS
                        </div>
                        <TableRow label="Total de Impostos" value={dreData.impostos} isTotal />

                        {/* RESULTADO OPERACIONAL */}
                        <div className="mt-6 mb-2 p-4 bg-slate-100 dark:bg-slate-700/30 rounded-xl">
                            <TableRow label="RESULTADO OPERACIONAL (Margem - 3 - 4)" value={dreData.resultOperacional} isTotal />
                        </div>

                        {/* 5. ADMINISTRATIVO E GERAL */}
                        <div className="mt-6 mb-2 flex items-center gap-2 text-sky-500 font-black">
                            <Briefcase size={16} /> 5. DESPESAS ADMINISTRATIVAS E GERAIS
                        </div>
                        <TableRow label="Total Administrativo" value={dreData.totalAdministrativo} isTotal />
                        <TableRow label="Rateio Administrativo Central" value={dreData.rateioAdm} isSub />
                        <TableRow label="Multas e Taxas" value={dreData.multas} isSub />

                        {/* RESULTADO LIQUIDO */}
                        <div className={`mt-8 p-6 rounded-2xl border-2 ${dreData.resultFinal >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/50'}`}>
                            <div className="flex justify-between items-center">
                                <h2 className={`text-2xl font-black uppercase tracking-tight ${dreData.resultFinal >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                                    RESULTADO LÍQUIDO FINAL
                                </h2>
                                <div className="text-right">
                                    <h2 className={`text-3xl font-black ${dreData.resultFinal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {formatBRLValue(dreData.resultFinal)}
                                    </h2>
                                    <p className={`text-sm font-bold mt-1 ${dreData.resultFinal >= 0 ? 'text-emerald-600/70 dark:text-emerald-400/70' : 'text-rose-600/70 dark:text-rose-400/70'}`}>
                                        Margem: {pct(dreData.resultFinal, dreData.totalRevenue)} | R$/und: {rp(dreData.resultFinal)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* INVESTIMENTOS */}
                        <div className="mt-8 mb-2 flex items-center gap-2 text-purple-500 font-black">
                            <Zap size={16} /> 6. INVESTIMENTOS (Fora do DRE Operacional)
                        </div>
                        <TableRow label="Total Investimentos e Consórcios" value={dreData.investimentos} isTotal />

                    </div>
                </div>
            </div>
        </div>
    );
};

export default DreComponent;
