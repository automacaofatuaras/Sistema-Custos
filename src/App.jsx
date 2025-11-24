import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, UploadCloud, TrendingUp, TrendingDown, 
  DollarSign, Trash2, Building2, PlusCircle, Settings, Edit2, 
  Save, X, Calendar, Loader2, List, FileUp, LogOut, UserCircle, 
  Users, Sun, Moon, Lock
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, writeBatch, setDoc, getDoc 
} from 'firebase/firestore';

/**
 * ------------------------------------------------------------------
 * 0. CONFIGURAÇÃO FIREBASE
 * ------------------------------------------------------------------
 */
// ⚠️ COLE AS SUAS CHAVES AQUI NOVAMENTE ⚠️
const firebaseConfig = {
  apiKey: "AIzaSyBmgCmtJnVRkmO2SzvyVmG5e7QCEhxDcy4",
  authDomain: "sistema-custos.firebaseapp.com",
  projectId: "sistema-custos",
  storageBucket: "sistema-custos.firebasestorage.app",
  messagingSenderId: "693431907072",
  appId: "1:693431907072:web:2dbc529e5ef65476feb9e5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'financial-saas-production';

// Hook para Tema Escuro
const useTheme = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);
  return { theme, toggleTheme: () => setTheme(prev => prev === 'light' ? 'dark' : 'light') };
};

/**
 * ------------------------------------------------------------------
 * 1. FUNÇÕES AUXILIARES
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
      const dateMatch = fullLine.match(/(\d{2}\/\d{2}\/\d{4})/);
      const dateStr = dateMatch ? dateMatch[0] : new Date().toLocaleDateString();
      const [dd, mm, yyyy] = dateStr.split('/');
      const isoDate = `${yyyy}-${mm}-${dd}`;
      const ccMatch = fullLine.match(/Centro de custo:\s*[\d\.]+\s*-\s*[\d\.]+\s*-\s*([^-]+)/i);
      let costCenter = ccMatch ? ccMatch[1].trim() : 'GERAL';
      const supplier = cols[5]?.replace(/"/g, '').trim() || 'Diversos';
      const accountPlan = cols[7]?.replace(/"/g, '').trim() || '00.00'; 
      const planDescription = cols[8]?.replace(/"/g, '').trim() || 'Conta Diversa'; 
      const type = (accountPlan.startsWith('01.') || accountPlan.startsWith('4.') || planDescription.toUpperCase().includes('RECEITA')) ? 'revenue' : 'expense';
      
      if (value > 0) {
        cleanTransactions.push({
          date: isoDate, segment: selectedSegment, costCenter, accountPlan, planDescription, 
          description: supplier, value, type, source: 'file', createdAt: new Date().toISOString()
        });
      }
    } catch (err) { console.error(err); }
  });
  return cleanTransactions;
};

/**
 * ------------------------------------------------------------------
 * 2. SERVIÇO DE DADOS (CORRIGIDO PARA MODO COMPARTILHADO)
 * ------------------------------------------------------------------
 */
