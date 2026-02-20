import React, { useState, useEffect } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db, appId, firebaseConfig } from '../../../services/firebase';
import dbService from '../../../services/dbService';

const UsersScreen = ({ user, myRole, showToast }) => {
    const [users, setUsers] = useState([]);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPass, setNewUserPass] = useState('');

    const loadUsers = async () => {
        const list = await dbService.getAllUsers();
        setUsers(list);
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleCreateUser = async () => {
        if (myRole !== 'admin') return;
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
            showToast("Usuário criado!", 'success');
            setNewUserEmail('');
            setNewUserPass('');
            loadUsers();
        } catch (e) {
            showToast("Erro: " + e.message, 'error');
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

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 dark:text-white">Gestão de Acessos</h2>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm mb-8 border dark:border-slate-700">
                <h3 className="font-bold mb-4 flex items-center gap-2 dark:text-white">
                    <PlusCircle size={20} /> Cadastrar Novo Usuário
                </h3>
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-slate-500">Email</label>
                        <input
                            className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white"
                            value={newUserEmail}
                            onChange={e => setNewUserEmail(e.target.value)}
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold text-slate-500">Senha Provisória</label>
                        <input
                            className="w-full border p-2 rounded dark:bg-slate-700 dark:text-white"
                            value={newUserPass}
                            onChange={e => setNewUserPass(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleCreateUser}
                        className="bg-emerald-600 text-white px-4 py-2 rounded font-bold hover:bg-emerald-700"
                    >
                        Criar
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border dark:border-slate-700">
                <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase text-xs">
                        <tr>
                            <th className="p-4">Email</th>
                            <th className="p-4">Permissão</th>
                            <th className="p-4">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="p-4 dark:text-white">{u.email}</td>
                                <td className="p-4">
                                    <select
                                        value={u.role}
                                        onChange={(e) => handleChangeRole(u.id, e.target.value)}
                                        disabled={u.role === 'admin' && u.email === user.email}
                                        className="border rounded p-1 text-sm dark:bg-slate-900 dark:text-white"
                                    >
                                        <option value="viewer">Visualizador</option>
                                        <option value="editor">Editor</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                </td>
                                <td className="p-4">
                                    {u.email !== user.email && (
                                        <button
                                            onClick={() => handleDelete(u.id)}
                                            className="text-rose-500 hover:text-rose-700"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default UsersScreen;
