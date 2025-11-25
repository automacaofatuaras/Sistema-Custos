import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  LayoutDashboard, UploadCloud, TrendingUp, TrendingDown, 
  DollarSign, Trash2, Building2, PlusCircle, Settings, Edit2, 
  Save, X, Calendar, Loader2, List, FileUp, LogOut, UserCircle, 
  Users, Sun, Moon, Lock, Sparkles, FileText, Download, AlertTriangle, CheckCircle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, getDocs, deleteDoc, 
  doc, updateDoc, writeBatch, setDoc, getDoc 
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
const GEMINI_API_KEY = "AIzaSyA6feDMeD7YNNQf40q2ALOvwPnfCDa7Pw4"; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'financial-saas-production';

const useTheme = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  return { theme, toggleTheme: () => setTheme(prev => prev === 'light' ? 'dark' : 'light') };
};

// Sistema de Toast Simplificado
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
 * 1. FUNÇÕES AUXILIARES (PARSER TXT)
 * ------------------------------------------------------------------
 */
const parseLegacyFile = (fileContent, selectedSegment) => {
  const rawLines = fileContent.split('\n');
  const cleanTransactions = [];
  let buffer = [];
  const normalizedLines = [];
  
  rawLines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (/^\d{3,};/.test(trimmed)) {
      if (buffer.length > 0) normalizedLines.push(buffer.join(' '));
      buffer = [trimmed];
    } else {
      buffer.push(trimmed);
    }
  });
  if (buffer.length > 0) normalizedLines.push(buffer.join(' '));

  normalizedLines.forEach((fullLine) => {
    try {
      const cols = fullLine.split(';');
      let rawValue = cols[11] || "0"; 
      if (!/^\d+$/.test(rawValue)) {
          const potentialValue = cols.find(c => /0000\d+/.test(c) && c.length > 8);
          if (potentialValue) rawValue = potentialValue;
      }
      let value = parseInt(rawValue, 10) / 100;
      if (isNaN(value)) return;

      const dateMatch = fullLine.match(/(\d{2}\/\d{2}\/\d{4})/);
      const dateStr = dateMatch ? dateMatch[0] : new Date().toLocaleDateString();
      const [dd, mm, yyyy] = dateStr.split('/');
      const isoDate = `${yyyy}-${mm}-${dd}`;
      
      const supplier = cols[5]?.replace(/"/g, '').trim() || 'Diversos';
      const planDescription = cols[8]?.replace(/"/g, '').trim() || 'Conta Diversa'; 
      const type = (cols[7]?.startsWith('1.') || cols[7]?.startsWith('4.') || planDescription.toUpperCase().includes('RECEITA')) ? 'revenue' : 'expense';
      
      if (value > 0) {
        cleanTransactions.push({
          date: isoDate, segment: selectedSegment, costCenter: 'GERAL', 
          accountPlan: cols[7] || '00.00', planDescription, description: supplier, 
          value, type, source: 'file', createdAt: new Date().toISOString()
        });
      }
    } catch (err) { console.error(err); }
  });
  return cleanTransactions;
};

/**
 * ------------------------------------------------------------------
 * 2. SERVIÇO DE DADOS (DB)
 * ------------------------------------------------------------------
 */
const dbService = {
  // CAMINHO CORRIGIDO (shared_container)
  getCollRef: (user, colName) => {
    if (!user) throw new Error("Usuário não autenticado");
    return collection(db, 'artifacts', appId, 'shared_container', 'DADOS_EMPRESA', colName);
  },

  syncUserProfile: async (user) => {
    try {
        const userRef = doc(db, 'artifacts', appId, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const usersColl = collection(db, 'artifacts', appId, 'users');
          const allUsers = await getDocs(usersColl);
          const initialRole = allUsers.empty ? 'admin' : 'editor';
          await setDoc(userRef, { email: user.email, role: initialRole, createdAt: new Date().toISOString() });
          return initialRole;
        }
        return snap.data().role;
    } catch (e) {
        console.error("Erro perfil:", e);
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

  addBulkTransactions: async (user, items) => {
    const chunkSize = 400;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      const colRef = dbService.getCollRef(user, 'transactions');
      chunk.forEach(item => { const docRef = doc(colRef); batch.set(docRef, item); });
      await batch.commit();
    }
  },

  addTransaction: async (user, item) => {
    const colRef = dbService.getCollRef(user, 'transactions');
    await addDoc(colRef, item);
  },
  
  updateTransaction: async (user, id, data) => {
    const docRef = doc(dbService.getCollRef(user, 'transactions'), id);
    await updateDoc(docRef, data);
  },

  deleteTransaction: async (user, id) => {
    const docRef = doc(dbService.getCollRef(user, 'transactions'), id);
    await deleteDoc(docRef);
  },

  getAllTransactions: async (user) => {
    const colRef = dbService.getCollRef(user, 'transactions');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  getSegments: async (user) => {
    const colRef = dbService.getCollRef(user, 'segments');
    const snapshot = await getDocs(colRef);
    const segs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return segs;
  },

  addSegment: async (user, name) => {
    const colRef = dbService.getCollRef(user, 'segments');
    await addDoc(colRef, { name });
  },
  
  updateSegment: async (user, id, newName) => {
    const docRef = doc(dbService.getCollRef(user, 'segments'), id);
    await updateDoc(docRef, { name: newName });
  },
  
  deleteSegment: async (user, id) => {
    const docRef = doc(dbService.getCollRef(user, 'segments'), id);
    await deleteDoc(docRef);
  }
};

const aiService = {
  analyze: async (transactions, period) => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("SUA_KEY")) return "Erro: Configure a API Key do Gemini.";
    const revenue = transactions.filter(t => t.type === 'revenue').reduce((acc, t) => acc + t.value, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.value, 0);
    const categories = {};
    transactions.filter(t => t.type === 'expense').forEach(t => { categories[t.segment] = (categories[t.segment] || 0) + t.value; });
    const topCategories = Object.entries(categories).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([k,v]) => `${k}: R$ ${v.toFixed(2)}`).join(', ');
    const prompt = `Analise os dados (${period}): Receita R$ ${revenue.toFixed(2)}, Despesa R$ ${expense.toFixed(2)}, Top Gastos: ${topCategories}. Dê 3 insights curtos em português.`;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta da IA.";
    } catch (error) { return "Erro na IA."; }
  },
  generatePDF: (reportText, transactions, period) => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text(`Relatório - ${period}`, 14, 20);
    doc.setFontSize(10); doc.text(reportText, 14, 30, { maxWidth: 180 });
    doc.autoTable({ startY: 60, head: [['Data', 'Desc', 'Valor']], body: transactions.map(t => [new Date(t.date).toLocaleDateString(), t.description, `R$ ${t.value.toFixed(2)}`]) });
    doc.save('relatorio.pdf');
  }
};