const dbService = {
  getCollRef: (user, colName) => {
    if (!user) throw new Error("Usuário não autenticado");
    // CORREÇÃO: Adicionamos 'shared_container' para garantir que o caminho tenha 5 segmentos (número ímpar)
    // Caminho: artifacts (Col) -> appId (Doc) -> shared_container (Col) -> DADOS_EMPRESA (Doc) -> colName (Col)
    return collection(db, 'artifacts', appId, 'shared_container', 'DADOS_EMPRESA', colName);
  },

  syncUserProfile: async (user) => {
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
    if (segs.length === 0) return []; 
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
/**
 * ------------------------------------------------------------------
 * 3. COMPONENTES UI
 * ------------------------------------------------------------------
 */

const LoginScreen = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegistering) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      let msg = "Erro ao autenticar.";
      if(err.code === 'auth/invalid-credential') msg = "Dados incorretos.";
      if(err.code === 'auth/email-already-in-use') msg = "Email já em uso.";
      if(err.code === 'auth/weak-password') msg = "Senha muito fraca.";
      setError(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md p-8 rounded-2xl shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Fechamento de Custos</h1>
        </div>
        <form onSubmit={handleAuth} className="space-y-4">
          <input type="email" required className="w-full border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white p-3 rounded-lg" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}/>
          <input type="password" required className="w-full border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white p-3 rounded-lg" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)}/>
          {error && <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-lg">{error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 flex justify-center">
            {loading ? <Loader2 className="animate-spin" /> : (isRegistering ? 'Criar Conta' : 'Entrar')}
          </button>
        </form>
        <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-4 text-indigo-600 dark:text-indigo-400 text-sm hover:underline">
            {isRegistering ? 'Já tenho conta' : 'Criar nova conta'}
        </button>
      </div>
    </div>
  );
};

const UserManager = ({ onClose, myRole }) => {
  const [users, setUsers] = useState([]);
  
  useEffect(() => {
    const fetchUsers = async () => {
      try { const list = await dbService.getAllUsers(); setUsers(list); } 
      catch(e) { console.error(e); }
    };
    fetchUsers();
  }, []);

  const changeRole = async (userId, newRole) => {
    if (myRole !== 'admin') return alert("Apenas Admins.");
    await dbService.updateUserRole(userId, newRole);
    setUsers(users.map(u => u.id === userId ? {...u, role: newRole} : u));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">Gerenciar Equipe</h3>
          <button onClick={onClose}><X className="text-slate-500 dark:text-slate-400" /></button>
        </div>
        <div className="overflow-y-auto p-0">
           <table className="w-full text-left">
               <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase">
                   <tr><th className="p-4">Usuário</th><th className="p-4">Cargo</th><th className="p-4 text-right">Ação</th></tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                   {users.map(u => (
                       <tr key={u.id}>
                           <td className="p-4 text-slate-800 dark:text-white">{u.email}</td>
                           <td className="p-4"><span className="uppercase text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded dark:text-white">{u.role}</span></td>
                           <td className="p-4 text-right">
                               <select disabled={myRole !== 'admin' || u.role === 'admin'} value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} className="border rounded p-1 dark:bg-slate-700 dark:text-white">
                                   <option value="admin">Admin</option>
                                   <option value="editor">Editor</option>
                                   <option value="viewer">Leitor</option>
                               </select>
                           </td>
                       </tr>
                   ))}
               </tbody>
           </table>
        </div>
      </div>
    </div>
  );
};

