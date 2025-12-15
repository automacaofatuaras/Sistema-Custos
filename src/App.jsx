import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  LayoutDashboard, UploadCloud, TrendingUp, TrendingDown, 
  DollarSign, Trash2, Building2, PlusCircle, Settings, Edit2, 
  Save, X, Calendar, Loader2, List, FileUp, LogOut, UserCircle, 
  Users, Sun, Moon, Lock, Sparkles, FileText, Download, Globe, 
  AlertTriangle, CheckCircle, Zap, Calculator, Percent, Share2, ChevronRight, ChevronDown, ChevronLeft, Printer,
  BarChart3 as BarChartIcon, Folder, FolderOpen, Package, Factory, ShoppingCart, Search,Database,
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { initializeApp, getApp, getApps } from 'firebase/app';
import { PLANO_CONTAS } from './planoContas';
// Imports de Auth removidos pois não serão usados para login real nesta versão
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
const GEMINI_API_KEY = "AIzaSyA6feDMeD7YNNQf40q2ALOvwPnfCDa7Pw4"; 

// Inicialização do Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const appId = 'financial-saas-production';

// --- DADOS DE INICIALIZAÇÃO FIXOS ---
const BUSINESS_HIERARCHY = {
    "Portos de Areia": ["Porto de Areia Saara - Mira Estrela", "Porto Agua Amarela - Riolândia"],
    "Noromix Concreteiras": ["Noromix Concreto S/A - Fernandópolis", "Noromix Concreto S/A - Ilha Solteira", "Noromix Concreto S/A - Jales", "Noromix Concreto S/A - Ouroeste", "Noromix Concreto S/A - Paranaíba", "Noromix Concreto S/A - Monções", "Noromix Concreto S/A - Pereira Barreto", "Noromix Concreto S/A - Três Fronteiras", "Noromix Concreto S/A - Votuporanga"],
    "Fábrica de Tubos": ["Noromix Concreto S/A - Votuporanga (Fábrica)"],
    "Pedreiras": ["Mineração Grandes Lagos - Icém", "Mineração Grandes Lagos - Itapura", "Mineração Grandes Lagos - Riolândia", "Mineração Grandes Lagos - Três Fronteiras", "Noromix Concreto S/A - Rinópolis", "Mineração Noroeste Paulista - Monções"],
    "Usinas de Asfalto": ["Noromix Concreto S/A - Assis", "Noromix Concreto S/A - Monções (Usina)", "Noromix Concreto S/A - Itapura (Usina)", "Noromix Concreto S/A - Rinópolis (Usina)", "Demop Participações LTDA - Três Fronteiras", "Mineração Grandes Lagos - Icém (Usina)"],
    "Construtora": ["Noromix Construtora"]
};

// Cria a lista plana de unidades automaticamente
const SEED_UNITS = Object.values(BUSINESS_HIERARCHY).flat();

const SEGMENT_CONFIG = {
    "Construtora": "ton", "Fábrica de Tubos": "m³", "Noromix Concreteiras": "m³", "Pedreiras": "ton", "Portos de Areia": "ton", "Usinas de Asfalto": "ton"
};

// LISTA DE CENTROS DE CUSTO ADMINISTRATIVOS (CÓDIGOS BASE)
const ADMIN_CC_CODES = [
    13000, 14000, // Portos
    27000, 22000, 25000, 33000, 38000, 34000, 29000, 9000, 8000, // Concreteiras
    10000, // Fabrica
    20000, 5000, 4000, 3000, 26000, 2000, // Pedreiras
    32000, 6000, 17000, 31000, 7000, 21000, // Usinas
    40000 // Construtora
];

const getMeasureUnit = (unitOrSegment) => {
    if (SEGMENT_CONFIG[unitOrSegment]) return SEGMENT_CONFIG[unitOrSegment];
    for (const [segment, units] of Object.entries(BUSINESS_HIERARCHY)) {
        if (units.includes(unitOrSegment)) return SEGMENT_CONFIG[segment];
    }
    return "un"; 
};

// Helper para descobrir o Segmento Pai de uma Unidade
const getParentSegment = (unitName) => {
    for (const [segment, units] of Object.entries(BUSINESS_HIERARCHY)) {
        if (units.includes(unitName) || unitName.includes(segment)) return segment;
    }
    return "Geral";
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    // Pega apenas os primeiros 10 caracteres (YYYY-MM-DD) para ignorar tempo/fuso visualmente
    const cleanDate = dateString.substring(0, 10);
    const parts = cleanDate.split('-'); 
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateString;
};

// --- MAPEAMENTO AUTOMÁTICO DE UNIDADES POR CENTRO DE CUSTO ---
const getUnitByCostCenter = (ccCode) => {
    const cc = parseInt(ccCode, 10);
    if (isNaN(cc)) return null;
    
    if (cc === 1087 || cc === 1089 || cc === 1042) return "Porto de Areia Saara - Mira Estrela"; // Rateio cai aqui para split

    if (cc >= 13000 && cc <= 13999) return "Porto de Areia Saara - Mira Estrela";
    if (cc >= 14000 && cc <= 14999) return "Porto Agua Amarela - Riolândia";
    if (cc >= 27000 && cc <= 27999) return "Noromix Concreto S/A - Fernandópolis";
    if (cc >= 22000 && cc <= 22999) return "Noromix Concreto S/A - Ilha Solteira";
    if (cc >= 25000 && cc <= 25999) return "Noromix Concreto S/A - Jales";
    if (cc >= 33000 && cc <= 33999) return "Noromix Concreto S/A - Ouroeste";
    if (cc >= 38000 && cc <= 38999) return "Noromix Concreto S/A - Paranaíba";
    if (cc >= 34000 && cc <= 34999) return "Noromix Concreto S/A - Monções";
    if (cc >= 29000 && cc <= 29999) return "Noromix Concreto S/A - Pereira Barreto";
    if (cc >= 9000 && cc <= 9999) return "Noromix Concreto S/A - Três Fronteiras";
    if (cc >= 8000 && cc <= 8999) return "Noromix Concreto S/A - Votuporanga";
    if (cc >= 10000 && cc <= 10999) return "Fábrica de Tubos: Noromix Concreto S/A - Votuporanga (Fábrica)";
    if (cc >= 20000 && cc <= 20999) return "Mineração Grandes Lagos - Icém";
    if (cc >= 5000 && cc <= 5999) return "Mineração Grandes Lagos - Itapura";
    if (cc >= 4000 && cc <= 4999) return "Mineração Grandes Lagos - Riolândia";
    if (cc >= 3000 && cc <= 3999) return "Mineração Grandes Lagos - Três Fronteiras";
    if (cc >= 26000 && cc <= 26999) return "Noromix Concreto S/A - Rinópolis";
    if (cc >= 2000 && cc <= 2999) return "Mineração Noroeste Paulista - Monções";
    if (cc >= 32000 && cc <= 32999) return "Noromix Concreto S/A - Assis";
    if (cc >= 6000 && cc <= 6999) return "Noromix Concreto S/A - Monções (Usina)";
    if (cc >= 17000 && cc <= 17999) return "Noromix Concreto S/A - Itapura (Usina)";
    if (cc >= 31000 && cc <= 31999) return "Noromix Concreto S/A - Rinópolis (Usina)";
    if (cc >= 7000 && cc <= 7999) return "Demop Participações LTDA - Três Fronteiras";
    if (cc >= 21000 && cc <= 21999) return "Mineração Grandes Lagos - Icém (Usina)";
    if (cc >= 40000 && cc <= 94999 && cc !== 94901) return "Noromix Construtora";
    return null;
};
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

// --- REGRAS DE CUSTOS POR SEGMENTO ---
// --- REGRAS DE CUSTOS POR SEGMENTO ---
const COST_CENTER_RULES = {
    "Portos de Areia": {
        "DESPESAS DA UNIDADE": {
            "CUSTO OPERACIONAL ADMINISTRATIVO": [13000, 14000, 14103],
            "CUSTO OPERACIONAL INDÚSTRIA": [13100, 13002, 14003, 14101, 1042],
            "CUSTO COMERCIAL VENDEDORES": [13103, 14113],
            "CUSTO COMERCIAL GERÊNCIA": [13123, 14123]
        },
        "TRANSPORTE": {
            "CUSTO TRANSPORTE": [13101, 14102]
        },
        "ADMINISTRATIVO": {
            "CUSTO RATEIO DESPESAS ADMINISTRATIVAS": [1087, 1089]
        }
    },
    "Pedreiras": {
        "DESPESAS DA UNIDADE": {
            "CUSTO OPERACIONAL ADMINISTRAÇÃO": [2000, 3000, 4000, 5000, 20000, 26000],
            "CUSTO OPERACIONAL BRITAGEM": [
                2001, 2007, 2011, 2012, 2013, 2015, 2019, 2021, 2024, 2027, 2048, 2093, 2094, 2100, 2103, 2104, 2124, 2128, 2129, 2172, 2188, 2204, 2234, 2237, 2238, 2262, 2277, 2276, 
                3007, 3008, 3009, 3010, 3014, 3018, 3022, 3023, 3024, 3026, 3028, 3073, 3079, 3100, 3103, 3104, 3108, 3117, 3120, 3200, 3201, 3222, 3223, 3245, 3261, 3275, 3282, 
                4001, 4002, 4005, 4007, 4008, 4010, 4011, 4012, 4014, 4017, 4018, 4019, 4020, 4021, 4043, 4051, 4059, 4071, 4100, 4102, 4103, 4104, 4114, 4118, 4119, 
                5003, 5004, 5005, 5006, 5007, 5008, 5011, 5012, 5013, 5019, 5020, 5027, 5053, 5061, 5078, 5100, 5102, 5103, 5104, 5112, 5117, 5131, 5152, 5156, 5172, 5176, 5195, 5206, 5998, 
                20007, 20008, 20013, 20021, 20029, 20050, 20057, 20062, 20063, 20100, 20103, 20104, 20119, 20137, 20138, 20159, 20195, 20196, 20198, 20204, 
                26016, 26018, 26019, 26020, 26024, 26026, 20627, 26028, 26031, 26032, 26034, 26036, 26037, 26054, 26059, 26079, 26100, 26103, 26104, 26113, 26114, 26127, 26128, 26129, 26133, 26156, 26183, 26184, 26197, 26201, 26208, 26224, 26231, 26235, 26239, 26247
            ],
            "CUSTO OPERACIONAL EXTRAÇÃO": [2102, 3102, 4102, 5102, 20102, 26102],
            "CUSTO OPERACIONAL PERFURAÇÃO": [1039],
            "CUSTO OPERACIONAL LIMPEZA ROCHA": [1121],
            "CUSTO COMERCIAL VENDEDORES": [2105, 3105, 5105, 20105],
            "CUSTO COMERCIAL GERÊNCIA": [1104]
        },
        "TRANSPORTE": {
            "CUSTO TRANSPORTE": [2101, 2106, 3101, 3106, 4101, 4106, 5101, 5106, 20101, 26101, 26106]
        },
        "ADMINISTRATIVO": {
            "CUSTO RATEIO DESPESAS ADMINISTRATIVAS": [1087, 1089, 99911]
        }
    }
};

// --- SERVIÇOS (SEM AUTH) ---
const dbService = {
  getCollRef: (user, colName) => {
    // Ignora validação de usuário, usa pasta pública da empresa
    return collection(db, 'artifacts', appId, 'shared_container', 'DADOS_EMPRESA', colName);
  },
  syncSystem: async (user) => {
      return 'admin'; // Sempre admin
  },
  getAllUsers: async () => { 
      // Retorna lista vazia ou mockada, já que login foi removido
      return []; 
  },
  updateUserRole: async () => {}, 
  deleteUserAccess: async () => {}, 
  add: async (user, col, item) => addDoc(dbService.getCollRef(user, col), item),
  update: async (user, col, id, data) => updateDoc(doc(dbService.getCollRef(user, col), id), data),
  del: async (user, col, id) => deleteDoc(doc(dbService.getCollRef(user, col), id)),
  deleteBulk: async (user, col, ids) => { const batch = writeBatch(db); ids.forEach(id => { const docRef = doc(dbService.getCollRef(user, col), id); batch.delete(docRef); }); await batch.commit(); },
  getAll: async (user, col) => { 
      const snapshot = await getDocs(dbService.getCollRef(user, col)); 
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })); 
  },
  addBulk: async (user, col, items) => { const chunkSize = 400; for (let i = 0; i < items.length; i += chunkSize) { const chunk = items.slice(i, i + chunkSize); const batch = writeBatch(db); const colRef = dbService.getCollRef(user, col); chunk.forEach(item => { const docRef = doc(colRef); batch.set(docRef, item); }); await batch.commit(); } }
};

const aiService = { analyze: async () => "IA Placeholder" };

/**
 * ------------------------------------------------------------------
 * 2. COMPONENTES UI
 * ------------------------------------------------------------------
 */

