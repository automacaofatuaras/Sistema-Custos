import supabase from './supabaseClient';
import { BUSINESS_HIERARCHY } from '../constants/business';

// Utility to normalize string (remove accents, to lowercase)
const normalize = (str) => {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

// Tenta encontrar a unidade oficial do sistema através do nome da localização vinda do Supabase
const findExactSystemUnit = (locationName) => {
    if (!locationName) return null;
    const normalizedLoc = normalize(locationName);
    const allUnits = Object.values(BUSINESS_HIERARCHY).flat();

    // 1. Exact match on normalized
    let match = allUnits.find(unit => normalize(unit) === normalizedLoc);
    if (match) return match;

    // 2. Contains match (e.g. "Porto MAA - Riolandia" -> might contain "Riolândia")
    // This is simple so we just check if one includes the other.
    match = allUnits.find(unit => normalize(unit).includes(normalizedLoc) || normalizedLoc.includes(normalize(unit)));
    if (match) return match;

    return locationName; // Fallback to whatever string came string
};

export const fetchFleetCostsFromSupabase = async (month, year, unitFilter = null) => {
    if (!supabase) {
        throw new Error("Cliente Supabase não configurado.");
    }

    try {
        let query = supabase
            .from('integracao_custos_frotas')
            .select('*')
            .eq('mes', month)
            .eq('ano', year);

        // Se houver um filtro de unidade, podemos tentar filtrar no Supabase
        // ou buscar tudo e filtrar no JS para garantir o mapeamento De/Para.
        // Como o mapeamento é flexível, buscar tudo e filtrar no JS é mais resiliente.
        const { data, error } = await query;

        if (error) {
            console.error("Erro ao buscar dados do Supabase:", error);
            throw error;
        }

        if (!data || data.length === 0) {
            return [];
        }

        const transactions = [];
        let idCounter = 1;

        data.forEach(row => {
            // Se ambos forem zero ou não existirem, ignora
            const valFuel = parseFloat(row.valor_combustivel) || 0;
            const valMaint = parseFloat(row.valor_manutencao) || 0;

            if (valFuel === 0 && valMaint === 0) return;

            // Date construction: Let's assume the 15th of the month at 12:00
            const isoDate = `${year}-${String(month).padStart(2, '0')}-15T12:00:00`;
            const mappedSegment = findExactSystemUnit(row.localizacao);

            // Filtro por Unidade Selecionada (se houver)
            if (unitFilter) {
                const normalizedFilter = normalize(unitFilter);
                const normalizedMapped = normalize(mappedSegment);
                const normalizedRowSegment = normalize(row.segmento);

                // Se não bater nem com a localização mapeada nem com o segmento bruto do Supabase, pula
                if (!normalizedMapped.includes(normalizedFilter) && 
                    !normalizedFilter.includes(normalizedMapped) &&
                    !normalizedRowSegment.includes(normalizedFilter) &&
                    !normalizedFilter.includes(normalizedRowSegment)) {
                    return;
                }
            }

            const ccStr = row.frota ? `${row.frota} - Frota` : '0 - Sem Centro de Custo';

            // Base object
            const baseTx = {
                date: isoDate,
                segment: mappedSegment,
                costCenter: ccStr,
                costCenterCode: row.frota || '0',
                type: 'expense',
                source: 'automatic_import',
                createdAt: new Date().toISOString(),
                importBatchId: `Supabase_${month}_${year}`
            };

            // Create Combustível Transaction
            if (valFuel > 0) {
                transactions.push({
                    ...baseTx,
                    id: `sup_${idCounter++}`,
                    accountPlan: '03.02.01.02.0001', // COMBUSTIVEL
                    planDescription: 'COMBUSTIVEL',
                    description: `Combustível - ${row.frota} - ${row.tipo}`,
                    materialDescription: `Ref: ${row.segmento} / Lançamento via Supabase`,
                    value: valFuel,
                    quantity: 1
                });
            }

            // Create Manutenção Transaction
            if (valMaint > 0) {
                transactions.push({
                    ...baseTx,
                    id: `sup_${idCounter++}`,
                    accountPlan: '03.05.01.01.0001', // MANUT. MAQUINAS E EQUIPAMENTOS
                    planDescription: 'MANUT. MAQUINAS E EQUIPAMENTOS',
                    description: `Manutenção - ${row.frota} - ${row.tipo}`,
                    materialDescription: `Ref: ${row.segmento} / Lançamento via Supabase`,
                    value: valMaint,
                    quantity: 1
                });
            }
        });

        return transactions;
    } catch (err) {
        throw err;
    }
};