const SegmentManager = ({ onClose, segments, onUpdate, user, role }) => {
  const [newSegment, setNewSegment] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false); // Novo estado de loading

  if (role === 'viewer') return null;

  const handleAdd = async () => {
    if (!newSegment.trim()) return alert("Digite o nome da unidade!");
    setLoading(true);
    try {
        await dbService.addSegment(user, newSegment);
        setNewSegment('');
        await onUpdate(); // Espera atualizar a lista
    } catch (error) {
        alert("Erro ao salvar unidade: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id) => { 
      if (confirm('Tem certeza?')) { 
          await dbService.deleteSegment(user, id); 
          onUpdate(); 
      } 
  };

  const handleEdit = async (id) => {
      await dbService.updateSegment(user, id, editName);
      setEditingId(null);
      onUpdate();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">Unidades</h3>
          <button onClick={onClose}><X className="text-slate-400" /></button>
        </div>
        <div className="flex gap-2 mb-6">
          <input className="flex-1 border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm" placeholder="Ex: Filial Centro..." value={newSegment} onChange={e => setNewSegment(e.target.value)}/>
          <button onClick={handleAdd} disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <PlusCircle size={18} />}
          </button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {segments.length === 0 && <p className="text-center text-sm text-slate-500">Nenhuma unidade cadastrada.</p>}
          {segments.map(seg => (
            <div key={seg.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              {editingId === seg.id ? (
                  <div className="flex flex-1 gap-2">
                    <input className="flex-1 border rounded px-2 py-1 text-sm bg-white dark:bg-slate-900 text-black dark:text-white" value={editName} onChange={e => setEditName(e.target.value)}/>
                    <button onClick={() => handleEdit(seg.id)} className="text-emerald-500"><Save size={16}/></button>
                  </div>
              ) : <span className="text-slate-700 dark:text-slate-200 font-medium">{seg.name}</span>}
              
              {editingId !== seg.id && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingId(seg.id); setEditName(seg.name); }} className="p-2 text-blue-600 dark:text-blue-400"><Edit2 size={16} /></button>
                    {role === 'admin' && <button onClick={() => handleDelete(seg.id)} className="p-2 text-rose-600 dark:text-rose-400"><Trash2 size={16} /></button>}
                  </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ title, value, icon: Icon, color }) => {
  const bgColors = { emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400', indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' };
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex justify-between items-start">
        <div><p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">{title}</p><h3 className="text-2xl font-bold text-slate-800 dark:text-white">{value}</h3></div>
        <div className={`p-3 rounded-xl ${bgColors[color] || bgColors.indigo}`}><Icon size={24} /></div>
      </div>
    </div>
  );
};

const ManualEntryModal = ({ onClose, segments, onSave, user, initialData }) => {
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], type: 'revenue', description: '', value: '', segment: segments[0]?.name || '' });

  useEffect(() => { if(initialData) { setForm({ date: initialData.date, type: initialData.type, description: initialData.description, value: initialData.value, segment: initialData.segment }) } }, [initialData]);

  const handleSubmit = async () => {
    const val = parseFloat(form.value);
    if (!form.description || isNaN(val)) return alert("Preencha corretamente.");
    const safeSegment = form.segment || (segments.length > 0 ? segments[0].name : 'Geral');
    const transaction = { ...form, value: val, segment: safeSegment, planDescription: form.type === 'revenue' ? 'Receita' : 'Despesa', accountPlan: form.type === 'revenue' ? '01.01' : '04.01', costCenter: 'GERAL', source: 'manual', createdAt: new Date().toISOString() };
    if(initialData?.id) await dbService.updateTransaction(user, initialData.id, transaction);
    else await dbService.addTransaction(user, transaction);
    onSave(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-100 dark:border-slate-700">
        <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">{initialData ? 'Editar' : 'Novo'} Lançamento</h3>
        {segments.length === 0 && <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded">Aviso: Crie uma Unidade na engrenagem antes de lançar.</div>}
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setForm({ ...form, type: 'revenue' })} className={`flex-1 py-2 rounded font-bold text-sm ${form.type === 'revenue' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>Receita</button>
            <button onClick={() => setForm({ ...form, type: 'expense' })} className={`flex-1 py-2 rounded font-bold text-sm ${form.type === 'expense' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>Despesa</button>
          </div>
          <input type="date" className="w-full border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white p-2 rounded" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <input className="w-full border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white p-2 rounded" placeholder="Descrição" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <input type="number" className="w-full border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white p-2 rounded" placeholder="Valor (R$)" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
          <select className="w-full border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white p-2 rounded" value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })}>
            {segments.length > 0 ? segments.map(s => <option key={s.id} value={s.name}>{s.name}</option>) : <option value="">Sem unidades...</option>}
          </select>
          <button onClick={handleSubmit} disabled={segments.length === 0} className="w-full bg-indigo-600 text-white py-3 rounded font-bold hover:bg-indigo-700 disabled:opacity-50">Salvar</button>
          <button onClick={onClose} className="w-full text-slate-500 dark:text-slate-400 py-2 hover:text-slate-700 dark:hover:text-slate-200">Cancelar</button>
        </div>
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

  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [segments, setSegments] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('ALL');
  
  const [showSegmentManager, setShowSegmentManager] = useState(false);
  const [showUserManager, setShowUserManager] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [importText, setImportText] = useState('');
  const [importSegment, setImportSegment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
         const role = await dbService.syncUserProfile(u);
         setUserRole(role);
      }
      setUser(u);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    if (!user) return;
    const txs = await dbService.getAllTransactions(user);
    const segs = await dbService.getSegments(user);
    let filtered = txs.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (globalFilter !== 'ALL') filtered = filtered.filter(t => t.segment === globalFilter);
    setTransactions(filtered);
    setSegments(segs);
  };

  useEffect(() => { if (user) loadData(); }, [user, globalFilter]);

  const handleImport = async () => {
    if (!importText || !importSegment) return alert("Preencha os dados.");
    setIsProcessing(true);
    try {
      const newTxs = parseLegacyFile(importText, importSegment);
      await dbService.addBulkTransactions(user, newTxs);
      setImportText(''); await loadData(); alert(`${newTxs.length} registros importados!`);
    } catch(e) { alert("Erro ao salvar."); } finally { setIsProcessing(false); }
  };
  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = (evt) => setImportText(evt.target.result); reader.readAsText(file);
  };

  const dashboardData = useMemo(() => {
    const filtered = transactions.filter(t => { const d = new Date(t.date); return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear; });
    const revenue = filtered.filter(t => t.type === 'revenue').reduce((acc, t) => acc + t.value, 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.value, 0);
    const chartData = [ { name: 'Entradas', valor: revenue, fill: '#10b981' }, { name: 'Saídas', valor: expense, fill: '#f43f5e' } ];
    return { revenue, expense, balance: revenue - expense, chartData };
  }, [transactions, selectedMonth, selectedYear]);

  const handleLogout = async () => await signOut(auth);

  if (loadingAuth) return <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>;
  if (!user) return <LoginScreen />;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex font-sans text-slate-900 dark:text-slate-100 transition-colors">
      <aside className="w-20 lg:w-64 bg-slate-900 dark:bg-slate-950 text-white flex-col sticky top-0 h-screen hidden md:flex border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center"><Building2 size={18} /></div>
          <span className="text-xl font-bold hidden lg:block">Fechamento de Custos</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><LayoutDashboard size={20} /><span className="hidden lg:block">Dashboard</span></button>
          <button onClick={() => setActiveTab('lancamentos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'lancamentos' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><List size={20} /><span className="hidden lg:block">Lançamentos</span></button>
          {userRole !== 'viewer' && <button onClick={() => setActiveTab('ingestion')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'ingestion' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><UploadCloud size={20} /><span className="hidden lg:block">Importar</span></button>}
          {userRole === 'admin' && <button onClick={() => setShowUserManager(true)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-400 hover:bg-slate-800`}><Users size={20} /><span className="hidden lg:block">Usuários</span></button>}
        </nav>
        <div className="p-4 border-t border-slate-800"><div className="flex items-center gap-2 text-sm text-slate-400"><div className="p-1 bg-slate-800 rounded"><UserCircle size={16} /></div><div className="flex-1 min-w-0"><p className="truncate font-bold text-white">{user.email}</p><p className="text-xs uppercase tracking-wider text-indigo-400">{userRole}</p></div></div></div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div><h1 className="text-2xl font-bold text-slate-800 dark:text-white">Painel de Controle</h1></div>
          <div className="flex gap-2 w-full md:w-auto items-center">
             <button onClick={toggleTheme} className="p-2.5 bg-white dark:bg-slate-800 border dark:border-slate-700 hover:bg-slate-100 rounded-lg text-slate-600 dark:text-slate-300">{theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}</button>
             <select className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-white text-sm rounded-lg p-2.5 outline-none" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)}>
                <option value="ALL">Todas Unidades</option>
                {segments.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
             </select>
             {userRole !== 'viewer' && <button onClick={() => setShowSegmentManager(true)} className="p-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 dark:text-white rounded-lg"><Settings size={20} /></button>}
             {userRole !== 'viewer' && <button onClick={() => { setEditingTransaction(null); setShowEntryModal(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><PlusCircle size={18} /> <span className="hidden sm:inline">Novo</span></button>}
             <button onClick={handleLogout} className="bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-2 rounded-lg"><LogOut size={18} /></button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
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
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm h-80 border border-slate-100 dark:border-slate-700">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={dashboardData.chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} /><XAxis dataKey="name" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} /><YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} /><Tooltip contentStyle={{backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', borderColor: theme === 'dark' ? '#334155' : '#e2e8f0', color: theme === 'dark' ? '#fff' : '#000'}} /><Bar dataKey="valor" radius={[4, 4, 0, 0]} barSize={60} /></BarChart></ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'lancamentos' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700">
             <div className="p-6 border-b border-slate-100 dark:border-slate-700"><h3 className="font-bold text-lg text-slate-800 dark:text-white">Lançamentos</h3></div>
             <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase text-slate-500 dark:text-slate-400"><tr><th className="p-4">Data</th><th className="p-4">Descrição</th><th className="p-4">Unidade</th><th className="p-4">Valor</th><th className="p-4">Ações</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{transactions.map(t => (<tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"><td className="p-4 text-slate-700 dark:text-slate-300">{new Date(t.date + 'T12:00:00').toLocaleDateString()}</td><td className="p-4 font-medium text-slate-800 dark:text-white">{t.description}</td><td className="p-4 text-xs text-slate-500 dark:text-slate-400">{t.segment}</td><td className={`p-4 font-bold ${t.type === 'revenue' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{t.value.toFixed(2)}</td><td className="p-4 flex gap-2">{userRole !== 'viewer' ? (<><button onClick={() => {setEditingTransaction(t); setShowEntryModal(true);}} className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-2 rounded"><Edit2 size={16}/></button><button onClick={() => dbService.deleteTransaction(user, t.id).then(loadData)} className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 p-2 rounded"><Trash2 size={16}/></button></>) : <Lock size={16} className="text-slate-300"/>}</td></tr>))}</tbody></table></div>
          </div>
        )}

        {activeTab === 'ingestion' && (
            <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
               <h2 className="text-xl font-bold mb-6 text-slate-800 dark:text-white">Importação de TXT</h2>
               <div className="space-y-6">
                  <div><label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Para qual Unidade?</label><select className="w-full border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white p-2 rounded" value={importSegment} onChange={e => setImportSegment(e.target.value)}><option value="">Selecione...</option>{segments.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50" onClick={() => fileInputRef.current?.click()}>
                      <FileUp className="mx-auto text-slate-400 mb-2" size={32} /><p className="text-sm text-slate-600 dark:text-slate-400">Clique para selecionar arquivo .TXT</p><input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileUpload} />
                  </div>
                  <textarea className="w-full h-32 border dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded p-2 text-xs font-mono" placeholder="Ou cole o conteúdo aqui..." value={importText} onChange={e => setImportText(e.target.value)} />
                  <button onClick={handleImport} disabled={isProcessing} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{isProcessing ? 'Processando...' : 'Processar Importação'}</button>
               </div>
            </div>
        )}
      </main>

      {showSegmentManager && user && <SegmentManager onClose={() => setShowSegmentManager(false)} segments={segments} onUpdate={loadData} user={user} role={userRole} />}
      {showUserManager && user && <UserManager onClose={() => setShowUserManager(false)} myRole={userRole} />}
      {showEntryModal && user && <ManualEntryModal onClose={() => setShowEntryModal(false)} segments={segments} onSave={loadData} user={user} initialData={editingTransaction} />}
    </div>
  );
}