/**
 * ------------------------------------------------------------------
 * 3. COMPONENTES UI (DEFINIDOS ANTES DO APP)
 * ------------------------------------------------------------------
 */

const LoginScreen = ({ showToast }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const handleAuth = async (e) => {
      e.preventDefault(); setLoading(true);
      try {
        if (isRegistering) await createUserWithEmailAndPassword(auth, email, password);
        else await signInWithEmailAndPassword(auth, email, password);
      } catch (err) { showToast("Erro ao autenticar.", 'error'); } finally { setLoading(false); }
    };
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 w-full max-w-md p-8 rounded-2xl shadow-2xl">
          <h1 className="text-2xl font-bold text-center mb-6 text-slate-800 dark:text-white">Login Financeiro</h1>
          <form onSubmit={handleAuth} className="space-y-4">
            <input className="w-full border p-3 rounded dark:bg-slate-700 dark:text-white" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" className="w-full border p-3 rounded dark:bg-slate-700 dark:text-white" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} />
            <button disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded hover:bg-indigo-700">{loading ? <Loader2 className="animate-spin mx-auto"/> : (isRegistering ? 'Criar Conta' : 'Entrar')}</button>
          </form>
          <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-4 text-indigo-500 text-sm">{isRegistering ? 'Já tenho conta' : 'Criar nova conta'}</button>
        </div>
      </div>
    );
};

