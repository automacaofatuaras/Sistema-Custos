import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  LayoutDashboard, UploadCloud, TrendingUp, TrendingDown, 
  DollarSign, Trash2, Building2, PlusCircle, Settings, Edit2, 
  Save, X, Calendar, Loader2, List, FileUp, LogOut, UserCircle, 
  Users, Sun, Moon, Lock, Sparkles, FileText, Download, AlertTriangle, CheckCircle, Clock, Send, Zap, Eye, BarChart as BarChartIcon
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';

// Bibliotecas para PDF e Exportação
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, getDocs, deleteDoc, 
  doc, updateDoc, writeBatch, setDoc, getDoc, query
} from 'firebase/firestore';

/**
 * ------------------------------------------------------------------
 * 0. CONFIGURAÇÕES (FIREBASE, GEMINI & DRE MAP)
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

// ⚠️ 2. COLE SUA CHAVE DO GEMINI AQUI (aistudio.google.com) ⚠️
const GEMINI_API_KEY = "AIzaSyA6feDMeD7YNNQf40q2ALOvwPnfCDa7Pw4"; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'financial-saas-production';

// Mapeamento hierárquico para o DRE
const DRE_PLAN_MAP = {
    '1.00': { name: 'RECEITA BRUTA', type: 'revenue', level: 1 },
    '1.01': { name: 'Venda de Produtos/Serviços', parent: '1.00', level: 2 },
    '2.00': { name: 'CUSTO DOS PRODUTOS/SERVIÇOS VENDIDOS (CPV/CSV)', type: 'expense', level: 1 },
    '2.01': { name: 'Custo da Matéria Prima/Mercadoria', parent: '2.00', level: 2 },
    '2.02': { name: 'Mão de Obra Direta', parent: '2.00', level: 2 },
    '3.00': { name: 'MARGEM BRUTA', formula: '1.00 - 2.00', level: 1 },
    '4.00': { name: 'DESPESAS OPERACIONAIS', type: 'expense', level: 1 },
    '4.01': { name: 'Despesas Administrativas (Aluguel, Limpeza)', parent: '4.00', level: 2 },
    '4.02': { name: 'Despesas com Vendas (Comissões, Marketing)', parent: '4.00', level: 2 },
    '4.03': { name: 'Despesas Financeiras', parent: '4.00', level: 2 },
    '5.00': { name: 'RESULTADO OPERACIONAL ANTES DO IMPOSTO', formula: '3.00 - 4.00', level: 1 },
    '6.00': { name: 'IMPOSTOS', type: 'expense', level: 1 },
    '7.00': { name: 'LUCRO LÍQUIDO', formula: '5.00 - 6.00', level: 1 },
};

/**
 * ------------------------------------------------------------------
 * 1. UX & LOGS (TEMA, TOAST, SESSÃO, AUDITORIA)
 * ------------------------------------------------------------------
 */

// Hook para Tema Escuro
const useTheme = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  return { theme, toggleTheme: () => setTheme(prev => prev === 'light' ? 'dark' : 'light') };
};

// Sistema de Notificação (Toast)
const useToast = () => {
    const [toast, setToast] = useState(null);
    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);
    return [toast, showToast];
};

// Implementação de Logs de Auditoria
const logAction = async (user, action, details) => {
    try {
        if (!user || !user.email) return;
        const colRef = collection(db, 'artifacts', appId, 'logs');
        await addDoc(colRef, {
            email: user.email,
            action: action,
            timestamp: new Date().toISOString(),
            details: JSON.stringify(details || {}),
        });
    } catch (e) {
        console.error("Failed to log action:", e);
    }
};

// Hook para Expiração de Sessão (15 minutos)
const useSessionTimeout = (user, showToast) => {
    const [isAlerting, setIsAlerting] = useState(false);
    const activityTimer = useRef(null);
    const alertTimer = useRef(null);

    const resetTimers = useCallback(() => {
        if (!user) return;
        clearTimeout(activityTimer.current);
        clearTimeout(alertTimer.current);
        setIsAlerting(false);

        // Alerta 1 minuto antes (14 minutos)
        alertTimer.current = setTimeout(() => {
            setIsAlerting(true);
            showToast('Sua sessão expira em 1 minuto por inatividade.', 'warning');
        }, 14 * 60 * 1000); 

        // Logout em 15 minutos
        activityTimer.current = setTimeout(() => {
            signOut(auth);
            showToast('Sessão expirada por inatividade. Faça login novamente.', 'error');
        }, 15 * 60 * 1000); 
    }, [user, showToast]);

    useEffect(() => {
        if (user) {
            resetTimers();
            // Escutar eventos de atividade (para resetar o timer)
            const events = ['load', 'mousemove', 'mousedown', 'click', 'scroll', 'keypress'];
            events.forEach(event => window.addEventListener(event, resetTimers));
            return () => events.forEach(event => window.removeEventListener(event, resetTimers));
        } else {
            clearTimeout(activityTimer.current);
            clearTimeout(alertTimer.current);
            setIsAlerting(false);
        }
    }, [user, resetTimers]);

    return isAlerting;
};


