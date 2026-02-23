import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Save, Loader2, Briefcase, Users, Building, Tag, Hash, UploadCloud, Edit2, X, Search } from 'lucide-react';
import dbService from '../../../../services/dbService';

const TABS = [
    { id: 'diretos', label: 'CC Diretos', icon: Building, col: 'rateio_adm_cc_diretos', fields: [{ name: 'code', label: 'Código CC' }, { name: 'name', label: 'Nome CC' }, { name: 'segment', label: 'Segmento' }] },
    { id: 'indiretos', label: 'CC Indiretos', icon: Building, col: 'rateio_adm_cc_indiretos', fields: [{ name: 'code', label: 'Código CC' }, { name: 'name', label: 'Nome CC' }] },
    { id: 'segmentos', label: 'Segmentos', icon: Briefcase, col: 'rateio_adm_segmentos', fields: [{ name: 'name', label: 'Nome do Segmento' }] },
    { id: 'classes', label: 'Classes Contábeis', icon: Tag, col: 'rateio_adm_classes', fields: [{ name: 'code', label: 'Código da Classe' }, { name: 'name', label: 'Descrição' }] },
    { id: 'gestores', label: 'Gestores', icon: Users, col: 'rateio_adm_gestores', fields: [{ name: 'name', label: 'Nome do Gestor' }, { name: 'email', label: 'E-mail' }, { name: 'linkedCostCenters', label: 'Centros de Custo (Vínculos)', type: 'multi-select' }] }
];

