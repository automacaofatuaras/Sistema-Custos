import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  LayoutDashboard, UploadCloud, TrendingUp, TrendingDown, 
  DollarSign, Trash2, Building2, PlusCircle, Settings, Edit2, 
  Save, X, Calendar, Loader2, List, FileUp, LogOut, UserCircle, 
  Users, Sun, Moon, Lock, Sparkles, FileText, Download, 
  AlertTriangle, CheckCircle, Zap, ChevronRight, ChevronDown,
  BarChart3 as BarChartIcon, Folder, FolderOpen, Package, Factory, ShoppingCart
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, 
  signOut, sendPasswordResetEmail, createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, getDocs, deleteDoc, 
  doc, updateDoc, writeBatch, setDoc, getDoc, query, where
} from 'firebase/firestore';

/**
 * ------------------------------------------------------------------
 * 0. CONFIGURAÇÕES
 * ------------------------------------------------------------------
 */

// ⚠️ 1. COLE SUAS CHAVES DO FIREBASE AQUI ⚠️
const firebaseConfig = {
  apiKey: "AIzaSyBmgCmtJnVRkmO2SzvyVmG5e7QCEhxDcy4",
  authDomain: "sistema-custos.firebaseapp.com",
  projectId: "sistema-custos",
  storageBucket: "sistema-custos.firebasestorage.app",
  messagingSenderId: "693431907072",
  appId: "1:693431907072:web:2dbc529e5ef65476feb9e5"
};

// ⚠️ 2. COLE SUA CHAVE DO GEMINI AQUI ⚠️
const GEMINI_API_KEY = "SUA_KEY_GEMINI"; 

// Inicialização do Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'financial-saas-production';

// --- DADOS DE INICIALIZAÇÃO (HIERARQUIA & UNIDADES) ---
const BUSINESS_HIERARCHY = {
    "Portos de Areia": [
        "Porto de Areia Saara - Mira Estrela",
        "Porto Agua Amarela - Riolândia"
    ],
    "Noromix Concreteiras": [
        "Noromix Concreto S/A - Fernandópolis",
        "Noromix Concreto S/A - Ilha Solteira",
        "Noromix Concreto S/A - Jales",
        "Noromix Concreto S/A - Ouroeste",
        "Noromix Concreto S/A - Paranaíba",
        "Noromix Concreto S/A - Monções",
        "Noromix Concreto S/A - Pereira Barreto",
        "Noromix Concreto S/A - Três Fronteiras",
        "Noromix Concreto S/A - Votuporanga"
    ],
    "Fábrica de Tubos": [
        "Noromix Concreto S/A - Votuporanga (Fábrica)"
    ],
    "Pedreiras": [
        "Mineração Grandes Lagos - Icém",
        "Mineração Grandes Lagos - Itapura",
        "Mineração Grandes Lagos - Riolândia",
        "Mineração Grandes Lagos - Três Fronteiras",
        "Noromix Concreto S/A - Rinópolis",
        "Mineração Noroeste Paulista - Monções"
    ],
    "Usinas de Asfalto": [
        "Noromix Concreto S/A - Assis",
        "Noromix Concreto S/A - Monções (Usina)",
        "Noromix Concreto S/A - Itapura (Usina)",
        "Noromix Concreto S/A - Rinópolis (Usina)",
        "Demop Participações LTDA - Três Fronteiras",
        "Mineração Grandes Lagos - Icém (Usina)"
    ],
    "Construtora": [
        "Noromix Construtora"
    ]
};

const SEED_UNITS = Object.values(BUSINESS_HIERARCHY).flat();

const SEGMENT_CONFIG = {
    "Construtora": "ton",
    "Fábrica de Tubos": "m³",
    "Noromix Concreteiras": "m³",
    "Pedreiras": "ton",
    "Portos de Areia": "ton",
    "Usinas de Asfalto": "ton"
};

const getMeasureUnit = (unitOrSegment) => {
    if (SEGMENT_CONFIG[unitOrSegment]) return SEGMENT_CONFIG[unitOrSegment];
    for (const [segment, units] of Object.entries(BUSINESS_HIERARCHY)) {
        if (units.includes(unitOrSegment)) return SEGMENT_CONFIG[segment];
    }
    return "un"; 
};

// --- LÓGICA DE MAPEAMENTO DE CENTRO DE CUSTO (AUTOMÁTICO) ---
const getUnitByCostCenter = (ccCode) => {
    const cc = parseInt(ccCode, 10);
    if (isNaN(cc)) return null;

    if (cc >= 13000 && cc <= 13999) return "Portos de Areia: Porto de Areia Saara - Mira Estrela";
    if (cc >= 14000 && cc <= 14999) return "Portos de Areia: Porto Agua Amarela - Riolândia";
    
    if (cc >= 27000 && cc <= 27999) return "Noromix Concreteiras: Noromix Concreto S/A - Fernandópolis";
    if (cc >= 22000 && cc <= 22999) return "Noromix Concreteiras: Noromix Concreto S/A - Ilha Solteira";
    if (cc >= 25000 && cc <= 25999) return "Noromix Concreteiras: Noromix Concreto S/A - Jales";
    if (cc >= 33000 && cc <= 33999) return "Noromix Concreteiras: Noromix Concreto S/A - Ouroeste";
    if (cc >= 38000 && cc <= 38999) return "Noromix Concreteiras: Noromix Concreto S/A - Paranaíba";
    if (cc >= 34000 && cc <= 34999) return "Noromix Concreteiras: Noromix Concreto S/A - Monções";
    if (cc >= 29000 && cc <= 29999) return "Noromix Concreteiras: Noromix Concreto S/A - Pereira Barreto";
    if (cc >= 9000 && cc <= 9999) return "Noromix Concreteiras: Noromix Concreto S/A - Três Fronteiras";
    if (cc >= 8000 && cc <= 8999) return "Noromix Concreteiras: Noromix Concreto S/A - Votuporanga";
    
    if (cc >= 10000 && cc <= 10999) return "Fábrica de Tubos: Noromix Concreto S/A - Votuporanga (Fábrica)";
    
    if (cc >= 20000 && cc <= 20999) return "Pedreiras: Mineração Grandes Lagos - Icém";
    if (cc >= 5000 && cc <= 5999) return "Pedreiras: Mineração Grandes Lagos - Itapura";
    if (cc >= 4000 && cc <= 4999) return "Pedreiras: Mineração Grandes Lagos - Riolândia";
    if (cc >= 3000 && cc <= 3999) return "Pedreiras: Mineração Grandes Lagos - Três Fronteiras";
    if (cc >= 26000 && cc <= 26999) return "Pedreiras: Noromix Concreto S/A - Rinópolis";
    if (cc >= 2000 && cc <= 2999) return "Pedreiras: Mineração Noroeste Paulista - Monções";
    
    if (cc >= 32000 && cc <= 32999) return "Usinas de Asfalto: Noromix Concreto S/A - Assis";
    if (cc >= 6000 && cc <= 6999) return "Usinas de Asfalto: Noromix Concreto S/A - Monções (Usina)";
    if (cc >= 17000 && cc <= 17999) return "Usinas de Asfalto: Noromix Concreto S/A - Itapura (Usina)";
    if (cc >= 31000 && cc <= 31999) return "Usinas de Asfalto: Noromix Concreto S/A - Rinópolis (Usina)";
    if (cc >= 7000 && cc <= 7999) return "Usinas de Asfalto: Demop Participações LTDA - Três Fronteiras";
    if (cc >= 21000 && cc <= 21999) return "Usinas de Asfalto: Mineração Grandes Lagos - Icém (Usina)";
    
    if (cc >= 40000 && cc <= 94999 && cc !== 94901) return "Construtora: Noromix Construtora";

    return null; // Não identificado
};

