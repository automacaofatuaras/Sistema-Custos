import React, { useState, useEffect, useMemo } from 'react';
import { Share2 } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, appId } from '../../../../services/firebase';
import { BUSINESS_HIERARCHY } from '../../../../constants/business';
import PeriodSelector from '../../../common/PeriodSelector';
import { fetchConsolidatedTransactions } from '../../../../utils/rateioTransactions';

// Importando as Abas Componentizadas
import AbaAdministrativo from './tabs/AbaAdministrativo';
import AbaProducao from './tabs/AbaProducao';
import AbaVendedores from './tabs/AbaVendedores';
import AbaComercialTecnico from './tabs/AbaComercialTecnico';
import AbaNoromix1046 from './tabs/AbaNoromix1046';
import AbaAdmSalarios from './tabs/AbaAdmSalarios';
import AbaLimpeza from './tabs/AbaLimpeza';

const RateioUnidadesCentral = ({ transactions, filter, setFilter, years, user = { email: 'admin@sistema.com' } }) => {
    // Estado local
    const [selectedSegment, setSelectedSegment] = useState('Pedreiras e Portos de Areia');
    const [activeRateioType, setActiveRateioType] = useState('ADMINISTRATIVO');
    const [admTransactions, setAdmTransactions] = useState([]);

    // Estados para Rateio Vendedores (Manual)
    const [manualPercents, setManualPercents] = useState({});
    const [isLockedVend, setIsLockedVend] = useState(false);
    const [isSavingVend, setIsSavingVend] = useState(false);

    // --- ESTADOS PARA RATEIO ADM NOROMIX ---
    const [admParams, setAdmParams] = useState({
        totalValue: 0,
        minWage: 1518,
        employees: {},
        volumes: {}
    });

    const [isLocked, setIsLocked] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // --- ESTADOS PARA RATEIO LIMPEZA ---
    const [limpezaParams, setLimpezaParams] = useState({
        employeeHours: {},
        machines: []
    });
    const [isLockedLimpeza, setIsLockedLimpeza] = useState(false);
    const [isSavingLimpeza, setIsSavingLimpeza] = useState(false);

    // --- CONFIGURAÇÃO DOS RATEIOS ---
    const RATEIO_CONFIG = {
        'Pedreiras e Portos de Areia': [
            { id: 'ADMINISTRATIVO', label: 'Rateio Administrativo' },
            { id: 'ADM_SALARIOS', label: 'Despesas Administrativas' },
            { id: 'PRODUCAO', label: 'Encarregado Produção' },
            { id: 'VENDEDORES', label: 'Rateio Vendedores' },
            { id: 'COMERCIAL', label: 'Rateio Comercial' },
            { id: 'LIMPEZA', label: 'Rateio Limpeza' },
            { id: 'PERFURATRIZ', label: 'Rateio Perfuratriz' }
        ],
        'Concreteiras e Fábrica de Tubos': [
            { id: 'ADMINISTRATIVO', label: 'Rateio Administrativo' },
            { id: 'COMERCIAL', label: 'Rateio Comercial' },
            { id: 'TECNICO', label: 'Rateio Dep. Técnico' },
            { id: 'VENDEDORES', label: 'Rateio Vendedores' },
            { id: 'NOROMIX_1046', label: 'Rateio Noromix' }
        ]
    };

    // --- MAPEAMENTO DE VENDEDORES ---
    const VENDEDORES_MAP = [
        { cc: 8003, unit: "Noromix Concreto S/A - Votuporanga" },
        { cc: 9003, unit: "Noromix Concreto S/A - Três Fronteiras" },
        { cc: 22003, unit: "Noromix Concreto S/A - Ilha Solteira" },
        { cc: 25003, unit: "Noromix Concreto S/A - Jales" },
        { cc: 27003, unit: "Noromix Concreto S/A - Fernandópolis" },
        { cc: 28003, unit: "Noromix Concreto S/A - Andradina" },
        { cc: 29003, unit: "Noromix Concreto S/A - Pereira Barreto" },
        { cc: 33003, unit: "Noromix Concreto S/A - Ouroeste" },
        { cc: 34003, unit: "Noromix Concreto S/A - Monções" },
        { cc: 38003, unit: "Noromix Concreto S/A - Paranaíba" }
    ];

    // --- EFEITO: CARREGAR DADOS SALVOS (ADM E VENDEDORES) ---
    useEffect(() => {
        const loadSavedData = async () => {
            if (selectedSegment !== 'Concreteiras e Fábrica de Tubos' && activeRateioType !== 'ADM_SALARIOS') return;

            // 1. CARREGAR ADM
            const isNoromix = selectedSegment === 'Concreteiras e Fábrica de Tubos';
            const docIdAdm = isNoromix ? `rateio_adm_${filter.year}_${filter.month}` : `rateio_adm_pedreiras_${filter.year}_${filter.month}`;
            const docRefAdm = doc(db, 'artifacts', appId, 'rateio_adm_config', docIdAdm);

            try {
                const docSnap = await getDoc(docRefAdm);
                const allUnits = isNoromix
                    ? [...BUSINESS_HIERARCHY["Noromix Concreteiras"], ...BUSINESS_HIERARCHY["Fábrica de Tubos"]]
                    : [...BUSINESS_HIERARCHY["Pedreiras"], ...BUSINESS_HIERARCHY["Portos de Areia"]];

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setAdmParams({
                        totalValue: data.totalValue || 0,
                        minWage: data.minWage || 1518,
                        employees: data.employees || {},
                        volumes: data.volumes || {}
                    });
                    setIsLocked(true);
                } else {
                    const initialEmployees = {};
                    const initialVolumes = {};
                    allUnits.forEach(u => {
                        initialEmployees[u] = 0;
                        initialVolumes[u] = '';
                    });
                    setAdmParams({ totalValue: 0, minWage: 1518, employees: initialEmployees, volumes: initialVolumes });
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

        const loadAdmGeralTransactions = async () => {
            try {
                const data = await fetchConsolidatedTransactions(user);
                setAdmTransactions(data);
            } catch (error) {
                console.error("Erro ao buscar transações do Rateio Adm Geral", error);
            }
        };

        // 3. CARREGAR LIMPEZA
        const loadLimpezaData = async () => {
            if (activeRateioType !== 'LIMPEZA') return;
            const docIdLimpeza = `rateio_limpeza_${filter.year}_${filter.month}`;
            const docRefLimpeza = doc(db, 'artifacts', appId, 'rateio_limpeza_config', docIdLimpeza);

            try {
                const docSnapLimpeza = await getDoc(docRefLimpeza);
                if (docSnapLimpeza.exists()) {
                    setLimpezaParams(docSnapLimpeza.data());
                    setIsLockedLimpeza(true);
                } else {
                    setLimpezaParams({ employeeHours: {}, machines: [] });
                    setIsLockedLimpeza(false);
                }
            } catch (error) {
                console.error("Erro ao carregar Limpeza:", error);
            }
        };

        loadSavedData();
        loadAdmGeralTransactions();
        loadLimpezaData();
    }, [selectedSegment, activeRateioType, filter.month, filter.year, user?.email]);

    // --- FUNÇÃO SALVAR LIMPEZA ---
    const handleSaveLimpeza = async () => {
        setIsSavingLimpeza(true);
        const docId = `rateio_limpeza_${filter.year}_${filter.month}`;
        const docRef = doc(db, 'artifacts', appId, 'rateio_limpeza_config', docId);
        try {
            await setDoc(docRef, { ...limpezaParams, updatedAt: new Date().toISOString(), user: 'system' });
            setIsLockedLimpeza(true);
        } catch (error) { alert("Erro ao salvar rateio Limpeza."); }
        finally { setIsSavingLimpeza(false); }
    };

    // --- FUNÇÃO SALVAR ADM ---
    const handleSaveAdmParams = async () => {
        setIsSaving(true);
        const isNoromix = selectedSegment === 'Concreteiras e Fábrica de Tubos';
        const docId = isNoromix ? `rateio_adm_${filter.year}_${filter.month}` : `rateio_adm_pedreiras_${filter.year}_${filter.month}`;
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
            if (typeof t.date === 'string' && t.date.includes('/')) {
                const parts = t.date.split('/');
                y = parseInt(parts[2]);
                m = parseInt(parts[1]) - 1;
            } else if (typeof t.date === 'string' && t.date.length >= 10) {
                y = parseInt(t.date.substring(0, 4));
                m = parseInt(t.date.substring(5, 7)) - 1;
            } else {
                const d = new Date(t.date); y = d.getFullYear(); m = d.getMonth();
            }

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

        // Filtro especial usando transações enriquecidas apenas para as contas Administrativas (1087 e 1089)
        const periodAdmTxs = filterByDate(admTransactions);

        const sumAdmCC = (codes) => periodAdmTxs
            .filter(t => codes.includes(parseInt(t.costCenter.split(' ')[0])))
            .reduce((acc, t) => acc + t.value, 0);

        const listAdmItems = (codes) => periodAdmTxs
            .filter(t => codes.includes(parseInt(t.costCenter.split(' ')[0])));

        // 1. Rateio Administrativo (Genérico) usando base consolidada (Cloud dbService)
        const totalAdm = sumAdmCC([1087, 1089]);
        const itemsAdm = listAdmItems([1087, 1089]).sort((a, b) => b.value - a.value);

        // 2. Produção
        const ccProd = [1042, 1043];
        const totalProd = sumCC(ccProd);
        const itemsProd = listItems(ccProd);

        // 3. Vendedores/Comercial
        const totalVend2105 = sumCC([2105, 20105]);
        const totalVend3105 = sumCC([3105]);
        const totalVend5105 = sumCC([5105]);
        const totalComercial = sumCC([1104]);
        const itemsVend = listItems([2105, 20105, 3105, 5105]).sort((a, b) => b.value - a.value);

        // 4. Rateio Comercial (Genérico) usando base consolidada (Cloud dbService)
        const totalComercialGen = sumAdmCC([1104]);
        const itemsComercialGen = listAdmItems([1104]).sort((a, b) => b.value - a.value);

        // 5. Rateio Limpeza
        const itemsLimpeza = listItems([1121]);

        // --- CÁLCULOS GLOBAIS DE BASE ---

        // 1. TOTAL ADM GERAL (100%) - Usado como base para Rateio Admin (10%) e agora Comercial (CC 1105)
        const totalIndiretoGeral = periodAdmTxs
            .filter(t => {
                const seg = (t.segment || '').trim().toUpperCase();
                return seg === 'GERAL' || seg === 'GERAL / ADMINISTRATIVO' || seg === 'ADMINISTRATIVO GERAL' || seg === 'ADMINISTRATIVO' || seg === 'INDIFERENTE';
            })
            .reduce((acc, t) => {
                if (t.type?.toUpperCase() === 'DIRETO') return acc;
                return acc + (t.value || 0);
            }, 0);

        // 2. VOLUMES MANUAIS/ADULTOS
        const concreteUnits = BUSINESS_HIERARCHY["Noromix Concreteiras"];
        const pipeUnit = BUSINESS_HIERARCHY["Fábrica de Tubos"][0];
        const allRateioUnits = [...concreteUnits, pipeUnit];

        let volConcretoTotal = 0;
        let volGlobalTotal = 0;
        const unitVolumes = {};

        allRateioUnits.forEach(u => {
            const vol = Number(admParams.volumes?.[u] || 0);
            unitVolumes[u] = vol;
            volGlobalTotal += vol;
            if (u !== pipeUnit) volConcretoTotal += vol;
        });

        // 3. CUSTO DIRETO OPERACIONAL DO SEGMENTO (Usado no Comercial CC 1105)
        const segmentDiretoItems = periodAdmTxs.filter(t => {
            if (t.type?.toUpperCase() !== 'DIRETO') return false;
            const seg = (t.segment || '').trim().toUpperCase();
            return seg.includes('CONCRE') || seg.includes('FABRICA') || seg.includes('TUBOS');
        });
        const totalDiretoSegmento = segmentDiretoItems.reduce((acc, t) => acc + (t.value || 0), 0);

        // A. Rateio Comercial e Técnico Noromix
        let noromixComercialData = { units: [], totalProduction: 0, totalExpenses: 0, expenseItems: [] };
        let noromixTecnicoData = { units: [], totalProduction: 0, totalExpenses: 0, expenseItems: [] };
        let noromixAdmData = { table: [], totalSalariosPot: 0, totalDespesasPot: 0, grandTotalVolume: 0, autoTargetValue: 0 };

        if (selectedSegment === 'Concreteiras e Fábrica de Tubos') {
            const targetUnits = allRateioUnits;

            // NOVA REGRA COMERCIAL (CC 1105): Usa o Custo Direto Operacional do Segmento
            const totalExp1105 = totalDiretoSegmento;
            const expenses1105 = segmentDiretoItems;

            // CÁLCULO TÉCNICO (CC 1075): Mantém busca nas transações
            const expenses1075 = periodTxs.filter(t => t.type === 'expense' && t.costCenter.startsWith('1075'));
            const totalExp1075 = expenses1075.reduce((acc, t) => acc + t.value, 0);

            const buildRateioProducao = (totalExpense) => {
                const result = targetUnits.map(unitName => {
                    const prod = unitVolumes[unitName] || 0;
                    let percent = 0;
                    let valueToPay = 0;
                    if (volGlobalTotal > 0) {
                        percent = prod / volGlobalTotal;
                        valueToPay = totalExpense * percent;
                    }
                    return { name: unitName, production: prod, percent, valueToPay };
                });
                return result.sort((a, b) => b.production - a.production);
            };

            noromixComercialData = { units: buildRateioProducao(totalExp1105), totalProduction: volGlobalTotal, totalExpenses: totalExp1105, expenseItems: expenses1105 };
            noromixTecnicoData = { units: buildRateioProducao(totalExp1075), totalProduction: volGlobalTotal, totalExpenses: totalExp1075, expenseItems: expenses1075 };
        }

        // E. Rateio Noromix (CC 1046)
        let noromix1046Data = { units: [], totalExpenses: 0, expenseItems: [] };
        if (selectedSegment === 'Concreteiras e Fábrica de Tubos') {
            const targetUnits = [...BUSINESS_HIERARCHY["Noromix Concreteiras"], ...BUSINESS_HIERARCHY["Fábrica de Tubos"]];
            const expenses1046 = periodTxs.filter(t => t.type === 'expense' && t.costCenter.startsWith('1046'));
            const totalExp1046 = expenses1046.reduce((acc, t) => acc + t.value, 0);

            const shareValue = targetUnits.length > 0 ? totalExp1046 / targetUnits.length : 0;
            const unitsCalculated = targetUnits.map(unitName => ({ name: unitName, valueToPay: shareValue })).sort((a, b) => a.name.localeCompare(b.name));

            noromix1046Data = { units: unitsCalculated, totalExpenses: totalExp1046, expenseItems: expenses1046 };
        }

        // B. Rateio Vendedores Noromix
        let noromixVendedoresData = [];
        if (selectedSegment === 'Concreteiras e Fábrica de Tubos') {
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

        if (selectedSegment === 'Concreteiras e Fábrica de Tubos') {
            // (Calculations already performed in global block)
            const allUnits = allRateioUnits;


            let totalSalariosCalc = 0;
            allUnits.forEach(u => {
                const count = admParams.employees[u] || 0;
                let factor = 0;
                if (count > 0 && count <= 6) factor = 2;
                else if (count > 6 && count <= 14) factor = 4;
                else if (count >= 15) factor = 6;
                totalSalariosCalc += (factor * (admParams.minWage || 1518));
            });

            // NOVA REGRA DE NEGÓCIO: O rateio base para Concreteiras é 10% do Rateio Adm Geral
            const autoTargetValue = totalIndiretoGeral * 0.10;
            const despesasPot = Math.max(0, autoTargetValue - totalSalariosCalc - 20000);

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

                return { name: shortName, fullName: u, employees: admParams.employees[u] || 0, volume: vol, rateioFolha, rateioDespesas, total: rateioFolha + rateioDespesas };
            });
            table.sort((a, b) => b.volume - a.volume);
            noromixAdmData = { table, totalSalariosPot: totalSalariosCalc, totalDespesasPot: despesasPot + 20000, grandTotalVolume: volGlobalTotal, autoTargetValue };
        }

        // D. Rateio ADMINISTRATIVO Pedreiras e Portos (Novo)
        let noromixAdmPedreirasData = { table: [], totalSalariosPot: 0, totalDespesasPot: 0, basePedreiras: 0, basePortos: 0 };
        if (selectedSegment === 'Pedreiras e Portos de Areia') {
            const pedreirasUnits = BUSINESS_HIERARCHY["Pedreiras"];
            const portosUnits = BUSINESS_HIERARCHY["Portos de Areia"];

            const basePedreiras = totalIndiretoGeral * 0.285;
            const basePortos = totalIndiretoGeral * 0.015;

            // 2. Calcular Salários (Fatores)
            const calcSalarios = (units) => {
                let total = 0;
                units.forEach(u => {
                    const count = admParams.employees[u] || 0;
                    let factor = 0;
                    if (count > 0 && count <= 6) factor = 2;
                    else if (count > 6 && count <= 14) factor = 4;
                    else if (count >= 15) factor = 6;
                    total += (factor * (admParams.minWage || 1518));
                });
                return total;
            };

            const salariosPedreiras = calcSalarios(pedreirasUnits);
            const salariosPortos = calcSalarios(portosUnits);

            const sobraPedreiras = Math.max(0, basePedreiras - salariosPedreiras);
            const sobraPortos = Math.max(0, basePortos - salariosPortos);

            // 3. Montar Tabela
            const table = [];

            // Pedreiras (Regra % fixa)
            pedreirasUnits.forEach(u => {
                const count = admParams.employees[u] || 0;
                let factor = 0;
                if (count > 0 && count <= 6) factor = 2;
                else if (count > 6 && count <= 14) factor = 4;
                else if (count >= 15) factor = 6;

                const rateioFolha = factor * (admParams.minWage || 1518);
                let percC2 = 18;
                if (u.includes('Riolândia')) percC2 = 10;
                const rateioDespesas = sobraPedreiras * (percC2 / 100);

                table.push({
                    name: u.includes('-') ? u.split('-')[1].trim() : u,
                    fullName: u,
                    employees: count,
                    rateioFolha,
                    rateioDespesas,
                    total: rateioFolha + rateioDespesas,
                    type: 'Pedreira'
                });
            });

            // Portos (50% cada)
            portosUnits.forEach(u => {
                const count = admParams.employees[u] || 0;
                let factor = 0;
                if (count > 0 && count <= 6) factor = 2;
                else if (count > 6 && count <= 14) factor = 4;
                else if (count >= 15) factor = 6;

                const rateioFolha = factor * (admParams.minWage || 1518);
                const rateioDespesas = sobraPortos * 0.5;

                table.push({
                    name: u.includes('-') ? u.split('-')[1].trim() : u,
                    fullName: u,
                    employees: count,
                    rateioFolha,
                    rateioDespesas,
                    total: rateioFolha + rateioDespesas,
                    type: 'Porto'
                });
            });

            noromixAdmPedreirasData = {
                table,
                totalSalariosPot: salariosPedreiras + salariosPortos,
                totalDespesasPot: sobraPedreiras + sobraPortos,
                basePedreiras,
                basePortos
            };
        }

        const targetUnitsGenerico = [...BUSINESS_HIERARCHY["Pedreiras"], ...BUSINESS_HIERARCHY["Portos de Areia"], ...BUSINESS_HIERARCHY["Usinas de Asfalto"]];
        const activeUnits = targetUnitsGenerico.filter(unit => periodTxs.filter(t => t.type === 'metric' && t.metricType === 'producao' && t.segment === unit).reduce((acc, t) => acc + t.value, 0) > 0);

        return {
            totalAdm, itemsAdm, totalProd, itemsProd, totalVend2105, totalVend3105, totalVend5105, totalComercial, activeUnits,
            noromixComercialData, noromixTecnicoData, noromixVendedoresData, noromixAdmData, noromixAdmPedreirasData, noromix1046Data,
            totalComercialGen, itemsComercialGen, itemsVend, itemsLimpeza
        };
    }, [transactions, filter, selectedSegment, admParams, admTransactions]);

    // Handlers
    const handlePercChange = (key, subKey, val) => {
        let numVal = parseFloat(val); if (numVal < 0) numVal = 0; if (numVal > 100) numVal = 100;
        if (selectedSegment === 'Concreteiras e Fábrica de Tubos') setManualPercents(prev => ({ ...prev, [key]: numVal }));
        else setManualPercents(prev => ({ ...prev, [key]: { ...prev[key], [subKey]: numVal } }));
    };

    const handleAdmParamChange = (field, val, unit = null) => {
        if (unit) {
            let parsedVal = val;
            if (val !== '') {
                parsedVal = field === 'volumes' ? parseFloat(val) : parseInt(val);
                if (isNaN(parsedVal)) parsedVal = 0;
            }

            setAdmParams(prev => ({
                ...prev,
                [field]: { ...(prev[field] || {}), [unit]: parsedVal }
            }));
        } else {
            setAdmParams(prev => ({ ...prev, [field]: val }));
        }
    };

    const handleLimpezaParamChange = (field, val) => {
        setLimpezaParams(prev => ({ ...prev, [field]: val }));
    };

    // --- RENDERIZAÇÃO ---
    const renderContent = () => {
        if (['PERFURATRIZ'].includes(activeRateioType)) {
            return <div className="p-10 text-center text-slate-400 border border-dashed rounded-xl">Módulo em desenvolvimento.</div>;
        }

        switch (activeRateioType) {
            case 'ADMINISTRATIVO':
                return <AbaAdministrativo selectedSegment={selectedSegment} calculatedData={calculatedData} admParams={admParams} handleAdmParamChange={handleAdmParamChange} isLocked={isLocked} setIsLocked={setIsLocked} isSaving={isSaving} handleSaveAdmParams={handleSaveAdmParams} BUSINESS_HIERARCHY={BUSINESS_HIERARCHY} />;
            case 'ADM_SALARIOS':
                return <AbaAdmSalarios calculatedData={calculatedData} admParams={admParams} handleAdmParamChange={handleAdmParamChange} isLocked={isLocked} setIsLocked={setIsLocked} isSaving={isSaving} handleSaveAdmParams={handleSaveAdmParams} BUSINESS_HIERARCHY={BUSINESS_HIERARCHY} />;
            case 'PRODUCAO':
                return <AbaProducao calculatedData={calculatedData} />;
            case 'VENDEDORES':
                return <AbaVendedores selectedSegment={selectedSegment} calculatedData={calculatedData} manualPercents={manualPercents} handlePercChange={handlePercChange} isLockedVend={isLockedVend} setIsLockedVend={setIsLockedVend} isSavingVend={isSavingVend} handleSaveVendedores={handleSaveVendedores} VENDEDORES_MAP={VENDEDORES_MAP} BUSINESS_HIERARCHY={BUSINESS_HIERARCHY} />;
            case 'COMERCIAL':
            case 'TECNICO':
                return <AbaComercialTecnico selectedSegment={selectedSegment} activeRateioType={activeRateioType} calculatedData={calculatedData} />;
            case 'NOROMIX_1046':
                return <AbaNoromix1046 calculatedData={calculatedData} />;
            case 'LIMPEZA':
                return <AbaLimpeza calculatedData={calculatedData} limpezaParams={limpezaParams} handleLimpezaParamChange={handleLimpezaParamChange} isLockedLimpeza={isLockedLimpeza} setIsLockedLimpeza={setIsLockedLimpeza} isSavingLimpeza={isSavingLimpeza} handleSaveLimpeza={handleSaveLimpeza} BUSINESS_HIERARCHY={BUSINESS_HIERARCHY} />;
            default:
                return <div className="p-10 text-center text-slate-400">Selecione um tipo de rateio acima.</div>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-sm gap-4">
                <div className="flex items-center gap-2"><Share2 className="text-indigo-500" size={24} /><h3 className="font-bold text-lg dark:text-white">Painel de Rateios</h3></div>
                <div className="flex gap-2">
                    <PeriodSelector filter={filter} setFilter={setFilter} years={years} />
                    <select className="bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white outline-none focus:ring-2 ring-indigo-500" value={selectedSegment} onChange={(e) => { setSelectedSegment(e.target.value); setActiveRateioType('ADMINISTRATIVO'); }}>
                        {Object.keys(RATEIO_CONFIG).map(seg => <option key={seg} value={seg}>{seg}</option>)}
                    </select>
                </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
                {RATEIO_CONFIG[selectedSegment]?.map(type => (
                    <button key={type.id} onClick={() => setActiveRateioType(type.id)} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeRateioType === type.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border dark:border-slate-700 hover:bg-slate-50'}`}>
                        {type.label}
                    </button>
                ))}
            </div>
            {renderContent()}
        </div>
    );
};

export default RateioUnidadesCentral;
