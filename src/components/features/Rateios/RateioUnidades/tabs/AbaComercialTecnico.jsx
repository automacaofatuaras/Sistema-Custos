import React from 'react';
import { Factory, Share2, FileText } from 'lucide-react';
import { formatDate } from '../../../../../utils/formatters';
import { BUSINESS_HIERARCHY } from '../../../../../constants/business';

export default function AbaComercialTecnico({ selectedSegment, activeRateioType, calculatedData }) {
    if (selectedSegment === 'Concreteiras e Fábrica de Tubos') {
        const data = activeRateioType === 'COMERCIAL' ? calculatedData.noromixComercialData : calculatedData.noromixTecnicoData;
        const { units, totalProduction, totalExpenses, expenseItems } = data;
        const ccLabel = activeRateioType === 'COMERCIAL' ? '1104' : '1075';
        const colorTheme = activeRateioType === 'COMERCIAL' ? 'rose' : 'cyan';

        return (
            <div className="space-y-6 animate-in fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 border-${colorTheme}-500 shadow-sm`}><p className="text-xs font-bold text-slate-500 uppercase">Despesas Totais (CC {ccLabel})</p><h3 className={`text-2xl font-bold text-${colorTheme}-600 dark:text-${colorTheme}-400`}>{totalExpenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3></div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 border-indigo-500 shadow-sm"><p className="text-xs font-bold text-slate-500 uppercase">Produção Total (10 Unidades)</p><h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalProduction.toLocaleString()} <span className="text-sm font-normal text-slate-400">m³ / ton</span></h3></div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 border-emerald-500 shadow-sm"><p className="text-xs font-bold text-slate-500 uppercase">Custo Médio do Rateio</p><h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalProduction > 0 ? (totalExpenses / totalProduction).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}<span className="text-sm font-normal text-slate-400"> / unidade</span></h3></div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center"><h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Factory size={18} className="text-indigo-500" />Distribuição por Produção</h4></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left"><thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase"><tr><th className="p-3 pl-6">Unidade</th><th className="p-3 text-right">Produção</th><th className="p-3 text-right">% Participação</th><th className="p-3 text-right">Valor a Pagar (Rateio)</th></tr></thead><tbody className="divide-y dark:divide-slate-700">
                            {units.map((u, idx) => (<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300"><td className="p-3 pl-6 font-medium">{u.name} {u.name.includes('Fábrica') && <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">FÁBRICA</span>}</td><td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">{u.production.toLocaleString()}</td><td className="p-3 text-right"><span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs font-bold">{(u.percent * 100).toFixed(2)}%</span></td><td className={`p-3 text-right font-bold text-${colorTheme}-600 dark:text-${colorTheme}-400`}>{u.valueToPay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>))}
                            {units.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">Nenhuma produção encontrada para calcular o rateio.</td></tr>}
                        </tbody></table>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4">
                    <h5 className="text-xs font-bold text-slate-500 uppercase mb-3">Detalhamento das Despesas Rateadas (CC {ccLabel})</h5>
                    <div className="max-h-60 overflow-y-auto pr-2">
                        <table className="w-full text-xs text-left">
                            <thead className="text-slate-500 font-bold bg-slate-100 dark:bg-slate-800">
                                <tr>
                                    <th className="p-2">Data</th>
                                    <th className="p-2">Descrição</th>
                                    <th className="p-2">Classe</th>
                                    <th className="p-2 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {expenseItems.map((item, idx) => (
                                    <tr key={idx} className="dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                                        <td className="py-2">{formatDate(item.date)}</td>
                                        <td className="py-2 font-medium">{item.description}</td>
                                        <td className="py-2">
                                            <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded mr-1">{item.accountPlan}</span>
                                            <span className="font-bold text-[10px] uppercase">{item.planDescription}</span>
                                        </td>
                                        <td className="py-2 text-right font-bold">{item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // Genérico (Pedreiras, Portos e Usinas)
    const pedreirasList = BUSINESS_HIERARCHY['Pedreiras'] || [];
    const portosList = BUSINESS_HIERARCHY['Portos de Areia'] || [];
    const usinasList = BUSINESS_HIERARCHY['Usinas de Asfalto'] || [];

    // Divisor hardcoded de 14 para distribuição Igualitária nas 14 unidades dessa hierarquia
    const divisorCota = 14;
    const shareValue = calculatedData.totalComercialGen / divisorCota;

    // Agrupamento para subtotais por CC (mesma lógica do Administrativo)
    const groupedItems = (calculatedData.itemsComercialGen || []).reduce((acc, item) => {
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-amber-500 text-white p-6 rounded-xl shadow-lg">
                    <p className="text-amber-100 text-xs font-bold uppercase mb-1">Total Despesas (CC 1104)</p>
                    <h3 className="text-2xl font-bold">{calculatedData.totalComercialGen.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm">
                    <p className="text-slate-500 text-xs font-bold uppercase mb-1">Unidades ({divisorCota}x)</p>
                    <h3 className="text-2xl font-bold dark:text-white">14</h3>
                    <p className="text-xs text-slate-400 mt-1">6 Pedreiras, 2 Portos, 6 Usinas de Asfalto</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-xl border border-emerald-100 dark:border-emerald-800 shadow-sm">
                    <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase mb-1">Alocado por Unidade</p>
                    <h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{shareValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Distribuição Pedreiras */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Share2 size={18} className="text-amber-500" />Pedreiras (6)</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase">
                                <tr>
                                    <th className="p-3 pl-4">Unidade</th>
                                    <th className="p-3 text-right">Valor Rateio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700">
                                {pedreirasList.sort().map((u, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300">
                                        <td className="p-2 pl-4 font-medium">{u}</td>
                                        <td className="p-2 text-right font-bold text-amber-600 dark:text-amber-400">{shareValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Distribuição Portos */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Share2 size={18} className="text-amber-500" />Portos (2)</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase">
                                <tr>
                                    <th className="p-3 pl-4">Unidade</th>
                                    <th className="p-3 text-right">Valor Rateio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700">
                                {portosList.sort().map((u, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300">
                                        <td className="p-2 pl-4 font-medium">{u}</td>
                                        <td className="p-2 text-right font-bold text-amber-600 dark:text-amber-400">{shareValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Distribuição Usinas */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Share2 size={18} className="text-amber-500" />Usinas de Asfalto (6)</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase">
                                <tr>
                                    <th className="p-3 pl-4">Unidade</th>
                                    <th className="p-3 text-right">Valor Rateio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700">
                                {usinasList.sort().map((u, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300">
                                        <td className="p-2 pl-4 font-medium">{u}</td>
                                        <td className="p-2 text-right font-bold text-amber-600 dark:text-amber-400">{shareValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4">
                <h5 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-3"><FileText size={16} />Detalhamento das Despesas Rateadas (CC 1104)</h5>
                <div className="max-h-80 overflow-y-auto pr-2">
                    <table className="w-full text-xs text-left">
                        <thead className="text-slate-500 font-bold bg-slate-100 dark:bg-slate-800">
                            <tr>
                                <th className="p-2">Centro de Custo</th>
                                <th className="p-2">Classe Contábil</th>
                                <th className="p-2 text-right">Valor Consolidado</th>
                                <th className="p-2 text-right text-amber-600 dark:text-amber-400">Valor Rateado (1/14)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {Object.entries(groupedItems).map(([cc, data]) => (
                                <React.Fragment key={cc}>
                                    {Object.values(data.itemsMap).map((item, idx) => (
                                        <tr key={`${cc}-${idx}`} className="dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                                            <td className="py-2 font-mono text-[10px] uppercase text-amber-600 dark:text-amber-400">{cc}</td>
                                            <td className="py-2">
                                                <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded mr-1">{item.accountPlan}</span>
                                                <span className="font-bold text-[10px] uppercase">{item.planDescription}</span>
                                            </td>
                                            <td className="py-2 text-right font-medium">{item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                            <td className="py-2 text-right font-bold text-amber-600 dark:text-amber-400">{(item.value / 14).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-200 dark:bg-slate-800/80">
                                        <td colSpan={2} className="py-2 px-3 text-right font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px]">
                                            SUBTOTAL {cc}
                                        </td>
                                        <td className="py-2 px-3 text-right font-bold text-slate-700 dark:text-slate-300">
                                            {data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="py-2 px-3 text-right font-bold text-amber-700 dark:text-amber-400">
                                            {(data.total / 14).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                    </tr>
                                </React.Fragment>
                            ))}
                            {Object.keys(groupedItems).length === 0 && (
                                <tr>
                                    <td colSpan={3} className="py-8 text-center text-slate-400">Nenhuma despesa localizada nesta competência.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
