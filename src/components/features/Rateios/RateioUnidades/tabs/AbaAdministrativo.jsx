import React from 'react';
import { Settings, Edit2, Save, Loader2, Calculator, Share2, FileText } from 'lucide-react';
import { formatDate } from '../../../../../utils/formatters';
import CurrencyInput from '../../../../common/CurrencyInput';

export default function AbaAdministrativo({
    selectedSegment,
    calculatedData,
    admParams,
    handleAdmParamChange,
    isLocked,
    setIsLocked,
    isSaving,
    handleSaveAdmParams,
    BUSINESS_HIERARCHY
}) {
    if (selectedSegment === 'Concreteiras e Fábrica de Tubos') {
        const { table, totalSalariosPot, totalDespesasPot, grandTotalVolume, autoTargetValue } = calculatedData.noromixAdmData;
        const concreteUnits = BUSINESS_HIERARCHY["Concreteiras"] || [];
        const pipeUnits = BUSINESS_HIERARCHY["Fábrica de Tubos"] || [];
        const totalBaseGeral = autoTargetValue > 0 ? autoTargetValue / 0.10 : 0;

        return (
            <div className="space-y-6 animate-in fade-in">
                {/* Cards de Origem do Valor */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg border-b-4 border-slate-600">
                        <p className="text-slate-400 text-xs font-bold uppercase mb-1">Base Administrativa Geral (100%)</p>
                        <h3 className="text-2xl font-black">{totalBaseGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                    </div>
                    <div className="bg-indigo-600 text-white p-6 rounded-xl shadow-lg border-b-4 border-indigo-400">
                        <p className="text-indigo-200 text-xs font-bold uppercase mb-1">Cota Concreteiras e Fábrica (10%)</p>
                        <h3 className="text-2xl font-black">{(autoTargetValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                    </div>
                </div>

                {/* Parâmetros */}
                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-6 shadow-sm relative">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h4 className="font-bold text-lg flex items-center gap-2 dark:text-white"><Settings size={20} className="text-slate-400" /> Parâmetros de Rateio</h4>
                            <p className="text-xs text-slate-500 mt-1">Defina a quantidade de funcionários para o cálculo do Rateio das Despesas Administrativas.</p>
                        </div>
                        <div className="flex gap-2">
                            {isLocked ? (
                                <button onClick={() => setIsLocked(false)} className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg font-bold hover:bg-amber-200 transition-colors text-sm">
                                    <Edit2 size={16} /> Editar
                                </button>
                            ) : (
                                <button onClick={handleSaveAdmParams} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors text-sm disabled:opacity-50">
                                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvar
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Salário Mínimo Base (R$)</label>
                                <CurrencyInput value={admParams.minWage || 1518} onChange={(val) => handleAdmParamChange('minWage', val)} disabled={isLocked} className={`w-full border p-3 rounded-lg text-lg font-bold text-slate-600 dark:bg-slate-700 dark:text-white dark:border-slate-600 ${isLocked ? 'bg-slate-100 opacity-70' : ''}`} />
                            </div>
                            <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg space-y-2 text-sm border dark:border-slate-700">
                                <div className="flex justify-between"><span>Rateio Folha Adm (Cálculo 1)</span><span className="font-bold">{totalSalariosPot.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                                <div className="flex justify-between"><span>Rateio Despesas Adm (Cálculo 2)</span><span className="font-bold">{totalDespesasPot.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                                <div className="border-t border-slate-300 dark:border-slate-700 pt-2 flex justify-between font-bold text-indigo-600 dark:text-indigo-400">
                                    <span>Total Alocado</span>
                                    <span>{(totalSalariosPot + totalDespesasPot).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className={`bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 max-h-80 overflow-y-auto border dark:border-slate-700 ${isLocked ? 'opacity-80' : ''}`}>
                                <div className="flex justify-between items-end mb-3 border-b dark:border-slate-700 pb-2">
                                    <label className="block text-[10px] font-black text-blue-500 uppercase tracking-wider">Rateios - Concreteiras</label>
                                    <div className="flex gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                                        <span className="w-16">Func.</span>
                                        <span className="w-20 text-indigo-400">Vol (m³)</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {concreteUnits.map(u => (
                                        <div key={u} className="flex justify-between items-center text-xs">
                                            <span className="dark:text-slate-300 truncate w-32 font-medium" title={u}>{u.includes('-') ? u.split('-')[1].trim() : u}</span>
                                            <div className="flex gap-2">
                                                <input type="number" min="0" disabled={isLocked} className={`w-16 p-1 text-center border rounded dark:bg-slate-700 dark:text-white dark:border-slate-600 font-bold ${isLocked ? 'bg-slate-100' : ''}`} value={admParams.employees?.[u] || 0} onChange={(e) => handleAdmParamChange('employees', e.target.value, u)} />
                                                <input type="number" min="0" step="0.01" disabled={isLocked} className={`w-20 p-1 text-center border rounded dark:bg-slate-700 dark:text-white dark:border-slate-600 font-mono text-indigo-600 dark:text-indigo-400 placeholder-slate-300 dark:placeholder-slate-600 ${isLocked ? 'bg-slate-100' : ''}`} value={admParams.volumes?.[u] ?? ''} placeholder="0" onChange={(e) => handleAdmParamChange('volumes', e.target.value, u)} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className={`bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 max-h-40 overflow-y-auto border dark:border-slate-700 ${isLocked ? 'opacity-80' : ''}`}>
                                <div className="flex justify-between items-end mb-3 border-b dark:border-slate-700 pb-2">
                                    <label className="block text-[10px] font-black text-amber-500 uppercase tracking-wider">Rateios - Fábrica</label>
                                    <div className="flex gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                                        <span className="w-16">Func.</span>
                                        <span className="w-20 text-indigo-400">Vol (m³)</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {pipeUnits.map(u => (
                                        <div key={u} className="flex justify-between items-center text-xs">
                                            <span className="dark:text-slate-300 truncate w-32 font-medium" title={u}>{u.includes('-') ? u.split('-')[1].trim() : u}</span>
                                            <div className="flex gap-2">
                                                <input type="number" min="0" disabled={isLocked} className={`w-16 p-1 text-center border rounded dark:bg-slate-700 dark:text-white dark:border-slate-600 font-bold ${isLocked ? 'bg-slate-100' : ''}`} value={admParams.employees?.[u] || 0} onChange={(e) => handleAdmParamChange('employees', e.target.value, u)} />
                                                <input type="number" min="0" step="0.01" disabled={isLocked} className={`w-20 p-1 text-center border rounded dark:bg-slate-700 dark:text-white dark:border-slate-600 font-mono text-indigo-600 dark:text-indigo-400 placeholder-slate-300 dark:placeholder-slate-600 ${isLocked ? 'bg-slate-100' : ''}`} value={admParams.volumes?.[u] ?? ''} placeholder="0" onChange={(e) => handleAdmParamChange('volumes', e.target.value, u)} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Calculator size={18} className="text-emerald-500" />Resultado do Rateio Administrativo</h4>
                        <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">Vol. Total: {grandTotalVolume.toLocaleString()} m³</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase">
                                <tr>
                                    <th className="p-3 pl-6">Unidade</th>
                                    <th className="p-3 text-center">Func.</th>
                                    <th className="p-3 text-right">Volume</th>
                                    <th className="p-3 text-right text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20">Rateio Folha (C1)</th>
                                    <th className="p-3 text-right text-amber-600 bg-amber-50 dark:bg-amber-900/20">Rateio Despesas (C2)</th>
                                    <th className="p-3 text-right font-bold bg-slate-100 dark:bg-slate-800">TOTAL FINAL</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700">
                                {table.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300">
                                        <td className="p-3 pl-6 font-medium">{row.name} {row.fullName.includes('Fábrica') && <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">FÁBRICA</span>}</td>
                                        <td className="p-3 text-center text-xs">{row.employees}</td>
                                        <td className="p-3 text-right font-mono text-xs opacity-70">{row.volume.toLocaleString()}</td>
                                        <td className="p-3 text-right font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50/30">{row.rateioFolha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="p-3 text-right font-medium text-amber-700 dark:text-amber-400 bg-amber-50/30">{row.rateioDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="p-3 text-right font-bold bg-slate-100 dark:bg-slate-800">{row.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-900 text-white font-bold border-t-2 border-indigo-500">
                                    <td className="p-3 pl-6 text-right uppercase text-[10px] tracking-widest text-indigo-300">Totais Consolidados</td>
                                    <td className="p-3 text-center text-xs">{table.reduce((a, b) => a + (b.employees || 0), 0)}</td>
                                    <td className="p-3 text-right text-xs">{table.reduce((a, b) => a + (b.volume || 0), 0).toLocaleString()}</td>
                                    <td className="p-3 text-right">{table.reduce((a, b) => a + (b.rateioFolha || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="p-3 text-right">{table.reduce((a, b) => a + (b.rateioDespesas || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="p-3 text-right text-emerald-400 font-black">{table.reduce((a, b) => a + (b.total || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Nota Explicativa */}
                <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 p-6 rounded-xl space-y-4">
                    <h5 className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2 uppercase text-xs tracking-widest">
                        <Calculator size={16} /> Memória de Cálculo e Regras
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-indigo-800 dark:text-indigo-400 leading-relaxed">
                        <div className="space-y-2">
                            <p><strong>1. Origem dos Valores:</strong> Extraído do <strong>Rateio Administrativo Geral</strong>. As Concreteiras e Fábrica de Tubos recebem uma cota fixa de <strong>10%</strong> do total de despesas gerais.</p>
                            <p><strong>2. Rateio Folha Adm (Cálculo 1):</strong> Utiliza a quantidade de funcionários por unidade aplicando os fatores:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Até 6 funcionários: <strong>Fator 2</strong></li>
                                <li>De 7 a 14 funcionários: <strong>Fator 4</strong></li>
                                <li>15 ou mais funcionários: <strong>Fator 6</strong></li>
                            </ul>
                            <p>O subtotal é transformado em proporção sobre o volume total produzido e distribuído.</p>
                        </div>
                        <div className="space-y-2">
                            <p><strong>3. Rateio Despesas Adm (Cálculo 2 + Fixo):</strong> Após subtrair o Rateio Folha do total da cota (10%), o saldo compõe o Rateio de Despesas:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Fábrica de Tubos:</strong> Recebe um repasse fixo estipulado de <strong>R$ 20.000,00</strong>.</li>
                                <li><strong>Concreteiras:</strong> Rateiam o saldo restante proporcionalmente ao <strong>Volume (m³)</strong> produzido no mês por cada usina.</li>
                            </ul>
                            <p><strong>4. Total Final:</strong> Soma (Rateio Folha + Rateio Despesas) cobrado de cada centro de custo.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Lógica Padrão (Portos/Pedreiras)
    const shareValue = calculatedData.totalAdm / 8;
    const unitsListGenerico = [...BUSINESS_HIERARCHY['Portos de Areia'], ...BUSINESS_HIERARCHY['Pedreiras']];

    // Agrupamento para subtotais por CC e Sumarizado por Classe
    const groupedItems = calculatedData.itemsAdm.reduce((acc, item) => {
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
                <div className="bg-indigo-600 text-white p-6 rounded-xl shadow-lg">
                    <p className="text-indigo-200 text-xs font-bold uppercase mb-1">Total Despesas (CC 1087/1089)</p>
                    <h3 className="text-2xl font-bold">{calculatedData.totalAdm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm">
                    <p className="text-slate-500 text-xs font-bold uppercase mb-1">Valor da Cota (1/8)</p>
                    <h3 className="text-2xl font-bold dark:text-white">{shareValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-xl border border-emerald-100 dark:border-emerald-800 shadow-sm">
                    <p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase mb-1">Alocado por Unidade</p>
                    <h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{shareValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center">
                    <h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Share2 size={18} className="text-indigo-500" />Distribuição Igualitária (1/8)</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase">
                            <tr>
                                <th className="p-3 pl-6">Unidades</th>
                                <th className="p-3 text-right">Valor do Rateio</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {unitsListGenerico.sort().map((u, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300">
                                    <td className="p-3 pl-6 font-medium">{u}</td>
                                    <td className="p-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{shareValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4">
                <h5 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 mb-3"><FileText size={16} />Detalhamento das Despesas Rateadas (CC 1087 e 1089)</h5>
                <div className="max-h-80 overflow-y-auto pr-2">
                    <table className="w-full text-xs text-left">
                        <thead className="text-slate-500 font-bold bg-slate-100 dark:bg-slate-800">
                            <tr>
                                <th className="p-2">Centro de Custo</th>
                                <th className="p-2">Classe Contábil</th>
                                <th className="p-2 text-right">Valor Consolidado</th>
                                <th className="p-2 text-right text-indigo-600 dark:text-indigo-400">Valor Rateado (1/8)</th>
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
                                            <td className="py-2 text-right font-bold text-indigo-600 dark:text-indigo-400">{(item.value / 8).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-200 dark:bg-slate-800/80">
                                        <td colSpan={2} className="py-2 px-3 text-right font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px]">
                                            SUBTOTAL {cc}
                                        </td>
                                        <td className="py-2 px-3 text-right font-bold text-slate-700 dark:text-slate-300">
                                            {data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="py-2 px-3 text-right font-bold text-indigo-700 dark:text-indigo-400">
                                            {(data.total / 8).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                    </tr>
                                </React.Fragment>
                            ))}
                            <tr className="bg-indigo-700 text-white border-t-4 border-indigo-900">
                                <td colSpan={2} className="py-3 px-3 text-right font-bold uppercase text-[11px] tracking-wider">TOTAL GERAL (1087 e 1089)</td>
                                <td className="py-3 px-3 text-right font-black text-sm">
                                    {(calculatedData.totalAdm || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </td>
                                <td className="py-3 px-3 text-right font-bold text-indigo-200">
                                    {((calculatedData.totalAdm || 0) / 8).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
