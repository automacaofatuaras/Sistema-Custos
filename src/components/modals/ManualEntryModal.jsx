import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import dbService from '../../services/dbService';
import { PLANO_CONTAS } from '../../constants/planoContas';

const ManualEntryModal = ({ onClose, segments, onSave, user, initialData, showToast }) => {
    const [form, setForm] = useState({
        date: new Date().toISOString().slice(0, 7),
        type: 'expense',
        description: '',
        value: '',
        segment: '',
        accountPlan: '',
        metricType: 'producao',
        materialDescription: '',
        costCenter: 'GERAL',
        source: 'manual'
    });

    const [activeTab, setActiveTab] = useState('expense');

    useEffect(() => {
        if (initialData) {
            let safeDate = new Date().toISOString().slice(0, 7);
            if (initialData.date) {
                safeDate = initialData.date.substring(0, 7);
            }

            setForm({
                ...initialData,
                date: safeDate,
                materialDescription: initialData.materialDescription || '',
                costCenter: initialData.costCenter || 'GERAL',
                source: initialData.source || 'manual',
                accountPlan: initialData.accountPlan || ''
            });

            const type = initialData.type || 'expense';
            setActiveTab(type === 'metric' ? 'metric' : type);
        }
    }, [initialData]);

    const handleSubmit = async () => {
        const val = parseFloat(form.value);

        if (!form.description && activeTab !== 'metric') return showToast("Preencha a descrição.", 'error');
        if (isNaN(val) || !form.segment) return showToast("Preencha unidade e valor.", 'error');
        if (activeTab !== 'metric' && !form.accountPlan) return showToast("Selecione a conta do Plano.", 'error');
        if (activeTab === 'metric' && form.metricType === 'estoque' && !form.materialDescription) return showToast("Selecione o Material.", 'error');

        const [year, month] = form.date.split('-');
        const lastDay = new Date(year, month, 0).getDate();
        const fullDate = `${form.date}-${lastDay}`;

        let planDesc = '';
        if (activeTab !== 'metric' && form.accountPlan) {
            const planItem = PLANO_CONTAS.find(p => p.code === form.accountPlan);
            planDesc = planItem ? planItem.name : '';
        }

        const tx = {
            date: fullDate,
            value: val,
            type: activeTab,
            segment: form.segment || '',
            description: form.description || '',
            costCenter: form.costCenter || 'GERAL',
            source: form.source || 'manual',
            accountPlan: activeTab === 'metric' ? 'METRICS' : (form.accountPlan || ''),
            planDescription: activeTab === 'metric' ? '' : planDesc,
            metricType: activeTab === 'metric' ? form.metricType : null,
            materialDescription: form.materialDescription || '',
            updatedAt: new Date().toISOString()
        };

        if (activeTab === 'metric') {
            const matDesc = form.metricType === 'estoque' ? ` - ${form.materialDescription}` : '';
            tx.description = `Lançamento de ${form.metricType.toUpperCase()}${matDesc}`;
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
                showToast("Salvo! Pode fazer o próximo.", 'success');
                setForm(prev => ({ ...prev, description: '', value: '' }));
                onSave();
            }
        } catch (e) {
            showToast("Erro ao salvar.", 'error');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border dark:border-slate-700">
                <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                    <h2 className="font-bold">{initialData ? 'Editar Lançamento' : 'Novo Lançamento Manual'}</h2>
                    <button onClick={onClose}><X size={20} /></button>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-900 p-1">
                    {['revenue', 'expense', 'metric'].map(t => (
                        <button
                            key={t}
                            onClick={() => setActiveTab(t)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === t ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                        >
                            {t === 'revenue' ? 'Receita' : t === 'expense' ? 'Despesa' : 'Métrica'}
                        </button>
                    ))}
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Mês/Ano de Referência</label>
                        <input type="month" className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Unidade / Segmento</label>
                        <select className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })}>
                            <option value="">Selecione...</option>
                            {segments.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {activeTab === 'metric' ? (
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg space-y-4">
                            <div>
                                <label className="text-xs font-bold text-indigo-600">Tipo de Métrica</label>
                                <select className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={form.metricType} onChange={e => setForm({ ...form, metricType: e.target.value })}>
                                    <option value="producao">Produção</option>
                                    <option value="vendas">Vendas</option>
                                    <option value="estoque">Estoque (Inventário)</option>
                                </select>
                            </div>
                            {form.metricType === 'estoque' && (
                                <div>
                                    <label className="text-xs font-bold text-indigo-600">Material</label>
                                    <select className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={form.materialDescription} onChange={e => setForm({ ...form, materialDescription: e.target.value })}>
                                        <option value="">Selecione...</option>
                                        <option value="Areia Fina">Areia Fina</option>
                                        <option value="Areia Grossa">Areia Grossa</option>
                                        <option value="Areia Suja">Areia Suja</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Descrição / Fornecedor / Cliente</label>
                                <input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Plano de Contas</label>
                                <select className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={form.accountPlan} onChange={e => setForm({ ...form, accountPlan: e.target.value })}>
                                    <option value="">Selecione...</option>
                                    {PLANO_CONTAS.filter(p => !p.code.startsWith('06')).sort((a, b) => a.code.localeCompare(b.code)).map(p => <option key={p.code} value={p.code}>{p.code} - {p.name}</option>)}
                                </select>
                            </div>
                        </>
                    )}

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Valor R$ ou Qtd</label>
                        <input type="number" className="w-full border p-3 rounded-lg text-xl font-bold dark:bg-slate-700 dark:text-white" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
                    </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t dark:border-slate-700 flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 font-bold text-slate-500">Cancelar</button>
                    <button onClick={handleSubmit} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-colors">Salvar Lançamento</button>
                </div>
            </div>
        </div>
    );
};

export default ManualEntryModal;
