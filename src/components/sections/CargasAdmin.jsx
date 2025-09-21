/* eslint-disable react/prop-types */
import React, { useState } from "react";

// Context
import { useModal } from "../../context/ModalContext.jsx";

// Componentes
import { Section } from "../common/Section.jsx";
import { Input } from "../common/Input.jsx";
import { Field } from "../common/Field.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { Button } from "../common/Button.jsx";

// Helpers & Constantes
import { Iconos, uuid, ESTADOS_CARGA } from "../../utils/helpers.jsx";

export function CargasAdmin({ flights, onAdd, onUpdate, onDelete, packages }) {
  const [code, setCode] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [awb, setAwb] = useState("");
  const [fac, setFac] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const { showAlert, showConfirmation } = useModal();

  const today = new Date();
  const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30)).toISOString().slice(0, 10);
  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState("");

  const create = async () => {
    if (!code.trim()) {
      await showAlert("Campo requerido", "El código de carga es obligatorio.");
      return;
    }
    onAdd({ codigo: code.trim().toUpperCase(), fecha_salida: date, estado: "En bodega", awb, factura_cacesa: fac, cajas: [], docs: [] });
    setCode(""); setAwb(""); setFac("");
  }

  function getMissingScanPackages(flight) {
    const idsDeCarga = packages.filter(p => p.flight_id === flight.id).map(p => p.id);
    const asignados = new Set((flight.cajas || []).flatMap(c => c.paquetes || []));
    const missingIds = idsDeCarga.filter(id => !asignados.has(id));
    return missingIds.map(id => packages.find(p => p.id === id)?.codigo || 'ID desconocido');
  }

  const updateField = async (f, field, value) => {
    if (field === "estado" && value !== "En bodega" && f.estado === 'En bodega') {
      const missingPackages = getMissingScanPackages(f);
      if (missingPackages.length > 0) {
        const packageList = missingPackages.join(', ');
        const message = `Atención: Faltan escanear ${missingPackages.length} paquete(s) en "Armado de cajas" para la carga ${f.codigo}.\n\nPaquetes faltantes: ${packageList}\n\n¿Deseás continuar igualmente?`;
        const confirmed = await showConfirmation("Paquetes Faltantes", message);
        if (!confirmed) return;
      }
    }
    onUpdate({ ...f, [field]: value });
  }

  const del = async (id, codigo) => {
    const tienePaquetes = packages.some(p => p.flight_id === id);
    if (tienePaquetes) {
      await showAlert("Operación no permitida", `No se puede eliminar la carga ${codigo || ""} porque tiene paquetes asociados.`);
      return;
    }
    const confirmed = await showConfirmation("Confirmar eliminación", `¿Eliminar la carga ${codigo || id}?`);
    if (confirmed) {
      onDelete(id);
    }
  }

  const handleFileUpload = (e, flight) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const newDoc = {
        id: uuid(),
        name: file.name,
        data: event.target.result,
      };
      onUpdate({ ...flight, docs: [...(flight.docs || []), newDoc] });
    };
    reader.readAsDataURL(file);
  };

  const deleteDocument = (flight, docId) => {
    onUpdate({ ...flight, docs: flight.docs.filter(d => d.id !== docId) });
  };

  const list = flights
    .filter(f => !from || f.fecha_salida >= from)
    .filter(f => !to || f.fecha_salida <= to)
    .filter(f => statusFilter === 'Todos' || f.estado === statusFilter);

  return (
    <Section title="Gestión de cargas"
      right={
        <div className="flex gap-2 items-end">
          <Field label="Desde"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
          <Field label="Hasta"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
          <Field label="Estado">
            <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="Todos">Todos</option>
              {ESTADOS_CARGA.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      }>
      <div className="bg-slate-50 rounded-xl p-4 mb-6 grid md:grid-cols-5 gap-4 items-end">
        <Field label="Código de carga" required><Input placeholder="AIR-..." value={code} onChange={e => setCode(e.target.value)} /></Field>
        <Field label="Fecha de salida" required><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="AWB (opcional)"><Input value={awb} onChange={e => setAwb(e.target.value)} /></Field>
        <Field label="Factura Cacesa (opcional)"><Input value={fac} onChange={e => setFac(e.target.value)} /></Field>
        <Button variant="primary" onClick={create}>Crear Carga</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {list.length > 0 ? list.map(f => (
          <div key={f.id} className="bg-white rounded-xl shadow-md border border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <Input className="text-lg font-bold !border-0 !p-0 !ring-0" value={f.codigo} onChange={e => updateField(f, "codigo", e.target.value)} />
              <div className="flex gap-2">
                <Button variant="icon" onClick={() => document.getElementById(`file-input-${f.id}`).click()}>{Iconos.upload}</Button>
                <input type="file" id={`file-input-${f.id}`} className="hidden" onChange={(e) => handleFileUpload(e, f)} />
                <Button variant="iconDanger" onClick={() => del(f.id, f.codigo)}>{Iconos.delete}</Button>
              </div>
            </div>
            <div className="p-4 space-y-3 flex-grow">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500">Estado</span>
                <select className="text-sm rounded-lg border-slate-300 px-2 py-1" value={f.estado} onChange={e => updateField(f, "estado", e.target.value)}>
                  {ESTADOS_CARGA.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500">Fecha Salida</span>
                <Input type="date" value={f.fecha_salida} onChange={e => updateField(f, "fecha_salida", e.target.value)} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500">AWB</span>
                <Input value={f.awb || ""} onChange={e => updateField(f, "awb", e.target.value)} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500">Factura</span>
                <Input value={f.factura_cacesa || ""} onChange={e => updateField(f, "factura_cacesa", e.target.value)} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-500">Cajas</span>
                <span className="text-sm font-bold text-slate-800">{f.cajas?.length || 0}</span>
              </div>
            </div>
            {(f.docs && f.docs.length > 0) && (
              <div className="p-4 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-600 mb-2">Documentos Adjuntos</h4>
                <ul className="space-y-2">
                  {f.docs.map(doc => (
                    <li key={doc.id} className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded-md">
                      <a href={doc.data} download={doc.name} className="text-francia-600 hover:underline flex items-center gap-2">
                        {Iconos.file} {doc.name}
                      </a>
                      <Button variant="iconDanger" onClick={() => deleteDocument(f, doc.id)}>{Iconos.delete}</Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )) : (
          <div className="lg:col-span-3">
            <EmptyState icon={Iconos.box} title="No hay cargas" message="Crea una nueva carga para empezar a asociar paquetes." />
          </div>
        )}
      </div>
    </Section>
  );
}