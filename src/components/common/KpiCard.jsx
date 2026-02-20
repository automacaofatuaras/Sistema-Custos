import React from 'react';

const KpiCard = ({ title, value, icon: Icon, color, trend, reverseColor = false }) => {
    const colors = {
        emerald: 'text-emerald-600 bg-emerald-50',
        rose: 'text-rose-600 bg-rose-50',
        indigo: 'text-indigo-600 bg-indigo-50'
    };

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
                    <Icon size={24} />
                </div>
            </div>
        </div>
    );
};

export default KpiCard;
