// src/firebase.js
import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDFCyXACTjzwSrjyaLyzc3hqSB0s5zLUJY",
  authDomain: "europa-envios-gestor.firebaseapp.com",
  projectId: "europa-envios-gestor",
  // LÍNEA CORREGIDA:
  storageBucket: "europa-envios-gestor.firebasestorage.app", 
  messagingSenderId: "135669072477",
  appId: "1:135669072477:web:59d6b6c1af1b496c0983b4",
  measurementId: "G-KZPBK200QS"
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);