const DRE_BLUEPRINT = [
    { code: '01', name: '(+) RECEITA BRUTA', type: 'revenue', level: 1 },
    { code: '01.01', name: 'Receita de Vendas/Serviços', parent: '01', level: 2 },
    { code: '02', name: '(-) DEDUÇÕES', type: 'deduction', level: 1 },
    { code: '02.01', name: 'Impostos s/ Venda', parent: '02', level: 2 },
    { code: 'RESULT_LIQ', name: '= RECEITA LÍQUIDA', formula: '01 - 02', level: 1, bold: true },
    { code: '03', name: '(-) CUSTOS (CPV/CSV)', type: 'cost', level: 1 },
    { code: '03.01', name: 'Custos Mão-de-Obra', parent: '03', level: 2 },
    { code: '03.02', name: 'Custos Materiais (MP)', parent: '03', level: 2 },
    { code: '03.04', name: 'Custos Gerais / Adm Obra', parent: '03', level: 2 },
    { code: '03.05', name: 'Custos de Manutenção', parent: '03', level: 2 },
    { code: '03.06', name: 'Custos de Frete', parent: '03', level: 2 },
    { code: '03.07', name: 'Custos de Veículos', parent: '03', level: 2 },
    { code: 'LUCRO_BRUTO', name: '= LUCRO BRUTO', formula: 'RESULT_LIQ - 03', level: 1, bold: true },
    { code: '04', name: '(-) DESPESAS OPERACIONAIS', type: 'expense', level: 1 },
    { code: '04.01', name: 'Despesas Administrativas', parent: '04', level: 2 },
    { code: '04.02', name: 'Despesas Financeiras', parent: '04', level: 2 },
    { code: '04.03', name: 'Indedutíveis', parent: '04', level: 2 },
    { code: '05', name: '(-) IMPOSTOS (IRPJ/CSLL)', type: 'tax', level: 1 },
    { code: 'RESULT_FINAL', name: '= RESULTADO LÍQUIDO', formula: 'LUCRO_BRUTO - 04 - 05', level: 1, bold: true, color: true },
];

const useTheme = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  return { theme, toggleTheme: () => setTheme(prev => prev === 'light' ? 'dark' : 'light') };
};

const useToast = () => {
    const [toast, setToast] = useState(null);
    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);
    return [toast, showToast];
};

/**
 * ------------------------------------------------------------------
 * 1. SERVIÇO DE DADOS
 * ------------------------------------------------------------------
 */
const dbService = {
  getCollRef: (user, colName) => {
    if (!user) throw new Error("Usuário não autenticado");
    return collection(db, 'artifacts', appId, 'shared_container', 'DADOS_EMPRESA', colName);
  },

  syncSystem: async (user) => {
    try {
        const userRef = doc(db, 'artifacts', appId, 'users', user.uid);
        const snap = await getDoc(userRef);
        let role = 'viewer';
        
        if (!snap.exists()) {
          const usersColl = collection(db, 'artifacts', appId, 'users');
          const allUsers = await getDocs(usersColl);
          role = allUsers.empty ? 'admin' : 'viewer'; 
          await setDoc(userRef, { email: user.email, role, createdAt: new Date().toISOString() });
        } else {
          role = snap.data().role;
        }

        if (role === 'admin') {
            const segRef = collection(db, 'artifacts', appId, 'shared_container', 'DADOS_EMPRESA', 'segments');
            const segSnap = await getDocs(segRef);
            const existingNames = segSnap.docs.map(d => d.data().name);
            const missingUnits = SEED_UNITS.filter(seedUnit => !existingNames.includes(seedUnit));
            if (missingUnits.length > 0) {
                const batch = writeBatch(db);
                missingUnits.forEach(name => { const docRef = doc(segRef); batch.set(docRef, { name }); });
                await batch.commit();
            }
        }
        return role;
    } catch (e) {
        console.error("Erro sync:", e);
        return 'viewer';
    }
  },

  getAllUsers: async () => {
    const usersColl = collection(db, 'artifacts', appId, 'users');
    const snap = await getDocs(usersColl);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  updateUserRole: async (userId, newRole) => { const userRef = doc(db, 'artifacts', appId, 'users', userId); await updateDoc(userRef, { role: newRole }); },
  deleteUserAccess: async (userId) => { const userRef = doc(db, 'artifacts', appId, 'users', userId); await deleteDoc(userRef); },
  add: async (user, col, item) => addDoc(dbService.getCollRef(user, col), item),
  update: async (user, col, id, data) => updateDoc(doc(dbService.getCollRef(user, col), id), data),
  del: async (user, col, id) => deleteDoc(doc(dbService.getCollRef(user, col), id)),
  getAll: async (user, col) => {
      const snapshot = await getDocs(dbService.getCollRef(user, col));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  addBulk: async (user, col, items) => {
    const chunkSize = 400;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      const colRef = dbService.getCollRef(user, col);
      chunk.forEach(item => { const docRef = doc(colRef); batch.set(docRef, item); });
      await batch.commit();
    }
  }
};

const aiService = {
  analyze: async (transactions, period) => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("SUA_KEY")) return "Erro: Configure a API Key do Gemini.";
    const revenue = transactions.filter(t => t.type === 'revenue').reduce((acc, t) => acc + t.value, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.value, 0);
    const categories = {};
    transactions.filter(t => t.type === 'expense').forEach(t => { categories[t.accountPlan] = (categories[t.accountPlan] || 0) + t.value; });
    const top = Object.entries(categories).sort((a,b) => b[1] - a[1]).slice(0, 3).map(([k,v]) => `${k}: ${v.toFixed(0)}`).join(', ');
    const prompt = `Analise (${period}): Receita R$${revenue.toFixed(0)}, Despesa R$${expense.toFixed(0)}. Top contas: ${top}. Dê 3 insights de gestão de custos.`;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta.";
    } catch (error) { return "Erro na IA."; }
  }
};

