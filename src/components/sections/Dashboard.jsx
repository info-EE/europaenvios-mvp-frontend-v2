/* eslint-disable react/prop-types */
import React, { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

// Componentes
import { Button } from "../common/Button.jsx";

// Helpers & Constantes
import { Iconos, sum, fmtPeso, COLORS } from "../../utils/helpers.jsx";

const KpiCard = ({ title, value, icon, color }) => (
  <div className={`bg-white p-6 rounded-xl shadow-md flex items-center gap-6 border-l-4 ${color}`}>
    <div className={`text-3xl ${color.replace('border', 'text')}`}>{icon}</div>
    <div>
      <div className="text-slate-500 text-sm font-medium">{title}</div>
      <div className="text-slate-800 text-3xl font-bold">{value}</div>
    </div>
  </div>
);

export function Dashboard({ packages, flights, pendientes, onTabChange, currentUser }) {
  const isAdmin = currentUser.role === 'ADMIN';

  const paquetesEnBodega = useMemo(() => {
    let filteredPackages = packages.filter(p => flights.find(f => f.id === p.flight_id)?.estado === "En bodega");
    if (!isAdmin) {
      filteredPackages = filteredPackages.filter(p => p.courier === currentUser.courier);
    }
    return filteredPackages;
  }, [packages, flights, isAdmin, currentUser.courier]);

  const cargasEnTransito = useMemo(() => flights.filter(f => f.estado === "En tránsito"), [flights]);
  const tareasPendientes = useMemo(() => pendientes.filter(t => t.status === "No realizada"), [pendientes]);

  const paquetesPorDia = useMemo(() => {
    const data = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(5, 10); // MM-DD
        data[key] = 0;
    }
    let packagesToProcess = packages;
    if (!isAdmin) {
        packagesToProcess = packages.filter(p => p.courier === currentUser.courier);
    }
    packagesToProcess.forEach(p => {
        const d = new Date(p.fecha);
        const key = d.toISOString().slice(5, 10);
        if (data[key] !== undefined) {
            data[key]++;
        }
    });
    return Object.entries(data).map(([name, value]) => ({ name, paquetes: value }));
  }, [packages, isAdmin, currentUser.courier]);

  const kgPorCourier = useMemo(() => {
    const agg = {};
    let packagesToProcess = paquetesEnBodega;
    if (!isAdmin) {
        packagesToProcess = packagesToProcess.filter(p => p.courier === currentUser.courier);
    }
    packagesToProcess.forEach(p => {
        agg[p.courier] = (agg[p.courier] || 0) + p.peso_real;
    });
    return Object.entries(agg)
        .filter(([, kg]) => kg > 0)
        .map(([name, value]) => ({ name, value }));
  }, [paquetesEnBodega, isAdmin, currentUser.courier]);

  const totalKgBodega = useMemo(() => sum(kgPorCourier.map(c => c.value)), [kgPorCourier]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <KpiCard title="Paquetes en Bodega" value={paquetesEnBodega.length} icon={Iconos.box} color="border-francia-500" />
        {isAdmin && <KpiCard title="Cargas en Tránsito" value={cargasEnTransito.length} icon={Iconos.envios} color="border-amber-500" />}
        {isAdmin && <KpiCard title="Tareas Pendientes" value={tareasPendientes.length} icon={Iconos.gestion} color="border-red-500" />}
      </div>

      {isAdmin && (
        <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Acciones Rápidas</h2>
            <div className="flex flex-wrap gap-4">
                <Button variant="primary" onClick={() => onTabChange("Recepción")}>Registrar Nuevo Paquete</Button>
                <Button variant="primary" onClick={() => onTabChange("Gestión de cargas")}>Crear Nueva Carga</Button>
                <Button variant="primary" onClick={() => onTabChange("Armado de cajas")}>Armar Cajas</Button>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="font-semibold text-slate-700 mb-4">Paquetes recibidos (últimos 7 días)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={paquetesPorDia} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="paquetes" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md flex flex-col">
           <h3 className="font-semibold text-slate-700 mb-4">Kg Reales por Courier (en bodega)</h3>
           <div className="flex-grow flex items-center">
            {kgPorCourier.length > 0 ? (
                <>
                <ResponsiveContainer width="50%" height="100%">
                    <PieChart>
                        <Pie data={kgPorCourier} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80}>
                        {kgPorCourier.map((_, i) => (
                            <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                        ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${fmtPeso(value)} kg`} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="w-1/2 text-sm pl-4">
                    <ul>
                        {kgPorCourier.map((entry, index) => (
                            <li key={`item-${index}`} className="flex justify-between items-center py-1 border-b border-slate-100">
                                <span className="flex items-center"><div className="w-3 h-3 mr-2 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{entry.name}</span>
                                <span className="font-semibold">{fmtPeso(entry.value)} kg</span>
                            </li>
                        ))}
                         <li className="flex justify-between items-center py-2 font-bold mt-2 border-t-2 border-slate-300">
                            <span>TOTAL</span>
                            <span>{fmtPeso(totalKgBodega)} kg</span>
                        </li>
                    </ul>
                </div>
                </>
            ) : <div className="flex items-center justify-center h-full w-full text-slate-500">No hay paquetes en bodega</div> }
            </div>
        </div>
      </div>
    </div>
  );
}