import React from 'react';

const KpiCard = ({ title, value, icon: Icon, color, trend, reverseColor = false, prefix = '', suffix = '' }) => {
    const colors = {
        emerald: { bg: 'bg-emerald-50/40 dark:bg-emerald-900/10', text: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-white dark:bg-slate-800', border: 'border-emerald-100/50 dark:border-emerald-800/30' },
        rose: { bg: 'bg-rose-50/40 dark:bg-rose-900/10', text: 'text-rose-600 dark:text-rose-400', iconBg: 'bg-white dark:bg-slate-800', border: 'border-rose-100/50 dark:border-rose-800/30' },
        indigo: { bg: 'bg-indigo-50/40 dark:bg-indigo-900/10', text: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-white dark:bg-slate-800', border: 'border-indigo-100/50 dark:border-indigo-800/30' },
        amber: { bg: 'bg-amber-50/40 dark:bg-amber-900/10', text: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-white dark:bg-slate-800', border: 'border-amber-100/50 dark:border-amber-800/30' },
        sky: { bg: 'bg-sky-50/40 dark:bg-sky-900/10', text: 'text-sky-600 dark:text-sky-400', iconBg: 'bg-white dark:bg-slate-800', border: 'border-sky-100/50 dark:border-sky-800/30' },
        slate: { bg: 'bg-slate-50/40 dark:bg-slate-800/20', text: 'text-slate-600 dark:text-slate-400', iconBg: 'bg-white dark:bg-slate-800', border: 'border-slate-100/50 dark:border-slate-700/30' }
    };

    const scheme = colors[color] || colors.slate;

    let trendValue = 0;
    let hasTrend = false;

    if (trend !== undefined && trend !== null && !isNaN(trend)) {
        hasTrend = true;
        trendValue = Number(trend);
    }

    let trendColorClass = 'text-slate-500 bg-white border-slate-200';
    let trendSign = '';

    if (hasTrend) {
        if (trendValue > 0) {
            trendSign = '+';
            if (reverseColor) {
                trendColorClass = 'text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-800 border-rose-100 dark:border-rose-800';
            } else {
                trendColorClass = 'text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 border-emerald-100 dark:border-emerald-800';
            }
        } else if (trendValue < 0) {
            if (reverseColor) {
                trendColorClass = 'text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 border-emerald-100 dark:border-emerald-800';
            } else {
                trendColorClass = 'text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-800 border-rose-100 dark:border-rose-800';
            }
        }
    }

    return (
        <div className={`p-6 rounded-3xl border shadow-sm flex flex-col justify-between min-h-[140px] transition-all relative overflow-hidden ${scheme.bg} ${scheme.border}`}>
            <div className="flex justify-between items-start mb-6 z-10">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm ${scheme.iconBg}`}>
                    {Icon && <Icon size={18} className={scheme.text} strokeWidth={2.5} />}
                </div>
                {hasTrend && (
                    <div className={`px-2.5 py-1 rounded-full text-[11px] font-black tracking-wider border shadow-sm flex items-center gap-0.5 ${trendColorClass}`}>
                        {trendSign}{trendValue > 1000 ? trendValue.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : trendValue.toFixed(1)}%
                    </div>
                )}
            </div>

            <div className="z-10 mt-auto">
                <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] mb-1.5 opacity-80">{title}</p>
                <div className="flex items-baseline gap-1">
                    {prefix && <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{prefix}</span>}
                    <h3 className="text-xl lg:text-2xl font-black tracking-tight text-slate-800 dark:text-white drop-shadow-sm">{value}</h3>
                    {suffix && <span className="text-sm font-bold text-slate-500 dark:text-slate-400 ml-1">{suffix}</span>}
                </div>
            </div>
        </div>
    );
};

export default KpiCard;