/**
 * ------------------------------------------------------------------
 * 2. COMPONENTES UI
 * ------------------------------------------------------------------
 */

// SELETOR HIERÁRQUICO (SEGMENTO -> UNIDADE)
const HierarchicalSelect = ({ value, onChange, options, placeholder = "Selecione...", isFilter = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [expanded, setExpanded] = useState({});
    const ref = useRef(null);

    const hierarchy = useMemo(() => {
        const map = {};
        options.forEach(opt => {
            const parts = opt.name.split(':');
            const segment = parts.length > 1 ? parts[0].trim() : 'Geral';
            const unitName = parts.length > 1 ? parts[1].trim() : opt.name;
            if (!map[segment]) map[segment] = [];
            map[segment].push({ fullValue: opt.name, label: unitName });
        });
        return Object.keys(map).filter(key => key !== 'Geral').sort().reduce((obj, key) => { obj[key] = map[key]; return obj; }, {});
    }, [options]);

    useEffect(() => {
        const clickOut = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
        document.addEventListener("mousedown", clickOut);
        return () => document.removeEventListener("mousedown", clickOut);
    }, []);

    const toggleFolder = (seg, e) => {
        if(e) e.stopPropagation();
        setExpanded(prev => ({...prev, [seg]: !prev[seg]}));
    };
    
    const handleSelect = (val) => { onChange(val); setIsOpen(false); };

    let displayText = placeholder;
    if (value) {
        if (BUSINESS_HIERARCHY[value]) displayText = `📁 ${value}`;
        else if (value.includes(':')) displayText = value.split(':')[1].trim();
        else displayText = value;
    }

    return (
        <div className="relative w-full md:w-auto" ref={ref}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className={`flex items-center justify-between w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg p-2.5 min-w-[280px] ${isOpen ? 'ring-2 ring-indigo-500' : ''}`}
                type="button"
            >
                <span className="truncate font-medium">{displayText}</span>
                <ChevronDown size={16} className="text-slate-500"/>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-[300px] max-h-[400px] overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl z-50">
                    {Object.entries(hierarchy).map(([segment, units]) => (
                        <div key={segment}>
                            <div 
                                onClick={(e) => isFilter ? handleSelect(segment) : toggleFolder(segment, e)}
                                className={`flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm font-semibold border-b dark:border-slate-700 ${value === segment ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}
                            >
                                <div onClick={(e) => toggleFolder(segment, e)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded">
                                    {expanded[segment] ? <FolderOpen size={16} className="text-amber-500"/> : <Folder size={16} className="text-amber-500"/>}
                                </div>
                                <span className="flex-1">{segment}</span>
                            </div>
                            
                            {expanded[segment] && (
                                <div className="bg-slate-50 dark:bg-slate-900/30 border-l-2 border-slate-200 dark:border-slate-700 ml-3">
                                    {units.map(u => (
                                        <div 
                                            key={u.fullValue}
                                            onClick={() => handleSelect(u.fullValue)}
                                            className={`p-2 pl-8 text-xs cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-600 dark:text-slate-400 ${value === u.fullValue ? 'bg-indigo-50 dark:bg-indigo-900/20 font-bold text-indigo-600' : ''}`}
                                        >
                                            {u.label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const PeriodSelector = ({ filter, setFilter, years }) => {
    return (
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border dark:border-slate-700 shadow-sm">
            <select className="bg-transparent p-2 text-sm outline-none dark:text-white" value={filter.type} onChange={e => setFilter({...filter, type: e.target.value})}>
                <option value="month">Mensal</option>
                <option value="quarter">Trimestral</option>
                <option value="semester">Semestral</option>
                <option value="year">Anual</option>
            </select>
            {filter.type === 'month' && <select className="bg-transparent p-2 text-sm outline-none border-l dark:border-slate-700 dark:text-white" value={filter.month} onChange={e => setFilter({...filter, month: parseInt(e.target.value)})}>{['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => <option key={i} value={i}>{m}</option>)}</select>}
            {filter.type === 'quarter' && <select className="bg-transparent p-2 text-sm outline-none border-l dark:border-slate-700 dark:text-white" value={filter.quarter} onChange={e => setFilter({...filter, quarter: parseInt(e.target.value)})}> <option value={1}>1º Trim</option><option value={2}>2º Trim</option><option value={3}>3º Trim</option><option value={4}>4º Trim</option></select>}
            {filter.type === 'semester' && <select className="bg-transparent p-2 text-sm outline-none border-l dark:border-slate-700 dark:text-white" value={filter.semester} onChange={e => setFilter({...filter, semester: parseInt(e.target.value)})}> <option value={1}>1º Semestre</option><option value={2}>2º Semestre</option></select>}
            <select className="bg-transparent p-2 text-sm outline-none border-l dark:border-slate-700 font-bold dark:text-white" value={filter.year} onChange={e => setFilter({...filter, year: parseInt(e.target.value)})}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
        </div>
    );
};

const LoginScreen = ({ showToast }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isReset, setIsReset] = useState(false);
    const [loading, setLoading] = useState(false);
  
    const handleAuth = async (e) => {
      e.preventDefault(); setLoading(true);
      try {
        if (isReset) { await sendPasswordResetEmail(auth, email); showToast("Link enviado.", 'success'); setIsReset(false); } 
        else { await signInWithEmailAndPassword(auth, email, password); }
      } catch (err) { showToast("Erro de acesso.", 'error'); } finally { setLoading(false); }
    };
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 w-full max-w-md p-8 rounded-2xl shadow-2xl">
          <div className="text-center mb-6"><Building2 className="text-indigo-600 mx-auto mb-2" size={40}/><h1 className="text-2xl font-bold dark:text-white">Acesso Restrito</h1><p className="text-slate-500 text-sm">Fechamento Custos</p></div>
          <form onSubmit={handleAuth} className="space-y-4">
            <input className="w-full border p-3 rounded dark:bg-slate-700 dark:text-white" placeholder="Email Corporativo" value={email} onChange={e => setEmail(e.target.value)} />
            {!isReset && <input type="password" className="w-full border p-3 rounded dark:bg-slate-700 dark:text-white" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} />}
            <button disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded hover:bg-indigo-700 font-bold">{loading ? <Loader2 className="animate-spin mx-auto"/> : (isReset ? 'Recuperar Senha' : 'Entrar no Sistema')}</button>
          </form>
          <button onClick={() => setIsReset(!isReset)} className="w-full mt-4 text-slate-500 text-sm hover:underline">{isReset ? 'Voltar' : 'Esqueci a senha'}</button>
        </div>
      </div>
    );
};

const UsersScreen = ({ user, myRole, showToast }) => {
    const [users, setUsers] = useState([]);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPass, setNewUserPass] = useState('');
    const loadUsers = async () => { const list = await dbService.getAllUsers(); setUsers(list); };
    useEffect(() => { loadUsers(); }, []);
    const handleCreateUser = async () => {
        if (myRole !== 'admin') return;
        try {
            const secondaryApp = initializeApp(firebaseConfig, "Secondary");
            const secondaryAuth = getAuth(secondaryApp);
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail, newUserPass);
            await setDoc(doc(db, 'artifacts', appId, 'users', userCredential.user.uid), { email: newUserEmail, role: 'viewer', createdAt: new Date().toISOString() });
            await signOut(secondaryAuth); showToast("Usuário criado!", 'success'); setNewUserEmail(''); setNewUserPass(''); loadUsers();
        } catch (e) { showToast("Erro: " + e.message, 'error'); }
    };
    const handleChangeRole = async (uid, role) => { await dbService.updateUserRole(uid, role); loadUsers(); showToast("Permissão alterada.", 'success'); };
    const handleDelete = async (uid) => { if (!confirm("Remover acesso?")) return; await dbService.deleteUserAccess(uid); loadUsers(); showToast("Acesso revogado.", 'success'); };
    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 dark:text-white">Gestão de Acessos</h2>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm mb-8 border dark:border-slate-700">
                <h3 className="font-bold mb-4 flex items-center gap-2 dark:text-white"><PlusCircle size={20}/> Cadastrar Novo Usuário</h3>
                <div className="flex gap-4 items-end">
                    <div className="flex-1"><label className="text-xs font-bold text-slate-500">Email</label><input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={newUserEmail} onChange={e=>setNewUserEmail(e.target.value)}/></div>
                    <div className="flex-1"><label className="text-xs font-bold text-slate-500">Senha Provisória</label><input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={newUserPass} onChange={e=>setNewUserPass(e.target.value)}/></div>
                    <button onClick={handleCreateUser} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold hover:bg-emerald-700">Criar</button>
                </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border dark:border-slate-700">
                <table className="w-full text-left"><thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase text-xs"><tr><th className="p-4">Email</th><th className="p-4">Permissão</th><th className="p-4">Ações</th></tr></thead>
                    <tbody className="divide-y dark:divide-slate-700">{users.map(u => (<tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50"><td className="p-4 dark:text-white">{u.email}</td><td className="p-4"><select value={u.role} onChange={(e)=>handleChangeRole(u.id, e.target.value)} disabled={u.role === 'admin' && u.email === user.email} className="border rounded p-1 text-sm dark:bg-slate-900 dark:text-white"><option value="viewer">Visualizador</option><option value="editor">Editor</option><option value="admin">Administrador</option></select></td><td className="p-4">{u.email !== user.email && <button onClick={()=>handleDelete(u.id)} className="text-rose-500 hover:text-rose-700"><Trash2 size={18}/></button>}</td></tr>))}</tbody>
                </table>
            </div>
        </div>
    );
};

const DREComponent = ({ transactions }) => {
    const dreData = useMemo(() => {
        const rows = JSON.parse(JSON.stringify(DRE_BLUEPRINT));
        const accMap = {};
        transactions.forEach(t => {
            if (!t.accountPlan) return;
            const match = rows.find(r => t.accountPlan.startsWith(r.code) && !r.formula);
            if (match) {
                const val = t.type === 'revenue' ? t.value : -t.value; 
                accMap[match.code] = (accMap[match.code] || 0) + val;
            }
        });
        rows.forEach(row => { if (accMap[row.code]) row.value = accMap[row.code]; });
        for(let i=0; i<2; i++) {
            rows.forEach(row => {
                if (row.parent) {
                    const parent = rows.find(r => r.code === row.parent);
                    if (parent) parent.value = (parent.value || 0) + (row.value || 0);
                }
            });
        }
        rows.forEach(row => {
            if (row.formula) {
                const parts = row.formula.split(' ');
                let total = 0; let op = '+';
                parts.forEach(part => {
                    if (part === '+' || part === '-') { op = part; return; }
                    const refRow = rows.find(r => r.code === part || r.code === part.replace('LUCRO_BRUTO', 'LUCRO_BRUTO')); 
                    const refVal = refRow ? (refRow.value || 0) : 0;
                    if (op === '+') total += refVal; else total -= refVal;
                });
                row.value = total;
            }
        });
        return rows;
    }, [transactions]);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold dark:text-white">DRE Gerencial</div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <tbody>
                        {dreData.map((row, i) => (
                            <tr key={i} className={`border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${row.bold ? 'font-bold bg-slate-100 dark:bg-slate-800' : ''}`}>
                                <td className="p-3 dark:text-slate-300" style={{paddingLeft: `${row.level * 15}px`}}>{row.code} {row.name}</td>
                                <td className={`p-3 text-right ${row.value < 0 ? 'text-rose-600' : 'text-emerald-600'} dark:text-white`}>
                                    {(row.value || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const KpiCard = ({ title, value, icon: Icon, color }) => {
    const colors = { emerald: 'text-emerald-600 bg-emerald-50', rose: 'text-rose-600 bg-rose-50', indigo: 'text-indigo-600 bg-indigo-50' };
    return (<div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border dark:border-slate-700 shadow-sm"><div className="flex justify-between"><div><p className="text-xs font-bold text-slate-500 uppercase mb-2">{title}</p><h3 className="text-2xl font-bold dark:text-white">{value}</h3></div><div className={`p-3 rounded-xl ${colors[color]}`}><Icon size={24}/></div></div></div>);
};

const ManualEntryModal = ({ onClose, segments, onSave, user, initialData, showToast }) => {
    const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 7), type: 'expense', description: '', value: '', segment: '', accountPlan: '', metricType: 'producao' });
    const [activeTab, setActiveTab] = useState('expense'); 

    useEffect(() => { 
        if (initialData) {
            setForm({ ...initialData, date: initialData.date.slice(0, 7) });
            setActiveTab(initialData.type === 'metric' ? 'metric' : initialData.type);
        }
    }, [initialData]);

    const handleSubmit = async () => {
        const val = parseFloat(form.value);
        if (!form.description && activeTab !== 'metric') return showToast("Preencha a descrição.", 'error');
        if (isNaN(val) || !form.segment) return showToast("Preencha unidade e valor.", 'error');
        if (activeTab !== 'metric' && !form.accountPlan) return showToast("Selecione a conta do DRE.", 'error');

        const fullDate = `${form.date}-01`; 
        let tx = { 
            ...form, date: fullDate, value: val, costCenter: 'GERAL', 
            source: 'manual', createdAt: new Date().toISOString(), type: activeTab 
        };

        if (activeTab === 'metric') {
            tx.description = `Lançamento de ${form.metricType === 'producao' ? 'Produção' : (form.metricType === 'vendas' ? 'Vendas' : 'Estoque')}`;
            tx.accountPlan = 'METRICS'; 
        }
        
        try {
            if(initialData?.id) await dbService.update(user, 'transactions', initialData.id, tx);
            else await dbService.add(user, 'transactions', tx);
            showToast("Lançamento realizado!", 'success'); onSave(); onClose();
        } catch(e) { showToast("Erro ao salvar.", 'error'); }
    };

    const unitMeasure = form.segment ? getMeasureUnit(form.segment) : 'un';

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 dark:border-slate-700 border">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold dark:text-white">{initialData ? 'Editar' : 'Novo'} Lançamento</h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400"/></button>
                </div>
                
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg mb-4">
                    <button onClick={() => setActiveTab('revenue')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'revenue' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600' : 'text-slate-500'}`}>Receita</button>
                    <button onClick={() => setActiveTab('expense')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'expense' ? 'bg-white dark:bg-slate-700 shadow text-rose-600' : 'text-slate-500'}`}>Despesa</button>
                    <button onClick={() => setActiveTab('metric')} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'metric' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-500'}`}>Métricas</button>
                </div>

                <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase">Competência</label>
                    <input type="month" className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} />
                    
                    <label className="block text-xs font-bold text-slate-500 uppercase">Unidade</label>
                    <HierarchicalSelect 
                        value={form.segment} 
                        onChange={(val) => setForm({...form, segment: val})} 
                        options={segments}
                        placeholder="Selecione a Unidade..." 
                    />

                    {activeTab !== 'metric' && (
                        <>
                            <label className="block text-xs font-bold text-slate-500 uppercase">Detalhes</label>
                            <input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" placeholder="Descrição (Ex: Pgto Fornecedor)" value={form.description} onChange={e=>setForm({...form, description: e.target.value})} />
                            <select className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={form.accountPlan} onChange={e=>setForm({...form, accountPlan: e.target.value})}>
                                <option value="">Conta do DRE...</option>
                                {DRE_BLUEPRINT.filter(r => r.level === 2).map(r => <option key={r.code} value={r.code}>{r.code} - {r.name}</option>)}
                            </select>
                        </>
                    )}

                    {activeTab === 'metric' && (
                        <div className="grid grid-cols-3 gap-2">
                            <button onClick={()=>setForm({...form, metricType:'producao'})} className={`p-2 border rounded text-xs font-bold ${form.metricType==='producao'?'bg-indigo-100 border-indigo-500 text-indigo-700':'dark:text-white'}`}><Factory className="mx-auto mb-1" size={16}/> Produção</button>
                            <button onClick={()=>setForm({...form, metricType:'vendas'})} className={`p-2 border rounded text-xs font-bold ${form.metricType==='vendas'?'bg-indigo-100 border-indigo-500 text-indigo-700':'dark:text-white'}`}><ShoppingCart className="mx-auto mb-1" size={16}/> Vendas</button>
                            <button onClick={()=>setForm({...form, metricType:'estoque'})} className={`p-2 border rounded text-xs font-bold ${form.metricType==='estoque'?'bg-indigo-100 border-indigo-500 text-indigo-700':'dark:text-white'}`}><Package className="mx-auto mb-1" size={16}/> Estoque</button>
                        </div>
                    )}

                    <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400 font-bold">{activeTab === 'metric' ? unitMeasure : 'R$'}</span>
                        <input type="number" className="w-full border p-2 pl-12 rounded dark:bg-slate-700 dark:text-white" placeholder="Valor" value={form.value} onChange={e=>setForm({...form, value: e.target.value})} />
                    </div>

                    <button onClick={handleSubmit} className="w-full bg-indigo-600 text-white py-3 rounded font-bold hover:bg-indigo-700">Salvar Lançamento</button>
                </div>
            </div>
        </div>
    );
};

// PARSER INTELIGENTE DE TXT COM DETECÇÃO DE CABEÇALHO E UNIDADE
const AutomaticImportComponent = ({ onImport, segments, isProcessing }) => {
    const [fileText, setFileText] = useState('');
    const [previewData, setPreviewData] = useState([]);
    const fileRef = useRef(null);

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
        
        for(let i=0; i< Math.min(lines.length, 20); i++) {
            if (lines[i].includes('PRGER-CCUS')) {
                headerIndex = i;
                const cols = lines[i].split(';');
                cols.forEach((col, idx) => {
                    colMap[col.trim()] = idx;
                });
                break;
            }
        }

        if (headerIndex === -1) {
            alert("Erro: Cabeçalho (PRGER-CCUS) não encontrado no arquivo.");
            return;
        }

        const parsed = [];
        for(let i = headerIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(';');
            
            const ccCode = cols[colMap['PRGER-CCUS']]?.trim();
            const dateStr = cols[colMap['PRGER-LCTO']]?.trim() || cols[colMap['PRGER-EMIS']]?.trim();
            const planCode = cols[colMap['PRGER-PLAN']]?.trim();
            const planDesc = cols[colMap['PRGER-NPLC']]?.trim();
            const supplier = cols[colMap['PRGER-NFOR']]?.trim() || 'Diversos';
            const rawValue = cols[colMap['PRGER-TOTA']]?.trim();
            const ccDesc = cols[colMap['PRGER-NCCU']]?.trim() || '';

            if (!ccCode || !rawValue) continue;

            const detectedUnit = getUnitByCostCenter(ccCode);
            if (!detectedUnit) continue; 

            const value = parseFloat(rawValue.replace(',', '.'));
            if (isNaN(value)) continue;

            let isoDate = new Date().toISOString().split('T')[0];
            if (dateStr && dateStr.length === 10) {
                const [d, m, y] = dateStr.split('/');
                isoDate = `${y}-${m}-${d}`;
            }

            const type = (planCode?.startsWith('1.') || planCode?.startsWith('4.') || planDesc?.toUpperCase().includes('RECEITA')) ? 'revenue' : 'expense';

            parsed.push({
                date: isoDate,
                segment: detectedUnit, 
                costCenter: ccDesc,
                accountPlan: planCode || '00.00',
                planDescription: planDesc || 'Indefinido',
                description: supplier,
                value: value,
                type: type,
                source: 'automatic_import',
                createdAt: new Date().toISOString()
            });
        }
        setPreviewData(parsed);
    };

    const handleConfirmImport = () => {
        if (previewData.length === 0) return alert("Nenhum dado válido encontrado.");
        onImport(previewData);
        setFileText('');
        setPreviewData([]);
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg dark:text-white">Importação Inteligente (TXT)</h3>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Detecção Automática de Unidade</span>
            </div>

            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => fileRef.current?.click()}>
                <UploadCloud className="mx-auto text-indigo-500 mb-3" size={40} />
                <p className="font-medium text-slate-700 dark:text-slate-200">Clique para selecionar o arquivo TXT</p>
                <p className="text-xs text-slate-500 mt-1">O sistema identificará as unidades pelos Centros de Custo</p>
                <input type="file" ref={fileRef} className="hidden" accept=".txt,.csv" onChange={handleFile} />
            </div>

            {previewData.length > 0 && (
                <div className="mt-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center mb-2">
                        <p className="font-bold text-sm text-emerald-600">{previewData.length} lançamentos identificados</p>
                        <button onClick={handleConfirmImport} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2">
                            {isProcessing ? <Loader2 className="animate-spin"/> : <CheckCircle size={18}/>}
                            Confirmar Importação
                        </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto border dark:border-slate-700 rounded-lg">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0">
                                <tr>
                                    <th className="p-2">Data</th>
                                    <th className="p-2">Unidade Detectada</th>
                                    <th className="p-2">Descrição</th>
                                    <th className="p-2 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700">
                                {previewData.slice(0, 100).map((row, i) => (
                                    <tr key={i} className="dark:text-slate-300">
                                        <td className="p-2">{row.date}</td>
                                        <td className="p-2 font-bold text-indigo-600 dark:text-indigo-400">{row.segment.split(':')[1]}</td>
                                        <td className="p-2">{row.description}</td>
                                        <td className="p-2 text-right">{row.value.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {previewData.length > 100 && <p className="p-2 text-center text-xs text-slate-400">... e mais {previewData.length - 100} linhas.</p>}
                    </div>
                </div>
            )}
        </div>
    );
};

const ProductionComponent = ({ transactions, measureUnit }) => {
    const data = useMemo(() => {
        const metrics = transactions
            .filter(t => t.type === 'metric' && (t.metricType === 'producao' || t.metricType === 'vendas'))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const grouped = {};
        metrics.forEach(t => {
            const d = new Date(t.date);
            const key = `${d.getFullYear()}-${d.getMonth()}`; 
            const label = d.toLocaleString('default', { month: 'short' });
            
            if (!grouped[key]) grouped[key] = { name: label, Produção: 0, Vendas: 0, sortKey: d.getTime() };
            if (t.metricType === 'producao') grouped[key].Produção += t.value;
            if (t.metricType === 'vendas') grouped[key].Vendas += t.value;
        });
        return Object.values(grouped).sort((a,b) => a.sortKey - b.sortKey);
    }, [transactions]);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 p-6">
            <h3 className="font-bold text-lg mb-4 dark:text-white">Produção vs Vendas ({measureUnit})</h3>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Legend />
                        <Bar dataKey="Produção" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Vendas" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const StockComponent = ({ transactions, measureUnit }) => {
    const stockData = useMemo(() => {
        const stockTxs = transactions
            .filter(t => t.type === 'metric' && t.metricType === 'estoque')
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const totalStock = stockTxs.reduce((acc, t) => acc + t.value, 0);
        
        const mpExpenses = transactions.filter(t => t.type === 'expense' && t.accountPlan === '03.02').reduce((acc, t) => acc + t.value, 0);
        const productionVol = transactions.filter(t => t.type === 'metric' && t.metricType === 'producao').reduce((acc, t) => acc + t.value, 0);
        const avgCost = productionVol > 0 ? mpExpenses / productionVol : 0;

        const evolution = stockTxs.map(t => ({
            date: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            Estoque: t.value
        }));

        return { total: totalStock, avgCost, totalValue: totalStock * avgCost, evolution };
    }, [transactions]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700">
                    <p className="text-slate-500 text-xs font-bold uppercase">Estoque Total</p>
                    <h3 className="text-2xl font-bold dark:text-white">{stockData.total.toLocaleString()} {measureUnit}</h3>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700">
                    <p className="text-slate-500 text-xs font-bold uppercase">Custo Médio (Período)</p>
                    <h3 className="text-2xl font-bold dark:text-white">R$ {stockData.avgCost.toFixed(2)}</h3>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700">
                    <p className="text-slate-500 text-xs font-bold uppercase">Valor Total Estoque</p>
                    <h3 className="text-2xl font-bold text-emerald-600">R$ {stockData.totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 h-80">
                <h3 className="font-bold mb-4 dark:text-white">Evolução do Estoque</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stockData.evolution}>
                        <defs>
                            <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                        <Area type="monotone" dataKey="Estoque" stroke="#8884d8" fillOpacity={1} fill="url(#colorStock)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

/**
 * ------------------------------------------------------------------
 * 4. APP PRINCIPAL
 * ------------------------------------------------------------------
 */
export default function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('viewer');
  const [loadingAuth, setLoadingAuth] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const [toast, showToast] = useToast();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [segments, setSegments] = useState([]);
  
  const [filter, setFilter] = useState({ type: 'month', month: new Date().getMonth(), year: new Date().getFullYear(), quarter: 1, semester: 1 });
  // Inicializa com o primeiro segmento da lista para não ficar vazio
  const [globalUnitFilter, setGlobalUnitFilter] = useState('Portos de Areia');

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [showAIModal, setShowAIModal] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) { const role = await dbService.syncSystem(u); setUserRole(role); }
      setUser(u); setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    if (!user) return;
    try {
        const txs = await dbService.getAll(user, 'transactions');
        // Carrega segmentos do banco (que foram criados pelo seed)
        const segs = await dbService.getAll(user, 'segments');
        setTransactions(txs);
        setSegments(segs);
    } catch (e) { showToast("Erro ao carregar dados.", 'error'); }
  };
  useEffect(() => { if (user) loadData(); }, [user]);

  const handleLogout = async () => await signOut(auth);

  const handleImport = async (data) => {
    setIsProcessing(true);
    try { 
        await dbService.addBulk(user, 'transactions', data); 
        await loadData(); showToast(`${data.length} importados!`, 'success'); 
    } catch(e) { showToast("Erro ao importar.", 'error'); } 
    finally { setIsProcessing(false); }
  };

  // --- FILTRAGEM ---
  const filteredData = useMemo(() => {
      return transactions.filter(t => {
          const d = new Date(t.date);
          const y = d.getFullYear();
          const m = d.getMonth();
          
          const dateMatch = (() => {
              if (activeTab === 'lancamentos') return true; 
              if (y !== filter.year) return false;
              if (filter.type === 'month' && m !== filter.month) return false;
              if (filter.type === 'quarter' && (Math.floor(m / 3) + 1) !== filter.quarter) return false;
              if (filter.type === 'semester' && (m < 6 ? 1 : 2) !== filter.semester) return false;
              return true;
          })();

          if (!dateMatch) return false;
          
          // Lógica de Filtro de Unidade (Segmento ou Unidade)
          if (BUSINESS_HIERARCHY[globalUnitFilter]) {
              return BUSINESS_HIERARCHY[globalUnitFilter].includes(t.segment);
          } else {
              return t.segment === globalUnitFilter;
          }
      });
  }, [transactions, filter, globalUnitFilter, activeTab]);

  const kpis = useMemo(() => {
      const rev = filteredData.filter(t => t.type === 'revenue').reduce((acc, t) => acc + t.value, 0);
      const exp = filteredData.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.value, 0);
      return { revenue: rev, expense: exp, balance: rev - exp };
  }, [filteredData]);

  const currentMeasureUnit = getMeasureUnit(globalUnitFilter);

  if (loadingAuth) return <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex justify-center items-center"><Loader2 className="animate-spin text-indigo-600" size={48}/></div>;
  if (!user) return <LoginScreen showToast={showToast} />;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex font-sans text-slate-900 dark:text-slate-100 transition-colors">
      {toast && <div className={`fixed top-4 right-4 z-50 p-4 rounded shadow-xl flex gap-2 ${toast.type==='success'?'bg-emerald-500 text-white':'bg-rose-500 text-white'}`}>{toast.type==='success'?<CheckCircle/>:<AlertTriangle/>}{toast.message}</div>}
      
      <aside className="w-20 lg:w-64 bg-slate-900 dark:bg-slate-950 text-white flex-col sticky top-0 h-screen hidden md:flex border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3"><div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center"><Building2 size={18} /></div><span className="text-xl font-bold hidden lg:block">Fechamento Custos</span></div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><LayoutDashboard size={20} /><span className="hidden lg:block">Visão Geral</span></button>
          <button onClick={() => setActiveTab('lancamentos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'lancamentos' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><List size={20} /><span className="hidden lg:block">Lançamentos</span></button>
          <button onClick={() => setActiveTab('dre')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dre' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><FileText size={20} /><span className="hidden lg:block">DRE</span></button>
          <button onClick={() => setActiveTab('custos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'custos' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><DollarSign size={20} /><span className="hidden lg:block">Custos</span></button>
          <button onClick={() => setActiveTab('estoque')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'estoque' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Zap size={20} /><span className="hidden lg:block">Estoque</span></button>
          <button onClick={() => setActiveTab('producao')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'producao' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><BarChartIcon size={20} /><span className="hidden lg:block">Produção</span></button>
          {['admin', 'editor'].includes(userRole) && <button onClick={() => setActiveTab('ingestion')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'ingestion' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><UploadCloud size={20} /><span className="hidden lg:block">Importar TXT</span></button>}
          {userRole === 'admin' && <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-400 hover:bg-slate-800`}><Users size={20} /><span className="hidden lg:block">Usuários</span></button>}
        </nav>
        <div className="p-4 border-t border-slate-800"><div className="flex items-center gap-2 text-sm text-slate-400"><div className="p-1 bg-slate-800 rounded"><UserCircle size={16} /></div><div className="flex-1 min-w-0"><p className="truncate font-bold text-white">{user.email}</p><p className="text-xs uppercase tracking-wider text-indigo-400">{userRole}</p></div></div></div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex gap-2 w-full md:w-auto items-center">
             {activeTab !== 'lancamentos' && <PeriodSelector filter={filter} setFilter={setFilter} years={[2024, 2025]} />}
             
             <HierarchicalSelect 
                value={globalUnitFilter} 
                onChange={setGlobalUnitFilter} 
                options={segments} 
                isFilter={true}
                placeholder="Selecione Unidade ou Segmento"
             />
          </div>
          <div className="flex gap-2">
             <button onClick={() => setShowAIModal(true)} className="p-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-lg"><Sparkles size={20} /></button>
             <button onClick={toggleTheme} className="p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg">{theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}</button>
             <button onClick={handleLogout} className="bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg"><LogOut size={20} /></button>
          </div>
        </header>

        {/* CONTEÚDO DAS ABAS */}
        
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KpiCard title="Receitas" value={kpis.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={TrendingUp} color="emerald" />
              <KpiCard title="Despesas" value={kpis.expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={TrendingDown} color="rose" />
              <KpiCard title="Resultado" value={kpis.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={DollarSign} color={kpis.balance >= 0 ? 'indigo' : 'rose'} />
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm h-80 border dark:border-slate-700">
              <h3 className="mb-4 font-bold dark:text-white">Fluxo do Período</h3>
              <ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: 'Total', Entradas: kpis.revenue, Saidas: kpis.expense }]}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="Entradas" fill="#10b981" /><Bar dataKey="Saidas" fill="#f43f5e" /></BarChart></ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'lancamentos' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border dark:border-slate-700">
             <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center">
                 <h3 className="font-bold text-lg dark:text-white">Lançamentos</h3>
                 {['admin', 'editor'].includes(userRole) && <button onClick={() => {setEditingTx(null); setShowEntryModal(true);}} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><PlusCircle size={18} /> Novo Lançamento</button>}
             </div>
             <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400"><tr><th className="p-4">Data</th><th className="p-4">Descrição</th><th className="p-4">Unidade</th><th className="p-4">Conta/Tipo</th><th className="p-4 text-right">Valor</th><th className="p-4">Ações</th></tr></thead><tbody className="divide-y dark:divide-slate-700">{filteredData.map(t => (<tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50"><td className="p-4 dark:text-white">{new Date(t.date).toLocaleDateString()}</td><td className="p-4 dark:text-white">{t.description}</td><td className="p-4 text-xs dark:text-slate-300">{t.segment}</td><td className="p-4 text-xs dark:text-slate-300">{t.type === 'metric' ? t.metricType.toUpperCase() : t.accountPlan}</td><td className={`p-4 text-right font-bold ${t.type==='revenue'?'text-emerald-500':(t.type==='expense'?'text-rose-500':'text-indigo-500')}`}>{t.value.toLocaleString()}</td><td className="p-4 flex gap-2">{['admin', 'editor'].includes(userRole) && <><button onClick={()=>{setEditingTx(t); setShowEntryModal(true);}} className="text-blue-500"><Edit2 size={16}/></button>{userRole==='admin'&&<button onClick={()=>dbService.del(user, 'transactions', t.id).then(loadData)} className="text-rose-500"><Trash2 size={16}/></button>}</>}</td></tr>))}</tbody></table></div>
          </div>
        )}

        {activeTab === 'dre' && <DREComponent transactions={filteredData} />}
        
        {activeTab === 'custos' && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border dark:border-slate-700">
                <h2 className="font-bold text-lg mb-4 dark:text-white">Detalhamento de Custos</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 dark:bg-slate-700"><tr><th className="p-2 text-left">Conta</th><th className="p-2 text-right">Valor</th></tr></thead>
                        <tbody>
                            {Object.entries(filteredData.filter(t=>t.type==='expense').reduce((acc, t) => {acc[t.accountPlan] = (acc[t.accountPlan]||0)+t.value; return acc}, {})).map(([k,v]) => (
                                <tr key={k} className="border-b dark:border-slate-700"><td className="p-2 dark:text-white">{k}</td><td className="p-2 text-right dark:text-white">{v.toFixed(2)}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'estoque' && <StockComponent transactions={filteredData} measureUnit={currentMeasureUnit} />}
        
        {activeTab === 'producao' && <ProductionComponent transactions={filteredData} measureUnit={currentMeasureUnit} />}

        {activeTab === 'users' && <UsersScreen user={user} myRole={userRole} showToast={showToast} />}

        {activeTab === 'ingestion' && <AutomaticImportComponent onImport={handleImport} isProcessing={isProcessing} />}
      </main>

      {showEntryModal && user && <ManualEntryModal onClose={() => setShowEntryModal(false)} segments={segments} onSave={loadData} user={user} initialData={editingTx} showToast={showToast} />}
      {showAIModal && user && <AIReportModal onClose={() => setShowAIModal(false)} transactions={filteredData} period={`${filter.month+1}/${filter.year}`} />}
    </div>
  );
}
