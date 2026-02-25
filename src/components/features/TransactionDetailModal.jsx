import React from 'react';
import { X, Calendar, DollarSign, Tag, Landmark, User, FileText, Info, HelpCircle } from 'lucide-react';

const TransactionDetailModal = ({ tx, onClose }) => {
    if (!tx) return null;

    const isRevenue = tx.type === 'revenue';

    // Formatação de data amigável
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR');
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3rem] shadow-[0_30px_100px_rgba(0,0,0,0.4)] overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800">

                <div className="p-12 relative">
                    {/* Badge e Valor Card */}
                    <div className="flex justify-between items-start mb-8">
                        <div className="space-y-4">
                            <div className={`inline-flex px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isRevenue ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                {isRevenue ? 'Receita' : 'Despesa'}
                            </div>
                            <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight uppercase">
                                {tx.planDescription || 'Lançamento Único'}
                            </h2>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border dark:border-slate-700 min-w-[280px] text-right shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Valor Total</p>
                            <p className={`text-4xl font-black ${isRevenue ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {tx.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                    </div>

                    <div className="h-px w-full bg-slate-100 dark:bg-slate-800 my-10" />

                    {/* Metadados Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-y-12 gap-x-8 mb-12">
                        <InfoSection
                            label="Data Lançamento"
                            value={formatDate(tx.date)}
                        />
                        <InfoSection
                            label="Data de Registro"
                            value={tx.createdAt ? formatDate(tx.createdAt) : formatDate(tx.date)}
                        />
                        <InfoSection
                            label="Status Atual"
                            value={<span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg font-bold text-xs uppercase tracking-wider">Processado</span>}
                        />

                        <InfoSection
                            label="Categoria"
                            value={tx.accountPlan || 'Manual'}
                            subValue={tx.planDescription || tx.description}
                        />
                        <InfoSection
                            label="Centro de Custo / Grupo"
                            value={tx.costCenter || tx.grupo || 'Global'}
                            subValue={tx.subgrupo || tx.segment}
                        />
                        <InfoSection
                            label="Fornecedor / Parceiro"
                            value={tx.description || 'N/A'}
                        />
                    </div>

                    <div className="flex justify-between items-end gap-6 pt-10 border-t dark:border-slate-800">
                        {/* Ref Doc Box */}
                        <div className="bg-slate-50 dark:bg-slate-800/30 border-2 border-dashed border-slate-200 dark:border-slate-700 p-6 rounded-3xl min-w-[320px]">
                            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Documento de Referência</p>
                            <p className="text-sm font-bold text-slate-600 dark:text-slate-300 italic">
                                {tx.source === 'automatic_import' ? `ID Relatório: ${tx.id.slice(0, 12)}...` : `LANÇAMENTO MANUAL #${tx.id.slice(-6)}`}
                            </p>
                        </div>

                        {/* Botão de Fechar */}
                        <button
                            onClick={onClose}
                            className="bg-[#0f172a] hover:bg-[#1e293b] text-white px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center gap-3"
                        >
                            Fechar Visualização
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

const InfoSection = ({ label, value, subValue }) => (
    <div className="space-y-2">
        <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</p>
        <div className="space-y-1">
            <p className="text-xl font-bold text-slate-900 dark:text-white leading-snug">{value}</p>
            {subValue && <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-tight">{subValue}</p>}
        </div>
    </div>
);

export default TransactionDetailModal;