const KpiCard = ({ title, value, icon: Icon, color, trend, reverseColor = false }) => {
    const colors = { emerald: 'text-emerald-600 bg-emerald-50', rose: 'text-rose-600 bg-rose-50', indigo: 'text-indigo-600 bg-indigo-50' };
    
    // Lógica de cor da variação: 
    // Se reverseColor for true (Despesas/Custos): Positivo é Ruim (Vermelho), Negativo é Bom (Verde)
    // Se reverseColor for false (Receita): Positivo é Bom (Verde), Negativo é Ruim (Vermelho)
    let trendColor = 'text-slate-400';
    if (trend !== undefined && trend !== 0) {
        if (reverseColor) {
            trendColor = trend > 0 ? 'text-rose-500' : 'text-emerald-500';
        } else {
            trendColor = trend > 0 ? 'text-emerald-500' : 'text-rose-500';
        }
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border dark:border-slate-700 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">{title}</p>
                    <h3 className="text-2xl font-bold dark:text-white">{value}</h3>
                    {trend !== undefined && !isNaN(trend) && (
                        <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${trendColor}`}>
                            <span>{trend > 0 ? '▲' : (trend < 0 ? '▼' : '-')} {Math.abs(trend).toFixed(1)}%</span>
                            <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">vs mês ant.</span>
                        </div>
                    )}
                </div>
                <div className={`p-3 rounded-xl ${colors[color]}`}>
                    <Icon size={24}/>
                </div>
            </div>
        </div>
    );
};

const AutomaticImportComponent = ({ onImport, isProcessing }) => {
    const [fileText, setFileText] = useState('');
    const [previewData, setPreviewData] = useState([]);
    const fileRef = useRef(null);

    // --- REGRAS DE INCONSISTÊNCIA ---
    const analyzeConsistency = (row) => {
        const issues = [];
        const desc = (row.description || "") + " " + (row.materialDescription || "");
        const descLower = desc.toLowerCase();
        const plan = (row.planDescription || "").toLowerCase();
        const code = row.accountPlan || "";
        
        // Regra 1: Palavras-chave vs Classe
        if (descLower.includes('diesel') || descLower.includes('combustivel')) {
            if (!plan.includes('combustível') && !plan.includes('veículos') && !code.includes('03.07')) issues.push("Item parece Combustível, mas classe difere.");
        }
        if (descLower.includes('pneu') || descLower.includes('manuten') || descLower.includes('peça')) {
            if (!plan.includes('manutenção') && !code.includes('03.05')) issues.push("Item parece Manutenção, mas classe difere.");
        }
        if (descLower.includes('energia') || descLower.includes('eletrica')) {
            if (!plan.includes('energia') && !plan.includes('administrativa')) issues.push("Item parece Energia, verifique a classe.");
        }

        // Regra 2: Coerência CC (Local) vs Classe (Tipo)
        const ccCode = parseInt(row.costCenter.split(' ')[0]);
        // Garante que ADMIN_CC_CODES esteja disponível no escopo
        const isAdminCC = typeof ADMIN_CC_CODES !== 'undefined' ? ADMIN_CC_CODES.includes(ccCode) : false;
        const isCostClass = code.startsWith('03'); // Custos Operacionais
        const isExpClass = code.startsWith('04');  // Despesas Adm

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
        
        for(let i=0; i < lines.length; i++) {
            if (lines[i].includes('PRGER-CCUS')) {
                headerIndex = i;
                const cols = lines[i].replace(/"/g, '').split(';');
                cols.forEach((col, idx) => { colMap[col.trim()] = idx; });
                break;
            }
        }

        if (headerIndex === -1) return alert("ERRO: Cabeçalho 'PRGER-CCUS' não encontrado.");

        const parsed = [];
        for(let i = headerIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cleanLine = line.replace(/"/g, ''); 
            const cols = cleanLine.split(';');
            
            const ccCode = cols[colMap['PRGER-CCUS']]?.trim();
            const dateStr = cols[colMap['PRGER-LCTO']]?.trim() || cols[colMap['PRGER-EMIS']]?.trim();
            const planCode = cols[colMap['PRGER-PLAN']]?.trim();
            const planDesc = cols[colMap['PRGER-NPLC']]?.trim();
            const supplier = cols[colMap['PRGER-NFOR']]?.trim() || 'Diversos';
            let rawValue = cols[colMap['PRGER-TOTA']]?.trim();
            const ccDesc = cols[colMap['PRGER-NCCU']]?.trim() || '';
            let sortDesc = cols[colMap['PR-SORT']]?.trim();

            if (!ccCode || !rawValue) continue;
            
            rawValue = rawValue.replace(/\./g, '').replace(',', '.');
            let value = parseFloat(rawValue) / 100;

            if (isNaN(value) || value === 0) continue;

            let isoDate = new Date().toISOString().split('T')[0];
            if (dateStr && dateStr.length === 10) {
                const parts = dateStr.split('/');
                if(parts.length === 3) isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            const safeDateWithTime = `${isoDate}T12:00:00`;

            if (!sortDesc || /^0+$/.test(sortDesc)) { sortDesc = "Lançamento SAF"; }

            // ------------------------------------------------------------------
            // NOVA LÓGICA DE RATEIO (PORTOS E PEDREIRAS)
            // ------------------------------------------------------------------
            if (['01087', '1087', '01089', '1089', '99911'].includes(ccCode)) {
                
                const currentType = (planCode?.startsWith('1.') || planCode?.startsWith('01.') || planDesc?.toUpperCase().includes('RECEITA')) ? 'revenue' : 'expense';

                // O valor total é dividido em 8 cotas "virtuais"
                const shareValue = value / 8;

                const baseObj = {
                    date: safeDateWithTime, costCenter: `${ccCode} - ${ccDesc}`, accountPlan: planCode || '00.00',
                    planDescription: planDesc || 'Indefinido', description: supplier, materialDescription: sortDesc,
                    type: currentType, source: 'automatic_import', createdAt: new Date().toISOString()
                };

                // 1. REGRAS DOS PORTOS (Cota dividida por 2 entre as duas unidades)
                const portoSplit = shareValue / 2;
                parsed.push({ ...baseObj, id: `${i}_porto1`, value: portoSplit, segment: "Porto de Areia Saara - Mira Estrela" });
                parsed.push({ ...baseObj, id: `${i}_porto2`, value: portoSplit, segment: "Porto Agua Amarela - Riolândia" });

                // 2. REGRA DAS PEDREIRAS (1 Cota cheia para cada uma das 6 unidades)
                const pedreiraUnits = BUSINESS_HIERARCHY["Pedreiras"];
                if (pedreiraUnits) {
                    pedreiraUnits.forEach((unit, idx) => {
                        parsed.push({ 
                            ...baseObj, 
                            id: `${i}_ped_${idx}`, // ID único para evitar erros de key
                            value: shareValue, // Recebe a cota inteira (divisão por 8)
                            segment: unit 
                        });
                    });
                }
                
                continue; // Pula o fluxo normal abaixo
            }
            // ------------------------------------------------------------------

            const type = (planCode?.startsWith('1.') || planCode?.startsWith('01.') || planDesc?.toUpperCase().includes('RECEITA')) ? 'revenue' : 'expense';
            
            const detectedUnit = getUnitByCostCenter(ccCode);
            const finalSegment = detectedUnit || `DESCONHECIDO (CC: ${ccCode})`;

            parsed.push({
                id: i, // ID temporário para controle
                date: safeDateWithTime,
                segment: finalSegment,
                costCenter: `${ccCode} - ${ccDesc}`,
                accountPlan: planCode || '00.00',
                planDescription: planDesc || 'Indefinido',
                description: supplier, 
                materialDescription: sortDesc, 
                value: value,
                type: type,
                source: 'automatic_import',
                createdAt: new Date().toISOString()
            });
        }
        setPreviewData(parsed);
    };

    // Função para alterar dados na tabela
    const handleEditRow = (id, field, value) => {
        setPreviewData(prev => prev.map(row => {
            if (row.id !== id) return row;
            
            const updatedRow = { ...row, [field]: value };

            // Se alterou o código da conta, atualiza descrição
            if (field === 'accountPlan') {
                const found = PLANO_CONTAS.find(p => p.code === value);
                if (found) updatedRow.planDescription = found.name;
            }

            // Se alterou o Centro de Custo, tenta atualizar a Unidade automaticamente
            if (field === 'costCenter') {
                // Tenta extrair apenas o número caso o usuário digite texto junto
                const cleanCode = value.split(' ')[0];
                const newUnit = getUnitByCostCenter(cleanCode);
                if (newUnit) updatedRow.segment = newUnit;
            }

            return updatedRow;
        }));
    };

    const handleConfirmImport = () => {
        if (previewData.length === 0) return alert("Nenhum dado válido.");
        
        // --- CORREÇÃO: Remove o 'id' temporário (usado só na tabela) antes de salvar ---
        const dataToImport = previewData.map(({ id, ...rest }) => rest);
        
        onImport(dataToImport);
        setFileText(''); setPreviewData([]);
    };

    // SEPARAÇÃO DOS DADOS
    const problematicRows = previewData.filter(row => analyzeConsistency(row).length > 0);
    const cleanRows = previewData.filter(row => analyzeConsistency(row).length === 0);

    const TableBlock = ({ title, rows, isProblematic }) => {
        if (rows.length === 0) return null;
        return (
            <div className={`mb-8 rounded-xl border overflow-hidden ${isProblematic ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/10' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>
                <div className={`p-4 font-bold flex items-center justify-between ${isProblematic ? 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-500' : 'text-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-slate-300'}`}>
                    <div className="flex items-center gap-2">
                        {isProblematic ? <AlertTriangle size={20}/> : <CheckCircle size={20}/>}
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
                                                    <AlertTriangle size={10}/> {issue}
                                                </div>
                                            ))}
                                        </td>

                                        <td className="p-2">
                                            {/* EDIÇÃO DO CENTRO DE CUSTO */}
                                            <input 
                                                className={`w-full bg-transparent border-b border-dashed outline-none text-xs py-1 ${isProblematic ? 'border-amber-400 focus:border-amber-600' : 'border-slate-300 focus:border-indigo-500'} dark:text-slate-300`}
                                                value={row.costCenter}
                                                onChange={(e) => handleEditRow(row.id, 'costCenter', e.target.value)}
                                            />
                                        </td>

                                        <td className="p-2">
                                            {/* UNIDADE AGORA É APENAS LEITURA (AUTOMÁTICA) */}
                                            <div className="text-slate-600 dark:text-slate-400 italic">
                                                {row.segment.includes(':') ? row.segment.split(':')[1] : row.segment}
                                            </div>
                                        </td>

                                        <td className="p-2">
                                            <select 
                                                className={`w-full bg-transparent border rounded px-1 py-1 text-xs outline-none cursor-pointer ${issues.length > 0 ? 'border-amber-400 text-amber-700 font-bold' : 'border-slate-200 text-slate-600 dark:text-slate-300 dark:border-slate-600'}`}
                                                value={row.accountPlan}
                                                onChange={(e) => handleEditRow(row.id, 'accountPlan', e.target.value)}
                                            >
                                                <option value={row.accountPlan}>{row.accountPlan} - {row.planDescription} (Original)</option>
                                                {typeof PLANO_CONTAS !== 'undefined' && PLANO_CONTAS.map(p => (
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
            
            {/* --- 1. CABEÇALHO (Título + Botões) --- */}
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg dark:text-white">Auditoria e Importação</h3>
                
                {previewData.length > 0 && (
                    <div className="flex gap-3">
                        <button 
                            onClick={() => { setPreviewData([]); setFileText(''); }}
                            className="px-4 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100 border border-slate-200 transition-colors"
                        >
                            Cancelar
                        </button>

                        <button 
                            onClick={handleConfirmImport} 
                            disabled={isProcessing} 
                            className={`px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all text-white
                                ${problematicRows.length > 0 
                                    ? 'bg-amber-500 hover:bg-amber-600' 
                                    : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                        >
                            {isProcessing ? <Loader2 className="animate-spin"/> : (problematicRows.length > 0 ? <AlertTriangle size={18}/> : <CheckCircle size={18}/>)} 
                            
                            {problematicRows.length > 0 
                                ? `Importar com ${problematicRows.length} Avisos` 
                                : 'Confirmar Importação'}
                        </button>
                    </div>
                )}
            </div> 

            {/* --- 2. ÁREA DE UPLOAD (Se não houver dados) --- */}
            {previewData.length === 0 && (
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => fileRef.current?.click()}>
                    <UploadCloud className="mx-auto text-indigo-500 mb-3" size={40} />
                    <p className="font-medium text-slate-700 dark:text-slate-200">Clique para selecionar o arquivo TXT</p>
                    <input type="file" ref={fileRef} className="hidden" accept=".txt,.csv" onChange={handleFile} />
                </div>
            )}

            {/* --- 3. TABELAS DE DADOS (Se houver dados) --- */}
            {previewData.length > 0 && (
                <div className="animate-in fade-in space-y-6">
                    {/* BLOCO DE ERROS (SEMPRE NO TOPO) */}
                    <TableBlock 
                        title="Inconsistências Encontradas (Verifique C. Custo e Conta)" 
                        rows={problematicRows} 
                        isProblematic={true} 
                    />

                    {/* BLOCO DE ITENS CORRETOS */}
                    <TableBlock 
                        title="Itens Validados" 
                        rows={cleanRows} 
                        isProblematic={false} 
                    />
                </div>
            )}
        </div>
    );
};
const CustosComponent = ({ transactions, allTransactions, filter, selectedUnit, showToast, measureUnit, totalProduction }) => {
    const [filtered, setFiltered] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Estados para configurações de Rateio (buscados do banco)
    const [admParams, setAdmParams] = useState(null);
    const [vendPercents, setVendPercents] = useState({});
    const [loadingRateios, setLoadingRateios] = useState(true);

    const [expandedGroups, setExpandedGroups] = useState({
        'DESPESAS DA UNIDADE': true,
        'ADMINISTRATIVO': true,
        'CUSTO OPERACIONAL INDÚSTRIA': true,
        'CUSTO COMERCIAL': true,
        'CUSTO COMERCIAL GERÊNCIA': true,
        'CUSTO DEPARTAMENTO TÉCNICO': true
    });

    // Mapeamento de Vendedores
    const VENDEDORES_MAP = useMemo(() => [
        { cc: 8003, unit: "Noromix Concreto S/A - Votuporanga" },
        { cc: 9003, unit: "Noromix Concreto S/A - Três Fronteiras" },
        { cc: 22003, unit: "Noromix Concreto S/A - Ilha Solteira" },
        { cc: 25003, unit: "Noromix Concreto S/A - Jales" },
        { cc: 27003, unit: "Noromix Concreto S/A - Fernandópolis" },
        { cc: 29003, unit: "Noromix Concreto S/A - Pereira Barreto" },
        { cc: 33003, unit: "Noromix Concreto S/A - Ouroeste" },
        { cc: 34003, unit: "Noromix Concreto S/A - Monções" },
        { cc: 38003, unit: "Noromix Concreto S/A - Paranaíba" }
    ], []);

    // 1. Buscar Configurações de Rateio Salvas
    useEffect(() => {
        const fetchConfigs = async () => {
            setLoadingRateios(true);
            try {
                const docIdAdm = `rateio_adm_${filter.year}_${filter.month}`;
                const snapAdm = await getDoc(doc(db, 'artifacts', appId, 'rateio_adm_config', docIdAdm));
                if (snapAdm.exists()) setAdmParams(snapAdm.data());
                else setAdmParams(null);

                const docIdVend = `rateio_vendedores_${filter.year}_${filter.month}`;
                const snapVend = await getDoc(doc(db, 'artifacts', appId, 'rateio_vendedores_config', docIdVend));
                if (snapVend.exists()) setVendPercents(snapVend.data().percents || {});
                else setVendPercents({});

            } catch (e) {
                console.error("Erro ao buscar configs de rateio", e);
            } finally {
                setLoadingRateios(false);
            }
        };
        fetchConfigs();
    }, [filter.month, filter.year]);

    // 2. Processar Transações Reais + Rateios Virtuais
    useEffect(() => {
        if (loadingRateios) return;

        // A. Filtro básico das transações reais
        // IMPORTANTE: Excluir transações originais dos CCs que sofrem rateio para não duplicar
        const CCs_TO_EXCLUDE_PREFIX = ['1104', '1075', '1046', '1087', '1089'];
        const CCs_TO_EXCLUDE_EXACT = VENDEDORES_MAP.map(v => v.cc.toString());

        let data = transactions.filter(t => {
            if (t.type !== 'expense') return false;
            const ccCode = t.costCenter.split(' ')[0];
            const isExcludedPrefix = CCs_TO_EXCLUDE_PREFIX.some(prefix => ccCode.startsWith(prefix));
            const isExcludedExact = CCs_TO_EXCLUDE_EXACT.includes(ccCode);
            // Se for um dos CCs de rateio, esconde o original (para mostrar só o rateado)
            return !isExcludedPrefix && !isExcludedExact;
        });

        // B. GERAÇÃO DOS RATEIOS (Lógica Noromix Concreteiras)
        const isNoromixContext = selectedUnit === 'Noromix Concreteiras' || 
                                 (BUSINESS_HIERARCHY['Noromix Concreteiras'] && BUSINESS_HIERARCHY['Noromix Concreteiras'].some(u => selectedUnit.includes(u.split('-')[1]?.trim()))) || 
                                 selectedUnit.includes('Fábrica') ||
                                 selectedUnit === 'Fábrica de Tubos' || // Adicionado explicitamente
                                 !selectedUnit; 
        
        if (isNoromixContext && allTransactions && allTransactions.length > 0) {
            const virtualTransactions = [];
            
            // Helper: Filtrar transações do período globalmente
            const periodTxs = allTransactions.filter(t => {
                let y, m;
                if (typeof t.date === 'string') { y = parseInt(t.date.substring(0, 4)); m = parseInt(t.date.substring(5, 7)) - 1; }
                else { y = t.date.getFullYear(); m = t.date.getMonth(); }
                return y === filter.year && m === filter.month;
            });

            const targetUnits = [...BUSINESS_HIERARCHY["Noromix Concreteiras"], ...BUSINESS_HIERARCHY["Fábrica de Tubos"]];
            
            // --- CÁLCULO RIGOROSO DO VOLUME ---
            let grandTotalProd = 0;
            const unitVolumes = {};
            targetUnits.forEach(u => {
                const targetName = u.includes(':') ? u.split(':')[1].trim() : u;
                const vol = periodTxs
                    .filter(t => {
                        if(t.type !== 'metric' || t.metricType !== 'producao') return false;
                        const txUnitName = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                        return txUnitName === targetName;
                    })
                    .reduce((acc, t) => acc + t.value, 0);
                
                unitVolumes[u] = vol;
                grandTotalProd += vol;
            });

            // --- 1. RATEIO ADMINISTRATIVO (FOLHA) ---
            if (admParams) {
                let totalSalariosCalc = 0;
                targetUnits.forEach(u => {
                    const count = admParams.employees?.[u] || 0;
                    let factor = (count > 0 && count <= 6) ? 2 : (count > 6 && count <= 14) ? 4 : (count >= 15) ? 6 : 0;
                    totalSalariosCalc += (factor * (admParams.minWage || 1412));
                });

                targetUnits.forEach(u => {
                    if (grandTotalProd > 0) {
                        const vol = unitVolumes[u] || 0;
                        const valorFolha = (totalSalariosCalc / grandTotalProd) * vol;
                        
                        if (valorFolha > 0) {
                            virtualTransactions.push({
                                id: `rateio_adm_${u}`,
                                date: `${filter.year}-${String(filter.month+1).padStart(2, '0')}-28`,
                                segment: u,
                                description: "Rateio Automático Folha",
                                costCenter: "ADM-RATEIO",
                                accountPlan: "RATEIO.ADM",
                                planDescription: "Rateio Folha Adm",
                                value: valorFolha,
                                type: 'expense',
                                customGroup: "ADMINISTRATIVO",
                                customSubGroup: "CUSTOS DESPESAS FIXAS E ADMINISTRATIVAS"
                            });
                        }
                    }
                });
            }

            // --- 2. RATEIO COMERCIAL (1104) & 3. TÉCNICO (1075) ---
            const rateiosProporcionais = [
                { cc: '1104', sub: 'CUSTO COMERCIAL GERÊNCIA' },
                { cc: '1075', sub: 'CUSTO DEPARTAMENTO TÉCNICO' }
            ];

            rateiosProporcionais.forEach(config => {
                const rawTxs = periodTxs.filter(t => t.type === 'expense' && t.costCenter.startsWith(config.cc));
                
                rawTxs.forEach(tx => {
                    targetUnits.forEach(u => {
                        if (grandTotalProd > 0) {
                            const vol = unitVolumes[u] || 0;
                            const factor = vol / grandTotalProd;
                            const allocatedValue = tx.value * factor;
                            
                            if (allocatedValue > 0) {
                                virtualTransactions.push({
                                    ...tx, 
                                    id: `rateio_${config.cc}_${tx.id}_${u}`,
                                    segment: u,
                                    value: allocatedValue,
                                    description: `${tx.description} (Rateio)`,
                                    customGroup: "DESPESAS DA UNIDADE",
                                    customSubGroup: config.sub
                                });
                            }
                        }
                    });
                });
            });

            // --- 4. RATEIO VENDEDORES ---
            const vendedorCCs = VENDEDORES_MAP.map(v => v.cc);
            const rawVendorTxs = periodTxs.filter(t => t.type === 'expense' && vendedorCCs.includes(parseInt(t.costCenter.split(' ')[0])));

            rawVendorTxs.forEach(t => {
                const cc = parseInt(t.costCenter.split(' ')[0]);
                const mapInfo = VENDEDORES_MAP.find(m => m.cc === cc);
                
                if (mapInfo) {
                    const percConcreto = vendPercents[cc] !== undefined ? vendPercents[cc] : 100;
                    const valConcreto = t.value * (percConcreto / 100);
                    const valTubos = t.value - valConcreto;
                    
                    if (valConcreto > 0) {
                        virtualTransactions.push({
                            ...t,
                            id: `rateio_vend_${t.id}_conc`,
                            segment: mapInfo.unit,
                            value: valConcreto,
                            description: `${t.description} (Rateio ${percConcreto}%)`,
                            customGroup: "DESPESAS DA UNIDADE",
                            customSubGroup: "CUSTO COMERCIAL"
                        });
                    }

                    if (valTubos > 0) {
                        const factoryUnit = BUSINESS_HIERARCHY["Fábrica de Tubos"][0];
                        virtualTransactions.push({
                            ...t,
                            id: `rateio_vend_${t.id}_tubos`,
                            segment: factoryUnit,
                            value: valTubos,
                            description: `${t.description} (Rateio Tubos ${100-percConcreto}%)`,
                            customGroup: "DESPESAS DA UNIDADE",
                            customSubGroup: "CUSTO COMERCIAL"
                        });
                    }
                }
            });

            // --- 5. RATEIO NOROMIX (1046) ---
            const rawTxs1046 = periodTxs.filter(t => t.type === 'expense' && t.costCenter.startsWith('1046'));
            rawTxs1046.forEach(tx => {
                const valorPorUnidade = tx.value / 10; 
                targetUnits.forEach(u => {
                    virtualTransactions.push({
                        ...tx,
                        id: `rateio_1046_${tx.id}_${u}`,
                        segment: u,
                        value: valorPorUnidade,
                        description: `${tx.description} (1/10)`,
                        customGroup: "DESPESAS DA UNIDADE",
                        customSubGroup: "CUSTO OPERACIONAL INDÚSTRIA"
                    });
                });
            });

            // C. MESCLAR E FILTRAR PELA UNIDADE SELECIONADA
            const allReadyData = [...data, ...virtualTransactions];
            
            const finalData = allReadyData.filter(t => {
                if (!selectedUnit) return true; 
                
                // Preparar nome limpo da transação (ex: "Votuporanga")
                const txUnitClean = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;

                // 1. Se o filtro for um Segmento (ex: "Fábrica de Tubos")
                if (BUSINESS_HIERARCHY[selectedUnit]) {
                    const unitsInSegment = BUSINESS_HIERARCHY[selectedUnit];
                    
                    // CORREÇÃO: Comparação EXATA na lista do segmento
                    // Isso impede que "Votuporanga" seja aceito no segmento da Fábrica
                    return unitsInSegment.includes(txUnitClean);
                }

                // 2. Se o filtro for uma Unidade Específica
                const targetName = selectedUnit.includes(':') ? selectedUnit.split(':')[1].trim() : selectedUnit;
                return txUnitClean === targetName;
            });

            data = finalData;
        }

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            data = data.filter(t => 
                (t.accountPlan && t.accountPlan.toLowerCase().includes(lowerTerm)) ||
                (t.planDescription && t.planDescription.toLowerCase().includes(lowerTerm)) ||
                (t.description && t.description.toLowerCase().includes(lowerTerm))
            );
        }
        setFiltered(data);
    }, [transactions, allTransactions, searchTerm, loadingRateios, admParams, vendPercents, selectedUnit, filter]);

    // Lógica de Agrupamento Visual
    const groupedData = useMemo(() => {
        const hierarchy = {
            'DESPESAS DA UNIDADE': { total: 0, subgroups: { 
                'CUSTO OPERACIONAL INDÚSTRIA': { total: 0, classes: {} }, 
                'CUSTO OPERACIONAL ADMINISTRATIVO': { total: 0, classes: {} },
                'CUSTO COMERCIAL GERÊNCIA': { total: 0, classes: {} },
                'CUSTO COMERCIAL VENDEDORES': { total: 0, classes: {} },
                'CUSTO COMERCIAL': { total: 0, classes: {} },
                'CUSTO DEPARTAMENTO TÉCNICO': { total: 0, classes: {} },
                'OUTRAS DESPESAS': { total: 0, classes: {} } 
            }},
            'TRANSPORTE': { total: 0, subgroups: { 'CUSTO TRANSPORTE': {total:0, classes:{}}, 'Geral': {total:0, classes:{}} } },
            'ADMINISTRATIVO': { total: 0, subgroups: { 
                'CUSTO RATEIO DESPESAS ADMINISTRATIVAS': {total:0, classes:{}},
                'CUSTOS DESPESAS FIXAS E ADMINISTRATIVAS': {total:0, classes:{}},
                'Geral': {total:0, classes:{}} 
            }},
            'IMPOSTOS': { total: 0, subgroups: { 'CUSTO IMPOSTOS': {total:0, classes:{}}, 'Geral': {total:0, classes:{}} } },
            'INVESTIMENTOS': { total: 0, subgroups: { 'INVESTIMENTOS GERAIS': {total:0, classes:{}}, 'Geral': {total:0, classes:{}} } },
            'OUTROS': { total: 0, subgroups: { 'Geral': {total:0, classes:{}} } }
        };

        const grandTotal = filtered.reduce((acc, t) => acc + t.value, 0);

        filtered.forEach(t => {
            let targetRoot = 'OUTROS';
            let targetSub = 'Geral';

            if (t.customGroup && t.customSubGroup) {
                targetRoot = t.customGroup;
                targetSub = t.customSubGroup;
            } else {
                const segmentName = getParentSegment(t.segment);
                const rules = COST_CENTER_RULES[segmentName] || {};
                const ccCode = t.costCenter ? parseInt(t.costCenter.split(' ')[0]) : 0;
                let matched = false;
                
                if (rules) {
                    for (const [rootGroup, subGroups] of Object.entries(rules)) {
                        for (const [subGroup, ccList] of Object.entries(subGroups)) {
                            if (ccList.includes(ccCode)) {
                                targetRoot = rootGroup.toUpperCase();
                                targetSub = subGroup.toUpperCase();
                                matched = true;
                                break;
                            }
                        }
                        if (matched) break;
                    }
                }

                if (!matched) {
                    if (t.accountPlan?.startsWith('06')) { targetRoot = "INVESTIMENTOS"; targetSub = "INVESTIMENTOS GERAIS"; }
                    else if (t.accountPlan === '02.01') { targetRoot = "IMPOSTOS"; targetSub = "CUSTO IMPOSTOS"; }
                    else if (ADMIN_CC_CODES.includes(ccCode)) { targetRoot = 'DESPESAS DA UNIDADE'; targetSub = 'CUSTO OPERACIONAL ADMINISTRATIVO'; } 
                    else if (t.accountPlan?.startsWith('03')) { targetRoot = 'DESPESAS DA UNIDADE'; targetSub = 'CUSTO OPERACIONAL INDÚSTRIA'; } 
                    else if (t.accountPlan?.startsWith('04')) { targetRoot = 'DESPESAS DA UNIDADE'; targetSub = 'CUSTO OPERACIONAL ADMINISTRATIVO'; }
                    else { targetRoot = 'DESPESAS DA UNIDADE'; targetSub = 'OUTRAS DESPESAS'; }
                }
            }

            let finalValue = t.value;
            if (!hierarchy[targetRoot]) hierarchy[targetRoot] = { total: 0, subgroups: {} };
            if (!hierarchy[targetRoot].subgroups[targetSub]) hierarchy[targetRoot].subgroups[targetSub] = { total: 0, classes: {} };
            
            const subgroup = hierarchy[targetRoot].subgroups[targetSub];
            
            let displayDesc = t.planDescription;
            if (targetRoot === 'IMPOSTOS' || t.accountPlan === '02.01') {
                displayDesc = t.description && t.description.length > 2 ? t.description : t.planDescription;
            }

            const classKey = `${t.accountPlan} - ${displayDesc}`;
            
            if (!subgroup.classes[classKey]) {
                subgroup.classes[classKey] = { id: classKey, code: t.accountPlan, name: displayDesc, total: 0, items: [] };
            }

            subgroup.classes[classKey].items.push(t);
            subgroup.classes[classKey].total += finalValue;
            subgroup.total += finalValue;
            hierarchy[targetRoot].total += finalValue;
        });

        return { hierarchy, grandTotal };
    }, [filtered]);

    const toggleGroup = (id) => setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));

    const exportData = (type) => {
        const data = filtered.map(t => ({ Data: t.date, Unidade: t.segment, Fornecedor: t.description, Matéria: t.materialDescription, Cod_Classe: t.accountPlan, Desc_Classe: t.planDescription, Centro_Custo: t.costCenter, Valor: t.value }));
        if (type === 'xlsx') { const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Custos"); XLSX.writeFile(wb, "custos_detalhados.xlsx"); }
        showToast(`Exportado para ${type}`, 'success');
    };
    
    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="p-6 border-b dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg dark:text-white">Custos e Despesas</h3>
                    {loadingRateios && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Processando Rateios...</span>}
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64"><Search className="absolute left-3 top-2.5 text-slate-400" size={16}/><input className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                    <button onClick={() => exportData('xlsx')} className="text-emerald-500 flex items-center gap-1 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100"><Download size={16}/> Excel</button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300">
                        <tr><th className="p-3 w-10"></th><th className="p-3">Estrutura de Contas</th><th className="p-3 text-right">Valor Total</th><th className="p-3 text-right">Custo p/ {measureUnit}</th><th className="p-3 text-right">%</th></tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                        {Object.entries(groupedData.hierarchy).map(([rootName, rootData]) => {
                            if (rootData.total === 0) return null;
                            return (
                            <React.Fragment key={rootName}>
                                    <tr className="bg-slate-200 dark:bg-slate-800 font-bold cursor-pointer" onClick={() => toggleGroup(rootName)}>
                                    <td className="p-3 text-center">{expandedGroups[rootName] ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}</td>
                                    <td className="p-3 uppercase text-indigo-800 dark:text-indigo-400">{rootName}</td>
                                    <td className="p-3 text-right text-rose-600 dark:text-rose-400">{rootData.total.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                                    <td className="p-3 text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                                        {totalProduction > 0 ? (rootData.total / totalProduction).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-'}
                                    </td>
                                    <td className="p-3 text-right font-mono">{groupedData.grandTotal > 0 ? ((rootData.total / groupedData.grandTotal) * 100).toFixed(1) : 0}%</td>
                                </tr>
                                {expandedGroups[rootName] && Object.entries(rootData.subgroups).sort(([, a], [, b]) => b.total - a.total).map(([subName, subData]) => {
                                    if (subData.total === 0) return null;
                                    return (
                                        <React.Fragment key={subName}>
                                            <tr className="bg-slate-100 dark:bg-slate-700/50 font-semibold cursor-pointer border-l-4 border-indigo-500" onClick={() => toggleGroup(subName)}>
                                                <td className="p-3 text-center pl-6">{expandedGroups[subName] ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}</td>
                                                <td className="p-3 text-slate-700 dark:text-slate-200">{subName}</td>
                                                <td className="p-3 text-right text-slate-700 dark:text-slate-200">{subData.total.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                                                <td className="p-3 text-right font-mono text-xs">{totalProduction > 0 ? (subData.total / totalProduction).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-'}</td>
                                                <td className="p-3 text-right font-mono text-xs text-slate-500 dark:text-slate-400">{groupedData.grandTotal > 0 ? ((subData.total / groupedData.grandTotal) * 100).toFixed(1) : 0}%</td>
                                            </tr>
                                            {expandedGroups[subName] && Object.values(subData.classes).sort((a,b) => b.total - a.total).map(classe => (
                                                <React.Fragment key={classe.id}>
                                                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer" onClick={() => toggleGroup(classe.id)}>
                                                        <td className="p-3 text-center pl-10">{expandedGroups[classe.id] ? <ChevronDown size={14} className="text-slate-400"/> : <ChevronRight size={14} className="text-slate-400"/>}</td>
                                                        <td className="p-3 dark:text-slate-300"><span className="font-mono text-xs bg-slate-200 dark:bg-slate-600 px-1 rounded mr-2">{classe.code}</span>{classe.name}</td>
                                                        <td className="p-3 text-right dark:text-slate-300">{classe.total.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                                                        <td className="p-3 text-right font-mono text-xs dark:text-slate-400">{totalProduction > 0 ? (classe.total / totalProduction).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-'}</td>
                                                        <td className="p-3 text-right font-mono text-xs dark:text-slate-400">{subData.total > 0 ? ((classe.total / subData.total) * 100).toFixed(1) : 0}%</td>
                                                    </tr>
                                                    {expandedGroups[classe.id] && classe.items.map(t => (
                                                        <tr key={t.id} className="bg-white dark:bg-slate-900 text-xs border-b dark:border-slate-800">
                                                            <td></td>
                                                            <td className="p-2 pl-16">
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                    <div>
                                                                        <p className="font-bold text-slate-600 dark:text-slate-400">{t.description} <span className="font-normal text-[10px] ml-2 text-slate-400">{formatDate(t.date)}</span></p>
                                                                        <p className="text-[10px] text-slate-400">CC: {t.costCenter}</p>
                                                                    </div>
                                                                    <div className="text-slate-500 italic">{t.materialDescription}</div>
                                                                </div>
                                                            </td>
                                                            <td className="p-2 text-right text-rose-500">{t.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                                            <td className="p-2 text-right">-</td>
                                                            <td className="p-2 text-right text-slate-400">{classe.total > 0 ? ((t.value / classe.total) * 100).toFixed(1) : 0}%</td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </React.Fragment>
                            );
                        })}
                        <tr className="bg-slate-900 text-white font-bold text-lg">
                            <td colSpan={2} className="p-4 text-right">TOTAL GERAL</td>
                            <td className="p-4 text-right">{groupedData.grandTotal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                            <td className="p-4 text-right">{totalProduction > 0 ? (groupedData.grandTotal / totalProduction).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-'}</td>
                            <td className="p-4 text-right">100%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};
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
    const toggleFolder = (seg, e) => { if(e) e.stopPropagation(); setExpanded(prev => ({...prev, [seg]: !prev[seg]})); };
    const handleSelect = (val) => { onChange(val); setIsOpen(false); };
    let displayText = placeholder;
    if (value) {
        if (BUSINESS_HIERARCHY[value]) displayText = `📁 ${value}`;
        else if (value.includes(':')) displayText = value.split(':')[1].trim();
        else displayText = value;
    }
    return (
        <div className="relative w-full md:w-auto" ref={ref}>
            <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center justify-between w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white text-sm rounded-lg p-2.5 min-w-[280px] ${isOpen ? 'ring-2 ring-indigo-500' : ''}`} type="button">
                <span className="truncate font-medium">{displayText}</span>
                <ChevronDown size={16} className="text-slate-500"/>
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-[300px] max-h-[400px] overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl z-50">
                    {Object.entries(hierarchy).map(([segment, units]) => (
                        <div key={segment}>
                            <div onClick={(e) => isFilter ? handleSelect(segment) : toggleFolder(segment, e)} className={`flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-sm font-semibold border-b dark:border-slate-700 ${value === segment ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                <div onClick={(e) => toggleFolder(segment, e)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded">{expanded[segment] ? <FolderOpen size={16} className="text-amber-500"/> : <Folder size={16} className="text-amber-500"/>}</div>
                                <span className="flex-1">{segment}</span>
                            </div>
                            {expanded[segment] && (
                                <div className="bg-slate-50 dark:bg-slate-900/30 border-l-2 border-slate-200 dark:border-slate-700 ml-3">
                                    {units.map(u => (
                                        <div key={u.fullValue} onClick={() => handleSelect(u.fullValue)} className={`p-2 pl-8 text-xs cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-600 dark:text-slate-400 ${value === u.fullValue ? 'bg-indigo-50 dark:bg-indigo-900/20 font-bold text-indigo-600' : ''}`}>{u.label}</div>
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
    // ALTERAÇÃO: Meses com nomes completos
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    return (
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border dark:border-slate-700 shadow-sm">
            <select className="bg-transparent p-2 text-sm outline-none dark:text-white" value={filter.type} onChange={e => setFilter({...filter, type: e.target.value})}>
                <option value="month">Mensal</option><option value="quarter">Trimestral</option><option value="semester">Semestral</option><option value="year">Anual</option>
            </select>
            {filter.type === 'month' && <select className="bg-transparent p-2 text-sm outline-none border-l dark:border-slate-700 dark:text-white" value={filter.month} onChange={e => setFilter({...filter, month: parseInt(e.target.value)})}>{months.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>}
            {filter.type === 'quarter' && <select className="bg-transparent p-2 text-sm outline-none border-l dark:border-slate-700 dark:text-white" value={filter.quarter} onChange={e => setFilter({...filter, quarter: parseInt(e.target.value)})}> <option value={1}>1º Trimestre</option><option value={2}>2º Trimestre</option><option value={3}>3º Trimestre</option><option value={4}>4º Trimestre</option></select>}
            {filter.type === 'semester' && <select className="bg-transparent p-2 text-sm outline-none border-l dark:border-slate-700 dark:text-white" value={filter.semester} onChange={e => setFilter({...filter, semester: parseInt(e.target.value)})}> <option value={1}>1º Semestre</option><option value={2}>2º Semestre</option></select>}
            <select className="bg-transparent p-2 text-sm outline-none border-l dark:border-slate-700 font-bold dark:text-white" value={filter.year} onChange={e => setFilter({...filter, year: parseInt(e.target.value)})}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
        </div>
    );
};

const UsersScreen = ({ user, myRole, showToast }) => {
    const [users, setUsers] = useState([]); const [newUserEmail, setNewUserEmail] = useState(''); const [newUserPass, setNewUserPass] = useState('');
    const loadUsers = async () => { const list = await dbService.getAllUsers(); setUsers(list); }; useEffect(() => { loadUsers(); }, []);
    const handleCreateUser = async () => { if (myRole !== 'admin') return; try { const secondaryApp = initializeApp(firebaseConfig, "Secondary"); const secondaryAuth = getAuth(secondaryApp); const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail, newUserPass); await setDoc(doc(db, 'artifacts', appId, 'users', userCredential.user.uid), { email: newUserEmail, role: 'viewer', createdAt: new Date().toISOString() }); await signOut(secondaryAuth); showToast("Usuário criado!", 'success'); setNewUserEmail(''); setNewUserPass(''); loadUsers(); } catch (e) { showToast("Erro: " + e.message, 'error'); } };
    const handleChangeRole = async (uid, role) => { await dbService.updateUserRole(uid, role); loadUsers(); showToast("Permissão alterada.", 'success'); };
    const handleDelete = async (uid) => { if (!confirm("Remover acesso?")) return; await dbService.deleteUserAccess(uid); loadUsers(); showToast("Acesso revogado.", 'success'); };
    return (<div className="p-6 max-w-4xl mx-auto"><h2 className="text-2xl font-bold mb-6 dark:text-white">Gestão de Acessos</h2><div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm mb-8 border dark:border-slate-700"><h3 className="font-bold mb-4 flex items-center gap-2 dark:text-white"><PlusCircle size={20}/> Cadastrar Novo Usuário</h3><div className="flex gap-4 items-end"><div className="flex-1"><label className="text-xs font-bold text-slate-500">Email</label><input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={newUserEmail} onChange={e=>setNewUserEmail(e.target.value)}/></div><div className="flex-1"><label className="text-xs font-bold text-slate-500">Senha Provisória</label><input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={newUserPass} onChange={e=>setNewUserPass(e.target.value)}/></div><button onClick={handleCreateUser} className="bg-emerald-600 text-white px-4 py-2 rounded font-bold hover:bg-emerald-700">Criar</button></div></div><div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border dark:border-slate-700"><table className="w-full text-left"><thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase text-xs"><tr><th className="p-4">Email</th><th className="p-4">Permissão</th><th className="p-4">Ações</th></tr></thead><tbody className="divide-y dark:divide-slate-700">{users.map(u => (<tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50"><td className="p-4 dark:text-white">{u.email}</td><td className="p-4"><select value={u.role} onChange={(e)=>handleChangeRole(u.id, e.target.value)} disabled={u.role === 'admin' && u.email === user.email} className="border rounded p-1 text-sm dark:bg-slate-900 dark:text-white"><option value="viewer">Visualizador</option><option value="editor">Editor</option><option value="admin">Administrador</option></select></td><td className="p-4">{u.email !== user.email && <button onClick={()=>handleDelete(u.id)} className="text-rose-500 hover:text-rose-700"><Trash2 size={18}/></button>}</td></tr>))}</tbody></table></div></div>);
};

const ManualEntryModal = ({ onClose, segments, onSave, user, initialData, showToast }) => {
    // Estado inicial seguro
    const [form, setForm] = useState({ 
        date: new Date().toISOString().slice(0, 7), 
        type: 'expense', 
        description: '', 
        value: '', 
        segment: '', 
        accountPlan: '', 
        metricType: 'producao',
        materialDescription: '',
        costCenter: 'GERAL', 
        source: 'manual'     
    });

    const [activeTab, setActiveTab] = useState('expense'); 

    // Opções rápidas
    const manualOptions = [
        "Transporte Terceiros",
        "Rateio Despesas Administrativas",
        "Despesas Multas e Taxas",
        "Frota Parada",
        "Investimentos Consórcios a Contemplar"
    ];

    // Carregar dados na Edição
    useEffect(() => { 
        if (initialData) { 
            // Extrai apenas a data YYYY-MM de forma segura
            let safeDate = new Date().toISOString().slice(0, 7);
            if (initialData.date) {
                // Tenta lidar com data completa ISO ou YYYY-MM
                safeDate = initialData.date.substring(0, 7);
            }

            setForm({ 
                ...initialData, 
                date: safeDate,
                materialDescription: initialData.materialDescription || '',
                costCenter: initialData.costCenter || 'GERAL',
                source: initialData.source || 'manual',
                // Garante que accountPlan seja string válida
                accountPlan: initialData.accountPlan || ''
            }); 
            
            // Define a aba correta
            const type = initialData.type || 'expense';
            setActiveTab(type === 'metric' ? 'metric' : type); 
        } 
    }, [initialData]);

    const handleSubmit = async () => {
        // Validação de segurança para PLANO_CONTAS
        if (typeof PLANO_CONTAS === 'undefined' || !Array.isArray(PLANO_CONTAS)) {
            console.error("ERRO CRÍTICO: PLANO_CONTAS não foi carregado corretamente.");
            return showToast("Erro interno: Plano de contas indisponível. Recarregue a página.", 'error');
        }

        const val = parseFloat(form.value);
        
        // 1. Validações de Campos
        if (!form.description && activeTab !== 'metric') return showToast("Preencha a descrição.", 'error');
        if (isNaN(val) || !form.segment) return showToast("Preencha unidade e valor.", 'error');
        if (activeTab !== 'metric' && !form.accountPlan) return showToast("Selecione a conta do Plano.", 'error');
        if (activeTab === 'metric' && form.metricType === 'estoque' && !form.materialDescription) return showToast("Selecione o Material.", 'error');

        // 2. Tratamento da Data
        const [year, month] = form.date.split('-');
        const lastDay = new Date(year, month, 0).getDate();
        const fullDate = `${form.date}-${lastDay}`;
        
        // 3. Descrição da Conta (para facilitar leitura no banco)
        let planDesc = '';
        if (activeTab !== 'metric' && form.accountPlan) {
            const planItem = PLANO_CONTAS.find(p => p.code === form.accountPlan);
            planDesc = planItem ? planItem.name : '';
        }

        // 4. Construção do Objeto Limpo (Sanitização Completa)
        const tx = {
            date: fullDate,
            value: val,
            type: activeTab,
            segment: form.segment || '',
            description: form.description || '',
            costCenter: form.costCenter || 'GERAL',
            source: form.source || 'manual',
            
            // Campos condicionais
            accountPlan: activeTab === 'metric' ? 'METRICS' : (form.accountPlan || ''),
            planDescription: activeTab === 'metric' ? '' : planDesc,
            metricType: activeTab === 'metric' ? form.metricType : null,
            materialDescription: form.materialDescription || '',
            
            updatedAt: new Date().toISOString()
        };

        // Ajuste descrição para métricas
        if (activeTab === 'metric') { 
            const matDesc = form.metricType === 'estoque' ? ` - ${form.materialDescription}` : '';
            tx.description = `Lançamento de ${form.metricType.toUpperCase()}${matDesc}`; 
        }

        // Adiciona createdAt apenas se for novo
        if (!initialData?.id) {
            tx.createdAt = new Date().toISOString();
        }

       try { 
            if(initialData?.id) {
                // MODO EDIÇÃO: Garante que ID é string
                const docId = String(initialData.id); 
                await dbService.update(user, 'transactions', docId, tx);
                showToast("Lançamento atualizado!", 'success');
                onSave(); 
                onClose(); 
            } else {
                // MODO CRIAÇÃO
                await dbService.add(user, 'transactions', tx); 
                showToast("Salvo! Pode fazer o próximo.", 'success');
                onSave(); 
                
                // Reset parcial
                setForm(prev => ({ 
                    ...prev, 
                    value: '', 
                    description: '',
                }));
            }
        } catch(e) { 
            console.error("Erro ao salvar:", e);
            showToast("Erro ao salvar: " + e.message, 'error');
        }
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
                    <HierarchicalSelect value={form.segment} onChange={(val) => setForm({...form, segment: val})} options={segments} placeholder="Selecione a Unidade..." />

                    {activeTab !== 'metric' && (
                        <>
                            <label className="block text-xs font-bold text-slate-500 uppercase">Descrição / Classificação</label>
                            <select className="w-full border p-2 mb-2 rounded text-xs dark:bg-slate-700 dark:text-white" onChange={(e) => {
                                if(e.target.value) setForm({...form, description: e.target.value});
                            }}>
                                <option value="">Selecione ou Digite abaixo...</option>
                                {manualOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" placeholder="Descrição Manual..." value={form.description} onChange={e=>setForm({...form, description: e.target.value})} />
                            
                            <label className="block text-xs font-bold text-slate-500 uppercase">Plano de Contas</label>
                            <select 
                                className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" 
                                value={form.accountPlan} 
                                onChange={e => setForm({...form, accountPlan: e.target.value})}
                            >
                                <option value="">Selecione a Classe Analítica...</option>
                                {PLANO_CONTAS.map(r => (
                                    <option key={r.code} value={r.code}>
                                        {r.code} - {r.name}
                                    </option>
                                ))}
                            </select>
                        </>
                    )}

                    {activeTab === 'metric' && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={()=>setForm({...form, metricType:'producao'})} className={`p-2 border rounded text-xs font-bold ${form.metricType==='producao'?'bg-indigo-100 border-indigo-500 text-indigo-700':'dark:text-white'}`}><Factory className="mx-auto mb-1" size={16}/> Produção</button>
                                <button onClick={()=>setForm({...form, metricType:'vendas'})} className={`p-2 border rounded text-xs font-bold ${form.metricType==='vendas'?'bg-indigo-100 border-indigo-500 text-indigo-700':'dark:text-white'}`}><ShoppingCart className="mx-auto mb-1" size={16}/> Vendas</button>
                                <button onClick={()=>setForm({...form, metricType:'estoque'})} className={`p-2 border rounded text-xs font-bold ${form.metricType==='estoque'?'bg-indigo-100 border-indigo-500 text-indigo-700':'dark:text-white'}`}><Package className="mx-auto mb-1" size={16}/> Estoque</button>
                            </div>
                            {form.metricType === 'estoque' && (
                                <select className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white border-indigo-300" value={form.materialDescription} onChange={e => setForm({...form, materialDescription: e.target.value})}>
                                    <option value="">Selecione o Material...</option>
                                    <option value="Estoque Total">Estoque Total</option>
                                    <option value="Areia Fina">Areia Fina</option>
                                    <option value="Areia Grossa">Areia Grossa</option>
                                    <option value="Areia Suja">Areia Suja</option>
                                </select>
                            )}
                        </div>
                    )}

                    <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400 font-bold">{activeTab === 'metric' ? unitMeasure : 'R$'}</span>
                        <input type="number" className="w-full border p-2 pl-12 rounded dark:bg-slate-700 dark:text-white" placeholder="Valor / Quantidade" value={form.value} onChange={e=>setForm({...form, value: e.target.value})} />
                    </div>

                    <button onClick={handleSubmit} className="w-full bg-indigo-600 text-white py-3 rounded font-bold hover:bg-indigo-700">Salvar Lançamento</button>
                </div>
            </div>
        </div>
    );
};
const ProductionComponent = ({ transactions, measureUnit }) => {
    // Processamento dos dados para ambos os gráficos
    const data = useMemo(() => {
        // Filtra transações relevantes (Métricas, Receitas e Despesas)
        const relevant = transactions.filter(t => 
            (t.type === 'metric' && (t.metricType === 'producao' || t.metricType === 'vendas')) ||
            (t.type === 'revenue' || t.type === 'expense')
        );

        const grouped = {};
        
        relevant.forEach(t => {
            const d = new Date(t.date);
            // Chave de agrupamento: Ano-Mês
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            const label = d.toLocaleString('default', { month: 'short' });

            // Inicializa o objeto se não existir
            if (!grouped[key]) {
                grouped[key] = { 
                    name: label, 
                    Produção: 0, 
                    Vendas: 0, 
                    Faturamento: 0, 
                    Custo: 0,
                    sortKey: d.getTime() 
                };
            }

            // Soma valores físicos
            if (t.type === 'metric' && t.metricType === 'producao') grouped[key].Produção += t.value;
            if (t.type === 'metric' && t.metricType === 'vendas') grouped[key].Vendas += t.value;

            // Soma valores financeiros
            if (t.type === 'revenue') grouped[key].Faturamento += t.value;
            if (t.type === 'expense') grouped[key].Custo += t.value;
        });

        return Object.values(grouped).sort((a,b) => a.sortKey - b.sortKey);
    }, [transactions]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            
            {/* GRÁFICO 1: FÍSICO (Volume) */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 p-6">
              
                <h3 className="font-bold text-lg mb-4 dark:text-white">
                  <Package className="text-indigo-500" size={20}/>
                  Quantitativo: Produção vs Vendas ({measureUnit})</h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} 
                                itemStyle={{ color: '#fff' }}
                            />
                            <Legend />
                            <Line name="Produção (t)" type="monotone" dataKey="Produção" stroke="#8884d8" strokeWidth={3} dot={{r:4}} />
                            <Line name="Vendas (t)" type="monotone" dataKey="Vendas" stroke="#82ca9d" strokeWidth={3} dot={{r:4}} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* GRÁFICO 2: FINANCEIRO (R$) - NOVO */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 p-6">
                <h3 className="font-bold text-lg mb-4 dark:text-white flex items-center gap-2">
                    <DollarSign className="text-emerald-500" size={20}/> 
                    Financeiro: Custo de Produção vs Faturamento
                </h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        {/* Alterado de BarChart para LineChart */}
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                            <XAxis dataKey="name" stroke="#94a3b8" />
                            <YAxis 
                                stroke="#94a3b8" 
                                tickFormatter={(val) => `R$${(val/1000).toFixed(0)}k`}
                            />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} 
                                formatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Legend />
                            {/* Alterado de Bar para Line, mantendo as cores */}
                            <Line name="Faturamento" type="monotone" dataKey="Faturamento" stroke="#10b981" strokeWidth={3} dot={{r:4}} />
                            <Line name="Custo Total" type="monotone" dataKey="Custo" stroke="#f43f5e" strokeWidth={3} dot={{r:4}} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

const FechamentoComponent = ({ transactions, totalSales, totalProduction, measureUnit, filter, selectedUnit }) => {
    // Estados para controle de expansão
    const [expanded, setExpanded] = useState({
        'receitas': true,
        'custo_operacional': true,
        'manutencao': true
    });

    // Estado para controlar a aba ativa (Noromix Geral ou Só Bombas)
    const [activeSubTab, setActiveSubTab] = useState('noromix');

    const toggle = (key) => setExpanded(prev => ({...prev, [key]: !prev[key]}));

    const getPeriodLabel = () => {
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        if (filter.type === 'month') return `${months[filter.month]}/${filter.year}`;
        if (filter.type === 'quarter') return `${filter.quarter}º Trimestre/${filter.year}`;
        if (filter.type === 'semester') return `${filter.semester}º Semestre/${filter.year}`;
        return `Ano de ${filter.year}`;
    };

    const unitLabel = selectedUnit.includes(':') ? selectedUnit.split(':')[1].trim() : selectedUnit;
    const dynamicTitle = `Fechamento: ${unitLabel} - ${getPeriodLabel()}`;

    // VERIFICA SE DEVE USAR O LAYOUT ESPECIAL NOROMIX
    const isNoromixLayout = selectedUnit === 'Noromix Concreteiras' || 
                            selectedUnit === 'Fábrica de Tubos' || 
                            selectedUnit.includes('Fábrica') ||
                            (typeof BUSINESS_HIERARCHY !== 'undefined' && BUSINESS_HIERARCHY['Noromix Concreteiras'] && BUSINESS_HIERARCHY['Noromix Concreteiras'].some(u => selectedUnit.includes(u.split('-')[1]?.trim())));

    // --- CÁLCULO DADOS PADRÃO (PORTOS/PEDREIRAS) ---
    const standardData = useMemo(() => {
        if (isNoromixLayout) return null; 

        const sum = (fn) => transactions.filter(fn).reduce((acc, t) => acc + t.value, 0);
        const totalRevenue = transactions.filter(t => t.type === 'revenue').reduce((acc, t) => acc + t.value, 0);

        // Helper para verificar regras de custo
        const isInRuleGroup = (t, groupName, subGroupName = null) => {
            const currentSegment = Object.keys(BUSINESS_HIERARCHY).find(key => BUSINESS_HIERARCHY[key].some(u => selectedUnit.includes(u.split('-')[1]?.trim()))) || "Portos de Areia";
            const rules = COST_CENTER_RULES[currentSegment] || COST_CENTER_RULES["Portos de Areia"];
            if (!rules || !rules[groupName]) return false;
            const ccCode = t.costCenter ? parseInt(t.costCenter.split(' ')[0]) : 0;
            if (subGroupName) return rules[groupName][subGroupName]?.includes(ccCode);
            return Object.values(rules[groupName]).flat().includes(ccCode);
        };

        const recMaterial = sum(t => t.type === 'revenue' && (t.description.toLowerCase().includes('retira') || t.description.toLowerCase().includes('entrega') || t.accountPlan === '01.01'));
        const recFrete = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('frete'));
        const subsidio = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('subsídio'));
        
        const recRetira = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('retira'));
        const recEntrega = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('entrega'));
        const freteCarreta = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('carreta'));
        const freteTruck = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('truck'));
        const freteTerceiros = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('terceiros') && t.description.toLowerCase().includes('frete'));

        const despUnidade = sum(t => t.type === 'expense' && isInRuleGroup(t, 'DESPESAS DA UNIDADE'));
        const combustivel = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && (t.description.toLowerCase().includes('combustivel') || t.description.toLowerCase().includes('diesel') || t.accountPlan === '03.07.01'));
        const totalCustoOperacional = despUnidade + combustivel;

        const margemContribuicao = totalRevenue - totalCustoOperacional;

        const manutencaoTotal = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05'));
        const manuPrev = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('preventiva'));
        const manuCorr = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('corretiva'));
        const manuReform = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('reforma'));
        const manuFrete = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('frete')); 
        const manuPneus = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('pneu'));
        const manuRessolado = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('ressolado'));
        const manuNovos = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('novos'));
        
        const totalTransporteGroup = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE'));
        const residualTransporte = totalTransporteGroup - combustivel - manutencaoTotal;

        const transpTerceiros = sum(t => t.type === 'expense' && t.description.toLowerCase().includes('transporte terceiros'));
        const impostos = sum(t => t.type === 'expense' && (t.accountPlan.startsWith('02') || t.description.toLowerCase().includes('imposto')));
        
        const resultOperacional = margemContribuicao - manutencaoTotal - residualTransporte - transpTerceiros - impostos;

        const rateioAdm = sum(t => t.type === 'expense' && t.description.toLowerCase().includes('rateio despesas'));
        const multas = sum(t => t.type === 'expense' && (t.description.toLowerCase().includes('multa') || t.description.toLowerCase().includes('taxa')));
        const frotaParada = sum(t => t.type === 'expense' && t.description.toLowerCase().includes('frota parada'));

        const resultPosDespesas = resultOperacional - rateioAdm - multas - frotaParada;

        const investimentos = sum(t => t.type === 'expense' && (t.accountPlan.startsWith('06') || t.description.toLowerCase().includes('consórcio') || t.description.toLowerCase().includes('investimento')));
        const resultFinal = resultPosDespesas - investimentos;

        return {
            totalRevenue, recMaterial, recRetira, recEntrega, recFrete, freteCarreta, freteTruck, freteTerceiros, subsidio,
            totalCustoOperacional, despUnidade, combustivel, margemContribuicao,
            manutencaoTotal, manuPrev, manuCorr, manuReform, manuFrete, manuPneus, manuRessolado, manuNovos,
            residualTransporte, transpTerceiros, impostos, resultOperacional, rateioAdm, multas, frotaParada,
            resultPosDespesas, investimentos, resultFinal
        };
    }, [transactions, isNoromixLayout, selectedUnit]);

    // --- CÁLCULO DADOS ESPECÍFICOS NOROMIX ---
    const noromixData = useMemo(() => {
        if (!isNoromixLayout) return null;

        // --- CORREÇÃO DO PROBLEMA DA FÁBRICA ---
        // Filtra transações garantindo que pertencem EXATAMENTE ao segmento/unidade selecionado
        const safeTransactions = transactions.filter(t => {
            if (typeof BUSINESS_HIERARCHY !== 'undefined' && BUSINESS_HIERARCHY[selectedUnit]) {
                const targetUnits = BUSINESS_HIERARCHY[selectedUnit];
                const txUnitClean = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                return targetUnits.includes(txUnitClean);
            }
            return true;
        });

        const sum = (fn) => safeTransactions.filter(fn).reduce((acc, t) => acc + t.value, 0);
        
        // 1. VOLUMES
        const volRetira = sum(t => t.type === 'metric' && t.metricType === 'producao' && t.description.toLowerCase().includes('retira'));
        const volEntrega = sum(t => t.type === 'metric' && t.metricType === 'producao' && t.description.toLowerCase().includes('entrega'));
        const volTotal = totalProduction; 
        const volBombeado = sum(t => t.type === 'metric' && t.metricType === 'producao' && (t.description.toLowerCase().includes('bomba') || t.description.toLowerCase().includes('bombeado')));

        // 2. RECEITAS
        const totalReceitas = sum(t => t.type === 'revenue');
        const ganhoProdutividade = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('produtividade'));
        const recBombeado = sum(t => t.type === 'revenue' && (t.description.toLowerCase().includes('bombeado') || t.description.toLowerCase().includes('bomba')));
        
        const recConcreto = totalReceitas - ganhoProdutividade - recBombeado; 
        const totalRecCGanhos = recConcreto + ganhoProdutividade;

        // 3. MATÉRIA PRIMA
        const materiaPrima = sum(t => t.type === 'expense' && (t.accountPlan.startsWith('03.02') || t.description.toLowerCase().includes('materia') || t.description.toLowerCase().includes('cimento') || t.description.toLowerCase().includes('agregado') || t.description.toLowerCase().includes('aditivo') || t.description.toLowerCase().includes('areia') || t.description.toLowerCase().includes('brita')));

        const margem1 = totalRecCGanhos - materiaPrima;

        // 4. GRUPO BOMBAS
        const isBomba = (t) => t.description.toLowerCase().includes('bomba');
        const combBombas = sum(t => t.type === 'expense' && isBomba(t) && (t.accountPlan.startsWith('03.07.01') || t.description.toLowerCase().includes('combustivel') || t.description.toLowerCase().includes('diesel')));
        const manuBombas = sum(t => t.type === 'expense' && isBomba(t) && (t.accountPlan.startsWith('03.05') || t.description.toLowerCase().includes('manutencao') || t.description.toLowerCase().includes('peça')));
        const transpBombas = sum(t => t.type === 'expense' && isBomba(t) && (t.accountPlan.startsWith('03.07') && !t.accountPlan.startsWith('03.07.01')));
        const motBombas = sum(t => t.type === 'expense' && isBomba(t) && (t.accountPlan.startsWith('03.01') || t.description.toLowerCase().includes('motorista') || t.description.toLowerCase().includes('operador')));
        const subtotalBombas = manuBombas + transpBombas + motBombas;
        
        // Dados Aba Bombas
        const mcBombas = recBombeado - combBombas;
        const resOpBombas = mcBombas - subtotalBombas;

        // 5. GRUPO BETONEIRAS
        const isBetoneira = (t) => (t.description.toLowerCase().includes('betoneira') || t.description.toLowerCase().includes('caminhão') || t.description.toLowerCase().includes('caminhao')) && !t.description.toLowerCase().includes('bomba');
        const combBetoneiras = sum(t => t.type === 'expense' && isBetoneira(t) && (t.accountPlan.startsWith('03.07.01') || t.description.toLowerCase().includes('combustivel') || t.description.toLowerCase().includes('diesel')));
        const manuBetoneiras = sum(t => t.type === 'expense' && isBetoneira(t) && (t.accountPlan.startsWith('03.05') || t.description.toLowerCase().includes('manutencao') || t.description.toLowerCase().includes('peça') || t.description.toLowerCase().includes('pneu')));
        const transpBetoneiras = sum(t => t.type === 'expense' && isBetoneira(t) && (t.accountPlan.startsWith('03.07') && !t.accountPlan.startsWith('03.07.01')));
        const motBetoneiras = sum(t => t.type === 'expense' && isBetoneira(t) && (t.accountPlan.startsWith('03.01') || t.description.toLowerCase().includes('motorista')));

        const subtotalBetoneiras = manuBetoneiras + transpBetoneiras + motBetoneiras;

        // MARGEM 2
        const margem2 = margem1 + recBombeado - combBombas - combBetoneiras;

        const resPosBombas = margem2 - subtotalBombas;
        const resPosBetoneiras = resPosBombas - subtotalBetoneiras;

        // 6. DESPESAS DA UNIDADE
        const despFixasUnidade = sum(t => {
            if (t.type !== 'expense') return false;
            const desc = t.description.toLowerCase();
            const plan = t.accountPlan;
            
            if (plan.startsWith('03.02') || desc.includes('materia') || desc.includes('cimento') || desc.includes('agregado') || desc.includes('aditivo')) return false; 
            if (isBomba(t)) return false; 
            if (isBetoneira(t)) return false; 
            if (desc.includes('rateio') && desc.includes('adm')) return false; 
            if (desc.includes('parada')) return false; 
            if (plan.startsWith('02') || desc.includes('imposto')) return false; 
            if (plan.startsWith('06') || desc.includes('investimento') || desc.includes('consórcio')) return false;
            
            return true; 
        });

        const impostos = sum(t => t.type === 'expense' && (t.accountPlan.startsWith('02') || t.description.toLowerCase().includes('imposto')));
        const subtotalDespUnidade = despFixasUnidade + impostos;
        const resPosDespUnidade = resPosBetoneiras - subtotalDespUnidade;
        const resOperacional = resPosDespUnidade;

        // 7. PÓS OPERACIONAL
        const rateioAdm = sum(t => t.type === 'expense' && t.description.toLowerCase().includes('rateio') && t.description.toLowerCase().includes('adm'));
        const manuBetoneiraParada = sum(t => t.type === 'expense' && t.description.toLowerCase().includes('betoneira') && t.description.toLowerCase().includes('parada'));
        const manuVeicLeveParado = sum(t => t.type === 'expense' && t.description.toLowerCase().includes('veículo') && t.description.toLowerCase().includes('parado'));
        const resPosDespesas = resOperacional - rateioAdm - manuBetoneiraParada - manuVeicLeveParado;

        // 8. INVESTIMENTOS
        const investimentos = sum(t => t.type === 'expense' && (t.accountPlan.startsWith('06') || t.description.toLowerCase().includes('investimento') || t.description.toLowerCase().includes('consórcio')));
        const resPosInvestimentos = resPosDespesas - investimentos;

        // 9. INVESTIMENTOS BOMBAS
        const investBombas = sum(t => t.type === 'expense' && isBomba(t) && (t.accountPlan.startsWith('06') || t.description.toLowerCase().includes('investimento') || t.description.toLowerCase().includes('consórcio')));
        const resPosInvestBombas = resOpBombas - investBombas;

        // 10. GANHO DE MERCADO
        const clientesPrejuizo = sum(t => t.type === 'revenue' && (t.description.toLowerCase().includes('ganho mercado') || t.description.toLowerCase().includes('clientes prejuizo')));

        return {
            volRetira, volEntrega, volTotal, volBombeado,
            recConcreto, ganhoProdutividade, totalRecCGanhos,
            materiaPrima, margem1,
            recBombeado, combBombas, combBetoneiras, margem2,
            manuBombas, transpBombas, motBombas, subtotalBombas, resPosBombas,
            manuBetoneiras, transpBetoneiras, motBetoneiras, subtotalBetoneiras, resPosBetoneiras,
            despFixasUnidade, impostos, subtotalDespUnidade, resPosDespUnidade,
            resOperacional,
            rateioAdm, manuBetoneiraParada, manuVeicLeveParado, resPosDespesas,
            investimentos, resPosInvestimentos,
            clientesPrejuizo,
            // Bombas
            mcBombas, resOpBombas, investBombas, resPosInvestBombas
        };
    }, [transactions, totalProduction, isNoromixLayout, selectedUnit]);

    // --- RENDERIZAÇÃO DA LINHA ---
    const Row = ({ label, val, isHeader = false, isResult = false, isSub = false, colorClass = "text-slate-700", bgClass = "", indent = 0, type = 'money', customColor = null, onClick = null, hasArrow = false, expanded = false }) => {
        const baseRevenue = isNoromixLayout 
            ? (activeSubTab === 'bombas' ? noromixData?.recBombeado : (noromixData?.totalRecCGanhos + noromixData?.recBombeado)) 
            : standardData?.totalRevenue;
            
        const percent = (type === 'money' && baseRevenue > 0) ? (val / baseRevenue) * 100 : 0;
        const perUnit = totalProduction > 0 ? val / totalProduction : 0;
        
        let finalTextColor = colorClass;
        if (customColor === 'dynamic') {
            finalTextColor = val >= 0 ? 'text-emerald-600' : 'text-rose-600';
        } else if (customColor === 'purple') {
            finalTextColor = 'text-purple-600 font-bold';
        } else if (isResult) {
            finalTextColor = val >= 0 ? 'text-emerald-600' : 'text-rose-600';
        }

        return (
            <tr className={`${bgClass} border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer`} onClick={onClick}>
                <td className={`p-2 py-3 flex items-center ${finalTextColor} dark:text-slate-200`} style={{ paddingLeft: `${indent * 20 + 10}px` }}>
                    {hasArrow && (expanded ? <ChevronDown size={14} className="mr-2"/> : <ChevronRight size={14} className="mr-2"/>)}
                    <span className={`${isHeader ? 'font-bold uppercase text-sm' : 'text-xs font-medium'}`}>{label}</span>
                </td>
                <td className={`p-2 text-right font-bold ${finalTextColor} dark:text-slate-200`}>
                    {type === 'money' ? (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 
                     type === 'vol' ? (val || 0).toLocaleString('pt-BR') : val}
                </td>
                <td className="p-2 text-right text-xs font-mono text-slate-500 dark:text-slate-400">{type === 'money' && percent !== 0 ? `${percent.toFixed(2)}%` : '-'}</td>
                <td className="p-2 text-right text-xs font-mono text-slate-500 dark:text-slate-400">{type === 'money' && perUnit !== 0 ? perUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
            </tr>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden animate-in fade-in print:shadow-none print:border-none">
            {/* ESTILOS DE IMPRESSÃO: Esconde sidebar e cabeçalho do app, mantém só o relatório */}
            <style>{`
                @media print {
                    aside, header, button.no-print { display: none !important; }
                    main { padding: 0 !important; overflow: visible !important; }
                    body { background: white !important; }
                    .print\\:shadow-none { box-shadow: none !important; }
                    .print\\:border-none { border: none !important; }
                    /* Expande tudo na impressão */
                    tbody tr { display: table-row !important; } 
                }
            `}</style>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-lg dark:text-white">{dynamicTitle}</h3>
                    
                    {/* ABAS NOROMIX vs BOMBAS (SÓ APARECE SE FOR LAYOUT NOROMIX) */}
                    {isNoromixLayout && (
                        <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 border dark:border-slate-700 ml-4 no-print">
                            <button 
                                onClick={() => setActiveSubTab('noromix')}
                                className={`px-4 py-1 text-sm font-bold rounded-md transition-all ${activeSubTab === 'noromix' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
                            >
                                Noromix
                            </button>
                            <button 
                                onClick={() => setActiveSubTab('bombas')}
                                className={`px-4 py-1 text-sm font-bold rounded-md transition-all ${activeSubTab === 'bombas' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
                            >
                                Bombas
                            </button>
                        </div>
                    )}

                    <button onClick={() => window.print()} className="no-print p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors ml-auto" title="Exportar PDF / Imprimir">
                        <Printer size={20}/>
                    </button>
                </div>
                
                <div className="flex gap-4">
                    <div className="bg-white dark:bg-slate-800 px-3 py-1 rounded border dark:border-slate-700 text-sm">
                        <span className="text-slate-500 mr-2">Volume Total:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalProduction.toLocaleString()} {measureUnit}</span>
                    </div>
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs uppercase">
                        <tr>
                            <th className="p-3 pl-4">Descrição</th>
                            <th className="p-3 text-right">Valor</th>
                            <th className="p-3 text-right">% Rec.</th>
                            <th className="p-3 text-right">R$ / {measureUnit}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                        
                        {/* ================= LAYOUT NOROMIX GERAL ================= */}
                        {isNoromixLayout && noromixData && activeSubTab === 'noromix' && (
                            <>
                                <Row label="Volume m³ (Retira)" val={noromixData.volRetira} type="vol" indent={1} />
                                <Row label="Volume m³ (Entrega)" val={noromixData.volEntrega} type="vol" indent={1} />
                                <Row label="Volume m³ (Total)" val={noromixData.volTotal} type="vol" isHeader bgClass="bg-slate-50 dark:bg-slate-800" />
                                
                                <div className="my-4"></div>
                                <Row label="Receitas Concreto" val={noromixData.recConcreto} indent={0} colorClass="text-blue-600" />
                                <Row label="Ganho Produtividade" val={noromixData.ganhoProdutividade} indent={0} colorClass="text-blue-600" />
                                <Row label="Total Receitas C/ Ganhos" val={noromixData.totalRecCGanhos} isHeader bgClass="bg-blue-50 dark:bg-blue-900/20" />
                                <Row label="(-) Matéria Prima" val={noromixData.materiaPrima} indent={1} colorClass="text-rose-500" />
                                <Row label="= Margem de Contribuição 1" val={noromixData.margem1} isHeader isResult customColor="dynamic" bgClass="bg-slate-100 dark:bg-slate-700" />

                                <div className="my-4"></div>
                                <Row label="(+) Receitas Bombeado" val={noromixData.recBombeado} indent={1} colorClass="text-emerald-500" />
                                <Row label="(-) Combustível Bombas" val={noromixData.combBombas} indent={1} colorClass="text-rose-500" />
                                <Row label="(-) Combustível Betoneiras" val={noromixData.combBetoneiras} indent={1} colorClass="text-rose-500" />
                                <Row label="= Margem de Contribuição 2" val={noromixData.margem2} isHeader isResult customColor="dynamic" bgClass="bg-slate-100 dark:bg-slate-700" />

                                <div className="my-4"></div>
                                <Row label="Despesas Manutenção Bombas" val={noromixData.manuBombas} indent={1} colorClass="text-rose-500" />
                                <Row label="Despesas Transportes Bombas" val={noromixData.transpBombas} indent={1} colorClass="text-rose-500" />
                                <Row label="Custo Motorista Bombas" val={noromixData.motBombas} indent={1} colorClass="text-rose-500" />
                                <Row label="Subtotal Despesas Bombas" val={noromixData.subtotalBombas} isHeader customColor="purple" />
                                <Row label="= Resultado Pós Bombas" val={noromixData.resPosBombas} isHeader isResult customColor="dynamic" bgClass="bg-slate-100 dark:bg-slate-700" />

                                <div className="my-4"></div>
                                <Row label="Despesas Manutenção Betoneiras" val={noromixData.manuBetoneiras} indent={1} colorClass="text-rose-500" />
                                <Row label="Despesas Transportes Betoneiras" val={noromixData.transpBetoneiras} indent={1} colorClass="text-rose-500" />
                                <Row label="Custo Motorista Betoneiras" val={noromixData.motBetoneiras} indent={1} colorClass="text-rose-500" />
                                <Row label="Subtotal Despesas Betoneiras" val={noromixData.subtotalBetoneiras} isHeader customColor="purple" />
                                <Row label="= Resultado Pós Betoneiras" val={noromixData.resPosBetoneiras} isHeader isResult customColor="dynamic" bgClass="bg-slate-100 dark:bg-slate-700" />

                                <div className="my-4"></div>
                                <Row label="Total de Despesas Unidades" val={noromixData.despFixasUnidade} indent={1} colorClass="text-rose-500" />
                                <Row label="Despesas Fixas Adm P/ Unidade" val={0} indent={1} colorClass="text-rose-500" />
                                <Row label="Impostos" val={noromixData.impostos} indent={1} colorClass="text-rose-500" />
                                <Row label="Subtotal Despesas da Unidade" val={noromixData.subtotalDespUnidade} isHeader customColor="purple" />
                                <Row label="= Resultado Pós Desp. Unidade" val={noromixData.resPosDespUnidade} isHeader isResult customColor="dynamic" bgClass="bg-slate-100 dark:bg-slate-700" />

                                <div className="my-2 border-t-2 border-slate-300"></div>
                                <Row label="= RESULTADO OPERACIONAL" val={noromixData.resOperacional} isHeader isResult customColor="dynamic" bgClass="bg-slate-200 dark:bg-slate-600" />
                                <div className="my-2"></div>

                                <Row label="(-) Rateio Despesas Administrativas" val={noromixData.rateioAdm} indent={1} colorClass="text-rose-500" />
                                <Row label="(-) Desp. Manut. (Betoneira Parada)" val={noromixData.manuBetoneiraParada} indent={1} colorClass="text-rose-500" />
                                <Row label="(-) Desp. Manut. (Veículo Leve Parado)" val={noromixData.manuVeicLeveParado} indent={1} colorClass="text-rose-500" />
                                
                                <Row label="= RESULTADO PÓS DESPESAS" val={noromixData.resPosDespesas} isHeader isResult customColor="dynamic" bgClass="bg-slate-300 dark:bg-slate-500" />

                                <div className="my-4"></div>
                                <Row label="(-) Investimentos" val={noromixData.investimentos} indent={1} colorClass="text-rose-500" />
                                <Row label="= RESULTADO PÓS INVESTIMENTOS" val={noromixData.resPosInvestimentos} isHeader isResult customColor="dynamic" bgClass="bg-slate-400 dark:bg-slate-800" />

                                <div className="my-4"></div>
                                <Row label="Clientes C/ Prejuízo (Ganho de Mercado)" val={noromixData.clientesPrejuizo} indent={0} colorClass="text-indigo-600" />
                            </>
                        )}

                        {/* ================= LAYOUT NOROMIX BOMBAS (NOVA ABA) ================= */}
                        {isNoromixLayout && noromixData && activeSubTab === 'bombas' && (
                            <>
                                <Row label="Volume M³ (Bombeado)" val={noromixData.volBombeado} type="vol" isHeader bgClass="bg-slate-50 dark:bg-slate-800" />
                                
                                <div className="my-4"></div>
                                <Row label="Receitas Bombeado" val={noromixData.recBombeado} indent={0} colorClass="text-emerald-600" />
                                <Row label="(-) Combustível" val={noromixData.combBombas} indent={0} colorClass="text-rose-500" />
                                <Row label="= Margem de Contribuição" val={noromixData.mcBombas} isHeader isResult customColor="dynamic" bgClass="bg-slate-100 dark:bg-slate-700" />

                                <div className="my-4"></div>
                                <Row label="Despesas Manutenção Bombas" val={noromixData.manuBombas} indent={1} colorClass="text-rose-500" />
                                <Row label="Despesas Transportes" val={noromixData.transpBombas} indent={1} colorClass="text-rose-500" />
                                <Row label="Custo Motorista Bombas" val={noromixData.motBombas} indent={1} colorClass="text-rose-500" />
                                
                                <div className="my-2 border-t-2 border-slate-300"></div>
                                <Row label="= Resultado Operacional" val={noromixData.resOpBombas} isHeader isResult customColor="dynamic" bgClass="bg-slate-200 dark:bg-slate-600" />

                                <div className="my-4"></div>
                                <Row label="(-) Investimentos Bombas" val={noromixData.investBombas} indent={0} colorClass="text-rose-500" />
                                <Row label="= Resultado Pós Investimentos" val={noromixData.resPosInvestBombas} isHeader isResult customColor="dynamic" bgClass="bg-slate-400 dark:bg-slate-800" />
                            </>
                        )}

                        {/* ================= LAYOUT PADRÃO (PORTOS/PEDREIRAS) ================= */}
                        {!isNoromixLayout && standardData && (
                            <>
                                <Row label="Total Receitas" val={standardData.totalRevenue} isHeader colorClass="text-blue-600" onClick={()=>toggle('receitas')} hasArrow expanded={expanded['receitas']} />
                                {expanded['receitas'] && (
                                    <>
                                        <Row label="Receita de Material" val={standardData.recMaterial} indent={1} colorClass="text-blue-500" />
                                        <Row label="Receita Retira" val={standardData.recRetira} indent={2} isSub colorClass="text-blue-400" />
                                        <Row label="Receita Entrega" val={standardData.recEntrega} indent={2} isSub colorClass="text-blue-400" />
                                        <Row label="Receita de Frete" val={standardData.recFrete} indent={1} colorClass="text-blue-500" />
                                        <Row label="Frete Carreta" val={standardData.freteCarreta} indent={2} isSub colorClass="text-blue-400" />
                                        <Row label="Frete Truck" val={standardData.freteTruck} indent={2} isSub colorClass="text-blue-400" />
                                        <Row label="Frete Terceiros" val={standardData.freteTerceiros} indent={2} isSub colorClass="text-blue-400" />
                                        <Row label="Subsídio de Terceiros" val={standardData.subsidio} indent={1} colorClass="text-blue-500" />
                                    </>
                                )}

                                <Row label="Custo Operacional" val={standardData.totalCustoOperacional} isHeader colorClass="text-rose-600" onClick={()=>toggle('custo_operacional')} hasArrow expanded={expanded['custo_operacional']} />
                                {expanded['custo_operacional'] && (
                                    <>
                                        <Row label="Despesas da Unidade" val={standardData.despUnidade} indent={1} colorClass="text-rose-500" />
                                        <Row label="Custo Administrativo" val={0} indent={1} colorClass="text-rose-500" /> 
                                        <Row label="Combustível Transporte" val={standardData.combustivel} indent={1} colorClass="text-rose-500" />
                                    </>
                                )}

                                <Row label="Margem de Contribuição" val={standardData.margemContribuicao} isHeader isResult bgClass="bg-blue-50 dark:bg-blue-900/20" />

                                <Row label="Despesas Comerciais" val={0} indent={0} colorClass="text-rose-600" />

                                <Row label="Manutenção Transporte" val={standardData.manutencaoTotal} isHeader colorClass="text-rose-600" onClick={()=>toggle('manutencao')} hasArrow expanded={expanded['manutencao']} indent={0}/>
                                {expanded['manutencao'] && (
                                    <>
                                        <Row label="Manutenção Preventiva" val={standardData.manuPrev} indent={1} isSub colorClass="text-rose-500" />
                                        <Row label="Manutenção Corretiva" val={standardData.manuCorr} indent={1} isSub colorClass="text-rose-500" />
                                        <Row label="Manutenção Reforma" val={standardData.manuReform} indent={1} isSub colorClass="text-rose-500" />
                                        <Row label="Fretes compras p/ manutenção" val={standardData.manuFrete} indent={1} isSub colorClass="text-rose-500" />
                                        <Row label="Serviços de Pneus/Borracharia" val={standardData.manuPneus} indent={1} isSub colorClass="text-rose-500" />
                                        <Row label="Pneus Ressolados" val={standardData.manuRessolado} indent={1} isSub colorClass="text-rose-500" />
                                        <Row label="Pneus Novos" val={standardData.manuNovos} indent={1} isSub colorClass="text-rose-500" />
                                    </>
                                )}

                                <Row label="Total Despesas Transportes (Residual)" val={standardData.residualTransporte} indent={0} colorClass="text-rose-600 font-bold" />
                                <Row label="Total Desp. Transp. Terceiros" val={standardData.transpTerceiros} indent={0} colorClass="text-rose-600" />
                                <Row label="Impostos" val={standardData.impostos} indent={0} colorClass="text-rose-600" />

                                <Row label="Resultado Operacional" val={standardData.resultOperacional} isHeader isResult bgClass="bg-slate-200 dark:bg-slate-700" />

                                <Row label="Rateio Despesas Administrativas" val={standardData.rateioAdm} indent={0} colorClass="text-rose-600" />
                                <Row label="Despesas Multas e Taxas" val={standardData.multas} indent={0} colorClass="text-rose-600" />
                                <Row label="Frota Parada" val={standardData.frotaParada} indent={0} colorClass="text-rose-600" />

                                <Row label="Resultado Pós Despesas" val={standardData.resultPosDespesas} isHeader isResult bgClass="bg-slate-200 dark:bg-slate-700" />

                                <Row label="Investimentos / Consórcios" val={standardData.investimentos} indent={0} colorClass="text-rose-600" />

                                <Row label="Resultado Pós Investimentos" val={standardData.resultFinal} isHeader isResult bgClass="bg-slate-300 dark:bg-slate-600" />
                            </>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
const StockComponent = ({ transactions, measureUnit, globalCostPerUnit, currentFilter }) => {
    const stockData = useMemo(() => {
        // 1. CÁLCULO DO ANO TODO (Para garantir o saldo acumulado correto)
        // Usa transactions (que agora está recebendo stockDataRaw do App.js)
        const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
        const avgCost = globalCostPerUnit || 0;

        // Saldos acumulados (Apenas as categorias fixas)
        let balances = {
            'Areia Fina': 0,
            'Areia Grossa': 0,
            'Areia Suja': 0
        };

        const fullEvolution = [];

        sorted.forEach(t => {
            // Detecta o material
            let category = null;
            const desc = (t.materialDescription || t.description || '').toLowerCase();
            
            if (desc.includes('fina')) category = 'Areia Fina';
            else if (desc.includes('grossa')) category = 'Areia Grossa';
            else if (desc.includes('suja')) category = 'Areia Suja';

            // Se não for areia, IGNORA
            if (!category) return;

            // LÓGICA DE MOVIMENTAÇÃO
            if (t.type === 'metric') {
                const val = t.value;
                if (t.metricType === 'producao') balances[category] += val;
                else if (t.metricType === 'vendas') balances[category] -= val;
                else if (t.metricType === 'estoque') balances[category] = val; // Medição/Ajuste
            }

            // Soma do total físico naquele dia
            const totalMoment = Object.values(balances).reduce((a, b) => a + b, 0);
            
            if (t.type === 'metric') {
                fullEvolution.push({
                    dateObj: new Date(t.date),
                    displayDate: new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                    Estoque: totalMoment
                });
            }
        });

        // 2. RECORTA O GRÁFICO PARA O PERÍODO SELECIONADO (Mês, Trimestre, etc)
        // O cálculo acima rodou o ano todo. Agora filtramos só o que será exibido no gráfico.
        let filteredEvolution = fullEvolution;
        
        if (currentFilter && currentFilter.type === 'month') {
            filteredEvolution = fullEvolution.filter(item => item.dateObj.getMonth() === currentFilter.month);
        } else if (currentFilter && currentFilter.type === 'quarter') {
            const startMonth = (currentFilter.quarter - 1) * 3;
            const endMonth = startMonth + 2;
            filteredEvolution = fullEvolution.filter(item => item.dateObj.getMonth() >= startMonth && item.dateObj.getMonth() <= endMonth);
        } else if (currentFilter && currentFilter.type === 'semester') {
             const isFirstSem = currentFilter.semester === 1;
             filteredEvolution = fullEvolution.filter(item => isFirstSem ? item.dateObj.getMonth() < 6 : item.dateObj.getMonth() >= 6);
        }
        // Se for filtro 'year', ele mostra tudo (fullEvolution)

        // Pega os saldos FINAIS (acumulados até o último dia processado no ano)
        const totalFinal = Object.values(balances).reduce((a, b) => a + b, 0);

        return { 
            total: totalFinal,
            fina: balances['Areia Fina'],
            grossa: balances['Areia Grossa'],
            suja: balances['Areia Suja'],
            avgCost, 
            totalValue: totalFinal * avgCost,
            valFina: balances['Areia Fina'] * avgCost,
            valGrossa: balances['Areia Grossa'] * avgCost,
            valSuja: balances['Areia Suja'] * avgCost,
            evolution: filteredEvolution // Gráfico recortado visualmente, mas com altura correta
        };
    }, [transactions, globalCostPerUnit, currentFilter]);

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {/* CARDS TOTAIS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none">
                    <p className="text-indigo-200 text-xs font-bold uppercase mb-2">Estoque Físico Total</p>
                    <h3 className="text-3xl font-bold">{stockData.total.toLocaleString()} <span className="text-lg font-normal opacity-80">{measureUnit}</span></h3>
                    <div className="mt-4 pt-4 border-t border-indigo-500/50 flex justify-between items-center text-sm">
                        <span>Custo Médio</span>
                        <span className="font-bold bg-indigo-500 px-2 py-1 rounded">R$ {stockData.avgCost.toFixed(2)}</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border dark:border-slate-700 shadow-sm col-span-2 flex flex-col justify-center">
                    <p className="text-slate-500 text-xs font-bold uppercase mb-2">Valor Financeiro em Estoque</p>
                    <h3 className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                        {stockData.totalValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">Baseado no Custo Médio x Volume Calculado</p>
                </div>
            </div>

            <div className="flex items-center gap-2 mt-8">
                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                    <Package className="text-indigo-500"/> Detalhamento por Tipo
                </h3>
            </div>

            {/* DETALHAMENTO FIXO (3 COLUNAS) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* FINA */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 border-l-amber-400 shadow-sm border dark:border-slate-700">
                    <div className="flex justify-between mb-2">
                        <span className="font-bold text-slate-700 dark:text-slate-200">Areia Fina</span>
                        <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded">FINA</span>
                    </div>
                    <p className="text-2xl font-bold dark:text-white mt-2">{stockData.fina.toLocaleString()} <span className="text-sm text-slate-400">{measureUnit}</span></p>
                    <p className="text-xs text-emerald-600 font-bold mt-1">{stockData.valFina.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                </div>

                {/* GROSSA */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 border-l-blue-500 shadow-sm border dark:border-slate-700">
                    <div className="flex justify-between mb-2">
                        <span className="font-bold text-slate-700 dark:text-slate-200">Areia Grossa</span>
                        <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">GROSSA</span>
                    </div>
                    <p className="text-2xl font-bold dark:text-white mt-2">{stockData.grossa.toLocaleString()} <span className="text-sm text-slate-400">{measureUnit}</span></p>
                    <p className="text-xs text-emerald-600 font-bold mt-1">{stockData.valGrossa.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                </div>

                {/* SUJA */}
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border-l-4 border-l-stone-500 shadow-sm border dark:border-slate-700">
                    <div className="flex justify-between mb-2">
                        <span className="font-bold text-slate-700 dark:text-slate-200">Areia Suja</span>
                        <span className="text-xs font-bold bg-stone-100 text-stone-700 px-2 py-1 rounded">SUJA</span>
                    </div>
                    <p className="text-2xl font-bold dark:text-white mt-2">{stockData.suja.toLocaleString()} <span className="text-sm text-slate-400">{measureUnit}</span></p>
                    <p className="text-xs text-emerald-600 font-bold mt-1">{stockData.valSuja.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</p>
                </div>
            </div>

            {/* GRÁFICO */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 h-80 mt-6">
                <h3 className="font-bold mb-4 dark:text-white">Evolução do Estoque (Período Selecionado)</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stockData.evolution}>
                        <defs>
                            <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="displayDate" tick={{fontSize: 12}} />
                        <YAxis tick={{fontSize: 12}} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                        <Area type="step" dataKey="Estoque" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorStock)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
  /* * ------------------------------------------------------------------
 * COMPONENTE RELATÓRIO IA (FALTAVA NO CÓDIGO ORIGINAL)
 * ------------------------------------------------------------------
 */
const AIReportModal = ({ onClose, transactions, period }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg p-6 border dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                        <Sparkles className="text-purple-500" size={20}/> Análise Inteligente (IA)
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400"/></button>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg mb-4 text-sm text-slate-600 dark:text-slate-300">
                    <p className="font-bold mb-2">Período: {period}</p>
                    <p>A funcionalidade de conexão com o Gemini AI está configurada, mas aguarda implementação da lógica de resposta.</p>
                </div>

                <div className="text-center py-8">
                     <Loader2 className="animate-spin mx-auto text-indigo-500 mb-2" size={32}/>
                     <p className="text-xs text-slate-400">Gerando insights financeiros...</p>
                </div>

                <button onClick={onClose} className="w-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white py-2 rounded-lg font-bold text-sm">
                    Fechar
                </button>
            </div>
        </div>
    );
};
const InvestimentosReportComponent = ({ transactions, filter, selectedUnit }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUnits, setSelectedUnits] = useState([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef(null);

    // Fecha o dropdown se clicar fora
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterRef.current && !filterRef.current.contains(event.target)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 1. Identificar Unidades Disponíveis (Lógica Corrigida: Comparação Exata)
    const availableUnits = useMemo(() => {
        let invTxs = transactions.filter(t => t.accountPlan && t.accountPlan.startsWith('06'));

        if (selectedUnit && selectedUnit !== 'ALL') {
            if (BUSINESS_HIERARCHY[selectedUnit]) {
                // SE FOR UM SEGMENTO (Ex: Usinas de Asfalto)
                const unitsInSegment = BUSINESS_HIERARCHY[selectedUnit];
                
                invTxs = invTxs.filter(t => {
                    const cleanName = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                    
                    // CORREÇÃO AQUI: Usar .includes() no array para buscar correspondência EXATA
                    // Antes estava u.includes(cleanName), o que causava o erro de substring
                    return unitsInSegment.includes(cleanName);
                });
            } else {
                // SE FOR UMA UNIDADE ESPECÍFICA
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

    // 2. Sincronizar seleção
    useEffect(() => {
        setSelectedUnits(availableUnits);
    }, [availableUnits]);

    const toggleUnit = (unit) => {
        if (selectedUnits.includes(unit)) {
            setSelectedUnits(prev => prev.filter(u => u !== unit));
        } else {
            setSelectedUnits(prev => [...prev, unit]);
        }
    };

    const toggleAll = () => {
        if (selectedUnits.length === availableUnits.length) {
            setSelectedUnits([]); 
        } else {
            setSelectedUnits(availableUnits); 
        }
    };

    // 3. Filtrar e Agrupar Dados
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

    // 4. Função de Exportar PDF
    const generatePDF = () => {
        const doc = new jsPDF();
        
        const colorIndigo = [79, 70, 229];   
        const colorSlateDark = [30, 41, 59]; 
        const colorSlateLight = [241, 245, 249]; 
        const colorTextDark = [15, 23, 42];  

        let nomeContexto = "Geral";
        
        if (selectedUnits.length === 1) {
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
            { content: 'TOTAL GERAL INVESTIMENTOS', colSpan: 2, styles: { fillColor: colorSlateDark, textColor: 255, fontStyle: 'bold', halign: 'middle' } },
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
        doc.save(`Investimentos - ${safeName}.pdf`);
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
                    <div className="relative" ref={filterRef}>
                        <button 
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className="w-full md:w-auto px-4 py-2 border dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 dark:text-white flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                <Factory size={16} className="text-slate-400"/> 
                                {selectedUnits.length === availableUnits.length ? 'Todas as Unidades' : `${selectedUnits.length} Selecionadas`}
                            </span>
                            <ChevronDown size={14} className={`transition-transform ${isFilterOpen ? 'rotate-180' : ''}`}/>
                        </button>

                        {isFilterOpen && (
                            <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                                <div className="p-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                                    <span className="text-xs font-bold uppercase text-slate-500">Filtrar Unidades</span>
                                    <button onClick={toggleAll} className="text-xs text-indigo-600 hover:underline">
                                        {selectedUnits.length === availableUnits.length ? 'Desmarcar Tudo' : 'Marcar Tudo'}
                                    </button>
                                </div>
                                <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                                    {availableUnits.map(unit => {
                                        const cleanName = unit.split(':')[1]?.trim() || unit;
                                        const isSelected = selectedUnits.includes(unit);
                                        return (
                                            <div key={unit} onClick={() => toggleUnit(unit)} className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer text-sm">
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-500'}`}>
                                                    {isSelected && <CheckCircle size={12} className="text-white"/>}
                                                </div>
                                                <span className={`flex-1 truncate ${isSelected ? 'text-slate-800 dark:text-white font-medium' : 'text-slate-500'}`}>
                                                    {cleanName}
                                                </span>
                                            </div>
                                        )
                                    })}
                                    {availableUnits.length === 0 && <div className="p-4 text-center text-xs text-slate-400">Nenhuma unidade disponível para este filtro.</div>}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
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
                        <Printer size={18}/> Exportar
                    </button>
                </div>
            </div>

            <div className="bg-purple-50 dark:bg-slate-900/50 p-4 border-b dark:border-slate-700 flex justify-end items-center px-8">
                <span className="text-slate-500 font-bold uppercase text-xs mr-4">Total ({selectedUnits.length} un.):</span>
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
/**
 * ------------------------------------------------------------------
 * 4. APP PRINCIPAL
 * ------------------------------------------------------------------
 */
const GlobalComponent = ({ transactions, filter, setFilter, years }) => {
    const [selectedSegment, setSelectedSegment] = useState(null);

    // --- LÓGICA DE PROCESSAMENTO ---
    const consolidatedData = useMemo(() => {
        const segments = Object.keys(BUSINESS_HIERARCHY);
        const data = {
            'Total Global': { 
                name: 'Total Global', isGlobal: true, 
                vendas: 0, producao: 0, receitas: 0, despesas: 0, 
                recGrupo: 0, recClientes: 0,
                despUnidade: 0, despTransporte: 0, impostos: 0,
                despAdm: 0, despDiversas: 0, credMatTerceiro: 0, credTransp: 0,
                perdaTubos: 0, ajusteProd: 0, resUsinas: 0, subsidio: 0, depreciacao: 0, estoqueInv: 0,
                investimentos: 0, maqVenda: 0, furto: 0, veicLeveVenda: 0,
                maqObraOficina: 0, camObraOficina: 0, veicLeveObraOficina: 0,
                manutMaqDeprec: 0, manutCamDeprec: 0, deprecPedreira: 0,
                recFinanceira: 0, despFinanceira: 0,
                pagtoTributos: 0, endividamento: 0, acertoEmpresas: 0
            }
        };

        segments.forEach(seg => {
            data[seg] = { 
                name: seg, isGlobal: false, 
                vendas: 0, producao: 0, receitas: 0, despesas: 0,
                recGrupo: 0, recClientes: 0,
                despUnidade: 0, despTransporte: 0, impostos: 0,
                despAdm: 0, despDiversas: 0, credMatTerceiro: 0, credTransp: 0,
                perdaTubos: 0, ajusteProd: 0, resUsinas: 0, subsidio: 0, depreciacao: 0, estoqueInv: 0,
                investimentos: 0, maqVenda: 0, furto: 0, veicLeveVenda: 0,
                maqObraOficina: 0, camObraOficina: 0, veicLeveObraOficina: 0,
                manutMaqDeprec: 0, manutCamDeprec: 0, deprecPedreira: 0,
                recFinanceira: 0, despFinanceira: 0,
                pagtoTributos: 0, endividamento: 0, acertoEmpresas: 0
            };
        });

        transactions.forEach(t => {
            let y, m;
            if (typeof t.date === 'string' && t.date.length >= 10) {
                y = parseInt(t.date.substring(0, 4));
                m = parseInt(t.date.substring(5, 7)) - 1; 
            } else { const d = new Date(t.date); y = d.getFullYear(); m = d.getMonth(); }
            
            const matchesDate = (() => {
                if (y !== filter.year) return false;
                if (filter.type === 'month' && m !== filter.month) return false;
                if (filter.type === 'quarter' && (Math.floor(m / 3) + 1) !== filter.quarter) return false;
                if (filter.type === 'semester' && (m < 6 ? 1 : 2) !== filter.semester) return false;
                return true;
            })();

            if (!matchesDate) return;

            const segmentName = getParentSegment(t.segment);
            const target = data[segmentName];
            const global = data['Total Global'];

            if (!target) return;

            const val = t.value;
            const desc = (t.description || '').toLowerCase();
            const plan = (t.accountPlan || '');

            if (t.type === 'metric') {
                if (t.metricType === 'vendas') { target.vendas += val; global.vendas += val; }
                else if (t.metricType === 'producao') { target.producao += val; global.producao += val; }
                else if (t.metricType === 'estoque') { target.estoqueInv += val; global.estoqueInv += val; }
            } else if (t.type === 'revenue') {
                target.receitas += val; global.receitas += val;
                if (desc.includes('grupo') || desc.includes('filial')) { target.recGrupo += val; global.recGrupo += val; }
                else { target.recClientes += val; global.recClientes += val; }
                if (desc.includes('financeira')) { target.recFinanceira += val; global.recFinanceira += val; }
            } else if (t.type === 'expense') {
                target.despesas += val; global.despesas += val;
                if (plan.startsWith('02') || desc.includes('imposto')) { target.impostos += val; global.impostos += val; }
                else if (desc.includes('transporte')) { target.despTransporte += val; global.despTransporte += val; }
                else if (desc.includes('administrativa')) { target.despAdm += val; global.despAdm += val; }
                else if (desc.includes('diversas')) { target.despDiversas += val; global.despDiversas += val; }
                else if (desc.includes('crédito material')) { target.credMatTerceiro += val; global.credMatTerceiro += val; }
                else if (desc.includes('crédito transporte') || desc.includes('débito transporte')) { target.credTransp += val; global.credTransp += val; }
                else if (desc.includes('perda') || desc.includes('rompimento')) { target.perdaTubos += val; global.perdaTubos += val; }
                else if (desc.includes('ajuste produção')) { target.ajusteProd += val; global.ajusteProd += val; }
                else if (desc.includes('usina')) { target.resUsinas += val; global.resUsinas += val; }
                else if (desc.includes('subsídio')) { target.subsidio += val; global.subsidio += val; }
                else if (desc.includes('depreciação') && !desc.includes('pedreira')) { target.depreciacao += val; global.depreciacao += val; }
                else if (desc.includes('investimento') || desc.includes('consórcio')) { target.investimentos += val; global.investimentos += val; }
                else if (desc.includes('máquina') && desc.includes('venda')) { target.maqVenda += val; global.maqVenda += val; }
                else if (desc.includes('furto') || desc.includes('roubo')) { target.furto += val; global.furto += val; }
                else if (desc.includes('veículo') && desc.includes('venda')) { target.veicLeveVenda += val; global.veicLeveVenda += val; }
                else if (desc.includes('máquina') && desc.includes('oficina')) { target.maqObraOficina += val; global.maqObraOficina += val; }
                else if (desc.includes('caminhão') && desc.includes('oficina')) { target.camObraOficina += val; global.camObraOficina += val; }
                else if (desc.includes('veículo') && desc.includes('oficina')) { target.veicLeveObraOficina += val; global.veicLeveObraOficina += val; }
                else if (desc.includes('manutenção') && desc.includes('máquina')) { target.manutMaqDeprec += val; global.manutMaqDeprec += val; }
                else if (desc.includes('manutenção') && desc.includes('caminhão')) { target.manutCamDeprec += val; global.manutCamDeprec += val; }
                else if (desc.includes('depreciação') && desc.includes('pedreira')) { target.deprecPedreira += val; global.deprecPedreira += val; }
                else if (desc.includes('financeira')) { target.despFinanceira += val; global.despFinanceira += val; }
                else if (desc.includes('parcelamento') || desc.includes('tributo')) { target.pagtoTributos += val; global.pagtoTributos += val; }
                else if (desc.includes('endividamento')) { target.endividamento += val; global.endividamento += val; }
                else if (desc.includes('acerto empresa')) { target.acertoEmpresas += val; global.acertoEmpresas += val; }
                else { target.despUnidade += val; global.despUnidade += val; }
            }
        });

        Object.values(data).forEach(d => {
            d.resultado = d.receitas - d.despesas;
            d.margem = d.receitas > 0 ? (d.resultado / d.receitas) * 100 : 0;
            d.unidadeMedida = SEGMENT_CONFIG[d.name] || 'un';
            d.custoMedioUnitario = d.producao > 0 ? (d.despesas / d.producao) : 0;
            d.totalFaturamentoCalculado = d.recGrupo + d.recClientes;
        });

        return data;
    }, [transactions, filter]);

    // --- HELPER PARA AS LINHAS DOS CARDS ---
    const SummaryRow = ({ label, val, totalRevenue, isBold = false, isResult = false, type = 'money' }) => {
        let percentStr = '-';
        if (type === 'money' && totalRevenue > 0) {
            const pct = (val / totalRevenue) * 100;
            percentStr = `${pct.toFixed(1)}%`;
        } else if (type === 'money' && label === 'Receitas' && val > 0) {
            percentStr = '100.0%';
        }

        const colorClass = isResult 
            ? (val >= 0 ? 'text-emerald-400' : 'text-rose-400') 
            : (label === 'Despesas' ? 'text-rose-400' : 'text-slate-100');

        return (
            <div className={`grid grid-cols-[1fr_auto_55px] gap-1 items-center ${isBold ? 'font-bold' : ''}`}>
                <span className="opacity-90 leading-tight min-w-0">{label}</span>
                
                <span className={`${colorClass} text-right whitespace-nowrap`}>
                    {type === 'money' ? val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : `${val.toLocaleString()} un`}
                </span>
                
                {type === 'money' ? (
                    <span className="text-xs opacity-60 text-right font-mono">
                        {percentStr}
                    </span>
                ) : (
                    <span></span> 
                )}
            </div>
        );
    };

    const SummaryRowLight = ({ label, val, totalRevenue, isBold = false, isResult = false, type = 'money' }) => {
        let percentStr = '-';
        if (type === 'money' && totalRevenue > 0) {
            const pct = (val / totalRevenue) * 100;
            percentStr = `${pct.toFixed(1)}%`;
        } else if (type === 'money' && label === 'Receitas' && val > 0) {
             percentStr = '100.0%';
        }

        const valColor = isResult 
            ? (val >= 0 ? 'text-emerald-600' : 'text-rose-600') 
            : (label === 'Receitas' ? 'text-emerald-600' : (label === 'Despesas' ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'));

        return (
            <div className={`grid grid-cols-[1fr_auto_55px] gap-1 items-center ${isBold ? 'font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                {/* min-w-0 ajuda o grid a entender que o texto pode encolher/quebrar */}
                <span className="leading-tight min-w-0">{label}</span>
                
                <span className={`${valColor} text-right whitespace-nowrap`}>
                    {type === 'money' ? val.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : val.toLocaleString()}
                </span>
                
                {type === 'money' ? (
                    <span className="text-xs text-slate-400 dark:text-slate-500 text-right font-mono">
                        {percentStr}
                    </span>
                ) : (
                    <span></span>
                )}
            </div>
        );
    };

    // --- COMPONENTE INTERNO: MODAL DE DETALHE ---
    const DetailModal = ({ data, onClose }) => {
        if (!data) return null;

        const totalFaturamento = data.totalFaturamentoCalculado || 0;
        const resOperacional = totalFaturamento - data.despUnidade - data.despTransporte - data.impostos;
        
        const resComFinal = resOperacional 
            - data.despAdm - data.despDiversas + data.credMatTerceiro + data.credTransp 
            - data.perdaTubos - data.ajusteProd + data.resUsinas + data.subsidio 
            - data.depreciacao + data.estoqueInv; 
        
        const resComInvestimento = resComFinal 
            - data.investimentos - data.maqVenda - data.furto 
            - data.veicLeveVenda - data.maqObraOficina - data.camObraOficina - data.veicLeveObraOficina;

        const resOperacionalComDeprec = resComInvestimento 
            + data.manutMaqDeprec + data.manutCamDeprec - data.deprecPedreira;

        const deltaFisico = data.producao - data.vendas;
        const custoTotalOp = data.despesas;
        const custoMedio = data.producao > 0 ? (custoTotalOp / data.producao) : 0;
        const creditoDebitoEstoque = deltaFisico * custoMedio;

        const demonstrativoComEstoque = resComInvestimento + creditoDebitoEstoque;

        const resFinanceiro = data.recFinanceira - data.despFinanceira;
        const demPosFinanceiro = demonstrativoComEstoque + resFinanceiro;
        const demPosEndividamento = demPosFinanceiro - data.pagtoTributos - data.endividamento - data.acertoEmpresas;

        const Row = ({ label, val, bold = false, indent = 0, isResult = false, color = "text-slate-700", type = 'money' }) => {
            const percent = (type === 'money' && totalFaturamento !== 0) ? (val / totalFaturamento) * 100 : 0;
            const showPercent = type === 'money';

            return (
                <div className={`flex items-center justify-between p-2 border-b dark:border-slate-700 ${bold ? 'font-bold bg-slate-50 dark:bg-slate-700/50' : ''} ${isResult ? 'bg-slate-100 dark:bg-slate-600' : ''}`}>
                    <span className={`flex-1 ${color} dark:text-slate-200`} style={{ paddingLeft: `${indent * 20}px` }}>{label}</span>
                    <div className="flex items-center gap-4">
                        <span className={`${isResult ? (val >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-600 dark:text-slate-300'} text-right w-32`}>
                            {type === 'money' ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 
                             type === 'vol' ? val.toLocaleString('pt-BR') : val}
                        </span>
                        <span className="text-right w-16 text-xs font-mono text-slate-500 dark:text-slate-400">
                            {showPercent ? `${percent.toFixed(1)}%` : '-'}
                        </span>
                    </div>
                </div>
            );
        };

        return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
                {/* AJUSTE: w-[95%] para mobile e w-full max-w-2xl para desktop */}
                <div className="bg-white dark:bg-slate-800 w-[95%] md:w-full md:max-w-2xl rounded-xl shadow-2xl overflow-hidden my-4 md:my-8 animate-in zoom-in-95 duration-200">
                    <div className="bg-indigo-600 p-4 flex justify-between items-center text-white sticky top-0 z-10">
                        <h2 className="font-bold text-lg">Fechamento: {data.name}</h2>
                        <button onClick={onClose}><X size={24}/></button>
                    </div>
                    <div className="p-4 md:p-6 overflow-y-auto max-h-[80vh] text-sm">
                        <div className="flex justify-end mb-2 px-2"><span className="text-xs font-bold text-slate-400 w-16 text-right">% Rec.</span></div>
                        
                        <Row label={`Vendas Total (${data.unidadeMedida})`} val={data.vendas} type="vol" bold />
                        <Row label="Receitas (Grupo)" val={data.recGrupo} indent={1} />
                        <Row label="Receitas (Clientes)" val={data.recClientes} indent={1} />
                        <Row label="Total do Faturamento" val={totalFaturamento} bold color="text-indigo-600" />
                        
                        <div className="my-2"></div>
                        <Row label="(-) Total Despesas Unidade" val={data.despUnidade} indent={1} color="text-rose-500" />
                        <Row label="(-) Total Despesas Transporte" val={data.despTransporte} indent={1} color="text-rose-500" />
                        <Row label="(-) Impostos" val={data.impostos} indent={1} color="text-rose-500" />
                        
                        <div className="border-t-2 border-slate-300 my-2"></div>
                        <Row label="= RESULTADO OPERACIONAL" val={resOperacional} isResult bold />
                        <div className="my-2"></div>

                        <Row label="Despesas Administrativas" val={data.despAdm} indent={1} color="text-rose-500" />
                        <Row label="Despesas Diversas" val={data.despDiversas} indent={1} color="text-rose-500" />
                        <Row label="Crédito Material Terceiro" val={data.credMatTerceiro} indent={1} color="text-emerald-500" />
                        <Row label="Crédito/Débito Transporte" val={data.credTransp} indent={1} />
                        <Row label="Perda de Tubos/Telas" val={data.perdaTubos} indent={1} color="text-rose-500" />
                        <Row label="Ajuste de Produção" val={data.ajusteProd} indent={1} />
                        <Row label="Resultado Usinas" val={data.resUsinas} indent={1} />
                        <Row label="Subsídio de Terceiros" val={data.subsidio} indent={1} />
                        <Row label="Depreciação" val={data.depreciacao} indent={1} color="text-rose-500" />
                        <Row label="Estoque (Inventário)" val={data.estoqueInv} indent={1} />

                        <div className="border-t-2 border-slate-300 my-2"></div>
                        <Row label="= RESULTADO C/ FINAL" val={resComFinal} isResult bold />
                        <div className="my-2"></div>

                        <Row label="Investimentos/Consórcios" val={data.investimentos} indent={1} color="text-rose-500" />
                        <Row label="Máquinas para Venda" val={data.maqVenda} indent={1} />
                        <Row label="Furto/Roubo" val={data.furto} indent={1} color="text-rose-500" />
                        <Row label="Veículos Leves Venda" val={data.veicLeveVenda} indent={1} />
                        <Row label="Máquinas Obra - Oficina" val={data.maqObraOficina} indent={1} color="text-rose-500" />
                        <Row label="Caminhões Obra - Oficina" val={data.camObraOficina} indent={1} color="text-rose-500" />
                        <Row label="Veíc Leves Obra - Oficina" val={data.veicLeveObraOficina} indent={1} color="text-rose-500" />

                        <div className="border-t-2 border-slate-300 my-2"></div>
                        <Row label="= RESULTADO C/ INVESTIMENTO" val={resComInvestimento} isResult bold />
                        <div className="my-2"></div>

                        <Row label="(+) Manut. Máquinas (Deprec)" val={data.manutMaqDeprec} indent={1} color="text-emerald-500" />
                        <Row label="(+) Manut. Caminhões (Deprec)" val={data.manutCamDeprec} indent={1} color="text-emerald-500" />
                        <Row label="(-) Depreciação Pedreiras" val={data.deprecPedreira} indent={1} color="text-rose-500" />

                        <div className="border-t-2 border-slate-300 my-2"></div>
                        <Row label="= RESULTADO OP. C/ DEPRECIAÇÃO" val={resOperacionalComDeprec} isResult bold />
                        <div className="my-2"></div>

                        <div className="bg-slate-100 dark:bg-slate-700/30 p-2 rounded mb-2">
                            <Row label={`Produção (${data.unidadeMedida})`} val={data.producao} type="vol" />
                            <Row label={`Crédito/Débito Físico (${data.unidadeMedida})`} val={deltaFisico} type="vol" color={deltaFisico >= 0 ? "text-emerald-500" : "text-rose-500"} />
                            <p className="text-[10px] text-right text-slate-400 italic mr-20">Custo Médio: {custoMedio.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
                        </div>
                        <Row label="Crédito/Débito Estoque (R$)" val={creditoDebitoEstoque} bold color={creditoDebitoEstoque >= 0 ? "text-emerald-600" : "text-rose-600"} />

                        <div className="border-t-4 border-slate-400 my-3"></div>
                        <Row label="= DEMONSTRATIVO C/ ESTOQUE" val={demonstrativoComEstoque} isResult bold />

                        {data.isGlobal && (
                            <div className="mt-6 animate-in fade-in">
                                <h4 className="font-bold text-center bg-slate-200 dark:bg-slate-700 p-2 mb-2 rounded uppercase text-xs">Exclusivo Global</h4>
                                <Row label="Receita Financeira" val={data.recFinanceira} indent={1} color="text-emerald-500" />
                                <Row label="Despesa Financeira" val={data.despFinanceira} indent={1} color="text-rose-500" />
                                <Row label="Resultado Financeiro" val={resFinanceiro} bold indent={1} />
                                
                                <div className="border-t-2 border-slate-300 my-2"></div>
                                <Row label="= DEMONSTRATIVO PÓS FINANCEIRO" val={demPosFinanceiro} isResult bold />
                                <div className="my-2"></div>

                                <Row label="Pagto. Parcelamento Tributos" val={data.pagtoTributos} indent={1} color="text-rose-500" />
                                <Row label="Endividamento" val={data.endividamento} indent={1} color="text-rose-500" />
                                <Row label="Acerto entre Empresas" val={data.acertoEmpresas} indent={1} />

                                <div className="border-t-4 border-slate-800 dark:border-white my-3"></div>
                                <Row label="= DEMONSTRATIVO PÓS ENDIVIDAMENTO" val={demPosEndividamento} isResult bold />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in">
             <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-sm">
                <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                    <Globe className="text-indigo-500"/> Consolidação Global
                </h3>
                <PeriodSelector filter={filter} setFilter={setFilter} years={years} />
            </div>

            {/* AJUSTE: Grid Mobile(1) -> Tablet(2) -> Laptop(3) -> Monitor(4) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                {/* 1. Card Total Global */}
                {consolidatedData['Total Global'] && (
                    <div 
                        onClick={() => setSelectedSegment(consolidatedData['Total Global'])}
                        className="bg-indigo-600 text-white p-4 md:p-6 rounded-2xl shadow-lg cursor-pointer hover:scale-105 transition-transform"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-lg md:text-xl">TOTAL GLOBAL</h3>
                            <Globe size={24} className="opacity-80"/>
                        </div>
                        <div className="space-y-3 text-sm">
                            <SummaryRow label="Vendas" val={consolidatedData['Total Global'].vendas} type="vol" totalRevenue={consolidatedData['Total Global'].receitas} />
                            <SummaryRow label="Receitas" val={consolidatedData['Total Global'].receitas} totalRevenue={consolidatedData['Total Global'].receitas} isBold />
                            <SummaryRow label="Despesas" val={consolidatedData['Total Global'].despesas} totalRevenue={consolidatedData['Total Global'].receitas} />
                            
                            <div className="border-t border-indigo-400 pt-3">
                                <SummaryRow label="Resultado" val={consolidatedData['Total Global'].resultado} totalRevenue={consolidatedData['Total Global'].receitas} isBold isResult />
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Cards Segmentos */}
                {Object.values(consolidatedData).filter(d => !d.isGlobal).map(d => (
                    <div 
                        key={d.name} 
                        onClick={() => setSelectedSegment(d)}
                        className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl shadow-sm border dark:border-slate-700 cursor-pointer hover:border-indigo-500 transition-colors group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            {/* AJUSTE: leading-tight para permitir quebra de linha sem espaçamento excessivo */}
                            <h3 className="font-bold text-base md:text-lg dark:text-white group-hover:text-indigo-600 leading-tight" title={d.name}>{d.name}</h3>
                            <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500 shrink-0">{d.unidadeMedida}</span>
                        </div>
                        <div className="space-y-3 text-sm">
                            <SummaryRowLight label="Vendas" val={d.vendas} type="vol" totalRevenue={d.receitas} />
                            <SummaryRowLight label="Receitas" val={d.receitas} totalRevenue={d.receitas} isBold />
                            <SummaryRowLight label="Despesas" val={d.despesas} totalRevenue={d.receitas} />

                            <div className="border-t dark:border-slate-700 pt-3">
                                <SummaryRowLight label="Resultado" val={d.resultado} totalRevenue={d.receitas} isBold isResult />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {selectedSegment && <DetailModal data={selectedSegment} onClose={() => setSelectedSegment(null)} />}
        </div>
    );
};
// --- COMPONENTE INTERNO: INPUT DE MOEDA (Mantido fora) ---
const CurrencyInput = ({ value, onChange, disabled, className }) => {
    const handleChange = (e) => {
        const rawValue = e.target.value.replace(/\D/g, ""); 
        const numberValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;
        onChange(numberValue);
    };

    const displayValue = value 
        ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
        : 'R$ 0,00';

    return (
        <input
            type="text"
            value={displayValue}
            onChange={handleChange}
            disabled={disabled}
            className={className}
            placeholder="R$ 0,00"
        />
    );
};

const RateiosComponent = ({ transactions, filter, setFilter, years, segmentsList }) => {
    // Estado local
    const [selectedSegment, setSelectedSegment] = useState('Portos de Areia');
    const [activeRateioType, setActiveRateioType] = useState('ADMINISTRATIVO');
    
    // Estados para Rateio Vendedores (Manual)
    const [manualPercents, setManualPercents] = useState({});
    const [isLockedVend, setIsLockedVend] = useState(false);
    const [isSavingVend, setIsSavingVend] = useState(false);

    // --- ESTADOS PARA RATEIO ADM NOROMIX ---
    const [admParams, setAdmParams] = useState({
        totalValue: 0,      // Valor Total a Ratear
        minWage: 1412,      // Salário Mínimo
        employees: {}       // Mapa: { 'Unidade': qtd_funcionarios }
    });
    
    const [isLocked, setIsLocked] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // --- CONFIGURAÇÃO DOS RATEIOS ---
    const RATEIO_CONFIG = {
        'Portos de Areia': [
            { id: 'ADMINISTRATIVO', label: 'Rateio Administrativo' },
            { id: 'PRODUCAO', label: 'Encarregado Produção' },
            { id: 'VENDEDORES', label: 'Rateio Vendedores' },
            { id: 'COMERCIAL', label: 'Rateio Comercial' }
        ],
        'Pedreiras': [
            { id: 'ADMINISTRATIVO', label: 'Rateio Administrativo' },
            { id: 'PRODUCAO', label: 'Encarregado Produção' },
            { id: 'VENDEDORES', label: 'Rateio Vendedores' },
            { id: 'COMERCIAL', label: 'Rateio Comercial' },
            { id: 'LIMPEZA', label: 'Rateio Limpeza' },
            { id: 'PERFURATRIZ', label: 'Rateio Perfuratriz' }
        ],
        'Noromix Concreteiras': [
            { id: 'ADMINISTRATIVO', label: 'Rateio Administrativo (Salários)' }, 
            { id: 'COMERCIAL', label: 'Rateio Comercial (Produção)' },
            { id: 'TECNICO', label: 'Rateio Dep. Técnico (CC 1075)' },
            { id: 'VENDEDORES', label: 'Rateio Vendedores (CC Específico)' },
            { id: 'NOROMIX_1046', label: 'Rateio Noromix (CC 1046)' }
        ]
    };

    // --- MAPEAMENTO DE VENDEDORES ---
    const VENDEDORES_MAP = [
        { cc: 8003, unit: "Noromix Concreto S/A - Votuporanga" },
        { cc: 9003, unit: "Noromix Concreto S/A - Três Fronteiras" },
        { cc: 22003, unit: "Noromix Concreto S/A - Ilha Solteira" },
        { cc: 25003, unit: "Noromix Concreto S/A - Jales" },
        { cc: 27003, unit: "Noromix Concreto S/A - Fernandópolis" },
        { cc: 29003, unit: "Noromix Concreto S/A - Pereira Barreto" },
        { cc: 33003, unit: "Noromix Concreto S/A - Ouroeste" },
        { cc: 34003, unit: "Noromix Concreto S/A - Monções" },
        { cc: 38003, unit: "Noromix Concreto S/A - Paranaíba" }
    ];

    // --- EFEITO: CARREGAR DADOS SALVOS (ADM E VENDEDORES) ---
    useEffect(() => {
        const loadSavedData = async () => {
            if (selectedSegment !== 'Noromix Concreteiras') return;

            // 1. CARREGAR ADM
            const docIdAdm = `rateio_adm_${filter.year}_${filter.month}`;
            const docRefAdm = doc(db, 'artifacts', appId, 'rateio_adm_config', docIdAdm);

            try {
                const docSnap = await getDoc(docRefAdm);
                const allUnits = [...BUSINESS_HIERARCHY["Noromix Concreteiras"], ...BUSINESS_HIERARCHY["Fábrica de Tubos"]];
                
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setAdmParams({
                        totalValue: data.totalValue || 0,
                        minWage: data.minWage || 1412,
                        employees: data.employees || {}
                    });
                    setIsLocked(true); 
                } else {
                    const initialEmployees = {};
                    allUnits.forEach(u => initialEmployees[u] = 0);
                    setAdmParams({ totalValue: 0, minWage: 1412, employees: initialEmployees });
                    setIsLocked(false);
                }
            } catch (error) {
                console.error("Erro ao carregar ADM:", error);
            }

            // 2. CARREGAR VENDEDORES
            const docIdVend = `rateio_vendedores_${filter.year}_${filter.month}`;
            const docRefVend = doc(db, 'artifacts', appId, 'rateio_vendedores_config', docIdVend);

            try {
                const docSnapVend = await getDoc(docRefVend);
                
                if (docSnapVend.exists()) {
                    setManualPercents(docSnapVend.data().percents || {});
                    setIsLockedVend(true);
                } else {
                    const initialPercents = {};
                    VENDEDORES_MAP.forEach(item => {
                        initialPercents[item.cc] = 100;
                    });
                    setManualPercents(initialPercents);
                    setIsLockedVend(false);
                }
            } catch (error) {
                console.error("Erro ao carregar Vendedores:", error);
            }
        };

        loadSavedData();
        
    }, [selectedSegment, filter.month, filter.year]);

    // --- FUNÇÃO SALVAR ADM ---
    const handleSaveAdmParams = async () => {
        setIsSaving(true);
        const docId = `rateio_adm_${filter.year}_${filter.month}`;
        const docRef = doc(db, 'artifacts', appId, 'rateio_adm_config', docId);
        try {
            await setDoc(docRef, { ...admParams, updatedAt: new Date().toISOString(), user: 'system' });
            setIsLocked(true); 
        } catch (error) { alert("Erro ao salvar rateio ADM."); } 
        finally { setIsSaving(false); }
    };

    // --- FUNÇÃO SALVAR VENDEDORES ---
    const handleSaveVendedores = async () => {
        setIsSavingVend(true);
        const docId = `rateio_vendedores_${filter.year}_${filter.month}`;
        const docRef = doc(db, 'artifacts', appId, 'rateio_vendedores_config', docId);
        try {
            await setDoc(docRef, { percents: manualPercents, updatedAt: new Date().toISOString(), user: 'system' });
            setIsLockedVend(true);
        } catch (error) { alert("Erro ao salvar rateio Vendedores."); }
        finally { setIsSavingVend(false); }
    };

    // --- HELPER DE FILTRO DE DATA ---
    const filterByDate = (txs) => {
        return txs.filter(t => {
            let y, m;
            if (typeof t.date === 'string' && t.date.length >= 10) {
                y = parseInt(t.date.substring(0, 4));
                m = parseInt(t.date.substring(5, 7)) - 1; 
            } else { const d = new Date(t.date); y = d.getFullYear(); m = d.getMonth(); }
            
            if (y !== filter.year) return false;
            if (filter.type === 'month' && m !== filter.month) return false;
            if (filter.type === 'quarter' && (Math.floor(m / 3) + 1) !== filter.quarter) return false;
            if (filter.type === 'semester' && (m < 6 ? 1 : 2) !== filter.semester) return false;
            return true;
        });
    };

    // --- CÁLCULOS PRINCIPAIS ---
    const calculatedData = useMemo(() => {
        const periodTxs = filterByDate(transactions);
        
        const sumCC = (codes) => periodTxs
            .filter(t => t.type === 'expense')
            .filter(t => codes.includes(parseInt(t.costCenter.split(' ')[0])))
            .reduce((acc, t) => acc + t.value, 0);

        const listItems = (codes) => periodTxs
            .filter(t => t.type === 'expense')
            .filter(t => codes.includes(parseInt(t.costCenter.split(' ')[0])));

        // 1. Rateio Administrativo (Genérico)
        const totalAdm = sumCC([1087, 1089]);
        const itemsAdm = listItems([1087, 1089]);
        
        // 2. Produção
        const ccProd = selectedSegment === 'Portos de Areia' ? [1042] : [1043];
        const totalProd = sumCC(ccProd);
        const itemsProd = listItems(ccProd);

        // 3. Vendedores/Comercial
        const totalVend2105 = sumCC([2105, 20105]);
        const totalVend3105 = sumCC([3105]);
        const totalVend5105 = sumCC([5105]);
        const totalComercial = sumCC([1104]);

        // A. Rateio Comercial e Técnico Noromix
        let noromixComercialData = { units: [], totalProduction: 0, totalExpenses: 0, expenseItems: [] };
        let noromixTecnicoData = { units: [], totalProduction: 0, totalExpenses: 0, expenseItems: [] };
        
        if (selectedSegment === 'Noromix Concreteiras') {
            const targetUnits = [...BUSINESS_HIERARCHY["Noromix Concreteiras"], ...BUSINESS_HIERARCHY["Fábrica de Tubos"]];
            
            // --- CÁLCULO COMERCIAL (1104) ---
            const expenses1104 = periodTxs.filter(t => t.type === 'expense' && t.costCenter.startsWith('1104'));
            const totalExp1104 = expenses1104.reduce((acc, t) => acc + t.value, 0);
            
            // --- CÁLCULO TÉCNICO (1075) ---
            const expenses1075 = periodTxs.filter(t => t.type === 'expense' && t.costCenter.startsWith('1075'));
            const totalExp1075 = expenses1075.reduce((acc, t) => acc + t.value, 0);

            let grandTotalProd = 0;
            const productionMap = {};

            targetUnits.forEach(u => {
                const targetName = u.includes(':') ? u.split(':')[1].trim() : u;
                const prod = periodTxs.filter(t => {
                    if(t.type !== 'metric' || t.metricType !== 'producao') return false;
                    const txUnit = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                    return txUnit === targetName;
                }).reduce((acc, t) => acc + t.value, 0);
                
                productionMap[u] = prod;
                grandTotalProd += prod;
            });

            const buildRateioProducao = (totalExpense) => {
                const result = targetUnits.map(unitName => {
                    const prod = productionMap[unitName] || 0;
                    let percent = 0;
                    let valueToPay = 0;
                    if (grandTotalProd > 0) {
                        percent = prod / grandTotalProd;
                        valueToPay = totalExpense * percent;
                    }
                    return { name: unitName, production: prod, percent, valueToPay };
                });
                return result.sort((a,b) => b.production - a.production);
            };

            noromixComercialData = { 
                units: buildRateioProducao(totalExp1104), 
                totalProduction: grandTotalProd, 
                totalExpenses: totalExp1104, 
                expenseItems: expenses1104 
            };

            noromixTecnicoData = { 
                units: buildRateioProducao(totalExp1075), 
                totalProduction: grandTotalProd, 
                totalExpenses: totalExp1075, 
                expenseItems: expenses1075 
            };
        }

        // E. Rateio Noromix (CC 1046)
        let noromix1046Data = { units: [], totalExpenses: 0, expenseItems: [] };
        if (selectedSegment === 'Noromix Concreteiras') {
            const targetUnits = [...BUSINESS_HIERARCHY["Noromix Concreteiras"], ...BUSINESS_HIERARCHY["Fábrica de Tubos"]];
            const expenses1046 = periodTxs.filter(t => t.type === 'expense' && t.costCenter.startsWith('1046'));
            const totalExp1046 = expenses1046.reduce((acc, t) => acc + t.value, 0);
            
            const shareValue = targetUnits.length > 0 ? totalExp1046 / targetUnits.length : 0;

            const unitsCalculated = targetUnits.map(unitName => ({
                name: unitName,
                valueToPay: shareValue
            })).sort((a,b) => a.name.localeCompare(b.name));

            noromix1046Data = {
                units: unitsCalculated,
                totalExpenses: totalExp1046,
                expenseItems: expenses1046
            };
        }

        // B. Rateio Vendedores Noromix
        let noromixVendedoresData = [];
        if (selectedSegment === 'Noromix Concreteiras') {
            const targetCCs = VENDEDORES_MAP.map(m => m.cc);
            const vendorTxs = periodTxs.filter(t => targetCCs.includes(parseInt(t.costCenter.split(' ')[0])) && t.type === 'expense');

            const grouped = {};
            vendorTxs.forEach(t => {
                const cc = parseInt(t.costCenter.split(' ')[0]);
                const mapInfo = VENDEDORES_MAP.find(m => m.cc === cc);
                const unitName = mapInfo ? mapInfo.unit : 'Desconhecida';
                const key = `${cc}-${t.accountPlan}`;

                if (!grouped[key]) grouped[key] = { cc, unitName, accountCode: t.accountPlan, accountDesc: t.planDescription, originalValue: 0 };
                grouped[key].originalValue += t.value;
            });
            noromixVendedoresData = Object.values(grouped).sort((a,b) => a.cc - b.cc);
        }

        // C. Rateio ADMINISTRATIVO Noromix
        let noromixAdmData = { table: [], totalSalariosPot: 0, totalDespesasPot: 0, grandTotalVolume: 0 };
        if (selectedSegment === 'Noromix Concreteiras') {
            const concreteUnits = BUSINESS_HIERARCHY["Noromix Concreteiras"];
            const pipeUnit = BUSINESS_HIERARCHY["Fábrica de Tubos"][0];
            const allUnits = [...concreteUnits, pipeUnit];

            let volConcretoTotal = 0;
            let volGlobalTotal = 0;
            const unitVolumes = {};

            allUnits.forEach(u => {
                const targetName = u.includes(':') ? u.split(':')[1].trim() : u;
                const vol = periodTxs
                    .filter(t => {
                        if (t.type !== 'metric' || t.metricType !== 'producao') return false;
                        const txUnitName = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                        return txUnitName === targetName;
                    })
                    .reduce((acc, t) => acc + t.value, 0);
                
                unitVolumes[u] = vol;
                volGlobalTotal += vol;
                if (u !== pipeUnit) volConcretoTotal += vol;
            });

            let totalSalariosCalc = 0;
            allUnits.forEach(u => {
                const count = admParams.employees[u] || 0;
                let factor = 0;
                if (count > 0 && count <= 6) factor = 2;
                else if (count > 6 && count <= 14) factor = 4;
                else if (count >= 15) factor = 6;
                totalSalariosCalc += (factor * admParams.minWage);
            });

            const despesasPot = Math.max(0, admParams.totalValue - totalSalariosCalc - 20000);

            const table = allUnits.map(u => {
                const vol = unitVolumes[u] || 0;
                const isPipe = u === pipeUnit;
                const shortName = u.includes('-') ? u.split('-')[1].trim() : u;

                const rateioFolha = volGlobalTotal > 0 ? (totalSalariosCalc / volGlobalTotal) * vol : 0;
                let rateioDespesas = 0;
                if (isPipe) {
                    rateioDespesas = 20000; 
                } else {
                    rateioDespesas = volConcretoTotal > 0 ? (vol / volConcretoTotal) * despesasPot : 0;
                }

                return {
                    name: shortName,
                    fullName: u,
                    employees: admParams.employees[u] || 0,
                    volume: vol,
                    rateioFolha,     
                    rateioDespesas,  
                    total: rateioFolha + rateioDespesas
                };
            });
            table.sort((a,b) => b.volume - a.volume);
            noromixAdmData = { table, totalSalariosPot: totalSalariosCalc, totalDespesasPot: despesasPot + 20000, grandTotalVolume: volGlobalTotal };
        }

        // Ativas Genérico
        const targetUnitsGenerico = [...BUSINESS_HIERARCHY["Pedreiras"], ...BUSINESS_HIERARCHY["Portos de Areia"], ...BUSINESS_HIERARCHY["Usinas de Asfalto"]];
        const activeUnits = targetUnitsGenerico.filter(unit => periodTxs.filter(t => t.type === 'metric' && t.metricType === 'producao' && t.segment === unit).reduce((acc, t) => acc + t.value, 0) > 0);

        return { 
            totalAdm, itemsAdm, totalProd, itemsProd, totalVend2105, totalVend3105, totalVend5105, totalComercial, activeUnits,
            noromixComercialData, noromixTecnicoData, noromixVendedoresData, noromixAdmData, noromix1046Data
        };
    }, [transactions, filter, selectedSegment, admParams]);

    // Handlers
    const handlePercChange = (key, subKey, val) => {
        let numVal = parseFloat(val); if (numVal < 0) numVal = 0; if (numVal > 100) numVal = 100;
        if (selectedSegment === 'Noromix Concreteiras') setManualPercents(prev => ({ ...prev, [key]: numVal }));
        else setManualPercents(prev => ({ ...prev, [key]: { ...prev[key], [subKey]: numVal } }));
    };

    const handleAdmParamChange = (field, val, unit = null) => {
        if (unit) {
            setAdmParams(prev => ({ ...prev, employees: { ...prev.employees, [unit]: parseInt(val) || 0 } }));
        } else {
            setAdmParams(prev => ({ ...prev, [field]: val }));
        }
    };

    // --- RENDERIZAÇÃO ---
    const renderContent = () => {
        if (['LIMPEZA', 'PERFURATRIZ'].includes(activeRateioType)) return <div className="p-10 text-center text-slate-400 border border-dashed rounded-xl">Módulo em desenvolvimento.</div>;

        // --- TELA ADMINISTRATIVO ---
        if (activeRateioType === 'ADMINISTRATIVO') {
            if (selectedSegment === 'Noromix Concreteiras') {
                const { table, totalSalariosPot, totalDespesasPot, grandTotalVolume } = calculatedData.noromixAdmData;
                const unitsList = [...BUSINESS_HIERARCHY["Noromix Concreteiras"], ...BUSINESS_HIERARCHY["Fábrica de Tubos"]];

                return (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-6 shadow-sm relative">
                            <div className="flex justify-between items-start mb-6">
                                <h4 className="font-bold text-lg flex items-center gap-2 dark:text-white"><Settings size={20} className="text-slate-400"/> Parâmetros do Rateio (Mês Vigente)</h4>
                                <div className="flex gap-2">
                                    {isLocked ? ( <button onClick={() => setIsLocked(false)} className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg font-bold hover:bg-amber-200 transition-colors text-sm"><Edit2 size={16}/> Editar Parâmetros</button> ) : ( <button onClick={handleSaveAdmParams} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors text-sm disabled:opacity-50">{isSaving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Salvar Definições</button> )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor Total Rateio (R$)</label><CurrencyInput value={admParams.totalValue} onChange={(val) => handleAdmParamChange('totalValue', val)} disabled={isLocked} className={`w-full border p-3 rounded-lg text-lg font-bold text-indigo-600 dark:bg-slate-700 dark:text-white dark:border-slate-600 ${isLocked ? 'bg-slate-100 opacity-70' : ''}`} /></div>
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Salário Mínimo Base (R$)</label><CurrencyInput value={admParams.minWage} onChange={(val) => handleAdmParamChange('minWage', val)} disabled={isLocked} className={`w-full border p-3 rounded-lg text-lg font-bold text-slate-600 dark:bg-slate-700 dark:text-white dark:border-slate-600 ${isLocked ? 'bg-slate-100 opacity-70' : ''}`} /></div>
                                    <div className="mt-4 bg-slate-100 dark:bg-slate-900 p-4 rounded-lg space-y-2"><div className="flex justify-between text-sm"><span>Rateio Folha Adm (Cálculo 1)</span><span className="font-bold">{totalSalariosPot.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span></div><div className="flex justify-between text-sm"><span>Rateio Despesas Adm (Cálculo 2 + Fixo)</span><span className="font-bold">{totalDespesasPot.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span></div><div className="border-t border-slate-300 pt-2 flex justify-between font-bold text-indigo-600"><span>Total Validado</span><span>{(totalSalariosPot + totalDespesasPot).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span></div></div>
                                </div>
                                <div className={`bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 max-h-80 overflow-y-auto border dark:border-slate-700 ${isLocked ? 'opacity-80' : ''}`}>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-3 sticky top-0 bg-slate-50 dark:bg-slate-900/50 py-2 z-10">Qtd. Funcionários (Cálculo 1)</label>
                                    <div className="space-y-2">{unitsList.map(u => ( <div key={u} className="flex justify-between items-center text-sm"><span className="dark:text-slate-300 truncate w-48" title={u}>{u.includes('-') ? u.split('-')[1].trim() : u}</span><input type="number" min="0" disabled={isLocked} className={`w-20 p-1 text-center border rounded dark:bg-slate-700 dark:text-white ${isLocked ? 'bg-slate-100' : ''}`} value={admParams.employees[u] || 0} onChange={(e) => handleAdmParamChange('employees', e.target.value, u)} /></div> ))}</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center"><h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Calculator size={18} className="text-emerald-500"/>Resultado do Rateio Administrativo</h4><span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">Vol. Total: {grandTotalVolume.toLocaleString()} m³</span></div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left"><thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase"><tr><th className="p-3 pl-6">Unidade</th><th className="p-3 text-center">Func.</th><th className="p-3 text-right">Volume</th><th className="p-3 text-right text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20">Rateio Folha (C3)</th><th className="p-3 text-right text-amber-600 bg-amber-50 dark:bg-amber-900/20">Rateio Despesas (C2)</th><th className="p-3 text-right font-bold bg-slate-100 dark:bg-slate-800">TOTAL FINAL</th></tr></thead><tbody className="divide-y dark:divide-slate-700">
                                        {table.map((row, idx) => ( <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300"><td className="p-3 pl-6 font-medium">{row.name} {row.fullName.includes('Fábrica') && <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">FÁBRICA</span>}</td><td className="p-3 text-center text-xs">{row.employees}</td><td className="p-3 text-right font-mono text-xs opacity-70">{row.volume.toLocaleString()}</td><td className="p-3 text-right font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50/30">{row.rateioFolha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="p-3 text-right font-medium text-amber-700 dark:text-amber-400 bg-amber-50/30">{row.rateioDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="p-3 text-right font-bold bg-slate-100 dark:bg-slate-800">{row.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr> ))}
                                        <tr className="bg-slate-900 text-white font-bold"><td colSpan={3} className="p-3 pl-6 text-right uppercase text-xs tracking-wider">Totais Calculados</td><td className="p-3 text-right">{table.reduce((a,b)=>a+b.rateioFolha,0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td><td className="p-3 text-right">{table.reduce((a,b)=>a+b.rateioDespesas,0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td><td className="p-3 text-right text-emerald-400">{table.reduce((a,b)=>a+b.total,0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td></tr>
                                    </tbody></table>
                            </div>
                        </div>
                    </div>
                );
            }
            // Lógica Padrão (Portos/Pedreiras)
            const shareValue = calculatedData.totalAdm / 8;
            const unitShare = selectedSegment === 'Portos de Areia' ? shareValue / 2 : shareValue; 
            const unitsCount = selectedSegment === 'Portos de Areia' ? 2 : 6;
            return ( <div className="space-y-6 animate-in fade-in"><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-indigo-600 text-white p-6 rounded-xl shadow-lg"><p className="text-indigo-200 text-xs font-bold uppercase mb-1">Total Despesas (CC 1087/1089)</p><h3 className="text-2xl font-bold">{calculatedData.totalAdm.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</h3></div><div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm"><p className="text-slate-500 text-xs font-bold uppercase mb-1">Valor da Cota (1/8)</p><h3 className="text-2xl font-bold dark:text-white">{shareValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</h3></div><div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-xl border border-emerald-100 dark:border-emerald-800 shadow-sm"><p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase mb-1">Alocado por Unidade ({unitsCount}x)</p><h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{unitShare.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</h3></div></div></div> );
        }

        // --- TELA ENCARREGADO PRODUÇÃO ---
        if (activeRateioType === 'PRODUCAO') {
            const ccOrigem = selectedSegment === 'Portos de Areia' ? '1042' : '1043';
            const divisor = selectedSegment === 'Portos de Areia' ? 2 : 6; 
            const unitShare = calculatedData.totalProd / divisor;
            return ( <div className="space-y-6 animate-in fade-in"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg"><p className="text-blue-200 text-xs font-bold uppercase mb-1">Total Despesas (CC {ccOrigem})</p><h3 className="text-2xl font-bold">{calculatedData.totalProd.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</h3></div><div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm"><p className="text-slate-500 text-xs font-bold uppercase mb-1">Alocado por Unidade ({divisor}x)</p><h3 className="text-2xl font-bold dark:text-white">{unitShare.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</h3></div></div></div> );
        }

        // --- TELA VENDEDORES ---
        if (activeRateioType === 'VENDEDORES') {
            if (selectedSegment === 'Noromix Concreteiras') {
                const totalDemonstrativo = calculatedData.noromixVendedoresData.reduce((acc, row) => { const percConc = manualPercents[row.cc] !== undefined ? manualPercents[row.cc] : 100; const valConc = row.originalValue * (percConc / 100); return { orig: acc.orig + row.originalValue, conc: acc.conc + valConc, tubo: acc.tubo + (row.originalValue - valConc) }; }, { orig: 0, conc: 0, tubo: 0 });
                return (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center"><div><h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Settings size={18} className="text-slate-500"/>Configuração de Rateio por Centro de Custo</h4><p className="text-xs text-slate-500 mt-1">Defina a % que fica na Concreteira. O restante irá automaticamente para a Fábrica de Tubos.</p></div><div className="flex gap-2">{isLockedVend ? ( <button onClick={() => setIsLockedVend(false)} className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg font-bold hover:bg-amber-200 transition-colors text-sm"><Edit2 size={16}/> Editar</button> ) : ( <button onClick={handleSaveVendedores} disabled={isSavingVend} className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-colors text-sm disabled:opacity-50">{isSavingVend ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Salvar</button> )}</div></div>
                            <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase"><tr><th className="p-3">CC</th><th className="p-3">Unidade Padrão (Concreto)</th><th className="p-3 text-right bg-slate-100 dark:bg-slate-800 text-slate-700">Valor Total (R$)</th><th className="p-3 w-40 text-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700">% Concreto</th><th className="p-3 w-40 text-center bg-amber-50 dark:bg-amber-900/20 text-amber-700">% Tubos</th></tr></thead><tbody className="divide-y dark:divide-slate-700">{VENDEDORES_MAP.map(mapItem => { const percConc = manualPercents[mapItem.cc] !== undefined ? manualPercents[mapItem.cc] : 100; const totalCC = calculatedData.noromixVendedoresData.filter(row => row.cc === mapItem.cc).reduce((acc, row) => acc + row.originalValue, 0); return ( <tr key={mapItem.cc} className="hover:bg-slate-50 dark:hover:bg-slate-700/50"><td className="p-3 font-mono font-bold dark:text-slate-300">{mapItem.cc}</td><td className="p-3 dark:text-slate-300">{mapItem.unit.includes('-') ? mapItem.unit.split('-')[1].trim() : mapItem.unit}</td><td className="p-3 text-right font-bold text-slate-700 dark:text-slate-200 bg-slate-50/50">{totalCC.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td><td className="p-3 text-center bg-indigo-50/30"><div className="flex items-center justify-center gap-1"><input type="number" min="0" max="100" disabled={isLockedVend} value={percConc} onChange={(e) => handlePercChange(mapItem.cc, null, e.target.value)} className={`w-16 text-center border rounded p-1 dark:bg-slate-700 dark:text-white dark:border-slate-600 font-bold text-indigo-700 ${isLockedVend ? 'bg-slate-100' : ''}`} /><span className="text-indigo-400">%</span></div></td><td className="p-3 text-center bg-amber-50/30"><span className="font-bold text-amber-700 dark:text-amber-500">{(100 - percConc).toFixed(0)}%</span></td></tr> ); })}</tbody></table></div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700"><h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><FileText size={18} className="text-slate-500"/>Demonstrativo de Lançamentos (Aberto por Classe)</h4></div>
                            <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase"><tr><th className="p-3">CC Origem / Unidade</th><th className="p-3">Classe de Despesa</th><th className="p-3 text-right">Valor Original</th><th className="p-3 text-right text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20">Concreto</th><th className="p-3 text-right text-amber-600 bg-amber-50 dark:bg-amber-900/20">Tubos</th></tr></thead><tbody className="divide-y dark:divide-slate-700">
                                    <tr className="bg-slate-200 dark:bg-slate-800 font-bold border-b-2 border-slate-300 dark:border-slate-600"><td colSpan={2} className="p-3 pl-4 text-slate-800 dark:text-white">TOTAL GERAL</td><td className="p-3 text-right text-slate-900 dark:text-white">{totalDemonstrativo.orig.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td><td className="p-3 text-right text-indigo-700 dark:text-indigo-400 bg-indigo-100/50">{totalDemonstrativo.conc.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td><td className="p-3 text-right text-amber-700 dark:text-amber-400 bg-amber-100/50">{totalDemonstrativo.tubo.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td></tr>
                                    {calculatedData.noromixVendedoresData.map((row, idx) => { const percConc = manualPercents[row.cc] !== undefined ? manualPercents[row.cc] : 100; const valConcreto = row.originalValue * (percConc / 100); return ( <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300"><td className="p-3"><div className="font-bold text-slate-700 dark:text-slate-200">{row.unitName}</div><div className="text-xs font-mono text-slate-400">CC {row.cc}</div></td><td className="p-3"><div className="font-mono text-xs opacity-70">{row.accountCode}</div><div className="font-medium">{row.accountDesc}</div></td><td className="p-3 text-right font-medium">{row.originalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td className="p-3 text-right font-bold text-indigo-600 bg-indigo-50/30">{valConcreto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td className="p-3 text-right font-bold text-amber-600 bg-amber-50/30">{(row.originalValue - valConcreto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr> ); })}
                                </tbody></table></div>
                        </div>
                    </div>
                );
            }
            // Genérico
            const allUnits = [...BUSINESS_HIERARCHY['Portos de Areia'], ...BUSINESS_HIERARCHY['Pedreiras']];
            return ( <div className="space-y-6 animate-in fade-in"><div className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 mb-4 flex gap-4 text-sm"><div className="px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded">Total CC 2105: <strong>{calculatedData.totalVend2105.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</strong></div><div className="px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded">Total CC 3105: <strong>{calculatedData.totalVend3105.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</strong></div><div className="px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded">Total CC 5105: <strong>{calculatedData.totalVend5105.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</strong></div></div><div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700"><table className="w-full text-sm text-left"><thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300"><tr><th className="p-3">Unidade</th><th className="p-3 w-32">% CC 2105</th><th className="p-3 w-32">% CC 3105</th><th className="p-3 w-32">% CC 5105</th><th className="p-3 text-right bg-slate-200 dark:bg-slate-800">Total Alocado (R$)</th></tr></thead><tbody className="divide-y dark:divide-slate-700">{allUnits.sort().map(unit => { const p2105 = manualPercents[unit]?.['2105'] || 0; const p3105 = manualPercents[unit]?.['3105'] || 0; const p5105 = manualPercents[unit]?.['5105'] || 0; const totalAlocado = (calculatedData.totalVend2105 * (p2105/100)) + (calculatedData.totalVend3105 * (p3105/100)) + (calculatedData.totalVend5105 * (p5105/100)); return ( <tr key={unit} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300"><td className="p-3 font-medium">{unit}</td><td className="p-3"><div className="flex items-center"><input type="number" className="w-16 p-1 border rounded dark:bg-slate-700" value={p2105} onChange={e => handlePercChange(unit, '2105', e.target.value)} /> %</div></td><td className="p-3"><div className="flex items-center"><input type="number" className="w-16 p-1 border rounded dark:bg-slate-700" value={p3105} onChange={e => handlePercChange(unit, '3105', e.target.value)} /> %</div></td><td className="p-3"><div className="flex items-center"><input type="number" className="w-16 p-1 border rounded dark:bg-slate-700" value={p5105} onChange={e => handlePercChange(unit, '5105', e.target.value)} /> %</div></td><td className="p-3 text-right font-bold text-indigo-600 bg-slate-50 dark:bg-slate-800/50">{totalAlocado.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td></tr> ); })}</tbody></table></div></div> );
        }

        // --- TELA COMERCIAL & TÉCNICO (Reutilizam Lógica) ---
        if (activeRateioType === 'COMERCIAL' || activeRateioType === 'TECNICO') {
            if (selectedSegment === 'Noromix Concreteiras') {
                const data = activeRateioType === 'COMERCIAL' ? calculatedData.noromixComercialData : calculatedData.noromixTecnicoData;
                const { units, totalProduction, totalExpenses, expenseItems } = data;
                const ccLabel = activeRateioType === 'COMERCIAL' ? '1104' : '1075';
                const colorTheme = activeRateioType === 'COMERCIAL' ? 'rose' : 'cyan';

                return (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div className={`bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 border-${colorTheme}-500 shadow-sm`}><p className="text-xs font-bold text-slate-500 uppercase">Despesas Totais (CC {ccLabel})</p><h3 className={`text-2xl font-bold text-${colorTheme}-600 dark:text-${colorTheme}-400`}>{totalExpenses.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</h3></div>
                             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 border-indigo-500 shadow-sm"><p className="text-xs font-bold text-slate-500 uppercase">Produção Total (10 Unidades)</p><h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalProduction.toLocaleString()} <span className="text-sm font-normal text-slate-400">m³ / ton</span></h3></div>
                             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 border-emerald-500 shadow-sm"><p className="text-xs font-bold text-slate-500 uppercase">Custo Médio do Rateio</p><h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalProduction > 0 ? (totalExpenses / totalProduction).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : 'R$ 0,00'}<span className="text-sm font-normal text-slate-400"> / unidade</span></h3></div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center"><h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Factory size={18} className="text-indigo-500"/>Distribuição por Produção</h4></div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left"><thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase"><tr><th className="p-3 pl-6">Unidade</th><th className="p-3 text-right">Produção</th><th className="p-3 text-right">% Participação</th><th className="p-3 text-right">Valor a Pagar (Rateio)</th></tr></thead><tbody className="divide-y dark:divide-slate-700">
                                        {units.map((u, idx) => ( <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300"><td className="p-3 pl-6 font-medium">{u.name} {u.name.includes('Fábrica') && <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">FÁBRICA</span>}</td><td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">{u.production.toLocaleString()}</td><td className="p-3 text-right"><span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs font-bold">{(u.percent * 100).toFixed(2)}%</span></td><td className={`p-3 text-right font-bold text-${colorTheme}-600 dark:text-${colorTheme}-400`}>{u.valueToPay.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td></tr> ))}
                                        {units.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">Nenhuma produção encontrada para calcular o rateio.</td></tr>}
                                    </tbody></table>
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4">
                            <h5 className="text-xs font-bold text-slate-500 uppercase mb-3">Detalhamento das Despesas Rateadas (CC {ccLabel})</h5>
                            <div className="max-h-60 overflow-y-auto pr-2">
                                <table className="w-full text-xs text-left">
                                    <thead className="text-slate-500 font-bold bg-slate-100 dark:bg-slate-800">
                                        <tr>
                                            <th className="p-2">Data</th>
                                            <th className="p-2">Descrição</th>
                                            <th className="p-2">Classe</th> 
                                            <th className="p-2 text-right">Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {expenseItems.map((item, idx) => (
                                            <tr key={idx} className="dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                                                <td className="py-2">{formatDate(item.date)}</td>
                                                <td className="py-2 font-medium">{item.description}</td>
                                                <td className="py-2">
                                                    <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded mr-1">{item.accountPlan}</span>
                                                    <span className="font-bold text-[10px] uppercase">{item.planDescription}</span>
                                                </td>
                                                <td className="py-2 text-right font-bold">{item.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            }
            // Genérico
            const activeCount = calculatedData.activeUnits.length;
            const shareValue = activeCount > 0 ? calculatedData.totalComercial / activeCount : 0;
            return ( <div className="space-y-6 animate-in fade-in"><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-amber-500 text-white p-6 rounded-xl shadow-lg"><p className="text-amber-100 text-xs font-bold uppercase mb-1">Total Comercial (CC 1104)</p><h3 className="text-2xl font-bold">{calculatedData.totalComercial.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</h3></div><div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm"><p className="text-slate-500 text-xs font-bold uppercase mb-1">Unidades Ativas</p><h3 className="text-2xl font-bold text-slate-700 dark:text-white">{activeCount} <span className="text-sm font-normal text-slate-400">/ 14</span></h3></div><div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-xl border border-emerald-100 dark:border-emerald-800 shadow-sm"><p className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase mb-1">Alocado por Unidade Ativa</p><h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{shareValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</h3></div></div></div> );
        }

        // --- TELA NOROMIX 1046 (NOVO) ---
        if (activeRateioType === 'NOROMIX_1046') {
            const { units, totalExpenses, expenseItems } = calculatedData.noromix1046Data;
            return (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-purple-600 text-white p-6 rounded-xl shadow-lg">
                            <p className="text-purple-200 text-xs font-bold uppercase mb-1">Total Despesas (CC 1046)</p>
                            <h3 className="text-2xl font-bold">{totalExpenses.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</h3>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm">
                            <p className="text-slate-500 text-xs font-bold uppercase mb-1">Qtd. Unidades Rateadas</p>
                            <h3 className="text-2xl font-bold dark:text-white">10 <span className="text-sm font-normal text-slate-400">unidades</span></h3>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border-l-4 border-purple-500 shadow-sm">
                            <p className="text-xs font-bold text-slate-500 uppercase">Valor Fixo por Unidade</p>
                            <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">{(totalExpenses / 10).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</h3>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm">
                        <div className="p-4 bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700 flex justify-between items-center"><h4 className="font-bold text-slate-700 dark:text-white flex items-center gap-2"><Share2 size={18} className="text-purple-500"/>Distribuição Igualitária (1/10)</h4></div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left"><thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 text-xs uppercase"><tr><th className="p-3 pl-6">Unidade</th><th className="p-3 text-right">Valor a Pagar</th></tr></thead><tbody className="divide-y dark:divide-slate-700">
                                {units.map((u, idx) => ( <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-300"><td className="p-3 pl-6 font-medium">{u.name} {u.name.includes('Fábrica') && <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">FÁBRICA</span>}</td><td className="p-3 text-right font-bold text-purple-600 dark:text-purple-400">{u.valueToPay.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td></tr> ))}
                            </tbody></table>
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4">
                        <h5 className="text-xs font-bold text-slate-500 uppercase mb-3">Detalhamento das Despesas (CC 1046)</h5>
                        <div className="max-h-60 overflow-y-auto pr-2">
                            <table className="w-full text-xs text-left">
                                <thead className="text-slate-500 font-bold bg-slate-100 dark:bg-slate-800">
                                    <tr>
                                        <th className="p-2">Data</th>
                                        <th className="p-2">Descrição</th>
                                        <th className="p-2">Classe</th>
                                        <th className="p-2 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {expenseItems.map((item, idx) => (
                                        <tr key={idx} className="dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                                            <td className="py-2">{formatDate(item.date)}</td>
                                            <td className="py-2 font-medium">{item.description}</td>
                                            <td className="py-2">
                                                <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded mr-1">{item.accountPlan}</span>
                                                <span className="font-bold text-[10px] uppercase">{item.planDescription}</span>
                                            </td>
                                            <td className="py-2 text-right font-bold">{item.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            );
        }

        return <div className="p-10 text-center text-slate-400">Selecione um tipo de rateio acima.</div>;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-sm gap-4">
                <div className="flex items-center gap-2"><Share2 className="text-indigo-500" size={24}/><h3 className="font-bold text-lg dark:text-white">Painel de Rateios</h3></div>
                <div className="flex gap-2"><PeriodSelector filter={filter} setFilter={setFilter} years={years} /><select className="bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:text-white outline-none focus:ring-2 ring-indigo-500" value={selectedSegment} onChange={(e) => { setSelectedSegment(e.target.value); setActiveRateioType('ADMINISTRATIVO'); }}>{Object.keys(RATEIO_CONFIG).map(seg => <option key={seg} value={seg}>{seg}</option>)}</select></div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">{RATEIO_CONFIG[selectedSegment]?.map(type => (<button key={type.id} onClick={() => setActiveRateioType(type.id)} className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${activeRateioType === type.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border dark:border-slate-700 hover:bg-slate-50'}`}>{type.label}</button>))}</div>
            {renderContent()}
        </div>
    );
};
const InitialSelectionScreen = ({ onSelect, onLogout }) => {
    const [selectedSegment, setSelectedSegment] = useState(null);

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
            <div className="w-full max-w-4xl">
                
                {/* Cabeçalho */}
                <div className="text-center mb-10">
                    <div className="inline-flex p-4 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/30">
                        <Building2 size={40} className="text-white" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Bem-vindo ao Sistema de Custos</h1>
                    <p className="text-slate-400">Selecione o local de operação para acessar o painel</p>
                </div>

                {/* PASSO 1: SELECIONAR SEGMENTO */}
                {!selectedSegment ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Object.keys(BUSINESS_HIERARCHY).map((segment) => (
                            <button
                                key={segment}
                                onClick={() => setSelectedSegment(segment)}
                                className="group relative p-6 bg-slate-800 hover:bg-indigo-600 border border-slate-700 hover:border-indigo-500 rounded-xl transition-all duration-300 text-left shadow-lg hover:-translate-y-1"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <FolderOpen size={24} className="text-indigo-400 group-hover:text-white transition-colors" />
                                    <ChevronRight size={20} className="text-slate-600 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all" />
                                </div>
                                <h3 className="text-lg font-bold text-white">{segment}</h3>
                                <p className="text-xs text-slate-500 group-hover:text-indigo-200 mt-1">
                                    {BUSINESS_HIERARCHY[segment].length} Unidades disponíveis
                                </p>
                            </button>
                        ))}
                    </div>
                ) : (
                    /* PASSO 2: SELECIONAR UNIDADE */
                    <div className="animate-in slide-in-from-right-8 duration-300">
                        <div className="flex items-center gap-4 mb-6">
                            <button 
                                onClick={() => setSelectedSegment(null)}
                                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                            >
                                <ChevronLeft size={20} /> Voltar aos Segmentos
                            </button>
                            <span className="text-slate-600">/</span>
                            <span className="text-indigo-400 font-bold">{selectedSegment}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {BUSINESS_HIERARCHY[selectedSegment].map((unit) => (
                                <button
                                    key={unit}
                                    onClick={() => onSelect(unit)}
                                    className="p-5 bg-slate-800 hover:bg-white border border-slate-700 hover:border-slate-200 rounded-xl transition-all duration-200 text-left group flex items-center gap-4"
                                >
                                    <div className="p-3 bg-slate-900 group-hover:bg-indigo-50 rounded-lg group-hover:text-indigo-600 text-slate-400 transition-colors">
                                        <Factory size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-200 group-hover:text-slate-900 text-sm md:text-base">
                                            {unit.includes('-') ? unit.split('-')[1].trim() : unit}
                                        </h4>
                                        <p className="text-xs text-slate-500 group-hover:text-slate-500 truncate max-w-[200px]" title={unit}>
                                            {unit}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Rodapé */}
                <div className="mt-12 text-center">
                    <button onClick={onLogout} className="text-rose-500 hover:text-rose-400 text-sm flex items-center gap-2 mx-auto">
                        <LogOut size={16} /> Sair do Sistema
                    </button>
                </div>
            </div>
        </div>
    );
};
export default function App() {
  const [user, setUser] = useState({ uid: 'admin_master', email: 'admin@noromix.com.br' });
  const [userRole, setUserRole] = useState('admin');
  const [loadingAuth, setLoadingAuth] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [toast, showToast] = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  // Inicia JÁ com as unidades carregadas da memória local
const [segments, setSegments] = useState(SEED_UNITS.map(u => ({ name: u })));
  
  const [filter, setFilter] = useState({ type: 'month', month: new Date().getMonth(), year: new Date().getFullYear(), quarter: 1, semester: 1 });
  const [globalUnitFilter, setGlobalUnitFilter] = useState(null);

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  // NOVOS ESTADOS PARA A ABA LANÇAMENTOS
const [lancamentosSearch, setLancamentosSearch] = useState('');
const [lancamentosDateFilter, setLancamentosDateFilter] = useState({ start: '', end: '' });

  const [importText, setImportText] = useState('');
  const [importSegment, setImportSegment] = useState(''); 
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
      const init = async () => { await loadData(); };
      init();
  }, []);

 const loadData = async () => {
    if (!user) 
      // 1. Carregando
  if (loadingAuth) return <div className="...">...</div>;

  // 2. Não Logado -> Tela de Login
  if (!user) return (
      <>
        {/* ... código do login ... */}
        <LoginScreen onLogin={handleLogin} loading={loadingAuth} />
      </>
  );

  // 3. Logado -> App Principal  <--- ESTA É A PARTE QUE JÁ EXISTE
  return (
    <div className="min-h-screen ...">
       {/* ... resto da aplicação ... */}
    </div>
  );
      return;
    try {
        console.log("A atualizar dados...");

        // 1. Carrega Transações
        const txs = await dbService.getAll(user, 'transactions');
        setTransactions(txs);
        
        // 2. Carrega Segmentos (Unidades) com PROTEÇÃO
        try {
            const rawSegs = await dbService.getAll(user, 'segments');
            
            // Só atualiza o estado SE o banco devolver dados válidos (mais de 0)
            if (rawSegs && rawSegs.length > 0) {
                const validSegs = rawSegs.filter(item => item && item.name);
                if (validSegs.length > 0) {
                    setSegments(validSegs);
                    console.log("Unidades atualizadas via Firebase:", validSegs.length);
                }
            } else {
                console.log("Banco retornou vazio. Mantendo lista local de segurança.");
                // Não fazemos setSegments([]), mantendo o valor inicial do Passo 2
            }
        } catch (err) {
            console.warn("Erro ao ler segmentos do banco. Mantendo local.", err);
        }

        setSelectedIds([]);
    } catch (e) { 
        console.error("Erro geral no loadData:", e);
        showToast("Erro ao carregar dados.", 'error'); 
    }
  };

  // Função de Emergência para Repopular o Banco
  const handleSystemRestore = async () => {
      if (!confirm("Isso vai recriar todas as Unidades e Segmentos no banco de dados. Confirmar?")) return;
      
      setIsProcessing(true);
      try {
          // 1. Recriar Unidades (Segments)
          // SEED_UNITS vem da configuração lá em cima do arquivo
          const segmentsBatch = SEED_UNITS.map(unitName => ({
              name: unitName,
              createdAt: new Date().toISOString(),
              source: 'system_restore'
          }));

          await dbService.addBulk(user, 'segments', segmentsBatch);
          
          showToast("Unidades restauradas com sucesso!", 'success');
          await loadData(); // Recarrega a tela
      } catch (e) {
          console.error(e);
          showToast("Erro ao restaurar: " + e.message, 'error');
      } finally {
          setIsProcessing(false);
      }
  };

  const handleLogout = async () => { 
      try {
          await signOut(auth); // Desconecta do Firebase
          setUser(null);       // Limpa estado local
          setUserRole(null);
          showToast("Sessão encerrada com sucesso.", 'success');
      } catch (error) {
          console.error(error);
          showToast("Erro ao sair.", 'error');
      }
  };

  const handleImport = async (data) => {
    setIsProcessing(true);
    try { 
        await dbService.addBulk(user, 'transactions', data); 
        await loadData(); showToast(`${data.length} importados!`, 'success'); 
    } catch(e) { showToast("Erro ao importar.", 'error'); } 
    finally { setIsProcessing(false); }
  };
  
  const handleFileUpload = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (evt) => setImportText(evt.target.result); reader.readAsText(file); };

  const handleSelectAll = (e) => { if (e.target.checked) { setSelectedIds(filteredData.map(t => t.id)); } else { setSelectedIds([]); } };
  const handleSelectOne = (id) => { setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };
  const handleBatchDelete = async () => { if (!confirm(`Tem certeza que deseja excluir ${selectedIds.length} lançamentos?`)) return; try { await dbService.deleteBulk(user, 'transactions', selectedIds); await loadData(); showToast(`${selectedIds.length} itens excluídos.`, 'success'); } catch (e) { showToast("Erro ao excluir.", 'error'); } };

const filteredData = useMemo(() => {
      return transactions.filter(t => {
          let y, m;
          if (typeof t.date === 'string' && t.date.length >= 10) {
              y = parseInt(t.date.substring(0, 4));
              m = parseInt(t.date.substring(5, 7)) - 1; 
          } else {
              const d = new Date(t.date);
              y = d.getFullYear();
              m = d.getMonth();
          }
          
          const dateMatch = (() => {
              // REMOVIDA A LINHA: if (activeTab === 'lancamentos') return true; 
              // Agora o filtro global aplica-se a todas as abas, inclusive lançamentos
              if (y !== filter.year) return false;
              if (filter.type === 'month' && m !== filter.month) return false;
              if (filter.type === 'quarter' && (Math.floor(m / 3) + 1) !== filter.quarter) return false;
              if (filter.type === 'semester' && (m < 6 ? 1 : 2) !== filter.semester) return false;
              return true;
          })();

          if (!dateMatch) return false;
          
          if (globalUnitFilter !== 'ALL') {
              if (BUSINESS_HIERARCHY[globalUnitFilter]) {
                 const cleanSegmentName = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                 const isInSegment = BUSINESS_HIERARCHY[globalUnitFilter].some(u => u.includes(cleanSegmentName));
                 return isInSegment;
              } else {
                  const txUnit = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                  const filterUnit = globalUnitFilter.includes(':') ? globalUnitFilter.split(':')[1].trim() : globalUnitFilter;
                  return txUnit === filterUnit;
              }
          }
          return true;
      });
  }, [transactions, filter, globalUnitFilter, activeTab]);

  // 2. NOVO DADO APENAS PARA O ESTOQUE (Carrega o ano todo para cálculo de saldo)
const stockDataRaw = useMemo(() => {
    return transactions.filter(t => {
        let y;
        if (typeof t.date === 'string' && t.date.length >= 10) {
            y = parseInt(t.date.substring(0, 4));
        } else {
            y = new Date(t.date).getFullYear();
        }
        
        // APENAS FILTRO DE ANO E UNIDADE (Ignora mês)
        if (y !== filter.year) return false;

        if (globalUnitFilter !== 'ALL') {
            if (BUSINESS_HIERARCHY[globalUnitFilter]) {
                const cleanSegmentName = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                return BUSINESS_HIERARCHY[globalUnitFilter].some(u => u.includes(cleanSegmentName));
            } else {
                const txUnit = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                const filterUnit = globalUnitFilter.includes(':') ? globalUnitFilter.split(':')[1].trim() : globalUnitFilter;
                return txUnit === filterUnit;
            }
        }
        return true;
    });
}, [transactions, filter.year, globalUnitFilter]);

  const kpis = useMemo(() => {
      const rev = filteredData.filter(t => t.type === 'revenue').reduce((acc, t) => acc + t.value, 0);
      const exp = filteredData.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.value, 0);
      return { revenue: rev, expense: exp, balance: rev - exp };
  }, [filteredData]);

  const currentMeasureUnit = getMeasureUnit(globalUnitFilter);
  
// --- CÁLCULOS GERAIS PARA O DASHBOARD ---
  const totalProduction = useMemo(() => {
      return filteredData
        .filter(t => t.type === 'metric' && t.metricType === 'producao')
        .reduce((acc, t) => acc + t.value, 0);
  }, [filteredData]);

  // CÁLCULO DE ESTOQUE TOTAL PARA O DASHBOARD
  const totalStockPeriod = useMemo(() => {
      return filteredData
        .filter(t => t.type === 'metric' && t.metricType === 'estoque')
        .reduce((acc, t) => acc + t.value, 0);
  }, [filteredData]);

  const totalSales = useMemo(() => {
      return filteredData
        .filter(t => t.type === 'metric' && t.metricType === 'vendas')
        .reduce((acc, t) => acc + t.value, 0);
  }, [filteredData]);

  const costPerUnit = totalProduction > 0 ? kpis.expense / totalProduction : 0;
  
  // Novos KPIs
  const resultMargin = kpis.revenue > 0 ? (kpis.balance / kpis.revenue) * 100 : 0;
  const resultPerSalesUnit = totalSales > 0 ? kpis.balance / totalSales : 0;

  if (loadingAuth) return <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex justify-center items-center"><Loader2 className="animate-spin text-indigo-600" size={48}/></div>;

  // --- CÁLCULOS DE VARIAÇÃO (MÊS ANTERIOR) ---
  const variations = useMemo(() => {
      // 1. Determinar qual é o "mês passado" com base no filtro atual
      let prevMonth = filter.month - 1;
      let prevYear = filter.year;
      
      if (prevMonth < 0) {
          prevMonth = 11; // Dezembro
          prevYear -= 1;
      }

      // 2. Filtrar transações do período anterior (respeitando o filtro de unidade global)
      const prevData = transactions.filter(t => {
          let y, m;
          // Parse seguro de data igual ao filteredData
          if (typeof t.date === 'string' && t.date.length >= 10) {
              y = parseInt(t.date.substring(0, 4));
              m = parseInt(t.date.substring(5, 7)) - 1; 
          } else {
              const d = new Date(t.date);
              y = d.getFullYear();
              m = d.getMonth();
          }

          // Filtro de Data Anterior
          const isDateMatch = (filter.type === 'month') 
            ? (y === prevYear && m === prevMonth)
            : false; // Se não for filtro mensal, não calcula variação por enquanto

          // Filtro de Unidade (O mesmo do filtro principal)
          if (!isDateMatch) return false;

          if (globalUnitFilter !== 'ALL') {
              if (BUSINESS_HIERARCHY[globalUnitFilter]) {
                 const cleanSegmentName = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                 return BUSINESS_HIERARCHY[globalUnitFilter].some(u => u.includes(cleanSegmentName));
              } else {
                  const txUnit = t.segment.includes(':') ? t.segment.split(':')[1].trim() : t.segment;
                  const filterUnit = globalUnitFilter.includes(':') ? globalUnitFilter.split(':')[1].trim() : globalUnitFilter;
                  return txUnit === filterUnit;
              }
          }
          return true;
      });

      // 3. Calcular Totais do Mês Anterior
      const prevRevenue = prevData.filter(t => t.type === 'revenue').reduce((acc, t) => acc + t.value, 0);
      const prevExpense = prevData.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.value, 0);
      const prevBalance = prevRevenue - prevExpense;
      const prevProduction = prevData.filter(t => t.type === 'metric' && t.metricType === 'producao').reduce((acc, t) => acc + t.value, 0);
      const prevCostPerUnit = prevProduction > 0 ? prevExpense / prevProduction : 0;

      // 4. Função auxiliar para calcular % de variação
      const calcVar = (curr, prev) => {
          if (!prev || prev === 0) return 0;
          return ((curr - prev) / prev) * 100;
      };

      return {
          revenue: calcVar(kpis.revenue, prevRevenue),
          expense: calcVar(kpis.expense, prevExpense),
          balance: calcVar(kpis.balance, prevBalance),
          costPerUnit: calcVar(costPerUnit, prevCostPerUnit)
      };
  }, [transactions, filter, globalUnitFilter, kpis, costPerUnit]);
  
 return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex font-sans text-slate-900 dark:text-slate-100 transition-colors">
      {toast && <div className={`fixed top-4 right-4 z-50 p-4 rounded shadow-xl flex gap-2 ${toast.type==='success'?'bg-emerald-500 text-white':'bg-rose-500 text-white'}`}>{toast.type==='success'?<CheckCircle/>:<AlertTriangle/>}{toast.message}</div>}
      
      {/* SUBSTITUA O ASIDE INTEIRO POR ESTE BLOCO */}
<aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 dark:bg-slate-950 text-white flex flex-col sticky top-0 h-screen hidden md:flex border-r border-slate-800 transition-all duration-300`}>
    
    {/* LOGO E TOGGLE */}
    <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center w-full'}`}>
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
                <Building2 size={18} />
            </div>
            {sidebarOpen && <span className="text-xl font-bold whitespace-nowrap overflow-hidden">Custos</span>}
        </div>
        {/* Botão de Minimizar (Só aparece se aberto, ou ajuste conforme preferência) */}
        {sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white">
                <ChevronLeft size={20} />
            </button>
        )}
    </div>

    {/* Se estiver fechado, botão para abrir fica no topo da lista ou centralizado */}
    {!sidebarOpen && (
        <div className="flex justify-center py-2">
            <button onClick={() => setSidebarOpen(true)} className="text-slate-400 hover:text-white">
                <ChevronRight size={20} />
            </button>
        </div>
    )}

    {/* NAVEGAÇÃO */}
    <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden">
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
        ].map((item) => (
            <button 
                key={item.id}
                onClick={() => setActiveTab(item.id)} 
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${!sidebarOpen ? 'justify-center' : ''} ${activeTab === item.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
                title={!sidebarOpen ? item.label : ''}
            >
                <item.icon size={20} className="shrink-0" />
                {sidebarOpen && <span className="whitespace-nowrap overflow-hidden">{item.label}</span>}
            </button>
        ))}
    </nav>

    {/* --- NOVOS BOTÕES MOVIDOS (IA, TEMA, LOGOUT) --- */}
    <div className={`p-4 border-t border-slate-800 flex ${sidebarOpen ? 'flex-row justify-around' : 'flex-col gap-4 items-center'}`}>
            <button onClick={() => setShowAIModal(true)} className="p-2 text-purple-400 hover:bg-slate-800 rounded-lg transition-colors" title="IA Analysis"><Sparkles size={20} /></button>
            
            {/* NOVO BOTÃO DE RESTAURO (Apenas para Admin) */}
            {userRole === 'admin' && (
                <button onClick={handleSystemRestore} className="p-2 text-amber-400 hover:bg-slate-800 rounded-lg transition-colors" title="Restaurar Banco de Dados">
                    <Database size={20} /> 
                    {/* Nota: Se der erro no icone Database, use outro como RefreshCw ou importe Database de lucide-react */}
                </button>
            )}

            <button onClick={toggleTheme} className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg transition-colors" title="Mudar Tema">{theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}</button>
            <button onClick={handleLogout} className="p-2 text-rose-400 hover:bg-slate-800 rounded-lg transition-colors" title="Sair"><LogOut size={20} /></button>
        </div>

    {/* PERFIL DO USUÁRIO */}
    <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className={`flex items-center gap-3 ${!sidebarOpen ? 'justify-center' : ''}`}>
            <div className="p-1 bg-slate-800 rounded shrink-0">
                <UserCircle size={20} className="text-slate-400"/>
            </div>
            {sidebarOpen && (
                <div className="flex-1 min-w-0">
                    <p className="truncate font-bold text-sm text-white">{user.email.split('@')[0]}</p>
                    <p className="text-xs uppercase tracking-wider text-indigo-400">{userRole}</p>
                </div>
            )}
        </div>
    </div>
</aside>

      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
<header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
    {!['global', 'rateios', 'users'].includes(activeTab) ? (
        <div className="flex gap-2 w-full md:w-auto items-center flex-wrap">
            {/* Seletor de Período Mantido */}
            <PeriodSelector filter={filter} setFilter={setFilter} years={[2024, 2025]} />
            
            {/* Display da Unidade Atual + Botão de Trocar */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border dark:border-slate-700 p-1 pl-3 rounded-lg shadow-sm">
                <span className="text-sm font-bold truncate max-w-[200px]" title={globalUnitFilter}>
                    {globalUnitFilter.includes('-') ? globalUnitFilter.split('-')[1].trim() : globalUnitFilter}
                </span>
                <button 
                    onClick={() => setGlobalUnitFilter(null)} // Isto faz voltar ao menu inicial
                    className="p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition-colors text-slate-500 dark:text-slate-300"
                    title="Trocar Unidade"
                >
                    <FolderOpen size={16} />
                </button>
            </div>
        </div>
    ) : <div></div>}
</header>
        
{activeTab === 'global' && <GlobalComponent transactions={transactions} filter={filter} setFilter={setFilter} years={[2024, 2025]} />}
{activeTab === 'rateios' && <RateiosComponent transactions={transactions} filter={filter} setFilter={setFilter} years={[2024, 2025]} />}
{activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* LINHA 1: FINANCEIRO PRINCIPAL + CUSTO P/ TON COM VARIAÇÃO */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard 
                title="Receita Bruta" 
                value={kpis.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
                icon={TrendingUp} 
                color="emerald" 
                trend={variations.revenue} 
              />
              <KpiCard 
                title="Despesas Totais" 
                value={kpis.expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
                icon={TrendingDown} 
                color="rose" 
                trend={variations.expense} 
                reverseColor={true} 
              />
              <KpiCard 
                title="Resultado Líquido" 
                value={kpis.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
                icon={DollarSign} 
                color={kpis.balance >= 0 ? 'indigo' : 'rose'} 
                trend={variations.balance} 
              />
              
              <KpiCard 
                title={`Custo / ${currentMeasureUnit}`}
                value={costPerUnit.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                icon={Factory}
                color="rose" 
                trend={variations.costPerUnit}
                reverseColor={true} 
              />
            </div>

            {/* LINHA 2: OPERACIONAL E MARGENS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Margem */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
                 <p className="text-xs font-bold text-slate-500 uppercase mb-1">Margem Líquida</p>
                 <div className="flex items-end gap-2">
                    <h3 className={`text-3xl font-bold ${resultMargin >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{resultMargin.toFixed(1)}%</h3>
                 </div>
              </div>

              {/* Produção */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Produção Total</p>
                        <h3 className="text-2xl font-bold dark:text-white mt-2">{totalProduction.toLocaleString()} <span className="text-sm font-normal text-slate-400">{currentMeasureUnit}</span></h3>
                    </div>
                    <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Factory size={20}/></div>
                  </div>
              </div>

              {/* Vendas */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Vendas Totais</p>
                        <h3 className="text-2xl font-bold dark:text-white mt-2">{totalSales.toLocaleString()} <span className="text-sm font-normal text-slate-400">{currentMeasureUnit}</span></h3>
                    </div>
                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><ShoppingCart size={20}/></div>
                  </div>
              </div>

              {/* Estoque */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Estoque (Fechamento)</p>
                        <h3 className="text-2xl font-bold dark:text-white mt-2">{totalStockPeriod.toLocaleString()} <span className="text-sm font-normal text-slate-400">{currentMeasureUnit}</span></h3>
                    </div>
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Package size={20}/></div>
                  </div>
              </div>
            </div>

            {/* GRÁFICO */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm h-96 border dark:border-slate-700">
              <h3 className="mb-6 font-bold text-lg dark:text-white flex items-center gap-2"><BarChartIcon size={20}/> Performance Financeira do Período</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ name: 'Performance', Receitas: kpis.revenue, Despesas: kpis.expense, Resultado: kpis.balance }]} barSize={80}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" tick={false} />
                    <YAxis tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`} />
                    <Tooltip 
                        cursor={{fill: 'transparent'}}
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }} 
                        formatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    />
                    <Legend wrapperStyle={{paddingTop: '20px'}}/>
                    <Bar name="Receitas" dataKey="Receitas" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar name="Despesas" dataKey="Despesas" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                    <Bar name="Resultado" dataKey="Resultado" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      {activeTab === 'lancamentos' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border dark:border-slate-700">
             <div className="p-6 border-b dark:border-slate-700 flex flex-col gap-4">
                 
                 {/* CABEÇALHO */}
                 <div className="flex justify-between items-center">
                    <div className="flex gap-4 items-center">
                        <h3 className="font-bold text-lg dark:text-white">Lançamentos do Período</h3>
                        {selectedIds.length > 0 && userRole === 'admin' && (
                            <button onClick={handleBatchDelete} className="bg-rose-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-rose-700 transition-colors">
                                Excluir ({selectedIds.length})
                            </button>
                        )}
                    </div>
                    {['admin', 'editor'].includes(userRole) && <button onClick={() => {setEditingTx(null); setShowEntryModal(true);}} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><PlusCircle size={18} /> Novo Lançamento</button>}
                 </div>

                 {/* APENAS BARRA DE PESQUISA (Data agora é no topo da página) */}
                 <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border dark:border-slate-700">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-3 text-slate-400" size={16}/>
                        <input 
                            type="text" 
                            placeholder="Pesquisar neste período (Descrição, Conta ou Valor)..." 
                            className="w-full pl-10 pr-4 py-2 rounded-lg border dark:border-slate-600 dark:bg-slate-800 dark:text-white text-sm outline-none focus:ring-2 ring-indigo-500"
                            value={lancamentosSearch}
                            onChange={(e) => setLancamentosSearch(e.target.value)}
                        />
                    </div>
                 </div>
             </div>

             <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                     <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                          <tr>
                             <th className="p-4 w-10"><input type="checkbox" onChange={handleSelectAll} checked={selectedIds.length === filteredData.length && filteredData.length > 0} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /></th>
                             <th className="p-4">Data</th>
                             <th className="p-4">Descrição</th>
                             <th className="p-4">Unidade</th>
                             <th className="p-4">Conta/Tipo</th>
                             <th className="p-4 text-right">Valor</th>
                             <th className="p-4">Ações</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y dark:divide-slate-700">
                         {filteredData.filter(t => {
    // Lógica de filtro (MANTIDA)
    const searchLower = lancamentosSearch.toLowerCase();
    const matchesSearch = !lancamentosSearch || 
        t.description.toLowerCase().includes(searchLower) ||
        (t.accountPlan && t.accountPlan.toLowerCase().includes(searchLower)) || // Proteção extra aqui
        t.value.toString().includes(searchLower);
    
    return matchesSearch;
}).map(t => (
    <tr key={t.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${selectedIds.includes(t.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
        
        {/* 1. CHECKBOX */}
        <td className="p-4"><input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => handleSelectOne(t.id)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /></td>
        
        {/* 2. DATA */}
        <td className="p-4 dark:text-white">{formatDate(t.date)}</td>
        
        {/* 3. DESCRIÇÃO */}
        <td className="p-4 dark:text-white">
            {t.description}
            {t.materialDescription && <span className="block text-[10px] text-slate-500 italic">{t.materialDescription}</span>}
        </td>
        
        {/* 4. UNIDADE */}
        <td className="p-4 text-xs dark:text-slate-300">{t.segment.includes(':') ? t.segment.split(':')[1] : t.segment}</td>
        
        {/* 5. CONTA/TIPO (NOVO ESTILO) */}
        <td className="p-4">
            {(() => {
                const baseStyle = "px-2 py-1 rounded border font-bold text-[10px] uppercase inline-block max-w-[200px] truncate";

                if (t.type === 'metric') {
                    return (
                        <span className={`${baseStyle} bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-700`}>
                            {t.metricType}
                        </span>
                    );
                }

                const label = t.planDescription || t.accountPlan;
                const colorStyle = t.type === 'revenue' 
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' 
                    : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600';

                return (
                    <span className={`${baseStyle} ${colorStyle}`} title={label}>
                        {label}
                    </span>
                );
            })()}
        </td>

        {/* 6. VALOR (O que estava faltando) */}
        <td className={`p-4 text-right font-bold ${t.type==='revenue'?'text-emerald-500':(t.type==='expense'?'text-rose-500':'text-indigo-500')}`}>
            {t.value.toLocaleString()}
        </td>

        {/* 7. AÇÕES (O que estava faltando) */}
        <td className="p-4 flex gap-2">
            {['admin', 'editor'].includes(userRole) && (
                <button onClick={()=>{setEditingTx(t); setShowEntryModal(true);}} className="text-blue-500 hover:text-blue-700 transition-colors">
                    <Edit2 size={16}/>
                </button>
            )}
        </td>
    </tr>
))}
                      </tbody>
                 </table>
             </div>
          </div>
        )}
        {activeTab === 'custos' && (
    <CustosComponent 
        transactions={filteredData} 
        allTransactions={transactions} // <--- NOVO: Passa tudo para calculos globais
        filter={filter}                // <--- NOVO: Para saber o mês do rateio salvo
        selectedUnit={globalUnitFilter}// <--- NOVO: Para filtrar os rateios gerados
        showToast={showToast} 
        measureUnit={currentMeasureUnit} 
        totalProduction={totalProduction} 
    />
)}
        {activeTab === 'fechamento' && <FechamentoComponent transactions={filteredData} totalSales={totalSales} totalProduction={totalProduction} measureUnit={currentMeasureUnit} filter={filter} selectedUnit={globalUnitFilter} />}
        {/* Passando globalCostPerUnit para o componente de estoque */}
        {activeTab === 'estoque' && <StockComponent transactions={filteredData} measureUnit={currentMeasureUnit} globalCostPerUnit={costPerUnit} />}
        {activeTab === 'producao' && <ProductionComponent transactions={filteredData} measureUnit={currentMeasureUnit} />}
        {activeTab === 'users' && <UsersScreen user={user} myRole={userRole} showToast={showToast} />}
        {activeTab === 'ingestion' && <AutomaticImportComponent onImport={handleImport} isProcessing={isProcessing} />}
        {activeTab === 'investimentos_report' && (<InvestimentosReportComponent transactions={filteredData} filter={filter} selectedUnit={globalUnitFilter} />)}
        
      </main>

      {showEntryModal && user && <ManualEntryModal onClose={() => setShowEntryModal(false)} segments={segments} onSave={loadData} user={user} initialData={editingTx} showToast={showToast} />}
      {showAIModal && user && <AIReportModal onClose={() => setShowAIModal(false)} transactions={filteredData} period={`${filter.month+1}/${filter.year}`} />}
    </div>
  );
}
