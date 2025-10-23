/* eslint-disable react/prop-types */
import React, { useMemo, useState } from "react";

// Componentes
import { Section } from "/src/components/common/Section.jsx"; // Corrected path
import { Input } from "/src/components/common/Input.jsx"; // Corrected path
import { Field } from "/src/components/common/Field.jsx"; // Corrected path
import { EmptyState } from "/src/components/common/EmptyState.jsx"; // Corrected path
import { Button } from "/src/components/common/Button.jsx"; // Corrected path
import { Modal } from "/src/components/common/Modal.jsx"; // Corrected path

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
  getColumnWidths // <-- IMPORTAMOS LA NUEVA FUNCIÓN
} from "/src/utils/helpers.jsx"; // Corrected path

export function CargasEnviadas({ packages, flights, user }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [estado, setEstado] = useState("");
  const [flightId, setFlightId] = useState("");
  const [viewer, setViewer] = useState(null);
  const isAdmin = user.role === 'ADMIN';
  const isCourier = user.role === 'COURIER';

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

  const list = flights
    .filter(f => f.estado !== "En bodega")
    .filter(f => !from || f.fecha_salida >= from)
    .filter(f => !to || f.fecha_salida <= to)
    .filter(f => !estado || f.estado === estado)
    .filter(f => !isCourier || (courierFlightIds && courierFlightIds.has(f.id)));

  const flight = flights.find(f => f.id === flightId);
  const pref = user.role === "COURIER" ? limpiar(user.courier) : null;

  const paquetesDeVuelo = useMemo(() => (flight
    ? packages.filter(p => p.flight_id === flightId)
    : []
  ).filter(p => user.role !== "COURIER" || (p.courier === user.courier && String(p.codigo || "").toUpperCase().startsWith(pref))), [flight, packages, user, pref, flightId]);

  const courierTotals = useMemo(() => {
    if (!flight || !isCourier) return { facturable: 0, exceso: 0 };
    const courierPackages = packages.filter(p => p.flight_id === flightId && p.courier === user.courier);
    return {
      facturable: sum(courierPackages.map(p => p.peso_facturable)),
      exceso: sum(courierPackages.map(p => p.exceso_volumen))
    };
  }, [flight, packages, isCourier, user.courier, flightId]);

  const resumenCajas = useMemo(() => {
    if (!flight) return [];
    return (flight.cajas || []).map((c, i) => {
      const peso = parseFloat(String(c.peso || "0").replace(",", "."));
      const L = parseInt(c.L || 0, 10), A = parseInt(c.A || 0, 10), H = parseInt(c.H || 0, 10);
      const vol = (A * H * L) / 6000 || 0;
      const visibleIds = new Set(paquetesDeVuelo.map(p => p.id));
      const idsDeCaja = c.paquetes.filter(pid => visibleIds.has(pid));
      const couriers = new Set(idsDeCaja.map(pid => packages.find(p => p.id === pid)?.courier).filter(Boolean));
      const etiqueta = couriers.size === 0 ? "—" : (couriers.size === 1 ? [...couriers][0] : "MULTICOURIER");
      return { n: i + 1, codigo: c.codigo, courier: etiqueta, peso, L, A, H, vol };
    });
  }, [flight, paquetesDeVuelo, packages]);

  const totPeso = sum(resumenCajas.map(r => r.peso));
  const totVol = sum(resumenCajas.map(r => r.vol));

  function exportFlightXLSX() {
    if (!flight) { alert("Seleccioná una carga."); return; }

    const headerPacking = ["Courier", "Casilla", "Código de paquete", "Fecha", "Empresa de envío", "Nombre y apellido", "CI/RUC", "Tracking", "Remitente", "Peso real", "Peso facturable", "Medidas", "Peso volumétrico", "Exceso de volumen", "Descripción", "Precio (EUR)"].map(th);
    const bodyPacking = paquetesDeVuelo.map(p => [
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
          <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={flightId} onChange={e => setFlightId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {list.map(f => <option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida} · {f.estado}</option>)}
          </select>
        </Field>
        <div className="col-span-1 sm:col-span-2 lg:col-span-4 flex justify-end w-full">
          <Button onClick={exportFlightXLSX} disabled={!flight}>
            Exportar XLSX
          </Button>
        </div>
      </div>

      {!flight ? <EmptyState icon={Iconos.box} title="Selecciona una carga" message="Elige una carga para ver sus paquetes y cajas." /> : (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-6 mb-2">
            <h3 className="text-lg font-semibold text-slate-800 mb-2 sm:mb-0">Paquetes del vuelo: {flight.codigo}</h3>
            {isCourier && (
              <div className="flex flex-col sm:flex-row gap-x-4 gap-y-1 text-sm">
                <div><b>Kg Facturables:</b> <span className="font-mono">{fmtPeso(courierTotals.facturable)} kg</span></div>
                <div><b>Exceso Volumétrico:</b> <span className="font-mono">{fmtPeso(courierTotals.exceso)} kg</span></div>
              </div>
            )}
          </div>
          <div className="overflow-x-auto mb-6">
            <table className="min-w-full text-sm">
              <thead><tr className="bg-slate-50">{["Courier", "Código", "Casilla", "Fecha", "Nombre", "Tracking", "Peso real", "Medidas", "P. Volum.", "Exceso", "Descripción", "Foto"].map(h => <th key={h} className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-200">
                {paquetesDeVuelo.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap">{p.courier}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{p.codigo}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.casilla}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.fecha}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.nombre_apellido}</td>
                    <td className="px-3 py-2 font-mono whitespace-nowrap">{p.tracking}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(p.peso_real)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.largo}x{p.ancho}x{p.alto} cm</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(p.peso_volumetrico)}</td> {/* Added Cell */}
                    <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(p.exceso_volumen)}</td>
                    <td className="px-3 py-2">{p.descripcion}</td>
                    <td className="px-3 py-2">
                      {(p.fotos && p.fotos.length > 0) ?
                          <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setViewer(p.fotos)}>Ver foto ({p.fotos.length})</Button>
                          : "—"}
                    </td>
                  </tr>
                ))}
                {paquetesDeVuelo.length === 0 && <tr><td colSpan={13}><EmptyState icon={Iconos.box} title="Sin paquetes" message="No hay paquetes para mostrar para tu usuario en esta carga." /></td></tr>} {/* Updated colspan */}
              </tbody>
            </table>
          </div>
          {isAdmin &&
            <>
              <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Resumen de Cajas</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead><tr className="bg-slate-50">{["Nº Caja", "Courier", "Peso", "Largo", "Ancho", "Alto", "Volumétrico"].map(h => <th key={h} className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">{h}</th>)}</tr></thead>
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
       <Modal open={!!viewer} onClose={() => setViewer(null)} title="Fotos del Paquete">
        {viewer && (
            <div className="flex flex-wrap gap-4 justify-center">
                {viewer.map((url, index) => (
                  <a key={index} href={url} target="_blank" rel="noopener noreferrer" title="Abrir en nueva pestaña para hacer zoom">
                    <img src={url} alt={`Foto ${index + 1}`} className="max-w-full max-h-[70vh] rounded-xl cursor-zoom-in" />
                  </a>
                ))}
            </div>
        )}
      </Modal>
    </Section>
  );
}