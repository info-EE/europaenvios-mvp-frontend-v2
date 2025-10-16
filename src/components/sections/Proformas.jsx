/* eslint-disable react/prop-types */
import React, { useMemo, useState } from "react";
import ExcelJS from "exceljs/dist/exceljs.min.js";

// Componentes
import { Section } from "../common/Section.jsx";
import { Input } from "../common/Input.jsx";
import { Field } from "../common/Field.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { Button } from "../common/Button.jsx";

// Helpers & Constantes
import {
  Iconos,
  fmtPeso,
  fmtMoney,
  sum,
  parseComma,
  parseIntEU // Aseguramos que parseIntEU esté disponible
} from "../../utils/helpers.jsx";

// Constantes de cálculo de la lógica de negocio original
const T = { proc: 5, fleteReal: 9, fleteExc: 9, despacho: 10, fleteMaritimo: 12 };
const canjeGuiaUSD = (kg) => kg <= 5 ? 10 : kg <= 10 ? 13.5 : kg <= 30 ? 17 : kg <= 50 ? 37 : kg <= 100 ? 57 : 100;

export function Proformas({ packages, flights, extras, user }) {
  const getInitialFromDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  };

  const [from, setFrom] = useState(getInitialFromDate());
  const [to, setTo] = useState("");
  const [flightId, setFlightId] = useState("");
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
    .filter(f => {
      const code = (f.codigo || "").toUpperCase();
      return code.startsWith("AIR") || code.startsWith("MAR");
    })
    .filter(f => !isCourier || (courierFlightIds && courierFlightIds.has(f.id)))
    .sort((a, b) => new Date(b.fecha_salida) - new Date(a.fecha_salida));

  const flight = flights.find(f => f.id === flightId);

  const porCourier = useMemo(() => {
    if (!flight) return [];
    const m = new Map();
    (flight.cajas || []).forEach(c => c.paquetes.forEach(pid => {
      const p = packages.find(x => x.id === pid); if (!p) return;
      if (isCourier && p.courier !== user.courier) return;
      if (!m.has(p.courier)) m.set(p.courier, { courier: p.courier, kg_real: 0, kg_fact: 0, kg_exc: 0 });
      const a = m.get(p.courier);
      a.kg_real += p.peso_real;
      a.kg_fact += p.peso_facturable;
      a.kg_exc += p.exceso_volumen;
    }));
    return Array.from(m.values());
  }, [flight, packages, isCourier, user.courier]);

  const extrasDeCourier = (courier) => extras.filter(e => e.flight_id === flightId && e.courier === courier);

  async function exportX(r) {
    if (!flight) return;

    let detalle = [];
    let total = 0;
    const flightCode = (flight.codigo || "").toUpperCase();
    const isMaritimo = flightCode.startsWith("MAR");
    const isPybox = flightCode.startsWith("AIR-PYBOX");
    const isAirMulti = flightCode.startsWith("AIR-MULTI");

    const extrasList = extrasDeCourier(r.courier);
    const extrasMonto = extrasList.reduce((s, e) => s + parseComma(e.monto), 0);

    if (isPybox && r.courier === 'ParaguayBox') {
        const cajasDelVuelo = flight.cajas || [];
        // NOTA: El cálculo de Pybox se basa en el PESO REAL TOTAL de las cajas, no en el facturable de los paquetes.
        const totalPesoRealCajas = sum(cajasDelVuelo.map(c => parseComma(c.peso)));
        
        // El exceso de volumen sí se calcula con el volumétrico de las cajas.
        const totalPesoVolumetricoCajas = sum(cajasDelVuelo.map(c => (parseIntEU(c.L) * parseIntEU(c.A) * parseIntEU(c.H)) / 6000));
        
        let excesoVolumenCantidad = totalPesoVolumetricoCajas - totalPesoRealCajas;
        if (excesoVolumenCantidad < 0) {
            excesoVolumenCantidad = 0;
        }
        
        // CAMBIO: Usar el peso real total de las cajas para el costo de procesamiento.
        const costoProcesamiento = totalPesoRealCajas * 24.00;
        const costoExceso = excesoVolumenCantidad * 8.00;

        total = costoProcesamiento + costoExceso + extrasMonto;

        detalle = [
            // CAMBIO: Usar el peso real total de las cajas como cantidad.
            ["Procesamiento, envío y despacho aduanero carga aérea", Number(totalPesoRealCajas.toFixed(3)), 24.00, Number(costoProcesamiento.toFixed(2))],
            ["Exceso de volumen", Number(excesoVolumenCantidad.toFixed(3)), 8.00, Number(costoExceso.toFixed(2))],
            ...extrasList.map(e => [e.descripcion, 1, Number(parseComma(e.monto).toFixed(2)), Number(parseComma(e.monto).toFixed(2))])
        ];
    } else if (isMaritimo) {
      const fleteTotal = r.kg_fact * T.fleteMaritimo;
      total = fleteTotal + extrasMonto;
      detalle = [
        ["Envío marítimo España-Paraguay", Number(r.kg_fact.toFixed(3)), Number(T.fleteMaritimo.toFixed(2)), Number(fleteTotal.toFixed(2))],
        ...extrasList.map(e => [e.descripcion, 1, Number(parseComma(e.monto).toFixed(2)), Number(parseComma(e.monto).toFixed(2))])
      ];
    } else { // Lógica para Aéreo normal
      const proc = r.kg_fact * T.proc;
      const fr = r.kg_fact * T.fleteReal;
      const fe = r.kg_exc * T.fleteExc;
      const desp = r.kg_fact * T.despacho;

      let canje = r.courier !== 'Global Box' ? canjeGuiaUSD(r.kg_fact) : 0;
      // REQUERIMIENTO: Si la carga es Air-Multi, el máximo de canje es 57 USD
      if (isAirMulti) {
        canje = Math.min(canje, 57);
      }
      
      // CORRECCIÓN: Se ajusta el nombre de 'InflightBox' a 'Inflight Box' para que la excepción se aplique correctamente.
      const com = r.courier !== 'Inflight Box' ? 0.04 * (proc + fr + fe + extrasMonto) : 0;
      
      total = proc + fr + fe + desp + canje + extrasMonto + com;

      detalle = [
        ["Procesamiento", Number(r.kg_fact.toFixed(3)), Number(T.proc.toFixed(2)), Number(proc.toFixed(2))],
        ["Flete peso real", Number(r.kg_fact.toFixed(3)), Number(T.fleteReal.toFixed(2)), Number(fr.toFixed(2))],
        ["Flete exceso de volumen", Number(r.kg_exc.toFixed(3)), Number(T.fleteExc.toFixed(2)), Number(fe.toFixed(2))],
        ["Servicio de despacho", Number(r.kg_fact.toFixed(3)), Number(T.despacho.toFixed(2)), Number(desp.toFixed(2))],
        ...extrasList.map(e => [e.descripcion, 1, Number(parseComma(e.monto).toFixed(2)), Number(parseComma(e.monto).toFixed(2))]),
      ];

      if (canje > 0) {
        // Se inserta en la posición correcta
        detalle.splice(4, 0, ["Comisión por canje de guía", 1, Number(canje.toFixed(2)), Number(canje.toFixed(2))]);
      }
      if (com > 0) {
        detalle.push(["Comisión por transferencia (4%)", 1, Number(com.toFixed(2)), Number(com.toFixed(2))]);
      }
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Factura");

    const boldStyle = { font: { bold: true } };
    const headerStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }, alignment: { horizontal: 'center' } };
    const totalStyle = { font: { bold: true }, alignment: { horizontal: 'right' } };

    ws.getCell('A1').value = "Europa Envíos";
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.mergeCells('A1:D1');
    ws.getCell('A2').value = "LAMAQUINALOGISTICA, SOCIEDAD LIMITADA";
    ws.getCell('A3').value = "N.I.F.: B56340656";
    ws.getCell('A4').value = "CALLE ESTEBAN SALAZAR CHAPELA, NUM 20, PUERTA 87, NAVE 87";
    ws.getCell('A5').value = "29004 MÁLAGA (ESPAÑA)";
    ws.getCell('A6').value = "(34) 633 74 08 31";

    ws.getCell('A8').value = "Factura Proforma";
    ws.getCell('A8').font = { bold: true, size: 16 };
    ws.mergeCells('A8:D8');
    ws.getCell('A9').value = new Date().toLocaleDateString('es-ES');
    ws.mergeCells('A9:D9');

    ws.getCell('A11').value = "Cliente";
    ws.getCell('A11').style = boldStyle;
    ws.getCell('B11').value = "Nº factura";
    ws.getCell('B11').style = boldStyle;
    ws.getCell('A12').value = r.courier;
    ws.getCell('B12').value = "-";

    ws.getCell('A15').value = "Descripción";
    ws.getCell('A15').style = headerStyle;
    ws.getCell('B15').value = "Cantidad";
    ws.getCell('B15').style = headerStyle;
    ws.getCell('C15').value = "Precio unitario";
    ws.getCell('C15').style = headerStyle;
    ws.getCell('D15').value = "Precio total";
    ws.getCell('D15').style = headerStyle;

    let currentRow = 16;
    detalle.forEach(item => {
      ws.getCell(`A${currentRow}`).value = item[0];
      ws.getCell(`B${currentRow}`).value = item[1];
      ws.getCell(`B${currentRow}`).numFmt = '#,##0.000';
      ws.getCell(`C${currentRow}`).value = item[2];
      ws.getCell(`C${currentRow}`).numFmt = '#,##0.00';
      ws.getCell(`D${currentRow}`).value = item[3];
      ws.getCell(`D${currentRow}`).numFmt = '#,##0.00';
      currentRow++;
    });

    const totalRow = currentRow + 2;
    ws.getCell(`C${totalRow}`).value = "Total";
    ws.getCell(`C${totalRow}`).style = totalStyle;
    ws.getCell(`D${totalRow}`).value = Number(total.toFixed(2));
    ws.getCell(`D${totalRow}`).style = { font: { bold: true } };
    ws.getCell(`D${totalRow}`).numFmt = '#,##0.00';

    ws.columns = [
      { width: 50 }, { width: 15 }, { width: 15 }, { width: 15 }
    ];

    wb.xlsx.writeBuffer().then(buffer => {
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Proforma_${r.courier}_${flight.codigo}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  return (
    <Section title="Proformas por courier">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 items-end">
          <Field label="Desde"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
          <Field label="Hasta"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
          <Field label="Carga">
            <select className="text-sm rounded-lg border-slate-300 px-3 py-2 w-full" value={flightId} onChange={e => setFlightId(e.target.value)}>
              <option value="">Seleccionar carga…</option>
              {list
                .filter(f => !from || f.fecha_salida >= from)
                .filter(f => !to || f.fecha_salida <= to)
                .map(f => <option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
            </select>
          </Field>
      </div>

      {!flight ? <EmptyState icon={Iconos.box} title="Selecciona una carga" message="Elige una carga para ver las proformas por courier." /> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="bg-slate-50">{["Courier", "Kg facturable", "Kg exceso", "TOTAL USD", "XLSX"].map(h => <th key={h} className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-200">
              {porCourier.map(r => {
                let tot;
                let kgExcesoDisplay = r.kg_exc; // Valor por defecto
                const extrasMonto = extrasDeCourier(r.courier).reduce((s, e) => s + parseComma(e.monto), 0);
                const flightCode = (flight.codigo || "").toUpperCase();
                const isMaritimo = flightCode.startsWith("MAR");
                const isPybox = flightCode.startsWith("AIR-PYBOX");
                const isAirMulti = flightCode.startsWith("AIR-MULTI");
                
                if (isPybox && r.courier === 'ParaguayBox') {
                    const cajasDelVuelo = flight.cajas || [];
                    const totalPesoVolumetricoCajas = sum(cajasDelVuelo.map(c => (parseIntEU(c.L) * parseIntEU(c.A) * parseIntEU(c.H)) / 6000));
                    const totalPesoRealCajas = sum(cajasDelVuelo.map(c => parseComma(c.peso)));
                    let excesoVolumenCantidad = totalPesoVolumetricoCajas - totalPesoRealCajas;
                    if (excesoVolumenCantidad < 0) excesoVolumenCantidad = 0;
                    
                    kgExcesoDisplay = excesoVolumenCantidad; // Sobreescribimos para la UI

                    // CAMBIO: Usar el peso real total de las cajas para el costo de procesamiento.
                    const costoProcesamiento = totalPesoRealCajas * 24.00;
                    const costoExceso = excesoVolumenCantidad * 8.00;
                    tot = costoProcesamiento + costoExceso + extrasMonto;

                } else if (isMaritimo) {
                  tot = (r.kg_fact * T.fleteMaritimo) + extrasMonto;
                } else { // Aéreo Normal
                  const proc = r.kg_fact * T.proc;
                  const fr = r.kg_fact * T.fleteReal;
                  const fe = r.kg_exc * T.fleteExc;
                  const desp = r.kg_fact * T.despacho;
                  
                  let canje = r.courier !== 'Global Box' ? canjeGuiaUSD(r.kg_fact) : 0;
                  if (isAirMulti) {
                    canje = Math.min(canje, 57);
                  }
                  
                  // CORRECCIÓN: Se ajusta el nombre de 'InflightBox' a 'Inflight Box' para que la excepción se aplique correctamente.
                  const com = r.courier !== 'Inflight Box' ? 0.04 * (proc + fr + fe + extrasMonto) : 0;
                  tot = proc + fr + fe + desp + canje + extrasMonto + com;
                }

                return (
                  <tr key={r.courier} className="hover:bg-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap">{r.courier}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(r.kg_fact)} kg</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(kgExcesoDisplay)} kg</td>
                    <td className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap">{fmtMoney(tot)}</td>
                    <td className="px-3 py-2 whitespace-nowrap"><Button onClick={() => exportX(r)}>Descargar</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}