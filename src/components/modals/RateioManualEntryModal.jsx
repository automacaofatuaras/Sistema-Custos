import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import dbService from '../../services/dbService';
import SearchableSelect from '../common/SearchableSelect';

const RateioManualEntryModal = ({ onClose, onSave, user, initialData, showToast }) => {
    const [optionsOptions, setOptionsOptions] = useState({
        costCenters: [],
        classes: [],
        descriptions: [],
        ccToDescMap: {}
    });
    const [form, setForm] = useState({
        date: new Date().toISOString().slice(0, 10),
        costCenter: '',
        costCenterDescription: '',
        classification: '',
        value: '',
        observation: '',
        type: 'rateio_manual'
    });

    useEffect(() => {
        if (initialData) {
            let safeDate = new Date().toISOString().slice(0, 10);
            if (initialData.date) {
                // Tenta extrair a data no formato YYYY-MM-DD
                safeDate = initialData.date.length > 10 ? initialData.date.substring(0, 10) : initialData.date;
            }

            setForm({
                ...initialData,
                date: safeDate,
                costCenter: initialData.costCenter || '',
                costCenterDescription: initialData.costCenterDescription || '',
                classification: initialData.classification || '',
                value: initialData.value || '',
                observation: initialData.observation || '',
                type: 'rateio_manual'
            });
        }
    }, [initialData]);

    useEffect(() => {
        const fetchOptions = async () => {
            try {
                // Busca de cadastros para as opções predefinidas
                const diretos = await dbService.getAll(user, 'rateio_adm_cc_diretos') || [];
                const indiretos = await dbService.getAll(user, 'rateio_adm_cc_indiretos') || [];
                const classesArr = await dbService.getAll(user, 'rateio_adm_classes') || [];

                // Combina CCs e cria o mapa CC -> Nome
                const allCCs = [...diretos, ...indiretos];
                const map = {};
                const ccCodes = [];

                allCCs.forEach(cc => {
                    if (cc.code) {
                        ccCodes.push(cc.code);
                        if (cc.name) {
                            map[cc.code] = cc.name;
                        }
                    }
                });

                // Extrai as classes
                const cls = classesArr.map(c => c.name || c.code).filter(Boolean).sort();

                // Extrai as descrições únicas disponíveis
                const dsc = [...new Set(Object.values(map))].sort();

                setOptionsOptions({
                    costCenters: ccCodes.sort(),
                    classes: cls,
                    descriptions: dsc,
                    ccToDescMap: map
                });
            } catch (error) {
                console.error('Erro ao buscar opões para selects:', error);
            }
        };

        fetchOptions();
    }, [user]);

    const handleSubmit = async () => {
        const val = parseFloat(form.value);

        if (!form.date) return showToast("Preencha a data.", 'error');
        if (!form.costCenter) return showToast("Preencha o centro de custo.", 'error');
        if (!form.classification) return showToast("Preencha a classe.", 'error');
        if (isNaN(val)) return showToast("Preencha o valor corretamente.", 'error');

        const tx = {
            date: form.date,
            value: val,
            type: form.type,
            costCenter: form.costCenter,
            costCenterDescription: form.costCenterDescription,
            classification: form.classification,
            observation: form.observation,
            source: 'manual_rateio',
            updatedAt: new Date().toISOString()
        };

        if (!initialData?.id) {
            tx.createdAt = new Date().toISOString();
        }

        try {
            if (initialData?.id) {
                await dbService.update(user, 'rateio_transactions', String(initialData.id), tx);
                showToast("Lançamento atualizado!", 'success');
                onSave();
                onClose();
            } else {
                await dbService.add(user, 'rateio_transactions', tx);
                showToast("Salvo! Pode fazer o próximo.", 'success');
                setForm(prev => ({ ...prev, value: '', costCenterDescription: '', observation: '' }));
                onSave();
            }
        } catch (e) {
            console.error('Erro ao salvar no db:', e);
            showToast("Erro ao salvar.", 'error');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border dark:border-slate-700">
                <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                    <h2 className="font-bold">{initialData ? 'Editar Lançamento (Rateio)' : 'Novo Lançamento (Rateio)'}</h2>
                    <button onClick={onClose}><X size={20} /></button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                        <input type="date" className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Centro de Custo</label>
                        <SearchableSelect
                            options={optionsOptions.costCenters}
                            value={form.costCenter}
                            placeholder="Buscar Centro de Custo..."
                            onChange={(val) => {
                                setForm(prev => ({
                                    ...prev,
                                    costCenter: val,
                                    costCenterDescription: optionsOptions.ccToDescMap[val] || prev.costCenterDescription
                                }));
                            }}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Descrição do Centro de Custo</label>
                        <SearchableSelect
                            options={optionsOptions.descriptions}
                            value={form.costCenterDescription}
                            placeholder="Buscar Descrição..."
                            onChange={(val) => setForm({ ...form, costCenterDescription: val })}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Classe</label>
                        <SearchableSelect
                            options={optionsOptions.classes}
                            value={form.classification}
                            placeholder="Buscar Classe..."
                            onChange={(val) => setForm({ ...form, classification: val })}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Valor (R$)</label>
                        <input type="number" step="0.01" className="w-full border p-3 rounded-lg text-xl font-bold dark:bg-slate-700 dark:text-white" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Observação</label>
                        <textarea className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white resize-none h-20" placeholder="Informações adicionais..." value={form.observation} onChange={e => setForm({ ...form, observation: e.target.value })}></textarea>
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

export default RateioManualEntryModal;
