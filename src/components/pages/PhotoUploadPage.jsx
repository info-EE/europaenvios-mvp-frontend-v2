/* eslint-disable react/prop-types */
import React, { useState, useRef } from 'react';
// Se han corregido las importaciones de Firebase para que sean más robustas.
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { Button } from '../common/Button';
import { Iconos } from '../../utils/helpers';

// Obtenemos la configuración de Firebase desde las variables de entorno
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID
};

// Inicializamos Firebase de forma segura, evitando duplicados
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export function PhotoUploadPage({ sessionId }) {
  const [status, setStatus] = useState('idle'); // idle | uploading | success | error
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleUpload = (file) => {
    setStatus('uploading');
    setError('');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const imageDataUrl = reader.result;
        const imageName = `uploads/${sessionId}-${Date.now()}.jpg`;
        const storageRef = ref(storage, imageName);
        
        const snapshot = await uploadString(storageRef, imageDataUrl, 'data_url');
        const downloadURL = await getDownloadURL(snapshot.ref);

        const sessionRef = doc(db, 'uploadSessions', sessionId);
        await updateDoc(sessionRef, { photoURL: downloadURL, status: 'completed' });

        setStatus('success');
      } catch (err) {
        console.error("Upload error:", err);
        setError('Hubo un error al subir la imagen. Inténtalo de nuevo.');
        setStatus('error');
      }
    };
    reader.onerror = () => {
        setError('No se pudo leer el archivo de imagen.');
        setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
        <img src="/logo.png" alt="Logo Europa Envíos" className="w-40 mx-auto mb-6" />
        
        {status === 'idle' && (
          <>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Subir foto del paquete</h1>
            <p className="text-slate-600 mb-6">Selecciona una foto o usa la cámara de tu móvil.</p>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <Button variant="primary" onClick={() => fileInputRef.current?.click()} className="w-full">
              {Iconos.mobileCam} Abrir cámara / Seleccionar foto
            </Button>
          </>
        )}

        {status === 'uploading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-francia-600 mx-auto"></div>
            <p className="mt-4 text-slate-700 font-semibold">Subiendo imagen...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">¡Foto subida con éxito!</h1>
            <p className="text-slate-600">Ya puedes cerrar esta ventana y volver a la aplicación de escritorio.</p>
          </>
        )}

        {status === 'error' && (
            <>
             <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Error en la subida</h1>
            <p className="text-red-600 mb-4">{error}</p>
            <Button variant="secondary" onClick={() => setStatus('idle')}>
              Intentar de nuevo
            </Button>
          </>
        )}
      </div>
    </div>
  );
}