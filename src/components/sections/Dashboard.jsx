/* eslint-disable react/prop-types */
import React, { useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

// Componentes
import { Button } from "/src/components/common/Button.jsx";

// Helpers & Constantes
import { Iconos, sum, fmtPeso, COLORS } from "/src/utils/helpers.jsx";

const KpiCard = ({ title, value, icon, color }) => (
  <div className={`bg-white p-6 rounded-xl shadow-md flex items-center gap-6 border-l-4 ${color}`}>
    <div className={`text-3xl ${color.replace('border', 'text')}`}>{icon}</div>
    <div>
      <div className="text-slate-500 text-sm font-medium">{title}</div>
      <div className="text-slate-800 text-3xl font-bold">{value}</div>
    </div>
  </div>
);

// --- Helper para obtener el inicio de la semana (Lunes) ---
const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajuste para que el Lunes sea el primer día
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};


export function Dashboard({ packages, flights, pendientes, onTabChange, currentUser }) {
  const isAdmin = currentUser.role === 'ADMIN';
  const [cargaFilter, setCargaFilter] = useState('Todas');
  
  // --- Estados para las estadísticas semanales ---
  const [kgWeekOffset, setKgWeekOffset] = useState(0);
  const [kgFilter, setKgFilter] = useState('Todos');
  const [packageWeekOffset, setPackageWeekOffset] = useState(0);
  const [packageFilter, setPackageFilter] = useState('Todos');


  const paquetesEnBodega = useMemo(() => {
    const cargasEnBodegaIds = new Set(
        flights
            .filter(f => {
                if (f.estado !== "En bodega") return false;
                const code = (f.codigo || "").toUpperCase();
                if (cargaFilter === 'Aéreas') return code.startsWith('AIR');
                if (cargaFilter === 'Marítimas') return code.startsWith('MAR');
                // Para "Todas", incluimos AIR y MAR
                return code.startsWith('AIR') || code.startsWith('MAR');
            })
            .map(f => f.id)
    );

    let filteredPackages = packages.filter(p => cargasEnBodegaIds.has(p.flight_id));
    
    if (!isAdmin) {
      filteredPackages = filteredPackages.filter(p => p.courier === currentUser.courier);
    }
    return filteredPackages;
  }, [packages, flights, isAdmin, currentUser.courier, cargaFilter]);

  const cargasEnTransito = useMemo(() => flights.filter(f => f.estado === "En tránsito"), [flights]);
  const tareasPendientes = useMemo(() => pendientes.filter(t => t.status === "No realizada"), [pendientes]);

  const weeklyPackageCountData = useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate() + (packageWeekOffset * 7));

    const weekStart = getWeekStart(today);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const packagesInWeek = packages.filter(p => {
        if (!p.fecha || isNaN(new Date(p.fecha))) return false;
        const packageDate = new Date(p.fecha);
        return packageDate >= weekStart && packageDate <= weekEnd;
    });
    
    const filteredPackages = packagesInWeek.filter(p => {
        if (packageFilter === 'Todos') return true;
        const flight = flights.find(f => f.id === p.flight_id);
        if (!flight || !flight.codigo) return false;
        const code = flight.codigo.toUpperCase();
        if (packageFilter === 'Aéreos') return code.startsWith('AIR');
        if (packageFilter === 'Marítimos') return code.startsWith('MAR');
        return false;
    });

    const dailyData = { 'Lunes': 0, 'Martes': 0, 'Miércoles': 0, 'Jueves': 0, 'Viernes': 0, 'Sábado': 0, 'Domingo': 0 };
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    filteredPackages.forEach(p => {
        const dayIndex = new Date(p.fecha).getUTCDay();
        const dayName = dayNames[dayIndex];
        if (dailyData.hasOwnProperty(dayName)) {
            dailyData[dayName]++;
        }
    });

    const chartData = Object.entries(dailyData).map(([name, count]) => ({
        name: name.substring(0, 3),
        paquetes: count
    }));
    
    const orderedChartData = chartData.sort((a, b) => {
        const order = { 'Lun': 1, 'Mar': 2, 'Mié': 3, 'Jue': 4, 'Vie': 5, 'Sáb': 6, 'Dom': 7 };
        return order[a.name] - order[b.name];
    });

    return {
        chartData: orderedChartData,
        weekStart,
        weekEnd,
        totalPackages: filteredPackages.length
    };
  }, [packages, flights, packageWeekOffset, packageFilter]);

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
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value); // Ordenar de mayor a menor
  }, [paquetesEnBodega, isAdmin, currentUser.courier]);

  const totalKgBodega = useMemo(() => sum(kgPorCourier.map(c => c.value)), [kgPorCourier]);

  // --- Lógica para la nueva estadística semanal ---
  const weeklyKgData = useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate() + (kgWeekOffset * 7));

    const weekStart = getWeekStart(today);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const packagesInWeek = packages.filter(p => {
        if (!p.fecha || isNaN(new Date(p.fecha))) return false;
        const packageDate = new Date(p.fecha);
        return packageDate >= weekStart && packageDate <= weekEnd;
    });
    
    const filteredPackages = packagesInWeek.filter(p => {
        if (kgFilter === 'Todos') return true;
        const flight = flights.find(f => f.id === p.flight_id);
        if (!flight || !flight.codigo) return false;
        const code = flight.codigo.toUpperCase();
        if (kgFilter === 'Aéreos') return code.startsWith('AIR');
        if (kgFilter === 'Marítimos') return code.startsWith('MAR');
        return false;
    });

    const dailyData = { 'Lunes': 0, 'Martes': 0, 'Miércoles': 0, 'Jueves': 0, 'Viernes': 0, 'Sábado': 0, 'Domingo': 0 };
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    filteredPackages.forEach(p => {
        const dayIndex = new Date(p.fecha).getUTCDay();
        const dayName = dayNames[dayIndex];
        if (dailyData.hasOwnProperty(dayName)) {
            dailyData[dayName] += p.peso_real || 0;
        }
    });

    const chartData = Object.entries(dailyData).map(([name, kg]) => ({
        name: name.substring(0, 3),
        kg: parseFloat(kg.toFixed(3))
    }));

    const orderedChartData = chartData.sort((a, b) => {
        const order = { 'Lun': 1, 'Mar': 2, 'Mié': 3, 'Jue': 4, 'Vie': 5, 'Sáb': 6, 'Dom': 7 };
        return order[a.name] - order[b.name];
    });

    return {
        chartData: orderedChartData,
        weekStart,
        weekEnd,
        totalKg: sum(filteredPackages.map(p => p.peso_real))
    };
  }, [packages, flights, kgWeekOffset, kgFilter]);


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
            <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                <h3 className="font-semibold text-slate-700">Paquetes recibidos por semana</h3>
                <div className="flex items-center gap-2">
                    <Button onClick={() => setPackageWeekOffset(packageWeekOffset - 1)}>{"<"}</Button>
                    <span className="text-sm text-slate-600 text-center w-44 md:w-48">
                        {weeklyPackageCountData.weekStart.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - {weeklyPackageCountData.weekEnd.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                    <Button onClick={() => setPackageWeekOffset(packageWeekOffset + 1)} disabled={packageWeekOffset >= 0}>{">"}</Button>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                    <Button onClick={() => setPackageFilter('Todos')} className={`text-xs !px-2 !py-1 ${packageFilter === 'Todos' ? 'bg-white shadow' : 'bg-transparent shadow-none'}`}>Todos</Button>
                    <Button onClick={() => setPackageFilter('Aéreos')} className={`text-xs !px-2 !py-1 ${packageFilter === 'Aéreos' ? 'bg-white shadow' : 'bg-transparent shadow-none'}`}>Aéreos</Button>
                    <Button onClick={() => setPackageFilter('Marítimos')} className={`text-xs !px-2 !py-1 ${packageFilter === 'Marítimos' ? 'bg-white shadow' : 'bg-transparent shadow-none'}`}>Marítimos</Button>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklyPackageCountData.chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false}/>
                    <Tooltip />
                    <Bar dataKey="paquetes" fill="#4f46e5" name="Paquetes"/>
                </BarChart>
            </ResponsiveContainer>
            <div className="text-right font-bold mt-2 text-slate-700">
                Total semanal: {weeklyPackageCountData.totalPackages} paquetes
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-700">Resumen de kg en bodega</h3>
            <select 
              className="text-sm rounded-lg border-slate-300 px-2 py-1"
              value={cargaFilter}
              onChange={(e) => setCargaFilter(e.target.value)}
            >
              <option value="Todas">Todas las cargas</option>
              <option value="Aéreas">Cargas Aéreas</option>
              <option value="Marítimas">Cargas Marítimas</option>
            </select>
          </div>
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
            ) : <div className="flex items-center justify-center h-full w-full text-slate-500">No hay paquetes en bodega para el filtro seleccionado</div> }
            </div>
        </div>
        
        {/* --- NUEVA SECCIÓN DE ESTADÍSTICA SEMANAL --- */}
        {isAdmin && (
            <div className="bg-white p-6 rounded-xl shadow-md lg:col-span-2">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                    <h3 className="font-semibold text-slate-700">Kilos recibidos por semana</h3>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => setKgWeekOffset(kgWeekOffset - 1)}>{"<"}</Button>
                        <span className="text-sm text-slate-600 text-center w-44 md:w-48">
                            {weeklyKgData.weekStart.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - {weeklyKgData.weekEnd.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                        <Button onClick={() => setKgWeekOffset(kgWeekOffset + 1)} disabled={kgWeekOffset >= 0}>{">"}</Button>
                    </div>
                    <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                        <Button onClick={() => setKgFilter('Todos')} className={`text-xs !px-2 !py-1 ${kgFilter === 'Todos' ? 'bg-white shadow' : 'bg-transparent shadow-none'}`}>Todos</Button>
                        <Button onClick={() => setKgFilter('Aéreos')} className={`text-xs !px-2 !py-1 ${kgFilter === 'Aéreos' ? 'bg-white shadow' : 'bg-transparent shadow-none'}`}>Aéreos</Button>
                        <Button onClick={() => setKgFilter('Marítimos')} className={`text-xs !px-2 !py-1 ${kgFilter === 'Marítimos' ? 'bg-white shadow' : 'bg-transparent shadow-none'}`}>Marítimos</Button>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={weeklyKgData.chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis unit="kg" width={40}/>
                        <Tooltip formatter={(value) => `${fmtPeso(value)} kg`} />
                        <Bar dataKey="kg" fill="#4f46e5" name="Kilos" />
                    </BarChart>
                </ResponsiveContainer>
                <div className="text-right font-bold mt-2 text-slate-700">
                    Total semanal: {fmtPeso(weeklyKgData.totalKg)} kg
                </div>
            </div>
        )}
      </div>
    </div>
  );
}