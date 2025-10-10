/* Europa Envíos – MVP (Refactorizado y Responsivo) */

import React, { useEffect, useState } from "react";

// Firebase
import { db, auth, signOut, onAuthStateChanged } from "/src/firebase.js";
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, query, orderBy, getDoc, writeBatch, getDocs } from "firebase/firestore";

// Context
import { useModal } from "/src/context/ModalContext.jsx";

// Componentes de Secciones
import { Login } from "/src/components/sections/Login.jsx";
import { Dashboard } from "/src/components/sections/Dashboard.jsx";
import { Reception } from "/src/components/sections/Reception.jsx";
import { PaquetesSinCasilla } from "/src/components/sections/PaquetesSinCasilla.jsx";
import { Usuarios } from "/src/components/sections/Usuarios.jsx";
import { Pendientes } from "/src/components/sections/Pendientes.jsx";
import { PaquetesBodega } from "/src/components/sections/PaquetesBodega.jsx";
import { ArmadoCajas } from "/src/components/sections/ArmadoCajas.jsx";
import { CargasEnviadas } from "/src/components/sections/CargasEnviadas.jsx";
import { CargasAdmin } from "/src/components/sections/CargasAdmin.jsx";
import { Proformas } from "/src/components/sections/Proformas.jsx";
import { Extras } from "/src/components/sections/Extras.jsx";

// Helpers y Constantes
import {
  Iconos,
  tabsForRole,
  COURIERS_INICIALES,
  ESTADOS_INICIALES,
  EMPRESAS_ENVIO_INICIALES
} from "/src/utils/helpers.jsx";

