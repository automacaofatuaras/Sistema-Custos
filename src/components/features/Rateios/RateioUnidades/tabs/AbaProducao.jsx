import React from 'react';
import { Share2, FileText, UploadCloud } from 'lucide-react';
import { formatDate } from '../../../../../utils/formatters';
import { BUSINESS_HIERARCHY } from '../../../../../constants/business';

export default function AbaProducao({ calculatedData, onOpenImport }) {
    // Filtragem por CC
    const portosItems = calculatedData.itemsProd.filter(t => t.costCenter.startsWith('1042'));
    const pedreirasItems = calculatedData.itemsProd.filter(t => t.costCenter.startsWith('1043'));

    const total1042 = portosItems.reduce((acc, t) => acc + t.value, 0);
    const total1043 = pedreirasItems.reduce((acc, t) => acc + t.value, 0);

    const portosUnits = BUSINESS_HIERARCHY['Portos de Areia'];
    const pedreirasUnits = [...BUSINESS_HIERARCHY['Pedreiras'], ...(BUSINESS_HIERARCHY['Usinas de Asfalto'] || [])];

    const share1042 = portosUnits.length > 0 ? total1042 / portosUnits.length : 0;
    const share1043 = pedreirasUnits.length > 0 ? total1043 / pedreirasUnits.length : 0;

    // Agrupamento para subtotais por CC e Sumarizado por Classe
    const groupedItems = calculatedData.itemsProd.reduce((acc, item) => {
        const ccDesc = `${item.costCenter}`;
        if (!acc[ccDesc]) acc[ccDesc] = { itemsMap: {}, total: 0 };

        const classKey = `${item.accountPlan} - ${item.planDescription}`;
        if (!acc[ccDesc].itemsMap[classKey]) {
            acc[ccDesc].itemsMap[classKey] = {
                accountPlan: item.accountPlan,
                planDescription: item.planDescription,
                value: 0
            };
        }

        acc[ccDesc].itemsMap[classKey].value += item.value;
        acc[ccDesc].total += item.value;
        return acc;
    }, {});

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-sky-600 text-white p-6 rounded-xl shadow-lg">
                    <p className="text-sky-200 text-xs font-bold uppercase mb-1">Total Despesas Portos (CC 1042)</p>
                    <h3 className="text-2xl font-bold">{total1042.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
                <div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg">
                    <p className="text-blue-200 text-xs font-bold uppercase mb-1">Total Despesas Pedreiras e Usinas (CC 1043)</p>
                    <h3 className="text-2xl font-bold">{total1043.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={onOpenImport}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm text-sm"
                >
                    <UploadCloud size={18} />
                    Importar Relatório TXT (CC 1042/1043)
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Distribuição Portos */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Share2 size={18} className="text-sky-500" />Distribuição Portos (1/2)</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase">
                                <tr>
                                    <th className="p-3 pl-6">Unidade</th>
                                    <th className="p-3 text-right">Valor do Rateio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700">
                                {portosUnits.sort().map((u, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300">
                                        <td className="p-3 pl-6 font-medium">{u}</td>
                                        <td className="p-3 text-right font-bold text-sky-600 dark:text-sky-400">{share1042.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Distribuição Pedreiras */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Share2 size={18} className="text-blue-500" />Distribuição Pedreiras e Usinas (1/12)</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase">
                                <tr>
                                    <th className="p-3 pl-6">Unidade</th>
                                    <th className="p-3 text-right">Valor do Rateio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700">
                                {pedreirasUnits.sort().map((u, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300">
                                        <td className="p-3 pl-6 font-medium">{u}</td>
                                        <td className="p-3 text-right font-bold text-blue-600 dark:text-blue-400">{share1043.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4">
                <h5 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-3"><FileText size={16} />Detalhamento das Despesas Rateadas (CC 1042 e 1043)</h5>
                <div className="max-h-80 overflow-y-auto pr-2">
                    <table className="w-full text-xs text-left">
                        <thead className="text-slate-500 font-bold bg-slate-100 dark:bg-slate-800">
                            <tr>
                                <th className="p-2">Centro de Custo</th>
                                <th className="p-2">Classe Contábil</th>
                                <th className="p-2 text-right">Valor Consolidado</th>
                                <th className="p-2 text-right text-blue-600 dark:text-blue-400">Valor Rateado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {Object.entries(groupedItems).map(([cc, data]) => (
                                <React.Fragment key={cc}>
                                    {Object.values(data.itemsMap).map((item, idx) => (
                                        <tr key={`${cc}-${idx}`} className="dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                                            <td className="py-2 font-mono text-[10px] uppercase text-blue-600 dark:text-blue-400">{cc}</td>
                                            <td className="py-2">
                                                <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded mr-1">{item.accountPlan}</span>
                                                <span className="font-bold text-[10px] uppercase">{item.planDescription}</span>
                                            </td>
                                            <td className="py-2 text-right font-medium">{item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                            <td className="py-2 text-right font-bold text-blue-600 dark:text-blue-400">{(item.value / (cc.startsWith('1042') ? 2 : 12)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-200 dark:bg-slate-800/80">
                                        <td colSpan={2} className="py-2 px-3 text-right font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px]">
                                            SUBTOTAL {cc}
                                        </td>
                                        <td className="py-2 px-3 text-right font-bold text-slate-700 dark:text-slate-300">
                                            {data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="py-2 px-3 text-right font-bold text-blue-700 dark:text-blue-400">
                                            {(data.total / (cc.startsWith('1042') ? 2 : 12)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                    </tr>
                                </React.Fragment>
                            ))}
                            {Object.keys(groupedItems).length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-slate-400">Nenhuma despesa localizada nesta competência.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
