export const formatDate = (dateString) => {
    if (!dateString) return '-';
    const cleanDate = dateString.substring(0, 10);
    const parts = cleanDate.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateString;
};

export const formatCurrency = (value) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
