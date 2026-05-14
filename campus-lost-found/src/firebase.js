// src/firebase.js  ← REPLACE your existing firebase.js with this
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// import { getStorage } from 'firebase/storage';   // ← NEW

const firebaseConfig = {
  apiKey: "AIzaSyDhuZkb70ItUoUdbUesWButv-Y7eBU_zyA",
  authDomain: "entre-fce58.firebaseapp.com",
  projectId: "entre-fce58",
  storageBucket: "entre-fce58.firebasestorage.app",
  messagingSenderId: "917795306381",
  appId: "1:917795306381:web:ec30887694d6f54236dbc4",
  measurementId: "G-DY0RFY2VN1"
};

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
// export const storage = getStorage(app);          // ← NEW export