const KpiCard = ({ title, value, icon: Icon, color }) => {
    const bgColors = { emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400', indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' };
    return (<div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700"><div className="flex justify-between items-start"><div><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">{title}</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white">{value}</h3></div><div className={`p-3 rounded-xl ${bgColors[color] || bgColors.indigo}`}><Icon size={24} /></div></div></div>);
};

const SegmentManager = ({ onClose, segments, onUpdate, user, role, showToast }) => {
    const [newSegment, setNewSegment] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [loading, setLoading] = useState(false);
  
    const handleAdd = async () => {
      if (!newSegment.trim()) return;
      setLoading(true);
      try { await dbService.addSegment(user, newSegment); setNewSegment(''); await onUpdate(); showToast("Unidade criada!", 'success'); } 
      catch (error) { showToast("Erro ao salvar: " + error.message, 'error'); } finally { setLoading(false); }
    };
    const handleDelete = async (id) => { if (confirm('Tem certeza?')) { await dbService.deleteSegment(user, id); onUpdate(); } };
    const handleEdit = async (id) => { await dbService.updateSegment(user, id, editName); setEditingId(null); onUpdate(); }
  
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700">
          <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800 dark:text-white">Unidades</h3><button onClick={onClose}><X /></button></div>
          <div className="flex gap-2 mb-6"><input className="flex-1 border rounded px-3 py-2 dark:bg-slate-700 dark:text-white" placeholder="Nome..." value={newSegment} onChange={e => setNewSegment(e.target.value)}/><button onClick={handleAdd} disabled={loading} className="bg-indigo-600 text-white px-4 rounded">{loading ? <Loader2 className="animate-spin" /> : <PlusCircle />}</button></div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(segments || []).map(seg => (
              <div key={seg.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                {editingId === seg.id ? (<div className="flex flex-1 gap-2"><input className="flex-1 border rounded px-2 py-1 text-sm dark:bg-slate-900 dark:text-white" value={editName} onChange={e => setEditName(e.target.value)}/><button onClick={() => handleEdit(seg.id)} className="text-emerald-500"><Save size={16}/></button></div>) : <span className="text-slate-700 dark:text-slate-200 font-medium">{seg.name}</span>}
                {editingId !== seg.id && (<div className="flex gap-1"><button onClick={() => { setEditingId(seg.id); setEditName(seg.name); }} className="p-2 text-blue-600"><Edit2 size={16} /></button>{role === 'admin' && <button onClick={() => handleDelete(seg.id)} className="p-2 text-rose-600"><Trash2 size={16} /></button>}</div>)}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
};

const ManualEntryModal = ({ onClose, segments, onSave, user, initialData, showToast }) => {
    const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], type: 'revenue', description: '', value: '', segment: '' });
    useEffect(() => { 
        if(initialData) setForm({ date: initialData.date, type: initialData.type, description: initialData.description, value: initialData.value, segment: initialData.segment });
        else if (segments && segments.length > 0) setForm(f => ({...f, segment: segments[0].name}));
    }, [initialData, segments]);

    const handleSubmit = async () => {
      const val = parseFloat(form.value); 
      if (!form.description || isNaN(val) || !form.segment) return showToast("Preencha todos os campos.", 'error');
      const transaction = { ...form, value: val, planDescription: form.type === 'revenue' ? 'Receita' : 'Despesa', accountPlan: form.type === 'revenue' ? '1.01' : '4.01', costCenter: 'GERAL', source: 'manual', createdAt: new Date().toISOString() };
      try {
          if(initialData?.id) await dbService.updateTransaction(user, initialData.id, transaction); else await dbService.addTransaction(user, transaction);
          showToast("Salvo com sucesso!", 'success');
          onSave(); onClose();
      } catch (e) { showToast("Erro ao salvar.", 'error'); }
    };
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">{initialData ? 'Editar' : 'Novo'} Lançamento</h3>
          <div className="space-y-3">
            <div className="flex gap-2"><button onClick={() => setForm({ ...form, type: 'revenue' })} className={`flex-1 py-2 rounded font-bold ${form.type === 'revenue' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}>Receita</button><button onClick={() => setForm({ ...form, type: 'expense' })} className={`flex-1 py-2 rounded font-bold ${form.type === 'expense' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100'}`}>Despesa</button></div>
            <input type="date" className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            <input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" placeholder="Descrição" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <input type="number" className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" placeholder="Valor" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
            <select className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })}>
                <option value="">Selecione a Unidade...</option>
                {(segments || []).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <button onClick={handleSubmit} className="w-full bg-indigo-600 text-white py-3 rounded font-bold hover:bg-indigo-700">Salvar</button>
            <button onClick={onClose} className="w-full text-slate-500 mt-2">Cancelar</button>
          </div>
        </div>
      </div>
    );
};

