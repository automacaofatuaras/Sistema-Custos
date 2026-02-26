import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, DollarSign, Tag, Hash, FileText, User, Layout, CheckCircle, HelpCircle, Search, ArrowLeft, Layers, Bookmark, Truck, Package, HeartHandshake, Building2 } from 'lucide-react';
import dbService from '../../services/dbService';
import { PLANO_CONTAS } from '../../constants/planoContas';
import SearchableSelect from '../common/SearchableSelect';

const GROUPS = [
    'DESPESAS DA UNIDADE',
    'TRANSPORTE',
    'ADMINISTRATIVO',
    'IMPOSTOS',
    'INVESTIMENTOS'
];

const SUB_GROUPS = {
    'DESPESAS DA UNIDADE': [
        'CUSTO OPERACIONAL INDÚSTRIA',
        'CUSTO COMERCIAL GERÊNCIA',
        'CUSTO COMERCIAL VENDEDORES',
        'CUSTO OPERACIONAL ADMINISTRATIVO',
        'OUTRAS DESPESAS'
    ],
    'TRANSPORTE': ['CUSTO TRANSPORTE', 'GERAL'],
    'ADMINISTRATIVO': ['CUSTO RATEIO DESPESAS ADMINISTRATIVAS', 'GERAL'],
    'IMPOSTOS': ['CUSTO IMPOSTOS', 'GERAL'],
    'INVESTIMENTOS': ['INVESTIMENTOS GERAIS', 'GERAL']
};

