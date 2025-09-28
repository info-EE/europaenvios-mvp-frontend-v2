import React, { useState, useRef, useEffect } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { uuid } from '../../utils/helpers'; // Importamos el generador de UUID

// Componente para el icono de cámara
const CameraIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 mr-2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.174C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.174 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.776 48.776 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
);

export function PhotoUploadPage({ sessionId }) {
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [sessionData, setSessionData] = useState(null);
    const fileInputRef = useRef(null);

    // Inicialización segura de Firebase
    const firebaseConfig = {
        apiKey: import.meta.env.VITE_API_KEY,
        authDomain: import.meta.env.VITE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_APP_ID,
        measurementId: import.meta.env.VITE_MEASUREMENT_ID
    };

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const storage = getStorage(app);

    useEffect(() => {
        if (!sessionId) {
            setStatus('error');
            return;
        }
        const sessionDocRef = doc(db, "mobileUploadSessions", sessionId);
        const unsubscribe = onSnapshot(sessionDocRef, (doc) => {
            if (doc.exists()) {
                setSessionData(doc.data());
            } else {
                setStatus('error');
            }
        });
        return () => unsubscribe();
    }, [sessionId, db]);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                handleImageUpload(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleImageUpload = async (imageDataUrl) => {
        if (!imageDataUrl || !sessionData) return;
        setStatus('uploading');

        try {
            // Usamos la carpeta permitida "mobile-uploads"
            const imageName = `mobile-uploads/${uuid()}.jpg`;
            const storageRef = ref(storage, imageName);
            const snapshot = await uploadString(storageRef, imageDataUrl, 'data_url');
            const downloadURL = await getDownloadURL(snapshot.ref);

            const sessionDocRef = doc(db, "mobileUploadSessions", sessionId);
            await updateDoc(sessionDocRef, {
                photoURL: downloadURL,
                uploadedAt: new Date(),
            });

            setStatus('success');
        } catch (error) {
            console.error("Error al subir imagen:", error);
            setStatus('error');
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const renderContent = () => {
        switch (status) {
            case 'uploading':
                return <div className="text-center text-slate-600">Subiendo foto...</div>;
            case 'success':
                return <div className="text-center text-green-600 font-semibold">¡Foto subida con éxito! Ya puedes cerrar esta ventana.</div>;
            case 'error':
                return (
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-red-600 mb-2">Error en la subida</h2>
                        <p className="text-slate-600 mb-4">Hubo un error al subir la imagen. Inténtalo de nuevo.</p>
                        <button className="text-sm font-semibold text-francia-600 hover:underline" onClick={() => setStatus('idle')}>
                            Intentar de nuevo
                        </button>
                    </div>
                );
            case 'idle':
            default:
                return (
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Subir foto del paquete</h2>
                        <p className="text-slate-600 mb-6">Selecciona una foto o usa la cámara de tu móvil.</p>
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <button
                            onClick={triggerFileInput}
                            className="w-full px-4 py-3 rounded-lg bg-francia-600 hover:bg-francia-700 text-white font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                        >
                            <CameraIcon />
                            Abrir cámara / Seleccionar foto
                        </button>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-lg p-6 sm:p-8">
                <img src="/logo.png" alt="Logo Europa Envíos" className="w-32 mx-auto mb-6" />
                {renderContent()}
            </div>
        </div>
    );
}