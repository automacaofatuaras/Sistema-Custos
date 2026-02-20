import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    LayoutDashboard, List, DollarSign, Share2, Package,
    BarChart3 as BarChartIcon, FileUp, TrendingUp, Globe,
    UploadCloud, Users, Sparkles, Sun, Moon, LogOut, UserCircle,
    ChevronRight, TrendingDown, Factory, ShoppingCart, Search, FileText, PlusCircle, Edit2
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// Services
import dbService from './services/dbService';

// Constants
import { BUSINESS_HIERARCHY, SEGMENT_CONFIG } from './constants/business';

// Utils
import { formatDate } from './utils/formatters';
import { getMeasureUnit } from './utils/helpers';

// Common Components
import KpiCard from './components/common/KpiCard';
import HierarchicalSelect from './components/common/HierarchicalSelect';
import PeriodSelector from './components/common/PeriodSelector';

// Feature Components
import AutomaticImportComponent from './components/features/AutomaticImport/AutomaticImportComponent';
import CustosComponent from './components/features/Custos/CustosComponent';
import ProductionComponent from './components/features/Production/ProductionComponent';
import FechamentoComponent from './components/features/Fechamento/FechamentoComponent';
import StockComponent from './components/features/Stock/StockComponent';
import InvestimentosReportComponent from './components/features/Investimentos/InvestimentosReportComponent';
import GlobalComponent from './components/features/Global/GlobalComponent';
import RateiosComponent from './components/features/Rateios/RateiosComponent';
import UsersScreen from './components/features/Users/UsersScreen';

// Modals
import ManualEntryModal from './components/modals/ManualEntryModal';
import AIReportModal from './components/modals/AIReportModal';
import CostCenterReportModal from './components/modals/CostCenterReportModal';

