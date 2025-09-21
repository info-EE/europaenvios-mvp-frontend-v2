/* eslint-disable react/prop-types */
import React, { useMemo, useRef, useState, useEffect } from "react";
import { db, storage } from "../../firebase";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { doc, runTransaction } from "firebase/firestore";

// Componentes
import { Section } from "../common/Section";
import { Input } from "../common/Input";
import { Field } from "../common/Field";
import { Modal } from "../common/Modal";
import { EmptyState } from "../common/EmptyState";
import { Button } from "../common/Button";

// Helpers & Constantes
import {
  Iconos,
  uuid,
  sheetFromAOAStyled,
  downloadXLSX,
  th,
  td
} from "../../utils/helpers.jsx";

export function PaquetesSinCasilla({ currentUser, items, onAdd, onUpdate, onRemove, onAsignarCasilla }) {
  const isAdmin = currentUser?.role === "ADMIN";
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [nombre, setNombre] = useState("");
  const [tracking, setTracking] = useState("");
  const [foto, setFoto] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editRow, setEditRow] = useState({ fecha: "", nombre: "", tracking: "", foto: null });
  const [isAdding, setIsAdding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [viewer, setViewer] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);

  const add = async () => {
    if (!isAdmin || isAdding || isUploading) return;
    if (!fecha || !nombre.trim()) { alert("Completá Fecha y Nombre."); return; }

    setIsAdding(true);
    let finalNumero = 0;
    try {
      const counterRef = doc(db, "counters", "sinCasillaSequence");
      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let newCount = 1;
        if (counterDoc.exists()) {
          newCount = (counterDoc.data().currentCount || 0) + 1;
        }
        if (newCount > 999) newCount = 1;
        transaction.set(counterRef, { currentCount: newCount }, { merge: true });
        finalNumero = newCount;
      });

      const row = { fecha, numero: finalNumero, nombre: nombre.trim(), tracking: tracking.trim(), foto: foto };
      await onAdd(row);

      setNombre("");
      setTracking("");
      setFoto(null);
    } catch (e) {
      console.error("Error al crear paquete sin casilla: ", e);
      alert(`No se pudo generar el paquete. Error: ${e.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  useEffect(() => {
    if (!camOpen) return;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = s; if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
      } catch { alert("No se pudo acceder a la cámara."); setCamOpen(false); }
    })();
    return () => { if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } };
  }, [camOpen]);

  const handleImageUpload = async (imageDataUrl, target) => {
    if (!imageDataUrl) return;
    setIsUploading(true);
    try {
      const imageName = `sin-casilla/${uuid()}.jpg`;
      const storageRef = ref(storage, imageName);
      const snapshot = await uploadString(storageRef, imageDataUrl, 'data_url');
      const downloadURL = await getDownloadURL(snapshot.ref);
      if (target === 'new') {
        setFoto(downloadURL);
      } else if (target === 'edit') {
        setEditRow(r => ({ ...r, foto: downloadURL }));
      }
    } catch (error) {
      console.error("Error al subir imagen:", error);
      alert("Hubo un error al subir la foto.");
    } finally {
      setIsUploading(false);
    }
  };

  const tomarFoto = (target) => {
    const v = videoRef.current; if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d"); ctx.drawImage(v, 0, 0);
    const data = canvas.toDataURL("image/jpeg", 0.85);
    handleImageUpload(data, target);
    setCamOpen(false);
  };

  const onFile = (e, target) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => handleImageUpload(r.result, target);
    r.readAsDataURL(file);
  };

  const handleAsignarCasilla = (paquete) => {
    if (!isAdmin) return;
    const casilla = window.prompt(`Asignar casilla para el paquete Nº ${paquete.numero} (${paquete.nombre}):`);
    if (casilla && casilla.trim()) {
      onAsignarCasilla(paquete, casilla);
    }
  };

  const filtered = useMemo(() => {
    const arr = items
      .filter(r => !from || (r.fecha || "") >= from)
      .filter(r => !to || (r.fecha || "") <= to)
      .filter(r => {
        const qq = q.toLowerCase();
        const base = String(r.numero).includes(q) || (r.nombre || "").toLowerCase().includes(qq);
        return isAdmin ? (base || (r.tracking || "").toLowerCase().includes(qq)) : base;
      });
    return arr.slice().sort((a, b) => Number(a.numero) - Number(b.numero));
  }, [items, from, to, q, isAdmin]);

  function startEdit(r) {
    if (!isAdmin) return;
    setEditId(r.id);
    setEditRow({ fecha: r.fecha || "", nombre: r.nombre || "", tracking: r.tracking || "", foto: r.foto || null });
  }
  function saveEdit() {
    if (!isAdmin) return;
    if (!editId) return;
    onUpdate({ id: editId, ...editRow });
    setEditId(null);
  }
  function cancelEdit() { setEditId(null); }
  function removeRow(r) {
    if (!isAdmin) return;
    const ok = window.confirm(`¿Eliminar el paquete Nº ${r.numero}?`);
    if (!ok) return;
    onRemove(r.id);
  }

  function exportXLSX() {
    if (!isAdmin) return;
    const header = isAdmin
      ? [th("Fecha recepción"), th("Nº paquete"), th("Nombre y apellido"), th("Tracking")]
      : [th("Fecha recepción"), th("Nº paquete"), th("Nombre y apellido")];
    const body = filtered.map(r => {
      const row = [td(r.fecha || ""), td(String(r.numero)), td(r.nombre || "")];
      if (isAdmin) row.push(td(r.tracking || ""));
      return row;
    });
    const { ws } = sheetFromAOAStyled("Sin casilla", [header, ...body], {
      cols: isAdmin ? [{ wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 24 }] : [{ wch: 14 }, { wch: 12 }, { wch: 28 }],
      rows: [{ hpt: 24 }]
    });
    downloadXLSX("Paquetes_sin_casilla.xlsx", [{ name: "Sin casilla", ws }]);
  }

  return (
    <Section
      title="Paquetes sin casilla"
      right={isAdmin ? <Button onClick={exportXLSX}>Exportar XLSX</Button> : null}
    >
      {isAdmin && (
        <div className="grid md:grid-cols-4 gap-4 mb-4 p-4 bg-slate-50 rounded-lg">
          <Field label="Fecha recepción" required>
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </Field>
          <Field label="Nombre y apellido" required>
            <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Juan Pérez" />
          </Field>
          <Field label="Tracking">
            <Input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="1Z999..." />
          </Field>
          <div className="flex items-end">
            <Button variant="primary" onClick={add} disabled={isAdding || isUploading}>{isUploading ? "Subiendo..." : "Agregar"}</Button>
          </div>
          <div className="md:col-span-4">
            <Field label="Foto (opcional)">
              <div className="flex gap-2 items-center">
                <input ref={fileRef} type="file" accept="image/*" onChange={(e) => onFile(e, 'new')} className="hidden" />
                <Button onClick={() => fileRef.current?.click()} disabled={isUploading}>Seleccionar archivo</Button>
                <Button onClick={() => setCamOpen('new')} disabled={isUploading}>Tomar foto</Button>
                {foto && <a href={foto} target="_blank" rel="noopener noreferrer" className="text-green-600 text-sm font-semibold hover:underline">✓ Ver foto</a>}
              </div>
            </Field>
          </div>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Field label="Filtrar desde">
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </Field>
      </div>
      <div className="mb-4">
        <Input placeholder={isAdmin ? "Buscar por Nº, Nombre o Tracking…" : "Buscar por Nº o Nombre…"} value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Fecha recepción</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Nº paquete</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Nombre y apellido</th>
              {isAdmin && <th className="text-left px-3 py-2 font-semibold text-slate-600">Tracking</th>}
              {isAdmin && <th className="text-left px-3 py-2 font-semibold text-slate-600">Foto</th>}
              {isAdmin && <th className="text-left px-3 py-2 font-semibold text-slate-600">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-slate-50">
                {editId === r.id ? (
                  <>
                    <td className="px-3 py-1"><Input type="date" value={editRow.fecha} onChange={e => setEditRow({ ...editRow, fecha: e.target.value })} /></td>
                    <td className="px-3 py-1">{r.numero}</td>
                    <td className="px-3 py-1"><Input value={editRow.nombre} onChange={e => setEditRow({ ...editRow, nombre: e.target.value })} /></td>
                    {isAdmin && <td className="px-3 py-1"><Input value={editRow.tracking} onChange={e => setEditRow({ ...editRow, tracking: e.target.value })} /></td>}
                    {isAdmin && <td className="px-3 py-1">
                      <div className="flex flex-col gap-1">
                        {editRow.foto && <img src={editRow.foto} className="w-12 h-12 object-cover rounded-md" alt="Paquete" />}
                        <input ref={fileRef} type="file" accept="image/*" onChange={(e) => onFile(e, 'edit')} className="hidden" />
                        <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-francia-600 hover:underline" disabled={isUploading}>Cambiar</button>
                        <button type="button" onClick={() => setCamOpen('edit')} className="text-xs text-francia-600 hover:underline" disabled={isUploading}>Tomar Foto</button>
                        <button onClick={() => setEditRow(er => ({ ...er, foto: null }))} className="text-xs text-red-600 hover:underline">Quitar</button>
                      </div>
                    </td>}
                    {isAdmin && (
                      <td className="px-3 py-1">
                        <div className="flex gap-2">
                          <Button variant="icon" className="bg-green-100 text-green-700" onClick={saveEdit}>{Iconos.save}</Button>
                          <Button variant="icon" onClick={cancelEdit}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </Button>
                        </div>
                      </td>
                    )}
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2">{r.fecha || ""}</td>
                    <td className="px-3 py-2">{r.numero}</td>
                    <td className="px-3 py-2">{r.nombre || ""}</td>
                    {isAdmin && <td className="px-3 py-2">{r.tracking || "—"}</td>}
                    {isAdmin && (
                      <td className="px-3 py-2">
                        {r.foto ? <img alt="foto" src={r.foto} className="w-12 h-12 object-cover rounded-md cursor-pointer" onClick={() => setViewer([r.foto])} /> : "—"}
                      </td>
                    )}
                    {isAdmin && (
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Button onClick={() => handleAsignarCasilla(r)} className="px-3 py-1 text-xs rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors">Asignar casilla</Button>
                          <Button variant="icon" onClick={() => startEdit(r)}>{Iconos.edit}</Button>
                          <Button variant="iconDanger" onClick={() => removeRow(r)}>{Iconos.delete}</Button>
                        </div>
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={isAdmin ? 6 : 3}><EmptyState icon={Iconos.box} title="No hay paquetes sin casilla" /></td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={!!camOpen} onClose={() => setCamOpen(false)} title="Tomar foto">
        <div className="space-y-3">
          <video ref={videoRef} playsInline className="w-full rounded-xl bg-black/50" />
          <div className="flex justify-end"> <Button variant="primary" onClick={() => tomarFoto(camOpen)}>Capturar</Button></div>
        </div>
      </Modal>
      <Modal open={!!viewer} onClose={() => setViewer(null)} title="Fotos del Paquete">
        {viewer && (
          <a href={viewer[0]} target="_blank" rel="noopener noreferrer" title="Abrir en nueva pestaña para hacer zoom">
            <img src={viewer[0]} alt="Foto" className="max-w-full max-h-[70vh] rounded-xl cursor-zoom-in" />
          </a>
        )}
      </Modal>
    </Section>
  );
}