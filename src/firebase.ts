// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD0VVQwOtVCNmW1ip9sACHChDX0CAetWWw",
  authDomain: "sotms-abdullah-new-2026.firebaseapp.com",
  databaseURL: "https://sotms-abdullah-new-2026-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sotms-abdullah-new-2026",
  storageBucket: "sotms-abdullah-new-2026.firebasestorage.app",
  messagingSenderId: "751341477140",
  appId: "1:751341477140:web:a024e99a7ae7e8a4b97601"
};

// Initialize Firebase
// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const rtdb = getDatabase(app);
// Cloud Functions region must match the deployed functions (see functions/src).
export const functions = getFunctions(app, "asia-southeast1");