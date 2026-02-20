import { db, appId } from './firebase';
import {
    collection, addDoc, getDocs, deleteDoc,
    doc, updateDoc, writeBatch, query, where
} from 'firebase/firestore';

export const dbService = {
    getCollRef: (user, colName) => {
        return collection(db, 'artifacts', appId, 'shared_container', 'DADOS_EMPRESA', colName);
    },
    syncSystem: async (user) => {
        return 'admin';
    },
    getAllUsers: async () => {
        return [];
    },
    updateUserRole: async () => { },
    deleteUserAccess: async () => { },
    add: async (user, col, item) => addDoc(dbService.getCollRef(user, col), item),
    update: async (user, col, id, data) => updateDoc(doc(dbService.getCollRef(user, col), id), data),
    del: async (user, col, id) => deleteDoc(doc(dbService.getCollRef(user, col), id)),
    deleteBulk: async (user, col, ids) => {
        const batch = writeBatch(db);
        ids.forEach(id => {
            const docRef = doc(dbService.getCollRef(user, col), id);
            batch.delete(docRef);
        });
        await batch.commit();
    },
    getAll: async (user, col) => {
        const snapshot = await getDocs(dbService.getCollRef(user, col));
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    },
    addBulk: async (user, col, items) => {
        const chunkSize = 400;
        for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            const batch = writeBatch(db);
            const colRef = dbService.getCollRef(user, col);
            chunk.forEach(item => {
                const docRef = doc(colRef);
                batch.set(docRef, item);
            });
            await batch.commit();
        }
    }
};

export const aiService = { analyze: async () => "IA Placeholder" };
