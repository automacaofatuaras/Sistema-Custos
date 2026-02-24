import React, { useState, useRef, useMemo } from 'react';
import { UploadCloud, FileText, CheckCircle, AlertTriangle, AlertCircle, Loader2, Save, Trash2, Filter } from 'lucide-react';
import dbService from '../../../../services/dbService';
import { ADMIN_CC_CODES } from '../../../../constants/business';
import { PLANO_CONTAS } from '../../../../constants/planoContas';
import { getUnitByCostCenter } from '../../../../utils/helpers';
import { formatDate } from '../../../../utils/formatters';

export default function ImportacaoTXT() {
    const [file, setFile] = useState(null);
    const [parsedData, setParsedData] = useState([]);
    const [importHistory, setImportHistory] = useState([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const fileInputRef = useRef(null);

    // Dynamic config data
    const [configData, setConfigData] = useState({
        classes: [],
        ccDiretos: [],
        ccIndiretos: [],
        segmentos: []
    });

    React.useEffect(() => {
        const fetchConfig = async () => {
            try {
                const [classes, diretos, indiretos, segmentos, txList] = await Promise.all([
                    dbService.getAll(null, 'rateio_adm_classes'),
                    dbService.getAll(null, 'rateio_adm_cc_diretos'),
                    dbService.getAll(null, 'rateio_adm_cc_indiretos'),
                    dbService.getAll(null, 'rateio_adm_segmentos'),
                    dbService.getAll(null, 'rateio_adm_transactions')
                ]);
                setConfigData({
                    classes: classes || [],
                    ccDiretos: diretos || [],
                    ccIndiretos: indiretos || [],
                    segmentos: segmentos || []
                });

                // Compute import history from unique sources
                const historyMap = {};
                (txList || []).forEach(tx => {
                    const batchId = tx.importBatchId || tx.sourceFile || 'legacy_imports';
                    if (!historyMap[batchId]) {
                        historyMap[batchId] = {
                            batchId,
                            filename: tx.sourceFile || 'Importações Antigas (Sem Arquivo)',
                            count: 0,
                            totalValue: 0,
                            importDate: tx.timestamp || new Date(0).toISOString()
                        };
                    }
                    historyMap[batchId].count += 1;
                    historyMap[batchId].totalValue += (tx.value || 0);
                });
                setImportHistory(Object.values(historyMap).sort((a, b) => new Date(b.importDate) - new Date(a.importDate)));

            } catch (err) {
                console.error("Erro ao carregar configurações:", err);
            }
        };
        fetchConfig();
    }, []);

    const analyzeConsistency = (row, confData) => {
        if (row.accountClass === 'MOV.EST') return [];

        const issues = [];
        const descLower = (row.description || "").toLowerCase();
        const plan = (row.planDescription || "").toLowerCase();
        const code = row.accountClass || "";

        if (descLower.includes('diesel') || descLower.includes('combustivel')) {
            if (!plan.includes('combustível') && !plan.includes('veículos') && !code.includes('03.07')) issues.push("Item parece Combustível, mas classe difere.");
        }
        if (descLower.includes('pneu') || descLower.includes('manuten') || descLower.includes('peça')) {
            if (!plan.includes('manutenção') && !code.includes('03.05')) issues.push("Item parece Manutenção, mas classe difere.");
        }
        if (descLower.includes('energia') || descLower.includes('eletrica')) {
            if (!plan.includes('energia') && !plan.includes('administrativa')) issues.push("Item parece Energia, verifique a classe.");
        }

        const ccCodeStr = row.costCenter ? row.costCenter.split(' ')[0] : '0';
        const isDbDir = confData.ccDiretos.some(c => c.code.toString() === ccCodeStr);
        const isDbInd = confData.ccIndiretos.some(c => c.code.toString() === ccCodeStr);

        if (!isDbDir && !isDbInd) {
            issues.push("Centro de Custo não cadastrado em Diretos nem Indiretos.");
        }

        const isCostClass = code.startsWith('03');
        const isExpClass = code.startsWith('04');

        if (isDbInd && isCostClass) {
            issues.push("Alerta: Custo Operacional (03) lançado em Centro de Custo Indireto.");
        }
        if (isDbDir && isExpClass && !plan.includes('rateio')) {
            issues.push("Alerta: Despesa Administrativa (04) lançada em Centro de Custo Direto.");
        }

        return issues;
    };

    const handleEditRow = (id, field, value) => {
        setParsedData(prev => prev.map(row => {
            if (row.id !== id) return row;
            const updatedRow = { ...row, [field]: value };
            if (field === 'accountClass') {
                const found = configData.classes.find(p => p.code === value);
                if (found) updatedRow.planDescription = found.name;
            }
            if (field === 'costCenter') {
                const cleanCode = value.split(' ')[0];
                updatedRow.costCenterCode = cleanCode;
                const dirMatch = configData.ccDiretos.find(c => c.code.toString() === cleanCode);
                if (dirMatch) {
                    updatedRow.segment = dirMatch.segment || 'Geral';
                    updatedRow.type = 'Direto';
                } else {
                    const indMatch = configData.ccIndiretos.find(c => c.code.toString() === cleanCode);
                    if (indMatch) {
                        updatedRow.segment = 'Geral';
                        updatedRow.type = 'Indireto';
                    }
                }
            }
            return updatedRow;
        }));
    };

    const handleDeleteRow = (id) => {
        setParsedData(prev => prev.filter(row => row.id !== id));
    };

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;
        setFile(selectedFile);
        setError(null);
        setSuccessMessage(null);
        setParsedData([]);
    };

    // Mapeamento estático para reclassificação forçada de CCs na importação
    const RECLASSIFICACAO_CC = {
        // Grupo que vai para 1105
        '27123': '1105', '10123': '1105', '22123': '1105', '25123': '1105',
        '34123': '1105', '33123': '1105', '38123': '1105', '29123': '1105',
        '9123': '1105', '28123': '1105', '8123': '1105',
        // Grupo que vai para 1104
        '20223': '1104', '5223': '1104', '2323': '1104', '26323': '1104',
        '4223': '1104', '3123': '1104', '13123': '1104', '14123': '1104',
        '32123': '1104', '21123': '1104', '17123': '1104', '6123': '1104',
        '31123': '1104', '7123': '1104'
    };

    const handleParse = () => {
        if (!file) return;
        setIsParsing(true);
        setError(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const lines = text.split('\n').filter(line => line.trim() !== '');

                let headerIndex = -1;
                let colMap = {};

                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes('PRGER-CCUS') || lines[i].includes('PRMAT-CCUS')) {
                        headerIndex = i;
                        const cleanHeader = lines[i].replace(/"/g, '');
                        const cols = cleanHeader.split(';');
                        cols.forEach((col, idx) => { colMap[col.trim()] = idx; });
                        break;
                    }
                }

                if (headerIndex === -1) {
                    setError("Cabeçalho não identificado (PRGER-CCUS ou PRMAT-CCUS não encontrados).");
                    setIsParsing(false);
                    return;
                }

                const parsed = [];
                const batchId = `import_${Date.now()}`;
                const hasSaidaColumns = colMap.hasOwnProperty('PRMAT-CCUS');
                const hasEntradaColumns = colMap.hasOwnProperty('PRGER-CCUS');
                const hasTypeColumn = colMap.hasOwnProperty('PRGER-TPLC');

                for (let i = headerIndex + 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const cleanLine = line.replace(/"/g, '');
                    const cols = cleanLine.split(';');

                    let isOutputRow = false;

                    if (hasTypeColumn) {
                        const typeVal = cols[colMap['PRGER-TPLC']]?.trim().toUpperCase() || '';
                        if (typeVal.includes('SAIDA') || typeVal.includes('SAÍDA')) {
                            isOutputRow = true;
                        }
                    } else if (hasSaidaColumns && !hasEntradaColumns) {
                        isOutputRow = true;
                    }

                    if (isOutputRow && hasSaidaColumns) {
                        let originalCcCode = cols[colMap['PRMAT-CCUS']]?.trim();
                        let ccCode = originalCcCode;
                        let ccDesc = cols[colMap['PRMAT-NCUS']]?.trim() || '';

                        // Aplicar Reclassificação, se aplicável
                        if (RECLASSIFICACAO_CC[ccCode]) {
                            ccCode = RECLASSIFICACAO_CC[ccCode];
                            // Tentativa de buscar o descritivo oficial da tabela de configs
                            const configMatch = [...configData.ccDiretos, ...configData.ccIndiretos].find(c => c.code.toString() === ccCode);
                            ccDesc = configMatch && configMatch.name ? configMatch.name : (ccCode === '1105' ? 'Reclassificado 1105' : 'Reclassificado 1104');
                        }

                        const rawDate = cols[colMap['PRGER-DATA']]?.trim();
                        const supplier = cols[colMap['PRMAT-NSUB']]?.trim() || 'Estoque';
                        const description = cols[colMap['PRMAT-NOME']]?.trim();
                        const rawValue = cols[colMap['PRGER-TTEN']]?.trim();

                        if (!ccCode || !rawValue) continue;

                        let value = parseFloat(rawValue);
                        if (isNaN(value)) value = 0;
                        value = Math.abs(value / 1000);

                        let isoDate = new Date().toISOString().split('T')[0];
                        if (rawDate && rawDate.length === 10) {
                            const parts = rawDate.split('/');
                            if (parts.length === 3) isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        }

                        // Determine Segment and Type Based on Config List
                        let finalSegment = 'Geral';
                        let finalType = 'Indireto';
                        const isDirConfig = configData.ccDiretos.find(cc => cc.code.toString() === ccCode);
                        if (isDirConfig) {
                            finalSegment = isDirConfig.segment || 'Geral';
                            finalType = 'Direto';
                        } else {
                            const isIndConfig = configData.ccIndiretos.find(cc => cc.code.toString() === ccCode);
                            if (isIndConfig) {
                                finalType = 'Indireto';
                            } else {
                                const detectedUnit = getUnitByCostCenter(ccCode);
                                if (detectedUnit) finalSegment = detectedUnit;
                            }
                        }

                        parsed.push({
                            id: `temp_${Date.now()}_${i}`,
                            date: isoDate, // Storing as YYYY-MM-DD for easier filtering if needed later
                            costCenter: `${ccCode} - ${ccDesc}`,
                            costCenterCode: ccCode,
                            accountClass: 'MOV.EST',
                            planDescription: 'Movimentação de Estoque',
                            description: `${supplier} - ${description}`,
                            segment: finalSegment,
                            type: finalType,
                            value: value,
                            timestamp: new Date().toISOString(),
                            sourceFile: file.name,
                            importBatchId: batchId
                        });

                    } else if (hasEntradaColumns) {
                        let originalCcCode = cols[colMap['PRGER-CCUS']]?.trim();
                        if (!originalCcCode) continue;

                        let ccCode = originalCcCode;
                        let ccDesc = cols[colMap['PRGER-NCCU']]?.trim() || '';

                        // Aplicar Reclassificação de CC
                        if (RECLASSIFICACAO_CC[ccCode]) {
                            ccCode = RECLASSIFICACAO_CC[ccCode];
                            // Tentar mesclar com nome oficial
                            const configMatch = [...configData.ccDiretos, ...configData.ccIndiretos].find(c => c.code.toString() === ccCode);
                            ccDesc = configMatch && configMatch.name ? configMatch.name : (ccCode === '1105' ? 'Reclassificado 1105' : 'Reclassificado 1104');
                        }

                        const dateStr = cols[colMap['PRGER-LCTO']]?.trim() || cols[colMap['PRGER-EMIS']]?.trim();
                        const planCode = cols[colMap['PRGER-PLAN']]?.trim() || '00.00';

                        let planDesc = cols[colMap['PRGER-NPLC']]?.trim() || 'Indefinido';
                        // override from config if available
                        const configClass = configData.classes.find(c => c.code.toString() === planCode);
                        if (configClass) planDesc = configClass.name;

                        const supplier = cols[colMap['PRGER-NFOR']]?.trim() || 'Diversos';
                        let rawValue = cols[colMap['PRGER-TOTA']]?.trim();
                        let sortDesc = cols[colMap['PR-SORT']]?.trim();

                        if (!rawValue) continue;

                        rawValue = rawValue.replace(/\./g, '').replace(',', '.');
                        let value = parseFloat(rawValue) / 100;

                        if (isNaN(value) || value === 0) continue;

                        let isoDate = new Date().toISOString().split('T')[0];
                        if (dateStr && dateStr.length === 10) {
                            const parts = dateStr.split('/');
                            if (parts.length === 3) isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        }

                        if (!sortDesc || /^0+$/.test(sortDesc)) { sortDesc = "Lançamento SAF"; }

                        let finalSegment = 'Geral';
                        let finalType = 'Indireto';
                        const isDirConfig = configData.ccDiretos.find(cc => cc.code.toString() === ccCode);
                        if (isDirConfig) {
                            finalSegment = isDirConfig.segment || 'Geral';
                            finalType = 'Direto';
                        } else {
                            const isIndConfig = configData.ccIndiretos.find(cc => cc.code.toString() === ccCode);
                            if (isIndConfig) {
                                finalType = 'Indireto';
                            } else {
                                const detectedUnit = getUnitByCostCenter(ccCode);
                                if (detectedUnit) finalSegment = detectedUnit;
                            }
                        }

                        parsed.push({
                            id: `temp_${Date.now()}_${i}`,
                            date: isoDate,
                            costCenter: `${ccCode} - ${ccDesc}`,
                            costCenterCode: ccCode,
                            accountClass: planCode,
                            planDescription: planDesc,
                            description: `${supplier} - ${sortDesc}`,
                            segment: finalSegment,
                            type: finalType,
                            value: value,
                            timestamp: new Date().toISOString(),
                            sourceFile: file.name,
                            importBatchId: batchId
                        });
                    }
                }

                setParsedData(parsed);
            } catch (err) {
                console.error(err);
                setError('Erro ao processar as linhas do arquivo TXT/CSV.');
            } finally {
                setIsParsing(false);
            }
        };

        reader.onerror = () => {
            setError('Erro no leitor de arquivo do navegador.');
            setIsParsing(false);
        };

        reader.readAsText(file, 'ISO-8859-1'); // Must pass correct encoding to read the txts right
    };

    const handleSave = async () => {
        if (parsedData.length === 0) return;
        setIsSaving(true);
        setError(null);

        try {
            await dbService.addBulk(null, 'rateio_adm_transactions', parsedData);
            setSuccessMessage(`${parsedData.length} registros importados com sucesso!`);

            // Reload history
            const txList = await dbService.getAll(null, 'rateio_adm_transactions');
            const historyMap = {};
            (txList || []).forEach(tx => {
                const bId = tx.importBatchId || tx.sourceFile || 'legacy_imports';
                if (!historyMap[bId]) {
                    historyMap[bId] = {
                        batchId: bId,
                        filename: tx.sourceFile || 'Importações Antigas (Sem Arquivo)',
                        count: 0,
                        totalValue: 0,
                        importDate: tx.timestamp || new Date(0).toISOString()
                    };
                }
                historyMap[bId].count += 1;
                historyMap[bId].totalValue += (tx.value || 0);
            });
            setImportHistory(Object.values(historyMap).sort((a, b) => new Date(b.importDate) - new Date(a.importDate)));

            setParsedData([]);
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err) {
            console.error(err);
            setError('Erro ao salvar no banco de dados.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteBatch = async (batchId) => {
        if (!window.confirm("Deseja realmente excluir todos os itens importados neste lote?")) return;
        setIsSaving(true);
        try {
            const allTx = await dbService.getAll(null, 'rateio_adm_transactions');
            const toDelete = allTx.filter(t => {
                if (batchId === 'legacy_imports' && !t.importBatchId && !t.sourceFile) return true;
                return t.importBatchId === batchId || t.sourceFile === batchId;
            }).map(t => t.id);
            await dbService.deleteBulk(null, 'rateio_adm_transactions', toDelete);

            setImportHistory(prev => prev.filter(h => h.batchId !== batchId));
            setSuccessMessage(`Lote excluído com sucesso (${toDelete.length} itens).`);
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
            console.error("Erro ao deletar lote:", error);
            setError("Erro ao excluir lote de importação.");
        } finally {
            setIsSaving(false);
        }
    };

    const clearForm = () => {
        setFile(null);
        setParsedData([]);
        setError(null);
        setSuccessMessage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const groupedPreview = useMemo(() => {
        const groups = {};
        parsedData.forEach(row => {
            const key = row.costCenter || 'Sem Centro de Custo';
            if (!groups[key]) {
                groups[key] = { items: [], total: 0, issuesCount: 0 };
            }
            groups[key].items.push(row);
            groups[key].total += row.value;
            if (analyzeConsistency(row, configData).length > 0) groups[key].issuesCount++;
        });

        return Object.keys(groups).map(k => ({
            name: k,
            total: groups[k].total,
            count: groups[k].items.length,
            issuesCount: groups[k].issuesCount,
            items: groups[k].items
        })).sort((a, b) => b.total - a.total);
    }, [parsedData, configData]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border dark:border-slate-700">
                <h3 className="text-xl font-bold dark:text-white mb-6 flex items-center gap-2">
                    <UploadCloud className="text-indigo-500" />
                    Importação de Arquivos TXT
                </h3>

                <div className="flex flex-col gap-6">
                    {/* Upload Area */}
                    <div className="w-full">
                        <div
                            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer
                                ${file ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50 dark:bg-slate-900/50'}`}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".txt"
                                onChange={handleFileSelect}
                            />

                            {file ? (
                                <>
                                    <FileText size={48} className="text-indigo-500 mb-4" />
                                    <h4 className="font-bold text-slate-800 dark:text-white mb-1">{file.name}</h4>
                                    <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                                </>
                            ) : (
                                <>
                                    <UploadCloud size={48} className="text-slate-400 mb-4" />
                                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-1">Clique para selecionar o TXT</h4>
                                    <p className="text-sm text-slate-500">Arquivos PRGER-CCUS (Entrada) ou PRMAT-CCUS (Saída)</p>
                                </>
                            )}
                        </div>

                        {error && (
                            <div className="mt-4 p-4 bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 rounded-xl flex items-center gap-3 text-sm font-bold">
                                <AlertCircle size={18} />
                                {error}
                            </div>
                        )}

                        {successMessage && (
                            <div className="mt-4 p-4 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-xl flex items-center gap-3 text-sm font-bold">
                                <CheckCircle size={18} />
                                {successMessage}
                            </div>
                        )}

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={handleParse}
                                disabled={!file || isParsing || isSaving}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                {isParsing ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                                Analisar Arquivo
                            </button>

                            {file && (
                                <button
                                    onClick={clearForm}
                                    disabled={isParsing || isSaving}
                                    className="p-3 bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50 rounded-xl transition-colors"
                                    title="Limpar Arquivo"
                                >
                                    <Trash2 size={20} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Preview Area */}
                    <div className="w-full bg-slate-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-700 p-4 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200">
                                Pré-visualização ({parsedData.length} linhas)
                            </h4>
                            {parsedData.length > 0 && (
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-sm"
                                >
                                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Salvar no BD
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-auto max-h-[500px] border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 p-4 space-y-4">
                            {parsedData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium p-8 text-center bg-white dark:bg-slate-800 rounded-lg">
                                    Nenhum dado analisado. Selecione um arquivo e clique em "Analisar Arquivo" para visualizar os dados.
                                </div>
                            ) : (
                                groupedPreview.map(group => (
                                    <details key={group.name} className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm group">
                                        <summary className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center justify-between transition-colors list-none">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${group.issuesCount > 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400'}`}>
                                                    {group.issuesCount > 0 ? <AlertTriangle size={12} /> : <Filter size={12} />}
                                                </div>
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{group.name}</span>
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">
                                                    {group.count} itens
                                                </span>
                                            </div>
                                            <div className="font-black text-slate-800 dark:text-white">
                                                {group.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </div>
                                        </summary>

                                        <div className="border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 overflow-x-auto">
                                            <table className="w-full text-left text-[11px] whitespace-nowrap">
                                                <thead className="text-slate-500 font-bold uppercase">
                                                    <tr>
                                                        <th className="px-3 py-2">Data</th>
                                                        <th className="px-3 py-2">Descrição</th>
                                                        <th className="px-3 py-2">Centro de Custo</th>
                                                        <th className="px-3 py-2">Unidade</th>
                                                        <th className="px-3 py-2">Classe / Conta</th>
                                                        <th className="px-3 py-2 text-right">Valor</th>
                                                        <th className="px-3 py-2 text-center">Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                                    {group.items.map((row) => {
                                                        const issues = analyzeConsistency(row, configData);
                                                        const isProblematic = issues.length > 0;
                                                        return (
                                                            <tr key={row.id} className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatDate(row.date)}</td>
                                                                <td className="px-3 py-2">
                                                                    <div className="text-slate-800 dark:text-slate-200 font-bold max-w-[250px] truncate" title={row.description}>{row.description}</div>
                                                                    {isProblematic && issues.map((issue, idx) => (
                                                                        <div key={idx} className="mt-1 text-[10px] font-bold text-amber-600 flex items-center gap-1">
                                                                            <AlertTriangle size={10} /> {issue}
                                                                        </div>
                                                                    ))}
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <input
                                                                        className={`w-full bg-transparent border-b border-dashed outline-none py-1 ${isProblematic ? 'border-amber-400 focus:border-amber-600' : 'border-slate-300 focus:border-indigo-500'} dark:text-slate-300 font-bold text-indigo-600 dark:text-indigo-400`}
                                                                        value={row.costCenter}
                                                                        onChange={(e) => handleEditRow(row.id, 'costCenter', e.target.value)}
                                                                        title="Editar Centro de Custo"
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-2 text-slate-600 dark:text-slate-300 font-medium">{row.segment}</td>
                                                                <td className="px-3 py-2">
                                                                    <select
                                                                        className={`w-full max-w-[200px] bg-transparent border rounded px-1 py-1 outline-none text-xs cursor-pointer ${issues.length > 0 ? 'border-amber-400 text-amber-700 font-bold' : 'border-slate-300 text-slate-600 dark:text-slate-300 dark:border-slate-600'}`}
                                                                        value={row.accountClass}
                                                                        onChange={(e) => handleEditRow(row.id, 'accountClass', e.target.value)}
                                                                        title={row.planDescription}
                                                                    >
                                                                        <option value={row.accountClass}>{row.planDescription} (Original)</option>
                                                                        {configData.classes.map(p => (
                                                                            <option key={p.code} value={p.code}>{p.name}</option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-black text-rose-500">
                                                                    {row.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <button
                                                                        onClick={() => handleDeleteRow(row.id)}
                                                                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded transition-colors"
                                                                        title="Excluir este lançamento"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </details>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* History Section */}
                <div className="mt-8 pt-8 border-t dark:border-slate-700">
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                        <FileText className="text-indigo-500" size={20} /> Histórico de Arquivos Importados
                    </h4>

                    {importHistory.length === 0 ? (
                        <div className="text-slate-400 font-medium text-sm">Nenhum histórico de importação encontrado.</div>
                    ) : (
                        <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 font-bold uppercase text-[10px]">
                                    <tr>
                                        <th className="px-4 py-3">Arquivo Original</th>
                                        <th className="px-4 py-3">Data da Importação</th>
                                        <th className="px-4 py-3 text-center">Nº Lançamentos</th>
                                        <th className="px-4 py-3 text-right">Valor Total (R$)</th>
                                        <th className="px-4 py-3 text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-700">
                                    {importHistory.map(hist => (
                                        <tr key={hist.batchId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{hist.filename}</td>
                                            <td className="px-4 py-3 text-slate-500">{new Date(hist.importDate).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-center font-bold text-slate-600 dark:text-slate-400">{hist.count}</td>
                                            <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                                                {hist.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => handleDeleteBatch(hist.batchId)}
                                                    disabled={isSaving}
                                                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Excluir lançamentos deste lote"
                                                >
                                                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
