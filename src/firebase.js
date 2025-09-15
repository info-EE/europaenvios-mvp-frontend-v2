// src/firebase.js
import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDFCyXACTjzwSrjyaLyzc3hqSB0s5zLUJY",
  authDomain: "europa-envios-gestor.firebaseapp.com",
  projectId: "europa-envios-gestor",
  storageBucket: "europa-envios-gestor.appspot.com",
  messagingSenderId: "135669072477",
  appId: "1:135669072477:web:59d6b6c1af1b496c0983b4",
  measurementId: "G-KZPBK200QS"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar solo el servicio de Storage, que es lo que necesita tu app
export const storage = getStorage(app);