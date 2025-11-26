import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  LayoutDashboard, UploadCloud, TrendingUp, TrendingDown, 
  DollarSign, Trash2, Building2, PlusCircle, Settings, Edit2, 
  Save, X, Calendar, Loader2, List, FileUp, LogOut, UserCircle, 
  Users, Sun, Moon, Lock, Sparkles, FileText, Download, 
  AlertTriangle, CheckCircle, Zap, Filter, ChevronRight, ChevronDown,
  BarChart3 as BarChartIcon // <--- CORREÇÃO AQUI: Importando o ícone com nome exclusivo
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend
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

// --- DADOS DE INICIALIZAÇÃO (SEU NEGÓCIO) ---
const SEED_UNITS = [
    "Portos de Areia: Porto Saara - Mira Estrela",
    "Portos de Areia: Porto Agua Amarela - Riolândia",
    "Concreteiras: Fernandópolis", "Concreteiras: Ilha Solteira", "Concreteiras: Jales",
    "Concreteiras: Ouroeste", "Concreteiras: Paranaíba", "Concreteiras: Monções",
    "Concreteiras: Pereira Barreto", "Concreteiras: Três Fronteiras", "Concreteiras: Votuporanga",
    "Fábrica de Tubos: Votuporanga",
    "Pedreiras: Mineração Grandes Lagos - Icém", "Pedreiras: Mineração Grandes Lagos - Itapura",
    "Pedreiras: Mineração Grandes Lagos - Riolândia", "Pedreiras: Mineração Grandes Lagos - Três Fronteiras",
    "Pedreiras: Noromix - Rinópolis", "Pedreiras: Mineração Noroeste - Monções",
    "Usinas Asfalto: Assis", "Usinas Asfalto: Monções", "Usinas Asfalto: Itapura",
    "Usinas Asfalto: Rinópolis", "Usinas Asfalto: Demop - Três Fronteiras", "Usinas Asfalto: Grandes Lagos - Icém",
    "Construtora: Noromix Construtora"
];

// --- ESTRUTURA DRE (Baseada no PDF) ---
const DRE_BLUEPRINT = [
    { code: '01', name: '(+) RECEITA BRUTA', type: 'revenue', level: 1 },
    { code: '01.01', name: 'Receita de Vendas/Serviços', parent: '01', level: 2 },
    { code: '02', name: '(-) DEDUÇÕES', type: 'deduction', level: 1 },
    { code: '02.01', name: 'Impostos s/ Venda (ICMS/ISS/PIS/COFINS)', parent: '02', level: 2 },
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

// Hooks de Utilidade
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
 * 1. SERVIÇO DE DADOS (DB)
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
            if (segSnap.empty) {
                console.log("Inicializando unidades do negócio...");
                const batch = writeBatch(db);
                SEED_UNITS.forEach(name => {
                    const docRef = doc(segRef);
                    batch.set(docRef, { name });
                });
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
  updateUserRole: async (userId, newRole) => {
    const userRef = doc(db, 'artifacts', appId, 'users', userId);
    await updateDoc(userRef, { role: newRole });
  },
  deleteUserAccess: async (userId) => {
      const userRef = doc(db, 'artifacts', appId, 'users', userId);
      await deleteDoc(userRef);
  },

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
    const prompt = `Analise (${period}): Receita R$${revenue.toFixed(0)}, Despesa R$${expense.toFixed(0)}. Top contas: ${top}. Dê 3 insights de gestão de custos para esta concreteira/mineração.`;
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

const PeriodSelector = ({ filter, setFilter, years }) => {
    return (
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border dark:border-slate-700 shadow-sm">
            <select className="bg-transparent p-2 text-sm outline-none dark:text-white" value={filter.type} onChange={e => setFilter({...filter, type: e.target.value})}>
                <option value="month">Mensal</option>
                <option value="quarter">Trimestral</option>
                <option value="semester">Semestral</option>
                <option value="year">Anual</option>
            </select>
            
            {filter.type === 'month' && (
                <select className="bg-transparent p-2 text-sm outline-none border-l dark:border-slate-700 dark:text-white" value={filter.month} onChange={e => setFilter({...filter, month: parseInt(e.target.value)})}>
                    {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
            )}

            {(filter.type === 'quarter') && (
                <select className="bg-transparent p-2 text-sm outline-none border-l dark:border-slate-700 dark:text-white" value={filter.quarter} onChange={e => setFilter({...filter, quarter: parseInt(e.target.value)})}>
                    <option value={1}>1º Trim (Jan-Mar)</option>
                    <option value={2}>2º Trim (Abr-Jun)</option>
                    <option value={3}>3º Trim (Jul-Set)</option>
                    <option value={4}>4º Trim (Out-Dez)</option>
                </select>
            )}

            {(filter.type === 'semester') && (
                <select className="bg-transparent p-2 text-sm outline-none border-l dark:border-slate-700 dark:text-white" value={filter.semester} onChange={e => setFilter({...filter, semester: parseInt(e.target.value)})}>
                    <option value={1}>1º Semestre</option>
                    <option value={2}>2º Semestre</option>
                </select>
            )}

            <select className="bg-transparent p-2 text-sm outline-none border-l dark:border-slate-700 font-bold dark:text-white" value={filter.year} onChange={e => setFilter({...filter, year: parseInt(e.target.value)})}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
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
        if (isReset) {
            await sendPasswordResetEmail(auth, email);
            showToast("Link enviado para o email.", 'success');
            setIsReset(false);
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
      } catch (err) { showToast("Erro de acesso. Verifique credenciais.", 'error'); } finally { setLoading(false); }
    };
  
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 w-full max-w-md p-8 rounded-2xl shadow-2xl">
          <div className="text-center mb-6"><Building2 className="text-indigo-600 mx-auto mb-2" size={40}/><h1 className="text-2xl font-bold dark:text-white">Acesso Restrito</h1><p className="text-slate-500 text-sm">Sistema de Custos Noromix</p></div>
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

const UsersScreen = ({ user, myRole
