import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    LayoutDashboard, List, DollarSign, Share2, Package,
    BarChart3 as BarChartIcon, FileUp, TrendingUp, Globe,
    UploadCloud, Users, Sparkles, Sun, Moon, LogOut, UserCircle,
    ChevronRight, TrendingDown, Factory, ShoppingCart, Search, FileText, PlusCircle, Edit2, Briefcase, FolderClosed,
    ShieldCheck, Trash2, Eye, X, Building2
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ComposedChart, Line
} from 'recharts';

// Services
import dbService from './services/dbService';
import { auth, db } from './services/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Constants
import { BUSINESS_HIERARCHY, SEGMENT_CONFIG, ADMIN_CC_CODES } from './constants/business';
import { COST_CENTER_RULES } from './constants/costCenterRules';

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
import TransactionDetailModal from './components/features/TransactionDetailModal';
import RateioUnidadesCentral from './components/features/Rateios/RateioUnidades/RateioUnidadesCentral';
import RateioAdmCentral from './components/features/Rateios/RateioAdministrativo/RateioAdmCentral';
import UsersScreen from './components/features/Users/UsersScreen';
import CostCenterManager from './components/features/CostCenter/CostCenterManager';
import SegmentDashboard from './components/features/SegmentDashboard';
import WelcomeDashboard from './components/features/WelcomeDashboard';

// Feature Components
import ManualEntryForm from './components/features/ManualEntryForm';
import AIReportModal from './components/modals/AIReportModal';
import CostCenterReportModal from './components/modals/CostCenterReportModal';
import RateioUnitSummaryComponent from './components/features/Rateios/RateioUnitSummaryComponent';