/**
 * ------------------------------------------------------------------
 * 4. SERVIÇOS DE BANCO DE DADOS (DB)
 * ------------------------------------------------------------------
 */

const parseLegacyFile = (fileContent, selectedSegment) => {
    // ... (Lógica de parsing, mantida igual)
    const rawLines = fileContent.split('\n');
    const cleanTransactions = [];
    let buffer = [];
    const normalizedLines = [];
    rawLines.forEach((line) => {
      const trimmed = line.trim(); if (!trimmed) return;
      if (/^\d{3,};/.test(trimmed)) { if (buffer.length > 0) normalizedLines.push(buffer.join(' ')); buffer = [trimmed]; } else { buffer.push(trimmed); }
    });
    if (buffer.length > 0) normalizedLines.push(buffer.join(' '));
  
    normalizedLines.forEach((fullLine) => {
      try {
        const cols = fullLine.split(';');
        let rawValue = cols[11] || "0"; 
        if (!/^\d+$/.test(rawValue)) { const potentialValue = cols.find(c => /0000\d+/.test(c) && c.length > 8); if (potentialValue) rawValue = potentialValue; }
        let value = parseInt(rawValue, 10) / 100;
        const dateMatch = fullLine.match(/(\d{2}\/\d{2}\/\d{4})/);
        const dateStr = dateMatch ? dateMatch[0] : new Date().toLocaleDateString();
        const [dd, mm, yyyy] = dateStr.split('/');
        const isoDate = `${yyyy}-${mm}-${dd}`;
        const supplier = cols[5]?.replace(/"/g, '').trim() || 'Diversos';
        const accountPlan = cols[7]?.replace(/"/g, '').trim() || '00.00'; 
        const planDescription = cols[8]?.replace(/"/g, '').trim() || 'Conta Diversa'; 
        const type = (accountPlan.startsWith('1.') || accountPlan.startsWith('4.') || planDescription.toUpperCase().includes('RECEITA')) ? 'revenue' : 'expense';
        if (value > 0) { cleanTransactions.push({ date: isoDate, segment: selectedSegment, costCenter: 'GERAL', accountPlan, planDescription, description: supplier, value, type, source: 'file', createdAt: new Date().toISOString() }); }
      } catch (err) { console.error(err); }
    });
    return cleanTransactions;
};

const dbService = {
  // CORREÇÃO DA HIERARQUIA: Garante ímpar (Collection -> Document -> Collection...)
  getCollRef: (user, colName) => {
    if (!user) throw new Error("Usuário não autenticado");
    return collection(db, 'artifacts', appId, 'shared_data', 'DADOS_EMPRESA', colName);
  },
  
  // Perfil e Permissões
  syncUserProfile: async (user) => {
    const userRef = doc(db, 'artifacts', appId, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const usersColl = collection(db, 'artifacts', appId, 'users');
      const allUsers = await getDocs(usersColl);
      // O primeiro usuário que logar e não tiver perfil será Admin
      const initialRole = allUsers.empty ? 'admin' : 'editor';
      await setDoc(userRef, { email: user.email, role: initialRole, createdAt: new Date().toISOString() });
      return initialRole;
    }
    return snap.data().role;
  },
  getAllUsers: async () => { const usersColl = collection(db, 'artifacts', appId, 'users'); const snap = await getDocs(usersColl); return snap.docs.map(d => ({ id: d.id, ...d.data() })); },
  updateUserRole: async (userId, newRole) => { const userRef = doc(db, 'artifacts', appId, 'users', userId); await updateDoc(userRef, { role: newRole }); },

  // Transações (Tabelas Principais)
  addBulkTransactions: async (user, items) => { const chunkSize = 400; for (let i = 0; i < items.length; i += chunkSize) { const chunk = items.slice(i, i + chunkSize); const batch = writeBatch(db); const colRef = dbService.getCollRef(user, 'transactions'); chunk.forEach(item => { const docRef = doc(colRef); batch.set(docRef, item); }); await batch.commit(); } },
  addTransaction: async (user, item) => { const colRef = dbService.getCollRef(user, 'transactions'); await addDoc(colRef, item); },
  updateTransaction: async (user, id, data) => { const docRef = doc(dbService.getCollRef(user, 'transactions'), id); await updateDoc(docRef, data); },
  deleteTransaction: async (user, id) => { const docRef = doc(dbService.getCollRef(user, 'transactions'), id); await deleteDoc(docRef); },
  getAllTransactions: async (user) => { const colRef = dbService.getCollRef(user, 'transactions'); const snapshot = await getDocs(colRef); return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); },

  // Segmentos/Unidades
  getSegments: async (user) => { const colRef = dbService.getCollRef(user, 'segments'); const snapshot = await getDocs(colRef); const segs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); if (segs.length === 0) return []; return segs; },
  addSegment: async (user, name) => { const colRef = dbService.getCollRef(user, 'segments'); await addDoc(colRef, { name }); },
  updateSegment: async (user, id, newName) => { const docRef = doc(dbService.getCollRef(user, 'segments'), id); await updateDoc(docRef, { name: newName }); },
  deleteSegment: async (user, id) => { const docRef = doc(dbService.getCollRef(user, 'segments'), id); await deleteDoc(docRef); }
};

/**
 * ------------------------------------------------------------------
 * 4. SERVIÇOS (IA & PDF)
 * ------------------------------------------------------------------
 */

const aiService = {
  analyze: async (transactions, period) => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("SUA_KEY")) return "Erro: Configure a API Key do Gemini no código.";
    
    const revenue = transactions.filter(t => t.type === 'revenue').reduce((acc, t) => acc + t.value, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.value, 0);
    const categories = {};
    transactions.filter(t => t.type === 'expense').forEach(t => { categories[t.segment] = (categories[t.segment] || 0) + t.value; });
    const topCategories = Object.entries(categories).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([k,v]) => `${k}: R$ ${v.toFixed(2)}`).join(', ');

    const prompt = `Atue como um Consultor Financeiro Sênior. Analise os dados deste mês (${period}): Receita Total: R$ ${revenue.toFixed(2)} | Despesa Total: R$ ${expense.toFixed(2)} | Saldo: R$ ${(revenue - expense).toFixed(2)} | Top Gastos por Unidade: ${topCategories}. Escreva um relatório curto (máx 3 parágrafos) em Português com Diagnóstico, Alerta e Dica Prática.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Não foi possível gerar a análise.";
    } catch (error) { return "Erro de conexão com a IA."; }
  },

  generatePDF: (reportText, transactions, period) => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text(`Relatório de Custos - ${period}`, 14, 20);
    doc.setFontSize(10); doc.text(`Gerado em ${new Date().toLocaleDateString()}`, 14, 26);

    doc.setFontSize(12); doc.setTextColor(100); doc.text("Análise Inteligente (IA):", 14, 35);
    doc.setFontSize(10); doc.setTextColor(0);
    const splitText = doc.splitTextToSize(reportText, 180);
    doc.text(splitText, 14, 42);

    const startY = 45 + (splitText.length * 5);
    doc.autoTable({
      startY: startY,
      head: [['Data', 'Descrição', 'Unidade', 'Tipo', 'Valor']],
      body: transactions.map(t => [new Date(t.date + 'T12:00:00').toLocaleDateString(), t.description, t.segment, t.type === 'revenue' ? 'Receita' : 'Despesa', `R$ ${t.value.toFixed(2)}`]),
      styles: { fontSize: 8 }, headStyles: { fillColor: [79, 70, 229] }
    });
    doc.save(`Relatorio_${period.replace(/\s/g, '_')}.pdf`);
  }
};

/**
 * ------------------------------------------------------------------
 * 5. COMPONENTES UI PRINCIPAIS
 * ------------------------------------------------------------------
 */

// Tela de Login com Reset de Senha
const LoginScreen = ({ showToast }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
  
    const handleAuth = async (e) => {
        e.preventDefault(); setError(''); setLoading(true);
        try {
            if (isRegistering) await createUserWithEmailAndPassword(auth, email, password);
            else await signInWithEmailAndPassword(auth, email, password);
        } catch (err) { setError("Erro ao autenticar. Verifique os dados."); } finally { setLoading(false); }
    };

    const handlePasswordReset = async (e) => {
        e.preventDefault(); setError(''); setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
            showToast('Email de recuperação enviado! Verifique sua caixa de entrada.', 'success');
            setIsResetting(false);
        } catch (err) {
            setError("Erro ao enviar. Verifique se o email está correto.");
        } finally { setLoading(false); }
    };
  
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="bg-white dark:bg-slate-800 w-full max-w-md p-8 rounded-2xl shadow-2xl relative z-10">
          <div className="text-center mb-8"><div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4"><Building2 className="text-white" size={32} /></div><h1 className="text-2xl font-bold text-slate-800 dark:text-white">Fechamento de Custos</h1></div>
          
          <form onSubmit={isResetting ? handlePasswordReset : handleAuth} className="space-y-4">
            <input type="email" required className="w-full border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white p-3 rounded-lg" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}/>
            {!isResetting && <input type="password" required className="w-full border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white p-3 rounded-lg" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)}/>}
            
            {error && <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-lg">{error}</div>}
            
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 flex justify-center">
              {loading ? <Loader2 className="animate-spin" /> : (isResetting ? 'Enviar Link de Reset' : (isRegistering ? 'Criar Conta' : 'Entrar'))}
            </button>
          </form>
          
          <div className="flex justify-between mt-4 text-sm">
            <button onClick={() => setIsRegistering(!isRegistering)} className="text-indigo-600 dark:text-indigo-400 hover:underline">{isRegistering ? 'Já tenho conta' : 'Criar nova conta'}</button>
            <button onClick={() => setIsResetting(!isResetting)} className="text-slate-500 dark:text-slate-400 hover:underline">{isResetting ? 'Voltar ao Login' : 'Esqueci minha senha'}</button>
          </div>

        </div>
      </div>
    );
};


// KPI CARD
const KpiCard = ({ title, value, icon: Icon, color }) => {
    const bgColors = { emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400', indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' };
    return (<div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700"><div className="flex justify-between items-start"><div><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">{title}</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white">{value}</h3></div><div className={`p-3 rounded-xl ${bgColors[color] || bgColors.indigo}`}><Icon size={24} /></div></div></div>);
};

// DRE - Demonstração de Resultado (Novo Componente)
const DREComponent = ({ transactions, period, theme, userRole }) => {
    const transactionsByPlan = useMemo(() => {
        const map = {};
        transactions.forEach(t => {
            // Usa o accountPlan ou cria uma chave genérica
            const key = t.accountPlan || '9.99';
            map[key] = (map[key] || 0) + (t.type === 'revenue' ? t.value : -t.value);
        });
        return map;
    }, [transactions]);

    const calculateDRE = (txsMap) => {
        const results = { ...txsMap };
        const hierarchy = JSON.parse(JSON.stringify(DRE_PLAN_MAP)); // Deep copy

        // 1. Inserir valores de transações nos níveis base (Planos)
        Object.keys(txsMap).forEach(code => {
            // Tenta mapear o código do DB para um código DRE
            // Simulação: Se o código de DB começar com 1, joga na conta 1.01 (Receita)
            const mappedCode = code.startsWith('1.') ? '1.01' : (code.startsWith('2.') ? '2.01' : (code.startsWith('4.') ? '4.01' : '9.99'));
            if (hierarchy[mappedCode]) {
                hierarchy[mappedCode].value = (hierarchy[mappedCode].value || 0) + txsMap[code];
            } else if (mappedCode === '9.99') {
                // Outras despesas/receitas que não mapearam
                hierarchy['4.01'].value = (hierarchy['4.01'].value || 0) + txsMap[code];
            }
        });

        // 2. Cálculo de Fórmulas e Agregações (Bottom-Up)
        
        // Custo/Receita simples
        hierarchy['1.00'].value = hierarchy['1.01'].value;
        hierarchy['2.00'].value = hierarchy['2.01'].value + (hierarchy['2.02'].value || 0);
        hierarchy['4.00'].value = hierarchy['4.01'].value + (hierarchy['4.02'].value || 0) + (hierarchy['4.03'].value || 0);

        // Margem Bruta (Fórmula)
        hierarchy['3.00'].value = hierarchy['1.00'].value - hierarchy['2.00'].value;
        
        // Resultado Operacional (Fórmula)
        hierarchy['5.00'].value = hierarchy['3.00'].value - hierarchy['4.00'].value;

        // Lucro Líquido (Fórmula) (Simulando Imposto fixo para simplificar)
        hierarchy['6.00'].value = hierarchy['1.00'].value * 0.1; // 10% de imposto simulado
        hierarchy['7.00'].value = hierarchy['5.00'].value - hierarchy['6.00'].value;

        return hierarchy;
    };

    const dreResult = useMemo(() => calculateDRE(transactionsByPlan), [transactionsByPlan]);

    const DRENodo = ({ code, data, allData, level }) => {
        const node = allData[code];
        const [expanded, setExpanded] = useState(level < 2);
        const isFormula = node.formula;
        const value = node.value || 0;
        const color = isFormula ? (value >= 0 ? 'text-emerald-500' : 'text-rose-500') : (value >= 0 ? 'text-slate-800 dark:text-white' : 'text-rose-600 dark:text-rose-400');
        const bgColor = level === 1 ? 'bg-slate-200/50 dark:bg-slate-700/50 font-bold' : (level === 2 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-900/50');

        // Encontrar filhos (simplificado para 2 níveis)
        const children = Object.keys(allData).filter(k => allData[k].parent === code);

        return (
            <div className={`border-b border-slate-200 dark:border-slate-700 ${bgColor}`}>
                <div 
                    className="flex justify-between items-center p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                    style={{ paddingLeft: `${level * 20 + 16}px` }}
                    onClick={() => children.length > 0 && setExpanded(!expanded)}
                >
                    <span className="text-sm">
                        {children.length > 0 ? (expanded ? '▼' : '►') : ''}
                        {node.name}
                    </span>
                    <span className={`text-sm font-mono ${color}`}>
                        {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                </div>
                {expanded && children.length > 0 && (
                    <div>
                        {children.map(childCode => (
                            <DRENodo key={childCode} code={childCode} data={data} allData={allData} level={level + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700"><h3 className="font-bold text-lg text-slate-800 dark:text-white">DRE - Demonstração de Resultado ({period})</h3></div>
            <div className="overflow-x-auto">
                {/* Renderizar apenas os nós de nível 1 (os pais) */}
                {Object.keys(dreResult)
                    .filter(code => dreResult[code].level === 1)
                    .map(code => (
                        <DRENodo key={code} code={code} data={transactionsByPlan} allData={dreResult} level={1} />
                    ))}
            </div>
        </div>
    );
};

// ... (Outros componentes mantidos por brevidade)
const UserManager = ({ onClose, myRole }) => { /* ... (Mantido) ... */
    const [users, setUsers] = useState([]);
    useEffect(() => { const fetchUsers = async () => { try { const list = await dbService.getAllUsers(); setUsers(list); } catch(e) { console.error(e); } }; fetchUsers(); }, []);
    const changeRole = async (userId, newRole) => { if (myRole !== 'admin') return alert("Apenas Admins."); await dbService.updateUserRole(userId, newRole); setUsers(users.map(u => u.id === userId ? {...u, role: newRole} : u)); };
    return (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"><div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]"><div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center"><h3 className="text-xl font-bold text-slate-800 dark:text-white">Gerenciar Equipe</h3><button onClick={onClose}><X className="text-slate-500" /></button></div><div className="overflow-y-auto p-0"><table className="w-full text-left"><thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase"><tr><th className="p-4">Usuário</th><th className="p-4">Cargo</th><th className="p-4 text-right">Ação</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{users.map(u => (<tr key={u.id}><td className="p-4 text-slate-800 dark:text-white">{u.email}</td><td className="p-4"><span className="uppercase text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded dark:text-white">{u.role}</span></td><td className="p-4 text-right"><select disabled={myRole !== 'admin' || u.role === 'admin'} value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} className="border rounded p-1 dark:bg-slate-700 dark:text-white"><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Leitor</option></select></td></tr>))}</tbody></table></div></div></div>);
};

// TELA DE CUSTOS E DESPESAS (Nova Aba)
const CustosComponent = ({ transactions, theme, userRole, showToast }) => {
    // Filtros simplificados (aqui você adicionaria estado para Centro de Custo, Fornecedor etc.)
    const [filteredData, setFilteredData] = useState(transactions.filter(t => t.type === 'expense'));

    // Função de exportação para Excel/CSV
    const handleExport = (format) => {
        const dataToExport = filteredData.map(t => ({
            Data: new Date(t.date).toLocaleDateString(),
            Descricao: t.description,
            Unidade: t.segment,
            Valor: t.value
        }));

        if (format === 'PDF') {
            const doc = new jsPDF();
            doc.autoTable({
                head: [['Data', 'Descrição', 'Unidade', 'Valor (R$)']],
                body: dataToExport.map(row => Object.values(row)),
                styles: { fontSize: 9 },
            });
            doc.save('custos_e_despesas.pdf');
        } else {
            const worksheet = XLSX.utils.json_to_sheet(dataToExport);
            const workbook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
            XLSX.writeFile(workbook, `custos_e_despesas.${format.toLowerCase()}`);
        }
        showToast(`Dados exportados para ${format}.`, 'success');
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white">Custos e Despesas</h3>
                <div className="flex gap-2">
                    <button onClick={() => handleExport('PDF')} className="text-rose-500 hover:text-rose-700 flex items-center text-sm gap-1"><Download size={16}/> PDF</button>
                    <button onClick={() => handleExport('CSV')} className="text-emerald-500 hover:text-emerald-700 flex items-center text-sm gap-1"><Download size={16}/> CSV</button>
                    <button onClick={() => handleExport('XLSX')} className="text-indigo-500 hover:text-indigo-700 flex items-center text-sm gap-1"><Download size={16}/> XLSX</button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase text-slate-500 dark:text-slate-400">
                        <tr><th className="p-4">Data</th><th className="p-4">Descrição</th><th className="p-4">Unidade</th><th className="p-4">Conta Contábil</th><th className="p-4 text-right">Valor</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredData.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="p-4 text-slate-700 dark:text-slate-300">{new Date(t.date + 'T12:00:00').toLocaleDateString()}</td>
                                <td className="p-4 font-medium text-slate-800 dark:text-white">{t.description}</td>
                                <td className="p-4 text-xs text-slate-500 dark:text-slate-400">{t.segment}</td>
                                <td className="p-4 text-xs text-slate-500 dark:text-slate-400">{t.planDescription}</td>
                                <td className={`p-4 font-bold text-rose-600 dark:text-rose-400 text-right`}>{t.value.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


// ... (Implementação dos outros componentes (Estoque, ProducaoVendas, etc.) seguem o mesmo padrão de modularidade e simplicidade, focando em manter o App.jsx limpo)

/**
 * ------------------------------------------------------------------
 * 6. APP PRINCIPAL
 * ------------------------------------------------------------------
 */
export default function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('viewer');
  const [loadingAuth, setLoadingAuth] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const [toast, showToast] = useToast(); // Novo sistema de notificação

  const isSessionAlerting = useSessionTimeout(user, showToast); // Expiração de sessão

  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [segments, setSegments] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('ALL');
  
  const [showSegmentManager, setShowSegmentManager] = useState(false);
  const [showUserManager, setShowUserManager] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Verificação de permissões
  const canCreate = userRole === 'admin' || userRole === 'editor';
  const canEdit = userRole === 'admin' || userRole === 'editor';
  const canDelete = userRole === 'admin';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) { 
         const role = await dbService.syncUserProfile(u); 
         setUserRole(role); 
         logAction(u, 'LOGIN', { email: u.email });
      } else {
        // Log de logout é mais difícil de garantir aqui, mas a regra do Firebase garante a segurança
        setUserRole('viewer');
      }
      setUser(u); setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    if (!user) return;
    try {
        const txs = await dbService.getAllTransactions(user);
        const segs = await dbService.getSegments(user);
        let filtered = txs.sort((a, b) => new Date(b.date) - new Date(a.date));
        if (globalFilter !== 'ALL') filtered = filtered.filter(t => t.segment === globalFilter);
        setTransactions(filtered);
        setSegments(segs);
    } catch (e) {
        showToast("Erro ao carregar dados: " + e.message, 'error');
    }
  };
  useEffect(() => { if (user) loadData(); }, [user, globalFilter]);

  const handleImport = async () => {
    if (!canCreate) return showToast("Acesso negado.", 'error');
    // ... (Lógica de Importação)
    if (!importText || !importSegment) return showToast("Preencha dados.", 'warning');
    setIsProcessing(true);
    try { 
        const newTxs = parseLegacyFile(importText, importSegment); 
        await dbService.addBulkTransactions(user, newTxs); 
        await logAction(user, 'IMPORTACAO', { count: newTxs.length, segment: importSegment });
        setImportText(''); await loadData(); 
        showToast(`${newTxs.length} registros importados com sucesso.`, 'success');
    } catch(e) { showToast("Erro ao importar.", 'error'); } 
    finally { setIsProcessing(false); }
  };
  // ... (handleFileUpload, handleLogout)
  const handleFileUpload = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (evt) => setImportText(evt.target.result); reader.readAsText(file); };
  const handleLogout = async () => await signOut(auth);

  const dashboardData = useMemo(() => {
    const filtered = transactions.filter(t => { const d = new Date(t.date); return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear; });
    const revenue = filtered.filter(t => t.type === 'revenue').reduce((acc, t) => acc + t.value, 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.value, 0);
    const chartData = [ { name: 'Entradas', valor: revenue, fill: '#10b981' }, { name: 'Saídas', valor: expense, fill: '#f43f5e' } ];
    
    // Comparativo mês a mês (apenas um exemplo simples)
    const monthlyComparison = [
        { name: 'Mês-1', Receita: 1000, Despesa: 300 },
        { name: 'Mês-2', Receita: 1500, Despesa: 450 },
        { name: 'Atual', Receita: revenue, Despesa: expense }
    ];

    return { 
        revenue, expense, balance: revenue - expense, filtered, chartData, 
        monthlyComparison 
    };
  }, [transactions, selectedMonth, selectedYear]);

  const monthLabel = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][selectedMonth];

  if (loadingAuth) return <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;
  if (!user) return <LoginScreen showToast={showToast} />;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex font-sans text-slate-900 dark:text-slate-100 transition-colors">
        
      {/* Sistema de Toast (Notificações) */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] p-4 rounded-lg shadow-xl flex items-center gap-3 transition-transform duration-300 ${toast.type === 'success' ? 'bg-emerald-500 text-white' : (toast.type === 'error' ? 'bg-rose-500 text-white' : 'bg-yellow-500 text-black')}`}>
            {toast.type === 'success' && <CheckCircle size={20} />}
            {toast.type === 'error' && <AlertTriangle size={20} />}
            {toast.type === 'warning' && <AlertTriangle size={20} />}
            <span>{toast.message}</span>
        </div>
      )}
      
      {/* Menu Lateral */}
      <aside className="w-20 lg:w-64 bg-slate-900 dark:bg-slate-950 text-white flex-col sticky top-0 h-screen hidden md:flex border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3"><div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center"><Building2 size={18} /></div><span className="text-xl font-bold hidden lg:block">Fechamento de Custos</span></div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><LayoutDashboard size={20} /><span className="hidden lg:block">Dashboard</span></button>
          <button onClick={() => setActiveTab('lancamentos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'lancamentos' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><List size={20} /><span className="hidden lg:block">Lançamentos</span></button>
          <button onClick={() => setActiveTab('custos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'custos' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><DollarSign size={20} /><span className="hidden lg:block">Custos & Despesas</span></button>
          <button onClick={() => setActiveTab('dre')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dre' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><FileText size={20} /><span className="hidden lg:block">DRE</span></button>
          <button onClick={() => setActiveTab('estoque')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'estoque' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Zap size={20} /><span className="hidden lg:block">Estoque</span></button>
          {canCreate && <button onClick={() => setActiveTab('ingestion')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'ingestion' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><UploadCloud size={20} /><span className="hidden lg:block">Importar</span></button>}
          {userRole === 'admin' && <button onClick={() => setShowUserManager(true)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-400 hover:bg-slate-800`}><Users size={20} /><span className="hidden lg:block">Usuários</span></button>}
        </nav>
        <div className="p-4 border-t border-slate-800"><div className="flex items-center gap-2 text-sm text-slate-400"><div className="p-1 bg-slate-800 rounded"><UserCircle size={16} /></div><div className="flex-1 min-w-0"><p className="truncate font-bold text-white">{user.email}</p><p className="text-xs uppercase tracking-wider text-indigo-400">{userRole}</p></div></div></div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div><h1 className="text-2xl font-bold text-slate-800 dark:text-white">Painel de Controle</h1></div>
          <div className="flex gap-2 w-full md:w-auto items-center">
             <button onClick={() => setShowAIModal(true)} className="p-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 flex items-center gap-2 font-bold px-4">
                 <Sparkles size={18} /> <span className="hidden sm:inline">IA & Relatório</span>
             </button>
             <button onClick={toggleTheme} className="p-2.5 bg-white dark:bg-slate-800 border dark:border-slate-700 hover:bg-slate-100 rounded-lg text-slate-600 dark:text-slate-300">{theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}</button>
             <select className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-white text-sm rounded-lg p-2.5 outline-none" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)}><option value="ALL">Todas Unidades</option>{segments.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
             {canCreate && <button onClick={() => setShowSegmentManager(true)} className="p-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 dark:text-white rounded-lg"><Settings size={20} /></button>}
             {canCreate && <button onClick={() => { setEditingTransaction(null); setShowEntryModal(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><PlusCircle size={18} /> <span className="hidden sm:inline">Novo</span></button>}
             <button onClick={handleLogout} className="bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-2 rounded-lg"><LogOut size={18} /></button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* ... (Filtros e Cards KPI - mantidos) ... */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm flex gap-4 items-center border border-slate-100 dark:border-slate-700">
              <Calendar className="text-slate-400" />
              <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 text-slate-700 dark:text-white p-2 rounded outline-none">{['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
              <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 text-slate-700 dark:text-white p-2 rounded outline-none"><option value={2024}>2024</option><option value={2025}>2025</option></select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KpiCard title="Receitas" value={dashboardData.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={TrendingUp} color="emerald" />
              <KpiCard title="Despesas" value={dashboardData.expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={TrendingDown} color="rose" />
              <KpiCard title="Resultado" value={dashboardData.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={DollarSign} color={dashboardData.balance >= 0 ? 'indigo' : 'rose'} />
            </div>
            {/* Gráfico de Comparação Mês a Mês (Linhas) */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm h-80 border border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-lg mb-4">Comparativo Mensal (Exemplo)</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.monthlyComparison}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                        <XAxis dataKey="name" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} />
                        <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="Receita" stroke="#10b981" strokeWidth={2} />
                        <Line type="monotone" dataKey="Despesa" stroke="#f43f5e" strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            {/* Gráfico de Barras do Mês Atual (mantido) */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm h-80 border border-slate-100 dark:border-slate-700">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={dashboardData.chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} /><XAxis dataKey="name" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} /><YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} /><Tooltip contentStyle={{backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', borderColor: theme === 'dark' ? '#334155' : '#e2e8f0', color: theme === 'dark' ? '#fff' : '#000'}} /><Bar dataKey="valor" radius={[4, 4, 0, 0]} barSize={60} /></BarChart></ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'lancamentos' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700">
             {/* ... (Tabela de Lançamentos - Atualizada para respeitar permissões) ... */}
             <div className="p-6 border-b border-slate-100 dark:border-slate-700"><h3 className="font-bold text-lg text-slate-800 dark:text-white">Lançamentos</h3></div>
             <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase text-slate-500 dark:text-slate-400"><tr><th className="p-4">Data</th><th className="p-4">Descrição</th><th className="p-4">Unidade</th><th className="p-4">Valor</th><th className="p-4">Ações</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{transactions.map(t => (<tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"><td className="p-4 text-slate-700 dark:text-slate-300">{new Date(t.date + 'T12:00:00').toLocaleDateString()}</td><td className="p-4 font-medium text-slate-800 dark:text-white">{t.description}</td><td className="p-4 text-xs text-slate-500 dark:text-slate-400">{t.segment}</td><td className={`p-4 font-bold ${t.type === 'revenue' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{t.value.toFixed(2)}</td><td className="p-4 flex gap-2">
                {canEdit && <button onClick={() => {setEditingTransaction(t); setShowEntryModal(true);}} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-2 rounded"><Edit2 size={16}/></button>}
                {canDelete ? <button onClick={() => dbService.deleteTransaction(user, t.id).then(loadData)} className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 p-2 rounded"><Trash2 size={16}/></button> : <Lock size={16} className="text-slate-300"/>}
             </td></tr>))}</tbody></table></div>
          </div>
        )}

        {activeTab === 'custos' && (
            <CustosComponent transactions={transactions} theme={theme} userRole={userRole} showToast={showToast} />
        )}
        
        {activeTab === 'dre' && (
            <DREComponent 
                transactions={transactions} 
                period={`${monthLabel}/${selectedYear}`} 
                theme={theme}
                userRole={userRole}
            />
        )}
        
        {activeTab === 'estoque' && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 border border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-4">Estoque e Custo Médio (Em desenvolvimento)</h3>
                <p className="text-slate-500 dark:text-slate-400">Aqui serão listadas as movimentações e o cálculo do Custo Médio de cada produto.</p>
                {/* Lançamentos de Movimentação de Estoque seriam adicionados via ManualEntryModal */}
            </div>
        )}

        {activeTab === 'ingestion' && (
            <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
               {/* ... (Tela de Importação - Atualizada com Preview e Validação) ... */}
               <h2 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">Importação de TXT</h2>
               <div className="space-y-6">
                  <div><label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Para qual Unidade?</label><select className="w-full border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white p-2 rounded" value={importSegment} onChange={e => setImportSegment(e.target.value)}><option value="">Selecione...</option>{segments.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50" onClick={() => fileInputRef.current?.click()}><FileUp className="mx-auto text-slate-400 mb-2" size={32} /><p className="text-sm text-slate-600 dark:text-slate-400">Clique para selecionar arquivo .TXT</p><input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileUpload} /></div>
                  
                  {/* Preview da Importação */}
                  {importText && (
                      <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg max-h-48 overflow-y-auto">
                          <p className="font-bold text-sm mb-2">Prévia e Validação:</p>
                          <pre className="text-xs font-mono whitespace-pre-wrap dark:text-slate-300">{importText.substring(0, 500)}...</pre>
                          <p className="text-xs mt-2 text-yellow-600 dark:text-yellow-400">Apenas os 500 primeiros caracteres para prévia. Clique em Processar para validação total.</p>
                      </div>
                  )}

                  <textarea className="w-full h-32 border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded p-2 text-xs font-mono" placeholder="Ou cole o conteúdo aqui..." value={importText} onChange={e => setImportText(e.target.value)} />
                  <button onClick={handleImport} disabled={isProcessing || !canCreate} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{isProcessing ? 'Processando...' : 'Processar Importação'}</button>
               </div>
            </div>
        )}
      </main>

      {showSegmentManager && user && <SegmentManager onClose={() => setShowSegmentManager(false)} segments={segments} onUpdate={loadData} user={user} role={userRole} />}
      {showUserManager && user && <UserManager onClose={() => setShowUserManager(false)} myRole={userRole} />}
      {showEntryModal && user && <ManualEntryModal onClose={() => setShowEntryModal(false)} segments={segments} onSave={loadData} user={user} initialData={editingTransaction} />}
      {showAIModal && user && <AIReportModal onClose={() => setShowAIModal(false)} transactions={dashboardData.filtered} period={`${monthLabel}/${selectedYear}`} />}
    </div>
  );
}
