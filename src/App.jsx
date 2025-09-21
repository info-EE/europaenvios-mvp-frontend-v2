/* Europa Envíos – MVP (Refactorizado) */

import React, { useEffect, useState } from "react";

// Firebase
import { db, auth, signOut, onAuthStateChanged } from "./firebase";
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, query, orderBy, getDoc } from "firebase/firestore";

// Componentes de Secciones
import { Login } from "./components/sections/Login";
import { Dashboard } from "./components/sections/Dashboard";
import { Reception } from "./components/sections/Reception";
import { PaquetesSinCasilla } from "./components/sections/PaquetesSinCasilla";
import { Usuarios } from "./components/sections/Usuarios";
import { Pendientes } from "./components/sections/Pendientes";
import { PaquetesBodega } from "./components/sections/PaquetesBodega";
import { ArmadoCajas } from "./components/sections/ArmadoCajas";
import { CargasEnviadas } from "./components/sections/CargasEnviadas";
import { CargasAdmin } from "./components/sections/CargasAdmin";
import { Proformas } from "./components/sections/Proformas";
import { Extras } from "./components/sections/Extras";


// Helpers y Constantes
import { Iconos, tabsForRole, COURIERS_INICIALES, ESTADOS_INICIALES } from "./utils/helpers.jsx";

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [initialising, setInitialising] = useState(true);
  const [tab, setTab] = useState("Dashboard");

  // Estados de datos
  const [couriers, setCouriers] = useState([]);
  const [estados, setEstados] = useState([]);
  const [flights, setFlights] = useState([]);
  const [packages, setPackages] = useState([]);
  const [extras, setExtras] = useState([]);
  const [sinCasillaItems, setSinCasillaItems] = useState([]);
  const [pendientes, setPendientes] = useState([]);

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
      setFlights([]); setPackages([]); setCouriers([]); setEstados([]);
      setExtras([]); setSinCasillaItems([]); setPendientes([]);
      return;
    }

    const createListener = (collectionName, setter, initialData, orderByField = null) => {
      const collRef = orderByField
        ? query(collection(db, collectionName), orderBy(orderByField, "desc"))
        : collection(db, collectionName);

      return onSnapshot(collRef, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        if (items.length === 0 && initialData) {
          initialData.forEach(item => addDoc(collection(db, collectionName), { name: item }));
        }
        setter(items);
      });
    };

    const unsubscribers = [
      createListener("couriers", setCouriers, COURIERS_INICIALES),
      createListener("estados", setEstados, ESTADOS_INICIALES),
      createListener("flights", setFlights, null, "fecha_salida"),
      createListener("packages", setPackages, null, "fecha"),
      createListener("extras", setExtras, null, "fecha"),
      createListener("sinCasilla", setSinCasillaItems, null, "fecha"),
      createListener("pendientes", setPendientes, null, "fecha"),
    ];

    return () => unsubscribers.forEach(unsub => unsub());
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
        // --- CAMBIO AÑADIDO ---
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
    await signOut(auth);
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
        return <Reception currentUser={currentUser} couriers={couriers} setCouriers={couriersHandlers} estados={estados} setEstados={estadosHandlers} flights={flights} packages={packages} onAdd={packagesHandlers.add}/>;
      case "Paquetes sin casilla":
        return <PaquetesSinCasilla currentUser={currentUser} items={sinCasillaItems} onAdd={sinCasillaHandlers.add} onUpdate={sinCasillaHandlers.update} onRemove={sinCasillaHandlers.remove} onAsignarCasilla={moverPaqueteAPendientes} />;
      case "Pendientes":
        return <Pendientes items={pendientes} onAdd={pendientesHandlers.add} onUpdate={pendientesHandlers.update} onRemove={pendientesHandlers.remove} />;
      case "Paquetes en bodega":
        return <PaquetesBodega packages={packages} flights={flights} user={currentUser} onUpdate={packagesHandlers.update} onDelete={packagesHandlers.remove} onPendiente={pendientesHandlers.add} />;
      case "Armado de cajas":
        return <ArmadoCajas packages={packages} flights={flights} onUpdateFlight={flightsHandlers.update} onAssign={()=>{}}/>;
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
    <div className="h-screen w-screen grid grid-cols-[256px_1fr] grid-rows-[auto_1fr] bg-slate-100">
      <aside className="row-span-2 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 h-32 border-b border-slate-200 flex items-center justify-center">
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
                        onClick={() => setTab(t)}
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

      <header className="bg-white border-b border-slate-200 flex items-center justify-end px-6 h-16">
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-700">{currentUser.email}</p>
            <p className="text-xs text-slate-500">{currentUser.role}{currentUser.role === 'COURIER' && ` (${currentUser.courier})`}</p>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-slate-100 transition-colors duration-200 text-slate-500" title="Cerrar sesión">
            {Iconos.logout}
          </button>
        </div>
      </header>

      <main className="overflow-y-auto p-4 sm:p-6 lg:p-8">
        {renderTabContent()}
      </main>
    </div>
  );
}

export default App;