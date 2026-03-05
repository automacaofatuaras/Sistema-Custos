import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Package, PlusCircle, DollarSign, Save, X, Info, Trash2, Calendar, Layout, FileText, CheckCircle, Edit2 } from 'lucide-react';
import { formatDate } from '../../../utils/formatters';

const FormItem = ({ label, children, className }) => (
    <div className={`space-y-2 relative ${className || ''}`}>
        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-2">
            {label}
        </label>
        <div className="relative">
            {children}
        </div>
    </div>
);

const StockComponent = ({ transactions, measureUnit, globalCostPerUnit, ytdExpense, ytdProduction, ytdTransportExpense, currentFilter, onAddMetric, onUpdateMetric, onDeleteMetric, selectedSegment }) => {
    const isUsina = selectedSegment === 'Usinas de Asfalto';
    const isConcreteira = selectedSegment === 'Concreteiras';
    const noStockSegment = isUsina || isConcreteira;
    const [showAdjust, setShowAdjust] = useState(false);
    const [adjustId, setAdjustId] = useState(null);
    const [adjustDate, setAdjustDate] = useState(new Date().toISOString().slice(0, 10));
    const [adjustType, setAdjustType] = useState('physical'); // physical | financial
    const [adjustCategory, setAdjustCategory] = useState('Areia Fina');
    const [adjustValue, setAdjustValue] = useState('');

    const getDefaultDate = () => {
        if (!currentFilter) return new Date().toISOString().slice(0, 10);
        let y = currentFilter.year || new Date().getFullYear();
        let m = new Date().getMonth();

        if (currentFilter.type === 'month') {
            m = currentFilter.month;
        } else if (currentFilter.type === 'quarter') {
            m = (currentFilter.quarter - 1) * 3 + 2;
        } else if (currentFilter.type === 'semester') {
            m = currentFilter.semester === 1 ? 5 : 11;
        } else if (currentFilter.type === 'year') {
            m = 11;
        }

        const d = new Date(y, m + 1, 0, 12, 0, 0); // last day of that month
        return d.toISOString().slice(0, 10);
    };

    const handleEditAdjust = (t) => {
        setAdjustId(t.id);
        setAdjustType(t.metricType === 'estoque' ? 'financial' : 'physical');
        setAdjustCategory(t.materialDescription || 'Areia Fina');
        setAdjustDate(t.date ? new Date(t.date).toISOString().slice(0, 10) : getDefaultDate());
        setAdjustValue(t.value);
        setShowAdjust(true);
        // Scroll to form smoothly
        setTimeout(() => {
            document.getElementById('stock-adjust-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    const handleSaveAdjust = () => {
        if (!adjustValue) return;
        const val = parseFloat(adjustValue);
        if (isNaN(val)) return;

        const isPhysical = adjustType === 'physical';
        const metricData = {
            date: adjustDate,
            metricType: adjustType === 'financial' ? 'estoque' : 'estoque_fisico',
            value: val,
            materialDescription: adjustType === 'physical' ? adjustCategory : null,
            description: `Ajuste manual de saldo ${adjustType === 'financial' ? 'financeiro' : 'físico'} de estoque.`
        };

        if (adjustId && onUpdateMetric) {
            onUpdateMetric(adjustId, metricData);
        } else if (onAddMetric) {
            onAddMetric(metricData);
        }

        setAdjustValue('');
        setAdjustId(null);
        setShowAdjust(false);
    };

    const stockData = useMemo(() => {
        let endY = currentFilter?.year || new Date().getFullYear();
        let endM = currentFilter?.type === 'month' ? currentFilter.month :
            currentFilter?.type === 'quarter' ? (currentFilter.quarter * 3) - 1 :
                currentFilter?.type === 'semester' ? (currentFilter.semester * 6) - 1 :
                    11;
        let endDate = new Date(endY, endM + 1, 0, 23, 59, 59);

        const relevantTransactions = [...transactions].filter(t => new Date(t.date) <= endDate);
        const sorted = relevantTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        const avgCost = globalCostPerUnit || 0;

        let balances = {
            'Areia Fina': 0,
            'Areia Grossa': 0,
            'Areia Suja': 0
        };

        let adjsFinanceiros = 0;
        const fullEvolution = [];

        sorted.forEach(t => {
            const isEstoqueFinanceiro = t.metricType === 'estoque';

            if (isEstoqueFinanceiro) {
                adjsFinanceiros = t.value;
                return;
            }

            let category = null;
            const desc = (t.materialDescription || t.description || '').toLowerCase();

            if (desc.includes('fina')) category = 'Areia Fina';
            else if (desc.includes('grossa')) category = 'Areia Grossa';
            else if (desc.includes('suja')) category = 'Areia Suja';

            if (!category) return;

            if (t.type === 'metric') {
                const val = t.value;
                if (t.metricType === 'producao') balances[category] += val;
                else if (t.metricType === 'vendas') balances[category] -= val;
                else if (t.metricType === 'estoque_fisico') balances[category] = val;
            }

            const totalMoment = Object.values(balances).reduce((a, b) => a + b, 0);

            if (t.type === 'metric') {
                const safeDateStr = t.date?.length === 10 ? t.date + 'T12:00:00' : t.date;
                const dateObj = new Date(safeDateStr);
                fullEvolution.push({
                    dateObj: dateObj,
                    displayDate: dateObj.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
                    Estoque: totalMoment
                });
            }
        });

        let filteredEvolution = fullEvolution;

        if (currentFilter) {
            filteredEvolution = fullEvolution.filter(item => {
                if (item.dateObj.getFullYear() !== currentFilter.year) return false;
                if (currentFilter.type === 'month') return item.dateObj.getMonth() === currentFilter.month;
                if (currentFilter.type === 'quarter') {
                    const sq = Math.floor(item.dateObj.getMonth() / 3) + 1;
                    return sq === currentFilter.quarter;
                }
                if (currentFilter.type === 'semester') {
                    const sm = Math.floor(item.dateObj.getMonth() / 6) + 1;
                    return sm === currentFilter.semester;
                }
                return true;
            });
        }

        const totalFinal = Object.values(balances).reduce((a, b) => a + b, 0);
        // If there's a manual financial adjustment, it overrides the average cost calculation for the top card
        const finalTotalValue = adjsFinanceiros > 0 ? adjsFinanceiros : totalFinal * avgCost;

        return {
            total: totalFinal,
            fina: balances['Areia Fina'],
            grossa: balances['Areia Grossa'],
            suja: balances['Areia Suja'],
            avgCost,
            totalValue: finalTotalValue,
            valFina: balances['Areia Fina'] * avgCost,
            valGrossa: balances['Areia Grossa'] * avgCost,
            valSuja: balances['Areia Suja'] * avgCost,
            evolution: filteredEvolution
        };
    }, [transactions, globalCostPerUnit, currentFilter]);

    if (noStockSegment) {
        const materialName = isUsina ? 'massa asfáltica' : 'concreto usinado';
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-800 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-4">
                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
                    <Package className="text-indigo-500" size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">Estoque Não Aplicável</h3>
                <p className="text-slate-500 dark:text-slate-400 text-center max-w-md font-medium">
                    O segmento de {selectedSegment} opera sob demanda. Todo {materialName} produzido é carregado e vendido imediatamente, resultando em saldo de estoque zero.
                </p>
                <div className="mt-8 flex gap-3">
                    <span className="px-4 py-2 bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold uppercase tracking-widest">
                        Operação Just-in-Time
                    </span>
                    <span className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold uppercase tracking-widest">
                        Sem Perdas de Estoque
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none">
                    <p className="text-indigo-200 text-xs font-bold uppercase mb-2">Estoque Físico Total</p>
                    <h3 className="text-3xl font-bold">{stockData.total.toLocaleString()} <span className="text-lg font-normal opacity-80">{measureUnit}</span></h3>
                    <div className="mt-4 pt-4 border-t border-indigo-500/50 flex justify-between items-center text-sm">
                        <span>Custo Médio</span>
                        <span className="font-bold bg-indigo-500 px-2 py-1 rounded">R$ {stockData.avgCost.toFixed(2)}</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border dark:border-slate-700 shadow-sm col-span-2 flex flex-col justify-center">
                    <p className="text-slate-500 text-xs font-bold uppercase mb-2">Valor Financeiro em Estoque</p>
                    <h3 className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                        {stockData.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">Baseado no Custo Médio x Volume Calculado</p>
                </div>
            </div>

            <div className="flex items-center justify-between mt-8">
                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                    <Package className="text-indigo-500" /> Detalhamento por Tipo
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 border-l-amber-400 shadow-sm border dark:border-slate-700">
                    <div className="flex justify-between mb-2">
                        <span className="font-bold text-slate-700 dark:text-slate-200">Areia Fina</span>
                        <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded">FINA</span>
                    </div>
                    <p className="text-2xl font-bold dark:text-white mt-2">{stockData.fina.toLocaleString()} <span className="text-sm text-slate-400">{measureUnit}</span></p>
                    <p className="text-xs text-emerald-600 font-bold mt-1">{stockData.valFina.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 border-l-blue-500 shadow-sm border dark:border-slate-700">
                    <div className="flex justify-between mb-2">
                        <span className="font-bold text-slate-700 dark:text-slate-200">Areia Grossa</span>
                        <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">GROSSA</span>
                    </div>
                    <p className="text-2xl font-bold dark:text-white mt-2">{stockData.grossa.toLocaleString()} <span className="text-sm text-slate-400">{measureUnit}</span></p>
                    <p className="text-xs text-emerald-600 font-bold mt-1">{stockData.valGrossa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 border-l-stone-500 shadow-sm border dark:border-slate-700">
                    <div className="flex justify-between mb-2">
                        <span className="font-bold text-slate-700 dark:text-slate-200">Areia Suja</span>
                        <span className="text-xs font-bold bg-stone-100 text-stone-700 px-2 py-1 rounded">SUJA</span>
                    </div>
                    <p className="text-2xl font-bold dark:text-white mt-2">{stockData.suja.toLocaleString()} <span className="text-sm text-slate-400">{measureUnit}</span></p>
                    <p className="text-xs text-emerald-600 font-bold mt-1">{stockData.valSuja.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 h-80 mt-6">
                <h3 className="font-bold mb-4 dark:text-white">Evolução do Estoque (Período Selecionado)</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stockData.evolution}>
                        <defs>
                            <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="displayDate" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                        <Area type="step" dataKey="Estoque" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorStock)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-end mt-4 mb-4">
                <button
                    onClick={() => {
                        if (showAdjust) {
                            setShowAdjust(false);
                            setAdjustId(null);
                        } else {
                            setAdjustId(null);
                            setAdjustDate(getDefaultDate());
                            setAdjustValue('');
                            setShowAdjust(true);
                        }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 font-bold rounded-lg hover:bg-indigo-100 transition-colors"
                >
                    {showAdjust ? <X size={16} /> : <PlusCircle size={16} />}
                    {showAdjust ? 'Cancelar Ajuste' : 'Novo Ajuste de Estoque'}
                </button>
            </div>

            {showAdjust && (
                <div id="stock-adjust-form" className="bg-white dark:bg-slate-900 w-full rounded-[2rem] shadow-[0_15px_60px_rgba(0,0,0,0.08)] border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-4 duration-500 mb-8 overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                                <Package className="text-indigo-500" size={24} />
                                {adjustId ? 'Editar Ajuste' : 'Lançamento de Ajuste'}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Novo Saldo Financeiro ou Físico de Estoque</p>
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <FormItem label="TIPO">
                                <select
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 font-bold text-slate-700 dark:text-white outline-none transition-all appearance-none"
                                    value={adjustType}
                                    onChange={(e) => setAdjustType(e.target.value)}
                                >
                                    <option value="physical">Estoque Físico (Ton)</option>
                                    <option value="financial">Valor Total (R$)</option>
                                </select>
                                <Layout className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                            </FormItem>

                            {adjustType === 'physical' ? (
                                <FormItem label="CATEGORIA">
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 font-bold text-slate-700 dark:text-white outline-none transition-all appearance-none"
                                        value={adjustCategory}
                                        onChange={(e) => setAdjustCategory(e.target.value)}
                                    >
                                        <option value="Areia Fina">Areia Fina</option>
                                        <option value="Areia Grossa">Areia Grossa</option>
                                        <option value="Areia Suja">Areia Suja</option>
                                    </select>
                                    <FileText className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                                </FormItem>
                            ) : (
                                <div className="hidden md:block"></div>
                            )}

                            <FormItem label="DATA DO LANÇAMENTO">
                                <input
                                    type="date"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 font-bold text-slate-700 dark:text-white outline-none transition-all"
                                    value={adjustDate}
                                    onChange={(e) => setAdjustDate(e.target.value)}
                                />
                                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                            </FormItem>

                            <FormItem label={adjustType === 'physical' ? `N. QUANTIDADE (${measureUnit})` : 'NOVO VALOR (R$)'}>
                                <div className="relative">
                                    {adjustType === 'financial' && <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />}
                                    {adjustType === 'physical' && <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={18} />}
                                    <input
                                        type="number"
                                        placeholder="Ex: 5000"
                                        className={`w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent rounded-2xl p-4 pl-12 font-black outline-none transition-all ${adjustType === 'financial' ? 'focus:border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'focus:border-indigo-500 text-indigo-600 dark:text-indigo-400'}`}
                                        value={adjustValue}
                                        onChange={(e) => setAdjustValue(e.target.value)}
                                    />
                                </div>
                            </FormItem>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t dark:border-slate-800">
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                                <Info size={14} className="inline text-indigo-400" /> O ajuste substituirá o cálculo automático a partir desta data.
                            </p>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        setShowAdjust(false);
                                        setAdjustId(null);
                                    }}
                                    className="px-8 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 uppercase tracking-wider text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveAdjust}
                                    disabled={!adjustValue}
                                    className={`px-8 py-3.5 text-white font-extrabold rounded-xl transition-all shadow-xl active:scale-95 uppercase tracking-wider flex items-center gap-3 text-sm disabled:opacity-50
                                    ${adjustType === 'financial' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' : 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20'}`}
                                >
                                    <CheckCircle size={18} />
                                    Confirmar Ajuste
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 p-6">
                <h3 className="font-bold text-lg mb-4 dark:text-white flex items-center gap-2">
                    <Package className="text-slate-400" size={20} /> Histórico de Ajustes Manuais
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-bold uppercase text-[10px]">
                            <tr>
                                <th className="p-4">Data do Ajuste</th>
                                <th className="p-4">Tipo</th>
                                <th className="p-4">Categoria/Classe</th>
                                <th className="p-4 text-right">Novo Saldo</th>
                                <th className="p-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700">
                            {transactions
                                .filter(t => t.type === 'metric' && ['estoque', 'estoque_fisico'].includes(t.metricType))
                                .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
                                .map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4 text-slate-600 dark:text-slate-300 font-medium">{formatDate(t.date)}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${t.metricType === 'estoque' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                                                {t.metricType === 'estoque' ? 'Ajuste Financeiro' : 'Ajuste Físico'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-500 dark:text-slate-400 font-medium">{t.materialDescription}</td>
                                        <td className="p-4 text-right font-black text-slate-700 dark:text-slate-200">
                                            {t.value.toLocaleString('pt-BR', t.metricType === 'estoque' ? { style: 'currency', currency: 'BRL' } : {})} {t.metricType === 'estoque_fisico' ? measureUnit : ''}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleEditAdjust(t)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"><Edit2 size={16} /></button>
                                                <button onClick={() => onDeleteMetric && onDeleteMetric(t.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            {transactions.filter(t => t.type === 'metric' && ['estoque', 'estoque_fisico'].includes(t.metricType)).length === 0 && (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-400">Nenhum ajuste manual de estoque encontrado no período.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Memória de Cálculo */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-8 mt-12 mb-8 animate-in fade-in duration-700">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                        <FileText className="text-indigo-600 dark:text-indigo-400" size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight">Memória de Cálculo</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Entenda como chegamos nos valores acima</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Passo 1: Custo Médio */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 bg-slate-800 text-white rounded-full flex items-center justify-center text-[10px] font-black">1</span>
                            <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">Cálculo do Custo Médio (YTD)</h4>
                        </div>

                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 font-medium">Despesa Acumulada no Ano (Líquida)</span>
                            <span className="font-black text-slate-700 dark:text-white">{((ytdExpense - (ytdTransportExpense || 0)) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 font-medium">Produção Acumulada no Ano (YTD)</span>
                            <span className="font-black text-slate-700 dark:text-white">{(ytdProduction || 0).toLocaleString('pt-BR')} {measureUnit}</span>
                        </div>
                        <div className="pt-3 border-t dark:border-slate-700 flex flex-col gap-2">
                            <p className="text-[10px] font-bold text-indigo-500 uppercase">Fórmula FINAL (YTD):</p>
                            <div className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-white italic bg-indigo-50/50 dark:bg-indigo-500/5 p-2 rounded-lg">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-400 font-normal">Despesa - Transporte</span>
                                    <span>{((ytdExpense - (ytdTransportExpense || 0)) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                </div>
                                <span className="text-slate-400 mx-1">/</span>
                                <span>{(ytdProduction || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                <span className="text-indigo-500 mx-1">=</span>
                                <span className="bg-indigo-600 text-white px-2 py-0.5 rounded not-italic shadow-sm shadow-indigo-200 dark:shadow-none">R$ {stockData.avgCost.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Passo 2: Valor Estoque */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 bg-slate-800 text-white rounded-full flex items-center justify-center text-[10px] font-black">2</span>
                            <h4 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">Avaliação do Saldo Final</h4>
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border dark:border-slate-700 shadow-sm space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Estoque Físico Calculado</span>
                                <span className="font-black text-slate-700 dark:text-white">{stockData.total.toLocaleString()} {measureUnit}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Custo Médio Aplicado</span>
                                <span className="font-black text-slate-700 dark:text-white">R$ {stockData.avgCost.toFixed(2)}</span>
                            </div>
                            <div className="pt-3 border-t dark:border-slate-700 flex flex-col gap-2">
                                <p className="text-[10px] font-bold text-emerald-500 uppercase">Fórmula FINAL:</p>
                                <div className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-white italic bg-emerald-50/50 dark:bg-emerald-500/5 p-2 rounded-lg">
                                    <span>{stockData.total.toLocaleString()}</span>
                                    <span className="text-slate-400 mx-1">×</span>
                                    <span>R$ {stockData.avgCost.toFixed(2)}</span>
                                    <span className="text-emerald-500 mx-1">=</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-extrabold not-italic text-lg">{stockData.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="mt-6 text-[10px] text-slate-400 font-medium leading-relaxed italic border-t dark:border-slate-800 pt-4">
                    * Nota: O Custo Médio é calculado com base no acumulado do ano (YTD) até o período selecionado para garantir a diluição correta das despesas fixas. Ajustes manuais de valor final no histórico abaixo substituem o cálculo automático para o período do lançamento.
                </p>
            </div>
        </div>
    );
};

export default StockComponent;
