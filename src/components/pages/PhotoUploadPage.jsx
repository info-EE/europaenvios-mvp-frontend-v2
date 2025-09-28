import React, { useEffect, useState, useRef } from 'react';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { initializeApp, getApps, getApp } from "firebase/app";
import { uuid } from '../../utils/helpers';

// Configuración de Firebase (debe coincidir con tu archivo firebase.js)
const firebaseConfig = {
    apiKey: import.meta.env.VITE_API_KEY,
    authDomain: import.meta.env.VITE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_APP_ID,
    measurementId: import.meta.env.VITE_MEASUREMENT_ID
};

// Inicializa Firebase de forma segura
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Icono de carga
const SpinnerIcon = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export function PhotoUploadPage() {
    const [sessionData, setSessionData] = useState(null);
    const [status, setStatus] = useState('loading'); // loading, idle, preview, uploading, success, error
    const [error, setError] = useState('');
    const [files, setFiles] = useState([]); // Almacenará los archivos seleccionados
    const fileInputRef = useRef(null);

    useEffect(() => {
        const getSession = async () => {
            try {
                const pathParts = window.location.pathname.split('/');
                const sessionId = pathParts[pathParts.length - 1];
                if (!sessionId) {
                    throw new Error("ID de sesión no encontrado en la URL.");
                }

                const sessionRef = doc(db, "mobileUploadSessions", sessionId);
                const sessionSnap = await getDoc(sessionRef);

                if (sessionSnap.exists()) {
                    setSessionData(sessionSnap.data());
                    setStatus('idle');
                } else {
                    throw new Error("La sesión de subida no es válida o ha expirado.");
                }
            } catch (err) {
                console.error("Error al obtener la sesión:", err);
                setError(err.message);
                setStatus('error');
            }
        };
        getSession();
    }, []);

    const handleFileSelect = (event) => {
        const selectedFiles = Array.from(event.target.files);
        if (selectedFiles.length > 0) {
            const newFiles = selectedFiles.map(file => ({
                id: uuid(),
                file,
                preview: URL.createObjectURL(file)
            }));
            setFiles(prevFiles => [...prevFiles, ...newFiles]);
            setStatus('preview');
        }
    };

    const removeFile = (fileId) => {
        setFiles(prevFiles => {
            const updatedFiles = prevFiles.filter(f => f.id !== fileId);
            if (updatedFiles.length === 0) {
                setStatus('idle');
            }
            return updatedFiles;
        });
    };

    const handleUpload = async () => {
        if (files.length === 0) return;

        setStatus('uploading');
        try {
            const uploadPromises = files.map(fileObj => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(fileObj.file);
                    reader.onload = async () => {
                        try {
                            const imageDataUrl = reader.result;
                            const storageRef = ref(storage, `mobile-uploads/${uuid()}.jpg`);
                            const snapshot = await uploadString(storageRef, imageDataUrl, 'data_url');
                            const downloadURL = await getDownloadURL(snapshot.ref);
                            resolve(downloadURL);
                        } catch (uploadError) {
                            reject(uploadError);
                        }
                    };
                    reader.onerror = (error) => reject(error);
                });
            });

            const uploadedUrls = await Promise.all(uploadPromises);

            const sessionId = window.location.pathname.split('/').pop();
            const sessionRef = doc(db, "mobileUploadSessions", sessionId);
            await updateDoc(sessionRef, {
                photoUrls: arrayUnion(...uploadedUrls)
            });

            setStatus('success');
        } catch (err) {
            console.error("Error en la subida:", err);
            setError("Hubo un error al subir las imágenes. Inténtalo de nuevo.");
            setStatus('error');
        }
    };

    const renderContent = () => {
        switch (status) {
            case 'loading':
                return <p className="text-slate-500">Verificando sesión...</p>;

            case 'error':
                return (
                    <div className="text-center">
                        <h1 className="text-xl font-bold text-red-600 mb-2">Error</h1>
                        <p className="text-slate-600 mb-4">{error}</p>
                    </div>
                );

            case 'success':
                return (
                    <div className="text-center">
                        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                        <h1 className="text-xl font-bold text-slate-800">¡Fotos subidas!</h1>
                        <p className="text-slate-600 mt-2">Se han subido {files.length} foto(s) correctamente. Ya puedes cerrar esta ventana.</p>
                    </div>
                );
            
            case 'idle':
            case 'preview':
                return (
                    <>
                        <h1 className="text-xl font-bold text-slate-800 text-center">Subir foto(s) del paquete</h1>
                        <p className="text-slate-500 text-center mt-2 mb-6">
                            Selecciona una o varias fotos de tu galería o usa la cámara de tu móvil.
                        </p>

                        {files.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {files.map(fileObj => (
                                    <div key={fileObj.id} className="relative">
                                        <img src={fileObj.preview} alt="Vista previa" className="w-full h-24 object-cover rounded-md" />
                                        <button onClick={() => removeFile(fileObj.id)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                                            &times;
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <input
                            type="file"
                            accept="image/*"
                            multiple // Permite seleccionar múltiples archivos
                            onChange={handleFileSelect}
                            ref={fileInputRef}
                            className="hidden"
                        />
                        
                        <button
                            onClick={() => fileInputRef.current.click()}
                            className="w-full bg-slate-200 text-slate-800 font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-300 transition-colors mb-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                            Añadir más fotos
                        </button>
                        
                        {files.length > 0 && (
                            <button
                                onClick={handleUpload}
                                className="w-full bg-francia-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-francia-700 transition-colors"
                            >
                                Subir {files.length} foto(s)
                            </button>
                        )}
                    </>
                );

            case 'uploading':
                return (
                    <div className="text-center">
                        <SpinnerIcon />
                        <h1 className="text-xl font-bold text-slate-800 mt-2">Subiendo...</h1>
                        <p className="text-slate-600">Por favor, espera.</p>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-lg p-6">
                <img src="/logo.png" alt="Logo Europa Envíos" className="w-32 mx-auto mb-4" />
                {renderContent()}
            </div>
        </div>
    );
}