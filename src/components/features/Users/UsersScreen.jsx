import React, { useState, useEffect } from 'react';
import { PlusCircle, Trash2, UserPlus, Shield, User, Loader2, Users } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db, appId, firebaseConfig } from '../../../services/firebase';
import dbService from '../../../services/dbService';

const UsersScreen = ({ user, myRole, showToast }) => {
    const [users, setUsers] = useState([]);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPass, setNewUserPass] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const loadUsers = async () => {
        const list = await dbService.getAllUsers();
        setUsers(list);
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleCreateUser = async () => {
        if (myRole !== 'admin') return;
        if (!newUserEmail || !newUserPass) {
            showToast("Preencha email e senha", "error");
            return;
        }
        setIsCreating(true);
        try {
            const secondaryApp = initializeApp(firebaseConfig, "Secondary");
            const secondaryAuth = getAuth(secondaryApp);
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail, newUserPass);
            await setDoc(doc(db, 'artifacts', appId, 'users', userCredential.user.uid), {
                email: newUserEmail,
                role: 'viewer',
                createdAt: new Date().toISOString()
            });
            await signOut(secondaryAuth);
            showToast("Usuário criado com sucesso!", 'success');
            setNewUserEmail('');
            setNewUserPass('');
            loadUsers();
        } catch (e) {
            let msg = e.message;
            if (e.code === 'auth/email-already-in-use') msg = "Este email já está em uso.";
            else if (e.code === 'auth/weak-password') msg = "A senha deve ter pelo menos 6 caracteres.";
            showToast("Erro: " + msg, 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleChangeRole = async (uid, role) => {
        await dbService.updateUserRole(uid, role);
        loadUsers();
        showToast("Permissão alterada.", 'success');
    };

    const handleDelete = async (uid) => {
        if (!confirm("Remover acesso?")) return;
        await dbService.deleteUserAccess(uid);
        loadUsers();
        showToast("Acesso revogado.", 'success');
    };

    const roleBadges = {
        'admin': { label: 'Administrador', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800/50' },
        'editor': { label: 'Editor', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50' },
        'viewer': { label: 'Visualizador', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50' }
    };

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in">
            <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl border dark:border-slate-700 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 dark:bg-indigo-900/20 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none"></div>
                <div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight dark:text-white flex items-center gap-3 relative z-10">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                            <Shield size={24} />
                        </div>
                        Gestão de Acessos
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 ml-14">Gerencie quem pode visualizar ou editar as informações do sistema.</p>
                </div>
            </div>

            {myRole === 'admin' && (
                <div className="bg-indigo-50/50 dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-indigo-100 dark:border-slate-700 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-l-2xl"></div>
                    <h3 className="font-bold text-lg mb-5 flex items-center gap-2 text-indigo-900 dark:text-indigo-300 ml-2">
                        <UserPlus size={20} className="text-indigo-500" /> Cadastrar Novo Usuário
                    </h3>
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-end ml-2">
                        <div className="flex-1 w-full relative">
                            <label className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 block tracking-wider">Email do Usuário</label>
                            <input
                                className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 p-2.5 px-4 rounded-xl dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                placeholder="exemplo@email.com"
                                type="email"
                                value={newUserEmail}
                                onChange={e => setNewUserEmail(e.target.value)}
                            />
                        </div>
                        <div className="flex-1 w-full relative">
                            <label className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 block tracking-wider">Senha Provisória</label>
                            <input
                                className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 p-2.5 px-4 rounded-xl dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                placeholder="Mínimo 6 caracteres"
                                type="password"
                                value={newUserPass}
                                onChange={e => setNewUserPass(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={handleCreateUser}
                            disabled={isCreating}
                            className={`w-full md:w-auto bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-sm disabled:opacity-70 disabled:hover:translate-y-0`}
                        >
                            {isCreating ? <Loader2 size={20} className="animate-spin" /> : <PlusCircle size={20} />}
                            {isCreating ? 'Criando...' : 'Criar Acesso'}
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border dark:border-slate-700">
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="font-bold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <Users size={18} /> Usuários Ativos ({users.length})
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider font-bold">
                            <tr>
                                <th className="p-4 pl-6">Usuário</th>
                                <th className="p-4">Nível de Permissão</th>
                                <th className="p-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {users.map(u => {
                                const isMe = u.email === user.email;
                                const currentRoleStyling = roleBadges[u.role] || roleBadges['viewer'];

                                return (
                                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                        <td className="p-4 pl-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-600">
                                                    <User size={20} className="text-slate-400" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                        {u.email}
                                                        {isMe && <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">Você</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="relative inline-flex items-center">
                                                {myRole === 'admin' ? (
                                                    <select
                                                        value={u.role}
                                                        onChange={(e) => handleChangeRole(u.id, e.target.value)}
                                                        disabled={isMe}
                                                        className={`appearance-none border pl-3 pr-8 py-1.5 rounded-lg text-sm font-medium outline-none transition-colors cursor-pointer ${currentRoleStyling.color} ${isMe ? 'opacity-70 cursor-not-allowed' : 'hover:brightness-95 dark:hover:brightness-110'}`}
                                                    >
                                                        <option value="viewer">Visualizador</option>
                                                        <option value="editor">Editor</option>
                                                        <option value="admin">Administrador</option>
                                                    </select>
                                                ) : (
                                                    <span className={`border px-3 py-1.5 rounded-lg text-sm font-medium ${currentRoleStyling.color}`}>
                                                        {currentRoleStyling.label}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            {(myRole === 'admin' && !isMe) ? (
                                                <button
                                                    onClick={() => handleDelete(u.id)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 mx-auto"
                                                    title="Remover acesso"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-600">-</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UsersScreen;
