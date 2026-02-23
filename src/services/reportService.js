import dbService from './dbService';

export const reportService = {
    /**
     * Gera o resumo executivo com base nos dados filtrados do dashboard
     */
    generateExecutiveSummary: (period, kpis) => {
        return `
Resumo Executivo - Rateio Administrativo
Período: ${period.month + 1}/${period.year}

Indicadores Principais:
- Custo Total Rateado: R$ ${kpis.total.toLocaleString('pt-BR')}
- Custos Diretos: R$ ${kpis.diretos.toLocaleString('pt-BR')} (${kpis.diretosPerc.toFixed(1)}%)
- Custos Indiretos: R$ ${kpis.indiretos.toLocaleString('pt-BR')} (${(100 - kpis.diretosPerc).toFixed(1)}%)

Nota: Este relatório foi gerado automaticamente pelo sistema Scamatti Custos.
`;
    },

    /**
     * Envia relatório por E-mail (Mock)
     */
    sendEmailReport: async (summaryText) => {
        console.log("Iniciando rotina de disparo de e-mails...");
        try {
            // Busca gestores cadastrados
            const gestores = await dbService.getAll(null, 'rateio_adm_gestores');

            if (!gestores || gestores.length === 0) {
                console.warn("Nenhum gestor cadastrado para receber o e-mail.");
                return { success: false, message: "Nenhum gestor cadastrado." };
            }

            // Simula delay de envio (ex: integração AWS SES / SendGrid)
            await new Promise(resolve => setTimeout(resolve, 1500));

            console.log(`E-mail com assunto "Relatório de Rateio Administrativo" enviado para ${gestores.length} gestores.`);
            gestores.forEach(g => console.log(` -> Enviado para: ${g.email}`));

            return { success: true, message: `Relatório enviado para ${gestores.length} gestores por e-mail.` };
        } catch (error) {
            console.error("Erro ao enviar e-mail:", error);
            return { success: false, message: "Erro ao enviar e-mail." };
        }
    },

    /**
     * Estrutura para envio via WhatsApp (API Placeholder)
     */
    sendWhatsAppReport: async (summaryText) => {
        console.log("Iniciando rotina de disparo de WhatsApp...");
        try {
            // Busca gestores cadastrados (assumindo que gestores teriam um campo telefone)
            const gestores = await dbService.getAll(null, 'rateio_adm_gestores');

            // Simula delay de envio (ex: integração Twilio / Z-API / WhatsApp Business API)
            await new Promise(resolve => setTimeout(resolve, 1000));

            console.log("Mensagens de WhatsApp enviadas com sucesso (simulação).");

            return { success: true, message: "Relatório encaminhado via WhatsApp." };
        } catch (error) {
            console.error("Erro ao enviar WhatsApp:", error);
            return { success: false, message: "Erro ao integrar com WhatsApp." };
        }
    }
};

export default reportService;
