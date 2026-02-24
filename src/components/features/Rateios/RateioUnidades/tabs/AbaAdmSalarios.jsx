import React from 'react';
import { Settings, Edit2, Save, Loader2, Calculator, Share2, FileText } from 'lucide-react';
import CurrencyInput from '../../../../common/CurrencyInput';

export default function AbaAdmSalarios({
    calculatedData,
    admParams,
    handleAdmParamChange,
    isLocked,
    setIsLocked,
    isSaving,
    handleSaveAdmParams,
    BUSINESS_HIERARCHY
}) {
    const { table, totalSalariosPot, totalDespesasPot, basePedreiras, basePortos } = calculatedData.noromixAdmPedreirasData;
    const pedreirasUnits = BUSINESS_HIERARCHY["Pedreiras"];
    const portosUnits = BUSINESS_HIERARCHY["Portos de Areia"];

    const totalBase = basePedreiras + basePortos;

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Cards de Origem do Valor */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg border-b-4 border-slate-600">
                    <p className="text-slate-400 text-xs font-bold uppercase mb-1">Base Administrativa Geral (100%)</p>
                    <h3 className="text-2xl font-black">{(totalBase > 0 ? (totalBase / 0.3) : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
                <div className="bg-indigo-600 text-white p-6 rounded-xl shadow-lg border-b-4 border-indigo-400">
                    <p className="text-indigo-200 text-xs font-bold uppercase mb-1">Cota Pedreiras (28,5%)</p>
                    <h3 className="text-2xl font-black">{basePedreiras.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
                <div className="bg-sky-600 text-white p-6 rounded-xl shadow-lg border-b-4 border-sky-400">
                    <p className="text-sky-200 text-xs font-bold uppercase mb-1">Cota Portos (1,5%)</p>
                    <h3 className="text-2xl font-black">{basePortos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
                <div className="bg-emerald-600 text-white p-6 rounded-xl shadow-lg border-b-4 border-emerald-400">
                    <p className="text-emerald-200 text-xs font-bold uppercase mb-1">Total Pedreiras + Portos (30%)</p>
                    <h3 className="text-2xl font-black">{totalBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                </div>
            </div>

            {/* Parâmetros */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-6 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h4 className="font-bold text-lg flex items-center gap-2 dark:text-white"><Settings size={20} className="text-slate-400" /> Parâmetros de Funcionários</h4>
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
                            <CurrencyInput
                                value={admParams.minWage || 1518}
                                onChange={(val) => handleAdmParamChange('minWage', val)}
                                disabled={isLocked}
                                className={`w-full border p-3 rounded-lg text-lg font-bold text-slate-600 dark:bg-slate-700 dark:text-white dark:border-slate-600 ${isLocked ? 'bg-slate-100 opacity-70' : ''}`}
                            />
                        </div>
                        <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg space-y-2 text-sm border dark:border-slate-700">
                            <div className="flex justify-between"><span>Rateio Folha (Cálculo Fatores)</span><span className="font-bold">{totalSalariosPot.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                            <div className="flex justify-between"><span>Rateio Despesas (Saldo C2)</span><span className="font-bold">{totalDespesasPot.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                            <div className="border-t border-slate-300 dark:border-slate-700 pt-2 flex justify-between font-bold text-indigo-600 dark:text-indigo-400">
                                <span>Total Alocado</span>
                                <span>{(totalSalariosPot + totalDespesasPot).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className={`bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 max-h-60 overflow-y-auto border dark:border-slate-700 ${isLocked ? 'opacity-80' : ''}`}>
                            <label className="block text-[10px] font-black text-blue-500 uppercase mb-2 tracking-wider">Funcionários - Pedreiras</label>
                            <div className="space-y-2">
                                {pedreirasUnits.map(u => (
                                    <div key={u} className="flex justify-between items-center text-xs">
                                        <span className="dark:text-slate-300 truncate w-40" title={u}>{u.includes('-') ? u.split('-')[1].trim() : u}</span>
                                        <input type="number" min="0" disabled={isLocked} className={`w-16 p-1 text-center border rounded dark:bg-slate-700 dark:text-white dark:border-slate-600 font-bold ${isLocked ? 'bg-slate-100' : ''}`} value={admParams.employees[u] || 0} onChange={(e) => handleAdmParamChange('employees', e.target.value, u)} />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className={`bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 max-h-40 overflow-y-auto border dark:border-slate-700 ${isLocked ? 'opacity-80' : ''}`}>
                            <label className="block text-[10px] font-black text-sky-500 uppercase mb-2 tracking-wider">Funcionários - Portos</label>
                            <div className="space-y-2">
                                {portosUnits.map(u => (
                                    <div key={u} className="flex justify-between items-center text-xs">
                                        <span className="dark:text-slate-300 truncate w-40" title={u}>{u.includes('-') ? u.split('-')[1].trim() : u}</span>
                                        <input type="number" min="0" disabled={isLocked} className={`w-16 p-1 text-center border rounded dark:bg-slate-700 dark:text-white dark:border-slate-600 font-bold ${isLocked ? 'bg-slate-100' : ''}`} value={admParams.employees[u] || 0} onChange={(e) => handleAdmParamChange('employees', e.target.value, u)} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabela de Resultados */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center">
                    <h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Calculator size={18} className="text-indigo-500" />Resultado do Rateio de Despesas Administrativas</h4>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                            <tr>
                                <th className="p-4 pl-6">Unidade</th>
                                <th className="p-4 text-center">Func.</th>
                                <th className="p-4 text-right bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300">Rateio Folha</th>
                                <th className="p-4 text-right bg-amber-50/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">Rateio Despesas (C2)</th>
                                <th className="p-4 text-right font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white">TOTAL FINAL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {table.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300">
                                    <td className="p-4 pl-6">
                                        <div className="font-bold">{row.name}</div>
                                        <div className={`text-[10px] font-black uppercase ${row.type === 'Pedreira' ? 'text-blue-500' : 'text-sky-500'}`}>{row.type}</div>
                                    </td>
                                    <td className="p-4 text-center font-mono">{row.employees}</td>
                                    <td className="p-4 text-right font-medium text-indigo-600 bg-indigo-50/10">{row.rateioFolha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="p-4 text-right font-medium text-amber-600 bg-amber-50/10">
                                        {row.rateioDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        <span className="text-[10px] ml-1 opacity-50">({row.type === 'Porto' ? '50%' : (row.fullName.includes('Riolândia') ? '10%' : '18%')})</span>
                                    </td>
                                    <td className="p-4 text-right font-black bg-slate-50/50 dark:bg-slate-800/50 px-6">{row.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                </tr>
                            ))}
                            <tr className="bg-slate-900 text-white font-bold">
                                <td colSpan={2} className="p-4 pl-6 text-right uppercase text-[10px] tracking-widest">Totais Calculados</td>
                                <td className="p-4 text-right">{table.reduce((a, b) => a + b.rateioFolha, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className="p-4 text-right">{table.reduce((a, b) => a + b.rateioDespesas, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className="p-4 text-right text-emerald-400 font-black text-lg">{table.reduce((a, b) => a + b.total, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
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
                        <p><strong>1. Origem dos Valores:</strong> Os valores base são extraídos do <strong>Rateio Administrativo Geral</strong>. Pedreiras recebem uma cota de <strong>28,5%</strong> e Portos de Areia <strong>1,5%</strong> do total indireto.</p>
                        <p><strong>2. Rateio Folha (Base Salários):</strong> Utiliza a quantidade de funcionários por unidade aplicando os fatores:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Até 6 funcionários: <strong>Fator 2</strong></li>
                            <li>De 7 a 14 funcionários: <strong>Fator 4</strong></li>
                            <li>15 ou mais funcionários: <strong>Fator 6</strong></li>
                        </ul>
                        <p>O valor unitário é calculado como: <code>Fator × Salário Mínimo Vigente</code>.</p>
                    </div>
                    <div className="space-y-2">
                        <p><strong>3. Rateio Despesas (Saldo C2):</strong> Após subtrair o custo de folha da cota total do segmento, o saldo restante é distribuído conforme os percentuais fixos de C2:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Pedreiras:</strong> 18% para cada unidade (10% especificamente para Pedreira Riolândia).</li>
                            <li><strong>Portos:</strong> 50% para cada porto (dividido igualmente).</li>
                        </ul>
                        <p><strong>4. Total Final:</strong> É a soma do Rateio de Folha + Rateio de Despesas (C2) para cada unidade.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