export default function CadastroConfig() {
    const [activeTab, setActiveTab] = useState(TABS[0]);
    const [data, setData] = useState([]);
    const [segmentOptions, setSegmentOptions] = useState([]);
    const [costCenterOptions, setCostCenterOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef(null);

    const loadData = async (tab) => {
        setLoading(true);
        try {
            const result = await dbService.getAll(null, tab.col);
            setData(result || []);

            if (tab.id === 'diretos') {
                const segs = await dbService.getAll(null, 'rateio_adm_segmentos');
                setSegmentOptions(segs || []);
            }

            if (tab.id === 'gestores') {
                const diretos = await dbService.getAll(null, 'rateio_adm_cc_diretos');
                const indiretos = await dbService.getAll(null, 'rateio_adm_cc_indiretos');
                const allCCs = [...(diretos || []), ...(indiretos || [])].sort((a, b) => {
                    const codeA = a.code || '';
                    const codeB = b.code || '';
                    return codeA.localeCompare(codeB);
                });
                setCostCenterOptions(allCCs);
            }
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            setData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData(activeTab);
        setFormData({});
        setEditingId(null);
        setIsModalOpen(false);
        setSelectedIds([]);
        setSearchTerm('');
    }, [activeTab]);

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            if (editingId) {
                await dbService.update(null, activeTab.col, editingId, formData);
            } else {
                await dbService.add(null, activeTab.col, formData);
            }
            setFormData({});
            setEditingId(null);
            setIsModalOpen(false);
            await loadData(activeTab);
        } catch (error) {
            console.error("Erro ao salvar:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (item) => {
        setEditingId(item.id);
        const newFormData = {};
        activeTab.fields.forEach(f => {
            newFormData[f.name] = item[f.name];
        });
        setFormData(newFormData);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir este item?')) return;
        setLoading(true);
        try {
            await dbService.del(null, activeTab.col, id);
            await loadData(activeTab);
            setSelectedIds(prev => prev.filter(selId => selId !== id));
        } catch (error) {
            console.error("Erro ao excluir:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter data based on search term
    const filteredData = data.filter(item => {
        if (!searchTerm) return true;
        const lowerTerm = searchTerm.toLowerCase();
        return activeTab.fields.some(field => {
            const val = item[field.name];
            return val && val.toString().toLowerCase().includes(lowerTerm);
        });
    });

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(filteredData.map(item => item.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectRow = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Tem certeza que deseja excluir ${selectedIds.length} iten(s)?`)) return;
        setLoading(true);
        try {
            for (const id of selectedIds) {
                await dbService.del(null, activeTab.col, id);
            }
            setSelectedIds([]);
            await loadData(activeTab);
        } catch (error) {
            console.error("Erro ao excluir em massa:", error);
            alert("Erro ao excluir itens.");
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e, fieldName) => {
        setFormData(prev => ({ ...prev, [fieldName]: e.target.value }));
    };

    const handleMultiSelectChange = (fieldName, itemCode) => {
        setFormData(prev => {
            const currentList = prev[fieldName] || [];
            if (currentList.includes(itemCode)) {
                return { ...prev, [fieldName]: currentList.filter(c => c !== itemCode) };
            } else {
                return { ...prev, [fieldName]: [...currentList, itemCode] };
            }
        });
    };

    const handleCsvImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target.result;
                const lines = text.split('\n').filter(line => line.trim() !== '');

                const parsedData = lines.map(line => {
                    const parts = line.split(/[;,]/);
                    const item = {};
                    activeTab.fields.forEach((field, i) => {
                        let val = parts[i] ? parts[i].trim() : '';
                        if (val.startsWith('"') && val.endsWith('"')) {
                            val = val.substring(1, val.length - 1);
                        }
                        item[field.name] = val;
                    });
                    return item;
                });

                if (parsedData.length > 0) {
                    const firstItem = parsedData[0];
                    const isHeader = activeTab.fields.some(f =>
                        firstItem[f.name]?.toLowerCase() === f.label.toLowerCase() ||
                        firstItem[f.name]?.toLowerCase() === f.name.toLowerCase()
                    );
                    if (isHeader) parsedData.shift();
                }

                if (parsedData.length > 0) {
                    await dbService.addBulk(null, activeTab.col, parsedData);
                    await loadData(activeTab);
                    alert(`${parsedData.length} registros importados com sucesso!`);
                } else {
                    alert('Nenhum dado válido encontrado no CSV.');
                }
            } catch (error) {
                console.error("Erro ao importar CSV:", error);
                alert("Erro ao importar arquivo CSV.");
            } finally {
                setLoading(false);
                if (e.target) e.target.value = null;
            }
        };

        reader.onerror = () => {
            alert('Erro na leitura do arquivo.');
            setLoading(false);
        };

        reader.readAsText(file);
    };

    return (
        <>
            <div className="flex flex-col md:flex-row gap-6 animate-in fade-in duration-300">
                {/* Sidebar for Config Tabs */}
                <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-2 px-2">Configurações</h3>
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab.id === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold w-full text-left
                                ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                                <Icon size={18} />
                                {tab.label}
                            </button>
                        )
                    })}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border dark:border-slate-700">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <h4 className="text-xl font-bold dark:text-white flex items-center gap-2 shrink-0">
                            <activeTab.icon className="text-indigo-500" size={24} />
                            Gerenciar {activeTab.label}
                        </h4>

                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-white"
                                />
                            </div>
                            {selectedIds.length > 0 && (
                                <button
                                    onClick={handleBulkDelete}
                                    disabled={loading}
                                    className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50 w-full sm:w-auto justify-center shrink-0"
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                    Excluir Selecionados ({selectedIds.length})
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-4 mb-6">
                        <button
                            onClick={() => { setFormData({}); setEditingId(null); setIsModalOpen(true); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 text-sm transition-colors shadow-sm"
                        >
                            <Plus size={16} />
                            Novo Cadastro
                        </button>

                        <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleCsvImport} />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={loading}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 text-sm transition-colors shadow-sm disabled:opacity-50"
                            title="As colunas do CSV devem seguir a mesma ordem dos campos na tela."
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                            Importar CSV
                        </button>
                    </div>

                    {/* Data Table */}
                    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                        {loading && data.length === 0 ? (
                            <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
                        ) : (data.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 font-medium">Nenhum registro encontrado.</div>
                        ) : (filteredData.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 font-medium">Sua busca não encontrou resultados.</div>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 font-bold uppercase text-[10px]">
                                    <tr>
                                        <th className="p-4 w-12">
                                            <input
                                                type="checkbox"
                                                checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                                                onChange={handleSelectAll}
                                                className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </th>
                                        {activeTab.fields.map(field => (
                                            <th key={field.name} className="p-4">{field.label}</th>
                                        ))}
                                        <th className="p-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-700">
                                    {filteredData
                                        .slice()
                                        .sort((a, b) => {
                                            const fieldNameA = a[activeTab.fields[0].name] || '';
                                            const fieldNameB = b[activeTab.fields[0].name] || '';
                                            return fieldNameA.toString().localeCompare(fieldNameB.toString());
                                        })
                                        .map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="p-4 w-12">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(item.id)}
                                                        onChange={() => handleSelectRow(item.id)}
                                                        className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                </td>
                                                {activeTab.fields.map(field => (
                                                    <td key={field.name} className="p-4 py-3 dark:text-slate-300 font-medium">
                                                        {field.type === 'multi-select' ? (
                                                            <div className="max-w-[300px] flex flex-wrap gap-1">
                                                                {(item[field.name] || []).length > 0 ? (
                                                                    (item[field.name] || []).map(code => (
                                                                        <span key={code} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" title={costCenterOptions.find(c => c.code === code)?.name || code}>
                                                                            {code}
                                                                        </span>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-slate-400 italic text-xs">Nenhum vínculo</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            item[field.name]
                                                        )}
                                                    </td>
                                                ))}
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleEditClick(item)}
                                                            className="text-amber-500 hover:text-amber-600 transition-colors p-2 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg"
                                                            title="Editar"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(item.id)}
                                                            className="text-rose-400 hover:text-rose-600 transition-colors p-2 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        )))}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 duration-300">
                            <div className="flex justify-between items-center p-6 border-b dark:border-slate-700">
                                <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                                    <activeTab.icon className="text-indigo-500" size={24} />
                                    {editingId ? 'Editar' : 'Novo'} {activeTab.label}
                                </h3>
                                <button onClick={() => { setIsModalOpen(false); setEditingId(null); setFormData({}); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-6 overflow-auto space-y-4">
                                {activeTab.fields.map(field => (
                                    <div key={field.name} className="w-full">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{field.label}</label>
                                        {field.name === 'segment' ? (
                                            <select
                                                required
                                                value={formData[field.name] || ''}
                                                onChange={(e) => handleInputChange(e, field.name)}
                                                className="w-full px-4 py-2 rounded-lg border dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-white"
                                            >
                                                <option value="" disabled>Selecione um segmento</option>
                                                {segmentOptions.map(seg => (
                                                    <option key={seg.id || seg.name} value={seg.name}>{seg.name}</option>
                                                ))}
                                            </select>
                                        ) : field.type === 'multi-select' ? (
                                            <div className="p-3 border dark:border-slate-600 rounded-lg max-h-64 overflow-auto bg-slate-50 dark:bg-slate-900 grid gap-2">
                                                {costCenterOptions.map(cc => {
                                                    const isChecked = (formData[field.name] || []).includes(cc.code);
                                                    return (
                                                        <label key={cc.code} className="flex items-start gap-2 text-sm cursor-pointer group">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => handleMultiSelectChange(field.name, cc.code)}
                                                                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                            />
                                                            <span className={`${isChecked ? 'text-indigo-700 dark:text-indigo-400 font-medium' : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'} leading-tight`}>
                                                                {cc.code} - {cc.name}
                                                            </span>
                                                        </label>
                                                    )
                                                })}
                                                {costCenterOptions.length === 0 && <span className="text-xs text-slate-400">Nenhum Centro de Custo cadastrado.</span>}
                                            </div>
                                        ) : (
                                            <input
                                                type={field.name === 'email' ? 'email' : 'text'}
                                                required={field.type !== 'multi-select'}
                                                value={formData[field.name] || ''}
                                                onChange={(e) => handleInputChange(e, field.name)}
                                                className="w-full px-4 py-2 rounded-lg border dark:border-slate-600 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm dark:text-white"
                                                placeholder={`Digite ${field.label.toLowerCase()}`}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl shrink-0">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); setEditingId(null); setFormData({}); }}
                                    className="px-6 py-2 rounded-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={loading}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Salvar Cadastro
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    ); // Fix wrapping
}
