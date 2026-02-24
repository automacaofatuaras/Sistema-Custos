import dbService from '../services/dbService';

export async function fetchConsolidatedTransactions(user) {
    try {
        // 1. Fetch official/imported transactions
        const officialTransactions = await dbService.getAll(user, 'rateio_adm_transactions') || [];

        // 2. Fetch manual transactions
        const manualTransactions = await dbService.getAll(user, 'rateio_transactions') || [];

        if (manualTransactions.length === 0) {
            return officialTransactions;
        }

        // 3. Fetch Master Data for CCs to enrich manual transactions
        const diretos = await dbService.getAll(user, 'rateio_adm_cc_diretos') || [];
        const indiretos = await dbService.getAll(user, 'rateio_adm_cc_indiretos') || [];

        // Create lookup maps for quick access
        const ccLookup = {};

        diretos.forEach(cc => {
            if (cc.code) {
                ccLookup[cc.code] = {
                    type: 'Direto',
                    segment: cc.segment || 'Outros'
                };
            }
        });

        indiretos.forEach(cc => {
            if (cc.code) {
                ccLookup[cc.code] = {
                    type: 'Indireto',
                    segment: 'Geral' // Cadastros indiretos não definem segmento
                };
            }
        });

        // 4. Enrich manual transactions
        const enrichedManualTransactions = manualTransactions.map(t => {
            const ccData = ccLookup[t.costCenter] || { type: 'Não Definido', segment: 'Outros' };

            // Padroniza a string de Centro de Custo para casar com a originária ('Código - Nome')
            const formattedCostCenter = t.costCenterDescription
                ? `${t.costCenter} - ${t.costCenterDescription}`
                : t.costCenter;

            return {
                ...t,
                costCenter: formattedCostCenter,
                // Map fields to match 'rateio_adm_transactions' structure for dashboards
                accountClass: t.classification,
                planDescription: t.classification, // Assuming classification is the plan name in manual entry
                description: t.observation || t.costCenterDescription,
                type: ccData.type,
                segment: ccData.segment,
                source: 'Manual' // Flag to identify origin if needed
            };
        });

        // 5. Consolidate and return
        return [...officialTransactions, ...enrichedManualTransactions];

    } catch (error) {
        console.error("Erro ao consolidar transações de rateio:", error);
        return [];
    }
}
