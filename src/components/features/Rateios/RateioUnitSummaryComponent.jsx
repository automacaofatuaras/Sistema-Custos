import React, { useState, useEffect, useMemo } from 'react';
import { Share2, AlertCircle, RefreshCw } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, appId } from '../../../services/firebase';
import { BUSINESS_HIERARCHY } from '../../../constants/business';
import { fetchConsolidatedTransactions } from '../../../utils/rateioTransactions';
import { formatCurrency } from '../../../utils/formatters'; // Assuming formatCurrency exists or use toLocaleString

const RateioUnitSummaryComponent = ({ transactions = [], selectedUnit, filter, user = { email: 'admin@sistema.com' }, parentSegment }) => {
    const [loading, setLoading] = useState(true);
    const [admTransactions, setAdmTransactions] = useState([]);
    const [periodTxs, setPeriodTxs] = useState([]);
    const [allocations, setAllocations] = useState([]);

    // --- State to hold fetched configs for the period ---
    const [admParams, setAdmParams] = useState(null);
    const [manualPercents, setManualPercents] = useState({});
    const [limpezaParams, setLimpezaParams] = useState(null);

    const isNoromix = parentSegment === 'Concreteiras e Fábrica de Tubos';

    // Mapeamento Vendedores
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

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch transactions
                const txData = await fetchConsolidatedTransactions(user);

                // Filter transactions by the current period
                const periodTxs = txData.filter(t => {
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

                setAdmTransactions(periodTxs);

                const pTxs = transactions.filter(t => {
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
                setPeriodTxs(pTxs);

                // Fetch Configs
                const docIdAdm = isNoromix ? `rateio_adm_${filter.year}_${filter.month}` : `rateio_adm_pedreiras_${filter.year}_${filter.month}`;
                const docRefAdm = doc(db, 'artifacts', appId, 'rateio_adm_config', docIdAdm);
                const docSnapAdm = await getDoc(docRefAdm);

                if (docSnapAdm.exists()) {
                    setAdmParams(docSnapAdm.data());
                } else {
                    setAdmParams(null);
                }

                if (isNoromix) {
                    const docIdVend = `rateio_vendedores_${filter.year}_${filter.month}`;
                    const docRefVend = doc(db, 'artifacts', appId, 'rateio_vendedores_config', docIdVend);
                    const docSnapVend = await getDoc(docRefVend);
                    if (docSnapVend.exists()) {
                        setManualPercents(docSnapVend.data().percents || {});
                    } else {
                        setManualPercents({});
                    }
                } else {
                    const docIdVend = `rateio_vendedores_${filter.year}_${filter.month}`; // Same ID used centrally for all
                    const docRefVend = doc(db, 'artifacts', appId, 'rateio_vendedores_config', docIdVend);
                    const docSnapVend = await getDoc(docRefVend);
                    if (docSnapVend.exists()) {
                        setManualPercents(docSnapVend.data().percents || {});
                    } else {
                        setManualPercents({});
                    }
                }

                const docIdLimpeza = `rateio_limpeza_${filter.year}_${filter.month}`;
                const docRefLimpeza = doc(db, 'artifacts', appId, 'rateio_limpeza_config', docIdLimpeza);
                const docSnapLimpeza = await getDoc(docRefLimpeza);
                if (docSnapLimpeza.exists()) {
                    setLimpezaParams(docSnapLimpeza.data());
                } else {
                    setLimpezaParams(null);
                }

            } catch (error) {
                console.error("Error fetching rateio data:", error);
            } finally {
                setLoading(false);
            }
        };

        if (selectedUnit && parentSegment) {
            fetchData();
        }
    }, [selectedUnit, parentSegment, filter.month, filter.year, user?.email, transactions]);

    useEffect(() => {
        if (loading || !selectedUnit || !parentSegment) return;

        const sumCC = (codes, txs) => txs
            .filter(t => t.type === 'expense' && codes.includes(parseInt((t.costCenter || '').split(' ')[0])))
            .reduce((acc, t) => acc + (t.value || 0), 0);

        const sumAdmCC = (codes, txs) => txs
            .filter(t => codes.includes(parseInt((t.costCenter || '').split(' ')[0])))
            .reduce((acc, t) => acc + (t.value || 0), 0);

        const buildAllocations = () => {
            const results = [];

            // Re-fetch transactions for general (non-adm) calculations
            const generalTxs = periodTxs;

            // 1. RATEIO ADMINISTRATIVO
            const totalIndiretoGeral = admTransactions
                .filter(t => {
                    const seg = (t.segment || '').trim().toUpperCase();
                    return seg === 'GERAL' || seg === 'GERAL / ADMINISTRATIVO' || seg === 'ADMINISTRATIVO GERAL' || seg === 'ADMINISTRATIVO' || seg === 'INDIFERENTE';
                })
                .reduce((acc, t) => {
                    if (t.type?.toUpperCase() === 'DIRETO') return acc;
                    return acc + (t.value || 0);
                }, 0);

            if (isNoromix && admParams) {
                const concreteUnits = BUSINESS_HIERARCHY["Concreteiras"];
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

                let totalSalariosCalc = 0;
                allRateioUnits.forEach(u => {
                    const count = admParams.employees?.[u] || 0;
                    let factor = 0;
                    if (count > 0 && count <= 6) factor = 2;
                    else if (count > 6 && count <= 14) factor = 4;
                    else if (count >= 15) factor = 6;
                    totalSalariosCalc += (factor * (admParams.minWage || 1518));
                });

                const autoTargetValue = totalIndiretoGeral * 0.10;
                const despesasPot = Math.max(0, autoTargetValue - totalSalariosCalc - 20000);

                const vol = unitVolumes[selectedUnit] || 0;
                const isPipe = selectedUnit === pipeUnit;
                const rateioFolha = volGlobalTotal > 0 ? (totalSalariosCalc / volGlobalTotal) * vol : 0;

                let rateioDespesas = 0;
                if (isPipe) {
                    rateioDespesas = 20000;
                } else {
                    rateioDespesas = volConcretoTotal > 0 ? (vol / volConcretoTotal) * despesasPot : 0;
                }

                if (admParams.employees?.[selectedUnit] !== undefined) {
                    results.push({
                        title: 'Despesas Administrativas (Rateio 10%)',
                        description: 'Rateio base Folha e Despesas Potenciais',
                        value: rateioFolha + rateioDespesas,
                        details: `Produção: ${vol} m³ | Funcionários Ref: ${admParams.employees[selectedUnit] || 0}`
                    });
                }

            } else if (!isNoromix && admParams) {
                // Pedreiras e Portos Rateio Adm (1087 / 1089)
                const totalIndiretoGeralAdm = sumAdmCC([1087, 1089], generalTxs); // The 1087/1089 might be the base or the totalIndiretoGeral

                const basePedreiras = totalIndiretoGeral * 0.285;
                const basePortos = totalIndiretoGeral * 0.015;

                const pedreirasUnits = BUSINESS_HIERARCHY["Pedreiras"];
                const portosUnits = BUSINESS_HIERARCHY["Portos de Areia"];

                const calcSalarios = (units) => {
                    let total = 0;
                    units.forEach(u => {
                        const count = admParams.employees?.[u] || 0;
                        let factor = 0;
                        if (count > 0 && count <= 6) factor = 2;
                        else if (count > 6 && count <= 14) factor = 4;
                        else if (count >= 15) factor = 6;
                        total += (factor * (admParams.minWage || 1518));
                    });
                    return total;
                };

                const isPedreira = pedreirasUnits.includes(selectedUnit);
                const isPorto = portosUnits.includes(selectedUnit);

                if (isPedreira || isPorto) {
                    const salariosPedreiras = calcSalarios(pedreirasUnits);
                    const salariosPortos = calcSalarios(portosUnits);

                    const sobraPedreiras = Math.max(0, basePedreiras - salariosPedreiras);
                    const sobraPortos = Math.max(0, basePortos - salariosPortos);

                    const count = admParams.employees?.[selectedUnit] || 0;
                    let factor = 0;
                    if (count > 0 && count <= 6) factor = 2;
                    else if (count > 6 && count <= 14) factor = 4;
                    else if (count >= 15) factor = 6;

                    const rateioFolha = factor * (admParams.minWage || 1518);

                    let rateioDespesas = 0;
                    if (isPedreira) {
                        let percC2 = 18;
                        if (selectedUnit.includes('Riolândia')) percC2 = 10;
                        rateioDespesas = sobraPedreiras * (percC2 / 100);
                    } else if (isPorto) {
                        rateioDespesas = sobraPortos * 0.5;
                    }

                    results.push({
                        title: 'Despesas Administrativas (Faixa Salarial)',
                        description: 'Cálculo baseado no número de funcionários',
                        value: rateioFolha,
                        details: `Funcionários Ref: ${count}`
                    });

                    results.push({
                        title: isPedreira ? 'Despesas Administrativas (Rateio Fixo %)' : 'Despesas Administrativas (Rateio 50%)',
                        description: isPedreira ? 'Percentual fixo sobre a sobra administrativa' : 'Divisão de 50% da sobra entre portos',
                        value: rateioDespesas,
                        details: isPedreira ? (selectedUnit.includes('Riolândia') ? 'Alocação de 10%' : 'Alocação de 18%') : 'Divisão por 2'
                    });
                }
            }

            // 2. COMERCIAL e TÉCNICO NOROMIX
            if (isNoromix && admParams) {
                const segmentDiretoItems = admTransactions.filter(t => {
                    if (t.type?.toUpperCase() !== 'DIRETO') return false;
                    const seg = (t.segment || '').trim().toUpperCase();
                    return seg.includes('CONCRE') || seg.includes('FABRICA') || seg.includes('TUBOS');
                });
                const totalDiretoSegmento = segmentDiretoItems.reduce((acc, t) => acc + (t.value || 0), 0);
                const totalExp1105 = totalDiretoSegmento;
                const totalExp1075 = sumCC([1075], generalTxs);

                // We need volGlobalTotal again
                const concreteUnits = BUSINESS_HIERARCHY["Concreteiras"];
                const pipeUnit = BUSINESS_HIERARCHY["Fábrica de Tubos"][0];
                const allRateioUnits = [...concreteUnits, pipeUnit];
                let volGlobalTotal = 0;
                allRateioUnits.forEach(u => volGlobalTotal += Number(admParams.volumes?.[u] || 0));

                const vol = Number(admParams.volumes?.[selectedUnit] || 0);
                const percent = volGlobalTotal > 0 ? vol / volGlobalTotal : 0;

                if (totalExp1105 > 0) {
                    results.push({
                        title: 'Rateio Comercial (CC 1105)',
                        description: 'Rateio proporcional ao volume de produção/vendas',
                        value: totalExp1105 * percent,
                        details: `Peso da unidade: ${(percent * 100).toFixed(1)}%`
                    });
                }

                if (totalExp1075 > 0) {
                    results.push({
                        title: 'Rateio Departamento Técnico (CC 1075)',
                        description: 'Rateio proporcional ao volume de produção',
                        value: totalExp1075 * percent,
                        details: `Peso da unidade: ${(percent * 100).toFixed(1)}%`
                    });
                }
            }

            // 3. VENDEDORES NOROMIX
            if (isNoromix && Object.keys(manualPercents).length > 0) {
                // Find CC associated with selectedUnit
                const mapper = VENDEDORES_MAP.find(m => m.unit === selectedUnit);
                if (mapper) {
                    const vendorTxs = admTransactions.filter(t => t.type === 'expense' && parseInt((t.costCenter || '').split(' ')[0]) === mapper.cc);
                    const originalTotal = vendorTxs.reduce((acc, t) => acc + t.value, 0);
                    const percent = manualPercents[mapper.cc] ?? 100;
                    const val = originalTotal * (percent / 100);

                    if (val > 0) {
                        results.push({
                            title: 'Rateio Vendedores',
                            description: 'Despesas de venda exclusivas ou rateadas manualmente',
                            value: val,
                            details: `Percentual Aplicado: ${percent}% (Base: ${originalTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`
                        });
                    }
                }
            }

            // 4. NOROMIX 1046
            if (isNoromix) {
                const totalExp1046 = sumCC([1046], generalTxs);
                const targetUnits = [...BUSINESS_HIERARCHY["Concreteiras"], ...BUSINESS_HIERARCHY["Fábrica de Tubos"]];
                const shareValue = targetUnits.length > 0 ? totalExp1046 / targetUnits.length : 0;

                if (shareValue > 0) {
                    results.push({
                        title: 'Rateio Noromix (CC 1046)',
                        description: 'Rateio igualitário entre todas as unidades do grupo',
                        value: shareValue,
                        details: 'Divisão exata'
                    });
                }
            }

            if (limpezaParams && Object.keys(limpezaParams.employeeHours || {}).length > 0) {
                const unitHours = limpezaParams.employeeHours[selectedUnit] || 0;
                let totalH = 0;
                Object.values(limpezaParams.employeeHours).forEach(v => totalH += Number(v));
                const totalLimpezaExp = sumCC([1121], generalTxs);

                if (unitHours > 0 && totalH > 0) {
                    const share = totalLimpezaExp * (unitHours / totalH);
                    results.push({
                        title: 'Rateio Limpeza (CC 1121)',
                        description: 'Rateio baseado em Horas Trabalhadas na unidade',
                        value: share,
                        details: `${unitHours} horas alocadas`
                    });
                }
            }

            // --- ALLOCATIONS FOR NON-NOROMIX (PEDREIRAS, PORTOS, USINAS) ---
            if (!isNoromix) {
                const isPedreira = BUSINESS_HIERARCHY["Pedreiras"].includes(selectedUnit);
                const isUsina = (BUSINESS_HIERARCHY["Usinas de Asfalto"] || []).includes(selectedUnit);
                const isPorto = BUSINESS_HIERARCHY["Portos de Areia"].includes(selectedUnit);

                // Rateio Administrativo Principal (CC 1087 / 1089)
                if (isPedreira || isPorto) {
                    const totalAdm = sumAdmCC([1087, 1089], admTransactions);
                    results.unshift({
                        title: 'Rateio Administrativo',
                        description: 'Total Despesas (CC 1087/1089)',
                        value: totalAdm / 8,
                        details: 'Distribuição Igualitária (1/8)'
                    });
                }

                // A. Encarregado de Produção (1042 Portos / 1043 Pedreiras e Usinas)
                if (isPorto) {
                    const total1042 = sumCC([1042], generalTxs);
                    const listPortos = BUSINESS_HIERARCHY["Portos de Areia"];
                    const share = listPortos.length > 0 ? total1042 / listPortos.length : 0;
                    results.push({
                        title: 'Encarregado de Produção (CC 1042)',
                        description: 'Rateio igualitário para Portos',
                        value: share,
                        details: `Divisão por ${listPortos.length}`
                    });
                } else if (isPedreira || isUsina) {
                    const total1043 = sumCC([1043], generalTxs);
                    const listPedreirasUsinas = [...BUSINESS_HIERARCHY["Pedreiras"], ...(BUSINESS_HIERARCHY["Usinas de Asfalto"] || [])];
                    const share = listPedreirasUsinas.length > 0 ? total1043 / listPedreirasUsinas.length : 0;
                    results.push({
                        title: 'Encarregado de Produção (CC 1043)',
                        description: 'Rateio igualitário para Pedreiras e Usinas',
                        value: share,
                        details: `Divisão por ${listPedreirasUsinas.length}`
                    });
                }

                // B. Comercial (CC 1104) -> Dividido por 14
                const total1104 = sumAdmCC([1104], admTransactions);
                const share1104 = total1104 / 14;
                results.push({
                    title: 'Rateio Comercial (CC 1104)',
                    description: 'Despesa Administrativa Comercial',
                    value: share1104,
                    details: 'Fração fixa de 1/14'
                });

                // C. Vendedores (2105, 3105, 5105)
                const total2105 = sumCC([2105, 20105], generalTxs);
                const total3105 = sumCC([3105], generalTxs);
                const total5105 = sumCC([5105], generalTxs);

                const p2105 = manualPercents[selectedUnit]?.['2105'] || 0;
                const p3105 = manualPercents[selectedUnit]?.['3105'] || 0;
                const p5105 = manualPercents[selectedUnit]?.['5105'] || 0;

                const vendShare = (total2105 * (p2105 / 100)) + (total3105 * (p3105 / 100)) + (total5105 * (p5105 / 100));

                results.push({
                    title: 'Rateio Vendedores (2105, 3105, 5105)',
                    description: 'Despesa alocada proporcionalmente via config manual (%)',
                    value: vendShare,
                    details: `Carga: 2105 (${p2105}%) | 3105 (${p3105}%) | 5105 (${p5105}%)`
                });
            }

            setAllocations(results);
        };

        buildAllocations();
    }, [admTransactions, periodTxs, selectedUnit, parentSegment, admParams, manualPercents, limpezaParams, loading]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700">
                <RefreshCw className="animate-spin text-indigo-500 mr-3" size={24} />
                <span className="text-slate-500 font-medium">Calculando Rateios da Unidade...</span>
            </div>
        );
    }

    if (allocations.length === 0 && (!admParams || Object.keys(admParams).length === 0) && isNoromix) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border dark:border-slate-700 p-10 text-center">
                <div className="flex justify-center mb-4">
                    <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-full">
                        <AlertCircle className="text-slate-400" size={32} />
                    </div>
                </div>
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">Aguardando Parâmetros</h3>
                <p className="text-slate-500">
                    Os parâmetros mensais do Rateio de Concreteiras (funcionários, volumes) ainda não foram definidos para esta competência.
                </p>
            </div>
        );
    }

    const totalAllocated = allocations.reduce((acc, curr) => acc + curr.value, 0);

    return (
        <div className="space-y-6">
            <div className="bg-indigo-600 rounded-2xl p-6 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-white">
                <div>
                    <h2 className="text-2xl font-black mb-1 flex items-center gap-2">
                        <Share2 className="text-indigo-200" /> Total Rateado: {selectedUnit}
                    </h2>
                    <p className="text-indigo-200 text-sm">Competência: {String(filter.month + 1).padStart(2, '0')}/{filter.year}</p>
                </div>
                <div className="text-3xl font-black">
                    {totalAllocated.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allocations.map((alloc, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border dark:border-slate-700 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-slate-800 dark:text-white pr-4">{alloc.title}</h3>
                            <div className="p-2 bg-indigo-50 dark:bg-slate-700 rounded-lg text-indigo-600 dark:text-indigo-400">
                                <Share2 size={16} />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-700 dark:text-slate-200 mb-2">
                            {alloc.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">
                            {alloc.description}
                        </p>
                        <div className="text-[10px] font-mono bg-slate-50 dark:bg-slate-900 px-2 py-1.5 rounded text-slate-500 uppercase tracking-wider">
                            {alloc.details}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RateioUnitSummaryComponent;