export default function App() {
    // Styles & Theme
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
        localStorage.setItem('theme', theme);
    }, [theme]);
    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    // Auth State
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showManualLogin, setShowManualLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                try {
                    const docRef = doc(db, "usuarios", currentUser.uid);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        setUser(currentUser);
                        const data = docSnap.data();
                        setUserRole(data.permissao ? data.permissao.toLowerCase().trim() : 'leitor');
                    } else {
                        console.warn("Acesso negado: Usuário não cadastrado neste sistema.");
                        await signOut(auth);
                        setUser(null);
                        setUserRole(null);
                        setAuthError("Acesso negado. Solicite permissão para este sistema.");
                    }
                } catch (error) {
                    console.error("Erro ao verificar permissão:", error);
                    setUserRole('leitor');
                }
            } else {
                setUser(null);
                setUserRole(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setAuthError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            setAuthError("Email ou senha incorretos.");
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        window.location.reload();
    };

    // Global State
    const [activeTab, setActiveTab] = useState('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [transactions, setTransactions] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    // Navegação por Segmento/Unidade
    const [selectedSegment, setSelectedSegment] = useState(null);
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [expandedSegments, setExpandedSegments] = useState({});

    const toggleSegment = (seg) => {
        setExpandedSegments(prev => ({ ...prev, [seg]: !prev[seg] }));
        setSelectedSegment(seg);
        setSelectedUnit(null);
        if (['rateios', 'global', 'users'].includes(activeTab)) {
            setActiveTab('dashboard');
        }
    };

    const handleSelectUnit = (seg, unit) => {
        setSelectedSegment(seg);
        setSelectedUnit(unit);
        if (['rateios', 'global', 'users', 'costcenters'].includes(activeTab)) {
            setActiveTab('dashboard'); // Volta para o dashboard da unidade se estava em tela global
        }
    };

    const handleSelectGlobal = (tabId) => {
        setActiveTab(tabId);
        setSelectedUnit(null);
        setSelectedSegment(null);
    };

    // Sub-Module State
    const [activeRateioModule, setActiveRateioModule] = useState('adm_geral'); // 'adm_geral' ou 'unidades'

    // Filters
    const [filter, setFilter] = useState({ month: new Date().getMonth(), year: new Date().getFullYear(), type: 'month' });
    const [lancamentosSearch, setLancamentosSearch] = useState('');

    // Modals Visibility
    const [showEntryForm, setShowEntryForm] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);
    const [showCCReportModal, setShowCCReportModal] = useState(false);
    const [editingTx, setEditingTx] = useState(null);
    const [detailsTx, setDetailsTx] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

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

    const handleDeleteTx = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir este lançamento?')) return;
        try {
            await dbService.del(user, 'transactions', id);
            showToast('Lançamento excluído com sucesso!', 'success');
            loadData();
        } catch (e) {
            showToast('Erro ao excluir lançamento', 'error');
        }
    };

    const handleBatchDelete = async () => {
        // Implement batch delete logic if needed
    };

    const handleAddMetric = async (metricData) => {
        setIsProcessing(true);
        try {
            const tx = {
                ...metricData,
                date: metricData.date || new Date().toISOString(),
                segment: selectedUnit || selectedSegment || 'ALL',
                type: 'metric',
                source: 'manual',
                createdAt: new Date().toISOString()
            };
            await dbService.add(user, 'transactions', tx);
            showToast('Lançamento registrado com sucesso!', 'success');
            loadData();
        } catch (e) {
            showToast('Erro ao registrar lançamento', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpdateMetric = async (id, metricData) => {
        setIsProcessing(true);
        try {
            await dbService.update(user, 'transactions', id, metricData);
            showToast('Lançamento atualizado com sucesso!', 'success');
            loadData();
        } catch (e) {
            showToast('Erro ao atualizar lançamento', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // All transactions for the selected unit/segment without date filters
    const unitTransactions = useMemo(() => {
        return transactions.filter(t => {
            if (selectedUnit) {
                const cleanName = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                return cleanName === selectedUnit;
            }
            return true;
        });
    }, [transactions, selectedUnit]);

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

            if (selectedUnit) {
                const cleanName = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                return cleanName === selectedUnit;
            }
            return true;
        });
    }, [transactions, filter, selectedUnit]);

    const displayLancamentos = useMemo(() => {
        const base = filteredData.filter(t => t.type !== 'metric');
        if (!lancamentosSearch) return base;
        const lower = lancamentosSearch.toLowerCase();
        return base.filter(t =>
            (t.description || '').toLowerCase().includes(lower) ||
            (t.costCenter || '').toLowerCase().includes(lower) ||
            (t.planDescription || '').toLowerCase().includes(lower) ||
            (t.materialDescription || '').toLowerCase().includes(lower)
        );
    }, [filteredData, lancamentosSearch]);

    // YTD Data Calculation for Average Cost (Custo Médio)
    const ytdData = useMemo(() => {
        return transactions.filter(t => {
            let y, m;
            if (typeof t.date === 'string' && t.date.length >= 10) {
                y = parseInt(t.date.substring(0, 4));
                m = parseInt(t.date.substring(5, 7)) - 1;
            } else {
                const d = new Date(t.date); y = d.getFullYear(); m = d.getMonth();
            }

            if (y !== filter.year) return false;

            let endM = filter.type === 'month' ? filter.month :
                filter.type === 'quarter' ? (filter.quarter * 3) - 1 :
                    filter.type === 'semester' ? (filter.semester * 6) - 1 :
                        11;

            if (m > endM) return false;

            if (selectedUnit) {
                const cleanName = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                return cleanName === selectedUnit;
            }
            return true;
        });
    }, [transactions, filter, selectedUnit]);

    // KPI Calculations
    const kpis = useMemo(() => {
        const rev = filteredData.filter(t => t.type === 'revenue').reduce((a, b) => a + b.value, 0);
        const exp = filteredData.filter(t => t.type === 'expense').reduce((a, b) => a + b.value, 0);
        return { revenue: rev, expense: exp, balance: rev - exp };
    }, [filteredData]);

    const totalProduction = useMemo(() => filteredData.filter(t => t.metricType === 'producao').reduce((a, b) => a + b.value, 0), [filteredData]);
    const totalSales = useMemo(() => filteredData.filter(t => t.metricType === 'vendas').reduce((a, b) => a + b.value, 0), [filteredData]);

    const ytdProduction = useMemo(() => ytdData.filter(t => t.metricType === 'producao').reduce((a, b) => a + b.value, 0), [ytdData]);
    const ytdExpense = useMemo(() => ytdData.filter(t => t.type === 'expense').reduce((a, b) => a + b.value, 0), [ytdData]);

    const currentMeasureUnit = useMemo(() => getMeasureUnit(selectedSegment || 'ALL'), [selectedSegment]);
    const costPerUnit = ytdProduction > 0 ? ytdExpense / ytdProduction : 0;
    const resultMargin = kpis.revenue > 0 ? (kpis.balance / kpis.revenue) * 100 : 0;

    // Unidade Dashboard Data
    const expenseGroupsData = useMemo(() => {
        if (activeTab !== 'dashboard' || !selectedUnit) return [];

        let totals = {
            'DESPESAS DA UNIDADE': 0,
            'TRANSPORTE': 0,
            'ADMINISTRATIVO': 0,
            'IMPOSTOS': 0,
            'INVESTIMENTOS': 0,
            'OUTROS': 0
        };

        filteredData.filter(t => t.type === 'expense').forEach(t => {
            const ccCode = t.costCenter ? parseInt(t.costCenter.split(' ')[0]) : 0;
            const segmentName = selectedSegment; // selectedSegment is available
            const rules = COST_CENTER_RULES?.[segmentName] || {};

            let root = 'OUTROS';
            let matched = false;

            if (t.grupo) {
                root = t.grupo.toUpperCase();
                matched = true;
            }

            if (!matched && rules) {
                for (const [rootGroup, subGroups] of Object.entries(rules)) {
                    for (const [subGroup, ccList] of Object.entries(subGroups)) {
                        if (ccList.includes(ccCode)) {
                            root = rootGroup.toUpperCase();
                            matched = true;
                            break;
                        }
                    }
                    if (matched) break;
                }
            }

            if (!matched) {
                if (t.accountPlan?.startsWith('06')) root = "INVESTIMENTOS";
                else if (t.accountPlan === '02.01') root = "IMPOSTOS";
                else if (ADMIN_CC_CODES?.includes(ccCode)) root = 'ADMINISTRATIVO';
                else if (t.accountPlan?.startsWith('03') || t.accountPlan?.startsWith('04')) root = 'DESPESAS DA UNIDADE';
                else root = 'DESPESAS DA UNIDADE';
            }

            if (!totals[root] && totals[root] !== 0) totals[root] = 0;
            totals[root] += t.value;
        });

        return Object.entries(totals)
            .filter(([_, val]) => val > 0)
            .map(([name, val]) => ({ name, value: val }))
            .sort((a, b) => b.value - a.value);
    }, [filteredData, activeTab, selectedUnit, selectedSegment]);

    const prodSalesData = useMemo(() => {
        if (activeTab !== 'dashboard' || !selectedUnit) return [];
        const months = {};
        ytdData.filter(t => t.type === 'metric' && (t.metricType === 'producao' || t.metricType === 'vendas')).forEach(t => {
            const d = typeof t.date === 'string' && t.date.length >= 10 ? new Date(t.date + 'T12:00:00') : new Date(t.date);
            const mLabel = d.toLocaleDateString('pt-BR', { month: 'short' });
            if (!months[mLabel]) months[mLabel] = { name: mLabel, Produção: 0, Vendas: 0, sortKey: d.getMonth() };
            if (t.metricType === 'producao') months[mLabel].Produção += t.value;
            if (t.metricType === 'vendas') months[mLabel].Vendas += t.value;
        });
        return Object.values(months).sort((a, b) => a.sortKey - b.sortKey).map(({ sortKey, ...rest }) => rest);
    }, [ytdData, activeTab, selectedUnit]);

    const stockEvolutionData = useMemo(() => {
        if (activeTab !== 'dashboard' || !selectedUnit) return [];

        let endM = filter.type === 'month' ? filter.month :
            filter.type === 'quarter' ? (filter.quarter * 3) - 1 :
                filter.type === 'semester' ? (filter.semester * 6) - 1 :
                    11;
        let endDate = new Date(filter.year, endM + 1, 0, 23, 59, 59);

        const relevantTransactions = [...unitTransactions].filter(t => new Date(t.date) <= endDate);
        const sorted = relevantTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        const fullEvolution = [];
        let currentStock = 0;

        sorted.forEach(t => {
            if (t.type !== 'metric') return;
            const val = t.value || 0;
            if (t.metricType === 'producao') currentStock += val;
            else if (t.metricType === 'vendas') currentStock -= val;
            else if (t.metricType === 'estoque_fisico') currentStock = val;

            const safeDateStr = t.date?.length === 10 ? t.date + 'T12:00:00' : t.date;
            const dateObj = new Date(safeDateStr);
            const mLabel = dateObj.toLocaleDateString('pt-BR', { month: 'short' });

            const year = dateObj.getFullYear();
            if (year === filter.year) {
                let mKey = dateObj.getMonth();
                fullEvolution[mKey] = { name: mLabel, Estoque: currentStock, sortKey: mKey };
            }
        });

        return fullEvolution.filter(Boolean);
    }, [unitTransactions, filter, activeTab, selectedUnit]);

    // Loading Screen
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center bg-slate-900 h-screen gap-4 transition-colors duration-300">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-slate-400 text-sm font-bold tracking-widest uppercase animate-pulse">Carregando Sistema...</div>
            </div>
        );
    }

    // Login / Lock Screen
    if (!user) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 font-sans selection:bg-indigo-500/30">
                {/* Background Decor */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-xl p-10 rounded-[32px] text-center max-w-md w-full border border-slate-800 shadow-2xl relative z-10 transition-all duration-500">
                    <div className="w-20 h-20 bg-indigo-600/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-indigo-500/20 shadow-inner">
                        <ShieldCheck className="text-indigo-500" size={40} />
                    </div>

                    <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Acesso Restrito</h2>
                    <p className="text-slate-500 text-sm mb-10 font-medium">Autenticação obrigatória para acesso aos <br /> dados sensíveis da Scamatti Custos.</p>

                    {!showManualLogin ? (
                        <div className="space-y-4">
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-4">Plataforma Scamatti Hub</p>

                            <a
                                href="https://portalscamattihub.web.app"
                                className="flex items-center justify-center gap-2 w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                            >
                                <Globe size={18} /> Voltar ao Portal
                            </a>

                            <button
                                onClick={() => setShowManualLogin(true)}
                                className="w-full py-4 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-2xl font-bold transition-all border border-slate-700/50 text-sm"
                            >
                                Login Manual (Admin)
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleLogin} className="flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="text-left space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                                    <input
                                        type="email"
                                        placeholder="seu@email.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full h-14 px-5 rounded-2xl border border-slate-800 bg-slate-950/50 text-white outline-none focus:ring-2 ring-indigo-500/50 transition-all font-medium placeholder:text-slate-700"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha de Acesso</label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full h-14 px-5 rounded-2xl border border-slate-800 bg-slate-950/50 text-white outline-none focus:ring-2 ring-indigo-500/50 transition-all font-medium placeholder:text-slate-700"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all shadow-lg shadow-indigo-600/20 active:scale-95 mt-2"
                            >
                                Entrar no Sistema
                            </button>

                            {authError && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-bold animate-in shake duration-300">
                                    {authError}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => setShowManualLogin(false)}
                                className="text-slate-500 hover:text-indigo-400 text-xs font-bold transition-colors mt-2"
                            >
                                ← Voltar para opções de acesso
                            </button>
                        </form>
                    )}
                </div>

                <p className="mt-12 text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">Scamatti Custos • Todos os direitos reservados</p>
            </div>
        );
    }

    // Render
    return (
        <div className={`min-h-screen flex transition-colors duration-300 ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
            {/* Sidebar */}
            <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white flex flex-col transition-all duration-300 relative border-r border-slate-800 shrink-0 h-screen sticky top-0 z-50`}>
                <div className="p-6 flex items-center justify-between overflow-hidden">
                    {sidebarOpen && (
                        <div className="animate-in fade-in slide-in-from-left-4 duration-500">
                            <h1 className="text-xl font-black tracking-tighter text-white">Scamatti<span className="text-indigo-400">Custos</span></h1>
                            <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Sistema de Gestão</p>
                        </div>
                    )}
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                        <ChevronRight className={`transition-transform duration-300 ${sidebarOpen ? 'rotate-180' : ''}`} size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
                    {/* Segmentos e Unidades */}
                    <div className="mb-4">
                        {sidebarOpen && <p className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Segmentos</p>}
                        {Object.entries(BUSINESS_HIERARCHY).map(([seg, units]) => (
                            <div key={seg} className="space-y-1">
                                <button
                                    onClick={() => toggleSegment(seg)}
                                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all hover:bg-slate-800 group ${!sidebarOpen ? 'justify-center' : ''} ${selectedSegment === seg ? 'text-indigo-400' : 'text-slate-400'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <FolderClosed size={18} className={selectedSegment === seg ? 'text-indigo-400' : 'text-slate-500'} />
                                        {sidebarOpen && <span className="text-sm font-medium truncate">{seg}</span>}
                                    </div>
                                    {sidebarOpen && (
                                        <ChevronRight size={14} className={`transition-transform duration-300 ${expandedSegments[seg] ? 'rotate-90' : ''}`} />
                                    )}
                                </button>

                                {sidebarOpen && expandedSegments[seg] && (
                                    <div className="ml-4 pl-4 border-l border-slate-800 space-y-1 py-1">
                                        {units.map(unit => (
                                            <button
                                                key={unit}
                                                onClick={() => handleSelectUnit(seg, unit)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all hover:text-white ${selectedUnit === unit ? 'bg-indigo-600/20 text-indigo-400 font-bold' : 'text-slate-500 hover:bg-slate-800'}`}
                                            >
                                                {unit}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Itens Globais */}
                    <div className="pt-4 border-t border-slate-800">
                        {sidebarOpen && <p className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global</p>}
                        {[
                            { id: 'rateios', icon: Share2, label: 'Rateios' },
                            { id: 'global', icon: Globe, label: 'Consolidado Global' },
                            { id: 'users', icon: Users, label: 'Gerenciar Usuários' },
                            { id: 'costcenters', icon: Building2, label: 'Centros de Custo' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleSelectGlobal(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${!sidebarOpen ? 'justify-center' : ''} ${activeTab === item.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                                title={!sidebarOpen ? item.label : ''}
                            >
                                <item.icon size={18} />
                                {sidebarOpen && <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>}
                            </button>
                        ))}
                    </div>
                </nav>

                <div className="p-4 border-t border-slate-800 space-y-4">
                    <div className={`flex ${sidebarOpen ? 'flex-row justify-around' : 'flex-col items-center gap-2'} bg-slate-800/50 rounded-xl p-2`}>
                        <button onClick={() => setShowAIModal(true)} className="p-2 text-purple-400 hover:bg-slate-700 rounded-lg transition-colors" title="Análise IA"><Sparkles size={20} /></button>
                        <button onClick={toggleTheme} className="p-2 text-slate-400 hover:bg-slate-700 rounded-lg transition-colors" title="Alternar Tema">{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
                        <button onClick={handleLogout} className="p-2 text-rose-400 hover:bg-slate-700 rounded-lg transition-colors" title="Sair"><LogOut size={20} /></button>
                    </div>

                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-indigo-600/20 rounded-lg shrink-0"><UserCircle size={20} className="text-indigo-400" /></div>
                        {sidebarOpen && (
                            <div className="min-w-0">
                                <p className="truncate font-bold text-sm text-white">{user?.email?.split('@')[0] || 'Usuário'}</p>
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{userRole || 'Leitor'}</p>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-100 dark:bg-slate-900 shadow-inner">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 sticky top-0 z-40 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-md py-4 border-b dark:border-slate-800">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                            {selectedUnit ? (
                                <>
                                    <Factory className="text-indigo-500" size={24} />
                                    <span>{selectedUnit}</span>
                                    <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full uppercase font-black">{selectedSegment}</span>
                                </>
                            ) : null}
                        </h2>
                        {selectedUnit && <p className="text-xs text-slate-500 font-medium">Gestão de Custos e Performance</p>}
                    </div>

                    <div className="flex gap-4 items-center">
                        {selectedUnit || selectedSegment || ['rateios', 'global', 'users'].includes(activeTab) ? (
                            <PeriodSelector filter={filter} setFilter={setFilter} years={[2025, 2026, 2027]} />
                        ) : null}
                    </div>
                </header>

                {/* Unidades Menu (Tabs) */}
                {selectedUnit && (
                    <div className="flex p-1 bg-white dark:bg-slate-800 rounded-2xl w-full overflow-x-auto shadow-sm mb-8 border dark:border-slate-700 no-scrollbar">
                        {[
                            { id: 'dashboard', icon: LayoutDashboard, label: 'Visão Geral' },
                            { id: 'lancamentos', icon: List, label: 'Lançamentos' },
                            { id: 'custos', icon: DollarSign, label: 'Custos e Despesas' },
                            { id: 'estoque', icon: Package, label: 'Estoque' },
                            { id: 'producao', icon: BarChartIcon, label: 'Produção vs Vendas' },
                            { id: 'rateios_unit', icon: Share2, label: 'Rateios' },
                            { id: 'fechamento', icon: FileUp, label: 'Fechamento' },
                            { id: 'investimentos_report', icon: TrendingUp, label: 'Investimentos' },
                            { id: 'ingestion', icon: UploadCloud, label: 'Importar TXT' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap
                                    ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                            >
                                <item.icon size={18} />
                                {item.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Content Renderer */}
                {!selectedUnit && !selectedSegment && !['rateios', 'global', 'users', 'costcenters'].includes(activeTab) ? (
                    <WelcomeDashboard />
                ) : (
                    <>
                        {/* Segment Dashboard */}
                        {selectedSegment && !selectedUnit && !['rateios', 'global', 'users', 'costcenters'].includes(activeTab) && (
                            <SegmentDashboard
                                transactions={transactions}
                                segmentName={selectedSegment}
                                units={BUSINESS_HIERARCHY[selectedSegment] || []}
                            />
                        )}

                        {/* Tab Content */}
                        {activeTab === 'dashboard' && selectedUnit && (
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
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border dark:border-slate-700 flex flex-col justify-center text-center">
                                        <p className="text-xs font-bold text-slate-500 uppercase">Total Produzido</p>
                                        <h3 className="text-3xl font-bold text-indigo-500">{totalProduction.toLocaleString('pt-BR')} <span className="text-sm font-medium">{currentMeasureUnit}</span></h3>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border dark:border-slate-700 flex flex-col justify-center text-center">
                                        <p className="text-xs font-bold text-slate-500 uppercase">Total Vendido</p>
                                        <h3 className="text-3xl font-bold text-emerald-500">{totalSales.toLocaleString('pt-BR')} <span className="text-sm font-medium">{currentMeasureUnit}</span></h3>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border dark:border-slate-700 flex flex-col justify-center text-center">
                                        <p className="text-xs font-bold text-slate-500 uppercase">Estoque Estimado</p>
                                        <h3 className="text-3xl font-bold text-amber-500">{(stockEvolutionData.length > 0 ? stockEvolutionData[stockEvolutionData.length - 1].Estoque : 0).toLocaleString('pt-BR')} <span className="text-sm font-medium">{currentMeasureUnit}</span></h3>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Gráfico de Despesas */}
                                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border dark:border-slate-700">
                                        <h3 className="mb-6 font-bold text-sm uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2"><DollarSign size={18} className="text-rose-500" /> Grupos de Despesa</h3>
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={expenseGroupsData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                                                    <XAxis type="number" tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                                                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                                                    <Bar dataKey="value" name="Valor" radius={[0, 4, 4, 0]} barSize={20}>
                                                        {expenseGroupsData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={'#f43f5e'} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Gráfico de Produção vs Vendas */}
                                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border dark:border-slate-700">
                                        <h3 className="mb-6 font-bold text-sm uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2"><Factory size={18} className="text-indigo-500" /> Produção vs Vendas (Mensal)</h3>
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={prodSalesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                                    <YAxis tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                                                    <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                                                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                                                    <Bar dataKey="Produção" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                                    <Line type="monotone" dataKey="Vendas" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Gráfico de Estoque */}
                                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border dark:border-slate-700">
                                        <h3 className="mb-6 font-bold text-sm uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2"><Package size={18} className="text-amber-500" /> Evolução do Estoque (Mês)</h3>
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={stockEvolutionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                                    <YAxis tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                                                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                                                    <Bar dataKey="Estoque" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={25} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'lancamentos' && selectedUnit && (
                            <div className="space-y-6">
                                {showEntryForm ? (
                                    <ManualEntryForm
                                        onClose={() => setShowEntryForm(false)}
                                        segments={Object.values(BUSINESS_HIERARCHY).flat()}
                                        currentUnit={selectedUnit}
                                        onSave={loadData}
                                        user={user}
                                        initialData={editingTx}
                                        showToast={showToast}
                                    />
                                ) : (
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border dark:border-slate-700 overflow-hidden">
                                        <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                                            <h3 className="font-bold text-lg dark:text-white">Lançamentos do Período</h3>
                                            <div className="flex gap-2">
                                                <button onClick={() => setShowCCReportModal(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shadow-md transition-colors"><FileText size={18} /> Relatório CC</button>
                                                <button onClick={() => { setEditingTx(null); setShowEntryForm(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shadow-md transition-colors"><PlusCircle size={18} /> Novo Lançamento</button>
                                            </div>
                                        </div>
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
                                                        <th className="p-4">Centro de Custo</th>
                                                        <th className="p-4">Classe</th>
                                                        <th className="p-4 text-right">Valor</th>
                                                        <th className="p-4 text-center">Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y dark:divide-slate-700">
                                                    <tr className="bg-slate-100/50 dark:bg-slate-800/80">
                                                        <td colSpan="3" className="p-4 text-right font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest text-xs">
                                                            Total do Período Filtrado:
                                                        </td>
                                                        <td className={`p-4 text-right font-black text-lg ${displayLancamentos.reduce((acc, curr) => acc + (curr.type === 'revenue' ? curr.value : -curr.value), 0) >= 0
                                                            ? 'text-emerald-600 dark:text-emerald-400'
                                                            : 'text-rose-600 dark:text-rose-400'
                                                            }`}>
                                                            {displayLancamentos.reduce((acc, curr) => acc + (curr.type === 'revenue' ? curr.value : -curr.value), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </td>
                                                        <td className="p-4"></td>
                                                    </tr>
                                                    {displayLancamentos.slice(0, 100).map(t => (
                                                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                            <td className="p-4 text-slate-600 dark:text-slate-300 font-medium">{formatDate(t.date)}</td>
                                                            <td className="p-4">
                                                                <div className="font-bold text-slate-700 dark:text-slate-200">{t.costCenter || 'N/A'}</div>
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="text-xs text-indigo-500 font-bold">{t.planDescription || 'Sem Classe'}</div>
                                                                <div className="text-[10px] text-slate-400">{t.description}</div>
                                                            </td>
                                                            <td className={`p-4 text-right font-black ${t.type === 'revenue' ? 'text-emerald-500' : 'text-rose-500'}`}>{t.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                            <td className="p-4">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <button
                                                                        onClick={() => { setDetailsTx(t); setShowDetailsModal(true); }}
                                                                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                                        title="Ver Detalhes Auditados"
                                                                    >
                                                                        <Eye size={16} />
                                                                    </button>
                                                                    <button onClick={() => { setEditingTx(t); setShowEntryForm(true); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Editar"><Edit2 size={16} /></button>
                                                                    <button onClick={() => handleDeleteTx(t.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Excluir"><Trash2 size={16} /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Feature Component Renderers */}
                        {activeTab === 'global' && <GlobalComponent transactions={transactions} filter={filter} setFilter={setFilter} years={[2025, 2026, 2027]} />}

                        {/* Rateios unificados */}
                        {activeTab === 'rateios' && (
                            <div className="space-y-6 animate-in fade-in">
                                {/* Sub-menu de navegação de Rateios */}
                                <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl w-fit sm:w-auto overflow-x-auto shadow-inner">
                                    <button
                                        onClick={() => setActiveRateioModule('adm_geral')}
                                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap
                                    ${activeRateioModule === 'adm_geral' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    >
                                        <Briefcase size={16} /> Rateio Adm Geral
                                    </button>
                                    <button
                                        onClick={() => setActiveRateioModule('unidades')}
                                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap
                                    ${activeRateioModule === 'unidades' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    >
                                        <Share2 size={16} /> Rateio Unidades
                                    </button>
                                </div>

                                {activeRateioModule === 'adm_geral' && (
                                    <RateioAdmCentral filter={filter} setFilter={setFilter} years={[2025, 2026, 2027]} user={user} showToast={showToast} />
                                )}
                                {activeRateioModule === 'unidades' && (
                                    <RateioUnidadesCentral transactions={transactions} filter={filter} setFilter={setFilter} years={[2025, 2026, 2027]} user={user} onImport={handleImport} isProcessing={isProcessing} />
                                )}
                            </div>
                        )}

                        {activeTab === 'custos' && selectedUnit && <CustosComponent transactions={filteredData} showToast={showToast} measureUnit={currentMeasureUnit} totalProduction={totalProduction} />}
                        {activeTab === 'fechamento' && selectedUnit && <FechamentoComponent transactions={filteredData} totalSales={totalSales} totalProduction={totalProduction} measureUnit={currentMeasureUnit} filter={filter} selectedUnit={selectedUnit} />}
                        {activeTab === 'estoque' && selectedUnit && <StockComponent transactions={unitTransactions} measureUnit={currentMeasureUnit} globalCostPerUnit={costPerUnit} currentFilter={filter} onAddMetric={handleAddMetric} onUpdateMetric={handleUpdateMetric} onDeleteMetric={handleDeleteTx} />}
                        {activeTab === 'producao' && selectedUnit && <ProductionComponent transactions={filteredData} measureUnit={currentMeasureUnit} currentFilter={filter} onAddMetric={handleAddMetric} onUpdateMetric={handleUpdateMetric} onDeleteMetric={handleDeleteTx} />}
                        {activeTab === 'rateios_unit' && selectedUnit && <RateioUnitSummaryComponent transactions={transactions} selectedUnit={selectedUnit} parentSegment={selectedSegment} filter={filter} user={user} />}
                        {activeTab === 'users' && <UsersScreen user={user} myRole={userRole} showToast={showToast} />}
                        {activeTab === 'costcenters' && <CostCenterManager user={user} showToast={showToast} />}
                        {activeTab === 'ingestion' && (
                            <AutomaticImportComponent
                                transactions={transactions}
                                onImport={handleImport}
                                isProcessing={isProcessing}
                                BUSINESS_HIERARCHY={BUSINESS_HIERARCHY}
                                selectedUnit={selectedUnit}
                            />
                        )}
                        {activeTab === 'investimentos_report' && <InvestimentosReportComponent transactions={filteredData} filter={filter} selectedUnit={selectedUnit} />}
                    </>
                )}
            </main>

            {/* Modals */}
            {showAIModal && <AIReportModal onClose={() => setShowAIModal(false)} period={`${filter.month + 1}/${filter.year}`} />}
            {showCCReportModal && <CostCenterReportModal isOpen={showCCReportModal} onClose={() => setShowCCReportModal(false)} transactions={transactions} />}

            {showDetailsModal && detailsTx && (
                <TransactionDetailModal
                    tx={detailsTx}
                    onClose={() => setShowDetailsModal(false)}
                />
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-8 right-8 p-4 rounded-xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10 duration-300 z-[100] border ${toast.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-rose-600 border-rose-500'} text-white`}>
                    <p className="font-bold">{toast.message}</p>
                </div>
            )}
        </div>
    );
}

