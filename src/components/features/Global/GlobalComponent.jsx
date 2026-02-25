import React, { useState, useMemo } from 'react';
import { Globe, X } from 'lucide-react';
import { BUSINESS_HIERARCHY, SEGMENT_CONFIG } from '../../../constants/business';
import { getParentSegment } from '../../../utils/helpers';


const GlobalComponent = ({ transactions, filter, setFilter, years }) => {
    const [selectedSegment, setSelectedSegment] = useState(null);

    const consolidatedData = useMemo(() => {
        const segments = Object.keys(BUSINESS_HIERARCHY);
        const data = {
            'Total Global': {
                name: 'Total Global', isGlobal: true,
                vendas: 0, producao: 0, receitas: 0, despesas: 0,
                recGrupo: 0, recClientes: 0,
                despUnidade: 0, despTransporte: 0, impostos: 0,
                despAdm: 0, despDiversas: 0, credMatTerceiro: 0, credTransp: 0,
                perdaTubos: 0, ajusteProd: 0, resUsinas: 0, subsidio: 0, depreciacao: 0, estoqueInv: 0,
                investimentos: 0, maqVenda: 0, furto: 0, veicLeveVenda: 0,
                maqObraOficina: 0, camObraOficina: 0, veicLeveObraOficina: 0,
                manutMaqDeprec: 0, manutCamDeprec: 0, deprecPedreira: 0,
                recFinanceira: 0, despFinanceira: 0,
                pagtoTributos: 0, endividamento: 0, acertoEmpresas: 0
            }
        };

        segments.forEach(seg => {
            data[seg] = {
                name: seg, isGlobal: false,
                vendas: 0, producao: 0, receitas: 0, despesas: 0,
                recGrupo: 0, recClientes: 0,
                despUnidade: 0, despTransporte: 0, impostos: 0,
                despAdm: 0, despDiversas: 0, credMatTerceiro: 0, credTransp: 0,
                perdaTubos: 0, ajusteProd: 0, resUsinas: 0, subsidio: 0, depreciacao: 0, estoqueInv: 0,
                investimentos: 0, maqVenda: 0, furto: 0, veicLeveVenda: 0,
                maqObraOficina: 0, camObraOficina: 0, veicLeveObraOficina: 0,
                manutMaqDeprec: 0, manutCamDeprec: 0, deprecPedreira: 0,
                recFinanceira: 0, despFinanceira: 0,
                pagtoTributos: 0, endividamento: 0, acertoEmpresas: 0
            };
        });

        transactions.forEach(t => {
            let y, m;
            if (typeof t.date === 'string' && t.date.length >= 10) {
                y = parseInt(t.date.substring(0, 4));
                m = parseInt(t.date.substring(5, 7)) - 1;
            } else { const d = new Date(t.date); y = d.getFullYear(); m = d.getMonth(); }

            const matchesDate = (() => {
                if (y !== filter.year) return false;
                if (filter.type === 'month' && m !== filter.month) return false;
                if (filter.type === 'quarter' && (Math.floor(m / 3) + 1) !== filter.quarter) return false;
                if (filter.type === 'semester' && (m < 6 ? 1 : 2) !== filter.semester) return false;
                return true;
            })();

            if (!matchesDate) return;

            const segmentName = getParentSegment(t.segment);
            const target = data[segmentName];
            const global = data['Total Global'];

            if (!target) return;

            const val = t.value;
            const desc = (t.description || '').toLowerCase();
            const plan = (t.accountPlan || '');

            if (t.type === 'metric') {
                if (t.metricType === 'vendas') { target.vendas += val; global.vendas += val; }
                else if (t.metricType === 'producao') { target.producao += val; global.producao += val; }
                else if (t.metricType === 'estoque') { target.estoqueInv += val; global.estoqueInv += val; }
            } else if (t.type === 'revenue') {
                target.receitas += val; global.receitas += val;
                if (desc.includes('grupo') || desc.includes('filial')) { target.recGrupo += val; global.recGrupo += val; }
                else { target.recClientes += val; global.recClientes += val; }
                if (desc.includes('financeira')) { target.recFinanceira += val; global.recFinanceira += val; }
            } else if (t.type === 'expense') {
                target.despesas += val; global.despesas += val;
                if (plan.startsWith('02') || desc.includes('imposto')) { target.impostos += val; global.impostos += val; }
                else if (desc.includes('transporte')) { target.despTransporte += val; global.despTransporte += val; }
                else if (desc.includes('administrativa')) { target.despAdm += val; global.despAdm += val; }
                else if (desc.includes('diversas')) { target.despDiversas += val; global.despDiversas += val; }
                else if (desc.includes('crédito material')) { target.credMatTerceiro += val; global.credMatTerceiro += val; }
                else if (desc.includes('crédito transporte') || desc.includes('débito transporte')) { target.credTransp += val; global.credTransp += val; }
                else if (desc.includes('perda') || desc.includes('rompimento')) { target.perdaTubos += val; global.perdaTubos += val; }
                else if (desc.includes('ajuste produção')) { target.ajusteProd += val; global.ajusteProd += val; }
                else if (desc.includes('usina')) { target.resUsinas += val; global.resUsinas += val; }
                else if (desc.includes('subsídio')) { target.subsidio += val; global.subsidio += val; }
                else if (desc.includes('depreciação') && !desc.includes('pedreira')) { target.depreciacao += val; global.depreciacao += val; }
                else if (desc.includes('investimento') || desc.includes('consórcio')) { target.investimentos += val; global.investimentos += val; }
                else if (desc.includes('máquina') && desc.includes('venda')) { target.maqVenda += val; global.maqVenda += val; }
                else if (desc.includes('furto') || desc.includes('roubo')) { target.furto += val; global.furto += val; }
                else if (desc.includes('veículo') && desc.includes('venda')) { target.veicLeveVenda += val; global.veicLeveVenda += val; }
                else if (desc.includes('máquina') && desc.includes('oficina')) { target.maqObraOficina += val; global.maqObraOficina += val; }
                else if (desc.includes('caminhão') && desc.includes('oficina')) { target.camObraOficina += val; global.camObraOficina += val; }
                else if (desc.includes('veículo') && desc.includes('oficina')) { target.veicLeveObraOficina += val; global.veicLeveObraOficina += val; }
                else if (desc.includes('manutenção') && desc.includes('máquina')) { target.manutMaqDeprec += val; global.manutMaqDeprec += val; }
                else if (desc.includes('manutenção') && desc.includes('caminhão')) { target.manutCamDeprec += val; global.manutCamDeprec += val; }
                else if (desc.includes('depreciação') && desc.includes('pedreira')) { target.deprecPedreira += val; global.deprecPedreira += val; }
                else if (desc.includes('financeira')) { target.despFinanceira += val; global.despFinanceira += val; }
                else if (desc.includes('parcelamento') || desc.includes('tributo')) { target.pagtoTributos += val; global.pagtoTributos += val; }
                else if (desc.includes('endividamento')) { target.endividamento += val; global.endividamento += val; }
                else if (desc.includes('acerto empresa')) { target.acertoEmpresas += val; global.acertoEmpresas += val; }
                else { target.despUnidade += val; global.despUnidade += val; }
            }
        });

        Object.values(data).forEach(d => {
            d.resultado = d.receitas - d.despesas;
            d.margem = d.receitas > 0 ? (d.resultado / d.receitas) * 100 : 0;
            d.unidadeMedida = SEGMENT_CONFIG[d.name] || 'un';
            d.custoMedioUnitario = d.producao > 0 ? (d.despesas / d.producao) : 0;
            d.totalFaturamentoCalculado = d.recGrupo + d.recClientes;
        });

        return data;
    }, [transactions, filter]);

    const SummaryRow = ({ label, val, totalRevenue, isBold = false, isResult = false, type = 'money' }) => {
        let percentStr = '-';
        if (type === 'money' && totalRevenue > 0) {
            const pct = (val / totalRevenue) * 100;
            percentStr = `${pct.toFixed(1)}%`;
        } else if (type === 'money' && label === 'Receitas' && val > 0) {
            percentStr = '100.0%';
        }
        const colorClass = isResult ? (val >= 0 ? 'text-emerald-400' : 'text-rose-400') : (label === 'Despesas' ? 'text-rose-400' : 'text-slate-100');
        return (
            <div className={`grid grid-cols-[1fr_auto_55px] gap-1 items-center ${isBold ? 'font-bold' : ''}`}>
                <span className="opacity-90 leading-tight min-w-0">{label}</span>
                <span className={`${colorClass} text-right whitespace-nowrap`}>
                    {type === 'money' ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : `${val.toLocaleString()} ${SEGMENT_CONFIG[label] || 'un'}`}
                </span>
                {type === 'money' && <span className="text-xs opacity-60 text-right font-mono">{percentStr}</span>}
            </div>
        );
    };

    const SummaryRowLight = ({ label, val, totalRevenue, isBold = false, isResult = false, type = 'money' }) => {
        let percentStr = '-';
        if (type === 'money' && totalRevenue > 0) {
            const pct = (val / totalRevenue) * 100;
            percentStr = `${pct.toFixed(1)}%`;
        } else if (type === 'money' && label === 'Receitas' && val > 0) {
            percentStr = '100.0%';
        }
        const valColor = isResult ? (val >= 0 ? 'text-emerald-600' : 'text-rose-600') : (label === 'Receitas' ? 'text-emerald-600' : (label === 'Despesas' ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'));
        return (
            <div className={`grid grid-cols-[1fr_auto_55px] gap-1 items-center ${isBold ? 'font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                <span className="leading-tight min-w-0">{label}</span>
                <span className={`${valColor} text-right whitespace-nowrap`}>
                    {type === 'money' ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : val.toLocaleString()}
                </span>
                {type === 'money' && <span className="text-xs text-slate-400 dark:text-slate-500 text-right font-mono">{percentStr}</span>}
            </div>
        );
    };

    const DetailModal = ({ data, onClose }) => {
        if (!data) return null;
        const totalFaturamento = data.totalFaturamentoCalculado || 0;
        const resOperacional = totalFaturamento - data.despUnidade - data.despTransporte - data.impostos;
        const resComFinal = resOperacional - data.despAdm - data.despDiversas + data.credMatTerceiro + data.credTransp - data.perdaTubos - data.ajusteProd + data.resUsinas + data.subsidio - data.depreciacao + data.estoqueInv;
        const resComInvestimento = resComFinal - data.investimentos - data.maqVenda - data.furto - data.veicLeveVenda - data.maqObraOficina - data.camObraOficina - data.veicLeveObraOficina;
        const resOperacionalComDeprec = resComInvestimento + data.manutMaqDeprec + data.manutCamDeprec - data.deprecPedreira;
        const deltaFisico = data.producao - data.vendas;
        const custoTotalOp = data.despesas;
        const custoMedio = data.producao > 0 ? (custoTotalOp / data.producao) : 0;
        const creditoDebitoEstoque = deltaFisico * custoMedio;
        const demonstrativoComEstoque = resComInvestimento + creditoDebitoEstoque;
        const resFinanceiro = data.recFinanceira - data.despFinanceira;
        const demPosFinanceiro = demonstrativoComEstoque + resFinanceiro;
        const demPosEndividamento = demPosFinanceiro - data.pagtoTributos - data.endividamento - data.acertoEmpresas;

        const Row = ({ label, val, bold = false, indent = 0, isResult = false, color = "text-slate-700", type = 'money' }) => {
            const percent = (type === 'money' && totalFaturamento !== 0) ? (val / totalFaturamento) * 100 : 0;
            return (
                <div className={`flex items-center justify-between p-2 border-b dark:border-slate-700 ${bold ? 'font-bold bg-slate-50 dark:bg-slate-700/50' : ''} ${isResult ? 'bg-slate-100 dark:bg-slate-600' : ''}`}>
                    <span className={`flex-1 ${color} dark:text-slate-200`} style={{ paddingLeft: `${indent * 20}px` }}>{label}</span>
                    <div className="flex items-center gap-4">
                        <span className={`${isResult ? (val >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-600 dark:text-slate-300'} text-right w-32`}>
                            {type === 'money' ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : val.toLocaleString('pt-BR')}
                        </span>
                        <span className="text-right w-16 text-xs font-mono text-slate-500 dark:text-slate-400">
                            {type === 'money' ? `${percent.toFixed(1)}%` : '-'}
                        </span>
                    </div>
                </div>
            );
        };

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
                <div className="bg-white dark:bg-slate-800 w-[95%] md:w-full md:max-w-2xl rounded-xl shadow-2xl overflow-hidden my-4 md:my-8 animate-in zoom-in-95 duration-200">
                    <div className="bg-indigo-600 p-4 flex justify-between items-center text-white sticky top-0 z-10">
                        <h2 className="font-bold text-lg">Fechamento: {data.name}</h2>
                        <button onClick={onClose}><X size={24} /></button>
                    </div>
                    <div className="p-4 md:p-6 overflow-y-auto max-h-[80vh] text-sm">
                        <div className="flex justify-end mb-2 px-2"><span className="text-xs font-bold text-slate-400 w-16 text-right">% Rec.</span></div>
                        <Row label={`Vendas Total (${data.unidadeMedida})`} val={data.vendas} type="vol" bold />
                        <Row label="Receitas (Grupo)" val={data.recGrupo} indent={1} />
                        <Row label="Receitas (Clientes)" val={data.recClientes} indent={1} />
                        <Row label="Total do Faturamento" val={totalFaturamento} bold color="text-indigo-600" />
                        <div className="my-2"></div>
                        <Row label="(-) Total Despesas Unidade" val={data.despUnidade} indent={1} color="text-rose-500" />
                        <Row label="(-) Total Despesas Transporte" val={data.despTransporte} indent={1} color="text-rose-500" />
                        <Row label="(-) Impostos" val={data.impostos} indent={1} color="text-rose-500" />
                        <div className="border-t-2 border-slate-300 my-2"></div>
                        <Row label="= RESULTADO OPERACIONAL" val={resOperacional} isResult bold />
                        <div className="my-2"></div>
                        <Row label="Despesas Administrativas" val={data.despAdm} indent={1} color="text-rose-500" />
                        <Row label="Despesas Diversas" val={data.despDiversas} indent={1} color="text-rose-500" />
                        <Row label="Crédito Material Terceiro" val={data.credMatTerceiro} indent={1} color="text-emerald-500" />
                        <Row label="Crédito/Débito Transporte" val={data.credTransp} indent={1} />
                        <Row label="Perda de Tubos/Telas" val={data.perdaTubos} indent={1} color="text-rose-500" />
                        <Row label="Ajuste de Produção" val={data.ajusteProd} indent={1} />
                        <Row label="Resultado Usinas" val={data.resUsinas} indent={1} />
                        <Row label="Subsídio de Terceiros" val={data.subsidio} indent={1} />
                        <Row label="Depreciação" val={data.depreciacao} indent={1} color="text-rose-500" />
                        <Row label="Estoque (Inventário)" val={data.estoqueInv} indent={1} />
                        <div className="border-t-2 border-slate-300 my-2"></div>
                        <Row label="= RESULTADO C/ FINAL" val={resComFinal} isResult bold />
                        <div className="my-2"></div>
                        <Row label="Investimentos/Consórcios" val={data.investimentos} indent={1} color="text-rose-500" />
                        <Row label="Máquinas para Venda" val={data.maqVenda} indent={1} />
                        <Row label="Furto/Roubo" val={data.furto} indent={1} color="text-rose-500" />
                        <Row label="Veículos Leves Venda" val={data.veicLeveVenda} indent={1} />
                        <Row label="Máquinas Obra - Oficina" val={data.maqObraOficina} indent={1} color="text-rose-500" />
                        <Row label="Caminhões Obra - Oficina" val={data.camObraOficina} indent={1} color="text-rose-500" />
                        <Row label="Veíc Leves Obra - Oficina" val={data.veicLeveObraOficina} indent={1} color="text-rose-500" />
                        <div className="border-t-2 border-slate-300 my-2"></div>
                        <Row label="= RESULTADO C/ INVESTIMENTO" val={resComInvestimento} isResult bold />
                        <div className="my-2"></div>
                        <Row label="(+) Manut. Máquinas (Deprec)" val={data.manutMaqDeprec} indent={1} color="text-emerald-500" />
                        <Row label="(+) Manut. Caminhões (Deprec)" val={data.manutCamDeprec} indent={1} color="text-emerald-500" />
                        <Row label="(-) Depreciação Pedreiras" val={data.deprecPedreira} indent={1} color="text-rose-500" />
                        <div className="border-t-2 border-slate-300 my-2"></div>
                        <Row label="= RESULTADO OP. C/ DEPRECIAÇÃO" val={resOperacionalComDeprec} isResult bold />
                        <div className="my-2"></div>
                        <div className="bg-slate-100 dark:bg-slate-700/30 p-2 rounded mb-2">
                            <Row label={`Produção (${data.unidadeMedida})`} val={data.producao} type="vol" />
                            <Row label={`Crédito/Débito Físico (${data.unidadeMedida})`} val={deltaFisico} type="vol" color={deltaFisico >= 0 ? "text-emerald-500" : "text-rose-500"} />
                            <p className="text-[10px] text-right text-slate-400 italic mr-20">Custo Médio: {custoMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        <Row label="Crédito/Débito Estoque (R$)" val={creditoDebitoEstoque} bold color={creditoDebitoEstoque >= 0 ? "text-emerald-600" : "text-rose-600"} />
                        <div className="border-t-4 border-slate-400 my-3"></div>
                        <Row label="= DEMONSTRATIVO C/ ESTOQUE" val={demonstrativoComEstoque} isResult bold />
                        {data.isGlobal && (
                            <div className="mt-6 animate-in fade-in">
                                <h4 className="font-bold text-center bg-slate-200 dark:bg-slate-700 p-2 mb-2 rounded uppercase text-xs">Exclusivo Global</h4>
                                <Row label="Receita Financeira" val={data.recFinanceira} indent={1} color="text-emerald-500" />
                                <Row label="Despesa Financeira" val={data.despFinanceira} indent={1} color="text-rose-500" />
                                <Row label="Resultado Financeiro" val={resFinanceiro} bold indent={1} />
                                <div className="border-t-2 border-slate-300 my-2"></div>
                                <Row label="= DEMONSTRATIVO PÓS FINANCEIRO" val={demPosFinanceiro} isResult bold />
                                <div className="my-2"></div>
                                <Row label="Pagto. Parcelamento Tributos" val={data.pagtoTributos} indent={1} color="text-rose-500" />
                                <Row label="Endividamento" val={data.endividamento} indent={1} color="text-rose-500" />
                                <Row label="Acerto entre Empresas" val={data.acertoEmpresas} indent={1} />
                                <div className="border-t-4 border-slate-800 dark:border-white my-3"></div>
                                <Row label="= DEMONSTRATIVO PÓS ENDIVIDAMENTO" val={demPosEndividamento} isResult bold />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-sm">
                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                    <Globe className="text-indigo-500" /> Consolidação Global
                </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                {consolidatedData['Total Global'] && (
                    <div onClick={() => setSelectedSegment(consolidatedData['Total Global'])} className="bg-indigo-600 text-white p-4 md:p-6 rounded-2xl shadow-lg cursor-pointer hover:scale-105 transition-transform">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-lg md:text-xl">TOTAL GLOBAL</h3>
                            <Globe size={24} className="opacity-80" />
                        </div>
                        <div className="space-y-3 text-sm">
                            <SummaryRow label="Vendas" val={consolidatedData['Total Global'].vendas} type="vol" totalRevenue={consolidatedData['Total Global'].receitas} />
                            <SummaryRow label="Receitas" val={consolidatedData['Total Global'].receitas} totalRevenue={consolidatedData['Total Global'].receitas} isBold />
                            <SummaryRow label="Despesas" val={consolidatedData['Total Global'].despesas} totalRevenue={consolidatedData['Total Global'].receitas} />
                            <div className="border-t border-indigo-400 pt-3">
                                <SummaryRow label="Resultado" val={consolidatedData['Total Global'].resultado} totalRevenue={consolidatedData['Total Global'].receitas} isBold isResult />
                            </div>
                        </div>
                    </div>
                )}
                {Object.values(consolidatedData).filter(d => !d.isGlobal).map(d => (
                    <div key={d.name} onClick={() => setSelectedSegment(d)} className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl shadow-sm border dark:border-slate-700 cursor-pointer hover:border-indigo-500 transition-colors group">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-base md:text-lg dark:text-white group-hover:text-indigo-600 leading-tight" title={d.name}>{d.name}</h3>
                            <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500 shrink-0">{d.unidadeMedida}</span>
                        </div>
                        <div className="space-y-3 text-sm">
                            <SummaryRowLight label="Vendas" val={d.vendas} type="vol" totalRevenue={d.receitas} />
                            <SummaryRowLight label="Receitas" val={d.receitas} totalRevenue={d.receitas} isBold />
                            <SummaryRowLight label="Despesas" val={d.despesas} totalRevenue={d.receitas} />
                            <div className="border-t dark:border-slate-700 pt-3">
                                <SummaryRowLight label="Resultado" val={d.resultado} totalRevenue={d.receitas} isBold isResult />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {selectedSegment && <DetailModal data={selectedSegment} onClose={() => setSelectedSegment(null)} />}
        </div>
    );
};

export default GlobalComponent;
