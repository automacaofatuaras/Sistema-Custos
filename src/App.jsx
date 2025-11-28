import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  LayoutDashboard, UploadCloud, TrendingUp, TrendingDown, 
  DollarSign, Trash2, Building2, PlusCircle, Settings, Edit2, 
  Save, X, Calendar, Loader2, List, FileUp, LogOut, UserCircle, 
  Users, Sun, Moon, Lock, Sparkles, FileText, Download, Globe, 
  AlertTriangle, CheckCircle, Zap, ChevronRight, ChevronDown, Printer,
  BarChart3 as BarChartIcon, Folder, FolderOpen, Package, Factory, ShoppingCart, Search
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { initializeApp, getApp, getApps } from 'firebase/app';
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
const GEMINI_API_KEY = "SUA_KEY_GEMINI"; 

// Inicialização do Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const appId = 'financial-saas-production';

// --- DADOS DE INICIALIZAÇÃO ---
const BUSINESS_HIERARCHY = {
    "Portos de Areia": ["Porto de Areia Saara - Mira Estrela", "Porto Agua Amarela - Riolândia"],
    "Noromix Concreteiras": ["Noromix Concreto S/A - Fernandópolis", "Noromix Concreto S/A - Ilha Solteira", "Noromix Concreto S/A - Jales", "Noromix Concreto S/A - Ouroeste", "Noromix Concreto S/A - Paranaíba", "Noromix Concreto S/A - Monções", "Noromix Concreto S/A - Pereira Barreto", "Noromix Concreto S/A - Três Fronteiras", "Noromix Concreto S/A - Votuporanga"],
    "Fábrica de Tubos": ["Noromix Concreto S/A - Votuporanga (Fábrica)"],
    "Pedreiras": ["Mineração Grandes Lagos - Icém", "Mineração Grandes Lagos - Itapura", "Mineração Grandes Lagos - Riolândia", "Mineração Grandes Lagos - Três Fronteiras", "Noromix Concreto S/A - Rinópolis", "Mineração Noroeste Paulista - Monções"],
    "Usinas de Asfalto": ["Noromix Concreto S/A - Assis", "Noromix Concreto S/A - Monções (Usina)", "Noromix Concreto S/A - Itapura (Usina)", "Noromix Concreto S/A - Rinópolis (Usina)", "Demop Participações LTDA - Três Fronteiras", "Mineração Grandes Lagos - Icém (Usina)"],
    "Construtora": ["Noromix Construtora"]
};

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

