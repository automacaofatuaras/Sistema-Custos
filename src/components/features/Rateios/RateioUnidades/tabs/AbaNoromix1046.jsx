import React from 'react';
import { Share2 } from 'lucide-react';
import { formatDate } from '../../../../../utils/formatters';

export default function AbaNoromix1046({ calculatedData }) {
    const { units, totalExpenses, expenseItems } = calculatedData.noromix1046Data;

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-purple-600 text-white p-6 rounded-xl shadow-lg">
                    <p className="text-purple-200 text-xs font-bold uppercase mb-1">Total Despesas (CC 1046)</p>
                    <h3 className="text-2xl font-bold">{totalExpenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm">
                    <p className="text-slate-500 text-xs font-bold uppercase mb-1">Qtd. Unidades Rateadas</p>
                    <h3 className="text-2xl font-bold dark:text-white">10 <span className="text-sm font-normal text-slate-400">unidades</span></h3>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 border-purple-500 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase">Valor Fixo por Unidade</p>
                    <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">{(totalExpenses / 10).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center"><h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Share2 size={18} className="text-purple-500" />Distribuição Igualitária (1/10)</h4></div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left"><thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase"><tr><th className="p-3 pl-6">Unidade</th><th className="p-3 text-right">Valor a Pagar</th></tr></thead><tbody className="divide-y dark:divide-slate-700">
                        {units.map((u, idx) => (<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300"><td className="p-3 pl-6 font-medium">{u.name} {u.name.includes('Fábrica') && <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">FÁBRICA</span>}</td><td className="p-3 text-right font-bold text-purple-600 dark:text-purple-400">{u.valueToPay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>))}
                    </tbody></table>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4">
                <h5 className="text-xs font-bold text-slate-500 uppercase mb-3">Detalhamento das Despesas (CC 1046)</h5>
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
