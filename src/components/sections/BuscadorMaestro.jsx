/* eslint-disable react/prop-types */
import React, { useState, useMemo } from "react";
import { Section } from "/src/components/common/Section.jsx";
import { Input } from "/src/components/common/Input.jsx";
import { EmptyState } from "/src/components/common/EmptyState.jsx";
import { Button } from "/src/components/common/Button.jsx";
import { ImageViewerModal } from "/src/components/common/ImageViewerModal.jsx";
import { Iconos } from "/src/utils/helpers.jsx";

export function BuscadorMaestro({ packages, flights, sinCasillaItems, user }) {
  const [q, setQ] = useState("");
  const [viewerImages, setViewerImages] = useState([]); // Estado para el visor de imágenes
  
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
        createdAt: p.createdAt, // Añadido para ordenamiento preciso
        courier: p.courier,
        fotos: p.fotos || []
      };
    });

    // 2. Buscar en Paquetes Sin Casilla
    // Los paquetes sin casilla son visibles para todos en la búsqueda, pero la foto será restringida en el renderizado para couriers
    const resultadosSinCasilla = sinCasillaItems.filter(item => {
      const searchStr = `${item.nombre} ${item.tracking} ${item.numero}`.toLowerCase();
      return searchStr.includes(query);
    }).map(item => ({
      id: item.id,
      tipo: "Sin Casilla",
      ubicacion: "Recepción (Sin Casilla)",
      codigo: `SC-${item.numero}`,
      cliente: item.nombre,
      // CAMBIO: Si es courier, ocultamos el tracking para que no puedan verlo visualmente en la tabla.
      // Esto permite que el admin verifique el tracking cuando el courier reclama el paquete.
      tracking: isCourier ? "—" : (item.tracking || "—"), 
      infoAdicional: "Pendiente de asignar",
      fecha: item.fecha,
      createdAt: item.createdAt || item.fecha, // Fallback a fecha si no hay createdAt
      courier: "—",
      fotos: item.foto ? [item.foto] : []
    }));

    // Combinar y ordenar por fecha (más reciente primero)
    // Usamos la misma lógica que en PaquetesBodega: createdAt tiene prioridad, luego fecha.
    return [...resultadosPaquetes, ...resultadosSinCasilla].sort((a, b) => {
      const dateA = a.createdAt || a.fecha || "";
      const dateB = b.createdAt || b.fecha || "";
      // Orden descendente (B - A) para que lo más nuevo quede arriba
      if (dateA < dateB) return 1;
      if (dateA > dateB) return -1;
      return 0;
    });

  }, [q, packages, flights, sinCasillaItems, isCourier, courierName]);

  return (
    <Section title="Buscador de paquetes">
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
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm relative max-h-[600px]">
          <table className="min-w-full text-sm bg-white">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Tipo / Ubicación</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Código</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Cliente</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Tracking</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Info Extra</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Foto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resultados.map((row) => {
                // Lógica de visibilidad de foto:
                // - Admin ve todo.
                // - Courier ve solo si es tipo "Paquete" (porque esos ya están filtrados por propiedad).
                // - Courier NO ve fotos de "Sin Casilla" (porque no le pertenecen).
                const showPhoto = !isCourier || row.tipo === "Paquete";

                return (
                  <tr key={`${row.tipo}-${row.id}`} className="hover:bg-francia-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        row.tipo === "Sin Casilla" ? "bg-red-100 text-red-800" :
                        row.ubicacion === "En Bodega" ? "bg-blue-100 text-blue-800" :
                        "bg-green-100 text-green-800"
                      }`}>
                        {row.ubicacion}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-700 whitespace-nowrap">{row.codigo}</td>
                    <td className="px-4 py-3 text-slate-800">{row.cliente}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{row.tracking}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{row.infoAdicional}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.fecha}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {showPhoto && row.fotos && row.fotos.length > 0 ? (
                        <Button 
                          variant="secondary" 
                          className="!px-2 !py-1 text-xs" 
                          onClick={() => setViewerImages(row.fotos)}
                        >
                          Ver foto
                        </Button>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ImageViewerModal 
        open={viewerImages.length > 0} 
        onClose={() => setViewerImages([])} 
        images={viewerImages} 
      />
    </Section>
  );
}