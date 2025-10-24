/* eslint-disable react/prop-types */
import React, { useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

// Componentes
// Corregido: Rutas relativas
import { Button } from "../common/Button.jsx";

// Helpers & Constantes
// Corregido: Rutas relativas
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

// --- Helper para obtener el inicio de la semana (Lunes 00:00 UTC) ---
const getUTCWeekStart = (date) => {
    const d = new Date(date);
    // Ajusta la fecha al inicio del día UTC
    d.setUTCHours(0, 0, 0, 0);
    // Obtiene el día de la semana UTC (0=Domingo, 1=Lunes, ..., 6=Sábado)
    const utcDay = d.getUTCDay();
    // Calcula la diferencia en días para llegar al Lunes anterior
    // Si es Domingo (0), retrocede 6 días. Si es Lunes (1), retrocede 0 días. etc.
    const diff = d.getUTCDate() - utcDay + (utcDay === 0 ? -6 : 1);
    // Establece la fecha al Lunes correspondiente en UTC
    d.setUTCDate(diff);
    return d; // Retorna el objeto Date ajustado a Lunes 00:00 UTC
};

// --- Helper para parsear la fecha del paquete como UTC ---
// Asume que p.fecha es un string 'YYYY-MM-DD'
const parsePackageDateAsUTC = (packageDateString) => {
    if (!packageDateString || typeof packageDateString !== 'string') return null;
    try {
        // Añade 'T00:00:00Z' para asegurar que se interprete como UTC midnight
        const date = new Date(packageDateString + 'T00:00:00Z');
        // Verifica si la fecha es válida
        if (isNaN(date.getTime())) return null;
        return date;
    } catch (e) {
        console.error("Error parsing date string:", packageDateString, e);
        return null;
    }
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

  // --- Lógica de Paquetes Semanales (modificada para UTC) ---
  const weeklyPackageCountData = useMemo(() => {
    const today = new Date();
    // Aplica el offset semanal a la fecha actual
    today.setUTCDate(today.getUTCDate() + (packageWeekOffset * 7));

    // Calcula el inicio de la semana actual o desplazada en UTC
    const weekStart = getUTCWeekStart(today);

    // Calcula el fin de la semana (Domingo 23:59:59.999 UTC)
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);

    // Filtra los paquetes que caen dentro de la semana UTC calculada
    const packagesInWeek = packages.filter(p => {
        const packageDate = parsePackageDateAsUTC(p.fecha);
        // Compara fechas UTC
        return packageDate && packageDate >= weekStart && packageDate <= weekEnd;
    });

    // Filtra adicionalmente por tipo de carga (Aéreo/Marítimo/Todos)
    const filteredPackages = packagesInWeek.filter(p => {
        if (packageFilter === 'Todos') return true;
        const flight = flights.find(f => f.id === p.flight_id);
        if (!flight || !flight.codigo) return false;
        const code = flight.codigo.toUpperCase();
        if (packageFilter === 'Aéreos') return code.startsWith('AIR');
        if (packageFilter === 'Marítimos') return code.startsWith('MAR');
        return false;
    });

    // Agrupa los paquetes por día de la semana (UTC)
    const dailyData = { 'Lunes': 0, 'Martes': 0, 'Miércoles': 0, 'Jueves': 0, 'Viernes': 0, 'Sábado': 0, 'Domingo': 0 };
    // Mapeo de getUTCDay() a nombres de días (0=Dom, 1=Lun...)
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    filteredPackages.forEach(p => {
        const packageDate = parsePackageDateAsUTC(p.fecha);
        if (packageDate) {
            const dayIndex = packageDate.getUTCDay(); // Usa el día UTC
            const dayName = dayNames[dayIndex];
            if (dailyData.hasOwnProperty(dayName)) {
                dailyData[dayName]++;
            }
        }
    });

    // Prepara los datos para el gráfico
    const chartData = Object.entries(dailyData).map(([name, count]) => ({
        name: name.substring(0, 3), // Abreviatura del día
        paquetes: count
    }));

    // Ordena los datos del gráfico por día de la semana (Lun-Dom)
    const orderedChartData = chartData.sort((a, b) => {
        const order = { 'Lun': 1, 'Mar': 2, 'Mié': 3, 'Jue': 4, 'Vie': 5, 'Sáb': 6, 'Dom': 7 };
        return order[a.name] - order[b.name];
    });

    return {
        chartData: orderedChartData,
        weekStart, // Fecha de inicio de semana (UTC)
        weekEnd,   // Fecha de fin de semana (UTC)
        totalPackages: filteredPackages.length // Total de paquetes en la semana filtrada
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

  // --- Lógica de Kilos Semanales (modificada para UTC) ---
  const weeklyKgData = useMemo(() => {
    const today = new Date();
    // Aplica el offset semanal a la fecha actual
    today.setUTCDate(today.getUTCDate() + (kgWeekOffset * 7));

    // Calcula el inicio de la semana actual o desplazada en UTC
    const weekStart = getUTCWeekStart(today);

    // Calcula el fin de la semana (Domingo 23:59:59.999 UTC)
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);

    // Filtra los paquetes que caen dentro de la semana UTC calculada
    const packagesInWeek = packages.filter(p => {
        const packageDate = parsePackageDateAsUTC(p.fecha);
        // Compara fechas UTC
        return packageDate && packageDate >= weekStart && packageDate <= weekEnd;
    });

    // Filtra adicionalmente por tipo de carga (Aéreo/Marítimo/Todos)
    const filteredPackages = packagesInWeek.filter(p => {
        if (kgFilter === 'Todos') return true;
        const flight = flights.find(f => f.id === p.flight_id);
        if (!flight || !flight.codigo) return false;
        const code = flight.codigo.toUpperCase();
        if (kgFilter === 'Aéreos') return code.startsWith('AIR');
        if (kgFilter === 'Marítimos') return code.startsWith('MAR');
        return false;
    });

    // Agrupa los kilos por día de la semana (UTC)
    const dailyData = { 'Lunes': 0, 'Martes': 0, 'Miércoles': 0, 'Jueves': 0, 'Viernes': 0, 'Sábado': 0, 'Domingo': 0 };
    // Mapeo de getUTCDay() a nombres de días (0=Dom, 1=Lun...)
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    filteredPackages.forEach(p => {
        const packageDate = parsePackageDateAsUTC(p.fecha);
        if (packageDate) {
            const dayIndex = packageDate.getUTCDay(); // Usa el día UTC
            const dayName = dayNames[dayIndex];
            if (dailyData.hasOwnProperty(dayName)) {
                dailyData[dayName] += p.peso_real || 0;
            }
        }
    });

    // Prepara los datos para el gráfico
    const chartData = Object.entries(dailyData).map(([name, kg]) => ({
        name: name.substring(0, 3), // Abreviatura del día
        kg: parseFloat(kg.toFixed(3))
    }));

    // Ordena los datos del gráfico por día de la semana (Lun-Dom)
    const orderedChartData = chartData.sort((a, b) => {
        const order = { 'Lun': 1, 'Mar': 2, 'Mié': 3, 'Jue': 4, 'Vie': 5, 'Sáb': 6, 'Dom': 7 };
        return order[a.name] - order[b.name];
    });

    return {
        chartData: orderedChartData,
        weekStart, // Fecha de inicio de semana (UTC)
        weekEnd,   // Fecha de fin de semana (UTC)
        totalKg: sum(filteredPackages.map(p => p.peso_real)) // Total de kilos en la semana filtrada
    };
  }, [packages, flights, kgWeekOffset, kgFilter]);

  // --- START: Lógica para Estado de Cargas (SEPARADA) ---
  const estadoCargasData = useMemo(() => {
    // Ordenar todas las cargas por fecha de salida descendente
    const sortedFlights = [...flights].sort((a, b) => (b.fecha_salida || "").localeCompare(a.fecha_salida || ""));

    // Mapear datos comunes
    const mapFlightData = (flight) => {
        const totalWeight = sum(packages.filter(p => p.flight_id === flight.id).map(p => p.peso_real)); // Calcular peso directamente
        const boxCount = flight.cajas?.length || 0; // Contar cajas directamente desde el objeto flight
        return {
          id: flight.id,
          nombre: flight.codigo,
          fechaSalida: flight.fecha_salida || 'N/A', // Añadir fecha de salida
          pesoTotal: totalWeight,
          cantidadCajas: boxCount, // Cambiado de cantidadPaquetes a cantidadCajas
          estado: flight.estado
        };
    };

    // Filtrar, mapear y tomar las últimas 10 aéreas
    const latestAir = sortedFlights
        .filter(f => (f.codigo || "").toUpperCase().startsWith('AIR'))
        .slice(0, 10)
        .map(mapFlightData);

    // Filtrar, mapear y tomar las últimas 6 marítimas
    const latestSea = sortedFlights
        .filter(f => (f.codigo || "").toUpperCase().startsWith('MAR'))
        .slice(0, 6)
        .map(mapFlightData);

    return { latestAir, latestSea }; // Devolver objeto con las dos listas
  }, [flights, packages]); // Dependencia 'packages' necesaria para calcular peso total
  // --- END: Lógica para Estado de Cargas ---

  // Función para formatear las fechas de la semana para mostrar en la UI
  // Muestra las fechas en el formato local del usuario para mejor legibilidad
  const formatWeekRangeForDisplay = (startDateUTC, endDateUTC) => {
    const options = { day: '2-digit', month: '2-digit' };
    const yearOption = { year: 'numeric' };
    const startStr = startDateUTC.toLocaleDateString('es-ES', options);
    // Muestra el año solo en la fecha de fin
    const endStr = endDateUTC.toLocaleDateString('es-ES', {...options, ...yearOption});
    return `${startStr} - ${endStr}`;
  };

  // Componente reutilizable para la tabla de estado de cargas
  const EstadoCargasTable = ({ title, data }) => (
    // Contenedor individual con estilo de gráfico
    <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Nombre Carga</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Fecha Salida</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Peso Total (kg)</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Nº Cajas</th> {/* Cambiado */}
                <th className="px-3 py-2 text-left font-semibold text-slate-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.length > 0 ? data.map(carga => (
                <tr key={carga.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap">{carga.nombre}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{carga.fechaSalida}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(carga.pesoTotal)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{carga.cantidadCajas}</td> {/* Cambiado */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        carga.estado === 'En bodega' ? 'bg-blue-100 text-blue-800' :
                        carga.estado === 'En tránsito' ? 'bg-yellow-100 text-yellow-800' :
                        carga.estado === 'Arribada' ? 'bg-purple-100 text-purple-800' :
                        carga.estado === 'Entregada' ? 'bg-green-100 text-green-800' :
                        carga.estado === 'Cobrada' ? 'bg-teal-100 text-teal-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                      {carga.estado}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  {/* Actualizado colSpan a 5 */}
                  <td colSpan="5" className="px-3 py-4 text-center text-slate-500">No hay cargas recientes para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
  );


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

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Gráfico de Paquetes Recibidos */}
        <div className="bg-white p-6 rounded-xl shadow-md">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                <h3 className="font-semibold text-slate-700">Paquetes recibidos por semana</h3>
                <div className="flex items-center gap-2">
                    <Button onClick={() => setPackageWeekOffset(packageWeekOffset - 1)}>{"<"}</Button>
                    <span className="text-sm text-slate-600 text-center w-44 md:w-48">
                        {formatWeekRangeForDisplay(weeklyPackageCountData.weekStart, weeklyPackageCountData.weekEnd)}
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
                <BarChart data={weeklyPackageCountData.chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} width={60}/>
                    <Tooltip />
                    <Bar dataKey="paquetes" fill="#4f46e5" name="Paquetes"/>
                </BarChart>
            </ResponsiveContainer>
            <div className="text-right font-bold mt-2 text-slate-700">
                Total semanal: {weeklyPackageCountData.totalPackages} paquetes
            </div>
        </div>

        {/* Gráfico Resumen KG en Bodega */}
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

        {/* Gráfico de Kilos Recibidos por Semana */}
        {isAdmin && (
            <div className="bg-white p-6 rounded-xl shadow-md lg:col-span-2">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                    <h3 className="font-semibold text-slate-700">Kilos recibidos por semana</h3>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => setKgWeekOffset(kgWeekOffset - 1)}>{"<"}</Button>
                         <span className="text-sm text-slate-600 text-center w-44 md:w-48">
                           {formatWeekRangeForDisplay(weeklyKgData.weekStart, weeklyKgData.weekEnd)}
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
                    <BarChart data={weeklyKgData.chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis unit="kg" width={60}/>
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

       {/* START: Sección Estado de Cargas (Movida al final y en recuadros separados) */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8"> {/* Nuevo grid para las tablas */}
         <EstadoCargasTable title="Estado de Cargas Aéreas (Últimas 10)" data={estadoCargasData.latestAir} />
         <EstadoCargasTable title="Estado de Cargas Marítimas (Últimas 6)" data={estadoCargasData.latestSea} />
       </div>
      {/* END: Sección Estado de Cargas */}

    </div>
  );
}