import React, { useState, useRef } from 'react';
import { UploadCloud, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { ADMIN_CC_CODES } from '../../../constants/business';
import { PLANO_CONTAS } from '../../../planoContas';
import { getUnitByCostCenter } from '../../../utils/helpers';
import { formatDate } from '../../../utils/formatters';

const AutomaticImportComponent = ({ onImport, isProcessing, BUSINESS_HIERARCHY }) => {
    const [fileText, setFileText] = useState('');
    const [previewData, setPreviewData] = useState([]);
    const fileRef = useRef(null);

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

        return issues;
    };

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target.result;
            setFileText(text);
            parseAndPreview(text);
        };
        reader.readAsText(file, 'ISO-8859-1');
    };

    const parseAndPreview = (text) => {
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
                const finalSegment = detectedUnit || `DESCONHECIDO (CC: ${ccCode})`;

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
                    createdAt: new Date().toISOString()
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

                if (['01087', '1087', '01089', '1089', '99911'].includes(ccCode)) {
                    const shareValue = value / 8;
                    const baseObj = {
                        date: safeDateWithTime,
                        costCenter: `${ccCode} - ${ccDesc}`,
                        costCenterCode: ccCode,
                        accountPlan: planCode || '00.00',
                        planDescription: planDesc || 'Indefinido', description: supplier, materialDescription: sortDesc,
                        type: currentType, source: 'automatic_import', createdAt: new Date().toISOString()
                    };

                    const portoSplit = shareValue / 2;
                    parsed.push({ ...baseObj, id: `${i}_porto1`, value: portoSplit, segment: "Porto de Areia Saara - Mira Estrela" });
                    parsed.push({ ...baseObj, id: `${i}_porto2`, value: portoSplit, segment: "Porto Agua Amarela - Riolândia" });

                    const pedreiraUnits = BUSINESS_HIERARCHY["Pedreiras"] || [];
                    pedreiraUnits.forEach((unit, idx) => {
                        parsed.push({ ...baseObj, id: `${i}_ped_${idx}`, value: shareValue, segment: unit });
                    });
                    continue;
                }

                const detectedUnit = getUnitByCostCenter(ccCode);
                const finalSegment = detectedUnit || `DESCONHECIDO (CC: ${ccCode})`;

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
                    createdAt: new Date().toISOString()
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

    const handleConfirmImport = () => {
        if (previewData.length === 0) return alert("Nenhum dado válido.");
        const dataToImport = previewData.map(({ id, ...rest }) => rest);
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
                <h3 className="font-bold text-lg dark:text-white">Auditoria e Importação</h3>
                {previewData.length > 0 && (
                    <div className="flex gap-3">
                        <button onClick={() => { setPreviewData([]); setFileText(''); }} className="px-4 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100 border border-slate-200 transition-colors">Cancelar</button>
                        <button onClick={handleConfirmImport} disabled={isProcessing} className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all text-white ${problematicRows.length > 0 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                            {isProcessing ? <Loader2 className="animate-spin" /> : (problematicRows.length > 0 ? <AlertTriangle size={18} /> : <CheckCircle size={18} />)}
                            {problematicRows.length > 0 ? `Importar com ${problematicRows.length} Avisos` : 'Confirmar Importação'}
                        </button>
                    </div>
                )}
            </div>
            {previewData.length === 0 && (
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => fileRef.current?.click()}>
                    <UploadCloud className="mx-auto text-indigo-500 mb-3" size={40} />
                    <p className="font-medium text-slate-700 dark:text-slate-200">Clique para selecionar o arquivo TXT (Entrada ou Saída)</p>
                    <input type="file" ref={fileRef} className="hidden" accept=".txt,.csv" onChange={handleFile} />
                </div>
            )}
            {previewData.length > 0 && (
                <div className="animate-in fade-in space-y-6">
                    <TableBlock title="Inconsistências Encontradas (Verifique C. Custo e Conta)" rows={problematicRows} isProblematic={true} />
                    <TableBlock title="Itens Validados" rows={cleanRows} isProblematic={false} />
                </div>
            )}
        </div>
    );
};

export default AutomaticImportComponent;