const UserManager = ({ onClose, myRole }) => {
    const [users, setUsers] = useState([]);
    useEffect(() => { const fetchUsers = async () => { try { const list = await dbService.getAllUsers(); setUsers(list); } catch(e) { console.error(e); } }; fetchUsers(); }, []);
    const changeRole = async (userId, newRole) => { if (myRole !== 'admin') return; await dbService.updateUserRole(userId, newRole); setUsers(users.map(u => u.id === userId ? {...u, role: newRole} : u)); };
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-hidden flex flex-col max-h-[80vh]">
          <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-slate-800 dark:text-white">Gerenciar Equipe</h3><button onClick={onClose}><X /></button></div>
          <div className="overflow-y-auto"><table className="w-full text-left"><thead><tr><th>Usuário</th><th>Cargo</th><th>Ação</th></tr></thead><tbody>{users.map(u => (<tr key={u.id}><td className="p-2 dark:text-white">{u.email}</td><td className="p-2 dark:text-white">{u.role}</td><td className="p-2"><select disabled={myRole !== 'admin'} value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} className="border rounded p-1 dark:bg-slate-700 dark:text-white"><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Leitor</option></select></td></tr>))}</tbody></table></div>
        </div>
      </div>
    );
};

const AIReportModal = ({ onClose, transactions, period }) => {
    const [report, setReport] = useState('');
    const [loading, setLoading] = useState(true);
    useEffect(() => { const run = async () => { const res = await aiService.analyze(transactions, period); setReport(res); setLoading(false); }; run(); }, []);
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[85vh] flex flex-col">
                <div className="flex justify-between mb-4"><h3 className="text-xl font-bold dark:text-white">Análise IA</h3><button onClick={onClose}><X /></button></div>
                <div className="flex-1 overflow-y-auto mb-4 text-slate-700 dark:text-slate-300 whitespace-pre-line">{loading ? <div className="text-center"><Loader2 className="animate-spin mx-auto"/> Analisando...</div> : report}</div>
                <button onClick={() => aiService.generatePDF(report, transactions, period)} className="bg-indigo-600 text-white py-2 rounded flex justify-center gap-2"><Download size={18}/> Baixar PDF</button>
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
  const [userRole, setUserRole] = useState('admin'); // Padrão admin para garantir acesso
  const [loadingAuth, setLoadingAuth] = useState(true);
  const { theme, toggleTheme } = useTheme();
  const [toast, showToast] = useToast();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [segments, setSegments] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('ALL');
  
  const [showSegmentManager, setShowSegmentManager] = useState(false);
  const [showUserManager, setShowUserManager] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  
  const [importText, setImportText] = useState('');
  const [importSegment, setImportSegment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) { const role = await dbService.syncUserProfile(u); setUserRole(role); }
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
    } catch (e) { showToast("Erro ao carregar dados: " + e.message, 'error'); }
  };
  useEffect(() => { if (user) loadData(); }, [user, globalFilter]);

  const handleImport = async () => {
    if (!importText || !importSegment) return showToast("Preencha dados.", 'warning');
    setIsProcessing(true);
    try { 
        const newTxs = parseLegacyFile(importText, importSegment); 
        await dbService.addBulkTransactions(user, newTxs); 
        setImportText(''); await loadData(); showToast(`${newTxs.length} importados!`, 'success'); 
    } catch(e) { showToast("Erro ao importar.", 'error'); } 
    finally { setIsProcessing(false); }
  };
  
  const handleFileUpload = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (evt) => setImportText(evt.target.result); reader.readAsText(file); };
  const handleLogout = async () => await signOut(auth);

  const dashboardData = useMemo(() => {
    const filtered = transactions.filter(t => { const d = new Date(t.date); return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear; });
    const revenue = filtered.filter(t => t.type === 'revenue').reduce((acc, t) => acc + t.value, 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.value, 0);
    const chartData = [ { name: 'Entradas', valor: revenue, fill: '#10b981' }, { name: 'Saídas', valor: expense, fill: '#f43f5e' } ];
    return { revenue, expense, balance: revenue - expense, filtered, chartData };
  }, [transactions, selectedMonth, selectedYear]);

  if (loadingAuth) return <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;
  if (!user) return <LoginScreen showToast={showToast} />;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex font-sans text-slate-900 dark:text-slate-100 transition-colors">
      {toast && <div className={`fixed top-4 right-4 z-50 p-4 rounded shadow-xl flex gap-2 ${toast.type==='success'?'bg-emerald-500 text-white':'bg-rose-500 text-white'}`}>{toast.type==='success'?<CheckCircle/>:<AlertTriangle/>}{toast.message}</div>}
      
      <aside className="w-20 lg:w-64 bg-slate-900 dark:bg-slate-950 text-white flex-col sticky top-0 h-screen hidden md:flex border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3"><div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center"><Building2 size={18} /></div><span className="text-xl font-bold hidden lg:block">FinSaaS</span></div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><LayoutDashboard size={20} /><span className="hidden lg:block">Dashboard</span></button>
          <button onClick={() => setActiveTab('lancamentos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'lancamentos' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><List size={20} /><span className="hidden lg:block">Lançamentos</span></button>
          <button onClick={() => setActiveTab('ingestion')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'ingestion' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><UploadCloud size={20} /><span className="hidden lg:block">Importar</span></button>
          {userRole === 'admin' && <button onClick={() => setShowUserManager(true)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-400 hover:bg-slate-800`}><Users size={20} /><span className="hidden lg:block">Usuários</span></button>}
        </nav>
        <div className="p-4 border-t border-slate-800"><div className="flex items-center gap-2 text-sm text-slate-400"><div className="p-1 bg-slate-800 rounded"><UserCircle size={16} /></div><div className="flex-1 min-w-0"><p className="truncate font-bold text-white">{user.email}</p><p className="text-xs uppercase tracking-wider text-indigo-400">{userRole}</p></div></div></div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div><h1 className="text-2xl font-bold text-slate-800 dark:text-white">Painel de Controle</h1></div>
          <div className="flex gap-2 w-full md:w-auto items-center">
             <button onClick={() => setShowAIModal(true)} className="p-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-lg flex items-center gap-2 font-bold px-4"><Sparkles size={18} /> <span className="hidden sm:inline">IA & Relatório</span></button>
             <button onClick={toggleTheme} className="p-2.5 bg-white dark:bg-slate-800 border dark:border-slate-700 hover:bg-slate-100 rounded-lg text-slate-600 dark:text-slate-300">{theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}</button>
             <select className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-white text-sm rounded-lg p-2.5" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)}><option value="ALL">Todas Unidades</option>{(segments || []).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
             <button onClick={() => setShowSegmentManager(true)} className="p-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 dark:text-white rounded-lg"><Settings size={20} /></button>
             <button onClick={() => { setEditingTransaction(null); setShowEntryModal(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><PlusCircle size={18} /> <span className="hidden sm:inline">Novo</span></button>
             <button onClick={handleLogout} className="bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 px-3 py-2 rounded-lg"><LogOut size={18} /></button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm flex gap-4 items-center border border-slate-100 dark:border-slate-700">
              <Calendar className="text-slate-400" />
              <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 text-slate-700 dark:text-white p-2 rounded">{['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
              <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 text-slate-700 dark:text-white p-2 rounded"><option value={2024}>2024</option><option value={2025}>2025</option></select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KpiCard title="Receitas" value={dashboardData.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={TrendingUp} color="emerald" />
              <KpiCard title="Despesas" value={dashboardData.expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={TrendingDown} color="rose" />
              <KpiCard title="Resultado" value={dashboardData.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={DollarSign} color={dashboardData.balance >= 0 ? 'indigo' : 'rose'} />
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm h-80 border border-slate-100 dark:border-slate-700">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={dashboardData.chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} /><XAxis dataKey="name" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} /><YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} /><Tooltip /><Bar dataKey="valor" radius={[4, 4, 0, 0]} barSize={60} /></BarChart></ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'lancamentos' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700">
             <div className="p-6 border-b border-slate-100 dark:border-slate-700"><h3 className="font-bold text-lg text-slate-800 dark:text-white">Lançamentos</h3></div>
             <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase text-slate-500 dark:text-slate-400"><tr><th className="p-4">Data</th><th className="p-4">Descrição</th><th className="p-4">Unidade</th><th className="p-4">Valor</th><th className="p-4">Ações</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{transactions.map(t => (<tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50"><td className="p-4 text-slate-700 dark:text-slate-300">{new Date(t.date + 'T12:00:00').toLocaleDateString()}</td><td className="p-4 font-medium text-slate-800 dark:text-white">{t.description}</td><td className="p-4 text-xs text-slate-500 dark:text-slate-400">{t.segment}</td><td className={`p-4 font-bold ${t.type === 'revenue' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{t.value.toFixed(2)}</td><td className="p-4 flex gap-2"><button onClick={() => {setEditingTransaction(t); setShowEntryModal(true);}} className="text-blue-500"><Edit2 size={16}/></button><button onClick={() => dbService.deleteTransaction(user, t.id).then(loadData)} className="text-rose-500"><Trash2 size={16}/></button></td></tr>))}</tbody></table></div>
          </div>
        )}

        {activeTab === 'ingestion' && (
            <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
               <h2 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">Importação de TXT</h2>
               <div className="space-y-6">
                  <div><label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Para qual Unidade?</label><select className="w-full border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white p-2 rounded" value={importSegment} onChange={e => setImportSegment(e.target.value)}><option value="">Selecione...</option>{(segments || []).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50" onClick={() => fileInputRef.current?.click()}><FileUp className="mx-auto text-slate-400 mb-2" size={32} /><p className="text-sm text-slate-600 dark:text-slate-400">Clique para selecionar arquivo .TXT</p><input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileUpload} /></div>
                  <textarea className="w-full h-32 border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded p-2 text-xs font-mono" placeholder="Ou cole o conteúdo aqui..." value={importText} onChange={e => setImportText(e.target.value)} />
                  <button onClick={handleImport} disabled={isProcessing} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{isProcessing ? 'Processando...' : 'Processar Importação'}</button>
               </div>
            </div>
        )}
      </main>

      {showSegmentManager && user && <SegmentManager onClose={() => setShowSegmentManager(false)} segments={segments} onUpdate={loadData} user={user} role={userRole} showToast={showToast} />}
      {showUserManager && user && <UserManager onClose={() => setShowUserManager(false)} myRole={userRole} />}
      {showEntryModal && user && <ManualEntryModal onClose={() => setShowEntryModal(false)} segments={segments} onSave={loadData} user={user} initialData={editingTransaction} showToast={showToast} />}
      {showAIModal && user && <AIReportModal onClose={() => setShowAIModal(false)} transactions={dashboardData.filtered} period={`${monthLabel}/${selectedYear}`} />}
    </div>
  );
}
