import dbService from './dbService';
import emailjs from '@emailjs/browser';

// Credenciais configuradas pelo cliente
const EMAILJS_SERVICE_ID = 'service_32app23';
const EMAILJS_TEMPLATE_ID = 'template_96sach3';
const EMAILJS_PUBLIC_KEY = '7HOADmdflknl1TTIc';

export const reportService = {
    /**
     * Gera o resumo executivo retornado ao objeto dashboard
     */
    generateExecutiveSummary: (period, kpis) => {
        return `Resumo Executivo - Rateio Administrativo
Período: ${period.month + 1}/${period.year}

Indicadores Principais:
- Custo Total Rateado: R$ ${kpis.total.toLocaleString('pt-BR')}
- Custos Diretos: R$ ${kpis.diretos.toLocaleString('pt-BR')} (${kpis.diretosPerc.toFixed(1)}%)
- Custos Indiretos: R$ ${kpis.indiretos.toLocaleString('pt-BR')} (${(100 - kpis.diretosPerc).toFixed(1)}%)

Reporte gerado pelo painel central.
`;
    },

    /**
     * Envia relatório por E-mail (EmailJS Oficial)
     */
    sendEmailReport: async (origin, period, globalKPIs, filteredData) => {
        console.log("Iniciando rotina de disparo individual de e-mails via EmailJS...");
        try {
            // 1. Busca gestores cadastrados no Firebase
            const gestores = await dbService.getAll(null, 'rateio_adm_gestores');

            if (!gestores || gestores.length === 0) {
                console.warn("Nenhum gestor cadastrado para receber o e-mail.");
                return { success: false, message: "Aviso: Nenhum gestor (e-mail) cadastrado na aba de Cadastros." };
            }

            let sucessCount = 0;
            let errorCount = 0;
            let skippedCount = 0;

            // 2. Loop: Envia e-mail de forma ÚBICA para cada gestor calculando apenas o que é dele
            const sendPromises = gestores.map(async (gestor) => {
                if (!gestor.email || !gestor.linkedCostCenters || gestor.linkedCostCenters.length === 0) {
                    skippedCount++;
                    return;
                }

                // A. Filtra somente as transações do Gestor
                const myTransactions = filteredData.filter(t => {
                    const rowCode = t.costCenterCode || (t.costCenter ? t.costCenter.toString().split(' - ')[0].trim() : '');
                    return gestor.linkedCostCenters.includes(rowCode);
                });

                // B. Calcula o "Bolo" daquele Gestor
                const total = myTransactions.reduce((acc, t) => acc + t.value, 0);

                // C. Se não houver despesa para ele no mês, não enche a caixa de e-mail dele
                if (total <= 0) {
                    skippedCount++;
                    return;
                }

                const diretos = myTransactions.filter(t => t.type?.toLowerCase() === 'direto').reduce((acc, t) => acc + t.value, 0);
                const indiretos = myTransactions.filter(t => t.type?.toLowerCase() === 'indireto').reduce((acc, t) => acc + t.value, 0);
                const diretosPerc = total > 0 ? (diretos / total) * 100 : 0;

                // D. Monta a Tabela de Extrato Analítico em HTML para o E-mail
                // D. Monta a Tabela de Extrato Analítico em HTML para o E-mail
                const formatBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

                // Mapeia TOP 5 Maiores Despesas (Classe Contábil)
                const classTotais = {};
                myTransactions.forEach(t => {
                    const cName = t.planDescription || t.classification || 'Não Classificado';
                    classTotais[cName] = (classTotais[cName] || 0) + t.value;
                });

                const top5Classes = Object.entries(classTotais)
                    .map(([name, val]) => ({ name, val }))
                    .sort((a, b) => b.val - a.val)
                    .slice(0, 5);

                const maxClassVal = top5Classes.length > 0 ? top5Classes[0].val : 0;

                let htmlDashboard = `
                <!-- PAINEL GERENCIAL -->
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin-bottom: 30px;">
                    
                    <!-- CARDS RESUMO -->
                    <table style="width: 100%; border-collapse: separate; border-spacing: 12px 0; margin-bottom: 24px;">
                        <tr>
                            <!-- CARD TOTAL -->
                            <td style="width: 33.3%; background-color: #312e81; border-radius: 12px; padding: 20px; color: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                                <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #93c5fd; margin-bottom: 8px;">Custo Total Mês</div>
                                <div style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">${formatBRL(total)}</div>
                                <div style="font-size: 11px; margin-top: 6px; color: #bfdbfe;">Soma das despesas do mês</div>
                            </td>
                            <!-- CARD DIRETOS -->
                            <td style="width: 33.3%; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                                <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #15803d; margin-bottom: 8px;">Custos Diretos</div>
                                <div style="font-size: 20px; font-weight: 800; color: #166534; letter-spacing: -0.5px;">${formatBRL(diretos)}</div>
                                <div style="font-size: 11px; margin-top: 6px; color: #64748b; font-weight: 600;">${diretosPerc.toFixed(1)}% de Participação</div>
                            </td>
                            <!-- CARD INDIRETOS -->
                            <td style="width: 33.3%; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                                <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #6b21a8; margin-bottom: 8px;">Custos Indiretos</div>
                                <div style="font-size: 20px; font-weight: 800; color: #581c87; letter-spacing: -0.5px;">${formatBRL(indiretos)}</div>
                                <div style="font-size: 11px; margin-top: 6px; color: #64748b; font-weight: 600;">${(100 - diretosPerc).toFixed(1)}% de Participação</div>
                            </td>
                        </tr>
                    </table>

                    <!-- GRÁFICO TOP 5 DESPESAS -->
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 2px 4px -1px rgba(0,0,0,0.05); margin-bottom: 0px;">
                        <h4 style="margin: 0 0 16px 0; color: #1e293b; font-size: 14px; text-transform: uppercase; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">Top 5 Despesas (Em R$)</h4>
                        <table style="width: 100%; border-collapse: collapse;">
                `;

                top5Classes.forEach((item, i) => {
                    const widthPerc = maxClassVal > 0 ? (item.val / maxClassVal) * 100 : 0;
                    const colors = ['#3b82f6', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6'];
                    const barColor = colors[i % colors.length];

                    htmlDashboard += `
                            <tr>
                                <td style="width: 35%; padding: 6px 12px 6px 0; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${item.name}</td>
                                <td style="width: 65%; padding: 6px 0;">
                                    <table style="width: 100%; border-collapse: collapse; mso-table-lspace:0pt; mso-table-rspace:0pt;">
                                        <tr>
                                            <td style="width: 100%; padding-right: 10px; vertical-align: middle;">
                                                <div style="width: 100%; border-radius: 6px; background-color: #f1f5f9; overflow: hidden;">
                                                    <table style="width: 100%; border-collapse: collapse; height: 16px; mso-table-lspace:0pt; mso-table-rspace:0pt; border-radius: 6px;">
                                                        <tr>
                                                            <td bgcolor="${barColor}" style="background-color: ${barColor}; width: ${widthPerc.toFixed(1)}%; height: 16px; font-size: 1px; line-height: 1px; border-radius: 6px; border-top-right-radius: 0; border-bottom-right-radius: 0;">&nbsp;</td>
                                                            <td style="width: ${(100 - widthPerc).toFixed(1)}%;">&nbsp;</td>
                                                        </tr>
                                                    </table>
                                                </div>
                                            </td>
                                            <td style="white-space: nowrap; text-align: right; font-size: 12px; font-weight: bold; color: #0f172a; vertical-align: middle;">
                                                ${formatBRL(item.val)}
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                    `;
                });

                htmlDashboard += `
                        </table>
                    </div>
                </div>
                `;

                // Tabela Detalhada Original
                let htmlTable = htmlDashboard + `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                        <h4 style="margin: 30px 0 12px 0; color: #1e293b; font-size: 14px; text-transform: uppercase;">Extrato Analítico Fechado</h4>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 25px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; mso-table-lspace:0pt; mso-table-rspace:0pt;">
                        <thead>
                            <tr style="background-color: #4f46e5; color: #ffffff; text-align: left;">
                                <th style="width: 15%; padding: 12px 16px; font-weight: 600; border-bottom: 2px solid #4338ca;">Centro de Custo</th>
                                <th style="width: 20%; padding: 12px 16px; font-weight: 600; border-bottom: 2px solid #4338ca;">Classe Contábil</th>
                                <th style="width: 35%; padding: 12px 16px; font-weight: 600; border-bottom: 2px solid #4338ca;">Histórico / Descrição</th>
                                <th style="width: 15%; padding: 12px 16px; font-weight: 600; border-bottom: 2px solid #4338ca;">Tipo</th>
                                <th style="width: 15%; padding: 12px 16px; font-weight: 600; border-bottom: 2px solid #4338ca; text-align: right;">Valor (R$)</th>
                            </tr>
                        </thead>
                        <tbody style="background-color: #ffffff;">
                `;

                myTransactions.sort((a, b) => b.value - a.value).forEach((t, index) => {
                    const rowBg = index % 2 === 0 ? '#f8fafc' : '#ffffff';
                    const classeStr = t.accountPlan ? `${t.accountPlan} - ${t.planDescription || t.classification || ''}` : (t.planDescription || t.classification || '-');
                    const descStr = t.description || '-';
                    const badgeBg = t.type?.toLowerCase() === 'direto' ? '#dcfce7' : '#f1f5f9';
                    const badgeColor = t.type?.toLowerCase() === 'direto' ? '#166534' : '#475569';

                    htmlTable += `
                        <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px 16px; color: #475569; font-weight: 500;">${t.costCenter || t.costCenterCode || ''}</td>
                            <td style="padding: 12px 16px; color: #64748b; font-size: 12px;">${classeStr}</td>
                            <td style="padding: 12px 16px; color: #334155;">${descStr}</td>
                            <td style="padding: 12px 16px;">
                                <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; background-color: ${badgeBg}; color: ${badgeColor};">
                                    ${t.type || '-'}
                                </span>
                            </td>
                            <td style="padding: 12px 16px; text-align: right; color: #0f172a; font-weight: 600;">${formatBRL(t.value)}</td>
                        </tr>
                    `;
                });

                htmlTable += `
                        </tbody>
                        <tfoot>
                            <tr style="background-color: #e0e7ff; color: #312e81; font-weight: bold; border-top: 2px solid #c7d2fe;">
                                <td colspan="4" style="padding: 14px 16px; text-align: right; text-transform: uppercase; font-size: 12px;">Total do Extrato:</td>
                                <td style="padding: 14px 16px; text-align: right; font-size: 14px;">${formatBRL(total)}</td>
                            </tr>
                        </tfoot>
                    </table>
                    </div>
                `;

                // E. Monta variáveis limpas para o Template do EmailJS
                const templateParams = {
                    to_email: gestor.email,
                    to_name: gestor.name || 'Gestor',
                    period_str: `${period.month + 1}/${period.year}`,
                    cc_names: gestor.linkedCostCenters?.join(' e ') || 'Geral',
                    kpi_total: `R$ ${total.toLocaleString('pt-BR')}`,
                    kpi_diretos: `R$ ${diretos.toLocaleString('pt-BR')} (${diretosPerc.toFixed(1)}%)`,
                    kpi_indiretos: `R$ ${indiretos.toLocaleString('pt-BR')} (${(100 - diretosPerc).toFixed(1)}%)`,
                    html_table: htmlTable
                };

                try {
                    await emailjs.send(
                        EMAILJS_SERVICE_ID,
                        EMAILJS_TEMPLATE_ID,
                        templateParams,
                        EMAILJS_PUBLIC_KEY
                    );
                    sucessCount++;
                } catch (err) {
                    console.error(`Erro ao disparar para ${gestor.email}: `, err);
                    errorCount++;
                }
            });

            await Promise.all(sendPromises);

            return {
                success: true,
                message: `Relatório(s) individualizado(s) disparado(s) para ${sucessCount} gestor(es).\n(Ignorados: ${skippedCount} sem dados/vínculos) \n${errorCount > 0 ? `Falhas de Rede: ${errorCount}` : ''}`
            };

        } catch (error) {
            console.error("Erro Fatal no Controller de E-mail:", error);
            return { success: false, message: "Erro de Integração com a API do EmailJS." };
        }
    },

    /**
     * Estrutura para envio via WhatsApp (Mantida como Placeholder)
     */
    sendWhatsAppReport: async (summaryText) => {
        return { success: true, message: "Opção de WhatsApp não configurada nativamente neste contrato." };
    }
};

export default reportService;