export default function App() {
    // Styles & Theme
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
        localStorage.setItem('theme', theme);
    }, [theme]);
    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    // Auth Mock (Login removed as per original request)
    const [user] = useState({ email: 'admin@sistema.com' });
    const [userRole] = useState('admin');
    const handleLogout = () => alert('Logout simulado');

    // Global State
    const [activeTab, setActiveTab] = useState('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [transactions, setTransactions] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // Filters
    const [filter, setFilter] = useState({ month: new Date().getMonth(), year: new Date().getFullYear(), type: 'month' });
    const [globalUnitFilter, setGlobalUnitFilter] = useState('ALL');
    const [lancamentosSearch, setLancamentosSearch] = useState('');

    // Modals Visibility
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);
    const [showCCReportModal, setShowCCReportModal] = useState(false);
    const [editingTx, setEditingTx] = useState(null);

    // Toast System
    const [toast, setToast] = useState(null);
    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // Data Loading
    const loadData = useCallback(async () => {
        try {
            const data = await dbService.getAll(user, 'transactions');
            setTransactions(data);
        } catch (e) {
            showToast('Erro ao carregar dados', 'error');
        }
    }, [user, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleImport = async (data) => {
        setIsProcessing(true);
        try {
            await dbService.addBulk(user, 'transactions', data);
            showToast(`${data.length} registros importados!`, 'success');
            loadData();
        } catch (e) {
            showToast('Erro na importação', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBatchDelete = async () => {
        // Implement batch delete logic if needed
    };

    // Filtered Data Calculations
    const filteredData = useMemo(() => {
        return transactions.filter(t => {
            let y, m;
            if (typeof t.date === 'string' && t.date.length >= 10) {
                y = parseInt(t.date.substring(0, 4));
                m = parseInt(t.date.substring(5, 7)) - 1;
            } else {
                const d = new Date(t.date); y = d.getFullYear(); m = d.getMonth();
            }

            if (y !== filter.year) return false;
            if (filter.type === 'month' && m !== filter.month) return false;

            if (globalUnitFilter !== 'ALL') {
                if (BUSINESS_HIERARCHY[globalUnitFilter]) {
                    const units = BUSINESS_HIERARCHY[globalUnitFilter];
                    const cleanName = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                    return units.includes(cleanName);
                } else {
                    const cleanFilter = globalUnitFilter.includes(':') ? globalUnitFilter.split(':')[1].trim() : globalUnitFilter;
                    const cleanName = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                    return cleanName === cleanFilter;
                }
            }
            return true;
        });
    }, [transactions, filter, globalUnitFilter]);

    // KPI Calculations
    const kpis = useMemo(() => {
        const rev = filteredData.filter(t => t.type === 'revenue').reduce((a, b) => a + b.value, 0);
        const exp = filteredData.filter(t => t.type === 'expense').reduce((a, b) => a + b.value, 0);
        return { revenue: rev, expense: exp, balance: rev - exp };
    }, [filteredData]);

    const totalProduction = useMemo(() => filteredData.filter(t => t.metricType === 'producao').reduce((a, b) => a + b.value, 0), [filteredData]);
    const totalSales = useMemo(() => filteredData.filter(t => t.metricType === 'vendas').reduce((a, b) => a + b.value, 0), [filteredData]);
    const currentMeasureUnit = useMemo(() => getMeasureUnit(globalUnitFilter), [globalUnitFilter]);
    const costPerUnit = totalProduction > 0 ? kpis.expense / totalProduction : 0;
    const resultMargin = kpis.revenue > 0 ? (kpis.balance / kpis.revenue) * 100 : 0;

    // Render
    return (
        <div className={`min-h-screen flex transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
            {/* Sidebar */}
            <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white flex flex-col transition-all duration-300 relative border-r border-slate-800 shrink-0 h-screen sticky top-0`}>
                <div className="p-6 flex items-center justify-between overflow-hidden">
                    {sidebarOpen && (
                        <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                            <h1 className="text-xl font-black tracking-tighter text-white">Noromix<span className="text-indigo-400">Custos</span></h1>
                            <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Sistema de Gestão</p>
                        </div>
                    )}
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                        <ChevronRight className={`transition-transform duration-300 ${sidebarOpen ? 'rotate-180' : ''}`} size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {[
                        { id: 'dashboard', icon: LayoutDashboard, label: 'Visão Geral' },
                        { id: 'lancamentos', icon: List, label: 'Lançamentos' },
                        { id: 'custos', icon: DollarSign, label: 'Custos e Despesas' },
                        { id: 'rateios', icon: Share2, label: 'Rateios' },
                        { id: 'estoque', icon: Package, label: 'Estoque' },
                        { id: 'producao', icon: BarChartIcon, label: 'Produção vs Vendas' },
                        { id: 'fechamento', icon: FileUp, label: 'Fechamento' },
                        { id: 'investimentos_report', icon: TrendingUp, label: 'Investimentos' },
                        { id: 'global', icon: Globe, label: 'Global' },
                        { id: 'ingestion', icon: UploadCloud, label: 'Importar TXT' },
                        { id: 'users', icon: Users, label: 'Usuários' },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${!sidebarOpen ? 'justify-center' : ''} ${activeTab === item.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                            title={!sidebarOpen ? item.label : ''}
                        >
                            <item.icon size={20} />
                            {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-800 flex justify-around">
                    <button onClick={() => setShowAIModal(true)} className="p-2 text-purple-400 hover:bg-slate-800 rounded-lg"><Sparkles size={20} /></button>
                    <button onClick={toggleTheme} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg">{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
                    <button onClick={handleLogout} className="p-2 text-rose-400 hover:bg-slate-800 rounded-lg"><LogOut size={20} /></button>
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex items-center gap-3 overflow-hidden">
                    <div className="p-1 bg-slate-800 rounded shrink-0"><UserCircle size={20} className="text-slate-400" /></div>
                    {sidebarOpen && <div className="min-w-0"><p className="truncate font-bold text-sm text-white">Admin</p><p className="text-xs uppercase tracking-wider text-indigo-400">ADMIN</p></div>}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 lg:p-8">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 sticky top-0 z-40 bg-slate-100 dark:bg-slate-900 py-2">
                    {!['global', 'rateios'].includes(activeTab) && (
                        <div className="flex gap-2 w-full md:w-auto items-center flex-wrap">
                            <PeriodSelector filter={filter} setFilter={setFilter} years={[2025, 2026, 2027]} />
                            <HierarchicalSelect
                                value={globalUnitFilter}
                                onChange={setGlobalUnitFilter}
                                options={Object.keys(BUSINESS_HIERARCHY).map(seg => ({ label: seg, value: seg, children: BUSINESS_HIERARCHY[seg].map(u => ({ label: u, value: `${seg}:${u}` })) }))}
                                isFilter={true}
                                placeholder="Todas as Unidades"
                            />
                        </div>
                    )}
                </header>

                {/* Tab Content */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <KpiCard title="Receita Bruta" value={kpis.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={TrendingUp} color="emerald" />
                            <KpiCard title="Despesas Totais" value={kpis.expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={TrendingDown} color="rose" reverseColor={true} />
                            <KpiCard title="Resultado Líquido" value={kpis.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={DollarSign} color={kpis.balance >= 0 ? 'indigo' : 'rose'} />
                            <KpiCard title={`Custo / ${currentMeasureUnit}`} value={costPerUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={Factory} color="rose" reverseColor={true} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border dark:border-slate-700 flex flex-col justify-center text-center">
                                <p className="text-xs font-bold text-slate-500 uppercase">Margem Líquida</p>
                                <h3 className={`text-3xl font-bold ${resultMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{resultMargin.toFixed(1)}%</h3>
                            </div>
                            {/* Other mini cards... */}
                        </div>

                        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm h-96 border dark:border-slate-700">
                            <h3 className="mb-6 font-bold text-lg dark:text-white flex items-center gap-2"><BarChartIcon size={20} /> Performance Financeira</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[{ name: 'Período', Receitas: kpis.revenue, Despesas: kpis.expense, Resultado: kpis.balance }]} barSize={80}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                    <XAxis dataKey="name" />
                                    <YAxis tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }} />
                                    <Legend />
                                    <Bar name="Receitas" dataKey="Receitas" fill="#10b981" radius={[6, 6, 0, 0]} />
                                    <Bar name="Despesas" dataKey="Despesas" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                                    <Bar name="Resultado" dataKey="Resultado" fill="#6366f1" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {activeTab === 'lancamentos' && (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border dark:border-slate-700 overflow-hidden">
                        <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <h3 className="font-bold text-lg dark:text-white">Lançamentos do Período</h3>
                            <div className="flex gap-2">
                                <button onClick={() => setShowCCReportModal(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shadow-md transition-colors"><FileText size={18} /> Relatório CC</button>
                                <button onClick={() => { setEditingTx(null); setShowEntryModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shadow-md transition-colors"><PlusCircle size={18} /> Novo Lançamento</button>
                            </div>
                        </div>
                        {/* Search and Table logic... */}
                        <div className="p-4 bg-slate-50/30 dark:bg-slate-900/30">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                                <input type="text" className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-lg outline-none text-sm" placeholder="Pesquisar..." value={lancamentosSearch} onChange={e => setLancamentosSearch(e.target.value)} />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-bold uppercase text-[10px]">
                                    <tr>
                                        <th className="p-4">Data</th>
                                        <th className="p-4">Descrição</th>
                                        <th className="p-4">Unidade</th>
                                        <th className="p-4 text-right">Valor</th>
                                        <th className="p-4">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-700">
                                    {filteredData.slice(0, 100).map(t => (
                                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="p-4 dark:text-white">{formatDate(t.date)}</td>
                                            <td className="p-4">
                                                <div className="font-bold">{t.description}</div>
                                                {t.accountPlan && <div className="text-[10px] text-indigo-500 font-bold">{t.accountPlan} - {t.planDescription}</div>}
                                            </td>
                                            <td className="p-4 text-xs">{t.segment.split(':')[1] || t.segment}</td>
                                            <td className={`p-4 text-right font-black ${t.type === 'revenue' ? 'text-emerald-500' : 'text-rose-500'}`}>{t.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                            <td className="p-4"><button onClick={() => { setEditingTx(t); setShowEntryModal(true); }} className="text-slate-400 hover:text-indigo-600"><Edit2 size={16} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Feature Component Renderers */}
                {activeTab === 'global' && <GlobalComponent transactions={transactions} filter={filter} setFilter={setFilter} years={[2025, 2026, 2027]} />}
                {activeTab === 'rateios' && <RateiosComponent transactions={transactions} filter={filter} setFilter={setFilter} years={[2025, 2026, 2027]} />}
                {activeTab === 'custos' && <CustosComponent transactions={filteredData} showToast={showToast} measureUnit={currentMeasureUnit} totalProduction={totalProduction} />}
                {activeTab === 'fechamento' && <FechamentoComponent transactions={filteredData} totalSales={totalSales} totalProduction={totalProduction} measureUnit={currentMeasureUnit} filter={filter} selectedUnit={globalUnitFilter} />}
                {activeTab === 'estoque' && <StockComponent transactions={filteredData} measureUnit={currentMeasureUnit} globalCostPerUnit={costPerUnit} currentFilter={filter} />}
                {activeTab === 'producao' && <ProductionComponent transactions={filteredData} measureUnit={currentMeasureUnit} />}
                {activeTab === 'users' && <UsersScreen user={user} myRole={userRole} showToast={showToast} />}
                {activeTab === 'ingestion' && <AutomaticImportComponent onImport={handleImport} isProcessing={isProcessing} />}
                {activeTab === 'investimentos_report' && <InvestimentosReportComponent transactions={filteredData} filter={filter} selectedUnit={globalUnitFilter} />}

            </main>

            {/* Modals */}
            {showEntryModal && <ManualEntryModal onClose={() => setShowEntryModal(false)} segments={Object.values(BUSINESS_HIERARCHY).flat()} onSave={loadData} user={user} initialData={editingTx} showToast={showToast} />}
            {showAIModal && <AIReportModal onClose={() => setShowAIModal(false)} period={`${filter.month + 1}/${filter.year}`} />}
            {showCCReportModal && <CostCenterReportModal isOpen={showCCReportModal} onClose={() => setShowCCReportModal(false)} transactions={transactions} />}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-8 right-8 p-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10 duration-300 z-[100] border ${toast.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-rose-600 border-rose-500'} text-white`}>
                    <p className="font-bold">{toast.message}</p>
                </div>
            )}
        </div>
    );
}