const ManualEntryForm = ({ onClose, segments, currentUnit, onSave, user, initialData, showToast }) => {
    const [form, setForm] = useState({
        date: new Date().toISOString().slice(0, 10),
        type: 'expense',
        description: '',
        value: '',
        segment: currentUnit || '',
        accountPlan: '',
        grupo: '',
        subgrupo: '',
        source: 'manual',
        revenueType: '',
        revenueSubType: '',
        costCenterInput: ''
    });

    const [costCenterDict, setCostCenterDict] = useState([]);
    const [loadingCC, setLoadingCC] = useState(false);

    // Fetch Cost Center Dictionary
    useEffect(() => {
        const fetchCCDictionary = async () => {
            setLoadingCC(true);
            try {
                const data = await dbService.getAll(user, 'costcenter_dictionary');
                setCostCenterDict(data || []);
            } catch (error) {
                console.error("Error fetching cost centers:", error);
            } finally {
                setLoadingCC(false);
            }
        };
        fetchCCDictionary();
    }, [user]);

    useEffect(() => {
        if (initialData) {
            let safeDate = new Date().toISOString().slice(0, 10);
            if (initialData.date) {
                safeDate = initialData.date.substring(0, 10);
            }

            setForm({
                ...initialData,
                date: safeDate,
                source: initialData.source || 'manual',
                accountPlan: initialData.accountPlan || '',
                grupo: initialData.grupo || '',
                subgrupo: initialData.subgrupo || '',
                revenueType: initialData.revenueType || '',
                revenueSubType: initialData.revenueSubType || '',
                costCenterInput: initialData.costCenterInput || (initialData.costCenter ? initialData.costCenter.split(' ')[0] : '')
            });
        }
    }, [initialData]);

    const classOptions = useMemo(() => {
        return PLANO_CONTAS
            .filter(p => !p.code.startsWith('06'))
            .map(p => ({ value: p.code, label: p.name })) // O usuário quer retirar códigos, mas o PLANO_CONTAS tem nomes explicativos. Vou tentar remover o prefixo de código se existir.
            .map(opt => ({ ...opt, label: opt.label.includes(' - ') ? opt.label.split(' - ')[1] : opt.label }));
    }, []);

    const groupOptions = GROUPS.map(g => ({ value: g, label: g }));

    const subGroupOptions = useMemo(() => {
        if (!form.grupo) return [];
        const subs = SUB_GROUPS[form.grupo] || [];
        return subs.map(s => ({ value: s, label: s }));
    }, [form.grupo]);

    const handleSubmit = async () => {
        const val = parseFloat(form.value);

        if (!form.description) return showToast("Preencha o histórico/descrição.", 'error');
        if (isNaN(val)) return showToast("Preencha um valor válido.", 'error');

        let planDesc = '';
        let finalAccountPlan = form.accountPlan;

        if (form.type === 'expense') {
            if (!form.grupo) return showToast("Selecione o grupo.", 'error');
            if (!form.accountPlan) return showToast("Selecione a classe.", 'error');
            const planItem = PLANO_CONTAS.find(p => p.code === form.accountPlan);
            planDesc = planItem ? planItem.name : '';
        } else {
            // Mapping revenue types to a generic account plan structure for consistency
            if (!form.revenueType) return showToast("Selecione o tipo de receita.", 'error');
            if (['Receita de Material', 'Receita de Frete'].includes(form.revenueType) && !form.revenueSubType) {
                return showToast("Selecione o sub-tipo da receita.", 'error');
            }
            finalAccountPlan = '01.00'; // Generic Revenue Code
            planDesc = `${form.revenueType} ${form.revenueSubType ? `- ${form.revenueSubType}` : ''}`;
        }

        let finalCostCenter = '';
        if (form.costCenterInput) {
            const ccItem = costCenterDict.find(c => c.codigo === form.costCenterInput);
            if (ccItem) {
                finalCostCenter = `${ccItem.codigo} - ${ccItem.nome}`;
            } else {
                finalCostCenter = `${form.costCenterInput} - Adicionado Manualmente`;
            }
        }

        const tx = {
            ...form,
            value: val,
            accountPlan: finalAccountPlan,
            planDescription: planDesc,
            costCenter: finalCostCenter,
            segment: currentUnit || form.segment, // Garante que a unidade do contexto seja usada
            updatedAt: new Date().toISOString()
        };

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
                onSave();
                onClose();
            }
        } catch (e) {
            showToast("Erro ao salvar.", 'error');
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 w-full rounded-[3rem] shadow-[0_25px_80px_rgba(0,0,0,0.1)] border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-6 duration-700">

            {/* Header with Gradient Backdrop */}
            <div className="relative p-10 pb-6 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
                <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 -translate-x-1/2 blur-2xl pointer-events-none" />

                <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-6">
                        <button onClick={onClose} className="p-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-[1.25rem] transition-all text-slate-600 dark:text-slate-300 group">
                            <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <div>
                            <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                                {initialData ? 'Editar Lançamento' : 'Novo Lançamento'}
                            </h2>
                            <div className="flex items-center gap-2 text-slate-500 font-semibold text-sm">
                                <span className="opacity-60 italic">Registrando para:</span>
                                <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center gap-2">
                                    <Layout size={14} />
                                    {currentUnit || 'Global'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden px-8 flex">
                <div className="h-full w-48 bg-emerald-500 rounded-full transition-all duration-700" />
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {form.type === 'expense' ? (
                        <>
                            {/* CENTRO DE CUSTO */}
                            <SearchableSelect
                                label="CENTRO DE CUSTO"
                                placeholder={loadingCC ? "Carregando..." : "Selecione o Centro de Custo"}
                                options={costCenterDict.map(cc => ({
                                    value: cc.codigo,
                                    label: `${cc.codigo} - ${cc.nome}`
                                }))}
                                value={form.costCenterInput}
                                onChange={val => {
                                    const selectedCC = costCenterDict.find(cc => cc.codigo === val);
                                    setForm(prev => ({
                                        ...prev,
                                        costCenterInput: val,
                                        description: selectedCC && !prev.description ? selectedCC.nome : prev.description
                                    }));
                                }}
                                disabled={loadingCC}
                                icon={Building2}
                            />

                            {/* GRUPO */}
                            <SearchableSelect
                                label="GRUPO"
                                placeholder="Selecione o grupo"
                                options={groupOptions}
                                value={form.grupo}
                                onChange={val => setForm({ ...form, grupo: val, subgrupo: '' })}
                                icon={Layers}
                                showSearch={false}
                            />

                            {/* SUB-GRUPO */}
                            <SearchableSelect
                                label="SUB-GRUPO"
                                placeholder="Selecione o sub-grupo"
                                options={subGroupOptions}
                                value={form.subgrupo}
                                onChange={val => setForm({ ...form, subgrupo: val })}
                                disabled={!form.grupo}
                                icon={Bookmark}
                                showSearch={false}
                            />

                            {/* CLASSE */}
                            <SearchableSelect
                                label="CLASSE"
                                placeholder="Selecione a classe"
                                options={classOptions}
                                value={form.accountPlan}
                                onChange={val => setForm({ ...form, accountPlan: val })}
                                icon={Tag}
                            />
                        </>
                    ) : (
                        <>
                            {/* TIPO DE RECEITA */}
                            <SearchableSelect
                                label="TIPO DE RECEITA"
                                placeholder="Selecione o tipo"
                                options={[
                                    { value: 'Receita de Material', label: 'Receita de Material' },
                                    { value: 'Receita de Frete', label: 'Receita de Frete' },
                                    { value: 'Subsídio de Terceiros', label: 'Subsídio de Terceiros' }
                                ]}
                                value={form.revenueType}
                                onChange={val => setForm({ ...form, revenueType: val, revenueSubType: '' })}
                                icon={HeartHandshake}
                                showSearch={false}
                            />

                            {/* SUB-TIPO DE RECEITA */}
                            {form.revenueType === 'Receita de Material' && (
                                <SearchableSelect
                                    label="ENTREGA OU RETIRA"
                                    placeholder="Selecione"
                                    options={[
                                        { value: 'Retira', label: 'Retira' },
                                        { value: 'Entrega', label: 'Entrega' }
                                    ]}
                                    value={form.revenueSubType}
                                    onChange={val => setForm({ ...form, revenueSubType: val })}
                                    icon={Package}
                                    showSearch={false}
                                />
                            )}

                            {form.revenueType === 'Receita de Frete' && (
                                <SearchableSelect
                                    label="MODALIDADE DE FRETE"
                                    placeholder="Selecione a modalidade"
                                    options={[
                                        { value: 'Carreta', label: 'Carreta' },
                                        { value: 'Truck', label: 'Truck' },
                                        { value: 'Terceiros', label: 'Terceiros' }
                                    ]}
                                    value={form.revenueSubType}
                                    onChange={val => setForm({ ...form, revenueSubType: val })}
                                    icon={Truck}
                                    showSearch={false}
                                />
                            )}
                        </>
                    )}
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

export default ManualEntryForm;
