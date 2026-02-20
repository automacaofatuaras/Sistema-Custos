import React, { useState } from 'react';
import { FileText, X, Search, ChevronRight } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

const CostCenterReportModal = ({ isOpen, onClose, transactions }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [ccInput, setCcInput] = useState('');
    const [selectedCCs, setSelectedCCs] = useState([]);
    const [reportData, setReportData] = useState([]);
    const [hasGenerated, setHasGenerated] = useState(false);

    if (!isOpen) return null;

    const handleAddCC = () => {
        if (ccInput.trim() && !selectedCCs.includes(ccInput.trim())) {
            setSelectedCCs([...selectedCCs, ccInput.trim()]);
            setCcInput('');
        }
    };

    const handleRemoveCC = (cc) => {
        setSelectedCCs(selectedCCs.filter(item => item !== cc));
    };

    const generateReport = () => {
        if (selectedCCs.length === 0) {
            alert("Adicione pelo menos um Centro de Custo.");
            return;
        }

        const filtered = transactions.filter(t => {
            if (!t || !t.date) return false;
            let tDate;
            if (typeof t.date === 'string' && t.date.includes('-')) {
                const parts = t.date.split('-');
                if (parts.length < 2) return false;
                tDate = new Date(parts[0], parts[1] - 1, parts[2] || 1);
            } else {
                tDate = new Date(t.date);
            }
            if (isNaN(tDate.getTime())) return false;

            const matchDate = tDate.getMonth() === parseInt(selectedMonth) && tDate.getFullYear() === parseInt(selectedYear);
            const tCC = String(t.costCenterCode || (t.costCenter && t.costCenter.split(' ')[0]) || '').trim();
            const matchCC = selectedCCs.some(selected => tCC === selected || tCC.startsWith(selected));
            return matchDate && matchCC;
        });

        setReportData(filtered);
        setHasGenerated(true);
    };

    const totalValue = reportData.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-700">
                <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 rounded-t-2xl">
                    <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                        <FileText className="text-indigo-500" /> Relatório de Centro de Custo
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-4 border-b dark:border-slate-800">
                    <div className="md:col-span-3 flex gap-2">
                        <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm dark:text-white outline-none">
                            {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => (<option key={i} value={i}>{m}</option>))}
                        </select>
                        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 text-sm dark:text-white outline-none">
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-7">
                        <div className="relative flex gap-2">
                            <input
                                type="text"
                                placeholder="Digite o CC (ex: 2105)..."
                                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-2 pl-10 text-sm dark:text-white outline-none"
                                value={ccInput}
                                onChange={e => setCcInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddCC()}
                            />
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <button onClick={handleAddCC} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Adicionar</button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {selectedCCs.map(cc => (
                                <span key={cc} className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                    {cc} <X size={14} className="cursor-pointer" onClick={() => handleRemoveCC(cc)} />
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <button onClick={generateReport} className="w-full h-full bg-emerald-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors">Gerar</button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950/20">
                    {hasGenerated && reportData.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="font-bold text-slate-500 uppercase text-xs tracking-widest">Lançamentos Encontrados ({reportData.length})</h4>
                                <div className="text-right">
                                    <p className="text-xs text-slate-400 uppercase font-bold">Total do Período</p>
                                    <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 text-xs uppercase font-bold">
                                        <tr>
                                            <th className="p-3 pl-6">Data</th>
                                            <th className="p-3">Unidade / CC</th>
                                            <th className="p-3">Descrição / Conta</th>
                                            <th className="p-3 text-right pr-6">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-slate-700">
                                        {reportData.map((t, i) => (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                <td className="p-3 pl-6 text-slate-400 font-mono text-xs">{formatDate(t.date)}</td>
                                                <td className="p-3">
                                                    <div className="font-bold text-slate-700 dark:text-slate-200">{t.segment.includes(':') ? t.segment.split(':')[1] : t.segment}</div>
                                                    <div className="text-[10px] text-slate-400 uppercase truncate max-w-[150px]">{t.costCenter}</div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-medium text-slate-800 dark:text-slate-300">{t.description}</div>
                                                    <div className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold">{t.accountPlan} - {t.planDescription}</div>
                                                </td>
                                                <td className="p-3 text-right pr-6 font-bold text-slate-700 dark:text-slate-200">
                                                    {t.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : hasGenerated ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                            <Search size={48} className="mb-4 opacity-20" />
                            <p className="font-bold">Nenhum lançamento encontrado</p>
                            <p className="text-sm">Ajuste os filtros ou os Centros de Custo e tente novamente.</p>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                            <FileText size={48} className="mb-4 opacity-10" />
                            <p className="text-sm">Selecione os parâmetros e clique em Gerar Relatório</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CostCenterReportModal;
