/* eslint-disable react/prop-types */
import React, { useState, useMemo } from "react";
import { Section } from "../common/Section.jsx";
import { Input } from "../common/Input.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { Iconos } from "../../utils/helpers.jsx";

export function BuscadorMaestro({ packages, flights, sinCasillaItems, user }) {
  const [q, setQ] = useState("");
  
  const isCourier = user?.role === "COURIER";
  const courierName = user?.courier;

  // Lógica de búsqueda unificada
  const resultados = useMemo(() => {
    const query = q.toLowerCase().trim();
    if (!query) return [];

    // 1. Buscar en Paquetes (Bodega y Enviados)
    const resultadosPaquetes = packages.filter(p => {
      // Filtro de seguridad para Couriers: Solo ver sus propios paquetes
      if (isCourier && p.courier !== courierName) {
        return false;
      }

      const searchStr = `${p.codigo} ${p.tracking} ${p.nombre_apellido} ${p.casilla} ${p.courier}`.toLowerCase();
      return searchStr.includes(query);
    }).map(p => {
      // Enriquecer con info de la carga
      const vuelo = flights.find(f => f.id === p.flight_id);
      const estadoCarga = vuelo ? vuelo.estado : "Desconocido";
      const codigoCarga = vuelo ? vuelo.codigo : "—";
      
      let ubicacion = "En Bodega";
      if (estadoCarga !== "En bodega") ubicacion = `Enviado (${estadoCarga})`;

      return {
        id: p.id,
        tipo: "Paquete",
        ubicacion: ubicacion,
        codigo: p.codigo,
        cliente: p.nombre_apellido,
        tracking: p.tracking,
        infoAdicional: `Carga: ${codigoCarga} | Casilla: ${p.casilla}`,
        fecha: p.fecha,
        courier: p.courier
      };
    });

    // 2. Buscar en Paquetes Sin Casilla
    // Los paquetes sin casilla son visibles para todos (Admin y Couriers) para que puedan reclamarlos
    const resultadosSinCasilla = sinCasillaItems.filter(item => {
      const searchStr = `${item.nombre} ${item.tracking} ${item.numero}`.toLowerCase();
      return searchStr.includes(query);
    }).map(item => ({
      id: item.id,
      tipo: "Sin Casilla",
      ubicacion: "Recepción (Sin Casilla)",
      codigo: `SC-${item.numero}`,
      cliente: item.nombre,
      tracking: item.tracking || "—",
      infoAdicional: "Pendiente de asignar",
      fecha: item.fecha,
      courier: "—"
    }));

    // Combinar y ordenar por fecha (más reciente primero)
    return [...resultadosPaquetes, ...resultadosSinCasilla].sort((a, b) => 
      new Date(b.fecha) - new Date(a.fecha)
    );

  }, [q, packages, flights, sinCasillaItems, isCourier, courierName]);

  return (
    <Section title="Buscador de paquetes"> {/* <-- CAMBIO AQUÍ: Título actualizado */}
      <div className="mb-6">
        <Input 
          placeholder="Escribe para buscar (Código, Tracking, Nombre, Casilla...)" 
          value={q} 
          onChange={(e) => setQ(e.target.value)} 
          className="text-lg py-3"
          autoFocus
        />
        <p className="text-xs text-slate-500 mt-2 ml-1">
          Buscando en: Paquetes en bodega, Cargas enviadas y Paquetes sin casilla.
        </p>
      </div>

      {q === "" ? (
        <EmptyState 
          icon={Iconos.gestion} 
          title="Empieza a buscar" 
          message="Ingresa algún dato del paquete para encontrarlo en todo el sistema." 
        />
      ) : resultados.length === 0 ? (
        <EmptyState 
          icon={Iconos.box} 
          title="Sin resultados" 
          message={`No se encontró nada con "${q}".`} 
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
          <table className="min-w-full text-sm bg-white">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Tipo / Ubicación</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Código</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Cliente</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Tracking</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Info Extra</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resultados.map((row) => (
                <tr key={row.id} className="hover:bg-francia-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      row.tipo === "Sin Casilla" ? "bg-red-100 text-red-800" :
                      row.ubicacion === "En Bodega" ? "bg-blue-100 text-blue-800" :
                      "bg-green-100 text-green-800"
                    }`}>
                      {row.ubicacion}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-700">{row.codigo}</td>
                  <td className="px-4 py-3 text-slate-800">{row.cliente}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{row.tracking}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{row.infoAdicional}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}