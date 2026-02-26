import React, { useState, useEffect, useCallback } from 'react';
import { UploadCloud, CheckCircle, Database, Search, X, FileText, Building2, Trash2 } from 'lucide-react';
import dbService from '../../../services/dbService';

const CostCenterManager = ({ user, showToast }) => {
    const [costCenters, setCostCenters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const [showAll, setShowAll] = useState(false);

    const loadCostCenters = useCallback(async () => {
        setLoading(true);
        try {
            const data = await dbService.getAll(user, 'costcenter_dictionary');
            setCostCenters(data.sort((a, b) => {
                // Sort by date created (newest first) or by code if no date
                if (a.createdAt && b.createdAt) {
                    return new Date(b.createdAt) - new Date(a.createdAt);
                }
                const codeA = parseInt(a.codigo, 10);
                const codeB = parseInt(b.codigo, 10);
                return (isNaN(codeA) ? 0 : codeA) - (isNaN(codeB) ? 0 : codeB);
            }));
        } catch (e) {
            console.error("Erro ao carregar centros de custo:", e);
            showToast('Erro ao carregar o dicionário de centros de custo.', 'error');
        } finally {
            setLoading(false);
        }
    }, [user, showToast]);

    useEffect(() => {
        loadCostCenters();
    }, [loadCostCenters]);

    const processCSV = (content) => {
        const lines = content.split('\n');
        if (lines.length < 2) {
            showToast('O arquivo parece estar vazio ou não possui cabeçalho.', 'error');
            return;
        }

        // Basic check for headers
        const header = lines[0].toLowerCase();
        if (!header.includes('codigo') && !header.includes('código') && !header.includes('nome') && !header.includes('descrição')) {
            showToast('O cabeçalho do CSV deve conter colunas para Código e Nome/Descrição.', 'warning');
            // Proceeding anyway, assuming col 1 = code, col 2 = name
        }

        const newEntries = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const columns = line.split(';'); // Assume semicolon separator typical in PT-BR excels
            let code = columns[0]?.trim();
            let name = columns[1]?.trim();

            if (!name && line.includes(',')) {
                // Fallback to comma separator
                const commaCols = line.split(',');
                code = commaCols[0]?.trim();
                name = commaCols[1]?.trim();
            }

            if (code && name) {
                // Remove extra quotes if present
                code = code.replace(/^"|"$/g, '');
                name = name.replace(/^"|"$/g, '');

                newEntries.push({
                    codigo: code,
                    nome: name,
                    searchText: `${code} ${name}`.toLowerCase()
                });
            }
        }

        if (newEntries.length === 0) {
            showToast('Nenhum dado válido encontrado. Verifique o separador (ponto e vírgula).', 'error');
            return;
        }

        saveToFirebase(newEntries);
    };

    const saveToFirebase = async (entries) => {
        setIsSaving(true);
        try {
            // Option 1: Overwrite everything or merge. We'll do a simple Batch Add for now, 
            // In a real scenario, you might want to clear old, or merge by code.
            // Let's clear the collection first to avoid duplicates for simplicity

            // Delete existing
            const existing = await dbService.getAll(user, 'costcenter_dictionary');
            for (const doc of existing) {
                await dbService.del(user, 'costcenter_dictionary', doc.id);
            }

            // Upload new
            await dbService.addBulk(user, 'costcenter_dictionary', entries.map(e => ({ ...e, createdAt: new Date().toISOString() })));

            showToast(`${entries.length} Centros de Custo importados com sucesso!`, 'success');
            loadCostCenters();
        } catch (e) {
            console.error("Erro importando:", e);
            showToast('Erro ao salvar os Centros de Custo.', 'error');
        } finally {
            setIsSaving(false);
        }
    };


    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            processCSV(evt.target.result);
        };
        reader.readAsText(file, 'UTF-8');
        e.target.value = null; // reset
    };

    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
            const reader = new FileReader();
            reader.onload = (evt) => processCSV(evt.target.result);
            reader.readAsText(file, 'UTF-8');
        } else {
            showToast('Por favor, envie um arquivo .csv', 'error');
        }
    };

    const clearDatabase = async () => {
        if (!window.confirm("Aviso: Isso apagará TODOS os centros de custo do sistema. Deseja continuar?")) return;

        setIsSaving(true);
        try {
            const existing = await dbService.getAll(user, 'costcenter_dictionary');
            for (const doc of existing) {
                await dbService.del(user, 'costcenter_dictionary', doc.id);
            }
            showToast('Banco de dados de Centros de Custo limpo.', 'success');
            setCostCenters([]);
        } catch (e) {
            showToast('Erro ao limpar dados.', 'error');
        } finally {
            setIsSaving(false);
        }
    };


    const filteredCostCenters = costCenters.filter(cc => {
        if (!searchTerm) return true;
        return cc.searchText?.includes(searchTerm.toLowerCase());
    });

    const displayedCostCenters = filteredCostCenters.slice(0, (searchTerm || showAll) ? undefined : 15);

    return (
        <div className="space-y-6 max-w-6xl mx-auto h-full flex flex-col">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <Building2 className="text-indigo-500" size={32} />
                        Centros de Custo
                    </h2>
                    <p className="text-slate-500 mt-2 font-medium">Gerencie o dicionário global de Centros de Custo usado nos Lançamentos.</p>
                </div>

                {costCenters.length > 0 && (
                    <button
                        onClick={clearDatabase}
                        disabled={isSaving}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 dark:text-rose-400 rounded-xl font-bold flex items-center gap-2 transition-all text-sm"
                    >
                        <Trash2 size={16} /> Limpar Base
                    </button>
                )}
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Upload Panel */}
                <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-6 h-fit sticky top-6">
                    <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-500 mb-2">
                        <Database size={32} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Importar Planilha</h3>
                        <p className="text-sm text-slate-500 mt-2 px-4">Faça o upload de um arquivo CSV contendo duas colunas: Código e Nome.</p>
                    </div>

                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`w-full relative overflow-hidden group rounded-[2rem] border-2 border-dashed transition-all duration-300 p-8 ${isDragging
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-inner'
                            : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                    >
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            disabled={isSaving}
                        />
                        <div className="flex flex-col items-center gap-4 relative z-0">
                            <UploadCloud className={`transition-all duration-300 ${isDragging ? 'text-indigo-500 scale-110' : 'text-slate-400 group-hover:text-indigo-400 group-hover:-translate-y-1'}`} size={48} />
                            <div className="space-y-1">
                                <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                                    {isSaving ? 'Processando e Salvando...' : 'Arraste seu CSV aqui'}
                                </p>
                                <p className="text-xs text-slate-500 font-medium">ou clique para selecionar</p>
                            </div>
                        </div>
                    </div>

                    <div className="w-full bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-left space-y-2">
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500" /> Formato Esperado:</p>
                        <p className="text-[10px] text-slate-500 font-mono bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                            Codigo;Nome<br />
                            27000;Noromix Fernandópolis<br />
                            13000;Saara - Mira Estrela<br />
                        </p>
                        <p className="text-[10px] text-rose-500 font-bold mt-2">Nota: Uma nova importação substituirá a lista existente.</p>
                    </div>
                </div>

                {/* Data Table Panel */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col flex-1 overflow-hidden min-h-[500px]">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-sm flex items-center gap-2">
                                <FileText size={16} className="text-indigo-500" />
                                Base Cadastrada
                            </h3>
                            <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded-lg text-xs font-black">
                                {costCenters.length}
                            </span>
                        </div>

                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Pesquisar código ou nome..."
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-500"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto custom-scrollbar relative bg-white dark:bg-slate-900 p-2">
                        {loading || isSaving ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 gap-3">
                                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{isSaving ? 'Salvando Dados...' : 'Carregando'}</p>
                            </div>
                        ) : filteredCostCenters.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 p-8">
                                <Database size={48} className="text-slate-200 dark:text-slate-800 opacity-50" />
                                <p className="font-medium text-center">Nenhum centro de custo cadastrado ou encontrado na pesquisa.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 font-bold uppercase text-[10px] sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-4 rounded-tl-xl w-32">Código</th>
                                        <th className="px-6 py-4 rounded-tr-xl">Descrição</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {displayedCostCenters.map((cc, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 font-mono text-slate-600 dark:text-slate-400 font-bold rounded-lg w-fit group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {cc.codigo}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">
                                                {cc.nome}
                                            </td>
                                        </tr>
                                    ))}
                                    {!searchTerm && !showAll && filteredCostCenters.length > 15 && (
                                        <tr>
                                            <td colSpan="2" className="px-6 py-6 text-center">
                                                <button
                                                    onClick={() => setShowAll(true)}
                                                    className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
                                                >
                                                    Visualizar todos os {filteredCostCenters.length} registros
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CostCenterManager;
