import { BUSINESS_HIERARCHY, SEGMENT_CONFIG } from '../constants/business';
import { COST_CENTER_RULES } from '../constants/costCenterRules';

export const getMeasureUnit = (unitOrSegment) => {
    if (SEGMENT_CONFIG[unitOrSegment]) return SEGMENT_CONFIG[unitOrSegment];
    for (const [segment, units] of Object.entries(BUSINESS_HIERARCHY)) {
        if (units.includes(unitOrSegment)) return SEGMENT_CONFIG[segment];
    }
    return "un";
};

export const getParentSegment = (unitName) => {
    for (const [segment, units] of Object.entries(BUSINESS_HIERARCHY)) {
        if (units.includes(unitName) || unitName.includes(segment)) return segment;
    }
    return "Geral";
};

export const getUnitByCostCenter = (ccCode) => {
    const cc = parseInt(ccCode, 10);
    if (isNaN(cc)) return null;

    if (cc >= 13000 && cc <= 13999) return "Porto de Areia Saara - Mira Estrela";
    if (cc >= 14000 && cc <= 14999) return "Porto Agua Amarela - Riolândia";
    if (cc >= 28000 && cc <= 28999) return "Noromix Concreto S/A - Andradina";
    if (cc >= 27000 && cc <= 27999) return "Noromix Concreto S/A - Fernandópolis";
    if (cc >= 22000 && cc <= 22999) return "Noromix Concreto S/A - Ilha Solteira";
    if (cc >= 25000 && cc <= 25999) return "Noromix Concreto S/A - Jales";
    if (cc >= 33000 && cc <= 33999) return "Noromix Concreto S/A - Ouroeste";
    if (cc >= 38000 && cc <= 38999) return "Noromix Concreto S/A - Paranaíba";
    if (cc >= 34000 && cc <= 34999) return "Noromix Concreto S/A - Monções";
    if (cc >= 29000 && cc <= 29999) return "Noromix Concreto S/A - Pereira Barreto";
    if (cc >= 9000 && cc <= 9999) return "Noromix Concreto S/A - Três Fronteiras";
    if (cc >= 8000 && cc <= 8999) return "Noromix Concreto S/A - Votuporanga";
    if (cc >= 10000 && cc <= 10999) return "Fábrica de Tubos: Noromix Concreto S/A - Votuporanga (Fábrica)";
    if (cc >= 20000 && cc <= 20999) return "Mineração Grandes Lagos - Icém";
    if (cc >= 5000 && cc <= 5999) return "Mineração Grandes Lagos - Itapura";
    if (cc >= 4000 && cc <= 4999) return "Mineração Grandes Lagos - Riolândia";
    if (cc >= 3000 && cc <= 3999) return "Mineração Grandes Lagos - Três Fronteiras";
    if (cc >= 26000 && cc <= 26999) return "Noromix Concreto S/A - Rinópolis";
    if (cc >= 2000 && cc <= 2999) return "Mineração Noroeste Paulista - Monções";
    if (cc >= 32000 && cc <= 32999) return "Noromix Concreto S/A - Assis";
    if (cc >= 6000 && cc <= 6999) return "Noromix Concreto S/A - Monções (Usina)";
    if (cc >= 17000 && cc <= 17999) return "Noromix Concreto S/A - Itapura (Usina)";
    if (cc >= 31000 && cc <= 31999) return "Noromix Concreto S/A - Rinópolis (Usina)";
    if (cc >= 7000 && cc <= 7999) return "Demop Participações LTDA - Três Fronteiras";
    if (cc >= 21000 && cc <= 21999) return "Mineração Grandes Lagos - Icém (Usina)";
    if (cc >= 40000 && cc <= 94999 && cc !== 94901) return "Noromix Construtora";
    return null;
};

export const getTransactionDreCategory = (t, selectedUnit = null) => {
    const parentSeg = selectedUnit ? getParentSegment(selectedUnit) || "Geral" : "Geral";
    const rules = COST_CENTER_RULES[parentSeg];

    const isInRuleGroup = (t, groupName, subGroupName = null) => {
        if (!rules || !rules[groupName]) return false;
        const ccCode = t.costCenter ? parseInt(t.costCenter.split(' ')[0]) : 0;
        if (subGroupName) {
            return rules[groupName][subGroupName]?.includes(ccCode);
        }
        return Object.values(rules[groupName]).flat().includes(ccCode);
    };

    if (t.type === 'revenue') {
        const isRecMaterial = t.description?.toLowerCase().includes('retira') || t.description?.toLowerCase().includes('entrega') || t.accountPlan === '01.01';
        if (isRecMaterial) return 'Venda de Materiais';

        const isRecFrete = t.description?.toLowerCase().includes('frete');
        if (isRecFrete) return 'Receita de Fretes';

        const isSubsidio = t.description?.toLowerCase().includes('subsídio');
        if (isSubsidio) return 'Outras Receitas / Subsídios';

        return 'Outras Receitas / Receita Bruta';
    }

    if (t.type === 'expense') {
        const isDespUnidade = isInRuleGroup(t, 'DESPESAS DA UNIDADE');
        if (isDespUnidade) return 'Custo Operacional';

        const custoMaquinasEquipamentosCCs = [13001, 13004, 13006, 13030, 13031, 13032, 13079, 13121, 14002, 14006, 14030, 14031, 14032, 35082, 35350, 35519];
        const isMaquina = t.costCenter && custoMaquinasEquipamentosCCs.includes(parseInt(t.costCenter.split(' ')[0]));
        if (isMaquina) return 'Custo Máquinas e Equipamentos';

        const isTransporteGroup = isInRuleGroup(t, 'TRANSPORTE');
        if (isTransporteGroup) {
            const isCombustivel = t.description?.toLowerCase().includes('combustivel') || t.description?.toLowerCase().includes('diesel') || t.accountPlan === '03.07.01';
            if (isCombustivel) return 'Combustíveis e Lubrificantes (Transporte)';
            const isManutencao = t.accountPlan?.startsWith('03.05');
            if (isManutencao) return 'Manutenção Frota (Transporte)';
            return 'Outras Despesas Frota (Transporte)';
        }

        const isTranspTerc = t.description?.toLowerCase().includes('transporte terceiros');
        if (isTranspTerc) return 'Fretes Terceiros (Transporte)';

        const isFrota = t.description?.toLowerCase().includes('frota parada');
        if (isFrota) return 'Custo Frota Parada (Transporte)';

        const isRateioAdm = t.isRateio || t.description?.toLowerCase().includes('rateio despesas') || isInRuleGroup(t, 'ADMINISTRATIVO');
        if (isRateioAdm) return 'Rateio Administrativo Central';

        const isMulta = t.description?.toLowerCase().includes('multa') || t.description?.toLowerCase().includes('taxa');
        if (isMulta) return 'Multas e Taxas';

        const isImposto = t.accountPlan?.startsWith('02') || t.description?.toLowerCase().includes('imposto') || t.accountPlan === '02.01';
        if (isImposto) return 'Total de Impostos';

        const isInvestimento = t.accountPlan?.startsWith('06') || t.description?.toLowerCase().includes('consórcio') || t.description?.toLowerCase().includes('investimento');
        if (isInvestimento) return 'Investimentos E Consórcios';

        return 'Outras Despesas';
    }

    return 'Nenhum / Desconhecido';
};
