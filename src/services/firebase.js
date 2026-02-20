import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBmgCmtJnVRkmO2SzvyVmG5e7QCEhxDcy4",
    authDomain: "sistema-custos.firebaseapp.com",
    projectId: "sistema-custos",
    storageBucket: "sistema-custos.firebasestorage.app",
    messagingSenderId: "693431907072",
    appId: "1:693431907072:web:2dbc529e5ef65476feb9e5"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const appId = 'financial-saas-production';
export const GEMINI_API_KEY = "AIzaSyA6feDMeD7YNNQf40q2ALOvwPnfCDa7Pw4"; 
