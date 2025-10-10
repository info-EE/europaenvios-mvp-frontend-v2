/* eslint-disable react/prop-types */
import React, { useState, useEffect, useMemo } from "react";
import ExcelJS from "exceljs/dist/exceljs.min.js";

// Context
import { useModal } from "../../context/ModalContext.jsx";

// Componentes
import { Section } from "../common/Section.jsx";
import { Input } from "../common/Input.jsx";
import { Field } from "../common/Field.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { Button } from "../common/Button.jsx";

// Helpers & Constantes
import {
  Iconos,
  uuid,
  limpiar,
  fmtPeso,
  parseComma,
  parseIntEU,
  sum,
  boxLabelHTML,
  printHTMLInIframe,
} from "../../utils/helpers.jsx";

// --- Iconos para Plegar/Desplegar ---
const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 transition-transform">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
);
  
const ChevronUpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 transition-transform">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
    </svg>
);


export function ArmadoCajas({ packages, flights, onUpdateFlight }) {
  const [flightId, setFlightId] = useState("");
  const flight = flights.find(f => f.id === flightId);
  const [scan, setScan] = useState("");
  const [activeBoxId, setActiveBoxId] = useState(null);
  const [editingBoxId, setEditingBoxId] = useState(null);
  const [editingBoxData, setEditingBoxData] = useState(null);

  const { showPrompt, showConfirmation } = useModal();

  useEffect(() => {
    if (flightId) {
      const currentFlight = flights.find(f => f.id === flightId);
      if (currentFlight?.cajas?.length > 0) {
        if (!activeBoxId || !currentFlight.cajas.some(c => c.id === activeBoxId)) {
          setActiveBoxId(currentFlight.cajas[0].id);
        }
      } else {
        setActiveBoxId(null);
      }
      setEditingBoxId(null);
      setEditingBoxData(null);
    }
  }, [flightId, flights, activeBoxId]);

  // --- Memo para ordenar las cajas, poniendo la activa siempre primero ---
  const sortedCajas = useMemo(() => {
    if (!flight || !flight.cajas) return [];
    const cajas = [...flight.cajas];
    if (activeBoxId) {
        const activeIndex = cajas.findIndex(c => c.id === activeBoxId);
        if (activeIndex > 0) {
            // Mueve la caja activa al principio de la lista
            const [activeItem] = cajas.splice(activeIndex, 1);
            cajas.unshift(activeItem);
        }
    }
    return cajas;
  }, [flight, activeBoxId]);


  const startEditing = (box) => {
    setEditingBoxId(box.id);
    setEditingBoxData({ ...box });
  };

  const cancelEditing = () => {
    setEditingBoxId(null);
    setEditingBoxData(null);
  };

  const saveBoxChanges = () => {
    if (!editingBoxData || !flight) return;
    const updatedCajas = flight.cajas.map(c => c.id !== editingBoxId ? c : editingBoxData);
    onUpdateFlight({ ...flight, cajas: updatedCajas });
    cancelEditing();
  };

  const addBox = async () => {
    if (!flightId || !flight) return;
    const inTxt = await showPrompt({
        title: "Peso de la caja",
        message: "Ingresá el peso de la caja de cartón (kg).",
        inputLabel: "Peso (kg)",
        initialValue: "0,250"
    });
    if (inTxt === null) return;
    const peso_carton = fmtPeso(parseComma(inTxt));
    const n = (flight?.cajas?.length || 0) + 1;
    const newBox = { id: uuid(), codigo: `Caja ${n}`, paquetes: [], peso: "", L: "", A: "", H: "", peso_carton };
    const updatedCajas = [...(flight.cajas || []), newBox];
    onUpdateFlight({ ...flight, cajas: updatedCajas });
    setActiveBoxId(newBox.id);
  }

  const assign = () => {
    try {
      if (!flightId) {
        alert("Error de Carga: Primero debés seleccionar una carga del menú desplegable.");
        return;
      }
      const currentFlight = flights.find(f => f.id === flightId);
      if (!currentFlight) {
        alert("Error Interno: No se pudieron encontrar los detalles de la carga seleccionada.");
        return;
      }
      if (!scan.trim()) {
        alert("Campo Vacío: Por favor, escanea o ingresa un código de paquete.");
        return;
      }
  
      const upperScan = scan.toUpperCase();
      const pkg = packages.find(p => String(p.codigo || "").toUpperCase() === upperScan);
  
      if (!pkg) {
        alert(`Paquete no Encontrado: El paquete con el código "${upperScan}" no existe en el sistema.`);
        setScan("");
        return;
      }
  
      if (pkg.flight_id !== flightId) {
        const cargaDelPaquete = flights.find(f => f.id === pkg.flight_id)?.codigo || 'OTRA CARGA';
        alert(
          `Paquete en Carga Incorrecta:\n\nEl paquete ${pkg.codigo} pertenece a la carga "${cargaDelPaquete}" y no a la carga activa "${currentFlight.codigo}".`
        );
        setScan("");
        return;
      }
  
      const cajaExistente = currentFlight.cajas.find(c => (c.paquetes || []).includes(pkg.id));
      if (cajaExistente) {
        alert(`Paquete ya Asignado: El paquete ${pkg.codigo} ya fue agregado a la "${cajaExistente.codigo}".`);
        setScan("");
        return;
      }
      
      const currentActiveId = activeBoxId || currentFlight.cajas[0]?.id;
      if (!currentActiveId) {
        alert("No hay Caja Activa: Creá o seleccioná una caja antes de escanear paquetes.");
        return;
      }
  
      const updatedCajas = currentFlight.cajas.map(c =>
        c.id === currentActiveId ? { ...c, paquetes: [...(c.paquetes || []), pkg.id] } : c
      );
  
      onUpdateFlight({ ...currentFlight, cajas: updatedCajas });
      setScan("");

    } catch (error) {
      console.error("Error inesperado en la función assign:", error);
      alert(`Error Inesperado: Ocurrió un problema: ${error.message}.`);
      setScan("");
    }
  };

  function move(pid, fromId, toId) {
    if (!toId || !flight) return;
    const newCajas = flight.cajas.map(c => {
      if (c.id === fromId) return { ...c, paquetes: c.paquetes.filter(p => p !== pid) };
      if (c.id === toId) return { ...c, paquetes: [...c.paquetes, pid] };
      return c;
    });
    onUpdateFlight({ ...flight, cajas: newCajas });
  }

  const removeBox = async (id) => {
    if (!flight) return;
    const ok = await showConfirmation(
        "Confirmar eliminación",
        "¿Seguro que quieres eliminar esta caja? Los paquetes que contiene volverán a la lista de 'Paquetes en Bodega'."
    );
    if (!ok) return;

    const updatedCajas = flight.cajas.filter(c => c.id !== id);
    onUpdateFlight({ ...flight, cajas: updatedCajas });
    if (activeBoxId === id) setActiveBoxId(null);
    if (editingBoxId === id) cancelEditing();
  }

  function reorderBox(id, dir) {
    if (!flight) return;
    const arr = [...flight.cajas];
    const i = arr.findIndex(c => c.id === id); if (i < 0) return;
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onUpdateFlight({ ...flight, cajas: arr });
  }

  function pesoEstimado(caja) {
    const pesoCarton = parseComma(caja.peso_carton || "0");
    const ids = caja.paquetes || [];
    const pesoPkgs = sum(ids.map(pid => {
      const p = packages.find(x => x.id === pid);
      return p ? Number(p.peso_real || 0) : 0;
    }));
    return Number(pesoCarton + pesoPkgs);
  }

  function exportCajasXLSX() {
    if (!flight) { alert("Seleccioná una carga para exportar."); return; }
    if (!flight.cajas || flight.cajas.length === 0) { alert("No hay cajas en esta carga para exportar."); return; }

    const wb = new ExcelJS.Workbook();
    const thinBorder = { style: "thin", color: { argb: "FF000000" } };
    const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

    (flight.cajas || []).forEach((caja, idx) => {
      const ws = wb.addWorksheet(`CAJA ${idx + 1}`);
      const pkgObjs = (caja.paquetes || []).map(pid => packages.find(p => p.id === pid)).filter(Boolean);
      const cantPaquetes = pkgObjs.length;

      const byCourier = {};
      pkgObjs.forEach(p => {
        if (!byCourier[p.courier]) byCourier[p.courier] = [];
        byCourier[p.courier].push(p.codigo);
      });

      const couriers = Object.keys(byCourier).sort();
      const colWidths = {};

      ws.getCell('B2').value = "CONTROL DE PAQUETES";
      ws.getCell('B2').font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
      ws.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F4F4F' } };
      ws.getCell('B2').alignment = { horizontal: "center", vertical: "center" };
      ws.mergeCells('B2:L2');

      ws.getCell('B3').value = `CAJA Nº ${idx + 1}`;
      ws.getCell('B3').font = { bold: true };
      ws.mergeCells('B3:F3');

      ws.getCell('G3').value = `CANTIDAD DE PAQUETES: ${cantPaquetes}`;
      ws.getCell('G3').font = { bold: true };
      ws.mergeCells('G3:L3');

      let col = 2;
      couriers.forEach(c => {
        let maxLen = c.length;
        const cell = ws.getCell(4, col);
        cell.value = c;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F2F7' } };
        cell.alignment = { vertical: "center", horizontal: "center" };
        let row = 5;
        byCourier[c].forEach(p => {
          if (p.length > maxLen) maxLen = p.length;
          const pkgCell = ws.getCell(row, col);
          pkgCell.value = p;
          pkgCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBE0' } };
          row++;
        });
        colWidths[col] = maxLen + 2;
        col++;
      });
      
      Object.entries(colWidths).forEach(([colIndex, width]) => {
        ws.getColumn(Number(colIndex)).width = width;
      });

      for (let r = 2; r < 33; r++) {
        for (let c = 2; c < 13; c++) {
          const cell = ws.getCell(r, c);
          if (!cell.border) {
            cell.border = allBorders;
          }
        }
      }
    });

    wb.xlsx.writeBuffer().then(buffer => {
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cajas_${flight.codigo}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  function handlePrintBoxLabel(caja) {
    if (!flight) return;
    const couriers = new Set(caja.paquetes.map(pid => packages.find(p => p.id === pid)?.courier).filter(Boolean));
    const etiqueta = couriers.size === 0 ? flight.codigo : (couriers.size === 1 ? [...couriers][0] : "MULTICOURIER");

    const boxNumber = (caja.codigo || "").replace(/[^0-9]/g, "") || 'S/N';

    const data = {
      courier: etiqueta,
      boxNumber: boxNumber,
      pesoKg: parseComma(caja.peso || "0"),
      medidasTxt: `${caja.L || 0} x ${caja.A || 0} x ${caja.H || 0}`,
      fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }),
      cargaTxt: flight.codigo,
    };
    const html = boxLabelHTML(data);
    printHTMLInIframe(html);
  }

  return (
    <Section title="Armado de cajas">
      {/* --- Contenedor 'pegajoso' para el formulario de escaneo --- */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm py-4 z-10">
        <div className="grid md:grid-cols-3 gap-4">
            <Field label="Seleccionar carga" required>
            <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={flightId} onChange={e => { setFlightId(e.target.value); }}>
                <option value="">—</option>
                {flights.filter(f => f.estado === "En bodega").map(f => <option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
            </select>
            </Field>
            <Field label="Escanear / ingresar código">
            <Input value={scan} onChange={e => setScan(limpiar(e.target.value))} onKeyDown={e => e.key === "Enter" && assign()} placeholder="BOSSBOX1" />
            </Field>
            <div className="flex items-end gap-2">
            <Button variant="primary" onClick={addBox} disabled={!flightId}>Agregar caja</Button>
            <Button onClick={exportCajasXLSX} disabled={!flight}>Exportar XLSX</Button>
            </div>
        </div>
      </div>
      
      <div className="md:col-span-3 mt-4">
          {!flight && <EmptyState icon={Iconos.box} title="Selecciona una carga" message="Elige una carga para empezar a armar las cajas." />}
          {flight && sortedCajas.map((c, idx) => {
            const couriers = new Set(c.paquetes.map(pid => packages.find(p => p.id === pid)?.courier).filter(Boolean));
            const etiqueta = couriers.size === 0 ? "—" : (couriers.size === 1 ? [...couriers][0] : "MULTICOURIER");
            const isActive = activeBoxId === c.id;
            const isEditing = editingBoxId === c.id;
            const peso = parseComma(c.peso || "0");
            const L = parseIntEU(c.L || 0), A = parseIntEU(c.A || 0), H = parseIntEU(c.H || 0);
            const est = pesoEstimado(c);

            return (
              <div key={c.id} className={`border rounded-xl mb-3 transition-all duration-300 ${isActive ? "ring-2 ring-francia-500 shadow-lg" : "hover:shadow-md bg-slate-50"}`}>
                {/* --- Cabecera Clickeable --- */}
                <div className="p-4 cursor-pointer" onClick={() => setActiveBoxId(c.id)}>
                    <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-800">
                            {c.codigo} — {etiqueta} — <span>{fmtPeso(peso)} kg</span> — {L}x{A}x{H} cm
                            {isActive && <span className="ml-2 text-francia-600 text-xs font-bold">(ACTIVA)</span>}
                        </div>
                        <div className="flex items-center gap-2">
                           {isActive ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        </div>
                    </div>
                    {!isActive && 
                        <div className="text-xs text-slate-500 mt-1">
                            {c.paquetes.length} paquete(s) dentro. Haz clic para ver detalles.
                        </div>
                    }
                </div>
                
                {/* --- Contenido Plegable --- */}
                {isActive && (
                    <div className="px-4 pb-4">
                        <div className="flex items-center justify-between mb-3 border-t pt-3">
                            <div className="text-xs text-slate-600">
                                <b>Peso estimado:</b> {fmtPeso(est)} kg (cartón {fmtPeso(parseComma(c.peso_carton || "0"))} kg + paquetes)
                            </div>
                            <div className="flex gap-2">
                                <Button variant="icon" onClick={(e) => { e.stopPropagation(); handlePrintBoxLabel(c); }} title="Imprimir etiqueta de caja">{Iconos.print}</Button>
                                {!isEditing
                                ? <Button variant="icon" onClick={(e) => { e.stopPropagation(); startEditing(c); }}>{Iconos.edit}</Button>
                                : <Button variant="icon" className="bg-green-100 text-green-700" onClick={(e) => { e.stopPropagation(); saveBoxChanges(); }}>{Iconos.save}</Button>
                                }
                                <Button variant="icon" onClick={(e) => { e.stopPropagation(); reorderBox(c.id, "up") }}>↑</Button>
                                <Button variant="icon" onClick={(e) => { e.stopPropagation(); reorderBox(c.id, "down") }}>↓</Button>
                                <Button variant="iconDanger" onClick={(e) => { e.stopPropagation(); removeBox(c.id) }}>{Iconos.delete}</Button>
                            </div>
                        </div>

                        {isEditing && editingBoxData && (
                        <div className="grid md:grid-cols-5 gap-4 mb-3 p-3 bg-slate-50 rounded-lg" onClick={e => e.stopPropagation()}>
                            <Field label="Nombre"><Input value={editingBoxData.codigo} onChange={e => setEditingBoxData({ ...editingBoxData, codigo: e.target.value })} /></Field>
                            <Field label="Peso (kg)"><Input value={editingBoxData.peso || ""} onChange={e => setEditingBoxData({ ...editingBoxData, peso: e.target.value })} placeholder="3,128" /></Field>
                            <Field label="Largo (cm)"><Input value={editingBoxData.L || ""} onChange={e => setEditingBoxData({ ...editingBoxData, L: e.target.value })} /></Field>
                            <Field label="Ancho (cm)"><Input value={editingBoxData.A || ""} onChange={e => setEditingBoxData({ ...editingBoxData, A: e.target.value })} /></Field>
                            <Field label="Alto (cm)"><Input value={editingBoxData.H || ""} onChange={e => setEditingBoxData({ ...editingBoxData, H: e.target.value })} /></Field>
                        </div>
                        )}
                        
                        {/* --- Lista de paquetes horizontal --- */}
                        <ul className="flex flex-wrap gap-2">
                        {c.paquetes.map(pid => {
                            const p = packages.find(x => x.id === pid); if (!p) return null;
                            return (
                            <li key={pid} className="flex items-center gap-2 p-2 bg-slate-100 rounded-md text-sm shadow-sm">
                                <span className="font-mono text-slate-800 font-medium">{p.codigo}</span>
                                <span className="text-slate-500 text-xs">({p.courier})</span>
                                
                                {flight.cajas.length > 1 && (
                                <select className="text-xs border-slate-300 rounded px-1 py-0.5 ml-2" defaultValue="" onChange={e => { e.stopPropagation(); move(pid, c.id, e.target.value) }}>
                                    <option value="" disabled>Mover a…</option>
                                    {flight.cajas.filter(x => x.id !== c.id).map(x => <option key={x.id} value={x.id}>{x.codigo}</option>)}
                                </select>
                                )}
                                <Button variant="iconDanger" className="!p-1" onClick={(e) => {
                                e.stopPropagation();
                                const updatedPaquetes = c.paquetes.filter(z => z !== pid);
                                const updatedCaja = { ...c, paquetes: updatedPaquetes };
                                const updatedCajas = flight.cajas.map(cj => cj.id === c.id ? updatedCaja : cj);
                                onUpdateFlight({ ...flight, cajas: updatedCajas });
                                }}>{Iconos.delete}</Button>
                            </li>
                            );
                        })}
                        {c.paquetes.length === 0 && <li className="text-slate-500 text-center py-2 text-xs w-full">Escanea un paquete para agregarlo a esta caja</li>}
                        </ul>
                    </div>
                )}

              </div>
            );
          })}
        </div>
    </Section>
  );
}