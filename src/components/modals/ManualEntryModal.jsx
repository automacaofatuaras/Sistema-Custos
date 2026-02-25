import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, DollarSign, Tag, Hash, FileText, User, Layout, CheckCircle, HelpCircle, Search } from 'lucide-react';
import dbService from '../../services/dbService';
import { PLANO_CONTAS } from '../../constants/planoContas';

const ManualEntryModal = ({ onClose, segments, onSave, user, initialData, showToast }) => {
    const [form, setForm] = useState({
        date: new Date().toISOString().slice(0, 10),
        type: 'expense',
        description: '',
        value: '',
        segment: '',
        accountPlan: '',
        metricType: 'producao',
        materialDescription: '',
        costCenter: '',
        source: 'manual'
    });

    const [searchClasse, setSearchClasse] = useState('');
    const [searchCC, setSearchCC] = useState('');

    useEffect(() => {
        if (initialData) {
            let safeDate = new Date().toISOString().slice(0, 10);
            if (initialData.date) {
                safeDate = initialData.date.substring(0, 10);
            }

            setForm({
                ...initialData,
                date: safeDate,
                materialDescription: initialData.materialDescription || '',
                costCenter: initialData.costCenter || '',
                source: initialData.source || 'manual',
                accountPlan: initialData.accountPlan || ''
            });

            // Se estiver editando, podemos querer inicializar o campo de busca com o valor atual ou vazio
        }
    }, [initialData]);

    const filteredClasses = useMemo(() => {
        return PLANO_CONTAS
            .filter(p => !p.code.startsWith('06'))
            .filter(p => {
                const term = searchClasse.toLowerCase();
                return p.code.toLowerCase().includes(term) || p.name.toLowerCase().includes(term);
            })
            .sort((a, b) => a.code.localeCompare(b.code));
    }, [searchClasse]);

    const filteredCCs = useMemo(() => {
        return segments.filter(s => s.toLowerCase().includes(searchCC.toLowerCase()));
    }, [segments, searchCC]);

    const handleSubmit = async () => {
        const val = parseFloat(form.value);

        if (!form.description && form.type !== 'metric') return showToast("Preencha o histórico/descrição.", 'error');
        if (isNaN(val)) return showToast("Preencha um valor válido.", 'error');
        if (!form.segment) return showToast("Selecione o centro de custo.", 'error');
        if (form.type !== 'metric' && !form.accountPlan) return showToast("Selecione a classe.", 'error');

        let planDesc = '';
        if (form.type !== 'metric' && form.accountPlan) {
            const planItem = PLANO_CONTAS.find(p => p.code === form.accountPlan);
            planDesc = planItem ? planItem.name : '';
        }

        const tx = {
            ...form,
            value: val,
            planDescription: form.type === 'metric' ? '' : planDesc,
            updatedAt: new Date().toISOString()
        };

        if (form.type === 'metric') {
            const matDesc = form.metricType === 'estoque' ? ` - ${form.materialDescription}` : '';
            tx.description = `Lançamento de ${form.metricType.toUpperCase()}${matDesc}`;
            tx.accountPlan = 'METRICS';
        }

        if (!initialData?.id) {
            tx.createdAt = new Date().toISOString();
        }

        try {
            if (initialData?.id) {
                await dbService.update(user, 'transactions', String(initialData.id), tx);
                showToast("Lançamento atualizado!", 'success');
                onSave();
                onClose();
            } else {
                await dbService.add(user, 'transactions', tx);
                showToast("Salvo com sucesso!", 'success');
                setForm(prev => ({ ...prev, description: '', value: '' }));
                onSave();
            }
        } catch (e) {
            showToast("Erro ao salvar.", 'error');
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-white dark:border-slate-800 animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="p-8 pb-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1">
                                {initialData ? 'Editar Lançamento' : 'Novo Lançamento'}
                            </h2>
                            <p className="text-slate-500 font-medium italic">Preencha os campos abaixo para registrar a movimentação.</p>
                        </div>
                        <button onClick={onClose} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all text-slate-400">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden px-8 flex">
                    <div className="h-full w-48 bg-emerald-500 rounded-full" />
                </div>

                <div className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* TIPO */}
                        <FormItem label="TIPO">
                            <select
                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 font-bold text-slate-700 dark:text-white outline-none transition-all appearance-none"
                                value={form.type}
                                onChange={e => setForm({ ...form, type: e.target.value })}
                            >
                                <option value="expense">Despesa</option>
                                <option value="revenue">Receita</option>
                                <option value="metric">Métrica</option>
                            </select>
                            <Layout className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                        </FormItem>

                        {/* HISTORICO */}
                        <FormItem label="HISTÓRICO / DESCRIÇÃO" className="md:col-span-2">
                            <input
                                placeholder="Ex: Pagamento Adubos"
                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 font-bold text-slate-700 dark:text-white outline-none transition-all"
                                value={form.description}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                            />
                            <FileText className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        </FormItem>

                        {/* VALOR */}
                        <FormItem label="VALOR">
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-emerald-500">R$</span>
                                <input
                                    type="number"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 rounded-2xl p-4 pl-12 font-black text-emerald-600 dark:text-emerald-400 outline-none transition-all"
                                    value={form.value}
                                    onChange={e => setForm({ ...form, value: e.target.value })}
                                />
                            </div>
                        </FormItem>

                        {/* DATA LANÇAMENTO */}
                        <FormItem label="DATA LANÇAMENTO">
                            <input
                                type="date"
                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 font-bold text-slate-700 dark:text-white outline-none transition-all"
                                value={form.date}
                                onChange={e => setForm({ ...form, date: e.target.value })}
                            />
                            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                        </FormItem>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* BUSCA CLASSE */}
                        <FormItem label="CLASSE (PESQUISAR)">
                            <div className="space-y-2">
                                <div className="relative">
                                    <input
                                        placeholder="Pesquise por nome ou código..."
                                        className="w-full bg-slate-100 dark:bg-slate-950 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 font-medium text-sm dark:text-white outline-none transition-all pl-10"
                                        value={searchClasse}
                                        onChange={e => setSearchClasse(e.target.value)}
                                        disabled={form.type === 'metric'}
                                    />
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                </div>
                                <select
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 font-bold text-slate-700 dark:text-white outline-none transition-all appearance-none pr-10"
                                    value={form.accountPlan}
                                    onChange={e => setForm({ ...form, accountPlan: e.target.value })}
                                    disabled={form.type === 'metric'}
                                >
                                    <option value="">Selecione a classe</option>
                                    {filteredClasses.map(p => (
                                        <option key={p.code} value={p.code}>{p.code} - {p.name}</option>
                                    ))}
                                </select>
                            </div>
                        </FormItem>

                        {/* CENTRO DE CUSTO */}
                        <FormItem label="CENTRO DE CUSTO (PESQUISAR)">
                            <div className="space-y-2">
                                <div className="relative">
                                    <input
                                        placeholder="Pesquise a unidade..."
                                        className="w-full bg-slate-100 dark:bg-slate-950 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 font-medium text-sm dark:text-white outline-none transition-all pl-10"
                                        value={searchCC}
                                        onChange={e => setSearchCC(e.target.value)}
                                    />
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                </div>
                                <select
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 font-bold text-slate-700 dark:text-white outline-none transition-all appearance-none pr-10"
                                    value={form.segment}
                                    onChange={e => setForm({ ...form, segment: e.target.value })}
                                >
                                    <option value="">Selecione o centro</option>
                                    {filteredCCs.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </FormItem>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-4 pt-6 border-t dark:border-slate-800">
                        <button
                            onClick={onClose}
                            className="px-10 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 uppercase tracking-wider"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="px-12 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95 uppercase tracking-wider flex items-center gap-3"
                        >
                            <CheckCircle size={20} />
                            Confirmar Lançamento
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

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

export default ManualEntryModal;
