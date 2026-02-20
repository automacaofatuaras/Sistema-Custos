import React from 'react';
import { Sparkles, X, Loader2 } from 'lucide-react';

const AIReportModal = ({ onClose, period }) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg p-6 border dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                        <Sparkles className="text-purple-500" size={20} /> Análise Inteligente (IA)
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg mb-4 text-sm text-slate-600 dark:text-slate-300">
                    <p className="font-bold mb-2">Período: {period}</p>
                    <p>A funcionalidade de conexão com o Gemini AI está configurada, mas aguarda implementação da lógica de resposta.</p>
                </div>

                <div className="text-center py-8">
                    <Loader2 className="animate-spin mx-auto text-indigo-500 mb-2" size={32} />
                    <p className="text-xs text-slate-400">Gerando insights financeiros...</p>
                </div>

                <button onClick={onClose} className="w-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white py-2 rounded-lg font-bold text-sm">
                    Fechar
                </button>
            </div>
        </div>
    );
};

export default AIReportModal;
