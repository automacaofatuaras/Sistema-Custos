import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TrendingUp, Factory, Search, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BUSINESS_HIERARCHY } from '../../../constants/business';
import { getParentSegment } from '../../../utils/helpers';
import { formatDate } from '../../../utils/formatters';
import { FileTextIcon } from 'lucide-react';

const InvestimentosReportComponent = ({ transactions, filter, selectedUnit }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUnits, setSelectedUnits] = useState([]);

    const availableUnits = useMemo(() => {
        let invTxs = transactions.filter(t => t.accountPlan && t.accountPlan.startsWith('06'));

        if (selectedUnit && selectedUnit !== 'ALL') {
            if (BUSINESS_HIERARCHY[selectedUnit]) {
                const unitsInSegment = BUSINESS_HIERARCHY[selectedUnit];
                invTxs = invTxs.filter(t => {
                    const cleanName = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                    return unitsInSegment.includes(cleanName);
                });
            } else {
                const cleanFilter = selectedUnit.includes(':') ? selectedUnit.split(':')[1].trim() : selectedUnit;
                invTxs = invTxs.filter(t => {
                    const cleanName = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                    return cleanName === cleanFilter;
                });
            }
        }

        const units = [...new Set(invTxs.map(t => t.segment))];
        return units.sort();
    }, [transactions, selectedUnit]);

    useEffect(() => {
        setSelectedUnits(availableUnits);
    }, [availableUnits]);



    const groupedData = useMemo(() => {
        const investments = transactions.filter(t =>
            t.accountPlan &&
            t.accountPlan.startsWith('06') &&
            t.type === 'expense' &&
            selectedUnits.includes(t.segment) &&
            (t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.planDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.segment.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        const groups = {};
        let totalGeral = 0;

        investments.forEach(t => {
            const unitName = t.segment.split(':')[1]?.trim() || t.segment;
            const ccKey = `${unitName} | ${t.costCenter}`;

            if (!groups[ccKey]) {
                groups[ccKey] = {
                    id: ccKey,
                    unitName: unitName,
                    ccName: t.costCenter,
                    total: 0,
                    subGroups: {}
                };
            }

            const accKey = t.accountPlan;
            if (!groups[ccKey].subGroups[accKey]) {
                groups[ccKey].subGroups[accKey] = {
                    code: t.accountPlan,
                    name: t.planDescription || 'Sem Descrição',
                    total: 0,
                    items: []
                };
            }

            groups[ccKey].subGroups[accKey].items.push(t);
            groups[ccKey].subGroups[accKey].total += t.value;
            groups[ccKey].total += t.value;
            totalGeral += t.value;
        });

        const sortedGroups = Object.values(groups)
            .sort((a, b) => a.unitName.localeCompare(b.unitName))
            .map(group => ({
                ...group,
                accounts: Object.values(group.subGroups).sort((a, b) => a.code.localeCompare(b.code))
            }));

        return { groups: sortedGroups, totalGeral };
    }, [transactions, searchTerm, selectedUnits]);

    const generatePDF = () => {
        const doc = new jsPDF();

        const colorIndigo = [79, 70, 229];
        const colorSlateDark = [30, 41, 59];
        const colorSlateLight = [241, 245, 249];
        const colorTextDark = [15, 23, 42];

        let nomeContexto = "Geral";

        if (selectedUnit && selectedUnit !== 'ALL') {
            nomeContexto = selectedUnit.includes(':') ? selectedUnit.split(':')[1].trim() : selectedUnit;
        } else if (selectedUnits.length === 1) {
            nomeContexto = selectedUnits[0].split(':')[1]?.trim() || selectedUnits[0];
        } else if (selectedUnits.length > 1) {
            const primeiroSegmento = getParentSegment(selectedUnits[0]);
            const mesmoSegmento = selectedUnits.every(u => getParentSegment(u) === primeiroSegmento);
            nomeContexto = mesmoSegmento ? primeiroSegmento : "Consolidado";
        }

        doc.setFontSize(18);
        doc.setTextColor(...colorIndigo);

        const fullTitle = `Relatório de Investimentos - ${nomeContexto}`;
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        const maxTitleWidth = pageWidth - (margin * 2);

        const splitTitle = doc.splitTextToSize(fullTitle, maxTitleWidth);
        doc.text(splitTitle, margin, 20);

        const titleHeight = splitTitle.length * 8;
        let currentY = 20 + (titleHeight + 2);

        doc.setFontSize(10);
        doc.setTextColor(...colorTextDark);
        doc.text(`Período: ${filter.month + 1}/${filter.year}`, margin, currentY);
        currentY += 5;
        doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, margin, currentY);

        const startTableY = currentY + 10;

        const tableBody = [];

        groupedData.groups.forEach(group => {
            tableBody.push([
                {
                    content: `${group.unitName.toUpperCase()}\n${group.ccName}`,
                    colSpan: 2,
                    styles: { fillColor: colorSlateDark, textColor: [255, 255, 255], fontStyle: 'bold', valign: 'middle' }
                },
                {
                    content: group.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                    styles: { fillColor: colorSlateDark, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'right', valign: 'middle' }
                }
            ]);

            group.accounts.forEach(account => {
                tableBody.push([
                    {
                        content: `${account.code} - ${account.name}`,
                        colSpan: 2,
                        styles: { fillColor: colorSlateLight, textColor: colorIndigo, fontStyle: 'bold' }
                    },
                    {
                        content: account.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                        styles: { fillColor: colorSlateLight, textColor: colorIndigo, fontStyle: 'bold', halign: 'right' }
                    }
                ]);

                account.items.forEach(item => {
                    tableBody.push([
                        formatDate(item.date),
                        { content: `${item.description}\n${item.materialDescription || ''}` },
                        { content: item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), styles: { halign: 'right' } }
                    ]);
                });
            });
            tableBody.push([{ content: '', colSpan: 3, styles: { minCellHeight: 5, fillColor: [255, 255, 255] } }]);
        });

        tableBody.push([
            { content: 'TOTAL GERAL INVESTIMENTOS', colSpan: 2, styles: { fillColor: colorSlateDark, textColor: 255, fontStyle: 'bold', halign: 'right' } },
            { content: groupedData.totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), styles: { fillColor: colorSlateDark, textColor: 255, fontStyle: 'bold', halign: 'right' } }
        ]);

        autoTable(doc, {
            startY: startTableY,
            head: [['Data', 'Fornecedor / Matéria', 'Valor']],
            body: tableBody,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, lineColor: [226, 232, 240] },
            headStyles: { fillColor: [255, 255, 255], textColor: colorTextDark, fontStyle: 'bold', lineColor: [200, 200, 200], lineWidth: 0.1 },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 35, halign: 'right' }
            },
            didDrawPage: (data) => {
                const pageSize = doc.internal.pageSize;
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text("Gerado pelo Sistema de Fechamento de Custos", 14, pageSize.height - 10);
                doc.text(`Página ${data.pageNumber}`, pageSize.width - 25, pageSize.height - 10);
            }
        });

        const safeName = nomeContexto.replace(/[<>:"/\\|?*]/g, "").trim();
        const monthYear = `${String(filter.month + 1).padStart(2, '0')}-${filter.year}`;
        doc.save(`Investimentos - ${safeName} - ${monthYear}.pdf`);
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border dark:border-slate-700 h-full flex flex-col">
            <div className="p-6 border-b dark:border-slate-700 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                    <h3 className="font-bold text-xl dark:text-white flex items-center gap-2">
                        <TrendingUp className="text-purple-600" /> Relatório de Investimentos
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Agrupado por Unidade e Centro de Custo</p>
                </div>

                <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        <input
                            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            placeholder="Pesquisar..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={generatePDF}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg"
                    >
                        <FileTextIcon size={18} /> Exportar
                    </button>
                </div>
            </div>

            <div className="bg-purple-50 dark:bg-slate-900/50 p-4 border-b dark:border-slate-700 flex justify-end items-center px-8">
                <span className="text-slate-500 font-bold uppercase text-xs mr-4">Total:</span>
                <span className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                    {groupedData.totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900">
                <div className="space-y-6">
                    {groupedData.groups.map((group) => (
                        <div key={group.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">

                            <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
                                <div>
                                    <div className="text-xs opacity-70 uppercase tracking-wider font-bold">Unidade / Local</div>
                                    <div className="font-bold text-lg">{group.unitName}</div>
                                    <div className="text-sm opacity-80 font-mono mt-1">{group.ccName}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs opacity-70 uppercase font-bold">Total Unidade</div>
                                    <div className="text-xl font-bold text-emerald-400">
                                        {group.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </div>
                                </div>
                            </div>

                            <div className="p-2">
                                {group.accounts.map((account) => (
                                    <div key={account.code} className="mb-2 last:mb-0 border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
                                        <div className="bg-slate-100 dark:bg-slate-700/50 p-2 px-4 flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 px-2 py-0.5 rounded text-xs font-mono font-bold">
                                                    {account.code}
                                                </span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                                                    {account.name}
                                                </span>
                                            </div>
                                            <span className="font-bold text-slate-700 dark:text-white text-sm">
                                                {account.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                        </div>

                                        <div className="divide-y dark:divide-slate-700 bg-white dark:bg-slate-800">
                                            {account.items.map((item) => (
                                                <div key={item.id} className="p-3 pl-8 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors flex justify-between items-start text-sm">
                                                    <div className="flex gap-4">
                                                        <span className="text-slate-400 font-mono text-xs w-20 pt-1">{formatDate(item.date)}</span>
                                                        <div>
                                                            <div className="font-medium text-slate-700 dark:text-slate-300">{item.description}</div>
                                                            {item.materialDescription && (
                                                                <div className="text-xs text-slate-500 italic">{item.materialDescription}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="font-bold text-slate-600 dark:text-slate-400">
                                                        {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {groupedData.groups.length === 0 && (
                        <div className="text-center py-10 text-slate-400">
                            {availableUnits.length === 0
                                ? "Nenhuma unidade deste segmento possui investimentos no período."
                                : "Nenhuma unidade selecionada ou encontrada com os filtros atuais."}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InvestimentosReportComponent;