const PLANO_CONTAS = [
    // --- OPÇÃO DE SISTEMA ---
    { code: '00.00', name: '00.00 - Lançamento Manual / Ajuste' },

    // --- 01. RECEITAS ---
    { code: '01.01.01.01.0006', name: 'AREIA' },
    { code: '01.01.01.01.0008', name: 'CONCRETO' },
    { code: '01.01.01.01.0005', name: 'CREDITO DE CLIENTES' },
    { code: '01.01.01.01.0003', name: 'MASSA ASFALTICA' },
    { code: '01.01.01.01.0004', name: 'PEDRAS BRITADAS' },
    { code: '01.01.01.01.0007', name: 'PRE-MOLDADOS' },
    { code: '01.02.01.01.0001', name: 'PRESTACAO DE SERVICOS - OBRAS' },

    // --- 02. DEDUÇÕES ---
    { code: '02.01.01.01.0005', name: 'CFEM' },
    { code: '02.01.01.01.0001', name: 'COFINS' },
    { code: '02.01.01.01.0002', name: 'ICMS' },
    { code: '02.01.01.01.0004', name: 'IPI' },
    { code: '02.01.01.01.0003', name: 'PIS' },
    { code: '02.01.01.01.0006', name: 'SUBSTITUICAO TRIBUTARIA' },
    { code: '02.01.01.02.0007', name: 'CPRB-CONTRIB PREVID RECEITA BRUTA' },
    { code: '02.01.01.02.0008', name: 'INSS S/SERVICOS PRESTADOS' },
    { code: '02.01.01.02.0009', name: 'ISSQN S/SERVICOS PRESTADOS' },

    // --- 03. CUSTOS - MÃO DE OBRA ---
    { code: '03.01.01.01.0001', name: 'FGTS' },
    { code: '03.01.01.01.0005', name: 'FGTS-10% MULTA RESCISORIA' },
    { code: '03.01.01.01.0013', name: 'FGTS-RESCISAO 20%' },
    { code: '03.01.01.01.0003', name: 'FGTS-RESCISAO 40%' },
    { code: '03.01.01.01.0002', name: 'INSS' },
    { code: '03.01.01.01.0009', name: 'INSS (SISTEMAS)' },
    { code: '03.01.01.01.0007', name: 'INSS - RECLAMATORIA TRABALHISTA' },
    { code: '03.01.01.01.0006', name: 'INSS-SEGURADO' },
    { code: '03.01.01.01.0010', name: 'IRRF-RECLAMATORIA TRABALHISTA' },
    { code: '03.01.01.01.0011', name: 'IRRF S/ FOLHA' },
    { code: '03.01.01.01.0012', name: 'MULTA FISCALIZACAO TRABALHISTA' },
    { code: '03.01.01.02.0001', name: '13° SALARIOS' },
    { code: '03.01.01.02.0006', name: 'CONTRIB CONFED ASSIST' },
    { code: '03.01.01.02.0009', name: 'CONTRIB. SINDICAL (ANUAL)' },
    { code: '03.01.01.02.0005', name: 'DEPOSITO JUDICIAL' },
    { code: '03.01.01.02.0002', name: 'FERIAS' },
    { code: '03.01.01.02.0013', name: 'INDENIZACAO P/ACAO TRABALHISTA' },
    { code: '03.01.01.02.0004', name: 'ORDENADOS' },
    { code: '03.01.01.02.0015', name: 'PLR (PARTICIPACAO LUCROS E RESULTADOS)' },
    { code: '03.01.01.02.0018', name: 'VALE TRANSPORTE' },
    { code: '03.01.01.02.0003', name: 'VERBAS RESCISORIAS' },
    { code: '03.01.01.03.0003', name: 'CAFE DA MANHA' },
    { code: '03.01.01.03.0001', name: 'CESTA BASICA' },
    { code: '03.01.01.03.0004', name: 'DESPESAS DE VIAGENS E HOSPEDAGENS' },
    { code: '03.01.01.03.0002', name: 'REFEICAO E LANCHES' },
    { code: '03.01.01.04.0002', name: 'UNIFORMES' },
    { code: '03.01.01.04.0001', name: 'EPIs' },
    { code: '03.01.01.05.0001', name: 'SEGURO DE VIDA' },
    { code: '03.01.01.05.0003', name: 'SEGURO SAUDE' },

    // --- 03. CUSTOS - SERVIÇOS TERCEIROS ---
    { code: '03.01.01.07.0005', name: 'AGUA POTAVEL - SERV.TERCEIROS' },
    { code: '03.01.01.07.0002', name: 'DRENAGEM - SERV.TERCEIROS' },
    { code: '03.01.01.07.0012', name: 'ENSAIOS TECNOLOG. SERV. TERCEIROS' },
    { code: '03.01.01.07.0006', name: 'ESGOTO-SERV. TERCEIROS' },
    { code: '03.01.01.07.0013', name: 'ILUMINACAO - SERV. TERCEIROS' },
    { code: '03.01.01.07.0004', name: 'OUTROS SERVICOS-SERV.TERCEIROS' },
    { code: '03.01.01.07.0003', name: 'PAV. ASFALTICA-SERV.TERCEIROS' },
    { code: '03.01.01.07.0011', name: 'REDE ELETRICA - SERV. TERCEIROS' },
    { code: '03.01.01.07.0007', name: 'SINALIZACAO - SERV. TERCEIROS' },
    { code: '03.01.01.07.0001', name: 'TERRAPLANAGEM-SERV.TERCEIROS' },
    { code: '03.01.01.08.0004', name: 'CIVIL-ALVENARIA-SERV TERC' },
    { code: '03.01.01.08.0013', name: 'CIVIL-INSTAL.ELETRICAS-SERV TERC' },
    { code: '03.01.01.08.0015', name: 'CIVIL-INSTAL.HIDROSSANIT/GAS-SERV TERC' },
    { code: '03.01.01.08.0019', name: 'CIVIL-PINTURA-SERV TERC' },
    { code: '03.01.01.09.0001', name: 'PRO LABORE' },
    { code: '03.01.01.10.0001', name: 'BOMBEAMENTO DE CONCRETO' },
    { code: '03.01.01.10.0005', name: 'ENGENHARIA E TOPOGRAFIA' },
    { code: '03.01.01.10.0003', name: 'SERVICOS DE TERCEIROS' },
    { code: '03.01.01.10.0007', name: 'SERVICOS DE TERCEIROS (EQUIPAMENTOS)' },
    { code: '03.01.01.10.0002', name: 'SERVICOS DE TERCEIROS (FROTA E MAQ)' },
    { code: '03.01.01.10.0008', name: 'VIGILANCIA' },

    // --- 03. CUSTOS - MATERIAIS ---
    { code: '03.02.01.01.0028', name: 'ADITIVO' },
    { code: '03.02.01.01.0011', name: 'CAP' },
    { code: '03.02.01.01.0012', name: 'CM 30' },
    { code: '03.02.01.01.0026', name: 'CM IMPRIMA' },
    { code: '03.02.01.01.0009', name: 'EMULSAO' },
    { code: '03.02.01.01.0027', name: 'MASSA ASFALTICA - CBUQ' },
    { code: '03.02.01.01.0014', name: 'OLEO DIESEL' },
    { code: '03.02.01.01.0006', name: 'PEDRAS E AREIAS' },
    { code: '03.02.01.02.0038', name: 'AGLOMERANTE' },
    { code: '03.02.01.02.0044', name: 'AGUA POTAVEL - MAT. APLICADO' },
    { code: '03.02.01.02.0025', name: 'AREIA FINA GRANEL' },
    { code: '03.02.01.02.0026', name: 'AREIA GROSSA GRANEL' },
    { code: '03.02.01.02.0012', name: 'CIMENTO' },
    { code: '03.02.01.02.0001', name: 'COMBUSTIVEL' },
    { code: '03.02.01.02.0013', name: 'CONCRETO' },
    { code: '03.02.01.02.0058', name: 'CORREIAS TRANSPORTADORAS' },
    { code: '03.02.01.02.0003', name: 'EXPLOSIVOS' },
    { code: '03.02.01.02.0004', name: 'FERRAMENTAS' },
    { code: '03.02.01.02.0017', name: 'FERRO' },
    { code: '03.02.01.02.0009', name: 'LUBRIFICANTES' },
    { code: '03.02.01.02.0016', name: 'MADEIRA' },
    { code: '03.02.01.02.0007', name: 'MATERIAL APLICADO / OBRA' },
    { code: '03.02.01.02.0054', name: 'MATERIAL DE SEGURANCA E PROTECAO' },
    { code: '03.02.01.02.0008', name: 'MATERIAL DE USO E CONSUMO' },
    { code: '03.02.01.02.0023', name: 'OXIGENIO/GAS P/SOLDA' },
    { code: '03.02.01.02.0006', name: 'PNEUS E CAMARAS' },
    { code: '03.02.01.02.0015', name: 'TIJOLOS' },
    { code: '03.02.01.02.0018', name: 'TINTA' },
    { code: '03.02.01.02.0014', name: 'TUBOS E CONEXOES' },
    
    // --- 03.04 CUSTOS GERAIS ---
    { code: '03.04.01.01.0022', name: 'AGUA MINERAL' },
    { code: '03.04.01.01.0002', name: 'ENERGIA ELETRICA' },
    { code: '03.04.01.01.0023', name: 'ALUGUEL' },
    { code: '03.04.01.01.0021', name: 'EQUIPAMENTOS INFORMATICA' },
    { code: '03.04.01.01.0005', name: 'LIMPEZA E HIGIENE' },
    { code: '03.04.01.01.0015', name: 'LOCAÇÃO DE BANHEIROS QUIMICOS' },
    { code: '03.04.01.01.0011', name: 'LOCAÇÃO DE EQUIPAMENTOS LEVES' },
    { code: '03.04.01.01.0009', name: 'LOCAÇÃO DE MAQUINAS E EQUIPAMENTOS' },
    { code: '03.04.01.01.0018', name: 'LOCAÇÃO DE VEICULOS' },
    { code: '03.04.01.01.0014', name: 'SEGUROS E CAUCAO DE OBRAS' },

    // --- 03.05 MANUTENÇÃO ---
    { code: '03.05.01.01.0003', name: 'BENS PEQUENO VALOR (ATIVO PERMANENTE)' },
    { code: '03.05.01.01.0010', name: 'LAVAGEM DE FROTAS' },
    { code: '03.05.01.01.0001', name: 'MANUT. MAQUINAS E EQUIPAMENTOS' },
    { code: '03.05.01.01.0008', name: 'MANUT/PECAS E ACESSORIOS EQUIPAMENTOS' },
    { code: '03.05.01.01.0006', name: 'MANUT/PECAS E ACESSORIOS MAQUINAS' },
    { code: '03.05.01.01.0005', name: 'MANUTENCAO DE AR CONDICIONADO' },
    { code: '03.05.01.01.0002', name: 'MANUTENCAO DE INSTALACOES' },
    { code: '03.05.01.01.0009', name: 'MANUTENÇÃO ELETRICA' },
    { code: '03.05.01.01.0004', name: 'REFORMA DE INSTALAÇÕES' },

    // --- 03.06 FRETES ---
    { code: '03.06.01.01.0002', name: 'FRETE DE MASSA PROPRIO' },
    { code: '03.06.01.02.0006', name: 'FRETE CAP' },
    { code: '03.06.01.02.0003', name: 'FRETE MASSA TERCEIROS' },
    { code: '03.06.01.02.0005', name: 'FRETE S/VENDAS' },
    { code: '03.06.01.02.0002', name: 'FRETE TERCEIROS EXTERNO' },
    { code: '03.06.01.02.0008', name: 'FRETES S/COMPRAS' },

    // --- 03.07 CUSTOS DE VEÍCULOS ---
    { code: '03.07.01.01.0006', name: 'ANTT' },
    { code: '03.07.01.01.0015', name: 'DPVAT (SEGURO OBRIGATORIO)' },
    { code: '03.07.01.01.0013', name: 'EMPLACAMENTO DE VEICULO' },
    { code: '03.07.01.01.0012', name: 'INSPECAO VEICULAR' },
    { code: '03.07.01.01.0002', name: 'IPVA' },
    { code: '03.07.01.01.0001', name: 'LICENCIAMENTO' },
    { code: '03.07.01.01.0017', name: 'MANUT. CORRETIVA (FROTA/MAQ)' },
    { code: '03.07.01.01.0025', name: 'MANUT. POR ACIDENTE (FROTA / MAQ)' },
    { code: '03.07.01.01.0018', name: 'MANUT. PREVENTIVA (FROTA/MAQ)' },
    { code: '03.07.01.01.0004', name: 'MANUTENCAO / PECAS E ACES. VEICULOS' },
    { code: '03.07.01.01.0005', name: 'MULTAS DE TRANSITO' },
    { code: '03.07.01.01.0008', name: 'PEDAGIOS' },
    { code: '03.07.01.01.0009', name: 'PNEUS E CAMERAS - NOVOS' },
    { code: '03.07.01.01.0010', name: 'PNEUS RESSOLADOS' },
    { code: '03.07.01.01.0016', name: 'REFORMA DE FROTA (VEICULOS/EQUIP.)' },
    { code: '03.07.01.01.0007', name: 'SEGUROS' },
    { code: '03.07.01.01.0014', name: 'SERVICOS DE PNEUS/BORRACHARIA' },
    { code: '03.07.01.01.0011', name: 'SERVIÇOS DE GUINCHO' },

    // --- 04. DESPESAS ADMINISTRATIVAS ---
    { code: '04.01.02.01.0001', name: 'CORREIO E XEROX' },
    { code: '04.01.02.01.0003', name: 'DESPESAS DE CARTORIO' },
    { code: '04.01.02.01.0005', name: 'MATERIAL DE ESCRITORIO' },
    { code: '04.01.02.01.0002', name: 'MATERIAL DE USO E CONSUMO (ADM)' },
    { code: '04.01.03.01.0028', name: 'CERTIFICAÇÃO DIGITAL' },
    { code: '04.01.03.01.0022', name: 'COMISSAO' },
    { code: '04.01.03.01.0027', name: 'CONSULTORIA E ASSESSORIA' },
    { code: '04.01.03.01.0006', name: 'CONVENIO MEDICO' },
    { code: '04.01.03.01.0020', name: 'CUSTAS PROCESSUAIS' },
    { code: '04.01.03.01.0004', name: 'HONORARIOS ADVOCATICIOS' },
    { code: '04.01.03.01.0029', name: 'LICENCA DE USO DE SOFTWARE' },
    { code: '04.01.03.01.0014', name: 'LICENCA ESTADUAL' },
    { code: '04.01.03.01.0015', name: 'LICENCA MUNICIPAL' },
    { code: '04.01.03.01.0090', name: 'MENSALIDADES' },
    { code: '04.01.03.01.0012', name: 'PROCESS. DE DADOS' },
    { code: '04.01.03.01.0019', name: 'PUBLICIDADE E PROPAGANDA' },
    { code: '04.01.03.01.0030', name: 'SERVIÇOS DE INTERNET' },
    { code: '04.01.03.01.0008', name: 'TELEFONE' },
    { code: '04.01.03.04.0001', name: 'IPTU' },
    { code: '04.01.03.04.0009', name: 'TAXA DE LICENÇA / ALVARA FUNCIONAMENTO' },
    { code: '04.01.03.04.0006', name: 'TAXAS AMBIENTAIS' },
    { code: '04.01.03.04.0004', name: 'TAXAS E EMOLUMENTOS' },
    { code: '04.02.01.01.0002', name: 'DESPESAS BANCARIAS' },
    { code: '04.02.01.01.0025', name: 'IOF' },
    { code: '04.02.01.01.0001', name: 'JUROS PAGOS/RECEBIDOS' },
    { code: '04.03.01.01.0005', name: 'DOAÇÕES' },
    { code: '04.03.01.01.0003', name: 'MULTA POR INFRACAO' },

    // --- 05. IMPOSTOS ---
    { code: '05.01.01.01.0002', name: 'CSSL' },
    { code: '05.01.01.01.0001', name: 'IRPJ' },
    { code: '05.01.01.01.0006', name: 'ITBI' },
    { code: '05.01.01.01.0005', name: 'ITR' },
    { code: '05.01.01.01.0003', name: 'SIMPLES NACIONAL' },
    { code: '05.01.01.03.0001', name: 'PARCELAM. PGFN FAZENDARIO' },
    { code: '05.01.01.03.0010', name: 'PARCELAM. SIMPLES NACIONAL' },
    { code: '05.01.01.04.0001', name: 'PARCELAMENTO INSS' },

    // --- 06. INVESTIMENTOS (ATIVO PERMANENTE) ---
    { code: '06.01.01.01.0004', name: 'IMOVEIS/TERRENOS' },
    { code: '06.01.01.01.0006', name: 'MAQUINAS E EQUIPAMENTOS' },
    { code: '06.01.01.01.0007', name: 'MOVEIS E UTENSILIOS' },
    { code: '06.01.01.01.0008', name: 'VEICULOS' },
    { code: '06.01.02.01.0004', name: 'INVEST-ALVENARIA-SERV TERC' },
    { code: '06.01.02.01.0003', name: 'INVEST-ESTRUTURA-SERV TERC' },
    { code: '06.01.02.01.0013', name: 'INVEST-INSTAL.ELETRICAS-SERV TERC' },
    { code: '06.01.02.01.0001', name: 'INVEST-SERV. PRELIMINARES-SER TERC' },
    { code: '06.01.02.02.0004', name: 'INVEST-ALVENARIA - MAT.APLIC.' },
    { code: '06.01.02.02.0003', name: 'INVEST-ESTRUTURA - MAT.APLIC.' },
    { code: '06.01.02.02.0013', name: 'INVEST-INSTAL.ELETRICAS - MAT.APLIC.' },
    { code: '06.01.02.03.0002', name: 'INVEST-LOCAÇÃO EQUIP. LEVES' },
    { code: '06.01.02.03.0001', name: 'INVEST-LOCAÇÃO MAQ EQUIP' },
    { code: '06.01.03.01.0001', name: 'CONSORCIOS NÃO CONTEMPLADOS' },
    
    // --- 07. FINANCIAMENTOS ---
    { code: '07.01.01.01.0004', name: 'CDC' },
    { code: '07.01.01.01.0001', name: 'CONSORCIO' },
    { code: '07.01.01.01.0002', name: 'FINAME' },
    { code: '07.01.01.01.0003', name: 'LEASING' }
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
  getAll: async (user, col) => { const snapshot = await getDocs(dbService.getCollRef(user, col)); return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); },
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
        const desc = row.description.toLowerCase() + " " + (row.materialDescription || "").toLowerCase();
        const plan = row.planDescription.toLowerCase();
        const code = row.accountPlan;
        
        // Regra 1: Palavras-chave vs Classe (Exemplos comuns)
        if (desc.includes('diesel') || desc.includes('combustivel')) {
            if (!plan.includes('combustível') && !plan.includes('veículos') && !code.includes('03.07')) issues.push("Item parece Combustível, mas classe difere.");
        }
        if (desc.includes('pneu') || desc.includes('manuten') || desc.includes('peça')) {
            if (!plan.includes('manutenção') && !code.includes('03.05')) issues.push("Item parece Manutenção, mas classe difere.");
        }
        if (desc.includes('energia') || desc.includes('eletrica')) {
            if (!plan.includes('energia') && !plan.includes('administrativa')) issues.push("Item parece Energia, verifique a classe.");
        }

        // Regra 2: Coerência CC (Local) vs Classe (Tipo)
        const ccCode = parseInt(row.costCenter.split(' ')[0]);
        const isAdminCC = ADMIN_CC_CODES.includes(ccCode);
        const isCostClass = code.startsWith('03'); // Custos Operacionais
        const isExpClass = code.startsWith('04');  // Despesas Adm

        if (isAdminCC && isCostClass) {
            issues.push("Alerta: Custo Operacional lançado em Centro de Custo Administrativo.");
        }
        if (!isAdminCC && isExpClass && !plan.includes('rateio')) {
            // Ignoramos "Rateio" pois é comum despesa adm cair em obra via rateio
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

            const type = (planCode?.startsWith('1.') || planCode?.startsWith('01.') || planDesc?.toUpperCase().includes('RECEITA')) ? 'revenue' : 'expense';
            
            // Lógica de Unidade
            const detectedUnit = getUnitByCostCenter(ccCode);
            const finalSegment = detectedUnit || `DESCONHECIDO (CC: ${ccCode})`;

            parsed.push({
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
    const handleEditRow = (index, field, value) => {
        const newData = [...previewData];
        newData[index] = { ...newData[index], [field]: value };
        
        // Se alterou o código da conta, tenta atualizar a descrição automaticamente baseada no PLANO_CONTAS
        if (field === 'accountPlan') {
            const found = PLANO_CONTAS.find(p => p.code === value);
            if (found) newData[index].planDescription = found.name;
        }

        setPreviewData(newData);
    };

    const handleConfirmImport = () => {
        if (previewData.length === 0) return alert("Nenhum dado válido.");
        onImport(previewData);
        setFileText(''); setPreviewData([]);
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg dark:text-white">Auditoria de Importação (TXT)</h3>
            </div>
            
            {previewData.length === 0 && (
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => fileRef.current?.click()}>
                    <UploadCloud className="mx-auto text-indigo-500 mb-3" size={40} />
                    <p className="font-medium text-slate-700 dark:text-slate-200">Clique para selecionar o arquivo TXT</p>
                    <input type="file" ref={fileRef} className="hidden" accept=".txt,.csv" onChange={handleFile} />
                </div>
            )}

            {previewData.length > 0 && (
                <div className="mt-6 animate-in fade-in">
                    <div className="flex justify-between items-center mb-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                        <div className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Modo de Auditoria:</strong> As linhas em <span className="bg-amber-100 text-amber-800 px-1 rounded font-bold border border-amber-300">amarelo</span> indicam possíveis inconsistências. 
                            Verifique e altere a <strong>Conta</strong> ou <strong>Unidade</strong> diretamente na tabela abaixo antes de confirmar.
                        </div>
                        <button onClick={handleConfirmImport} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all">
                            {isProcessing ? <Loader2 className="animate-spin"/> : <CheckCircle size={18}/>} 
                            Confirmar {previewData.length} Lançamentos
                        </button>
                    </div>

                    <div className="max-h-[600px] overflow-y-auto border dark:border-slate-700 rounded-lg shadow-inner">
                        <table className="w-full text-xs text-left relative">
                            <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 font-bold text-slate-600 dark:text-slate-300">Data</th>
                                    <th className="p-3 font-bold text-slate-600 dark:text-slate-300 w-1/4">Descrição / Fornecedor</th>
                                    <th className="p-3 font-bold text-slate-600 dark:text-slate-300">Unidade (Local)</th>
                                    <th className="p-3 font-bold text-slate-600 dark:text-slate-300">Conta (Classificação)</th>
                                    <th className="p-3 font-bold text-slate-600 dark:text-slate-300 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700 bg-white dark:bg-slate-800">
                                {previewData.map((row, i) => {
                                    const issues = analyzeConsistency(row);
                                    const hasIssue = issues.length > 0;
                                    
                                    return (
                                        <tr key={i} className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 ${hasIssue ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                                            <td className="p-2 whitespace-nowrap text-slate-500">{formatDate(row.date)}</td>
                                            
                                            <td className="p-2">
                                                <div className="font-bold text-slate-700 dark:text-slate-200">{row.description}</div>
                                                <div className="text-[10px] text-slate-400">{row.materialDescription}</div>
                                                {hasIssue && (
                                                    <div className="mt-1 text-[10px] font-bold text-amber-600 flex items-center gap-1">
                                                        <AlertTriangle size={10}/> {issues[0]}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="p-2">
                                                {/* CAMPO DE EDIÇÃO DE UNIDADE */}
                                                <input 
                                                    className="w-full bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 outline-none text-xs py-1"
                                                    value={row.segment}
                                                    onChange={(e) => handleEditRow(i, 'segment', e.target.value)}
                                                />
                                                <div className="text-[10px] text-slate-400 mt-1">CC: {row.costCenter.split('-')[0]}</div>
                                            </td>

                                            <td className="p-2">
                                                {/* CAMPO DE EDIÇÃO DE CONTA (COM DROPDOWN) */}
                                                <select 
                                                    className={`w-full bg-transparent border rounded px-1 py-1 text-xs outline-none cursor-pointer ${hasIssue ? 'border-amber-400 text-amber-700 font-bold' : 'border-slate-200 text-slate-600 dark:text-slate-300 dark:border-slate-600'}`}
                                                    value={row.accountPlan}
                                                    onChange={(e) => handleEditRow(i, 'accountPlan', e.target.value)}
                                                >
                                                    <option value={row.accountPlan}>{row.accountPlan} - {row.planDescription} (Original)</option>
                                                    {PLANO_CONTAS.map(p => (
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
            )}
        </div>
    );
};

const CustosComponent = ({ transactions, showToast, measureUnit, totalProduction }) => {
    const [filtered, setFiltered] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedGroups, setExpandedGroups] = useState({
        'DESPESAS DA UNIDADE': true,
        'CUSTO OPERACIONAL INDÚSTRIA': true,
        'CUSTO OPERACIONAL ADMINISTRATIVO': true,
        'INVESTIMENTOS': true
    });
    useEffect(() => {
        let data = transactions.filter(t => t.type === 'expense');
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            data = data.filter(t => 
                (t.accountPlan && t.accountPlan.toLowerCase().includes(lowerTerm)) ||
                (t.planDescription && t.planDescription.toLowerCase().includes(lowerTerm)) ||
                (t.description && t.description.toLowerCase().includes(lowerTerm))
            );
        }
        setFiltered(data);
    }, [transactions, searchTerm]);

const groupedData = useMemo(() => {
        const hierarchy = {
            'DESPESAS DA UNIDADE': { total: 0, subgroups: { 'CUSTO OPERACIONAL INDÚSTRIA': { total: 0, classes: {} }, 'CUSTO OPERACIONAL ADMINISTRATIVO': { total: 0, classes: {} }, 'OUTRAS DESPESAS': { total: 0, classes: {} } } },
            'TRANSPORTE': { total: 0, subgroups: { 'CUSTO TRANSPORTE': {total:0, classes:{}}, 'Geral': {total:0, classes:{}} } },
            'ADMINISTRATIVO': { total: 0, subgroups: { 'CUSTO RATEIO DESPESAS ADMINISTRATIVAS': {total:0, classes:{}}, 'Geral': {total:0, classes:{}} } },
            'IMPOSTOS': { total: 0, subgroups: { 'CUSTO IMPOSTOS': {total:0, classes:{}}, 'Geral': {total:0, classes:{}} } },
            'INVESTIMENTOS': { total: 0, subgroups: { 'INVESTIMENTOS GERAIS': {total:0, classes:{}}, 'Geral': {total:0, classes:{}} } },
            'OUTROS': { total: 0, subgroups: { 'Geral': {total:0, classes:{}} } }
        };

        const grandTotal = filtered.reduce((acc, t) => acc + t.value, 0);

        filtered.forEach(t => {
            const segmentName = getParentSegment(t.segment);
            const rules = COST_CENTER_RULES[segmentName] || {};
            const ccCode = t.costCenter ? parseInt(t.costCenter.split(' ')[0]) : 0;
            
            let targetRoot = 'OUTROS';
            let targetSub = 'Geral';
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
                if (t.accountPlan?.startsWith('06')) { 
                targetRoot = "INVESTIMENTOS"; 
                targetSub = "INVESTIMENTOS GERAIS";
                }
                else if (t.accountPlan === '02.01') { targetRoot = "IMPOSTOS"; targetSub = "CUSTO IMPOSTOS"; }
                else if (ADMIN_CC_CODES.includes(ccCode)) { targetRoot = 'DESPESAS DA UNIDADE'; targetSub = 'CUSTO OPERACIONAL ADMINISTRATIVO'; } 
                else if (t.accountPlan?.startsWith('03')) { targetRoot = 'DESPESAS DA UNIDADE'; targetSub = 'CUSTO OPERACIONAL INDÚSTRIA'; } 
                else if (t.accountPlan?.startsWith('04')) { targetRoot = 'DESPESAS DA UNIDADE'; targetSub = 'CUSTO OPERACIONAL ADMINISTRATIVO'; }
                else { targetRoot = 'DESPESAS DA UNIDADE'; targetSub = 'OUTRAS DESPESAS'; }
            }

            let finalValue = t.value;
            if (!hierarchy[targetRoot]) hierarchy[targetRoot] = { total: 0, subgroups: {} };
            if (!hierarchy[targetRoot].subgroups[targetSub]) hierarchy[targetRoot].subgroups[targetSub] = { total: 0, classes: {} };
            
            const subgroup = hierarchy[targetRoot].subgroups[targetSub];
            
            // --- MODIFICAÇÃO: Se for imposto, usa a descrição manual ---
            let displayDesc = t.planDescription;
            if (targetRoot === 'IMPOSTOS' || t.accountPlan === '02.01') {
                // Se tiver descrição manual, usa ela, senão usa a do plano
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
                <h3 className="font-bold text-lg dark:text-white">Custos e Despesas</h3>
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
                                    {/* ALTERAÇÃO AQUI: Exibe o calculo Custo/Ton no grupo principal também */}
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
                                                                    <div><p className="font-bold text-slate-600 dark:text-slate-400">{t.description} <span className="font-normal text-[10px] ml-2 text-slate-400">{formatDate(t.date)}</span></p><p className="text-[10px] text-slate-400">CC: {t.costCenter}</p></div>
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
    const [form, setForm] = useState({ 
        date: new Date().toISOString().slice(0, 7), 
        type: 'expense', 
        description: '', 
        value: '', 
        segment: '', 
        accountPlan: '', 
        metricType: 'producao',
        materialDescription: '' 
    });

    const [activeTab, setActiveTab] = useState('expense'); 

    // Opções rápidas para Fechamento
    const manualOptions = [
        "Transporte Terceiros",
        "Rateio Despesas Administrativas",
        "Despesas Multas e Taxas",
        "Frota Parada",
        "Investimentos Consórcios a Contemplar"
    ];

    useEffect(() => { 
        if (initialData) { 
            setForm({ 
                ...initialData, 
                date: initialData.date.slice(0, 7),
                materialDescription: initialData.materialDescription || '' 
            }); 
            setActiveTab(initialData.type === 'metric' ? 'metric' : initialData.type); 
        } 
    }, [initialData]);

    const handleSubmit = async () => {
        const val = parseFloat(form.value);
        
        if (!form.description && activeTab !== 'metric') return showToast("Preencha a descrição.", 'error');
        if (isNaN(val) || !form.segment) return showToast("Preencha unidade e valor.", 'error');
        if (activeTab !== 'metric' && !form.accountPlan) return showToast("Selecione a conta do DRE.", 'error');
        if (activeTab === 'metric' && form.metricType === 'estoque' && !form.materialDescription) return showToast("Selecione o Material.", 'error');

        const [year, month] = form.date.split('-');
        const lastDay = new Date(year, month, 0).getDate();
        const fullDate = `${form.date}-${lastDay}`;
        
        let tx = { 
            ...form, 
            date: fullDate, 
            value: val, 
            costCenter: 'GERAL', 
            source: 'manual', 
            createdAt: new Date().toISOString(), 
            type: activeTab 
        };

        if (activeTab === 'metric') { 
            const matDesc = form.metricType === 'estoque' ? ` - ${form.materialDescription}` : '';
            tx.description = `Lançamento de ${form.metricType.toUpperCase()}${matDesc}`; 
            tx.accountPlan = 'METRICS';
            if (form.metricType !== 'estoque') tx.materialDescription = '';
        };

       try { 
            if(initialData?.id) {
                // SE FOR EDIÇÃO: Salva e fecha a janela
                await dbService.update(user, 'transactions', initialData.id, tx);
                showToast("Lançamento atualizado!", 'success');
                onSave(); 
                onClose(); 
            } else {
                // SE FOR NOVO: Salva, avisa, limpa o valor e MANTÉM ABERTO
                await dbService.add(user, 'transactions', tx); 
                showToast("Salvo! Pode fazer o próximo.", 'success');
                onSave(); 
                
                // Limpa apenas campos variáveis para agilizar o próximo input
                setForm(prev => ({ 
                    ...prev, 
                    value: '', 
                    description: '',
                    // Mantém: data, unidade, conta do DRE e tipo de material (se for estoque)
                }));
                // Observação: removemos o onClose() daqui
            }
        } catch(e) { 
            showToast("Erro ao salvar.", 'error');
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
                            {/* Novo seletor rápido */}
                            <select className="w-full border p-2 mb-2 rounded text-xs dark:bg-slate-700 dark:text-white" onChange={(e) => {
                                if(e.target.value) setForm({...form, description: e.target.value});
                            }}>
                                <option value="">Selecione ou Digite abaixo...</option>
                                {manualOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <input className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" placeholder="Descrição Manual..." value={form.description} onChange={e=>setForm({...form, description: e.target.value})} />
                            
                            <select className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white" value={form.accountPlan} onChange={e=>setForm({...form, accountPlan: e.target.value})}>
                                <option value="">Selecione a Classe Analítica...</option>
                                <option value="00.00">00.00 - Lançamento Manual (Ajuste)</option>
                                {PLANO_CONTAS.map(r => (<option key={r.code} value={r.code}>{r.code} - {r.name}
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
    // Estado para controlar quais linhas estão expandidas
    const [expanded, setExpanded] = useState({
        'receitas': true,
        'custo_operacional': true,
        'manutencao': true
    });

    const toggle = (key) => setExpanded(prev => ({...prev, [key]: !prev[key]}));

    // LÓGICA DO TÍTULO DINÂMICO
    const getPeriodLabel = () => {
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        
        if (filter.type === 'month') return `${months[filter.month]}/${filter.year}`;
        if (filter.type === 'quarter') return `${filter.quarter}º Trimestre/${filter.year}`;
        if (filter.type === 'semester') return `${filter.semester}º Semestre/${filter.year}`;
        return `Ano de ${filter.year}`;
    };

    const unitLabel = selectedUnit.includes(':') ? selectedUnit.split(':')[1].trim() : selectedUnit;
    const dynamicTitle = `Fechamento: ${unitLabel} - ${getPeriodLabel()}`;

    const data = useMemo(() => {
        // --- 1. PREPARAÇÃO DOS DADOS ---
        const totalRevenue = transactions.filter(t => t.type === 'revenue').reduce((acc, t) => acc + t.value, 0);
        
        // Helper para somar baseado em filtros
        const sum = (fn) => transactions.filter(fn).reduce((acc, t) => acc + t.value, 0);

        // Helper para verificar se uma transação pertence a um grupo de regras de custo
        const isInRuleGroup = (t, groupName, subGroupName = null) => {
            const rules = COST_CENTER_RULES["Portos de Areia"]; // Fixo para Portos por enquanto
            if (!rules || !rules[groupName]) return false;
            
            const ccCode = t.costCenter ? parseInt(t.costCenter.split(' ')[0]) : 0;
            
            if (subGroupName) {
                return rules[groupName][subGroupName]?.includes(ccCode);
            }
            return Object.values(rules[groupName]).flat().includes(ccCode);
        };

        // --- 2. CÁLCULOS DAS LINHAS ---
        // RECEITAS
        const recMaterial = sum(t => t.type === 'revenue' && (t.description.toLowerCase().includes('retira') || t.description.toLowerCase().includes('entrega') || t.accountPlan === '01.01'));
        const recFrete = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('frete'));
        const subsidio = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('subsídio'));
        
        // Detalhe Receitas
        const recRetira = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('retira'));
        const recEntrega = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('entrega'));
        const freteCarreta = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('carreta'));
        const freteTruck = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('truck'));
        const freteTerceiros = sum(t => t.type === 'revenue' && t.description.toLowerCase().includes('terceiros') && t.description.toLowerCase().includes('frete'));

        // CUSTO OPERACIONAL
        const despUnidade = sum(t => t.type === 'expense' && isInRuleGroup(t, 'DESPESAS DA UNIDADE'));
        const combustivel = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && (t.description.toLowerCase().includes('combustivel') || t.description.toLowerCase().includes('diesel') || t.accountPlan === '03.07.01'));
        const totalCustoOperacional = despUnidade + combustivel;

        // MARGEM DE CONTRIBUIÇÃO
        const margemContribuicao = totalRevenue - totalCustoOperacional;

        // MANUTENÇÃO
        const manutencaoTotal = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05'));
        const manuPrev = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('preventiva'));
        const manuCorr = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('corretiva'));
        const manuReform = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('reforma'));
        const manuFrete = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('frete')); 
        const manuPneus = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('pneu'));
        const manuRessolado = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('ressolado'));
        const manuNovos = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE') && t.accountPlan.startsWith('03.05') && t.description.toLowerCase().includes('novos'));
        
        // TOTAL DESPESAS TRANSPORTE
        const totalTransporteGroup = sum(t => t.type === 'expense' && isInRuleGroup(t, 'TRANSPORTE'));
        const residualTransporte = totalTransporteGroup - combustivel - manutencaoTotal;

        // MANUAIS E ESPECÍFICOS
        const transpTerceiros = sum(t => t.type === 'expense' && t.description.toLowerCase().includes('transporte terceiros'));
        const impostos = sum(t => t.type === 'expense' && (t.accountPlan.startsWith('02') || t.description.toLowerCase().includes('imposto')));
        
        // RESULTADO OPERACIONAL
        const resultOperacional = margemContribuicao - manutencaoTotal - residualTransporte - transpTerceiros - impostos;

        // PÓS OPERACIONAL
        const rateioAdm = sum(t => t.type === 'expense' && t.description.toLowerCase().includes('rateio despesas'));
        const multas = sum(t => t.type === 'expense' && (t.description.toLowerCase().includes('multa') || t.description.toLowerCase().includes('taxa')));
        const frotaParada = sum(t => t.type === 'expense' && t.description.toLowerCase().includes('frota parada'));

        const resultPosDespesas = resultOperacional - rateioAdm - multas - frotaParada;

        // INVESTIMENTOS
        const investimentos = sum(t => t.type === 'expense' && (
    t.accountPlan.startsWith('06') || // Pega tudo que começa com 06
    t.description.toLowerCase().includes('consórcio') || 
    t.description.toLowerCase().includes('investimento')
));
        const resultFinal = resultPosDespesas - investimentos;

        return {
            totalRevenue, recMaterial, recRetira, recEntrega, recFrete, freteCarreta, freteTruck, freteTerceiros, subsidio,
            totalCustoOperacional, despUnidade, combustivel, margemContribuicao,
            manutencaoTotal, manuPrev, manuCorr, manuReform, manuFrete, manuPneus, manuRessolado, manuNovos,
            residualTransporte, transpTerceiros, impostos, resultOperacional, rateioAdm, multas, frotaParada,
            resultPosDespesas, investimentos, resultFinal
        };
    }, [transactions]);

    const Row = ({ label, val, isHeader = false, isResult = false, isSub = false, colorClass = "text-slate-700", bgClass = "", indent = 0, onClick = null, hasArrow = false, expanded = false }) => {
        const percent = data.totalRevenue > 0 ? (val / data.totalRevenue) * 100 : 0;
        const perUnit = totalSales > 0 ? val / totalSales : 0;
        let finalColor = colorClass;
        if (isResult) finalColor = val >= 0 ? 'text-emerald-600' : 'text-rose-600';

        return (
            <tr className={`${bgClass} border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer`} onClick={onClick}>
                <td className={`p-2 py-3 flex items-center ${finalColor} dark:text-slate-200`} style={{ paddingLeft: `${indent * 20 + 10}px` }}>
                    {hasArrow && (expanded ? <ChevronDown size={14} className="mr-2"/> : <ChevronRight size={14} className="mr-2"/>)}
                    <span className={`${isHeader ? 'font-bold uppercase text-sm' : 'text-xs font-medium'}`}>{label}</span>
                </td>
                <td className={`p-2 text-right font-bold ${finalColor} dark:text-slate-200`}>
                    {isSub && val === 0 ? '-' : val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="p-2 text-right text-xs font-mono text-slate-500 dark:text-slate-400">{percent === 0 ? '-' : `${percent.toFixed(2)}%`}</td>
                <td className="p-2 text-right text-xs font-mono text-slate-500 dark:text-slate-400">{perUnit === 0 ? '-' : perUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
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
                    {/* BOTÃO EXPORTAR PDF */}
                    <button onClick={() => window.print()} className="no-print p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Exportar PDF / Imprimir">
                        <Printer size={20}/>
                    </button>
                </div>
                
                <div className="flex gap-4">
                    <div className="bg-white dark:bg-slate-800 px-3 py-1 rounded border dark:border-slate-700 text-sm">
                        <span className="text-slate-500 mr-2">Produção Total:</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalProduction.toLocaleString()} ton</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 px-3 py-1 rounded border dark:border-slate-700 text-sm">
                        <span className="text-slate-500 mr-2">Vendas Totais:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{totalSales.toLocaleString()} ton</span>
                    </div>
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs uppercase">
                        <tr>
                            <th className="p-3 pl-4">Descrição</th>
                            <th className="p-3 text-right">Valor</th>
                            <th className="p-3 text-right">%</th>
                            <th className="p-3 text-right">R$ / ton</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                        {/* RECEITAS */}
                        <Row label="Total Receitas" val={data.totalRevenue} isHeader colorClass="text-blue-600" onClick={()=>toggle('receitas')} hasArrow expanded={expanded['receitas']} />
                        {expanded['receitas'] && (
                            <>
                                <Row label="Receita de Material" val={data.recMaterial} indent={1} colorClass="text-blue-500" />
                                <Row label="Receita Retira" val={data.recRetira} indent={2} isSub colorClass="text-blue-400" />
                                <Row label="Receita Entrega" val={data.recEntrega} indent={2} isSub colorClass="text-blue-400" />
                                <Row label="Receita de Frete" val={data.recFrete} indent={1} colorClass="text-blue-500" />
                                <Row label="Frete Carreta" val={data.freteCarreta} indent={2} isSub colorClass="text-blue-400" />
                                <Row label="Frete Truck" val={data.freteTruck} indent={2} isSub colorClass="text-blue-400" />
                                <Row label="Frete Terceiros" val={data.freteTerceiros} indent={2} isSub colorClass="text-blue-400" />
                                <Row label="Subsídio de Terceiros" val={data.subsidio} indent={1} colorClass="text-blue-500" />
                            </>
                        )}

                        <Row label="Custo Operacional" val={data.totalCustoOperacional} isHeader colorClass="text-rose-600" onClick={()=>toggle('custo_operacional')} hasArrow expanded={expanded['custo_operacional']} />
                        {expanded['custo_operacional'] && (
                            <>
                                <Row label="Despesas da Unidade" val={data.despUnidade} indent={1} colorClass="text-rose-500" />
                                <Row label="Custo Administrativo" val={0} indent={1} colorClass="text-rose-500" /> 
                                <Row label="Combustível Transporte" val={data.combustivel} indent={1} colorClass="text-rose-500" />
                            </>
                        )}

                        <Row label="Margem de Contribuição" val={data.margemContribuicao} isHeader isResult bgClass="bg-blue-50 dark:bg-blue-900/20" />

                        <Row label="Despesas Comerciais" val={0} indent={0} colorClass="text-rose-600" />

                        <Row label="Manutenção Transporte" val={data.manutencaoTotal} isHeader colorClass="text-rose-600" onClick={()=>toggle('manutencao')} hasArrow expanded={expanded['manutencao']} indent={0}/>
                        {expanded['manutencao'] && (
                            <>
                                <Row label="Manutenção Preventiva" val={data.manuPrev} indent={1} isSub colorClass="text-rose-500" />
                                <Row label="Manutenção Corretiva" val={data.manuCorr} indent={1} isSub colorClass="text-rose-500" />
                                <Row label="Manutenção Reforma" val={data.manuReform} indent={1} isSub colorClass="text-rose-500" />
                                <Row label="Fretes compras p/ manutenção" val={data.manuFrete} indent={1} isSub colorClass="text-rose-500" />
                                <Row label="Serviços de Pneus/Borracharia" val={data.manuPneus} indent={1} isSub colorClass="text-rose-500" />
                                <Row label="Pneus Ressolados" val={data.manuRessolado} indent={1} isSub colorClass="text-rose-500" />
                                <Row label="Pneus Novos" val={data.manuNovos} indent={1} isSub colorClass="text-rose-500" />
                            </>
                        )}

                        <Row label="Total Despesas Transportes (Residual)" val={data.residualTransporte} indent={0} colorClass="text-rose-600 font-bold" />
                        <Row label="Total Desp. Transp. Terceiros" val={data.transpTerceiros} indent={0} colorClass="text-rose-600" />
                        <Row label="Impostos" val={data.impostos} indent={0} colorClass="text-rose-600" />

                        <Row label="Resultado Operacional" val={data.resultOperacional} isHeader isResult bgClass="bg-slate-200 dark:bg-slate-700" />

                        <Row label="Rateio Despesas Administrativas" val={data.rateioAdm} indent={0} colorClass="text-rose-600" />
                        <Row label="Despesas Multas e Taxas" val={data.multas} indent={0} colorClass="text-rose-600" />
                        <Row label="Frota Parada" val={data.frotaParada} indent={0} colorClass="text-rose-600" />

                        <Row label="Resultado Pós Despesas" val={data.resultPosDespesas} isHeader isResult bgClass="bg-slate-200 dark:bg-slate-700" />

                        <Row label="Investimentos / Consórcios" val={data.investimentos} indent={0} colorClass="text-rose-600" />

                        <Row label="Resultado Pós Investimentos" val={data.resultFinal} isHeader isResult bgClass="bg-slate-300 dark:bg-slate-600" />
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
            // Grid 3 colunas: Label (flexível) | Valor (auto) | % (fixo 45px)
            // Se for 'vol' (vendas), a 3ª coluna fica vazia
            <div className={`grid grid-cols-[1fr_auto_45px] gap-1 items-center ${isBold ? 'font-bold' : ''}`}>
                <span className="opacity-90">{label}</span>
                
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
            <div className={`grid grid-cols-[1fr_auto_45px] gap-1 items-center ${isBold ? 'font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                {/* Removido truncate para evitar corte do nome */}
                <span>{label}</span>
                
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
                <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
                    <div className="bg-indigo-600 p-4 flex justify-between items-center text-white sticky top-0 z-10">
                        <h2 className="font-bold text-lg">Fechamento: {data.name}</h2>
                        <button onClick={onClose}><X size={24}/></button>
                    </div>
                    <div className="p-6 overflow-y-auto max-h-[80vh] text-sm">
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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* 1. Card Total Global */}
                {consolidatedData['Total Global'] && (
                    <div 
                        onClick={() => setSelectedSegment(consolidatedData['Total Global'])}
                        className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg cursor-pointer hover:scale-105 transition-transform"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-xl">TOTAL GLOBAL</h3>
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
                        className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border dark:border-slate-700 cursor-pointer hover:border-indigo-500 transition-colors group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-lg dark:text-white group-hover:text-indigo-600 line-clamp-1" title={d.name}>{d.name}</h3>
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

export default function App() {
  const [user, setUser] = useState({ uid: 'admin_master', email: 'admin@noromix.com.br' });
  const [userRole, setUserRole] = useState('admin');
  const [loadingAuth, setLoadingAuth] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [toast, showToast] = useToast();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [segments, setSegments] = useState([]);
  
  const [filter, setFilter] = useState({ type: 'month', month: new Date().getMonth(), year: new Date().getFullYear(), quarter: 1, semester: 1 });
  const [globalUnitFilter, setGlobalUnitFilter] = useState('Portos de Areia');

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
    if (!user) return;
    try {
        const txs = await dbService.getAll(user, 'transactions');
        const segs = await dbService.getAll(user, 'segments');
        setTransactions(txs);
        setSegments(segs);
        setSelectedIds([]);
    } catch (e) { showToast("Erro ao carregar dados.", 'error'); }
  };

  const handleLogout = async () => { window.location.reload(); };

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
      
      <aside className="w-20 lg:w-64 bg-slate-900 dark:bg-slate-950 text-white flex-col sticky top-0 h-screen hidden md:flex border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3"><div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center"><Building2 size={18} /></div><span className="text-xl font-bold hidden lg:block">Fechamento Custos</span></div>
        <nav className="flex-1 p-4 space-y-2">
           <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all $ ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><LayoutDashboard size={20} /><span className="hidden lg:block">Visão Geral</span></button>
          <button onClick={() => setActiveTab('lancamentos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'lancamentos' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><List size={20} /><span className="hidden lg:block">Lançamentos</span></button>
          <button onClick={() => setActiveTab('custos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'custos' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><DollarSign size={20} /><span className="hidden lg:block">Custos e Despesas</span></button>
          <button onClick={() => setActiveTab('estoque')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'estoque' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Package size={20} /><span className="hidden lg:block">Estoque</span></button>
          <button onClick={() => setActiveTab('producao')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'producao' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><BarChartIcon size={20} /><span className="hidden lg:block">Produção vs Vendas</span></button>
          <button onClick={() => setActiveTab('ingestion')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'ingestion' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><UploadCloud size={20} /><span className="hidden lg:block">Importar TXT</span></button>
          <button onClick={() => setActiveTab('fechamento')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'fechamento' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><FileUp size={20} /><span className="hidden lg:block">Fechamento</span></button>
          <button onClick={() => setActiveTab('global')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'global' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Globe size={20} /><span className="hidden lg:block">Global</span></button>
        </nav>
        <div className="p-4 border-t border-slate-800"><div className="flex items-center gap-2 text-sm text-slate-400"><div className="p-1 bg-slate-800 rounded"><UserCircle size={16} /></div><div className="flex-1 min-w-0"><p className="truncate font-bold text-white">{user.email}</p><p className="text-xs uppercase tracking-wider text-indigo-400">{userRole}</p></div></div></div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 lg:p-8">
<header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          
          {/* LÓGICA NOVA: Se a aba for 'global', esconde os filtros da esquerda */}
          {activeTab !== 'global' ? (
            <div className="flex gap-2 w-full md:w-auto items-center">
               <PeriodSelector filter={filter} setFilter={setFilter} years={[2024, 2025]} />
               <HierarchicalSelect value={globalUnitFilter} onChange={setGlobalUnitFilter} options={segments} isFilter={true} placeholder="Selecione Unidade ou Segmento" />
            </div>
          ) : (
            <div>{/* Div vazio para manter o alinhamento à direita */}</div>
          )}

          <div className="flex gap-2">
             <button onClick={() => setShowAIModal(true)} className="p-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-lg"><Sparkles size={20} /></button>
             <button onClick={toggleTheme} className="p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg">{theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}</button>
             <button onClick={handleLogout} className="bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg"><LogOut size={20} /></button>
          </div>
        </header>
        
{activeTab === 'global' && <GlobalComponent transactions={transactions} filter={filter} setFilter={setFilter} years={[2024, 2025]} />}
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
                             // FILTRO APENAS DE TEXTO (Data já vem filtrada do filteredData)
                             const searchLower = lancamentosSearch.toLowerCase();
                             const matchesSearch = !lancamentosSearch || 
                                 t.description.toLowerCase().includes(searchLower) ||
                                 t.accountPlan.toLowerCase().includes(searchLower) ||
                                 t.value.toString().includes(searchLower);
                             
                             return matchesSearch;
                         }).map(t => (
                              <tr key={t.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 ${selectedIds.includes(t.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                                 <td className="p-4"><input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => handleSelectOne(t.id)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /></td>
                                 <td className="p-4 dark:text-white">{formatDate(t.date)}</td>
                                 <td className="p-4 dark:text-white">
                                     {t.description}
                                     {t.materialDescription && <span className="block text-[10px] text-slate-500 italic">{t.materialDescription}</span>}
                                 </td>
                                 <td className="p-4 text-xs dark:text-slate-300">{t.segment.includes(':') ? t.segment.split(':')[1] : t.segment}</td>
                                 <td className="p-4 text-xs dark:text-slate-300">
                                     {t.type === 'metric' ? <span className="px-2 py-1 rounded bg-indigo-100 text-indigo-700 font-bold text-[10px]">{t.metricType.toUpperCase()}</span> : t.accountPlan}
                                 </td>
                                 <td className={`p-4 text-right font-bold ${t.type==='revenue'?'text-emerald-500':(t.type==='expense'?'text-rose-500':'text-indigo-500')}`}>{t.value.toLocaleString()}</td>
                                 <td className="p-4 flex gap-2">
                                      {['admin', 'editor'].includes(userRole) && <button onClick={()=>{setEditingTx(t); setShowEntryModal(true);}} className="text-blue-500"><Edit2 size={16}/></button>}
                                 </td>
                             </tr>
                         ))}
                      </tbody>
                 </table>
             </div>
          </div>
        )}
        {activeTab === 'custos' && <CustosComponent transactions={filteredData} showToast={showToast} measureUnit={currentMeasureUnit} totalProduction={totalProduction} />}
        {activeTab === 'fechamento' && <FechamentoComponent transactions={filteredData} totalSales={totalSales} totalProduction={totalProduction} measureUnit={currentMeasureUnit} filter={filter} selectedUnit={globalUnitFilter} />}
        {/* Passando globalCostPerUnit para o componente de estoque */}
        {activeTab === 'estoque' && <StockComponent transactions={filteredData} measureUnit={currentMeasureUnit} globalCostPerUnit={costPerUnit} />}
        {activeTab === 'producao' && <ProductionComponent transactions={filteredData} measureUnit={currentMeasureUnit} />}
        {activeTab === 'users' && <UsersScreen user={user} myRole={userRole} showToast={showToast} />}
        {activeTab === 'ingestion' && <AutomaticImportComponent onImport={handleImport} isProcessing={isProcessing} />}
        
      </main>

      {showEntryModal && user && <ManualEntryModal onClose={() => setShowEntryModal(false)} segments={segments} onSave={loadData} user={user} initialData={editingTx} showToast={showToast} />}
      {showAIModal && user && <AIReportModal onClose={() => setShowAIModal(false)} transactions={filteredData} period={`${filter.month+1}/${filter.year}`} />}
    </div>
  );
}
