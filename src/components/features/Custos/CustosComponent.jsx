import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, ChevronDown, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getParentSegment } from '../../../utils/helpers';
import { formatDate } from '../../../utils/formatters';
import { COST_CENTER_RULES } from '../../../constants/costCenterRules';
import { ADMIN_CC_CODES } from '../../../constants/business';

const CustosComponent = ({ transactions, showToast, measureUnit, totalProduction }) => {
    const [filtered, setFiltered] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedGroups, setExpandedGroups] = useState({
        'DESPESAS DA UNIDADE': true,
        'CUSTO OPERACIONAL INDÚSTRIA': true,
        'CUSTO OPERACIONAL ADMINISTRATIVO': true,
        'INVESTIMENTOS': true
    });

    useEffect(() => {
        let data = transactions.filter(t => t.type === 'expense');
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            data = data.filter(t =>
                (t.accountPlan && t.accountPlan.toLowerCase().includes(lowerTerm)) ||
                (t.planDescription && t.planDescription.toLowerCase().includes(lowerTerm)) ||
                (t.description && t.description.toLowerCase().includes(lowerTerm))
            );
        }
        setFiltered(data);
    }, [transactions, searchTerm]);

    const groupedData = useMemo(() => {
        const hierarchy = {
            'DESPESAS DA UNIDADE': { total: 0, subgroups: { 'CUSTO OPERACIONAL INDÚSTRIA': { total: 0, classes: {} }, 'CUSTO OPERACIONAL ADMINISTRATIVO': { total: 0, classes: {} }, 'OUTRAS DESPESAS': { total: 0, classes: {} } } },
            'TRANSPORTE': { total: 0, subgroups: { 'CUSTO TRANSPORTE': { total: 0, classes: {} }, 'Geral': { total: 0, classes: {} } } },
            'ADMINISTRATIVO': { total: 0, subgroups: { 'CUSTO RATEIO DESPESAS ADMINISTRATIVAS': { total: 0, classes: {} }, 'Geral': { total: 0, classes: {} } } },
            'IMPOSTOS': { total: 0, subgroups: { 'CUSTO IMPOSTOS': { total: 0, classes: {} }, 'Geral': { total: 0, classes: {} } } },
            'INVESTIMENTOS': { total: 0, subgroups: { 'INVESTIMENTOS GERAIS': { total: 0, classes: {} }, 'Geral': { total: 0, classes: {} } } },
            'OUTROS': { total: 0, subgroups: { 'Geral': { total: 0, classes: {} } } }
        };

        const grandTotal = filtered.reduce((acc, t) => acc + t.value, 0);

        filtered.forEach(t => {
            const segmentName = getParentSegment(t.segment);
            const rules = COST_CENTER_RULES[segmentName] || {};
            const ccCode = t.costCenter ? parseInt(t.costCenter.split(' ')[0]) : 0;

            let targetRoot = 'OUTROS';
            let targetSub = 'Geral';
            let matched = false;

            if (t.grupo) {
                targetRoot = t.grupo.toUpperCase();
                targetSub = (t.subgrupo || 'Geral').toUpperCase();
                matched = true;
            }

            if (!matched && rules) {
                for (const [rootGroup, subGroups] of Object.entries(rules)) {
                    for (const [subGroup, ccList] of Object.entries(subGroups)) {
                        if (ccList.includes(ccCode)) {
                            targetRoot = rootGroup.toUpperCase();
                            targetSub = subGroup.toUpperCase();
                            matched = true;
                            break;
                        }
                    }
                    if (matched) break;
                }
            }

            if (!matched) {
                if (t.accountPlan?.startsWith('06')) {
                    targetRoot = "INVESTIMENTOS";
                    targetSub = "INVESTIMENTOS GERAIS";
                }
                else if (t.accountPlan === '02.01') { targetRoot = "IMPOSTOS"; targetSub = "CUSTO IMPOSTOS"; }
                else if (ADMIN_CC_CODES.includes(ccCode)) { targetRoot = 'DESPESAS DA UNIDADE'; targetSub = 'CUSTO OPERACIONAL ADMINISTRATIVO'; }
                else if (t.accountPlan?.startsWith('03')) { targetRoot = 'DESPESAS DA UNIDADE'; targetSub = 'CUSTO OPERACIONAL INDÚSTRIA'; }
                else if (t.accountPlan?.startsWith('04')) { targetRoot = 'DESPESAS DA UNIDADE'; targetSub = 'CUSTO OPERACIONAL ADMINISTRATIVO'; }
                else { targetRoot = 'DESPESAS DA UNIDADE'; targetSub = 'OUTRAS DESPESAS'; }
            }

            if (!hierarchy[targetRoot]) hierarchy[targetRoot] = { total: 0, subgroups: {} };
            if (!hierarchy[targetRoot].subgroups[targetSub]) hierarchy[targetRoot].subgroups[targetSub] = { total: 0, classes: {} };

            const subgroup = hierarchy[targetRoot].subgroups[targetSub];

            let displayDesc = t.planDescription;
            if (targetRoot === 'IMPOSTOS' || t.accountPlan === '02.01') {
                displayDesc = t.description && t.description.length > 2 ? t.description : t.planDescription;
            }

            const classKey = `${t.accountPlan} - ${displayDesc}`;
            if (!subgroup.classes[classKey]) {
                subgroup.classes[classKey] = { id: classKey, code: t.accountPlan, name: displayDesc, total: 0, items: [] };
            }

            subgroup.classes[classKey].items.push(t);
            subgroup.classes[classKey].total += t.value;
            subgroup.total += t.value;
            hierarchy[targetRoot].total += t.value;
        });

        return { hierarchy, grandTotal };
    }, [filtered]);

    const toggleGroup = (id) => setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));

    const exportData = (type) => {
        const data = filtered.map(t => ({ Data: t.date, Unidade: t.segment, Fornecedor: t.description, Matéria: t.materialDescription, Cod_Classe: t.accountPlan, Desc_Classe: t.planDescription, Centro_Custo: t.costCenter, Valor: t.value }));
        if (type === 'xlsx') {
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Custos");
            XLSX.writeFile(wb, "custos_detalhados.xlsx");
        }
        showToast(`Exportado para ${type}`, 'success');
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="p-6 border-b dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 className="font-bold text-lg dark:text-white">Custos e Despesas</h3>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        <input
                            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            placeholder="Pesquisar..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button onClick={() => exportData('xlsx')} className="text-emerald-500 flex items-center gap-1 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100">
                        <Download size={16} /> Excel
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
                        <tr>
                            <th className="p-3 w-10"></th>
                            <th className="p-3">Estrutura de Contas</th>
                            <th className="p-3 text-right">Valor Total</th>
                            <th className="p-3 text-right">Custo p/ {measureUnit}</th>
                            <th className="p-3 text-right">%</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                        {Object.entries(groupedData.hierarchy).map(([rootName, rootData]) => {
                            if (rootData.total === 0) return null;
                            return (
                                <React.Fragment key={rootName}>
                                    <tr className="bg-slate-200 dark:bg-slate-800 font-bold cursor-pointer" onClick={() => toggleGroup(rootName)}>
                                        <td className="p-3 text-center">{expandedGroups[rootName] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</td>
                                        <td className="p-3 uppercase text-indigo-800 dark:text-indigo-400">{rootName}</td>
                                        <td className="p-3 text-right text-rose-600 dark:text-rose-400">{rootData.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        <td className="p-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                                            {totalProduction > 0 ? (rootData.total / totalProduction).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                                        </td>
                                        <td className="p-3 text-right font-mono">{groupedData.grandTotal > 0 ? ((rootData.total / groupedData.grandTotal) * 100).toFixed(1) : 0}%</td>
                                    </tr>
                                    {expandedGroups[rootName] && Object.entries(rootData.subgroups).sort(([, a], [, b]) => b.total - a.total).map(([subName, subData]) => {
                                        if (subData.total === 0) return null;
                                        return (
                                            <React.Fragment key={subName}>
                                                <tr className="bg-slate-100 dark:bg-slate-700/50 font-semibold cursor-pointer border-l-4 border-indigo-500" onClick={() => toggleGroup(subName)}>
                                                    <td className="p-3 text-center pl-6">{expandedGroups[subName] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                                                    <td className="p-3 text-slate-700 dark:text-slate-200">{subName}</td>
                                                    <td className="p-3 text-right text-slate-700 dark:text-slate-200">{subData.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                    <td className="p-3 text-right font-mono text-xs">{totalProduction > 0 ? (subData.total / totalProduction).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                                                    <td className="p-3 text-right font-mono text-xs text-slate-500 dark:text-slate-400">{groupedData.grandTotal > 0 ? ((subData.total / groupedData.grandTotal) * 100).toFixed(1) : 0}%</td>
                                                </tr>
                                                {expandedGroups[subName] && Object.values(subData.classes).sort((a, b) => b.total - a.total).map(classe => (
                                                    <React.Fragment key={classe.id}>
                                                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer" onClick={() => toggleGroup(classe.id)}>
                                                            <td className="p-3 text-center pl-10">{expandedGroups[classe.id] ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}</td>
                                                            <td className="p-3 dark:text-slate-300"><span className="font-mono text-xs bg-slate-200 dark:bg-slate-600 px-1 rounded mr-2">{classe.code}</span>{classe.name}</td>
                                                            <td className="p-3 text-right dark:text-slate-300">{classe.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                            <td className="p-3 text-right font-mono text-xs dark:text-slate-400">{totalProduction > 0 ? (classe.total / totalProduction).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                                                            <td className="p-3 text-right font-mono text-xs dark:text-slate-400">{subData.total > 0 ? ((classe.total / subData.total) * 100).toFixed(1) : 0}%</td>
                                                        </tr>
                                                        {expandedGroups[classe.id] && classe.items.map(t => (
                                                            <tr key={t.id} className="bg-white dark:bg-slate-900 text-xs border-b dark:border-slate-800">
                                                                <td></td>
                                                                <td className="p-2 pl-16">
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                        <div>
                                                                            <p className="font-bold text-slate-600 dark:text-slate-400">{t.description} <span className="font-normal text-[10px] ml-2 text-slate-400">{formatDate(t.date)}</span></p>
                                                                            <p className="text-[10px] text-slate-400">CC: {t.costCenter}</p>
                                                                        </div>
                                                                        <div className="text-slate-500 italic">{t.materialDescription}</div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-2 text-right text-rose-500">{t.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                                <td className="p-2 text-right">-</td>
                                                                <td className="p-2 text-right text-slate-400">{classe.total > 0 ? ((t.value / classe.total) * 100).toFixed(1) : 0}%</td>
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                ))}
                                            </React.Fragment>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                        <tr className="bg-slate-900 text-white font-bold text-lg">
                            <td colSpan={2} className="p-4 text-right">TOTAL GERAL</td>
                            <td className="p-4 text-right">{groupedData.grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="p-4 text-right">{totalProduction > 0 ? (groupedData.grandTotal / totalProduction).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                            <td className="p-4 text-right">100%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CustosComponent;
