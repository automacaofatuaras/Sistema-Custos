import React, { useState, useEffect, useMemo } from 'react';
import { Save, Plus, Trash2, Cpu, Truck, FileJson, AlertCircle, Calculator } from 'lucide-react';

export default function AbaLimpeza({
    calculatedData,
    limpezaParams,
    handleLimpezaParamChange,
    isLockedLimpeza,
    setIsLockedLimpeza,
    isSavingLimpeza,
    handleSaveLimpeza,
    BUSINESS_HIERARCHY
}) {
    // Estado local para input do JSON de horas
    const [jsonInput, setJsonInput] = useState('');
    const [jsonError, setJsonError] = useState('');

    // Estado local para nova máquina
    const [newMachine, setNewMachine] = useState({
        name: '',
        totalCost: 0,
        hours: {}
    });

    const pedreiras = BUSINESS_HIERARCHY["Pedreiras"] || [];

    // Calcular o Total do CC 1121 no Mês Atual (Folha Limpeza)
    const cc1121Total = useMemo(() => {
        if (!calculatedData || !calculatedData.itemsLimpeza) return 0;
        return calculatedData.itemsLimpeza.reduce((acc, t) => acc + t.value, 0);
    }, [calculatedData]);

    const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    // --- LÓGICA DO JSON DE HORAS (CC 1121) ---
    const handleProcessJson = () => {
        try {
            setJsonError('');
            const parsed = JSON.parse(jsonInput);

            // Espera-se um objeto formato: { "Unidade A": 100, "Unidade B": 150 }
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                throw new Error("O JSON precisa ser um objeto de Unidade -> Horas.");
            }

            handleLimpezaParamChange('employeeHours', parsed);
            setJsonInput(''); // Limpa após sucesso
        } catch (e) {
            setJsonError('Formato JSON inválido. Ex: {"Unidade A": 50, "Unidade B": 120}');
        }
    };

    const totalEmployeeHours = useMemo(() => {
        if (!limpezaParams.employeeHours) return 0;
        return Object.values(limpezaParams.employeeHours).reduce((acc, val) => acc + (Number(val) || 0), 0);
    }, [limpezaParams.employeeHours]);

    // --- LÓGICA DE MÁQUINAS ---
    const handleAddMachine = () => {
        if (!newMachine.name || newMachine.totalCost <= 0) {
            alert("Preencha o nome e o custo da máquina.");
            return;
        }

        const totalMachHours = Object.values(newMachine.hours).reduce((acc, v) => acc + (Number(v) || 0), 0);
        if (totalMachHours <= 0) {
            alert("Aloque pelo menos 1 hora em alguma pedreira para poder ratear.");
            return;
        }

        const updatedMachines = [...(limpezaParams.machines || []), { ...newMachine, id: Date.now() }];
        handleLimpezaParamChange('machines', updatedMachines);

        // Reset
        setNewMachine({ name: '', totalCost: 0, hours: {} });
    };

    const handleRemoveMachine = (id) => {
        const updatedMachines = (limpezaParams.machines || []).filter(m => m.id !== id);
        handleLimpezaParamChange('machines', updatedMachines);
    };

    // --- CÁLCULO FINAL PARA A TABELA CONSOLIDADA ---
    const tableData = useMemo(() => {
        return pedreiras.map(unit => {
            const shortName = unit.includes('-') ? unit.split('-')[1].trim() : unit;

            // Rateio Funcionários (1121)
            const unitEmpHours = limpezaParams.employeeHours?.[unit] || limpezaParams.employeeHours?.[shortName] || 0;
            const empPercent = totalEmployeeHours > 0 ? (unitEmpHours / totalEmployeeHours) : 0;
            const unitEmpCost = cc1121Total * empPercent;

            // Rateio Máquinas
            let unitMachCost = 0;
            (limpezaParams.machines || []).forEach(mach => {
                const hrs = mach.hours[unit] || mach.hours[shortName] || 0;
                const totalHrs = Object.values(mach.hours).reduce((a, b) => a + (Number(b) || 0), 0);
                const perc = totalHrs > 0 ? (hrs / totalHrs) : 0;
                unitMachCost += (mach.totalCost * perc);
            });

            return {
                fullName: unit,
                name: shortName,
                employeeHours: unitEmpHours,
                employeeCost: unitEmpCost,
                machineCost: unitMachCost,
                totalCost: unitEmpCost + unitMachCost
            };
        }).sort((a, b) => b.totalCost - a.totalCost);
    }, [pedreiras, limpezaParams, cc1121Total, totalEmployeeHours]);

    const grandTotalLimpeza = tableData.reduce((acc, row) => acc + row.totalCost, 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Cabeçalho */}
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border dark:border-slate-700">
                <div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-300">Painel de Rateio: Limpeza das Pedreiras</h4>
                    <p className="text-xs text-slate-500 mt-1">
                        Custo Apurado CC 1121: <strong className="text-rose-500">{formatBRL(cc1121Total)}</strong>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsLockedLimpeza(!isLockedLimpeza)}
                        className={`text-sm font-bold underline transition-colors ${isLockedLimpeza ? 'text-indigo-500 hover:text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {isLockedLimpeza ? 'Editar Rateio' : 'Travar Edição'}
                    </button>

                    <button
                        onClick={handleSaveLimpeza}
                        disabled={isSavingLimpeza || isLockedLimpeza}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <Save size={16} />
                        {isSavingLimpeza ? 'Salvando...' : 'Salvar Configurações'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* BLOCO 1: Folha de Pagamento CC 1121 */}
                <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-sm p-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <Cpu className="text-indigo-500" /> Funcionários (CC 1121)
                    </h3>

                    <div className="mb-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
                        <p className="text-xs text-slate-500 mb-2 font-medium">Total de Horas Identificadas: <strong className="text-indigo-600 dark:text-indigo-400 text-sm">{totalEmployeeHours}h</strong></p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            {Object.entries(limpezaParams.employeeHours || {}).map(([unit, val]) => (
                                <div key={unit} className="flex justify-between border-b dark:border-slate-700 pb-1">
                                    <span className="text-slate-600 dark:text-slate-400 truncate pr-2">{unit}</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{val}h</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {!isLockedLimpeza && (
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <FileJson size={16} className="text-slate-400" /> Atualizar Horas (JSON)
                            </label>
                            <textarea
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                placeholder={'{\n  "Itapura": 120,\n  "Riolândia": 85\n}'}
                                className="w-full text-sm font-mono p-3 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl h-24 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {jsonError && <p className="text-xs text-rose-500 flex items-center gap-1"><AlertCircle size={12} />{jsonError}</p>}
                            <button
                                onClick={handleProcessJson}
                                className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-sm transition-colors"
                            >
                                Processar JSON
                            </button>
                        </div>
                    )}
                </div>

                {/* BLOCO 2: Máquinas e Caminhões */}
                <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-sm p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <Truck className="text-rose-500" /> Máquinas da Limpeza
                    </h3>

                    <div className="flex-1 overflow-y-auto max-h-[300px] mb-4 space-y-3 pr-2">
                        {(limpezaParams.machines || []).length === 0 ? (
                            <div className="text-center text-slate-400 text-sm py-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed dark:border-slate-700">
                                Nenhuma máquina cadastrada neste mês.
                            </div>
                        ) : (
                            limpezaParams.machines.map(m => (
                                <div key={m.id} className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border dark:border-slate-700 text-sm">
                                    <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200 mb-2 border-b dark:border-slate-700 pb-2">
                                        <span>{m.name}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-rose-500">{formatBRL(m.totalCost)}</span>
                                            {!isLockedLimpeza && (
                                                <button onClick={() => handleRemoveMachine(m.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={14} /></button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                                        {Object.entries(m.hours).map(([u, h]) => h > 0 && (
                                            <div key={u} className="text-slate-600 dark:text-slate-400"><span className="truncate inline-block max-w-[80px] align-bottom" title={u}>{u}:</span> <strong className="text-slate-800 dark:text-slate-300">{h}h</strong></div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Form de Nova Máquina */}
                    {!isLockedLimpeza && (
                        <div className="border-t dark:border-slate-700 pt-4 mt-auto">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-3">Adicionar Equipamento</p>
                            <div className="flex gap-2 mb-3">
                                <input type="text" placeholder="Nome Máquina" className="flex-1 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none dark:text-white" value={newMachine.name} onChange={e => setNewMachine({ ...newMachine, name: e.target.value })} />
                                <input type="number" placeholder="Custo Total (R$)" className="w-1/3 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none dark:text-white" value={newMachine.totalCost || ''} onChange={e => setNewMachine({ ...newMachine, totalCost: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                                {pedreiras.map(unit => {
                                    const short = unit.includes('-') ? unit.split('-')[1].trim() : unit;
                                    return (
                                        <div key={unit}>
                                            <label className="text-[10px] text-slate-500 truncate block font-bold mb-1" title={unit}>{short} (hrs)</label>
                                            <input type="number" className="w-full bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none dark:text-white text-center" value={newMachine.hours[short] || ''} onChange={e => setNewMachine({ ...newMachine, hours: { ...newMachine.hours, [short]: parseFloat(e.target.value) || 0 } })} />
                                        </div>
                                    )
                                })}
                            </div>
                            <button onClick={handleAddMachine} className="w-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                                <Plus size={16} /> Incluir Máquina
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* BLOCO 3: CONSOLIDADO FINAL (TABLE) */}
            <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Calculator className="text-emerald-500" /> Extrato Consolidado da Limpeza
                    </h3>
                    <div className="text-sm font-bold text-slate-600 dark:text-slate-300">
                        Total Rateado: <span className="text-emerald-600 dark:text-emerald-400">{formatBRL(grandTotalLimpeza)}</span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="text-xs text-slate-500 uppercase bg-white dark:bg-slate-800 border-b dark:border-slate-700">
                            <tr>
                                <th className="px-6 py-4 font-bold">Unidade (Pedreira)</th>
                                <th className="px-6 py-4 font-bold text-center">Horas Pessoal</th>
                                <th className="px-6 py-4 font-bold text-right text-indigo-600 dark:text-indigo-400">Rateio CC 1121</th>
                                <th className="px-6 py-4 font-bold text-right text-rose-500">Existem Máquinas?</th>
                                <th className="px-6 py-4 font-bold text-right text-rose-600 dark:text-rose-400">Rateio Máquinas</th>
                                <th className="px-6 py-4 font-black text-right bg-slate-50 dark:bg-slate-900/50">Custo Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {tableData.map((row, idx) => (
                                <tr key={row.name} className={`hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-800/30'}`}>
                                    <td className="px-6 py-3 font-bold text-slate-700 dark:text-slate-300">{row.name}</td>
                                    <td className="px-6 py-3 text-center text-slate-500">{row.employeeHours}h</td>
                                    <td className="px-6 py-3 text-right font-medium text-slate-600 dark:text-slate-400">{formatBRL(row.employeeCost)}</td>
                                    <td className="px-6 py-3 text-right text-slate-400">
                                        {row.machineCost > 0 ? 'Sim' : 'Não'}
                                    </td>
                                    <td className="px-6 py-3 text-right font-medium text-slate-600 dark:text-slate-400">{formatBRL(row.machineCost)}</td>
                                    <td className="px-6 py-3 text-right font-black text-emerald-600 dark:text-emerald-400 bg-slate-50 dark:bg-slate-900/50">{formatBRL(row.totalCost)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-200 dark:border-slate-600">
                                <td colSpan="2" className="px-6 py-4 font-bold text-right text-slate-700 dark:text-slate-300">TOTAL:</td>
                                <td className="px-6 py-4 text-right font-bold text-indigo-600 dark:text-indigo-400">{formatBRL(tableData.reduce((a, b) => a + b.employeeCost, 0))}</td>
                                <td className="px-6 py-4 text-right text-slate-400">-</td>
                                <td className="px-6 py-4 text-right font-bold text-rose-600 dark:text-rose-400">{formatBRL(tableData.reduce((a, b) => a + b.machineCost, 0))}</td>
                                <td className="px-6 py-4 text-right font-black text-emerald-600 dark:text-emerald-400">{formatBRL(grandTotalLimpeza)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
