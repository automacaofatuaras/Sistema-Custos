import React from 'react';

const PeriodSelector = ({ filter, setFilter, years }) => {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    return (
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border dark:border-slate-700 shadow-sm">
            <select
                className="bg-transparent p-2 text-sm outline-none dark:text-white"
                value={filter.type}
                onChange={e => setFilter({ ...filter, type: e.target.value })}
            >
                <option value="month">Mensal</option>
                <option value="quarter">Trimestral</option>
                <option value="semester">Semestral</option>
                <option value="year">Anual</option>
            </select>
            {filter.type === 'month' && (
                <select
                    className="bg-transparent p-2 text-sm outline-none border-l dark:border-slate-700 dark:text-white"
                    value={filter.month}
                    onChange={e => setFilter({ ...filter, month: parseInt(e.target.value) })}
                >
                    {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
            )}
            {filter.type === 'quarter' && (
                <select
                    className="bg-transparent p-2 text-sm outline-none border-l dark:border-slate-700 dark:text-white"
                    value={filter.quarter}
                    onChange={e => setFilter({ ...filter, quarter: parseInt(e.target.value) })}
                >
                    <option value={1}>1º Trimestre</option>
                    <option value={2}>2º Trimestre</option>
                    <option value={3}>3º Trimestre</option>
                    <option value={4}>4º Trimestre</option>
                </select>
            )}
            {filter.type === 'semester' && (
                <select
                    className="bg-transparent p-2 text-sm outline-none border-l dark:border-slate-700 dark:text-white"
                    value={filter.semester}
                    onChange={e => setFilter({ ...filter, semester: parseInt(e.target.value) })}
                >
                    <option value={1}>1º Semestre</option>
                    <option value={2}>2º Semestre</option>
                </select>
            )}
            <select
                className="bg-transparent p-2 text-sm outline-none border-l dark:border-slate-700 font-bold dark:text-white"
                value={filter.year}
                onChange={e => setFilter({ ...filter, year: parseInt(e.target.value) })}
            >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>
    );
};

export default PeriodSelector;
