import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, appId } from '../services/firebase';
import { BUSINESS_HIERARCHY } from '../constants/business';
import { fetchConsolidatedTransactions } from '../utils/rateioTransactions';

export const useUnitRateios = (selectedUnit, parentSegment, filter, transactions, user) => {
    const [rateioTransactions, setRateioTransactions] = useState([]);
    const [loadingRateios, setLoadingRateios] = useState(false);

    useEffect(() => {
        const fetchAndCalculateRateios = async () => {
            // Updated condition: allow null selectedUnit if parentSegment is provided
            if (!parentSegment || !filter || !transactions) {
                setRateioTransactions([]);
                return;
            }

            setLoadingRateios(true);

            try {
                const isNoromix = parentSegment === 'Concreteiras e Fábrica de Tubos';
                const targetUnits = selectedUnit ? [selectedUnit] : (BUSINESS_HIERARCHY[parentSegment] || []);

                if (targetUnits.length === 0) {
                    setRateioTransactions([]);
                    return;
                }

                // --- SETUP DATE & FILTER TXS ---
                const periodTxs = transactions.filter(t => {
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

                // Fetch proper administrative transactions
                const txData = await fetchConsolidatedTransactions(user);
                const admTransactions = txData.filter(t => {
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

                // Helper to format date for synthetic transactions (YYYY-MM-DD or similar)
                const syntheticDate = `${filter.year}-${String(filter.month + 1).padStart(2, '0')}-02T12:00:00`;

                // --- FETCH CONFIGS ---
                let admParams = null;
                let manualPercents = {};
                let limpezaParams = null;

                const docIdAdm = isNoromix ? `rateio_adm_${filter.year}_${filter.month}` : `rateio_adm_pedreiras_${filter.year}_${filter.month}`;
                const docRefAdm = doc(db, 'artifacts', appId, 'rateio_adm_config', docIdAdm);
                const docSnapAdm = await getDoc(docRefAdm);
                if (docSnapAdm.exists()) admParams = docSnapAdm.data();

                const docIdVend = `rateio_vendedores_${filter.year}_${filter.month}`;
                const docRefVend = doc(db, 'artifacts', appId, 'rateio_vendedores_config', docIdVend);
                const docSnapVend = await getDoc(docRefVend);
                if (docSnapVend.exists()) manualPercents = docSnapVend.data().percents || {};

                const docIdLimpeza = `rateio_limpeza_${filter.year}_${filter.month}`;
                const docRefLimpeza = doc(db, 'artifacts', appId, 'rateio_limpeza_config', docIdLimpeza);
                const docSnapLimpeza = await getDoc(docRefLimpeza);
                if (docSnapLimpeza.exists()) limpezaParams = docSnapLimpeza.data();

                // --- CALCULATE ---
                const results = [];
                let synthIdCounter = 1;

                const pushSyntheticTx = (targetUnit, title, value, description) => {
                    const absValue = Math.abs(value);
                    if (absValue === 0) return;
                    results.push({
                        id: `synth-rateio-${Date.now()}-${synthIdCounter++}`,
                        date: syntheticDate,
                        type: 'expense',
                        value: absValue,
                        description: description ? `${title} (${description})` : title,
                        planDescription: 'RATEIO ADMINISTRATIVO - ' + title.toUpperCase(),
                        costCenter: 'CC Virtual Rateio',
                        segment: targetUnit,
                        isRateio: true
                    });
                };

                const sumCC = (codes, txs) => txs
                    .filter(t => t.type === 'expense' && codes.includes(parseInt((t.costCenter || '').split(' ')[0])))
                    .reduce((acc, t) => acc + (t.value || 0), 0);

                const sumAdmCC = (codes, txs) => txs
                    .filter(t => codes.includes(parseInt((t.costCenter || '').split(' ')[0])))
                    .reduce((acc, t) => acc + (t.value || 0), 0);

                const generalTxs = periodTxs;

                // Loop through units to calculate unit-specific rateios
                for (const currentUnit of targetUnits) {
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

                        let volGlobalTotal = 0;
                        const unitVolumes = {};

                        allRateioUnits.forEach(u => {
                            const vol = Number(admParams.volumes?.[u] || 0);
                            unitVolumes[u] = vol;
                            volGlobalTotal += vol;
                        });

                        const vol = unitVolumes[currentUnit] || 0;
                        const isPipe = currentUnit === pipeUnit;

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

                        const rateioFolha = volGlobalTotal > 0 ? (totalSalariosCalc / volGlobalTotal) * vol : 0;

                        let rateioDespesas = 0;
                        if (isPipe) {
                            rateioDespesas = 20000;
                        } else {
                            const volConcretoTotal = allRateioUnits.filter(u => u !== pipeUnit).reduce((acc, u) => acc + (unitVolumes[u] || 0), 0);
                            rateioDespesas = volConcretoTotal > 0 ? (vol / volConcretoTotal) * despesasPot : 0;
                        }

                        if (admParams.employees?.[currentUnit] !== undefined) {
                            pushSyntheticTx(currentUnit, 'Despesas Administrativas (Rateio 10%)', rateioFolha + rateioDespesas, `Produção: ${vol} m³ | Funcionários Ref: ${admParams.employees[currentUnit] || 0}`, '1087');
                        }
                    } else if (!isNoromix && admParams) {
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

                        const isPedreira = pedreirasUnits.includes(currentUnit);
                        const isPorto = portosUnits.includes(currentUnit);

                        if (isPedreira || isPorto) {
                            const salariosPedreiras = calcSalarios(pedreirasUnits);
                            const salariosPortos = calcSalarios(portosUnits);

                            const sobraPedreiras = Math.max(0, basePedreiras - salariosPedreiras);
                            const sobraPortos = Math.max(0, basePortos - salariosPortos);

                            const count = admParams.employees?.[currentUnit] || 0;
                            let factor = 0;
                            if (count > 0 && count <= 6) factor = 2;
                            else if (count > 6 && count <= 14) factor = 4;
                            else if (count >= 15) factor = 6;

                            const rateioFolha = factor * (admParams.minWage || 1518);

                            let rateioDespesas = 0;
                            if (isPedreira) {
                                let percC2 = 18;
                                if (currentUnit.includes('Riolândia')) percC2 = 10;
                                rateioDespesas = sobraPedreiras * (percC2 / 100);
                            } else if (isPorto) {
                                rateioDespesas = sobraPortos * 0.5;
                            }

                            pushSyntheticTx(currentUnit, 'Despesas Administrativas (Faixa Salarial)', rateioFolha, `Funcionários Ref: ${count}`, '1087');
                            pushSyntheticTx(currentUnit, isPedreira ? 'Despesas Administrativas (Rateio Fixo %)' : 'Despesas Administrativas (Rateio 50%)', rateioDespesas, isPedreira ? (currentUnit.includes('Riolândia') ? 'Alocação de 10%' : 'Alocação de 18%') : 'Divisão por 2', '1089');
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

                        const concreteUnits = BUSINESS_HIERARCHY["Concreteiras"];
                        const pipeUnit = BUSINESS_HIERARCHY["Fábrica de Tubos"][0];
                        const allRateioUnits = [...concreteUnits, pipeUnit];
                        let volGlobalTotal = 0;
                        allRateioUnits.forEach(u => volGlobalTotal += Number(admParams.volumes?.[u] || 0));

                        const vol = Number(admParams.volumes?.[currentUnit] || 0);
                        const percent = volGlobalTotal > 0 ? vol / volGlobalTotal : 0;

                        if (totalExp1105 > 0) {
                            pushSyntheticTx(currentUnit, 'Rateio Comercial (CC 1105)', totalExp1105 * percent, `Peso da unidade: ${(percent * 100).toFixed(1)}%`, '1105');
                        }

                        if (totalExp1075 > 0) {
                            pushSyntheticTx(currentUnit, 'Rateio Departamento Técnico (CC 1075)', totalExp1075 * percent, `Peso da unidade: ${(percent * 100).toFixed(1)}%`, '1075');
                        }
                    }

                    // 3. VENDEDORES NOROMIX
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

                    if (isNoromix && Object.keys(manualPercents).length > 0) {
                        const mapper = VENDEDORES_MAP.find(m => m.unit === currentUnit);
                        if (mapper) {
                            let baseValue = 0;
                            let label = `Percentual Aplicado: ${manualPercents[mapper.cc] ?? 100}%`;

                            if (mapper.cc === 22003) {
                                const ownTxs = admTransactions.filter(t => t.type === 'expense' && parseInt((t.costCenter || '').split(' ')[0]) === 22003);
                                const ownTotal = ownTxs.reduce((acc, t) => acc + t.value, 0);

                                const pbTxs = admTransactions.filter(t => t.type === 'expense' && parseInt((t.costCenter || '').split(' ')[0]) === 29003);
                                const pbTotal = pbTxs.reduce((acc, t) => acc + t.value, 0);

                                const percent = manualPercents[22003] ?? 100;
                                baseValue = (ownTotal + (pbTotal * 0.5)) * (percent / 100);
                                if (pbTotal > 0) label += ` (+ 50% do CC 29003)`;
                            } else if (mapper.cc === 29003) {
                                const pbTxs = admTransactions.filter(t => t.type === 'expense' && parseInt((t.costCenter || '').split(' ')[0]) === 29003);
                                const pbTotal = pbTxs.reduce((acc, t) => acc + t.value, 0);

                                const percent = manualPercents[29003] ?? 100;
                                baseValue = (pbTotal * 0.5) * (percent / 100);
                                label += ` (Redução de 50% p/ CC 22003)`;
                            } else {
                                const vendorTxs = admTransactions.filter(t => t.type === 'expense' && parseInt((t.costCenter || '').split(' ')[0]) === mapper.cc);
                                const originalTotal = vendorTxs.reduce((acc, t) => acc + t.value, 0);
                                const percent = manualPercents[mapper.cc] ?? 100;
                                baseValue = originalTotal * (percent / 100);
                            }

                            if (baseValue > 0) pushSyntheticTx(currentUnit, 'Rateio Vendedores', baseValue, label, mapper.cc);
                        }
                    }

                    // 4. NOROMIX 1046
                    if (isNoromix) {
                        const totalExp1046 = sumCC([1046], generalTxs);
                        const targetUnitsList = [...BUSINESS_HIERARCHY["Concreteiras"], ...BUSINESS_HIERARCHY["Fábrica de Tubos"]];
                        const shareValue = targetUnitsList.length > 0 ? totalExp1046 / targetUnitsList.length : 0;

                        if (shareValue > 0) pushSyntheticTx(currentUnit, 'Rateio Noromix (CC 1046)', shareValue, 'Divisão exata', '1046');
                    }

                    if (limpezaParams && Object.keys(limpezaParams.employeeHours || {}).length > 0) {
                        const unitHours = limpezaParams.employeeHours[currentUnit] || 0;
                        let totalH = 0;
                        Object.values(limpezaParams.employeeHours).forEach(v => totalH += Number(v));
                        const totalLimpezaExp = sumCC([1121], generalTxs);

                        if (unitHours > 0 && totalH > 0) {
                            const share = totalLimpezaExp * (unitHours / totalH);
                            pushSyntheticTx(currentUnit, 'Rateio Limpeza (CC 1121)', share, `${unitHours} horas alocadas`, '1121');
                        }
                    }

                    // --- NON-NOROMIX ---
                    if (!isNoromix) {
                        const isPedreira = (BUSINESS_HIERARCHY["Pedreiras"] || []).includes(currentUnit);
                        const isUsina = (BUSINESS_HIERARCHY["Usinas de Asfalto"] || []).includes(currentUnit);
                        const isPorto = (BUSINESS_HIERARCHY["Portos de Areia"] || []).includes(currentUnit);

                        if (isPedreira || isPorto) {
                            const totalAdm = sumAdmCC([1087, 1089], admTransactions);
                            pushSyntheticTx(currentUnit, 'Rateio Administrativo', totalAdm / 8, 'Distribuição Igualitária (1/8)', '1087');
                        }

                        const usinasList = BUSINESS_HIERARCHY["Usinas de Asfalto"] || [];
                        const activeUsinasCount = usinasList.filter(u => periodTxs.some(t => t.type === 'metric' && t.metricType === 'producao' && t.segment === u && (t.value || 0) > 0)).length;
                        const divisorDynamic = 6 + 2 + activeUsinasCount;

                        if (isPorto) {
                            const total1042 = sumCC([1042], generalTxs);
                            const listPortos = BUSINESS_HIERARCHY["Portos de Areia"];
                            const share1042 = listPortos.length > 0 ? total1042 / listPortos.length : 0;

                            const total1043 = sumCC([1043], generalTxs);
                            const share1043 = divisorDynamic > 0 ? total1043 / divisorDynamic : 0;

                            pushSyntheticTx(currentUnit, 'Encarregado de Produção (CC 1042)', share1042, `Divisão por ${listPortos.length}`, '1042');
                            pushSyntheticTx(currentUnit, 'Encarregado de Produção (CC 1043)', share1043, `Fração fixa de 1/${divisorDynamic}`, '1043');
                        } else if (isPedreira || isUsina) {
                            const total1043 = sumCC([1043], generalTxs);
                            const share1043 = divisorDynamic > 0 ? total1043 / divisorDynamic : 0;

                            if (isUsina) {
                                const hasProduction = periodTxs.some(t => t.type === 'metric' && t.metricType === 'producao' && t.segment === currentUnit && (t.value || 0) > 0);
                                if (hasProduction) {
                                    pushSyntheticTx(currentUnit, 'Encarregado de Produção (CC 1043)', share1043, `Fração fixa de 1/${divisorDynamic} (Com Produção)`, '1043');
                                }
                            } else {
                                pushSyntheticTx(currentUnit, 'Encarregado de Produção (CC 1043)', share1043, `Fração fixa de 1/${divisorDynamic}`, '1043');
                            }
                        }

                        const total1104 = sumAdmCC([1104], admTransactions);
                        if (isPorto || isPedreira || (isUsina && periodTxs.some(t => t.type === 'metric' && t.metricType === 'producao' && t.segment === currentUnit && (t.value || 0) > 0))) {
                            pushSyntheticTx(currentUnit, 'Comercial (CC 1104)', total1104 / divisorDynamic, `Rateio igualitário (1/${divisorDynamic})`, '1104');
                        }
                        const total2105 = sumCC([2105, 20105], generalTxs);
                        const total3105 = sumCC([3105], generalTxs);
                        const total5105 = sumCC([5105], generalTxs);

                        const p2105 = manualPercents[currentUnit]?.['2105'] || 0;
                        const p3105 = manualPercents[currentUnit]?.['3105'] || 0;
                        const p5105 = manualPercents[currentUnit]?.['5105'] || 0;

                        const vendShare = (total2105 * (p2105 / 100)) + (total3105 * (p3105 / 100)) + (total5105 * (p5105 / 100));

                        pushSyntheticTx(currentUnit, 'Rateio Vendedores (2105, 3105, 5105)', vendShare, `Carga: 2105 (${p2105}%) | 3105 (${p3105}%) | 5105 (${p5105}%)`, isPorto ? '14103' : '2105');
                    }
                }

                setRateioTransactions(results);

            } catch (err) {
                console.error("Error calculating rateios synthetics", err);
                setRateioTransactions([]);
            } finally {
                setLoadingRateios(false);
            }
        };

        fetchAndCalculateRateios();
    }, [selectedUnit, parentSegment, filter.month, filter.year, filter.type, transactions, user]);

    return { rateioTransactions, loadingRateios };
};