// Icono para el menú de hamburguesa en móvil
const MenuIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
);

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [initialising, setInitialising] = useState(true);
  const [tab, setTab] = useState("Dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Estados de datos
  const [couriers, setCouriers] = useState([]);
  const [estados, setEstados] = useState([]);
  const [empresasEnvio, setEmpresasEnvio] = useState([]);
  const [flights, setFlights] = useState([]);
  const [packages, setPackages] = useState([]);
  const [extras, setExtras] = useState([]);
  const [sinCasillaItems, setSinCasillaItems] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  
  const { showConfirmation } = useModal();

  // Listener de Autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setCurrentUser({ uid: user.uid, email: user.email, ...userDoc.data() });
        } else {
          console.warn(`El usuario ${user.email} no tiene un rol asignado.`);
          await signOut(auth);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setInitialising(false);
    });
    return unsubscribe;
  }, []);

  // Listener de Datos de Firestore
  useEffect(() => {
    if (!currentUser) {
        setCouriers([]);
        setEstados([]);
        setEmpresasEnvio([]);
        setFlights([]);
        setPackages([]);
        setExtras([]);
        setSinCasillaItems([]);
        setPendientes([]);
        return;
    }

    const setupListener = (collectionName, setter, orderByField = null) => {
      const collRef = collection(db, collectionName);
      // MODIFICACIÓN: Se elimina el ordenamiento por defecto para 'packages' en la consulta
      // para asegurar que el ordenamiento del lado del cliente sea la única fuente de verdad.
      const q = orderByField && collectionName !== 'packages'
        ? query(collRef, orderBy(orderByField, "desc")) 
        : (collectionName === 'packages' ? query(collRef) : query(collRef, orderBy("name")));
      
      return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setter(items);
      }, (error) => {
        console.error(`Error on snapshot for ${collectionName}:`, error);
      });
    };

    const seedInitialData = async (collectionName, initialData) => {
      if (!initialData) return;
      const collRef = collection(db, collectionName);
      try {
        const snapshot = await getDocs(collRef);
        if (snapshot.empty) {
          console.log(`Seeding initial data for ${collectionName}...`);
          const batch = writeBatch(db);
          initialData.forEach(item => {
            const newDocRef = doc(collRef);
            batch.set(newDocRef, { name: item });
          });
          await batch.commit();
        }
      } catch (error) {
        console.error(`Error seeding collection ${collectionName}:`, error);
      }
    };
    
    const initializeData = async () => {
      await Promise.all([
        seedInitialData("couriers", COURIERS_INICIALES),
        seedInitialData("estados", ESTADOS_INICIALES),
        seedInitialData("empresasEnvio", EMPRESAS_ENVIO_INICIALES),
      ]);

      const unsubscribers = [
        setupListener("couriers", setCouriers),
        setupListener("estados", setEstados),
        setupListener("empresasEnvio", setEmpresasEnvio),
        setupListener("flights", setFlights, "fecha_salida"),
        setupListener("packages", setPackages), // Ordenamiento eliminado de la consulta
        setupListener("extras", setExtras, "fecha"),
        setupListener("sinCasilla", setSinCasillaItems, "fecha"),
        setupListener("pendientes", setPendientes, "fecha"),
      ];

      return () => unsubscribers.forEach(unsub => unsub());
    };

    const cleanupPromise = initializeData();

    return () => {
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };

  }, [currentUser]);
  
  const createCrudHandlers = (collectionName) => ({
    add: async (data) => addDoc(collection(db, collectionName), data),
    update: async (data) => {
      const { id, ...rest } = data;
      await setDoc(doc(db, collectionName, id), rest, { merge: true });
    },
    remove: async (id) => deleteDoc(doc(db, collectionName, id)),
  });

  const couriersHandlers = createCrudHandlers("couriers");
  const estadosHandlers = createCrudHandlers("estados");
  const empresasEnvioHandlers = createCrudHandlers("empresasEnvio");
  const flightsHandlers = createCrudHandlers("flights");
  const packagesHandlers = createCrudHandlers("packages");
  const extrasHandlers = createCrudHandlers("extras");
  const sinCasillaHandlers = createCrudHandlers("sinCasilla");
  const pendientesHandlers = createCrudHandlers("pendientes");

  const moverPaqueteAPendientes = (paquete, casilla) => {
    const nuevaTarea = {
      type: "ASIGNAR_CASILLA", status: "No realizada", fecha: new Date().toISOString().slice(0,10),
      data: {
        numero: paquete.numero, nombre: paquete.nombre,
        tracking: paquete.tracking, casilla: casilla.trim().toUpperCase(),
        foto: paquete.foto || null 
      }
    };
    pendientesHandlers.add(nuevaTarea);
    sinCasillaHandlers.remove(paquete.id);
  };

  useEffect(() => {
    if (currentUser) {
      const allowed = tabsForRole(currentUser.role);
      if (!allowed.includes(tab)) setTab(allowed[0]);
    }
  }, [currentUser, tab]);

  if (initialising) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-lg font-semibold">Cargando...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }
  
  const handleLogout = async () => {
    const confirmed = await showConfirmation("Cerrar Sesión", "¿Estás seguro de que quieres cerrar sesión?");
    if (confirmed) {
        await signOut(auth);
    }
  };

  const allowedTabs = tabsForRole(currentUser.role);
  const navStructure = [
    { category: "Principal", icon: Iconos.dashboard, tabs: ["Dashboard"] },
    { category: "Paquetes", icon: Iconos.paquetes, tabs: ["Recepción", "Paquetes en bodega", "Paquetes sin casilla", "Pendientes"] },
    { category: "Envíos", icon: Iconos.envios, tabs: ["Armado de cajas", "Cargas enviadas", "Gestión de cargas", "Proformas", "Extras"] },
    { category: "Administración", icon: Iconos.gestion, tabs: ["Usuarios"] },
  ];

  const renderTabContent = () => {
    switch (tab) {
      case "Dashboard":
        return <Dashboard packages={packages} flights={flights} pendientes={pendientes} onTabChange={setTab} currentUser={currentUser} />;
      case "Recepción":
        return <Reception currentUser={currentUser} couriers={couriers} setCouriers={couriersHandlers} estados={estados} setEstados={estadosHandlers} empresasEnvio={empresasEnvio} setEmpresasEnvio={empresasEnvioHandlers} flights={flights} packages={packages} onAdd={packagesHandlers.add}/>;
      case "Paquetes sin casilla":
        return <PaquetesSinCasilla currentUser={currentUser} items={sinCasillaItems} onAdd={sinCasillaHandlers.add} onUpdate={sinCasillaHandlers.update} onRemove={sinCasillaHandlers.remove} onAsignarCasilla={moverPaqueteAPendientes} />;
      case "Pendientes":
        return <Pendientes items={pendientes} onAdd={pendientesHandlers.add} onUpdate={pendientesHandlers.update} onRemove={pendientesHandlers.remove} />;
      case "Paquetes en bodega":
        return <PaquetesBodega packages={packages} flights={flights} user={currentUser} onUpdate={packagesHandlers.update} onDelete={packagesHandlers.remove} onPendiente={pendientesHandlers.add} couriers={couriers} empresasEnvio={empresasEnvio} />;
      case "Armado de cajas":
        return <ArmadoCajas packages={packages} flights={flights} onUpdateFlight={flightsHandlers.update} />;
      case "Cargas enviadas":
        return <CargasEnviadas packages={packages} flights={flights} user={currentUser}/>;
      case "Gestión de cargas":
        return <CargasAdmin flights={flights} onAdd={flightsHandlers.add} onUpdate={flightsHandlers.update} onDelete={flightsHandlers.remove} packages={packages}/>;
      case "Proformas":
        return <Proformas packages={packages} flights={flights} extras={extras} user={currentUser}/>;
      case "Usuarios":
        return <Usuarios />;
      case "Extras":
        return <Extras flights={flights} couriers={couriers} extras={extras} onAdd={extrasHandlers.add} onUpdate={extrasHandlers.update} onDelete={extrasHandlers.remove} />;
      default:
        return <div className="text-center p-8 bg-white rounded-lg shadow-md">Selecciona una pestaña</div>;
    }
  };

  return (
    <div className="h-screen w-screen flex bg-slate-100">
      <aside className={`absolute inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 h-16 lg:h-32 border-b border-slate-200 flex items-center justify-center">
            <img src="/logo.png" alt="Logo Europa Envíos" className="max-w-full max-h-full" />
        </div>
        <nav className="flex-grow p-4 space-y-6 overflow-y-auto">
          {navStructure.map(group => {
            const visibleTabs = group.tabs.filter(t => allowedTabs.includes(t));
            if (visibleTabs.length === 0) return null;
            return (
              <div key={group.category}>
                <h3 className="px-2 mb-2 text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  {group.icon}
                  {group.category}
                </h3>
                <ul className="space-y-1">
                  {visibleTabs.map(t => (
                    <li key={t}>
                      <button
                        onClick={() => {
                            setTab(t);
                            setIsSidebarOpen(false); // Cierra el menú en móvil al hacer clic
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 flex items-center gap-3 ${
                          tab === t
                            ? "bg-francia-100 text-francia-700"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                        }`}
                      >
                        {t}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 h-16 flex-shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Abrir menú">
            <MenuIcon />
          </button>
          <div className="flex-grow" />
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-700">{currentUser.email}</p>
              <p className="text-xs text-slate-500">{currentUser.role}{currentUser.role === 'COURIER' && ` (${currentUser.courier})`}</p>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-slate-100 transition-colors duration-200 text-slate-500" title="Cerrar sesión">
              {Iconos.logout}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {renderTabContent()}
        </main>
      </div>

      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-20"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
}

export default App;