import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  LayoutDashboard, UploadCloud, TrendingUp, TrendingDown, 
  DollarSign, Trash2, Building2, PlusCircle, Settings, Edit2, 
  Save, X, Calendar, Loader2, List, FileUp, LogOut, UserCircle, 
  Users, Sun, Moon, Lock, Sparkles, FileText, Download, 
  AlertTriangle, CheckCircle, Zap, Filter, ChevronRight, ChevronDown
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
    // Portos de Areia
    "Portos de Areia: Porto Saara - Mira Estrela",
    "Portos de Areia: Porto Agua Amarela - Riolândia",
    // Noromix Concreteiras
    "Concreteiras: Fernandópolis", "Concreteiras: Ilha Solteira", "Concreteiras: Jales",
    "Concreteiras: Ouroeste", "Concreteiras: Paranaíba", "Concreteiras: Monções",
    "Concreteiras: Pereira Barreto", "Concreteiras: Três Fronteiras", "Concreteiras: Votuporanga",
    // Fábrica
    "Fábrica de Tubos: Votuporanga",
    // Pedreiras
    "Pedreiras: Mineração Grandes Lagos - Icém", "Pedreiras: Mineração Grandes Lagos - Itapura",
    "Pedreiras: Mineração Grandes Lagos - Riolândia", "Pedreiras: Mineração Grandes Lagos - Três Fronteiras",
    "Pedreiras: Noromix - Rinópolis", "Pedreiras: Mineração Noroeste - Monções",
    // Usinas
    "Usinas Asfalto: Assis", "Usinas Asfalto: Monções", "Usinas Asfalto: Itapura",
    "Usinas Asfalto: Rinópolis", "Usinas Asfalto: Demop - Três Fronteiras", "Usinas Asfalto: Grandes Lagos - Icém",
    // Construtora
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

  // Sincroniza Perfil + Seed Inicial de Unidades
  syncSystem: async (user) => {
    try {
        // 1. Perfil do Usuário
        const userRef = doc(db, 'artifacts', appId, 'users', user.uid);
        const snap = await getDoc(userRef);
        let role = 'viewer';
        
        if (!snap.exists()) {
          const usersColl = collection(db, 'artifacts', appId, 'users');
          const allUsers = await getDocs(usersColl);
          role = allUsers.empty ? 'admin' : 'viewer'; // Só o primeiro é admin, o resto deve ser ativado
          await setDoc(userRef, { email: user.email, role, createdAt: new Date().toISOString() });
        } else {
          role = snap.data().role;
        }

        // 2. Seed de Unidades (Se não existirem)
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

  // Gestão de Usuários
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
      // Nota: Isso apenas remove o registro do banco, não deleta do Authentication (precisaria de Cloud Functions)
      // Mas impede o login no sistema devido à verificação de role
      const userRef = doc(db, 'artifacts', appId, 'users', userId);
      await deleteDoc(userRef);
  },

  // CRUD Genérico
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

// --- SERVIÇOS AUXILIARES ---
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

// FILTRO DE PERÍODO (NOVO)
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

// TELA DE LOGIN BLOQUEADA
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

// GERENCIAMENTO DE USUÁRIOS (NOVA TELA COMPLETA)
const UsersScreen = ({ user, myRole, showToast }) => {
    const [users, setUsers] = useState([]);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPass, setNewUserPass] = useState('');
    
    const loadUsers = async () => {
        const list = await dbService.getAllUsers();
        setUsers(list);
    };
    useEffect(() => { loadUsers(); }, []);

    const handleCreateUser = async () => {
        // TRUQUE: Criar usuário sem deslogar é complexo no Firebase Client SDK.
        // Solução: Usamos uma segunda instância do App só para criar o user.
        if (myRole !== 'admin') return;
        try {
            const secondaryApp = initializeApp(firebaseConfig, "Secondary");
            const secondaryAuth = getAuth(secondaryApp);
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail, newUserPass);
            
            // Criar o registro no Firestore principal
            await setDoc(doc(db, 'artifacts', appId, 'users', userCredential.user.uid), {
                email: newUserEmail, role: 'viewer', createdAt: new Date().toISOString()
            });
            
            await signOut(secondaryAuth); // Desliga a instância secundária
            showToast("Usuário criado com sucesso!", 'success');
            setNewUserEmail(''); setNewUserPass('');
            loadUsers();
        } catch (e) {
            showToast("Erro ao criar: " + e.message, 'error');
        }
    };

    const handleChangeRole = async (uid, role) => {
        await dbService.updateUserRole(uid, role);
        loadUsers();
        showToast("Permissão alterada.", 'success');
    };

    const handleDelete = async (uid) => {
        if (!confirm("Remover acesso deste usuário?")) return;
        await dbService.deleteUserAccess(uid);
        loadUsers();
        showToast("Acesso revogado.", 'success');
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 dark:text-white">Gestão de Acessos</h2>
            
            {/* Criar Novo */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm mb-8 border dark:border-slate-700">
                <h3 className="font-bold mb-4 flex items-center gap-2 dark:text-white"><PlusCircle size={20}/> Cadastrar Novo Usuário</h3>
                <div className="flex gap-4 items-end">
                    <div className="flex-1"><label className="text-xs font-bold text-slate-500">Email</label><input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={newUserEmail} onChange={e=>setNewUserEmail(e.target.value)}/></div>
                    <div className="flex-1"><label className="text-xs font-bold text-slate-500">Senha Provisória</label><input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={newUserPass} onChange={e=>setNewUserPass(e.target.value)}/></div>
                    <button onClick={handleCreateUser} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold hover:bg-emerald-700">Criar</button>
                </div>
            </div>

            {/* Lista */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border dark:border-slate-700">
                <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase text-xs"><tr><th className="p-4">Email</th><th className="p-4">Permissão</th><th className="p-4">Ações</th></tr></thead>
                    <tbody className="divide-y dark:divide-slate-700">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="p-4 dark:text-white">{u.email}</td>
                                <td className="p-4">
                                    <select value={u.role} onChange={(e)=>handleChangeRole(u.id, e.target.value)} disabled={u.role === 'admin' && u.email === user.email} className="border rounded p-1 text-sm dark:bg-slate-900 dark:text-white">
                                        <option value="viewer">Visualizador</option>
                                        <option value="editor">Editor</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                </td>
                                <td className="p-4">
                                    {u.email !== user.email && <button onClick={()=>handleDelete(u.id)} className="text-rose-500 hover:text-rose-700"><Trash2 size={18}/></button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// DRE AUTOMÁTICA (COM MAPA DO PDF)
const DREComponent = ({ transactions }) => {
    const dreData = useMemo(() => {
        const rows = JSON.parse(JSON.stringify(DRE_BLUEPRINT));
        const accMap = {};

        // 1. Soma transações por código base (01, 03.01, etc)
        transactions.forEach(t => {
            if (!t.accountPlan) return;
            // Encontra qual conta do DRE corresponde ao prefixo da transação
            const match = rows.find(r => t.accountPlan.startsWith(r.code) && !r.formula);
            if (match) {
                const val = t.type === 'revenue' ? t.value : -t.value; // Receita +, Despesa -
                accMap[match.code] = (accMap[match.code] || 0) + val;
            }
        });

        // 2. Atribui valores aos rows e calcula pais
        rows.forEach(row => {
            if (accMap[row.code]) row.value = accMap[row.code];
        });

        // 3. Recalcula Pais (Bottom-Up simples não funciona bem aqui, melhor somar filhos)
        // Fazemos 2 passadas para garantir níveis
        for(let i=0; i<2; i++) {
            rows.forEach(row => {
                if (row.parent) {
                    const parent = rows.find(r => r.code === row.parent);
                    if (parent) parent.value = (parent.value || 0) + (row.value || 0);
                }
            });
        }

        // 4. Calcula Fórmulas
        rows.forEach(row => {
            if (row.formula) {
                // Ex: "01 - 02"
                const parts = row.formula.split(' ');
                let total = 0;
                let op = '+';
                parts.forEach(part => {
                    if (part === '+' || part === '-') { op = part; return; }
                    const refRow = rows.find(r => r.code === part || r.code === part.replace('LUCRO_BRUTO', 'LUCRO_BRUTO')); // Busca por codigo
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

// COMPONENTES COMUNS (KPI, ETC)
const KpiCard = ({ title, value, icon: Icon, color }) => {
    const colors = { emerald: 'text-emerald-600 bg-emerald-50', rose: 'text-rose-600 bg-rose-50', indigo: 'text-indigo-600 bg-indigo-50' };
    return (<div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border dark:border-slate-700 shadow-sm"><div className="flex justify-between"><div><p className="text-xs font-bold text-slate-500 uppercase mb-2">{title}</p><h3 className="text-2xl font-bold dark:text-white">{value}</h3></div><div className={`p-3 rounded-xl ${colors[color]}`}><Icon size={24}/></div></div></div>);
};

const ManualEntryModal = ({ onClose, segments, onSave, user, initialData, showToast }) => {
    const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], type: 'expense', description: '', value: '', segment: '', accountPlan: '' });
    
    useEffect(() => { 
        if (initialData) setForm({ ...initialData, date: initialData.date });
    }, [initialData]);

    const handleSubmit = async () => {
        const val = parseFloat(form.value);
        if (!form.description || isNaN(val) || !form.segment || !form.accountPlan) return showToast("Preencha tudo, inclusive a conta.", 'error');
        
        const tx = { ...form, value: val, costCenter: 'GERAL', source: 'manual', createdAt: new Date().toISOString() };
        
        try {
            if(initialData?.id) await dbService.update(user, 'transactions', initialData.id, tx);
            else await dbService.add(user, 'transactions', tx);
            showToast("Salvo!", 'success'); onSave(); onClose();
        } catch(e) { showToast("Erro ao salvar.", 'error'); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 dark:border-slate-700 border">
                <h3 className="text-lg font-bold mb-4 dark:text-white">{initialData ? 'Editar' : 'Novo'} Lançamento</h3>
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <button onClick={()=>setForm({...form, type:'revenue'})} className={`flex-1 py-2 rounded font-bold ${form.type==='revenue'?'bg-emerald-100 text-emerald-700':'bg-slate-100'}`}>Receita</button>
                        <button onClick={()=>setForm({...form, type:'expense'})} className={`flex-1 py-2 rounded font-bold ${form.type==='expense'?'bg-rose-100 text-rose-700':'bg-slate-100'}`}>Despesa</button>
                    </div>
                    <input type="date" className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={form.date} onChange={e=>setForm({...form, date: e.target.value})} />
                    <input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" placeholder="Descrição" value={form.description} onChange={e=>setForm({...form, description: e.target.value})} />
                    <input type="number" className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" placeholder="Valor" value={form.value} onChange={e=>setForm({...form, value: e.target.value})} />
                    <select className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={form.segment} onChange={e=>setForm({...form, segment: e.target.value})}>
                        <option value="">Selecione a Unidade...</option>
                        {segments.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                    <select className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={form.accountPlan} onChange={e=>setForm({...form, accountPlan: e.target.value})}>
                        <option value="">Selecione a Conta (Plano)...</option>
                        {DRE_BLUEPRINT.filter(r => r.level === 2).map(r => <option key={r.code} value={r.code}>{r.code} - {r.name}</option>)}
                    </select>
                    <button onClick={handleSubmit} className="w-full bg-indigo-600 text-white py-3 rounded font-bold hover:bg-indigo-700">Salvar</button>
                    <button onClick={onClose} className="w-full text-slate-500 mt-2">Cancelar</button>
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
  const [toast, showToast] = useToast();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [segments, setSegments] = useState([]);
  
  // Filtros
  const [filter, setFilter] = useState({ type: 'month', month: new Date().getMonth(), year: new Date().getFullYear(), quarter: 1, semester: 1 });
  const [globalUnitFilter, setGlobalUnitFilter] = useState('ALL');

  // UI
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [showAIModal, setShowAIModal] = useState(false); // Para o botão de IA

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
        const segs = await dbService.getAll(user, 'segments');
        setTransactions(txs);
        setSegments(segs);
    } catch (e) { showToast("Erro ao carregar dados.", 'error'); }
  };
  useEffect(() => { if (user) loadData(); }, [user]);

  const handleLogout = async () => await signOut(auth);

  // --- FILTRAGEM CENTRALIZADA ---
  const filteredData = useMemo(() => {
      return transactions.filter(t => {
          const d = new Date(t.date);
          const y = d.getFullYear();
          const m = d.getMonth();
          
          // 1. Filtro de Data
          if (y !== filter.year) return false;
          if (filter.type === 'month' && m !== filter.month) return false;
          if (filter.type === 'quarter') {
              const q = Math.floor(m / 3) + 1;
              if (q !== filter.quarter) return false;
          }
          if (filter.type === 'semester') {
              const s = m < 6 ? 1 : 2;
              if (s !== filter.semester) return false;
          }

          // 2. Filtro de Unidade
          if (globalUnitFilter !== 'ALL' && t.segment !== globalUnitFilter) return false;

          return true;
      });
  }, [transactions, filter, globalUnitFilter]);

  const kpis = useMemo(() => {
      const rev = filteredData.filter(t => t.type === 'revenue').reduce((acc, t) => acc + t.value, 0);
      const exp = filteredData.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.value, 0);
      return { revenue: rev, expense: exp, balance: rev - exp };
  }, [filteredData]);

  if (loadingAuth) return <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex justify-center items-center"><Loader2 className="animate-spin text-indigo-600" size={48}/></div>;
  if (!user) return <LoginScreen showToast={showToast} />;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex font-sans text-slate-900 dark:text-slate-100 transition-colors">
      {toast && <div className={`fixed top-4 right-4 z-50 p-4 rounded shadow-xl flex gap-2 ${toast.type==='success'?'bg-emerald-500 text-white':'bg-rose-500 text-white'}`}>{toast.type==='success'?<CheckCircle/>:<AlertTriangle/>}{toast.message}</div>}
      
      <aside className="w-20 lg:w-64 bg-slate-900 dark:bg-slate-950 text-white flex-col sticky top-0 h-screen hidden md:flex border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3"><div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center"><Building2 size={18} /></div><span className="text-xl font-bold hidden lg:block">FinSaaS</span></div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><LayoutDashboard size={20} /><span className="hidden lg:block">Visão Geral</span></button>
          <button onClick={() => setActiveTab('lancamentos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'lancamentos' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><List size={20} /><span className="hidden lg:block">Lançamentos</span></button>
          <button onClick={() => setActiveTab('dre')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dre' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><FileText size={20} /><span className="hidden lg:block">DRE</span></button>
          <button onClick={() => setActiveTab('custos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'custos' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><DollarSign size={20} /><span className="hidden lg:block">Custos</span></button>
          <button onClick={() => setActiveTab('estoque')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'estoque' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Zap size={20} /><span className="hidden lg:block">Estoque</span></button>
          <button onClick={() => setActiveTab('producao')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'producao' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><BarChartIcon size={20} /><span className="hidden lg:block">Produção</span></button>
          {userRole === 'admin' && <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-400 hover:bg-slate-800`}><Users size={20} /><span className="hidden lg:block">Usuários</span></button>}
        </nav>
        <div className="p-4 border-t border-slate-800"><div className="flex items-center gap-2 text-sm text-slate-400"><div className="p-1 bg-slate-800 rounded"><UserCircle size={16} /></div><div className="flex-1 min-w-0"><p className="truncate font-bold text-white">{user.email}</p><p className="text-xs uppercase tracking-wider text-indigo-400">{userRole}</p></div></div></div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex gap-2 w-full md:w-auto items-center">
             <PeriodSelector filter={filter} setFilter={setFilter} years={[2024, 2025]} />
             <select className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-white text-sm rounded-lg p-2" value={globalUnitFilter} onChange={(e) => setGlobalUnitFilter(e.target.value)}>
                <option value="ALL">Todas Unidades</option>
                {segments.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
             </select>
          </div>
          <div className="flex gap-2">
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
             <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400"><tr><th className="p-4">Data</th><th className="p-4">Descrição</th><th className="p-4">Unidade</th><th className="p-4">Conta</th><th className="p-4 text-right">Valor</th><th className="p-4">Ações</th></tr></thead><tbody className="divide-y dark:divide-slate-700">{filteredData.map(t => (<tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50"><td className="p-4 dark:text-white">{new Date(t.date).toLocaleDateString()}</td><td className="p-4 dark:text-white">{t.description}</td><td className="p-4 text-xs dark:text-slate-300">{t.segment}</td><td className="p-4 text-xs dark:text-slate-300">{t.accountPlan}</td><td className={`p-4 text-right font-bold ${t.type==='revenue'?'text-emerald-500':'text-rose-500'}`}>{t.value.toFixed(2)}</td><td className="p-4 flex gap-2">{['admin', 'editor'].includes(userRole) && <><button onClick={()=>{setEditingTx(t); setShowEntryModal(true);}} className="text-blue-500"><Edit2 size={16}/></button>{userRole==='admin'&&<button onClick={()=>dbService.del(user, 'transactions', t.id).then(loadData)} className="text-rose-500"><Trash2 size={16}/></button>}</>}</td></tr>))}</tbody></table></div>
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
                            {/* Simples agrupamento por conta para demo */}
                            {Object.entries(filteredData.filter(t=>t.type==='expense').reduce((acc, t) => {acc[t.accountPlan] = (acc[t.accountPlan]||0)+t.value; return acc}, {})).map(([k,v]) => (
                                <tr key={k} className="border-b dark:border-slate-700"><td className="p-2 dark:text-white">{k}</td><td className="p-2 text-right dark:text-white">{v.toFixed(2)}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'estoque' && <div className="p-8 text-center dark:text-white bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700"><h3>Módulo de Estoque</h3><p className="text-sm text-slate-500">Implementação de kardex e custo médio em breve.</p></div>}
        
        {activeTab === 'producao' && <div className="p-8 text-center dark:text-white bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700"><h3>Produção vs Vendas</h3><p className="text-sm text-slate-500">Gráficos comparativos de m³ produzido vs vendido.</p></div>}

        {activeTab === 'users' && <UsersScreen user={user} myRole={userRole} showToast={showToast} />}

      </main>

      {showEntryModal && user && <ManualEntryModal onClose={() => setShowEntryModal(false)} segments={segments} onSave={loadData} user={user} initialData={editingTx} showToast={showToast} />}
    </div>
  );
}
