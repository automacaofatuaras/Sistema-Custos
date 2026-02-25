import React from 'react';
import {
    LayoutDashboard, Sparkles, ShieldCheck, Zap,
    BarChart3, Users, ChevronRight, ArrowRight,
    Globe, Database, Cpu
} from 'lucide-react';
import { ArrowLeft } from 'lucide-react';

const WelcomeDashboard = () => {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 lg:p-12 animate-in fade-in duration-1000 relative overflow-hidden">
            {/* Background Animation Elements */}
            <div className="absolute top-0 left-0 w-full h-full -z-10 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
                <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-blue-400/10 rounded-full blur-[80px] animate-bounce" style={{ animationDuration: '8s' }}></div>
            </div>

            {/* Hero Section */}
            <div className="max-w-4xl w-full text-center space-y-8 mb-16 relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest animate-in slide-in-from-top-4 duration-700">
                    <Sparkles size={14} /> Scamatti Custos
                </div>

                <h1 className="text-5xl lg:text-7xl font-black tracking-tighter text-slate-900 dark:text-white leading-tight">
                    Sistema de Gestão Empresarial <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500">de Análise de Custos </span>
                </h1>

                <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    Bem-vindo à plataforma unificada para análise de custos e desempenho, controle de unidades e decisões baseadas em dados reais.
                </p>

                <div className="flex flex-wrap justify-center gap-4 pt-4">
                    <div className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform cursor-default">
                        <ArrowLeft size={18} />  Explore o Menu lateral
                    </div>
                </div>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full">
                <div className="group p-8 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6 text-white group-hover:rotate-12 transition-transform">
                        <BarChart3 size={24} />
                    </div>
                    <h3 className="text-lg font-black mb-3 dark:text-white">Visão Consolidada</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        Analise o desempenho total por segmento. Compare unidades e identifique gargalos em segundos através de dashboards agregados.
                    </p>
                </div>

                <div className="group p-8 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
                    <div className="w-12 h-12 bg-violet-600 rounded-2xl flex items-center justify-center mb-6 text-white group-hover:rotate-12 transition-transform">
                        <Cpu size={24} />
                    </div>
                    <h3 className="text-lg font-black mb-3 dark:text-white">Inteligência Operacional</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        Módulos específicos para Pedreiras, Concreteiras, Usinas de Asfalto e muito mais. Ferramentas personalizadas para cada tipo de negócio.
                    </p>
                </div>

                <div className="group p-8 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
                    <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center mb-6 text-white group-hover:rotate-12 transition-transform">
                        <Database size={24} />
                    </div>
                    <h3 className="text-lg font-black mb-3 dark:text-white">Controle de Lançamentos</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        Importação automatizada de dados e gestão simplificada de transações, integrando operacional e administrativo em um só lugar.
                    </p>
                </div>
            </div>

            {/* Quick Guide */}
            <div className="mt-20 w-full max-w-4xl p-8 bg-indigo-600/5 dark:bg-indigo-400/5 rounded-3xl border border-dashed border-indigo-200 dark:border-indigo-800 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/30">
                        <Zap size={20} />
                    </div>
                    <div className="text-left">
                        <h4 className="font-black text-slate-900 dark:text-white">Como começar?</h4>
                        <p className="text-xs text-slate-500">Siga o fluxo lateral para visualizar seus dados.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter overflow-x-auto no-scrollbar">
                    <span className="px-3 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm border dark:border-slate-700">1. Selecione Segmento</span>
                    <ChevronRight className="text-slate-400" size={14} />
                    <span className="px-3 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm border dark:border-slate-700">2. Escolha Unidade</span>
                    <ChevronRight className="text-slate-400" size={14} />
                    <span className="px-3 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm border dark:border-slate-700">3. Analise Agora</span>
                </div>
            </div>

            {/* Bottom Credits */}
            <div className="mt-16 flex items-center gap-6 opacity-30 grayscale saturate-0">
                <div className="flex items-center gap-2"><ShieldCheck size={16} /> <span className="text-[10px] font-bold">Segurança Garantida</span></div>
                <div className="flex items-center gap-2"><Globe size={16} /> <span className="text-[10px] font-bold">Nuvem Integrada</span></div>
            </div>
        </div>
    );
};

export default WelcomeDashboard;
