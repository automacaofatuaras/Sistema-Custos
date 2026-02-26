import React, { useState, useRef } from 'react';
import { UploadCloud, AlertTriangle, CheckCircle, Loader2, Trash2 } from 'lucide-react';
import { ADMIN_CC_CODES } from '../../../constants/business';
import { PLANO_CONTAS } from '../../../constants/planoContas';
import { getUnitByCostCenter } from '../../../utils/helpers';
import { formatDate } from '../../../utils/formatters';
import dbService from '../../../services/dbService';

const AutomaticImportComponent = ({ transactions = [], onImport, isProcessing, BUSINESS_HIERARCHY, selectedUnit }) => {
    const [fileText, setFileText] = useState('');
    const [previewData, setPreviewData] = useState([]);
    const [importHistory, setImportHistory] = useState([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileRef = useRef(null);

    React.useEffect(() => {
        loadHistory();
    }, [transactions]); // React to outer changes

    const loadHistory = async () => {
        try {
            const txList = transactions || [];
            if (!txList.length) {
                setImportHistory([]);
                return;
            }

            // Compute import history from unique sources
            const historyMap = {};
            txList.forEach(tx => {
                // Focus only on automatic imports
                if (tx.source !== 'automatic_import') return;

                // Filter by selectedUnit
                if (selectedUnit) {
                    const cleanTxSegment = tx.segment && tx.segment.includes(':') ? tx.segment.split(':')[1].trim() : (tx.segment || "").trim();
                    if (cleanTxSegment !== selectedUnit) return;
                }

                let batchId = tx.importBatchId || tx.sourceFile;
                let filename = tx.sourceFile;

                // Handle legacy imports (lacking batchId) by grouping them by their creation minute
                if (!batchId) {
                    if (tx.createdAt) {
                        const minutePrefix = tx.createdAt.substring(0, 16); // e.g., "2024-02-25T16:30"
                        batchId = `legacy_${minutePrefix}`;

                        const dateObj = new Date(tx.createdAt);
                        const formattedDate = dateObj.toLocaleDateString('pt-BR');
                        const formattedTime = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        filename = `Importação Manual - ${formattedDate} às ${formattedTime}`;
                    } else {
                        batchId = 'legacy_imports';
                        filename = 'Importações Antigas (Sem Arquivo)';
                    }
                } else {
                    filename = filename || batchId;
                }

                if (!historyMap[batchId]) {
                    historyMap[batchId] = {
                        batchId,
                        filename: filename,
                        count: 0,
                        totalValue: 0,
                        importDate: tx.createdAt || new Date(0).toISOString(),
                        type: tx.type
                    };
                }
                historyMap[batchId].count += 1;
                historyMap[batchId].totalValue += Math.abs(tx.value || 0);
            });
            setImportHistory(Object.values(historyMap).sort((a, b) => new Date(b.importDate) - new Date(a.importDate)));
        } catch (err) {
            console.error("Erro ao processar histórico de importações:", err);
        }
    };

    const handleDeleteBatch = async (batchId) => {
        if (!window.confirm("Deseja realmente excluir todos os itens importados neste lote? Isso afetará os Lançamentos globais da a aplicação.")) return;
        setIsDeleting(true);
        try {
            const toDelete = transactions.filter(t => {
                if (t.source !== 'automatic_import') return false;

                if (batchId.startsWith('legacy_')) {
                    if (t.importBatchId || t.sourceFile) return false;
                    const minPrefix = t.createdAt ? t.createdAt.substring(0, 16) : 'imports';
                    const targetPrefix = batchId.replace('legacy_', '');
                    return (minPrefix === targetPrefix || targetPrefix === 'imports');
                }

                return t.importBatchId === batchId || t.sourceFile === batchId;
            }).map(t => t.id);

            await dbService.deleteBulk(null, 'transactions', toDelete);

            alert(`Lote excluído com sucesso (${toDelete.length} itens removidos).`);
        } catch (error) {
            console.error("Erro ao deletar lote:", error);
            alert("Erro ao excluir lote de importação.");
        } finally {
            setIsDeleting(false);
            // Refresh onImport to update main table if needed
            if (onImport) onImport([]); // trigger refresh if onImport handles empty array as refresh
        }
    };

    const analyzeConsistency = (row) => {
        if (row.accountPlan === 'MOV.EST') return [];

        const issues = [];
        const desc = (row.description || "") + " " + (row.materialDescription || "");
        const descLower = desc.toLowerCase();
        const plan = (row.planDescription || "").toLowerCase();
        const code = row.accountPlan || "";

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
        const ccCode = parseInt(ccCodeStr);
        const isAdminCC = typeof ADMIN_CC_CODES !== 'undefined' ? ADMIN_CC_CODES.includes(ccCode) : false;
        const isCostClass = code.startsWith('03');
        const isExpClass = code.startsWith('04');

        if (isAdminCC && isCostClass) {
            issues.push("Alerta: Custo Operacional lançado em Centro de Custo Administrativo.");
        }
        if (!isAdminCC && isExpClass && !plan.includes('rateio')) {
            issues.push("Alerta: Despesa Administrativa lançada em Centro de Custo Operacional.");
        }

        if (selectedUnit) {
            const ccCodeStr = row.costCenter ? row.costCenter.split(' ')[0] : '0';
            const detectedUnit = getUnitByCostCenter(ccCodeStr);
            if (detectedUnit && detectedUnit !== selectedUnit) {
                issues.push(`Aviso: O centro de custo (${ccCodeStr}) pertence nativamente à unidade "${detectedUnit}", mas será importado para "${selectedUnit}".`);
            }
        }

        return issues;
    };

    const processFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target.result;
            setFileText(text);
            parseAndPreview(text, file.name);
        };
        reader.readAsText(file, 'ISO-8859-1');
    };

    const handleFile = (e) => {
        processFile(e.target.files[0]);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const parseAndPreview = (text, fileName) => {
        const lines = text.split('\n');
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

        if (headerIndex === -1) return alert("ERRO: Cabeçalho não identificado (PRGER-CCUS ou PRMAT-CCUS não encontrados).");

        const parsed = [];
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
                const ccCode = cols[colMap['PRMAT-CCUS']]?.trim();
                const ccDesc = cols[colMap['PRMAT-NCUS']]?.trim() || '';

                if (!ccCode) continue;

                const rawDate = cols[colMap['PRGER-DATA']]?.trim();
                const supplier = cols[colMap['PRMAT-NSUB']]?.trim();
                const description = cols[colMap['PRMAT-NOME']]?.trim();
                const rawValue = cols[colMap['PRGER-TTEN']]?.trim();
                const rawQtd = cols[colMap['PRGER-QTDES']]?.trim();

                if (!ccCode || !rawValue) continue;

                let value = parseFloat(rawValue);
                if (isNaN(value)) value = 0;
                value = Math.abs(value / 1000);

                let isoDate = new Date().toISOString().split('T')[0];
                if (rawDate && rawDate.length === 10) {
                    const parts = rawDate.split('/');
                    if (parts.length === 3) isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
                const safeDateWithTime = `${isoDate}T12:00:00`;

                const detectedUnit = getUnitByCostCenter(ccCode);
                const finalSegment = selectedUnit ? selectedUnit : (detectedUnit || `DESCONHECIDO (CC: ${ccCode})`);

                parsed.push({
                    id: i,
                    date: safeDateWithTime,
                    segment: finalSegment,
                    costCenter: `${ccCode} - ${ccDesc}`,
                    costCenterCode: ccCode,
                    accountPlan: 'MOV.EST',
                    planDescription: 'Movimentação de Estoque',
                    description: supplier || 'Estoque',
                    materialDescription: description,
                    value: value,
                    quantity: parseFloat(rawQtd) / 1000,
                    type: 'expense',
                    source: 'automatic_import',
                    createdAt: new Date().toISOString(),
                    importBatchId: fileName
                });

            } else if (hasEntradaColumns) {
                const ccCode = cols[colMap['PRGER-CCUS']]?.trim();
                if (!ccCode) continue;

                const dateStr = cols[colMap['PRGER-LCTO']]?.trim() || cols[colMap['PRGER-EMIS']]?.trim();
                const planCode = cols[colMap['PRGER-PLAN']]?.trim();
                const planDesc = cols[colMap['PRGER-NPLC']]?.trim();
                const supplier = cols[colMap['PRGER-NFOR']]?.trim() || 'Diversos';
                let rawValue = cols[colMap['PRGER-TOTA']]?.trim();
                const ccDesc = cols[colMap['PRGER-NCCU']]?.trim() || '';
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
                const safeDateWithTime = `${isoDate}T12:00:00`;
                if (!sortDesc || /^0+$/.test(sortDesc)) { sortDesc = "Lançamento SAF"; }

                const currentType = (planCode?.startsWith('1.') || planCode?.startsWith('01.') || planDesc?.toUpperCase().includes('RECEITA')) ? 'revenue' : 'expense';

                const detectedUnit = getUnitByCostCenter(ccCode);
                const finalSegment = selectedUnit ? selectedUnit : (detectedUnit || `DESCONHECIDO (CC: ${ccCode})`);

                parsed.push({
                    id: i,
                    date: safeDateWithTime,
                    segment: finalSegment,
                    costCenter: `${ccCode} - ${ccDesc}`,
                    costCenterCode: ccCode,
                    accountPlan: planCode || '00.00',
                    planDescription: planDesc || 'Indefinido',
                    description: supplier,
                    materialDescription: sortDesc,
                    value: value,
                    type: currentType,
                    source: 'automatic_import',
                    createdAt: new Date().toISOString(),
                    importBatchId: fileName
                });
            }
        }
        setPreviewData(parsed);
    };

    const handleEditRow = (id, field, value) => {
        setPreviewData(prev => prev.map(row => {
            if (row.id !== id) return row;
            const updatedRow = { ...row, [field]: value };
            if (field === 'accountPlan') {
                const found = PLANO_CONTAS.find(p => p.code === value);
                if (found) updatedRow.planDescription = found.name;
            }
            if (field === 'costCenter') {
                const cleanCode = value.split(' ')[0];
                updatedRow.costCenterCode = cleanCode;
                const newUnit = getUnitByCostCenter(cleanCode);
                if (newUnit) updatedRow.segment = newUnit;
            }
            return updatedRow;
        }));
    };

    const handleConfirmImport = (onlyClean = false) => {
        if (previewData.length === 0) return alert("Nenhum dado válido.");

        let dataToProcess = previewData;
        if (onlyClean) {
            dataToProcess = previewData.filter(row => analyzeConsistency(row).length === 0);
        }

        if (dataToProcess.length === 0) return alert("Nenhum item válido para importar com esse filtro.");

        const dataToImport = dataToProcess.map(({ id, ...rest }) => rest);
        onImport(dataToImport);
        setFileText(''); setPreviewData([]);
    };

    const problematicRows = previewData.filter(row => analyzeConsistency(row).length > 0);
    const cleanRows = previewData.filter(row => analyzeConsistency(row).length === 0);

    const TableBlock = ({ title, rows, isProblematic }) => {
        if (rows.length === 0) return null;
        return (
            <div className={`mb-8 rounded-xl border overflow-hidden ${isProblematic ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/10' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>
                <div className={`p-4 font-bold flex items-center justify-between ${isProblematic ? 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-500' : 'text-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-slate-300'}`}>
                    <div className="flex items-center gap-2">
                        {isProblematic ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                        {title}
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-white/50">{rows.length} itens</span>
                </div>
                <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-xs text-left">
                        <thead className={`sticky top-0 z-10 ${isProblematic ? 'bg-amber-100/50' : 'bg-slate-100 dark:bg-slate-900'}`}>
                            <tr>
                                <th className="p-3">Data</th>
                                <th className="p-3 w-1/4">Descrição</th>
                                <th className="p-3">Centro de Custo (Editável)</th>
                                <th className="p-3">Unidade (Automático)</th>
                                <th className="p-3">Conta (Editável)</th>
                                <th className="p-3 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {rows.map((row) => {
                                const issues = analyzeConsistency(row);
                                return (
                                    <tr key={row.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                        <td className="p-2 whitespace-nowrap text-slate-500">{formatDate(row.date)}</td>
                                        <td className="p-2">
                                            <div className="font-bold text-slate-700 dark:text-slate-200">{row.description}</div>
                                            <div className="text-[10px] text-slate-400">{row.materialDescription}</div>
                                            {isProblematic && issues.map((issue, idx) => (
                                                <div key={idx} className="mt-1 text-[10px] font-bold text-amber-600 flex items-center gap-1">
                                                    <AlertTriangle size={10} /> {issue}
                                                </div>
                                            ))}
                                        </td>
                                        <td className="p-2">
                                            <input
                                                className={`w-full bg-transparent border-b border-dashed outline-none text-xs py-1 ${isProblematic ? 'border-amber-400 focus:border-amber-600' : 'border-slate-300 focus:border-indigo-500'} dark:text-slate-300`}
                                                value={row.costCenter}
                                                onChange={(e) => handleEditRow(row.id, 'costCenter', e.target.value)}
                                            />
                                        </td>
                                        <td className="p-2 text-slate-600 dark:text-slate-400 italic">
                                            {row.segment && row.segment.includes(':') ? row.segment.split(':')[1] : row.segment}
                                        </td>
                                        <td className="p-2">
                                            <select
                                                className={`w-full bg-transparent border rounded px-1 py-1 text-xs outline-none cursor-pointer ${issues.length > 0 ? 'border-amber-400 text-amber-700 font-bold' : 'border-slate-200 text-slate-600 dark:text-slate-300 dark:border-slate-600'}`}
                                                value={row.accountPlan}
                                                onChange={(e) => handleEditRow(row.id, 'accountPlan', e.target.value)}
                                            >
                                                <option value={row.accountPlan}>{row.accountPlan} - {row.planDescription} (Original)</option>
                                                {PLANO_CONTAS.map(p => (
                                                    <option key={p.code} value={p.code}>{p.code} - {p.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className={`p-2 text-right font-bold whitespace-nowrap ${row.type === 'revenue' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {row.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700">
            <div className="flex justify-between items-center mb-6">
                <div className="flex flex-col">
                    <h3 className="font-bold text-lg dark:text-white">Auditoria e Importação</h3>
                    {selectedUnit && <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider">Unidade Atual: {selectedUnit}</p>}
                </div>
                {previewData.length > 0 && (
                    <div className="flex gap-3">
                        <button onClick={() => { setPreviewData([]); setFileText(''); }} className="px-4 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100 border border-slate-200 transition-colors">Cancelar</button>

                        {problematicRows.length > 0 && (
                            <button
                                onClick={() => handleConfirmImport(true)}
                                disabled={isProcessing}
                                className="px-4 py-2 rounded-lg font-bold flex items-center gap-2 bg-white dark:bg-slate-800 text-emerald-600 border border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all shadow-sm"
                            >
                                {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                                Importar apenas itens validados ({cleanRows.length})
                            </button>
                        )}

                        <button
                            onClick={() => handleConfirmImport(false)}
                            disabled={isProcessing}
                            className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all text-white ${problematicRows.length > 0 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                        >
                            {isProcessing ? <Loader2 className="animate-spin" size={18} /> : (problematicRows.length > 0 ? <AlertTriangle size={18} /> : <CheckCircle size={18} />)}
                            {problematicRows.length > 0 ? `Importar Tudo (${previewData.length} itens)` : 'Confirmar Importação'}
                        </button>
                    </div>
                )}
            </div>
            {previewData.length === 0 && (
                <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <UploadCloud className={`mx-auto mb-3 transition-colors ${isDragging ? 'text-indigo-600' : 'text-indigo-500'}`} size={40} />
                    <p className={`font-medium ${isDragging ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>
                        {isDragging ? 'Solte o arquivo aqui...' : 'Clique ou arraste para selecionar o arquivo TXT (Entrada ou Saída)'}
                    </p>
                    <input type="file" ref={fileRef} className="hidden" accept=".txt,.csv" onChange={handleFile} />
                </div>
            )}
            {previewData.length > 0 && (
                <div className="animate-in fade-in space-y-6">
                    <TableBlock title="Inconsistências Encontradas (Verifique C. Custo e Conta)" rows={problematicRows} isProblematic={true} />
                    <TableBlock title="Itens Validados" rows={cleanRows} isProblematic={false} />
                </div>
            )}

            {/* History Section */}
            <div className="mt-8 pt-8 border-t dark:border-slate-700">
                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                    <UploadCloud className="text-indigo-500" size={20} /> Histórico de Arquivos Importados
                </h4>

                {importHistory.length === 0 ? (
                    <div className="text-slate-400 font-medium text-sm">Nenhum histórico de importação encontrado para esta unidade.</div>
                ) : (
                    <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 font-bold uppercase text-[10px]">
                                <tr>
                                    <th className="px-4 py-3">Arquivo Original</th>
                                    <th className="px-4 py-3">Data da Importação</th>
                                    <th className="px-4 py-3 text-center">Nº Lançamentos</th>
                                    <th className="px-4 py-3 text-right">Valor Total Estimado (R$)</th>
                                    <th className="px-4 py-3 text-center">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700">
                                {importHistory.map(hist => (
                                    <tr key={hist.batchId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                                            {hist.filename}
                                            {hist.batchId === 'legacy_imports' && <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500">Antigo</span>}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">{new Date(hist.importDate).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center font-bold text-slate-600 dark:text-slate-400">
                                            {hist.count}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                                            {hist.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => handleDeleteBatch(hist.batchId)}
                                                disabled={isDeleting}
                                                className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors disabled:opacity-50"
                                                title="Excluir lançamentos deste lote"
                                            >
                                                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
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
    );
};

export default AutomaticImportComponent;
