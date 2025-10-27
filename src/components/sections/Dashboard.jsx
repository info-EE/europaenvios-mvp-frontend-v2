/* eslint-disable react/prop-types */
import React, { useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

// Componentes
// Corrected: Use relative paths
import { Button } from "../common/Button.jsx";

// Helpers & Constantes
// Corrected: Use relative paths
import { Iconos, sum, fmtPeso, COLORS } from "../../utils/helpers.jsx";


// --- START: Icons for Courier Dashboard ---
// Airplane Icon (unchanged)
const AirplaneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5" />
    </svg>
);


// New "Water/Ocean" Icon
const WaterIcon = () => (
     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
       <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM17.25 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM17.25 18.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
       <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 6.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 18.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
       <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM8.25 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM8.25 18.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
     </svg>
);
// --- END: Icons for Courier Dashboard ---

// KPI Card for both Admin and Courier
const KpiCard = ({ title, value, subValue, icon, color }) => (
    <div className={`bg-white p-4 sm:p-6 rounded-xl shadow-md flex items-center gap-4 border-l-4 ${color}`}>
        {/* Updated Icon size */}
        <div className={`text-3xl ${color.replace('border-', 'text-')}`}>{icon}</div>
        <div>
            <div className="text-slate-500 text-sm font-medium">{title}</div>
            <div className="text-slate-800 text-2xl sm:text-3xl font-bold">{value}</div>
            {/* Display subValue only if it exists */}
            {subValue && <div className="text-slate-500 text-xs sm:text-sm">{subValue}</div>}
        </div>
    </div>
);

// Helper function to get the start of the week (Monday 00:00 UTC)
const getUTCWeekStart = (date) => {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    const utcDay = d.getUTCDay();
    const diff = d.getUTCDate() - utcDay + (utcDay === 0 ? -6 : 1);
    d.setUTCDate(diff);
    return d;
};

// Helper function to parse package date string as UTC
const parsePackageDateAsUTC = (packageDateString) => {
    if (!packageDateString || typeof packageDateString !== 'string') return null;
    try {
        const date = new Date(packageDateString + 'T00:00:00Z');
        if (isNaN(date.getTime())) return null;
        return date;
    } catch (e) {
        console.error("Error parsing date string:", packageDateString, e);
        return null;
    }
};

