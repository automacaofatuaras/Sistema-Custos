import React, { useState } from 'react';
import { LayoutDashboard, FileText, BarChart2, Settings, UploadCloud, List } from 'lucide-react';

import DashboardGeral from './tabs/DashboardGeral';
import ResumoSegmento from './tabs/ResumoSegmento';
import AnaliseDetalhada from './tabs/AnaliseDetalhada';
import CadastroConfig from './tabs/CadastroConfig';
import ImportacaoTXT from './tabs/ImportacaoTXT';
import LancamentosManuais from './tabs/LancamentosManuais';
import PeriodSelector from '../../common/PeriodSelector';

const tabs = [
    { id: 'dashboard', label: 'Dashboard Geral', icon: LayoutDashboard },
    { id: 'resumo', label: 'Por Segmento', icon: FileText },
    { id: 'analise', label: 'Análise Detalhada', icon: BarChart2 },
    { id: 'lancamentos', label: 'Lançamentos', icon: List },
    { id: 'cadastro', label: 'Cadastros', icon: Settings },
    { id: 'importacao', label: 'Importar TXT', icon: UploadCloud }
];

export default function RateioAdmCentral({ filter, setFilter, years, user, showToast }) {
    const [activeTab, setActiveTab] = useState('dashboard');

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Rateio Administrativo Geral</h2>
                <div className="flex gap-2">
                    <PeriodSelector filter={filter} setFilter={setFilter} years={years} />
                </div>
            </div>

            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto space-x-1">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap
                                ${activeTab === tab.id
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border dark:border-slate-700 p-6 min-h-[600px]">
                {activeTab === 'dashboard' && <DashboardGeral filter={filter} user={user} />}
                {activeTab === 'resumo' && <ResumoSegmento filter={filter} user={user} />}
                {activeTab === 'analise' && <AnaliseDetalhada filter={filter} user={user} />}
                {activeTab === 'lancamentos' && <LancamentosManuais filter={filter} user={user} showToast={showToast} />}
                {activeTab === 'cadastro' && <CadastroConfig />}
                {activeTab === 'importacao' && <ImportacaoTXT />}
            </div>
        </div>
    );
}
