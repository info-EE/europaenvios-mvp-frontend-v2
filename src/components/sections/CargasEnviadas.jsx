/* eslint-disable react/prop-types */
import React, { useMemo, useState } from "react";

// Componentes
// Se han corregido las rutas relativas a absolutas para asegurar la compilación
import { Section } from "/src/components/common/Section.jsx";
import { Input } from "/src/components/common/Input.jsx";
import { Field } from "/src/components/common/Field.jsx";
import { EmptyState } from "/src/components/common/EmptyState.jsx";
import { Button } from "/src/components/common/Button.jsx";
import { ImageViewerModal } from "/src/components/common/ImageViewerModal.jsx";

// Helpers & Constantes
import {
  Iconos,
  fmtPeso,
  sum,
  ESTADOS_CARGA,
  limpiar,
  sheetFromAOAStyled,
  downloadXLSX,
  th,
  td,
  tdNum,
  tdInt,
  getColumnWidths
} from "/src/utils/helpers.jsx";

export function CargasEnviadas({ packages, flights, user }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [estado, setEstado] = useState("");
  const [flightId, setFlightId] = useState("");
  const [viewerImages, setViewerImages] = useState([]); 
  const [q, setQ] = useState(""); // Estado de búsqueda global
  
  const isAdmin = user.role === 'ADMIN';
  const isCourier = user.role === 'COURIER';
  const isGlobalSearchActive = !!q.trim(); // Controla si la búsqueda global está activa

  // Obtiene los IDs de las cargas en las que participó el courier
  const courierFlightIds = useMemo(() => {
    if (!isCourier) return null;
    const ids = new Set();
    packages.forEach(p => {
        if (p.courier === user.courier) {
            ids.add(p.flight_id);
        }
    });
    return ids;
  }, [packages, user.courier, isCourier]);

  // Lista de vuelos filtrada (Cargas) - Afectada por los filtros superiores
  const list = flights
    .filter(f => f.estado !== "En bodega")
    .filter(f => !from || f.fecha_salida >= from)
    .filter(f => !to || f.fecha_salida <= to)
    .filter(f => !estado || f.estado === estado)
    .filter(f => !isCourier || (courierFlightIds && courierFlightIds.has(f.id)))
    .sort((a, b) => (b.fecha_salida || "").localeCompare(a.fecha_salida || ""));

  const flight = flights.find(f => f.id === flightId);
  const pref = user.role === "COURIER" ? limpiar(user.courier) : null;

  // Paquetes a mostrar en la tabla (displayedPackages)
  const displayedPackages = useMemo(() => {
    // 1. Obtener la información de los vuelos activos
    // Se mapea el flight_id a un objeto que contiene el código y el estado.
    const allSentFlightsMap = new Map(flights
      .filter(f => f.estado !== "En bodega")
      .map(f => [f.id, { codigo: f.codigo, estado: f.estado }])
    );

    let pkgs = packages.filter(p => allSentFlightsMap.has(p.flight_id));
    
    // 2. Aplicar filtro por Rol/Courier (siempre)
    pkgs = pkgs.filter(p => user.role !== "COURIER" || (p.courier === user.courier && String(p.codigo || "").toUpperCase().startsWith(pref)));

    // 3. Agregar el código y estado de carga a cada paquete para facilitar el uso
    pkgs = pkgs.map(p => {
        const flightInfo = allSentFlightsMap.get(p.flight_id) || { codigo: 'Carga Desconocida', estado: 'Estado Desconocido' };
        return {
            ...p,
            carga_codigo: flightInfo.codigo,
            carga_estado: flightInfo.estado // <-- AÑADIDO EL ESTADO DE CARGA
        };
    });

    const query = q.toLowerCase();
    let finalPkgs = pkgs;

    if (isGlobalSearchActive) {
      // 4a. SI HAY BÚSQUEDA GLOBAL: Filtrar paquetes de TODAS las cargas enviadas por el texto de búsqueda.
      finalPkgs = pkgs.filter(p => 
        (p.codigo + p.casilla + p.tracking + p.nombre_apellido + p.courier + p.descripcion).toLowerCase().includes(query)
      );
    } else if (flightId) {
      // 4b. SI NO HAY BÚSQUEDA PERO HAY CARGA SELECCIONADA: Filtrar solo por la carga seleccionada (comportamiento original)
      finalPkgs = pkgs.filter(p => p.flight_id === flightId);
    } else {
      // 4c. SI NO HAY NADA ACTIVO: Mostrar vacío
      finalPkgs = [];
    }

    // 5. ORDENAMIENTO: Ordenar por fecha de creación (createdAt) o fecha, descendente.
    return finalPkgs.sort((a, b) => {
        const dateA = a.createdAt || a.fecha || "";
        const dateB = b.createdAt || b.fecha || "";
        // Usamos localeCompare para ordenar cadenas de texto, pero invertimos para descendente.
        // Si no existe createdAt, fecha funciona como fallback.
        if (dateA < dateB) return 1;
        if (dateA > dateB) return -1;
        return 0;
    });

  }, [packages, flights, user, pref, flightId, q, isGlobalSearchActive]); 

  // Totales de courier para la carga seleccionada (no afectados por búsqueda global)
  const courierTotals = useMemo(() => {
    if (!flight || !isCourier || isGlobalSearchActive) return { facturable: 0, exceso: 0 };
    const courierPackages = packages.filter(p => p.flight_id === flightId && p.courier === user.courier);
    return {
      facturable: sum(courierPackages.map(p => p.peso_facturable)),
      exceso: sum(courierPackages.map(p => p.exceso_volumen))
    };
  }, [flight, packages, isCourier, user.courier, flightId, isGlobalSearchActive]);

  // Resumen de cajas - Solo visible si hay un vuelo seleccionado y no hay búsqueda global activa
  const resumenCajas = useMemo(() => {
    if (isGlobalSearchActive || !flight || isCourier) return [];
    
    // Obtener solo los paquetes que están visibles por rol (Admin ve todos)
    const visibleIds = new Set(packages
      .filter(p => p.flight_id === flightId)
      .filter(p => user.role !== "COURIER" || (p.courier === user.courier && String(p.codigo || "").toUpperCase().startsWith(pref)))
      .map(p => p.id));
      
    return (flight.cajas || []).map((c, i) => {
      const peso = parseFloat(String(c.peso || "0").replace(",", "."));
      const L = parseInt(c.L || 0, 10), A = parseInt(c.A || 0, 10), H = parseInt(c.H || 0, 10);
      const vol = (A * H * L) / 6000 || 0;
      
      const idsDeCaja = c.paquetes.filter(pid => visibleIds.has(pid)); 
      const couriers = new Set(idsDeCaja.map(pid => packages.find(p => p.id === pid)?.courier).filter(Boolean));
      const etiqueta = couriers.size === 0 ? "—" : (couriers.size === 1 ? [...couriers][0] : "MULTICOURIER");
      
      if (isCourier && couriers.size === 0) return null;
      
      return { n: i + 1, codigo: c.codigo, courier: etiqueta, peso, L, A, H, vol };
    }).filter(Boolean);
  }, [flight, packages, user.role, pref, flightId, isCourier, isGlobalSearchActive]); 

  const totPeso = sum(resumenCajas.map(r => r.peso));
  const totVol = sum(resumenCajas.map(r => r.vol));

  function exportFlightXLSX() {
    // Si la búsqueda global está activa, el export no es lógico.
    if (isGlobalSearchActive) {
        alert("La exportación XLSX solo está disponible cuando se selecciona una carga específica.");
        return;
    }
    if (!flight) { alert("Seleccioná una carga."); return; }

    // Usar la lista SIN filtrar por el buscador 'q' para el export (el export siempre debe ser de todo el paquete)
    let packagesForExport = flights.find(f => f.id === flightId)
        ? packages.filter(p => p.flight_id === flightId)
        : [];

    // --- FIX DE SEGURIDAD PARA COURIERS ---
    // Si es Courier, filtramos para que SOLO exporte sus paquetes y no toda la carga.
    if (isCourier) {
        packagesForExport = packagesForExport.filter(p => 
            p.courier === user.courier && 
            String(p.codigo || "").toUpperCase().startsWith(pref)
        );
    }
    // --------------------------------------

    const headerPacking = ["Courier", "Casilla", "Código de paquete", "Fecha", "Empresa de envío", "Nombre y apellido", "CI/RUC", "Tracking", "Remitente", "Peso real", "Peso facturable", "Medidas", "Peso volumétrico", "Exceso de volumen", "Descripción", "Precio (EUR)"].map(th);
    const bodyPacking = packagesForExport.map(p => [
      td(p.courier), td(p.casilla), td(p.codigo), td(p.fecha), td(p.empresa_envio), td(p.nombre_apellido),
      td(p.ci_ruc), td(p.tracking), td(p.remitente), tdNum(p.peso_real, "0.000"), tdNum(p.peso_facturable, "0.000"),
      td(`${p.largo}x${p.ancho}x${p.alto} cm`), tdNum(p.peso_volumetrico, "0.000"), tdNum(p.exceso_volumen, "0.000"), td(p.descripcion), tdNum(p.valor_aerolinea, "0.00")
    ]);

    const columnWidthsPacking = getColumnWidths(headerPacking, bodyPacking);

    const sheetPacking = sheetFromAOAStyled("Packing list", [headerPacking, ...bodyPacking], {
        cols: columnWidthsPacking,
        rows: [{hpt:24}]
    });

    if (isAdmin) {
      const headerCajas = ["Nº de Caja", "Courier", "Peso", "Largo", "Ancho", "Alto", "Volumétrico"].map(th);
      const bodyCajas = resumenCajas.map(c => [
        td(c.codigo), td(c.courier), tdNum(c.peso, "0.000"), tdInt(c.L), tdInt(c.A), tdInt(c.H), tdNum(c.vol, "0.000")
      ]);
      const totalsRow = [
        td(""), th("Totales"), tdNum(totPeso, "0.000"), td(""), td(""), td(""), tdNum(totVol, "0.000")
      ];

      const columnWidthsCajas = getColumnWidths(headerCajas, [...bodyCajas, totalsRow]);

      const sheetCajas = sheetFromAOAStyled("Cajas", [headerCajas, ...bodyCajas, totalsRow], {
        cols: columnWidthsCajas,
        rows: [{ hpt: 24 }]
      });
      downloadXLSX(`Carga_${flight.codigo}.xlsx`, [sheetPacking, sheetCajas]);
    } else {
      downloadXLSX(`Carga_${flight.codigo}.xlsx`, [sheetPacking]);
    }
  }

  return (
    <Section title="Cargas enviadas">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end mb-4">
        <Field label="Desde"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="Hasta"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
        <Field label="Estado">
          <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={estado} onChange={e => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS_CARGA.filter(s => s !== 'En bodega').map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Carga">
          <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={flightId} onChange={e => setFlightId(e.target.value)} disabled={isGlobalSearchActive}>
            <option value="">Seleccionar…</option>
            {list.map(f => <option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida} · {f.estado}</option>)}
          </select>
        </Field>
        
        {/* BUSCADOR GLOBAL AÑADIDO (Etiqueta modificada) */}
        <div className="col-span-1 sm:col-span-2 lg:col-span-3">
             <Field label="Buscar paquete">
                <Input placeholder="Buscar por código, casilla, tracking, nombre..." value={q} onChange={e=>setQ(e.target.value)}
                />
            </Field>
        </div>
        {/* FIN BUSCADOR GLOBAL */}

        <div className="col-span-1 sm:col-span-2 lg:col-span-1 flex justify-end w-full">
          <Button onClick={exportFlightXLSX} disabled={!flight || isGlobalSearchActive} title={isGlobalSearchActive ? "Exportar requiere seleccionar una carga" : "Exportar al Excel"}>
            Exportar XLSX
          </Button>
        </div>
      </div>

      {/* RENDERIZADO CONDICIONAL */}
      {!isGlobalSearchActive && !flight ? (
         <EmptyState icon={Iconos.box} title="Selecciona una carga" message="Elige una carga para ver sus paquetes y cajas." />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-6 mb-2">
            <h3 className="text-lg font-semibold text-slate-800 mb-2 sm:mb-0">
                {isGlobalSearchActive ? `Resultados de la búsqueda: ${displayedPackages.length} paquetes` : `Paquetes del vuelo: ${flight.codigo} (${displayedPackages.length} paquetes)`}
            </h3>
            {isCourier && !isGlobalSearchActive && flight && (
              <div className="flex flex-col sm:flex-row gap-x-4 gap-y-1 text-sm">
                <div><b>Kg Facturables:</b> <span className="font-mono">{fmtPeso(courierTotals.facturable)} kg</span></div>
                <div><b>Exceso Volumétrico:</b> <span className="font-mono">{fmtPeso(courierTotals.exceso)} kg</span></div>
              </div>
            )}
          </div>
          
          {/* Container con tabla de paquetes */}
           <div className="overflow-auto w-full max-h-[calc(100vh-400px)] relative mb-6"> 
            <table className="min-w-full text-sm table-auto w-full border-collapse"> 
              <thead>
                <tr className="bg-slate-50">
                  {/* COLUMNAS DE BÚSQUEDA GLOBAL */}
                  {isGlobalSearchActive && (
                    <>
                      <th className="bg-slate-50 text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap sticky top-0 z-10">Carga</th>
                      <th className="bg-slate-50 text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap sticky top-0 z-10">Estado Carga</th> {/* <-- NUEVA COLUMNA */}
                    </>
                  )}
                  {/* COLUMNAS GENERALES */}
                  {["Courier", "Código", "Casilla", "Fecha", "Nombre", "Tracking", "Peso real", "Medidas", "P. Volum.", "Exceso", "Descripción", "Foto"].map(h => <th key={h} className="bg-slate-50 text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap sticky top-0 z-10">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayedPackages.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    {/* DATOS DE BÚSQUEDA GLOBAL */}
                    {isGlobalSearchActive && (
                        <>
                            <td className="px-3 py-2 whitespace-nowrap font-semibold text-francia-700">{p.carga_codigo}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{p.carga_estado}</td> {/* <-- NUEVO DATO */}
                        </>
                    )}
                    <td className="px-3 py-2 whitespace-nowrap">{p.courier}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{p.codigo}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.casilla}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.fecha}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.nombre_apellido}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{p.tracking}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(p.peso_real)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.largo}x{p.ancho}x{p.alto} cm</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(p.peso_volumetrico)}</td> 
                    <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(p.exceso_volumen)}</td>
                    <td className="px-3 py-2">{p.descripcion}</td>
                    <td className="px-3 py-2">
                      {(p.fotos && p.fotos.length > 0) ?
                          <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setViewerImages(p.fotos)}>Ver foto</Button>
                          : "—"}
                    </td>
                  </tr>
                ))}
                {displayedPackages.length === 0 && <tr><td colSpan={isGlobalSearchActive ? 14 : 12}><EmptyState icon={Iconos.box} title="Sin paquetes" message="No hay paquetes para mostrar con los filtros aplicados." /></td></tr>}
              </tbody>
            </table>
          </div>
          
          {/* Resumen de Cajas (Solo Admin y no en búsqueda global) */}
          {isAdmin && !isGlobalSearchActive && flight &&
            <>
              <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Resumen de Cajas</h3>
               <div className="overflow-auto w-full max-h-[calc(100vh-600px)] relative">
                <table className="min-w-full text-sm table-auto w-full border-collapse"> 
                  <thead>
                    <tr className="bg-slate-50">
                      {["Nº Caja", "Courier", "Peso", "Largo", "Ancho", "Alto", "Volumétrico"].map(h => <th key={h} className="bg-slate-50 text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap sticky top-0 z-10">{h}</th>)}
                    </tr>
                   </thead>
                  <tbody className="divide-y divide-slate-200">
                    {resumenCajas.map(r => (
                      <tr key={r.n} className="hover:bg-slate-50">
                        <td className="px-3 py-2 whitespace-nowrap">{r.codigo}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.courier}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(r.peso)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.L}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.A}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{r.H}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(r.vol)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-bold"><td className="px-3 py-2"></td><td className="px-3 py-2">Totales</td><td className="px-3 py-2 whitespace-nowrap">{fmtPeso(totPeso)}</td><td></td><td></td><td></td><td className="px-3 py-2 whitespace-nowrap">{fmtPeso(totVol)}</td></tr>
                  </tbody>
                </table>
              </div>
            </>
          }
        </>
      )}
      <ImageViewerModal open={viewerImages.length > 0} onClose={() => setViewerImages([])} images={viewerImages} />
    </Section>
  );
}