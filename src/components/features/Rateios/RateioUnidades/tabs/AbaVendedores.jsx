import React from 'react';
import { Settings, Edit2, Save, Loader2, FileText } from 'lucide-react';
import { formatDate } from '../../../../../utils/formatters';

export default function AbaVendedores({
    selectedSegment,
    calculatedData,
    manualPercents,
    handlePercChange,
    isLockedVend,
    setIsLockedVend,
    isSavingVend,
    handleSaveVendedores,
    VENDEDORES_MAP,
    BUSINESS_HIERARCHY
}) {
    if (selectedSegment === 'Concreteiras e Fábrica de Tubos') {
        const totalDemonstrativo = calculatedData.noromixVendedoresData.reduce((acc, row) => {
            const percConc = manualPercents[row.cc] !== undefined ? manualPercents[row.cc] : 100;
            const valConc = row.originalValue * (percConc / 100);
            return { orig: acc.orig + row.originalValue, conc: acc.conc + valConc, tubo: acc.tubo + (row.originalValue - valConc) };
        }, { orig: 0, conc: 0, tubo: 0 });

        return (
            <div className="space-y-6 animate-in fade-in">
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center">
                        <div>
                            <h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Settings size={18} className="text-slate-500" />Configuração de Rateio por Centro de Custo</h4>
                            <p className="text-xs text-slate-500 mt-1">Defina a % que fica na Concreteira. O restante irá automaticamente para a Fábrica de Tubos.</p>
                        </div>
                        <div className="flex gap-2">
                            {isLockedVend ? (
                                <button onClick={() => setIsLockedVend(false)} className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg font-bold hover:bg-amber-200 transition-colors text-sm"><Edit2 size={16} /> Editar</button>
                            ) : (
                                <button onClick={handleSaveVendedores} disabled={isSavingVend} className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors text-sm disabled:opacity-50">
                                    {isSavingVend ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvar
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase">
                                <tr>
                                    <th className="p-3">CC</th>
                                    <th className="p-3">Unidade Padrão (Concreto)</th>
                                    <th className="p-3 text-right bg-slate-100 dark:bg-slate-800 text-slate-700">Valor Total (R$)</th>
                                    <th className="p-3 w-40 text-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700">% Concreto</th>
                                    <th className="p-3 w-40 text-center bg-amber-50 dark:bg-amber-900/20 text-amber-700">% Tubos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700">
                                {VENDEDORES_MAP.map(mapItem => {
                                    const percConc = manualPercents[mapItem.cc] !== undefined ? manualPercents[mapItem.cc] : 100;
                                    const totalCC = calculatedData.noromixVendedoresData.filter(row => row.cc === mapItem.cc).reduce((acc, row) => acc + row.originalValue, 0);
                                    return (
                                        <tr key={mapItem.cc} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <td className="p-3 font-mono font-bold dark:text-slate-300">{mapItem.cc}</td>
                                            <td className="p-3 dark:text-slate-300">{mapItem.unit.includes('-') ? mapItem.unit.split('-')[1].trim() : mapItem.unit}</td>
                                            <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-200 bg-slate-50/50">{totalCC.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="p-3 text-center bg-indigo-50/30">
                                                <div className="flex items-center justify-center gap-1">
                                                    <input type="number" min="0" max="100" disabled={isLockedVend} value={percConc} onChange={(e) => handlePercChange(mapItem.cc, null, e.target.value)} className={`w-16 text-center border rounded p-1 dark:bg-slate-700 dark:text-white dark:border-slate-600 font-bold text-indigo-700 ${isLockedVend ? 'bg-slate-100' : ''}`} />
                                                    <span className="text-indigo-400">%</span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-center bg-amber-50/30">
                                                <span className="font-bold text-amber-700 dark:text-amber-500">{(100 - percConc).toFixed(0)}%</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700">
                        <h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><FileText size={18} className="text-slate-500" />Demonstrativo de Lançamentos (Aberto por Classe)</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase">
                                <tr>
                                    <th className="p-3">CC Origem / Unidade</th>
                                    <th className="p-3">Classe de Despesa</th>
                                    <th className="p-3 text-right">Valor Original</th>
                                    <th className="p-3 text-right text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20">Concreto</th>
                                    <th className="p-3 text-right text-amber-600 bg-amber-50 dark:bg-amber-900/20">Tubos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700">
                                <tr className="bg-slate-200 dark:bg-slate-800 font-bold border-b-2 border-slate-300 dark:border-slate-600">
                                    <td colSpan={2} className="p-3 pl-4 text-slate-800 dark:text-white">TOTAL GERAL</td>
                                    <td className="p-3 text-right text-slate-900 dark:text-white">{totalDemonstrativo.orig.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    <td className="p-3 text-right text-indigo-700 dark:text-indigo-400 bg-indigo-100/50">{totalDemonstrativo.conc.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    <td className="p-3 text-right text-amber-700 dark:text-amber-400 bg-amber-100/50">{totalDemonstrativo.tubo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                </tr>
                                {calculatedData.noromixVendedoresData.map((row, idx) => {
                                    const percConc = manualPercents[row.cc] !== undefined ? manualPercents[row.cc] : 100;
                                    const valConcreto = row.originalValue * (percConc / 100);
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300">
                                            <td className="p-3">
                                                <div className="font-bold text-slate-700 dark:text-slate-200">{row.unitName}</div>
                                                <div className="text-xs font-mono text-slate-400">CC {row.cc}</div>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-mono text-xs opacity-70">{row.accountCode}</div>
                                                <div className="font-medium">{row.accountDesc}</div>
                                            </td>
                                            <td className="p-3 text-right font-medium">{row.originalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="p-3 text-right font-bold text-indigo-600 bg-indigo-50/30">{valConcreto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="p-3 text-right font-bold text-amber-600 bg-amber-50/30">{(row.originalValue - valConcreto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // Genérico (Pedreiras, Portos e Usinas)
    const pedreirasList = (BUSINESS_HIERARCHY['Pedreiras'] || []).sort();
    const portosList = (BUSINESS_HIERARCHY['Portos de Areia'] || []).sort();
    const usinasList = (BUSINESS_HIERARCHY['Usinas de Asfalto'] || []).sort();

    const totalGeralVendas = (calculatedData.totalVend2105 || 0) + (calculatedData.totalVend3105 || 0) + (calculatedData.totalVend5105 || 0);

    // Agrupamento para subtotais por CC e Sumarizado por Classe (Formato Enxuto)
    const groupedItems = (calculatedData.itemsVend || []).reduce((acc, item) => {
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

    const renderUnitRow = (unit, colorClass) => {
        const p2105 = manualPercents[unit]?.['2105'] || 0;
        const p3105 = manualPercents[unit]?.['3105'] || 0;
        const p5105 = manualPercents[unit]?.['5105'] || 0;
        const totalAlocado = (calculatedData.totalVend2105 * (p2105 / 100)) + (calculatedData.totalVend3105 * (p3105 / 100)) + (calculatedData.totalVend5105 * (p5105 / 100));

        return (
            <tr key={unit} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300">
                <td className="p-3 font-medium">{unit}</td>
                <td className="p-3">
                    <div className="flex items-center gap-1">
                        <input type="number" className="w-16 p-1 border rounded dark:bg-slate-700 dark:border-slate-600 text-center font-bold" value={p2105} onChange={e => handlePercChange(unit, '2105', e.target.value)} />
                        <span className="text-[10px] text-slate-400 font-bold">%</span>
                    </div>
                </td>
                <td className="p-3">
                    <div className="flex items-center gap-1">
                        <input type="number" className="w-16 p-1 border rounded dark:bg-slate-700 dark:border-slate-600 text-center font-bold" value={p3105} onChange={e => handlePercChange(unit, '3105', e.target.value)} />
                        <span className="text-[10px] text-slate-400 font-bold">%</span>
                    </div>
                </td>
                <td className="p-3">
                    <div className="flex items-center gap-1">
                        <input type="number" className="w-16 p-1 border rounded dark:bg-slate-700 dark:border-slate-600 text-center font-bold" value={p5105} onChange={e => handlePercChange(unit, '5105', e.target.value)} />
                        <span className="text-[10px] text-slate-400 font-bold">%</span>
                    </div>
                </td>
                <td className={`p-3 text-right font-bold text-${colorClass}-600 dark:text-${colorClass}-400 bg-${colorClass}-50/30`}>{totalAlocado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            </tr>
        );
    };

    const renderSeparator = (label) => (
        <tr className="bg-slate-50 dark:bg-slate-900/50 border-y-2 border-slate-200 dark:border-slate-700">
            <td colSpan={5} className="p-2 pl-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</td>
        </tr>
    );

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Cards Totalizadores */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-t-4 border-indigo-500 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase">Vendedores (2105)</p>
                    <h3 className="text-xl font-black text-indigo-600">{calculatedData.totalVend2105.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-t-4 border-blue-500 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase">Vendedores (3105)</p>
                    <h3 className="text-xl font-black text-blue-600">{calculatedData.totalVend3105.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-t-4 border-sky-500 shadow-sm">
                    <p className="text-xs font-bold text-slate-500 uppercase">Vendedores (5105)</p>
                    <h3 className="text-xl font-black text-sky-600">{calculatedData.totalVend5105.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
                <div className="bg-indigo-600 p-5 rounded-xl border-t-4 border-indigo-400 shadow-lg text-white">
                    <p className="text-xs font-bold text-indigo-200 uppercase">Custo Total de Vendas</p>
                    <h3 className="text-xl font-black">{totalGeralVendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
            </div>

            {/* Detalhamento de Despesas (Enxuto) */}
            <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4">
                <h5 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-3"><FileText size={16} />Detalhamento das Despesas de Vendas (CC 2105, 3105 e 5105)</h5>
                <div className="max-h-80 overflow-y-auto pr-2">
                    <table className="w-full text-xs text-left">
                        <thead className="text-slate-500 font-bold bg-slate-100 dark:bg-slate-800 sticky top-0">
                            <tr>
                                <th className="p-2">Centro de Custo</th>
                                <th className="p-2">Classe Contábil</th>
                                <th className="p-2 text-right">Valor Consolidado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {Object.entries(groupedItems).map(([cc, data]) => (
                                <React.Fragment key={cc}>
                                    {Object.values(data.itemsMap).map((item, idx) => (
                                        <tr key={`${cc}-${idx}`} className="dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                                            <td className="py-2 font-mono text-[10px] uppercase text-indigo-600 dark:text-indigo-400">{cc}</td>
                                            <td className="py-2">
                                                <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded mr-1">{item.accountPlan}</span>
                                                <span className="font-bold text-[10px] uppercase">{item.planDescription}</span>
                                            </td>
                                            <td className="py-2 text-right font-medium">{item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-200 dark:bg-slate-800/80">
                                        <td colSpan={2} className="py-2 px-3 text-right font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px]">
                                            SUBTOTAL {cc}
                                        </td>
                                        <td className="py-2 px-3 text-right font-bold text-indigo-700 dark:text-indigo-400">
                                            {data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                    </tr>
                                </React.Fragment>
                            ))}
                            <tr className="bg-indigo-700 text-white">
                                <td colSpan={2} className="py-2 px-3 text-right font-bold uppercase text-[11px]">CUSTO TOTAL VENDEDORES</td>
                                <td className="py-2 px-3 text-right font-black">
                                    {totalGeralVendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </td>
                            </tr>
                            {Object.keys(groupedItems).length === 0 && (
                                <tr>
                                    <td colSpan={3} className="py-8 text-center text-slate-400">Nenhuma despesa localizada nesta competência.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Configuração de Rateio por Unidade */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center">
                    <h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Settings size={18} className="text-indigo-500" />Distribuição do Rateio por Unidade (%)</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 text-slate-500 text-xs uppercase">
                            <tr>
                                <th className="p-3 pl-6">Unidade</th>
                                <th className="p-3 w-32 border-x dark:border-slate-700">% CC 2105</th>
                                <th className="p-3 w-32 border-x dark:border-slate-700">% CC 3105</th>
                                <th className="p-3 w-32 border-x dark:border-slate-700">% CC 5105</th>
                                <th className="p-3 text-right bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-indigo-300">Total Alocado (R$)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {renderSeparator("Pedreiras")}
                            {pedreirasList.map(u => renderUnitRow(u, 'blue'))}

                            {renderSeparator("Portos de Areia")}
                            {portosList.map(u => renderUnitRow(u, 'sky'))}

                            {renderSeparator("Usinas de Asfalto")}
                            {usinasList.map(u => renderUnitRow(u, 'emerald'))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
