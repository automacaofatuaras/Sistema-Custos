import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Edit2, Save, Loader2, Calculator, FileText, Share2, Factory } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, appId } from '../../../services/firebase';
import { BUSINESS_HIERARCHY } from '../../../constants/business';
import CurrencyInput from '../../common/CurrencyInput';
import PeriodSelector from '../../common/PeriodSelector';
import { formatDate } from '../../../utils/formatters';

const RateiosComponent = ({ transactions, filter, setFilter, years, segmentsList }) => {
    // Estado local
    const [selectedSegment, setSelectedSegment] = useState('Portos de Areia');
    const [activeRateioType, setActiveRateioType] = useState('ADMINISTRATIVO');

    // Estados para Rateio Vendedores (Manual)
    const [manualPercents, setManualPercents] = useState({});
    const [isLockedVend, setIsLockedVend] = useState(false);
    const [isSavingVend, setIsSavingVend] = useState(false);

    // --- ESTADOS PARA RATEIO ADM NOROMIX ---
    const [admParams, setAdmParams] = useState({
        totalValue: 0,      // Valor Total a Ratear
        minWage: 1412,      // Salário Mínimo
        employees: {}       // Mapa: { 'Unidade': qtd_funcionarios }
    });

    const [isLocked, setIsLocked] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // --- CONFIGURAÇÃO DOS RATEIOS ---
    const RATEIO_CONFIG = {
        'Portos de Areia': [
            { id: 'ADMINISTRATIVO', label: 'Rateio Administrativo' },
            { id: 'PRODUCAO', label: 'Encarregado Produção' },
            { id: 'VENDEDORES', label: 'Rateio Vendedores' },
            { id: 'COMERCIAL', label: 'Rateio Comercial' }
        ],
        'Pedreiras': [
            { id: 'ADMINISTRATIVO', label: 'Rateio Administrativo' },
            { id: 'PRODUCAO', label: 'Encarregado Produção' },
            { id: 'VENDEDORES', label: 'Rateio Vendedores' },
            { id: 'COMERCIAL', label: 'Rateio Comercial' },
            { id: 'LIMPEZA', label: 'Rateio Limpeza' },
            { id: 'PERFURATRIZ', label: 'Rateio Perfuratriz' }
        ],
        'Noromix Concreteiras': [
            { id: 'ADMINISTRATIVO', label: 'Rateio Administrativo (Salários)' },
            { id: 'COMERCIAL', label: 'Rateio Comercial (Produção)' },
            { id: 'TECNICO', label: 'Rateio Dep. Técnico (CC 1075)' },
            { id: 'VENDEDORES', label: 'Rateio Vendedores (CC Específico)' },
            { id: 'NOROMIX_1046', label: 'Rateio Noromix (CC 1046)' }
        ]
    };

    // --- MAPEAMENTO DE VENDEDORES ---
    const VENDEDORES_MAP = [
        { cc: 8003, unit: "Noromix Concreto S/A - Votuporanga" },
        { cc: 9003, unit: "Noromix Concreto S/A - Três Fronteiras" },
        { cc: 22003, unit: "Noromix Concreto S/A - Ilha Solteira" },
        { cc: 25003, unit: "Noromix Concreto S/A - Jales" },
        { cc: 27003, unit: "Noromix Concreto S/A - Fernandópolis" },
        { cc: 29003, unit: "Noromix Concreto S/A - Pereira Barreto" },
        { cc: 33003, unit: "Noromix Concreto S/A - Ouroeste" },
        { cc: 34003, unit: "Noromix Concreto S/A - Monções" },
        { cc: 38003, unit: "Noromix Concreto S/A - Paranaíba" }
    ];

    // --- EFEITO: CARREGAR DADOS SALVOS (ADM E VENDEDORES) ---
    useEffect(() => {
        const loadSavedData = async () => {
            if (selectedSegment !== 'Noromix Concreteiras') return;

            // 1. CARREGAR ADM
            const docIdAdm = `rateio_adm_${filter.year}_${filter.month}`;
            const docRefAdm = doc(db, 'artifacts', appId, 'rateio_adm_config', docIdAdm);

            try {
                const docSnap = await getDoc(docRefAdm);
                const allUnits = [...BUSINESS_HIERARCHY["Noromix Concreteiras"], ...BUSINESS_HIERARCHY["Fábrica de Tubos"]];

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setAdmParams({
                        totalValue: data.totalValue || 0,
                        minWage: data.minWage || 1412,
                        employees: data.employees || {}
                    });
                    setIsLocked(true);
                } else {
                    const initialEmployees = {};
                    allUnits.forEach(u => initialEmployees[u] = 0);
                    setAdmParams({ totalValue: 0, minWage: 1412, employees: initialEmployees });
                    setIsLocked(false);
                }
            } catch (error) {
                console.error("Erro ao carregar ADM:", error);
            }

            // 2. CARREGAR VENDEDORES
            const docIdVend = `rateio_vendedores_${filter.year}_${filter.month}`;
            const docRefVend = doc(db, 'artifacts', appId, 'rateio_vendedores_config', docIdVend);

            try {
                const docSnapVend = await getDoc(docRefVend);

                if (docSnapVend.exists()) {
                    setManualPercents(docSnapVend.data().percents || {});
                    setIsLockedVend(true);
                } else {
                    const initialPercents = {};
                    VENDEDORES_MAP.forEach(item => {
                        initialPercents[item.cc] = 100;
                    });
                    setManualPercents(initialPercents);
                    setIsLockedVend(false);
                }
            } catch (error) {
                console.error("Erro ao carregar Vendedores:", error);
            }
        };

        loadSavedData();

    }, [selectedSegment, filter.month, filter.year]);

    // --- FUNÇÃO SALVAR ADM ---
    const handleSaveAdmParams = async () => {
        setIsSaving(true);
        const docId = `rateio_adm_${filter.year}_${filter.month}`;
        const docRef = doc(db, 'artifacts', appId, 'rateio_adm_config', docId);
        try {
            await setDoc(docRef, { ...admParams, updatedAt: new Date().toISOString(), user: 'system' });
            setIsLocked(true);
        } catch (error) { alert("Erro ao salvar rateio ADM."); }
        finally { setIsSaving(false); }
    };

    // --- FUNÇÃO SALVAR VENDEDORES ---
    const handleSaveVendedores = async () => {
        setIsSavingVend(true);
        const docId = `rateio_vendedores_${filter.year}_${filter.month}`;
        const docRef = doc(db, 'artifacts', appId, 'rateio_vendedores_config', docId);
        try {
            await setDoc(docRef, { percents: manualPercents, updatedAt: new Date().toISOString(), user: 'system' });
            setIsLockedVend(true);
        } catch (error) { alert("Erro ao salvar rateio Vendedores."); }
        finally { setIsSavingVend(false); }
    };

    // --- HELPER DE FILTRO DE DATA ---
    const filterByDate = (txs) => {
        return txs.filter(t => {
            let y, m;
            if (typeof t.date === 'string' && t.date.length >= 10) {
                y = parseInt(t.date.substring(0, 4));
                m = parseInt(t.date.substring(5, 7)) - 1;
            } else { const d = new Date(t.date); y = d.getFullYear(); m = d.getMonth(); }

            if (y !== filter.year) return false;
            if (filter.type === 'month' && m !== filter.month) return false;
            if (filter.type === 'quarter' && (Math.floor(m / 3) + 1) !== filter.quarter) return false;
            if (filter.type === 'semester' && (m < 6 ? 1 : 2) !== filter.semester) return false;
            return true;
        });
    };

    // --- CÁLCULOS PRINCIPAIS ---
    const calculatedData = useMemo(() => {
        const periodTxs = filterByDate(transactions);

        const sumCC = (codes) => periodTxs
            .filter(t => t.type === 'expense')
            .filter(t => codes.includes(parseInt(t.costCenter.split(' ')[0])))
            .reduce((acc, t) => acc + t.value, 0);

        const listItems = (codes) => periodTxs
            .filter(t => t.type === 'expense')
            .filter(t => codes.includes(parseInt(t.costCenter.split(' ')[0])));

        // 1. Rateio Administrativo (Genérico)
        const totalAdm = sumCC([1087, 1089]);
        const itemsAdm = listItems([1087, 1089]);

        // 2. Produção
        const ccProd = selectedSegment === 'Portos de Areia' ? [1042] : [1043];
        const totalProd = sumCC(ccProd);
        const itemsProd = listItems(ccProd);

        // 3. Vendedores/Comercial
        const totalVend2105 = sumCC([2105, 20105]);
        const totalVend3105 = sumCC([3105]);
        const totalVend5105 = sumCC([5105]);
        const totalComercial = sumCC([1104]);

        // A. Rateio Comercial e Técnico Noromix
        let noromixComercialData = { units: [], totalProduction: 0, totalExpenses: 0, expenseItems: [] };
        let noromixTecnicoData = { units: [], totalProduction: 0, totalExpenses: 0, expenseItems: [] };

        if (selectedSegment === 'Noromix Concreteiras') {
            const targetUnits = [...BUSINESS_HIERARCHY["Noromix Concreteiras"], ...BUSINESS_HIERARCHY["Fábrica de Tubos"]];

            // --- CÁLCULO COMERCIAL (1104) ---
            const expenses1104 = periodTxs.filter(t => t.type === 'expense' && t.costCenter.startsWith('1104'));
            const totalExp1104 = expenses1104.reduce((acc, t) => acc + t.value, 0);

            // --- CÁLCULO TÉCNICO (1075) ---
            const expenses1075 = periodTxs.filter(t => t.type === 'expense' && t.costCenter.startsWith('1075'));
            const totalExp1075 = expenses1075.reduce((acc, t) => acc + t.value, 0);

            let grandTotalProd = 0;
            const productionMap = {};

            targetUnits.forEach(u => {
                const targetName = u.includes(':') ? u.split(':')[1].trim() : u;
                const prod = periodTxs.filter(t => {
                    if (t.type !== 'metric' || t.metricType !== 'producao') return false;
                    const txUnit = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                    return txUnit === targetName;
                }).reduce((acc, t) => acc + t.value, 0);

                productionMap[u] = prod;
                grandTotalProd += prod;
            });

            const buildRateioProducao = (totalExpense) => {
                const result = targetUnits.map(unitName => {
                    const prod = productionMap[unitName] || 0;
                    let percent = 0;
                    let valueToPay = 0;
                    if (grandTotalProd > 0) {
                        percent = prod / grandTotalProd;
                        valueToPay = totalExpense * percent;
                    }
                    return { name: unitName, production: prod, percent, valueToPay };
                });
                return result.sort((a, b) => b.production - a.production);
            };

            noromixComercialData = {
                units: buildRateioProducao(totalExp1104),
                totalProduction: grandTotalProd,
                totalExpenses: totalExp1104,
                expenseItems: expenses1104
            };

            noromixTecnicoData = {
                units: buildRateioProducao(totalExp1075),
                totalProduction: grandTotalProd,
                totalExpenses: totalExp1075,
                expenseItems: expenses1075
            };
        }

        // E. Rateio Noromix (CC 1046)
        let noromix1046Data = { units: [], totalExpenses: 0, expenseItems: [] };
        if (selectedSegment === 'Noromix Concreteiras') {
            const targetUnits = [...BUSINESS_HIERARCHY["Noromix Concreteiras"], ...BUSINESS_HIERARCHY["Fábrica de Tubos"]];
            const expenses1046 = periodTxs.filter(t => t.type === 'expense' && t.costCenter.startsWith('1046'));
            const totalExp1046 = expenses1046.reduce((acc, t) => acc + t.value, 0);

            const shareValue = targetUnits.length > 0 ? totalExp1046 / targetUnits.length : 0;

            const unitsCalculated = targetUnits.map(unitName => ({
                name: unitName,
                valueToPay: shareValue
            })).sort((a, b) => a.name.localeCompare(b.name));

            noromix1046Data = {
                units: unitsCalculated,
                totalExpenses: totalExp1046,
                expenseItems: expenses1046
            };
        }

        // B. Rateio Vendedores Noromix
        let noromixVendedoresData = [];
        if (selectedSegment === 'Noromix Concreteiras') {
            const targetCCs = VENDEDORES_MAP.map(m => m.cc);
            const vendorTxs = periodTxs.filter(t => targetCCs.includes(parseInt(t.costCenter.split(' ')[0])) && t.type === 'expense');

            const grouped = {};
            vendorTxs.forEach(t => {
                const cc = parseInt(t.costCenter.split(' ')[0]);
                const mapInfo = VENDEDORES_MAP.find(m => m.cc === cc);
                const unitName = mapInfo ? mapInfo.unit : 'Desconhecida';
                const key = `${cc}-${t.accountPlan}`;

                if (!grouped[key]) grouped[key] = { cc, unitName, accountCode: t.accountPlan, accountDesc: t.planDescription, originalValue: 0 };
                grouped[key].originalValue += t.value;
            });
            noromixVendedoresData = Object.values(grouped).sort((a, b) => a.cc - b.cc);
        }

        // C. Rateio ADMINISTRATIVO Noromix
        let noromixAdmData = { table: [], totalSalariosPot: 0, totalDespesasPot: 0, grandTotalVolume: 0 };
        if (selectedSegment === 'Noromix Concreteiras') {
            const concreteUnits = BUSINESS_HIERARCHY["Noromix Concreteiras"];
            const pipeUnit = BUSINESS_HIERARCHY["Fábrica de Tubos"][0];
            const allUnits = [...concreteUnits, pipeUnit];

            let volConcretoTotal = 0;
            let volGlobalTotal = 0;
            const unitVolumes = {};

            allUnits.forEach(u => {
                const targetName = u.includes(':') ? u.split(':')[1].trim() : u;
                const vol = periodTxs
                    .filter(t => {
                        if (t.type !== 'metric' || t.metricType !== 'producao') return false;
                        const txUnitName = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                        return txUnitName === targetName;
                    })
                    .reduce((acc, t) => acc + t.value, 0);

                unitVolumes[u] = vol;
                volGlobalTotal += vol;
                if (u !== pipeUnit) volConcretoTotal += vol;
            });

            let totalSalariosCalc = 0;
            allUnits.forEach(u => {
                const count = admParams.employees[u] || 0;
                let factor = 0;
                if (count > 0 && count <= 6) factor = 2;
                else if (count > 6 && count <= 14) factor = 4;
                else if (count >= 15) factor = 6;
                totalSalariosCalc += (factor * admParams.minWage);
            });

            const despesasPot = Math.max(0, admParams.totalValue - totalSalariosCalc - 20000);

            const table = allUnits.map(u => {
                const vol = unitVolumes[u] || 0;
                const isPipe = u === pipeUnit;
                const shortName = u.includes('-') ? u.split('-')[1].trim() : u;

                const rateioFolha = volGlobalTotal > 0 ? (totalSalariosCalc / volGlobalTotal) * vol : 0;
                let rateioDespesas = 0;
                if (isPipe) {
                    rateioDespesas = 20000;
                } else {
                    rateioDespesas = volConcretoTotal > 0 ? (vol / volConcretoTotal) * despesasPot : 0;
                }

                return {
                    name: shortName,
                    fullName: u,
                    employees: admParams.employees[u] || 0,
                    volume: vol,
                    rateioFolha,
                    rateioDespesas,
                    total: rateioFolha + rateioDespesas
                };
            });
            table.sort((a, b) => b.volume - a.volume);
            noromixAdmData = { table, totalSalariosPot: totalSalariosCalc, totalDespesasPot: despesasPot + 20000, grandTotalVolume: volGlobalTotal };
        }

        // Ativas Genérico
        const targetUnitsGenerico = [...BUSINESS_HIERARCHY["Pedreiras"], ...BUSINESS_HIERARCHY["Portos de Areia"], ...BUSINESS_HIERARCHY["Usinas de Asfalto"]];
        const activeUnits = targetUnitsGenerico.filter(unit => periodTxs.filter(t => t.type === 'metric' && t.metricType === 'producao' && t.segment === unit).reduce((acc, t) => acc + t.value, 0) > 0);

        return {
            totalAdm, itemsAdm, totalProd, itemsProd, totalVend2105, totalVend3105, totalVend5105, totalComercial, activeUnits,
            noromixComercialData, noromixTecnicoData, noromixVendedoresData, noromixAdmData, noromix1046Data
        };
    }, [transactions, filter, selectedSegment, admParams]);

    // Handlers
    const handlePercChange = (key, subKey, val) => {
        let numVal = parseFloat(val); if (numVal < 0) numVal = 0; if (numVal > 100) numVal = 100;
        if (selectedSegment === 'Noromix Concreteiras') setManualPercents(prev => ({ ...prev, [key]: numVal }));
        else setManualPercents(prev => ({ ...prev, [key]: { ...prev[key], [subKey]: numVal } }));
    };

    const handleAdmParamChange = (field, val, unit = null) => {
        if (unit) {
            setAdmParams(prev => ({ ...prev, employees: { ...prev.employees, [unit]: parseInt(val) || 0 } }));
        } else {
            setAdmParams(prev => ({ ...prev, [field]: val }));
        }
    };

    // --- RENDERIZAÇÃO ---
    const renderContent = () => {
        if (['LIMPEZA', 'PERFURATRIZ'].includes(activeRateioType)) return <div className="p-10 text-center text-slate-400 border border-dashed rounded-xl">Módulo em desenvolvimento.</div>;

        // --- TELA ADMINISTRATIVO ---
        if (activeRateioType === 'ADMINISTRATIVO') {
            if (selectedSegment === 'Noromix Concreteiras') {
                const { table, totalSalariosPot, totalDespesasPot, grandTotalVolume } = calculatedData.noromixAdmData;
                const unitsList = [...BUSINESS_HIERARCHY["Noromix Concreteiras"], ...BUSINESS_HIERARCHY["Fábrica de Tubos"]];

                return (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-6 shadow-sm relative">
                            <div className="flex justify-between items-start mb-6">
                                <h4 className="font-bold text-lg flex items-center gap-2 dark:text-white"><Settings size={20} className="text-slate-400" /> Parâmetros do Rateio (Mês Vigente)</h4>
                                <div className="flex gap-2">
                                    {isLocked ? (<button onClick={() => setIsLocked(false)} className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg font-bold hover:bg-amber-200 transition-colors text-sm"><Edit2 size={16} /> Editar Parâmetros</button>) : (<button onClick={handleSaveAdmParams} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors text-sm disabled:opacity-50">{isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvar Definições</button>)}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor Total Rateio (R$)</label><CurrencyInput value={admParams.totalValue} onChange={(val) => handleAdmParamChange('totalValue', val)} disabled={isLocked} className={`w-full border p-3 rounded-lg text-lg font-bold text-indigo-600 dark:bg-slate-700 dark:text-white dark:border-slate-600 ${isLocked ? 'bg-slate-100 opacity-70' : ''}`} /></div>
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Salário Mínimo Base (R$)</label><CurrencyInput value={admParams.minWage} onChange={(val) => handleAdmParamChange('minWage', val)} disabled={isLocked} className={`w-full border p-3 rounded-lg text-lg font-bold text-slate-600 dark:bg-slate-700 dark:text-white dark:border-slate-600 ${isLocked ? 'bg-slate-100 opacity-70' : ''}`} /></div>
                                    <div className="mt-4 bg-slate-100 dark:bg-slate-900 p-4 rounded-lg space-y-2"><div className="flex justify-between text-sm"><span>Rateio Folha Adm (Cálculo 1)</span><span className="font-bold">{totalSalariosPot.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div><div className="flex justify-between text-sm"><span>Rateio Despesas Adm (Cálculo 2 + Fixo)</span><span className="font-bold">{totalDespesasPot.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div><div className="border-t border-slate-300 pt-2 flex justify-between font-bold text-indigo-600"><span>Total Validado</span><span>{(totalSalariosPot + totalDespesasPot).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div></div>
                                </div>
                                <div className={`bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 max-h-80 overflow-y-auto border dark:border-slate-700 ${isLocked ? 'opacity-80' : ''}`}>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-3 sticky top-0 bg-slate-50 dark:bg-slate-900/50 py-2 z-10">Qtd. Funcionários (Cálculo 1)</label>
                                    <div className="space-y-2">{unitsList.map(u => (<div key={u} className="flex justify-between items-center text-sm"><span className="dark:text-slate-300 truncate w-48" title={u}>{u.includes('-') ? u.split('-')[1].trim() : u}</span><input type="number" min="0" disabled={isLocked} className={`w-20 p-1 text-center border rounded dark:bg-slate-700 dark:text-white ${isLocked ? 'bg-slate-100' : ''}`} value={admParams.employees[u] || 0} onChange={(e) => handleAdmParamChange('employees', e.target.value, u)} /></div>))}</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center"><h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Calculator size={18} className="text-emerald-500" />Resultado do Rateio Administrativo</h4><span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">Vol. Total: {grandTotalVolume.toLocaleString()} m³</span></div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left"><thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase"><tr><th className="p-3 pl-6">Unidade</th><th className="p-3 text-center">Func.</th><th className="p-3 text-right">Volume</th><th className="p-3 text-right text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20">Rateio Folha (C3)</th><th className="p-3 text-right text-amber-600 bg-amber-50 dark:bg-amber-900/20">Rateio Despesas (C2)</th><th className="p-3 text-right font-bold bg-slate-100 dark:bg-slate-800">TOTAL FINAL</th></tr></thead><tbody className="divide-y dark:divide-slate-700">
                                    {table.map((row, idx) => (<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300"><td className="p-3 pl-6 font-medium">{row.name} {row.fullName.includes('Fábrica') && <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">FÁBRICA</span>}</td><td className="p-3 text-center text-xs">{row.employees}</td><td className="p-3 text-right font-mono text-xs opacity-70">{row.volume.toLocaleString()}</td><td className="p-3 text-right font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50/30">{row.rateioFolha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="p-3 text-right font-medium text-amber-700 dark:text-amber-400 bg-amber-50/30">{row.rateioDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="p-3 text-right font-bold bg-slate-100 dark:bg-slate-800">{row.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>))}
                                    <tr className="bg-slate-900 text-white font-bold"><td colSpan={3} className="p-3 pl-6 text-right uppercase text-xs tracking-wider">Totais Calculados</td><td className="p-3 text-right">{table.reduce((a, b) => a + b.rateioFolha, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td className="p-3 text-right">{table.reduce((a, b) => a + b.rateioDespesas, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td className="p-3 text-right text-emerald-400">{table.reduce((a, b) => a + b.total, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>
                                </tbody></table>
                            </div>
                        </div>
                    </div>
                );
            }
            // Lógica Padrão (Portos/Pedreiras)
            const shareValue = calculatedData.totalAdm / 8;
            const unitShare = selectedSegment === 'Portos de Areia' ? shareValue / 2 : shareValue;
            const unitsCount = selectedSegment === 'Portos de Areia' ? 2 : 6;
            return (<div className="space-y-6 animate-in fade-in"><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-indigo-600 text-white p-6 rounded-xl shadow-lg"><p className="text-indigo-200 text-xs font-bold uppercase mb-1">Total Despesas (CC 1087/1089)</p><h3 className="text-2xl font-bold">{calculatedData.totalAdm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3></div><div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm"><p className="text-slate-500 text-xs font-bold uppercase mb-1">Valor da Cota (1/8)</p><h3 className="text-2xl font-bold dark:text-white">{shareValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3></div><div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-xl border border-emerald-100 dark:border-emerald-800 shadow-sm"><p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase mb-1">Alocado por Unidade ({unitsCount}x)</p><h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{unitShare.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3></div></div></div>);
        }

        // --- TELA ENCARREGADO PRODUÇÃO ---
        if (activeRateioType === 'PRODUCAO') {
            const ccOrigem = selectedSegment === 'Portos de Areia' ? '1042' : '1043';
            const divisor = selectedSegment === 'Portos de Areia' ? 2 : 6;
            const unitShare = calculatedData.totalProd / divisor;
            return (<div className="space-y-6 animate-in fade-in"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg"><p className="text-blue-200 text-xs font-bold uppercase mb-1">Total Despesas (CC {ccOrigem})</p><h3 className="text-2xl font-bold">{calculatedData.totalProd.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3></div><div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm"><p className="text-slate-500 text-xs font-bold uppercase mb-1">Alocado por Unidade ({divisor}x)</p><h3 className="text-2xl font-bold dark:text-white">{unitShare.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3></div></div></div>);
        }

        // --- TELA VENDEDORES ---
        if (activeRateioType === 'VENDEDORES') {
            if (selectedSegment === 'Noromix Concreteiras') {
                const totalDemonstrativo = calculatedData.noromixVendedoresData.reduce((acc, row) => { const percConc = manualPercents[row.cc] !== undefined ? manualPercents[row.cc] : 100; const valConc = row.originalValue * (percConc / 100); return { orig: acc.orig + row.originalValue, conc: acc.conc + valConc, tubo: acc.tubo + (row.originalValue - valConc) }; }, { orig: 0, conc: 0, tubo: 0 });
                return (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center"><div><h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Settings size={18} className="text-slate-500" />Configuração de Rateio por Centro de Custo</h4><p className="text-xs text-slate-500 mt-1">Defina a % que fica na Concreteira. O restante irá automaticamente para a Fábrica de Tubos.</p></div><div className="flex gap-2">{isLockedVend ? (<button onClick={() => setIsLockedVend(false)} className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg font-bold hover:bg-amber-200 transition-colors text-sm"><Edit2 size={16} /> Editar</button>) : (<button onClick={handleSaveVendedores} disabled={isSavingVend} className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors text-sm disabled:opacity-50">{isSavingVend ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Salvar</button>)}</div></div>
                            <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase"><tr><th className="p-3">CC</th><th className="p-3">Unidade Padrão (Concreto)</th><th className="p-3 text-right bg-slate-100 dark:bg-slate-800 text-slate-700">Valor Total (R$)</th><th className="p-3 w-40 text-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700">% Concreto</th><th className="p-3 w-40 text-center bg-amber-50 dark:bg-amber-900/20 text-amber-700">% Tubos</th></tr></thead><tbody className="divide-y dark:divide-slate-700">{VENDEDORES_MAP.map(mapItem => { const percConc = manualPercents[mapItem.cc] !== undefined ? manualPercents[mapItem.cc] : 100; const totalCC = calculatedData.noromixVendedoresData.filter(row => row.cc === mapItem.cc).reduce((acc, row) => acc + row.originalValue, 0); return (<tr key={mapItem.cc} className="hover:bg-slate-50 dark:hover:bg-slate-700/50"><td className="p-3 font-mono font-bold dark:text-slate-300">{mapItem.cc}</td><td className="p-3 dark:text-slate-300">{mapItem.unit.includes('-') ? mapItem.unit.split('-')[1].trim() : mapItem.unit}</td><td className="p-3 text-right font-bold text-slate-700 dark:text-slate-200 bg-slate-50/50">{totalCC.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td className="p-3 text-center bg-indigo-50/30"><div className="flex items-center justify-center gap-1"><input type="number" min="0" max="100" disabled={isLockedVend} value={percConc} onChange={(e) => handlePercChange(mapItem.cc, null, e.target.value)} className={`w-16 text-center border rounded p-1 dark:bg-slate-700 dark:text-white dark:border-slate-600 font-bold text-indigo-700 ${isLockedVend ? 'bg-slate-100' : ''}`} /><span className="text-indigo-400">%</span></div></td><td className="p-3 text-center bg-amber-50/30"><span className="font-bold text-amber-700 dark:text-amber-500">{(100 - percConc).toFixed(0)}%</span></td></tr>); })}</tbody></table></div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700"><h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><FileText size={18} className="text-slate-500" />Demonstrativo de Lançamentos (Aberto por Classe)</h4></div>
                            <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase"><tr><th className="p-3">CC Origem / Unidade</th><th className="p-3">Classe de Despesa</th><th className="p-3 text-right">Valor Original</th><th className="p-3 text-right text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20">Concreto</th><th className="p-3 text-right text-amber-600 bg-amber-50 dark:bg-amber-900/20">Tubos</th></tr></thead><tbody className="divide-y dark:divide-slate-700">
                                <tr className="bg-slate-200 dark:bg-slate-800 font-bold border-b-2 border-slate-300 dark:border-slate-600"><td colSpan={2} className="p-3 pl-4 text-slate-800 dark:text-white">TOTAL GERAL</td><td className="p-3 text-right text-slate-900 dark:text-white">{totalDemonstrativo.orig.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td className="p-3 text-right text-indigo-700 dark:text-indigo-400 bg-indigo-100/50">{totalDemonstrativo.conc.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td className="p-3 text-right text-amber-700 dark:text-amber-400 bg-amber-100/50">{totalDemonstrativo.tubo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>
                                {calculatedData.noromixVendedoresData.map((row, idx) => { const percConc = manualPercents[row.cc] !== undefined ? manualPercents[row.cc] : 100; const valConcreto = row.originalValue * (percConc / 100); return (<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300"><td className="p-3"><div className="font-bold text-slate-700 dark:text-slate-200">{row.unitName}</div><div className="text-xs font-mono text-slate-400">CC {row.cc}</div></td><td className="p-3"><div className="font-mono text-xs opacity-70">{row.accountCode}</div><div className="font-medium">{row.accountDesc}</div></td><td className="p-3 text-right font-medium">{row.originalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td className="p-3 text-right font-bold text-indigo-600 bg-indigo-50/30">{valConcreto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td className="p-3 text-right font-bold text-amber-600 bg-amber-50/30">{(row.originalValue - valConcreto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>); })}
                            </tbody></table></div>
                        </div>
                    </div>
                );
            }
            // Genérico
            const allUnits = [...BUSINESS_HIERARCHY['Portos de Areia'], ...BUSINESS_HIERARCHY['Pedreiras']];
            return (<div className="space-y-6 animate-in fade-in"><div className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 mb-4 flex gap-4 text-sm"><div className="px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded">Total CC 2105: <strong>{calculatedData.totalVend2105.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div><div className="px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded">Total CC 3105: <strong>{calculatedData.totalVend3105.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div><div className="px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded">Total CC 5105: <strong>{calculatedData.totalVend5105.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div></div><div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700"><table className="w-full text-sm text-left"><thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300"><tr><th className="p-3">Unidade</th><th className="p-3 w-32">% CC 2105</th><th className="p-3 w-32">% CC 3105</th><th className="p-3 w-32">% CC 5105</th><th className="p-3 text-right bg-slate-200 dark:bg-slate-800">Total Alocado (R$)</th></tr></thead><tbody className="divide-y dark:divide-slate-700">{allUnits.sort().map(unit => { const p2105 = manualPercents[unit]?.['2105'] || 0; const p3105 = manualPercents[unit]?.['3105'] || 0; const p5105 = manualPercents[unit]?.['5105'] || 0; const totalAlocado = (calculatedData.totalVend2105 * (p2105 / 100)) + (calculatedData.totalVend3105 * (p3105 / 100)) + (calculatedData.totalVend5105 * (p5105 / 100)); return (<tr key={unit} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300"><td className="p-3 font-medium">{unit}</td><td className="p-3"><div className="flex items-center"><input type="number" className="w-16 p-1 border rounded dark:bg-slate-700" value={p2105} onChange={e => handlePercChange(unit, '2105', e.target.value)} /> %</div></td><td className="p-3"><div className="flex items-center"><input type="number" className="w-16 p-1 border rounded dark:bg-slate-700" value={p3105} onChange={e => handlePercChange(unit, '3105', e.target.value)} /> %</div></td><td className="p-3"><div className="flex items-center"><input type="number" className="w-16 p-1 border rounded dark:bg-slate-700" value={p5105} onChange={e => handlePercChange(unit, '5105', e.target.value)} /> %</div></td><td className="p-3 text-right font-bold text-indigo-600 bg-slate-50 dark:bg-slate-800/50">{totalAlocado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>); })}</tbody></table></div></div>);
        }

        // --- TELA COMERCIAL & TÉCNICO (Reutilizam Lógica) ---
        if (activeRateioType === 'COMERCIAL' || activeRateioType === 'TECNICO') {
            if (selectedSegment === 'Noromix Concreteiras') {
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
            // Genérico
            const activeCount = calculatedData.activeUnits.length;
            const shareValue = activeCount > 0 ? calculatedData.totalComercial / activeCount : 0;
            return (<div className="space-y-6 animate-in fade-in"><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-amber-500 text-white p-6 rounded-xl shadow-lg"><p className="text-amber-100 text-xs font-bold uppercase mb-1">Total Comercial (CC 1104)</p><h3 className="text-2xl font-bold">{calculatedData.totalComercial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3></div><div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm"><p className="text-slate-500 text-xs font-bold uppercase mb-1">Unidades Ativas</p><h3 className="text-2xl font-bold text-slate-700 dark:text-white">{activeCount} <span className="text-sm font-normal text-slate-400">/ 14</span></h3></div><div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-xl border border-emerald-100 dark:border-emerald-800 shadow-sm"><p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase mb-1">Alocado por Unidade Ativa</p><h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{shareValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3></div></div></div>);
        }

        // --- TELA NOROMIX 1046 (NOVO) ---
        if (activeRateioType === 'NOROMIX_1046') {
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

        return <div className="p-10 text-center text-slate-400">Selecione um tipo de rateio acima.</div>;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-sm gap-4">
                <div className="flex items-center gap-2"><Share2 className="text-indigo-500" size={24} /><h3 className="font-bold text-lg dark:text-white">Painel de Rateios</h3></div>
                <div className="flex gap-2"><PeriodSelector filter={filter} setFilter={setFilter} years={years} /><select className="bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white outline-none focus:ring-2 ring-indigo-500" value={selectedSegment} onChange={(e) => { setSelectedSegment(e.target.value); setActiveRateioType('ADMINISTRATIVO'); }}>{Object.keys(RATEIO_CONFIG).map(seg => <option key={seg} value={seg}>{seg}</option>)}</select></div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">{RATEIO_CONFIG[selectedSegment]?.map(type => (<button key={type.id} onClick={() => setActiveRateioType(type.id)} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeRateioType === type.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border dark:border-slate-700 hover:bg-slate-50'}`}>{type.label}</button>))}</div>
            {renderContent()}
        </div>
    );
};

export default RateiosComponent;
