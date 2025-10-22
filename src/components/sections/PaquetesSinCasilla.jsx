/* eslint-disable react/prop-types */
import React, { useMemo, useRef, useState, useEffect } from "react";
import { db, storage } from "../../firebase.js";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { doc, runTransaction, onSnapshot, setDoc } from "firebase/firestore";

// Context
import { useModal } from "../../context/ModalContext.jsx";

// Componentes
import { Section } from "../common/Section.jsx";
import { Input } from "../common/Input.jsx";
import { Field } from "../common/Field.jsx";
import { Modal } from "../common/Modal.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { Button } from "../common/Button.jsx";
import { QrCodeModal } from "../common/QrCodeModal.jsx";
import { CameraModal } from "../common/CameraModal.jsx";
import { ImageViewerModal } from "../common/ImageViewerModal.jsx";

// Helpers & Constantes
import {
  Iconos,
  uuid,
  sheetFromAOAStyled,
  downloadXLSX,
  th,
  td,
  getColumnWidths,
  printHTMLInIframe,
  sinCasillaLabelHTML,
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
  
  // State for editing modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null); // Will hold the item being edited

  const [isAdding, setIsAdding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(null); // 'new' or 'edit'
  const [viewerImages, setViewerImages] = useState([]);
  const [uploadSessionId, setUploadSessionId] = useState(null);

  const { showAlert, showConfirmation, showPrompt } = useModal();

  const fileRef = useRef(null);

  useEffect(() => {
    if (!uploadSessionId) return;

    const sessionRef = doc(db, "mobileUploadSessions", uploadSessionId);
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.photoUrls && data.photoUrls.length > 0) {
                const latestPhoto = data.photoUrls[data.photoUrls.length - 1];
                if (isEditModalOpen && editRow) {
                  setEditRow(r => ({ ...r, foto: latestPhoto }));
                } else {
                  setFoto(latestPhoto);
                }
            }
        }
    });

    return () => unsubscribe();
  }, [uploadSessionId, isEditModalOpen, editRow]);

  const add = async () => {
    if (!isAdmin || isAdding || isUploading) return;
    if (!fecha || !nombre.trim()) { 
      await showAlert("Campos requeridos", "Completá los campos de Fecha y Nombre."); 
      return; 
    }

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

      // Imprimir etiqueta
      printHTMLInIframe(sinCasillaLabelHTML({
        fecha: row.fecha,
        tracking: row.tracking,
        nombre: row.nombre,
        numero: row.numero
      }));

      setNombre("");
      setTracking("");
      setFoto(null);
    } catch (e) {
      console.error("Error al crear paquete sin casilla: ", e);
      await showAlert("Error de base de datos", `No se pudo generar el paquete. Error: ${e.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleReprint = (paquete) => {
    if (!paquete) return;
    printHTMLInIframe(sinCasillaLabelHTML({
      fecha: paquete.fecha,
      tracking: paquete.tracking,
      nombre: paquete.nombre,
      numero: paquete.numero
    }));
  };

  const startMobileUploadSession = async () => {
    const sessionId = uuid();
    try {
      const sessionRef = doc(db, "mobileUploadSessions", sessionId);
      await setDoc(sessionRef, { createdAt: new Date(), photoUrls: [] });
      setUploadSessionId(sessionId);
    } catch (error) {
      console.error("Error al iniciar la sesión de subida:", error);
      showAlert("Error", "No se pudo iniciar la sesión para la subida móvil.");
      setUploadSessionId(null);
    }
  };

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
      await showAlert("Error de subida", "Hubo un error al subir la foto.");
    } finally {
      setIsUploading(false);
    }
  };

  const onFile = (e, target) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => handleImageUpload(r.result, target);
    r.readAsDataURL(file);
  };

  const handleAsignarCasilla = async (paquete) => {
    if (!isAdmin) return;
    const casilla = await showPrompt({
        title: "Asignar Casilla",
        message: `Ingresá el número de casilla para el paquete Nº ${paquete.numero} (${paquete.nombre}):`,
        inputLabel: "Nº de Casilla"
    });
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
    setEditRow({ ...r, foto: r.foto || null });
    setIsEditModalOpen(true);
  }

  function saveEdit() {
    if (!isAdmin || !editRow) return;
    onUpdate({ id: editRow.id, fecha: editRow.fecha, nombre: editRow.nombre, tracking: editRow.tracking, foto: editRow.foto });
    setIsEditModalOpen(false);
  }
  function cancelEdit() { 
    setIsEditModalOpen(false);
    setEditRow(null);
  }
  
  const removeRow = async (r) => {
    if (!isAdmin) return;
    const confirmed = await showConfirmation("Confirmar eliminación", `¿Seguro que quieres eliminar el paquete Nº ${r.numero}?`);
    if (confirmed) {
      onRemove(r.id);
    }
  }

  function exportXLSX() {
    if (!isAdmin) return;
    const header = isAdmin
      ? [th("Fecha recepción"), th("Nº paquete"), th("Nombre y apellido"), th("Tracking")]
      : [th("Fecha recepción"), th("Nº paquete"), th("Nombre y apellido")];
    const body = filtered.map(r => {
      const row = [td(r.fecha || ""), td(String(r.numero)), td(r.nombre || "")];
      if (isAdmin) row.push(td(r.tracking || "—"));
      return row;
    });
    
    const columnWidths = getColumnWidths(header, body);

    const { ws } = sheetFromAOAStyled("Sin casilla", [header, ...body], {
      cols: columnWidths,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 p-4 bg-slate-50 rounded-lg items-end">
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
          <div className="col-span-1 sm:col-span-2 lg:col-span-4">
            <Field label="Foto (opcional)">
              <div className="flex gap-2 items-center flex-wrap">
                <input ref={fileRef} type="file" accept="image/*" onChange={(e) => onFile(e, 'new')} className="hidden" />
                <Button onClick={() => fileRef.current?.click()} disabled={isUploading}>Seleccionar archivo</Button>
                <Button onClick={() => setIsCameraOpen('new')} disabled={isUploading}>Tomar foto</Button>
                <Button onClick={startMobileUploadSession} disabled={isUploading}>Usar cámara del móvil</Button>
                {foto && <a href={foto} target="_blank" rel="noopener noreferrer" className="text-green-600 text-sm font-semibold hover:underline">✓ Ver foto</a>}
              </div>
            </Field>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
              <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Fecha recepción</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Nº paquete</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Nombre y apellido</th>
              {isAdmin && <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Tracking</th>}
              {isAdmin && <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Foto</th>}
              {isAdmin && <th className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap">{r.fecha || ""}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.numero}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.nombre || ""}</td>
                {isAdmin && <td className="px-3 py-2 whitespace-nowrap">{r.tracking || "—"}</td>}
                {isAdmin && (
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.foto ? <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setViewerImages([r.foto])}>Ver foto</Button> : "—"}
                  </td>
                )}
                {isAdmin && (
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex gap-2 items-center">
                      <Button onClick={() => handleAsignarCasilla(r)} className="px-3 py-1 text-xs whitespace-nowrap rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors">Asignar casilla</Button>
                      <Button variant="icon" onClick={() => startEdit(r)}>{Iconos.edit}</Button>
                      <Button variant="iconDanger" onClick={() => removeRow(r)}>{Iconos.delete}</Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={isAdmin ? 6 : 3}><EmptyState icon={Iconos.box} title="No hay paquetes sin casilla" /></td></tr>}
          </tbody>
        </table>
      </div>
      
      {/* Edit Modal */}
      <Modal open={isEditModalOpen} onClose={cancelEdit} title="Editar Paquete Sin Casilla">
        {editRow && (
          <div className="space-y-4">
            <Field label="Fecha" required>
              <Input type="date" value={editRow.fecha} onChange={e => setEditRow({ ...editRow, fecha: e.target.value })} />
            </Field>
            <Field label="Nombre y apellido" required>
              <Input value={editRow.nombre} onChange={e => setEditRow({ ...editRow, nombre: e.target.value })} />
            </Field>
            <Field label="Tracking">
              <Input value={editRow.tracking} onChange={e => setEditRow({ ...editRow, tracking: e.target.value })} />
            </Field>
            <Field label="Foto">
              <div className="flex gap-2 items-center flex-wrap">
                <input ref={fileRef} type="file" accept="image/*" onChange={(e) => onFile(e, 'edit')} className="hidden" />
                <Button onClick={() => fileRef.current?.click()} disabled={isUploading}>Seleccionar archivo</Button>
                <Button onClick={() => setIsCameraOpen('edit')} disabled={isUploading}>Tomar foto</Button>
                <Button onClick={startMobileUploadSession} disabled={isUploading}>Usar cámara del móvil</Button>
                {isUploading && <span className="text-francia-600 text-sm font-semibold">Subiendo...</span>}
              </div>
            </Field>
            {editRow.foto && (
              <div className="relative w-24 h-24">
                <a href={editRow.foto} target="_blank" rel="noopener noreferrer">
                    <img src={editRow.foto} alt="Foto" className="w-24 h-24 object-cover rounded-md"/>
                </a>
                <button onClick={() => setEditRow(er => ({ ...er, foto: null }))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs">X</button>
              </div>
            )}
            <div className="flex justify-between items-center gap-2 mt-6">
              <Button variant="secondary" onClick={() => handleReprint(editRow)}>Reimprimir etiqueta</Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={cancelEdit}>Cancelar</Button>
                <Button variant="primary" onClick={saveEdit} disabled={isUploading}>
                    {isUploading ? 'Subiendo...' : 'Guardar Cambios'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <CameraModal open={!!isCameraOpen} onClose={() => setIsCameraOpen(null)} onCapture={(dataUrl) => handleImageUpload(dataUrl, isCameraOpen)} />

      <ImageViewerModal open={viewerImages.length > 0} onClose={() => setViewerImages([])} images={viewerImages} />

      <QrCodeModal open={!!uploadSessionId} onClose={() => { setUploadSessionId(null); }} sessionId={uploadSessionId} />
    </Section>
  );
}