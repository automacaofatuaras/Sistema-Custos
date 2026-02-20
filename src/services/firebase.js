import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
    apiKey: "[GCP_API_KEY]",
    authDomain: "sistema-custos.firebaseapp.com",
    projectId: "sistema-custos",
    storageBucket: "sistema-custos.firebasestorage.app",
    messagingSenderId: "693431907072",
    appId: "1:693431907072:web:2dbc529e5ef65476feb9e5"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const appId = 'financial-saas-production';
export const GEMINI_API_KEY = "[ENCRYPTION_KEY]";
