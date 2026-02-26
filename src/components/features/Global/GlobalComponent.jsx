import React, { useState, useMemo } from 'react';
import { Globe, X, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
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
        const colorClass = isResult ? (val >= 0 ? 'text-emerald-300' : 'text-rose-300') : (label === 'Despesas' ? 'text-rose-200' : 'text-slate-100');
        return (
            <div className={`grid grid-cols-[1fr_auto_55px] gap-2 items-center tracking-tight ${isBold ? 'font-black' : 'font-medium'}`}>
                <span className="opacity-90 leading-tight min-w-0">{label}</span>
                <span className={`${colorClass} text-right whitespace-nowrap bg-white/10 px-2 py-0.5 rounded`}>
                    {type === 'money' ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : `${val.toLocaleString()} ${SEGMENT_CONFIG[label] || 'un'}`}
                </span>
                {type === 'money' && <span className="text-xs opacity-70 text-right font-mono">{percentStr}</span>}
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
        const valColor = isResult ? (val >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400') : (label === 'Receitas' ? 'text-emerald-600 dark:text-emerald-500' : (label === 'Despesas' ? 'text-rose-500 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'));
        return (
            <div className={`grid grid-cols-[1fr_auto_55px] gap-2 items-center tracking-tight ${isBold ? 'font-black' : 'font-medium text-slate-600 dark:text-slate-400'}`}>
                <span className="leading-tight min-w-0">{label}</span>
                <span className={`${valColor} text-right whitespace-nowrap bg-slate-100 dark:bg-slate-800/50 px-2 py-0.5 rounded`}>
                    {type === 'money' ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : val.toLocaleString()}
                </span>
                {type === 'money' && <span className="text-[11px] text-slate-400 dark:text-slate-500 text-right font-mono">{percentStr}</span>}
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

        const Row = ({ label, val, bold = false, indent = 0, isResult = false, isFinalResult = false, color = "text-slate-700", type = 'money' }) => {
            const percent = (type === 'money' && totalFaturamento !== 0) ? (val / totalFaturamento) * 100 : 0;
            const extraClasses = isFinalResult
                ? `bg-slate-100 dark:bg-slate-800 border-x-4 ${val >= 0 ? 'border-emerald-500' : 'border-rose-500'} dark:border-x-[4px]`
                : (isResult ? 'bg-slate-50 dark:bg-slate-800/50' : '');

            const valColor = isFinalResult || isResult ? (val >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400') : 'text-slate-600 dark:text-slate-300';
            const labelColor = isFinalResult ? 'text-slate-800 dark:text-white' : (color !== "text-slate-700" ? color : (bold ? 'text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'));

            return (
                <div className={`flex items-center justify-between p-2 border-b dark:border-slate-700/50 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${bold ? 'font-bold' : 'font-medium'} ${extraClasses}`}>
                    <span className={`flex-1 ${labelColor}`} style={{ paddingLeft: `${indent * 20}px` }}>
                        {isResult || isFinalResult ? <span className="uppercase text-[11px] tracking-wider opacity-70 mr-2">{isFinalResult ? '=' : '='}</span> : null}
                        {label}
                    </span>
                    <div className="flex items-center gap-4">
                        <span className={`${valColor} text-right w-32 ${isFinalResult ? 'text-base font-black tracking-tight' : ''}`}>
                            {type === 'money' ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : val.toLocaleString('pt-BR') + ' ' + data.unidadeMedida}
                        </span>
                        <span className="text-right w-16 text-[11px] font-mono text-slate-400 dark:text-slate-500">
                            {type === 'money' ? `${percent.toFixed(1)}%` : '-'}
                        </span>
                    </div>
                </div>
            );
        };

        return (
            <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
                <div className="bg-white dark:bg-slate-900 w-[95%] md:w-full md:max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-4 md:my-8 animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
                    <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 p-5 flex justify-between items-center text-white sticky top-0 z-10 shadow-md">
                        <h2 className="font-bold text-xl flex items-center gap-2 tracking-tight">
                            <DollarSign className="text-indigo-300" />
                            Fechamento: {data.name}
                        </h2>
                        <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X size={24} /></button>
                    </div>
                    <div className="p-4 md:p-6 overflow-y-auto max-h-[80vh] text-sm">
                        <div className="flex justify-end mb-2 px-2"><span className="text-[10px] uppercase font-bold text-slate-400 w-16 text-right">% REC</span></div>
                        <Row label={`Vendas Totais`} val={data.vendas} type="vol" bold />
                        <Row label="Receitas (Grupo)" val={data.recGrupo} indent={1} />
                        <Row label="Receitas (Clientes)" val={data.recClientes} indent={1} />
                        <Row label="Total do Faturamento" val={totalFaturamento} bold color="text-indigo-600 dark:text-indigo-400" />
                        <div className="my-3"></div>
                        <Row label="(-) Total Despesas Unidade" val={data.despUnidade} indent={1} color="text-rose-500 dark:text-rose-400" />
                        <Row label="(-) Total Despesas Transporte" val={data.despTransporte} indent={1} color="text-rose-500 dark:text-rose-400" />
                        <Row label="(-) Impostos" val={data.impostos} indent={1} color="text-rose-500 dark:text-rose-400" />

                        <div className="border-t-2 border-indigo-100 dark:border-indigo-900/50 my-4"></div>
                        <Row label="RESULTADO OPERACIONAL" val={resOperacional} isResult bold />
                        <div className="my-4"></div>

                        <Row label="Despesas Administrativas" val={data.despAdm} indent={1} color="text-rose-500 dark:text-rose-400" />
                        <Row label="Despesas Diversas" val={data.despDiversas} indent={1} color="text-rose-500 dark:text-rose-400" />
                        <Row label="Crédito Material Terceiro" val={data.credMatTerceiro} indent={1} color="text-emerald-600 dark:text-emerald-400" />
                        <Row label="Crédito/Débito Transporte" val={data.credTransp} indent={1} color="text-emerald-600 dark:text-emerald-400" />
                        <Row label="Perda de Tubos/Telas" val={data.perdaTubos} indent={1} color="text-rose-500 dark:text-rose-400" />
                        <Row label="Ajuste de Produção" val={data.ajusteProd} indent={1} />
                        <Row label="Resultado Usinas" val={data.resUsinas} indent={1} />
                        <Row label="Subsídio de Terceiros" val={data.subsidio} indent={1} color="text-emerald-600 dark:text-emerald-400" />
                        <Row label="Depreciação" val={data.depreciacao} indent={1} color="text-rose-500 dark:text-rose-400" />
                        <Row label="Estoque (Inventário)" val={data.estoqueInv} indent={1} />

                        <div className="border-t-2 border-indigo-100 dark:border-indigo-900/50 my-4"></div>
                        <Row label="RESULTADO C/ FINAL" val={resComFinal} isResult bold />
                        <div className="my-4"></div>

                        <Row label="Investimentos/Consórcios" val={data.investimentos} indent={1} color="text-rose-500 dark:text-rose-400" />
                        <Row label="Máquinas para Venda" val={data.maqVenda} indent={1} />
                        <Row label="Furto/Roubo" val={data.furto} indent={1} color="text-rose-500 dark:text-rose-400" />
                        <Row label="Veículos Leves Venda" val={data.veicLeveVenda} indent={1} />
                        <Row label="Máquinas Obra - Oficina" val={data.maqObraOficina} indent={1} color="text-rose-500 dark:text-rose-400" />
                        <Row label="Caminhões Obra - Oficina" val={data.camObraOficina} indent={1} color="text-rose-500 dark:text-rose-400" />
                        <Row label="Veíc Leves Obra - Oficina" val={data.veicLeveObraOficina} indent={1} color="text-rose-500 dark:text-rose-400" />

                        <div className="border-t-2 border-indigo-100 dark:border-indigo-900/50 my-4"></div>
                        <Row label="RESULTADO C/ INVESTIMENTO" val={resComInvestimento} isResult bold />
                        <div className="my-4"></div>

                        <Row label="(+) Manut. Máquinas (Deprec)" val={data.manutMaqDeprec} indent={1} color="text-emerald-600 dark:text-emerald-400" />
                        <Row label="(+) Manut. Caminhões (Deprec)" val={data.manutCamDeprec} indent={1} color="text-emerald-600 dark:text-emerald-400" />
                        <Row label="(-) Depreciação Pedreiras" val={data.deprecPedreira} indent={1} color="text-rose-500 dark:text-rose-400" />

                        <div className="border-t-2 border-indigo-100 dark:border-indigo-900/50 my-4"></div>
                        <Row label="RESULTADO OP. C/ DEPRECIAÇÃO" val={resOperacionalComDeprec} isFinalResult bold />
                        <div className="my-4"></div>

                        <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 mb-3">
                            <Row label={`Métrica de Produção`} val={data.producao} type="vol" />
                            <Row label={`Delta Físico (Produção - Vendas)`} val={deltaFisico} type="vol" color={deltaFisico >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"} />
                            <p className="text-[10px] text-right font-bold text-slate-400 dark:text-slate-500 italic mt-1 bg-white dark:bg-slate-900 py-1 px-2 rounded inline-block float-right border dark:border-slate-700 shadow-sm">
                                Custo Médio (Op): {custoMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / ton
                            </p>
                            <div className="clear-both"></div>
                        </div>

                        <Row label="Crédito/Débito Estoque" val={creditoDebitoEstoque} bold color={creditoDebitoEstoque >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"} />

                        <div className="border-t-[3px] border-slate-300 dark:border-slate-600 my-5"></div>
                        <Row label="DEMONSTRATIVO C/ ESTOQUE" val={demonstrativoComEstoque} isFinalResult bold />

                        {data.isGlobal && (
                            <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                                <h4 className="font-black flex items-center gap-2 text-indigo-800 dark:text-indigo-400 bg-white dark:bg-slate-800 py-2 px-3 mb-4 rounded-lg uppercase text-[11px] shadow-sm tracking-wider w-max border dark:border-slate-700">
                                    <Globe size={14} /> Consolidação Global (Operações Administrativas)
                                </h4>
                                <Row label="Receita Financeira" val={data.recFinanceira} indent={1} color="text-emerald-600 dark:text-emerald-400" />
                                <Row label="Despesa Financeira" val={data.despFinanceira} indent={1} color="text-rose-500 dark:text-rose-400" />
                                <Row label="Resultado Financeiro" val={resFinanceiro} bold indent={1} color={resFinanceiro >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} />

                                <div className="border-t border-indigo-200 dark:border-indigo-800/50 my-4"></div>
                                <Row label="DEMONSTRATIVO PÓS FINANC." val={demPosFinanceiro} isResult bold />
                                <div className="my-4"></div>

                                <Row label="Pagto. Parcelamento Tributos" val={data.pagtoTributos} indent={1} color="text-rose-500 dark:text-rose-400" />
                                <Row label="Endividamento" val={data.endividamento} indent={1} color="text-rose-500 dark:text-rose-400" />
                                <Row label="Acerto entre Empresas" val={data.acertoEmpresas} indent={1} />

                                <div className="border-t-[3px] border-indigo-300 dark:border-indigo-700 my-5 shadow-sm"></div>
                                <Row label="RESULTADO LÍQUIDO FINAL" val={demPosEndividamento} isFinalResult bold />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 lg:p-6 rounded-2xl border dark:border-slate-700 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 dark:bg-indigo-900/20 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none"></div>
                <h3 className="font-black text-xl md:text-2xl tracking-tight dark:text-white flex items-center gap-3 relative z-10">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <Globe size={24} />
                    </div>
                    Painel de Consolidação Global
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {consolidatedData['Total Global'] && (
                    <div
                        onClick={() => setSelectedSegment(consolidatedData['Total Global'])}
                        className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-white p-5 lg:p-6 rounded-[24px] shadow-lg shadow-indigo-500/30 cursor-pointer hover:-translate-y-1 hover:shadow-indigo-500/40 transition-all flex flex-col justify-between"
                    >
                        <div className="flex justify-between items-start mb-6 border-b border-indigo-400/30 pb-4">
                            <div>
                                <h3 className="font-black text-xl lg:text-2xl tracking-tight relative flex items-center gap-2">
                                    <Globe size={20} className="opacity-80" /> TOTAL GLOBAL
                                </h3>
                                <p className="text-indigo-200 text-xs font-medium uppercase tracking-widest mt-1">Consolidação Oficial</p>
                            </div>
                            <div className="p-2 bg-white/10 backdrop-blur rounded-xl shrink-0">
                                <TrendingUp size={24} className="text-emerald-300" />
                            </div>
                        </div>
                        <div className="space-y-3.5 text-sm">
                            <SummaryRow label="Total em Vendas" val={consolidatedData['Total Global'].vendas} type="vol" totalRevenue={consolidatedData['Total Global'].receitas} />
                            <SummaryRow label="Receitas Gerais" val={consolidatedData['Total Global'].receitas} totalRevenue={consolidatedData['Total Global'].receitas} isBold />
                            <SummaryRow label="Despesas Gerais" val={consolidatedData['Total Global'].despesas} totalRevenue={consolidatedData['Total Global'].receitas} />
                            <div className="border-t border-indigo-400/30 pt-4 mt-2">
                                <SummaryRow label="RESULTADO FINAL" val={consolidatedData['Total Global'].resultado} totalRevenue={consolidatedData['Total Global'].receitas} isBold isResult />
                            </div>
                        </div>
                    </div>
                )}

                {Object.values(consolidatedData).filter(d => !d.isGlobal).map(d => (
                    <div
                        key={d.name}
                        onClick={() => setSelectedSegment(d)}
                        className="bg-white dark:bg-slate-800 p-5 lg:p-6 rounded-[24px] shadow-sm shadow-slate-200 dark:shadow-none border dark:border-slate-700 cursor-pointer hover:border-indigo-400 hover:-translate-y-1 hover:shadow-md transition-all group flex flex-col"
                    >
                        <div className="flex flex-col mb-5 border-b border-slate-100 dark:border-slate-700/50 pb-4">
                            <div className="flex justify-between items-start w-full">
                                <h3 className="font-bold text-lg dark:text-white group-hover:text-indigo-600 transition-colors leading-tight line-clamp-2" title={d.name}>{d.name}</h3>
                                <div className={`p-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 ${d.resultado >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {d.resultado >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                </div>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-500 py-1 px-2 rounded-md w-max mt-2">
                                Unidade Medida: {d.unidadeMedida}
                            </span>
                        </div>
                        <div className="space-y-3 text-sm mt-auto">
                            <SummaryRowLight label="Vendas" val={d.vendas} type="vol" totalRevenue={d.receitas} />
                            <SummaryRowLight label="Receitas" val={d.receitas} totalRevenue={d.receitas} isBold />
                            <SummaryRowLight label="Despesas" val={d.despesas} totalRevenue={d.receitas} />
                            <div className="border-t border-slate-100 dark:border-slate-700/50 pt-3 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block text-right">Lucro/Prejuízo</span>
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