// Reusable table component for cargo status
const EstadoCargasTable = ({ title, data, showBoxCount = true }) => (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead>
                    <tr className="bg-slate-50">
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Nombre Carga</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Fecha Salida</th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Peso Total (kg)</th>
                        {showBoxCount && <th className="px-3 py-2 text-left font-semibold text-slate-600">Nº Cajas</th>}
                        <th className="px-3 py-2 text-left font-semibold text-slate-600">Estado</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {data.length > 0 ? data.map(carga => (
                        <tr key={carga.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 whitespace-nowrap">{carga.nombre}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{carga.fechaSalida}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(carga.pesoTotal)}</td>
                            {showBoxCount && <td className="px-3 py-2 whitespace-nowrap">{carga.cantidadCajas}</td>}
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
                            <td colSpan={showBoxCount ? 5 : 4} className="px-3 py-4 text-center text-slate-500">No hay cargas recientes para mostrar.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
);

// Custom Label for Pie Chart - Now always shows value
const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, name }) => {
  // Position label slightly outside the outer radius for better readability
  const radius = outerRadius * 1.1;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  // Determine text anchor based on position
  const textAnchor = x > cx ? 'start' : 'end';

  return (
    <text x={x} y={y} fill="#334155" textAnchor={textAnchor} dominantBaseline="central" fontSize="12px" fontWeight="semibold">
      {`${name}: ${value}`}
    </text>
  );
};


// Main Dashboard Component
export function Dashboard({ packages, flights, pendientes, onTabChange, currentUser }) {
    const isAdmin = currentUser.role === 'ADMIN';
    const isCourier = currentUser.role === 'COURIER';
    const courierName = isCourier ? currentUser.courier : null;

    // --- State specific to Admin ---
    const [cargaFilter, setCargaFilter] = useState('Todas'); // For Admin's KG Pie Chart filter
    const [kgWeekOffset, setKgWeekOffset] = useState(0); // For Admin's KG Bar Chart
    const [kgFilter, setKgFilter] = useState('Todos'); // For Admin's KG Bar Chart
    const [packageWeekOffset, setPackageWeekOffset] = useState(0); // For Admin's Package Bar Chart
    const [packageFilter, setPackageFilter] = useState('Todos'); // For Admin's Package Bar Chart

    // --- Common Calculations (used by both Admin and Courier, filtered later if needed) ---
    const cargasEnBodega = useMemo(() => flights.filter(f => f.estado === "En bodega"), [flights]);
    const cargasEnBodegaIdsSet = useMemo(() => new Set(cargasEnBodega.map(f => f.id)), [cargasEnBodega]);


    const paquetesEnBodega = useMemo(() => {
        return packages.filter(p => cargasEnBodegaIdsSet.has(p.flight_id));
    }, [packages, cargasEnBodegaIdsSet]);

    // --- Calculations specific to Courier ---
    const courierPaquetesEnBodega = useMemo(() => {
        if (!isCourier) return [];
        return paquetesEnBodega.filter(p => p.courier === courierName);
    }, [isCourier, paquetesEnBodega, courierName]);

    // Courier Package Counts by Type (Updated Logic)
    const courierPackageCounts = useMemo(() => {
        if (!isCourier) return { air: 0, sea: 0, complicated: 0, total: 0 };

        let airCount = 0;
        let seaCount = 0;
        let complicatedCount = 0;

        // Find the specific flight ID for 'Complicados' - Assuming its code starts with 'COMP'
        const complicatedFlight = cargasEnBodega.find(f => (f.codigo || "").toUpperCase().startsWith('COMP'));
        const complicatedFlightId = complicatedFlight ? complicatedFlight.id : null;

        // Find flight IDs for 'MAR-MULTI'
        const seaFlightIds = new Set(
            cargasEnBodega.filter(f => (f.codigo || "").toUpperCase().startsWith('MAR-MULTI')).map(f => f.id)
        );

        courierPaquetesEnBodega.forEach(p => {
            if (p.flight_id === complicatedFlightId) {
                complicatedCount++;
            } else if (seaFlightIds.has(p.flight_id)) {
                seaCount++;
            } else {
                // If not complicated and not MAR-MULTI, assume it's air (part of any other flight in bodega)
                airCount++;
            }
        });

        return { air: airCount, sea: seaCount, complicated: complicatedCount, total: courierPaquetesEnBodega.length };

    }, [isCourier, courierPaquetesEnBodega, cargasEnBodega]);


    const courierKgSummary = useMemo(() => {
        if (!isCourier) return { air: [], sea: [] };
        const airSummary = {};
        const seaSummary = {};
        const airFlights = new Set(cargasEnBodega.filter(f => (f.codigo || "").toUpperCase().startsWith('AIR')).map(f => f.id));
        const seaFlights = new Set(cargasEnBodega.filter(f => (f.codigo || "").toUpperCase().startsWith('MAR')).map(f => f.id));

        courierPaquetesEnBodega.forEach(p => {
            const flight = flights.find(f => f.id === p.flight_id);
            if (!flight) return;
            // Exclude complicated packages from KG summary
            if (flight.codigo?.toUpperCase().startsWith('COMP')) return;

            const flightCode = flight.codigo || "Sin Código";

            if (airFlights.has(p.flight_id)) {
                if (!airSummary[flightCode]) airSummary[flightCode] = { count: 0, weight: 0 };
                // airSummary[flightCode].count++; // No longer needed
                airSummary[flightCode].weight += (p.peso_real || 0);
            } else if (seaFlights.has(p.flight_id)) {
                 if (!seaSummary[flightCode]) seaSummary[flightCode] = { count: 0, weight: 0 };
                // seaSummary[flightCode].count++; // No longer needed
                seaSummary[flightCode].weight += (p.peso_real || 0);
            }
        });

        // We only need the total weight now
        const totalAirWeight = sum(Object.values(airSummary).map(data => data.weight));
        const totalSeaWeight = sum(Object.values(seaSummary).map(data => data.weight));

        return { airTotal: totalAirWeight, seaTotal: totalSeaWeight };

    }, [isCourier, courierPaquetesEnBodega, flights, cargasEnBodega]);


    // Check if courier has packages missing CI/RUC
    const courierHasMissingCiRuc = useMemo(() => {
        if (!isCourier) return false;
        // Check only packages NOT in complicated or MAR-MULTI flights
         const complicatedFlight = cargasEnBodega.find(f => (f.codigo || "").toUpperCase().startsWith('COMP'));
        const complicatedFlightId = complicatedFlight ? complicatedFlight.id : null;
        const seaFlightIds = new Set(
            cargasEnBodega.filter(f => (f.codigo || "").toUpperCase().startsWith('MAR-MULTI')).map(f => f.id)
        );

        return courierPaquetesEnBodega.some(p =>
            !p.ci_ruc && p.flight_id !== complicatedFlightId && !seaFlightIds.has(p.flight_id)
        );
    }, [isCourier, courierPaquetesEnBodega, cargasEnBodega]);


    // Courier's filtered cargo participation (unchanged)
    const courierParticipatedFlightIds = useMemo(() => {
        if (!isCourier) return new Set();
        return new Set(packages.filter(p => p.courier === courierName).map(p => p.flight_id));
    }, [isCourier, packages, courierName]);


    // --- Admin specific calculations (unchanged) ---
    const cargasEnTransitoAdmin = useMemo(() => isAdmin ? flights.filter(f => f.estado === "En tránsito") : [], [isAdmin, flights]);
    const tareasPendientesAdmin = useMemo(() => isAdmin ? pendientes.filter(t => t.status === "No realizada") : [], [isAdmin, pendientes]);
    const weeklyPackageCountDataAdmin = useMemo(() => {
        if (!isAdmin) return { chartData: [], weekStart: new Date(), weekEnd: new Date(), totalPackages: 0 };
         const today = new Date();
        today.setUTCDate(today.getUTCDate() + (packageWeekOffset * 7));
        const weekStart = getUTCWeekStart(today);
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
        weekEnd.setUTCHours(23, 59, 59, 999);

        const packagesInWeek = packages.filter(p => {
            const packageDate = parsePackageDateAsUTC(p.fecha);
            return packageDate && packageDate >= weekStart && packageDate <= weekEnd;
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
            const packageDate = parsePackageDateAsUTC(p.fecha);
            if (packageDate) {
                const dayIndex = packageDate.getUTCDay();
                const dayName = dayNames[dayIndex];
                if (dailyData.hasOwnProperty(dayName)) { dailyData[dayName]++; }
            }
        });
        const chartData = Object.entries(dailyData).map(([name, count]) => ({ name: name.substring(0, 3), paquetes: count }));
        const orderedChartData = chartData.sort((a, b) => {
             const order = { 'Lun': 1, 'Mar': 2, 'Mié': 3, 'Jue': 4, 'Vie': 5, 'Sáb': 6, 'Dom': 7 };
            return order[a.name] - order[b.name];
        });

        return { chartData: orderedChartData, weekStart, weekEnd, totalPackages: filteredPackages.length };
    }, [isAdmin, packages, flights, packageWeekOffset, packageFilter]);

    // *** MODIFIED CALCULATION FOR KG PIE CHART ***
    const kgPorCourierAdmin = useMemo(() => {
        if (!isAdmin) return [];
        const agg = {};

        // 1. Filter packages: exclude those in 'COMPLICADOS' flight
        const nonComplicatedPackages = paquetesEnBodega.filter(p => {
            const flight = flights.find(f => f.id === p.flight_id);
            // Ensure flight and flight.codigo exist before checking the prefix
            return flight && flight.codigo && !flight.codigo.toUpperCase().startsWith('COMP');
        });


        // 2. Apply the cargaFilter (Aéreos, Marítimos, Todas)
        let packagesToProcess = nonComplicatedPackages;
        if (cargaFilter !== 'Todas') {
            const typePrefix = cargaFilter === 'Aéreos' ? 'AIR' : 'MAR';
            packagesToProcess = nonComplicatedPackages.filter(p => {
                const flight = flights.find(f => f.id === p.flight_id);
                // Ensure flight exists and has a code before checking the prefix
                // This check is crucial as flight might be undefined if data is inconsistent
                return flight && flight.codigo && flight.codigo.toUpperCase().startsWith(typePrefix);
            });
        }
        // If 'Todas', we keep all non-complicated packages (those starting with AIR or MAR implicitly)

        // 3. Aggregate weights by courier
        packagesToProcess.forEach(p => {
            // Ensure peso_real is treated as a number
             // Make sure courier name exists, otherwise use 'Sin Courier'
            const courierKey = p.courier || 'Sin Courier';
            agg[courierKey] = (agg[courierKey] || 0) + Number(p.peso_real || 0);
        });

        // 4. Format for the chart
        return Object.entries(agg)
            .filter(([, kg]) => kg > 0)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [isAdmin, paquetesEnBodega, flights, cargaFilter]); // Added flights dependency

    const totalKgBodegaAdmin = useMemo(() => sum(kgPorCourierAdmin.map(c => c.value)), [kgPorCourierAdmin]);

    const weeklyKgDataAdmin = useMemo(() => {
        if (!isAdmin) return { chartData: [], weekStart: new Date(), weekEnd: new Date(), totalKg: 0 };
        const today = new Date();
        today.setUTCDate(today.getUTCDate() + (kgWeekOffset * 7));
        const weekStart = getUTCWeekStart(today);
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
        weekEnd.setUTCHours(23, 59, 59, 999);

        const packagesInWeek = packages.filter(p => {
            const packageDate = parsePackageDateAsUTC(p.fecha);
            return packageDate && packageDate >= weekStart && packageDate <= weekEnd;
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
            const packageDate = parsePackageDateAsUTC(p.fecha);
             if (packageDate) {
                const dayIndex = packageDate.getUTCDay();
                const dayName = dayNames[dayIndex];
                if (dailyData.hasOwnProperty(dayName)) { dailyData[dayName] += p.peso_real || 0; }
            }
        });
        const chartData = Object.entries(dailyData).map(([name, kg]) => ({ name: name.substring(0, 3), kg: parseFloat(kg.toFixed(3)) }));
        const orderedChartData = chartData.sort((a, b) => {
            const order = { 'Lun': 1, 'Mar': 2, 'Mié': 3, 'Jue': 4, 'Vie': 5, 'Sáb': 6, 'Dom': 7 };
            return order[a.name] - order[b.name];
        });

        return { chartData: orderedChartData, weekStart, weekEnd, totalKg: sum(filteredPackages.map(p => p.peso_real)) };
    }, [isAdmin, packages, flights, kgWeekOffset, kgFilter]);

    // --- Common Cargo Status Calculation (used by both, filtered later if needed) ---
    const estadoCargasData = useMemo(() => {
        const sortedFlights = [...flights].sort((a, b) => (b.fecha_salida || "").localeCompare(a.fecha_salida || ""));

        const mapFlightData = (flight) => {
            const relevantPackages = isCourier
                ? packages.filter(p => p.flight_id === flight.id && p.courier === courierName)
                : packages.filter(p => p.flight_id === flight.id);

            const totalWeight = sum(relevantPackages.map(p => p.peso_real));
            const boxCount = flight.cajas?.length || 0;
            const courierParticipated = isCourier ? relevantPackages.length > 0 : true;

            return courierParticipated ? {
                id: flight.id, nombre: flight.codigo, fechaSalida: flight.fecha_salida || 'N/A',
                pesoTotal: totalWeight, cantidadCajas: boxCount, estado: flight.estado
            } : null;
        };

        const latestAir = sortedFlights
            .filter(f => (f.codigo || "").toUpperCase().startsWith('AIR'))
            .map(mapFlightData).filter(Boolean).slice(0, 10);
        const latestSea = sortedFlights
            .filter(f => (f.codigo || "").toUpperCase().startsWith('MAR'))
            .map(mapFlightData).filter(Boolean).slice(0, 6);

        return { latestAir, latestSea };
    }, [flights, packages, isCourier, courierName]);


    const formatWeekRangeForDisplay = (startDateUTC, endDateUTC) => {
        const options = { day: '2-digit', month: '2-digit' };
        const yearOption = { year: 'numeric' };
        const startStr = startDateUTC.toLocaleDateString('es-ES', options);
        const endStr = endDateUTC.toLocaleDateString('es-ES', {...options, ...yearOption});
        return `${startStr} - ${endStr}`;
    };

    // --- Courier Pie Chart Data ---
    const courierPieData = useMemo(() => {
        if (!isCourier) return [];
        return [
            { name: 'Envío Aéreo', value: courierPackageCounts.air, color: COLORS[4] }, // Use a specific color (e.g., Blue)
            { name: 'Envío Marítimo', value: courierPackageCounts.sea, color: COLORS[0] }, // Use a specific color (e.g., Indigo)
            { name: 'Complicados', value: courierPackageCounts.complicated, color: COLORS[3] }, // Use a specific color (e.g., Red)
        ].filter(d => d.value > 0); // Only include sections with value > 0
    }, [isCourier, courierPackageCounts]);


    // --- Render Admin Dashboard ---
    if (isAdmin) {
        // ... (Admin dashboard code) ...
         return (
            <div>
                <h1 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <KpiCard title="Paquetes en Bodega" value={paquetesEnBodega.length} icon={Iconos.box} color="border-francia-500" />
                    <KpiCard title="Cargas en Tránsito" value={cargasEnTransitoAdmin.length} icon={Iconos.envios} color="border-amber-500" />
                    <KpiCard title="Tareas Pendientes" value={tareasPendientesAdmin.length} icon={Iconos.gestion} color="border-red-500" />
                </div>
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-slate-800 mb-4">Acciones Rápidas</h2>
                    <div className="flex flex-wrap gap-4">
                        <Button variant="primary" onClick={() => onTabChange("Recepción")}>Registrar Nuevo Paquete</Button>
                        <Button variant="primary" onClick={() => onTabChange("Gestión de cargas")}>Crear Nueva Carga</Button>
                        <Button variant="primary" onClick={() => onTabChange("Armado de cajas")}>Armar Cajas</Button>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Gráfico Paquetes Recibidos */}
                     <div className="bg-white p-6 rounded-xl shadow-md">
                        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                            <h3 className="font-semibold text-slate-700">Paquetes recibidos por semana</h3>
                             <div className="flex items-center gap-2">
                                <Button onClick={() => setPackageWeekOffset(packageWeekOffset - 1)}>{"<"}</Button>
                                <span className="text-sm text-slate-600 text-center w-44 md:w-48">
                                    {formatWeekRangeForDisplay(weeklyPackageCountDataAdmin.weekStart, weeklyPackageCountDataAdmin.weekEnd)}
                                </span>
                                <Button onClick={() => setPackageWeekOffset(packageWeekOffset + 1)} disabled={packageWeekOffset >= 0}>{">"}</Button>
                            </div>
                            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                                {/* Applied enhanced active style with border */}
                                <Button onClick={() => setPackageFilter('Todos')} className={`text-xs !px-2 !py-1 ${packageFilter === 'Todos' ? 'bg-white text-francia-700 border-francia-500 border-2 font-semibold shadow' : 'bg-transparent text-slate-700 hover:bg-slate-200 border-transparent border-2 shadow-none'}`}>Todos</Button>
                                <Button onClick={() => setPackageFilter('Aéreos')} className={`text-xs !px-2 !py-1 ${packageFilter === 'Aéreos' ? 'bg-white text-francia-700 border-francia-500 border-2 font-semibold shadow' : 'bg-transparent text-slate-700 hover:bg-slate-200 border-transparent border-2 shadow-none'}`}>Aéreos</Button>
                                <Button onClick={() => setPackageFilter('Marítimos')} className={`text-xs !px-2 !py-1 ${packageFilter === 'Marítimos' ? 'bg-white text-francia-700 border-francia-500 border-2 font-semibold shadow' : 'bg-transparent text-slate-700 hover:bg-slate-200 border-transparent border-2 shadow-none'}`}>Marítimos</Button>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={weeklyPackageCountDataAdmin.chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} width={60}/>
                                <Tooltip />
                                <Bar dataKey="paquetes" fill="#4f46e5" name="Paquetes"/>
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="text-right font-bold mt-2 text-slate-700">Total semanal: {weeklyPackageCountDataAdmin.totalPackages} paquetes</div>
                    </div>
                     {/* Gráfico Resumen KG Bodega - Filter changed to Buttons */}
                    <div className="bg-white p-6 rounded-xl shadow-md flex flex-col">
                        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                            <h3 className="font-semibold text-slate-700">Resumen de kg en bodega</h3>
                            {/* --- FILTER CHANGED FROM SELECT TO BUTTONS & Applied enhanced active style with border --- */}
                            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                                <Button onClick={() => setCargaFilter('Todas')} className={`text-xs !px-2 !py-1 ${cargaFilter === 'Todas' ? 'bg-white text-francia-700 border-francia-500 border-2 font-semibold shadow' : 'bg-transparent text-slate-700 hover:bg-slate-200 border-transparent border-2 shadow-none'}`}>Todos</Button>
                                <Button onClick={() => setCargaFilter('Aéreos')} className={`text-xs !px-2 !py-1 ${cargaFilter === 'Aéreos' ? 'bg-white text-francia-700 border-francia-500 border-2 font-semibold shadow' : 'bg-transparent text-slate-700 hover:bg-slate-200 border-transparent border-2 shadow-none'}`}>Aéreos</Button>
                                <Button onClick={() => setCargaFilter('Marítimas')} className={`text-xs !px-2 !py-1 ${cargaFilter === 'Marítimas' ? 'bg-white text-francia-700 border-francia-500 border-2 font-semibold shadow' : 'bg-transparent text-slate-700 hover:bg-slate-200 border-transparent border-2 shadow-none'}`}>Marítimos</Button>
                            </div>
                            {/* --- END OF FILTER CHANGE --- */}
                        </div>
                        <div className="flex-grow flex items-center">
                            {kgPorCourierAdmin.length > 0 ? (
                                <>
                                    <ResponsiveContainer width="50%" height="100%">
                                        <PieChart>
                                            <Pie data={kgPorCourierAdmin} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80}>
                                                {kgPorCourierAdmin.map((_, i) => (<Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />))}
                                            </Pie>
                                            <Tooltip formatter={(value) => `${fmtPeso(value)} kg`} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="w-1/2 text-sm pl-4">
                                        <ul>
                                            {kgPorCourierAdmin.map((entry, index) => (
                                                <li key={`item-${index}`} className="flex justify-between items-center py-1 border-b border-slate-100">
                                                    <span className="flex items-center"><div className="w-3 h-3 mr-2 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{entry.name}</span>
                                                    <span className="font-semibold">{fmtPeso(entry.value)} kg</span>
                                                </li>
                                            ))}
                                            <li className="flex justify-between items-center py-2 font-bold mt-2 border-t-2 border-slate-300">
                                                <span>TOTAL</span>
                                                <span>{fmtPeso(totalKgBodegaAdmin)} kg</span>
                                            </li>
                                        </ul>
                                    </div>
                                </>
                            ) : <div className="flex items-center justify-center h-full w-full text-slate-500">No hay paquetes en bodega para el filtro seleccionado</div> }
                        </div>
                    </div>
                    {/* Gráfico Kilos Recibidos por Semana */}
                     <div className="bg-white p-6 rounded-xl shadow-md lg:col-span-2">
                        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                            <h3 className="font-semibold text-slate-700">Kilos recibidos por semana</h3>
                            <div className="flex items-center gap-2">
                                <Button onClick={() => setKgWeekOffset(kgWeekOffset - 1)}>{"<"}</Button>
                                <span className="text-sm text-slate-600 text-center w-44 md:w-48">{formatWeekRangeForDisplay(weeklyKgDataAdmin.weekStart, weeklyKgDataAdmin.weekEnd)}</span>
                                <Button onClick={() => setKgWeekOffset(kgWeekOffset + 1)} disabled={kgWeekOffset >= 0}>{">"}</Button>
                            </div>
                            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                                {/* Applied enhanced active style with border */}
                                <Button onClick={() => setKgFilter('Todos')} className={`text-xs !px-2 !py-1 ${kgFilter === 'Todos' ? 'bg-white text-francia-700 border-francia-500 border-2 font-semibold shadow' : 'bg-transparent text-slate-700 hover:bg-slate-200 border-transparent border-2 shadow-none'}`}>Todos</Button>
                                <Button onClick={() => setKgFilter('Aéreos')} className={`text-xs !px-2 !py-1 ${kgFilter === 'Aéreos' ? 'bg-white text-francia-700 border-francia-500 border-2 font-semibold shadow' : 'bg-transparent text-slate-700 hover:bg-slate-200 border-transparent border-2 shadow-none'}`}>Aéreos</Button>
                                <Button onClick={() => setKgFilter('Marítimos')} className={`text-xs !px-2 !py-1 ${kgFilter === 'Marítimos' ? 'bg-white text-francia-700 border-francia-500 border-2 font-semibold shadow' : 'bg-transparent text-slate-700 hover:bg-slate-200 border-transparent border-2 shadow-none'}`}>Marítimos</Button>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={weeklyKgDataAdmin.chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis unit="kg" width={60}/>
                                <Tooltip formatter={(value) => `${fmtPeso(value)} kg`} />
                                <Bar dataKey="kg" fill="#4f46e5" name="Kilos" />
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="text-right font-bold mt-2 text-slate-700">Total semanal: {fmtPeso(weeklyKgDataAdmin.totalKg)} kg</div>
                    </div>
                </div>
                 {/* Estado de Cargas */}
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                     <EstadoCargasTable title="Estado de Cargas Aéreas (Últimas 10)" data={estadoCargasData.latestAir} showBoxCount={true} />
                     <EstadoCargasTable title="Estado de Cargas Marítimas (Últimas 6)" data={estadoCargasData.latestSea} showBoxCount={true} />
                 </div>
            </div>
        );
    }

    // --- Render Courier Dashboard ---
    if (isCourier) {
        // Use the simplified totals calculated in courierKgSummary
        const totalAirKg = courierKgSummary.airTotal;
        const totalSeaKg = courierKgSummary.seaTotal;
        const showComplicatedAction = courierPackageCounts.complicated > 0;
        const showCiRucAction = courierHasMissingCiRuc;

        // SubValue strings for KPI cards - Ensure total > 0 before showing "X de Y"
        const airSubValue = courierPackageCounts.total > 0 ? `${courierPackageCounts.air} de ${courierPackageCounts.total}` : '';
        const seaSubValue = courierPackageCounts.total > 0 ? `${courierPackageCounts.sea} de ${courierPackageCounts.total}` : '';
        const complicatedSubValue = courierPackageCounts.total > 0 ? `${courierPackageCounts.complicated} de ${courierPackageCounts.total}` : '';


        return (
            <div>
                 {/* Updated Title */}
                 <h1 className="text-2xl font-bold text-slate-800 mb-6">Dashboard {courierName}</h1>
                 {/* KPIs with subValues */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                     <KpiCard title="Paquetes en Bodega" value={courierPackageCounts.total} icon={Iconos.box} color="border-slate-500" />
                     <KpiCard title="Paquetes para Envío Aéreo" value={courierPackageCounts.air} subValue={airSubValue} icon={<AirplaneIcon />} color="border-sky-500" />
                     <KpiCard title="Paquetes para Envío Marítimo" value={courierPackageCounts.sea} subValue={seaSubValue} icon={<WaterIcon />} color="border-blue-500" /> {/* Use WaterIcon */}
                     <KpiCard title="Paquetes Complicados" value={courierPackageCounts.complicated} subValue={complicatedSubValue} icon={Iconos.gestion} color="border-red-500" />
                 </div>

                 {/* Simplified KG Summaries */}
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                     {/* Carga Aéreo */}
                     <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md flex items-center justify-between">
                         <div className="flex items-center gap-3">
                             <span className="text-sky-500"><AirplaneIcon /></span>
                             <h3 className="text-lg font-semibold text-slate-800">Carga Aérea en Bodega</h3>
                         </div>
                         <div className="text-right">
                            {totalAirKg > 0 ? (
                                <span className="text-3xl font-bold text-slate-800">{fmtPeso(totalAirKg)} KG</span>
                            ) : (
                                <span className="text-slate-500 text-sm">0 KG</span>
                            )}
                         </div>
                     </div>
                     {/* Carga Marítimo */}
                     <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <span className="text-blue-500"><WaterIcon /></span> {/* Use WaterIcon */}
                             <h3 className="text-lg font-semibold text-slate-800">Carga Marítima en Bodega</h3>
                         </div>
                         <div className="text-right">
                           {totalSeaKg > 0 ? (
                                <span className="text-3xl font-bold text-slate-800">{fmtPeso(totalSeaKg)} KG</span>
                           ) : (
                                <span className="text-slate-500 text-sm">0 KG</span>
                           )}
                         </div>
                     </div>
                 </div>

                {/* Removed Pie Chart and expanded Actions */}
                <div className="grid grid-cols-1 mb-8"> {/* Changed grid to single column */}
                     {/* Acciones Requeridas - Takes full width */}
                     <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Acciones Requeridas</h3>
                        <ul className="space-y-3 text-sm list-disc pl-5">
                            {showComplicatedAction && (
                                <li className="font-semibold text-slate-700">Contacte a sus clientes para ofrecer servicio marítimo por los paquetes en estado complicado.</li>
                            )}
                            <li className="font-semibold text-slate-700">Revise si alguno de los paquetes sin casilla corresponde a alguno de sus clientes.</li>
                            {showCiRucAction && (
                                <li className="font-semibold text-slate-700">Añada los CI/RUC de sus clientes.</li>
                            )}
                            {/* Show default message if no actions required */}
                            {!showComplicatedAction && !showCiRucAction && (
                                <li className="font-normal text-slate-500 list-none pl-0">No hay acciones urgentes requeridas.</li>
                            )}
                        </ul>
                     </div>
                 </div>


                 {/* Estado de Cargas (Courier) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                    <EstadoCargasTable title="Estado de Cargas Aéreas (Últimas 10)" data={estadoCargasData.latestAir} showBoxCount={false} />
                    <EstadoCargasTable title="Estado de Cargas Marítimas (Últimas 6)" data={estadoCargasData.latestSea} showBoxCount={false} />
                </div>
            </div>
        );
    }

    // Fallback if role is somehow undefined
    return <div>Cargando dashboard...</div>;
}