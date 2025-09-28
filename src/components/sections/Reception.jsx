/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { db, storage } from "../../firebase.js";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { doc, getDoc, runTransaction, setDoc, onSnapshot } from "firebase/firestore";

// Context
import { useModal } from "../../context/ModalContext.jsx";

// Componentes
import { Section } from "../common/Section.jsx";
import { Button } from "../common/Button.jsx";
import { Field } from "../common/Field.jsx";
import { Input } from "../common/Input.jsx";
import { Modal } from "../common/Modal.jsx";
import { InfoBox } from "../common/InfoBox.jsx";
import { ManageList } from "../common/ManageList.jsx";
import { QrCodeModal } from "../common/QrCodeModal.jsx";

// Helpers & Constantes
import {
  courierPrefix,
  estadosPermitidosPorCarga,
  allowedCouriersByContext,
  limpiar,
  parseComma,
  parseIntEU,
  MIN_FACTURABLE,
  fmtPeso,
  labelHTML,
  printHTMLInIframe,
  uuid,
  Iconos
} from "../../utils/helpers.jsx";

export function Reception({ currentUser, couriers, setCouriers, estados, setEstados, flights, packages, onAdd }) {
  const vuelosBodega = flights.filter(f => f.estado === "En bodega");
  const [flightId, setFlightId] = useState("");
  const [form, setForm] = useState({
    courier: currentUser.role === "COURIER" ? (currentUser.courier || "") : "",
    estado: "", casilla: "", codigo: "",
    fecha: new Date().toISOString().slice(0, 10),
    ci_ruc: "", empresa: "", nombre: "", tracking: "", remitente: "",
    peso_real_txt: "", L_txt: "", A_txt: "", H_txt: "",
    desc: "", valor_txt: "",
    fotos: []
  });

  const [isUploading, setIsUploading] = useState(false);
  const [showMgr, setShowMgr] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);

  const [mobileUploadSessionId, setMobileUploadSessionId] = useState(null);
  
  const { showAlert } = useModal();

  // Escuchar cambios en la sesión de subida móvil
  useEffect(() => {
    if (!mobileUploadSessionId) return;

    const sessionDocRef = doc(db, "mobileUploadSessions", mobileUploadSessionId);
    const unsubscribe = onSnapshot(sessionDocRef, (doc) => {
      const data = doc.data();
      if (data && data.photoURL) {
        setForm(f => ({ ...f, fotos: [...f.fotos, data.photoURL] }));
        setMobileUploadSessionId(null); // Cierra el modal
      }
    });

    return () => unsubscribe();
  }, [mobileUploadSessionId, db]);

  const startMobileUploadSession = async () => {
    try {
      const sessionId = uuid();
      const sessionDocRef = doc(db, "mobileUploadSessions", sessionId);
      await setDoc(sessionDocRef, { createdAt: new Date(), photoURL: null });
      setMobileUploadSessionId(sessionId);
    } catch (error) {
      console.error("Error al iniciar sesión de subida móvil:", error);
      await showAlert("Error", "No se pudo iniciar la sesión para la subida móvil.");
    }
  };


  const codigoCargaSel = useMemo(() => flights.find(f => f.id === flightId)?.codigo || "", [flightId, flights]);
  const estadosPermitidos = useMemo(() => estadosPermitidosPorCarga(codigoCargaSel, estados.map(e => e.name)), [codigoCargaSel, estados]);

  useEffect(() => {
    if (!form.courier) {
      setForm(f => ({ ...f, codigo: "" }));
      return;
    }

    const previewCode = async () => {
      const prefix = courierPrefix(form.courier);
      const counterRef = doc(db, "counters", "packageSequences");
      try {
        const counterSnap = await getDoc(counterRef);
        const currentCount = counterSnap.data()?.[prefix] ?? -1;
        if (currentCount === -1) {
          setForm(f => ({ ...f, codigo: "ERR" }));
          console.warn(`Contador para ${prefix} no encontrado en Firestore.`);
        } else {
          setForm(f => ({ ...f, codigo: `${prefix}${currentCount + 1}` }));
        }
      } catch (error) {
        console.error("Error al obtener vista previa del código:", error);
        setForm(f => ({ ...f, codigo: "ERR" }));
      }
    };

    previewCode();
  }, [form.courier]);

  useEffect(() => {
    if (estadosPermitidos.length === 1 && form.estado !== estadosPermitidos[0]) {
      setForm(f => ({ ...f, estado: estadosPermitidos[0] }));
    }
  }, [estadosPermitidos, form.estado]);

  const courierOptions = useMemo(() => {
    return allowedCouriersByContext({
      casilla: form.casilla,
      flightCode: codigoCargaSel,
      avail: couriers.map(c => c.name)
    });
  }, [form.casilla, codigoCargaSel, couriers]);

  useEffect(() => {
    if (!courierOptions.includes(form.courier)) {
      setForm(f => ({ ...f, courier: courierOptions.length === 1 ? courierOptions[0] : "" }));
    }
  }, [courierOptions, form.courier]);

  const peso = parseComma(form.peso_real_txt);
  const L = parseIntEU(form.L_txt), A = parseIntEU(form.A_txt), H = parseIntEU(form.H_txt);
  const fact = Math.max(MIN_FACTURABLE, peso || 0);
  const vol = A && H && L ? (A * H * L) / 5000 : 0;
  const exc = Math.max(0, vol - fact);

  const okCampos = () => [
    "courier", "estado", "casilla", "fecha", "empresa", "nombre",
    "tracking", "remitente", "peso_real_txt", "L_txt", "A_txt", "H_txt", "desc", "valor_txt"
  ].every(k => String(form[k] || "").trim() !== "");

  const submit = async () => {
    if (isUploading) return;
    if (!flightId) { await showAlert("Error de validación", "Seleccioná una Carga."); return; }
    if (!okCampos()) { await showAlert("Error de validación", "Faltan campos obligatorios."); return; }

    const fl = flights.find(f => f.id === flightId);
    if (fl?.codigo.toUpperCase().startsWith("AIR-MULTI") && form.courier === "ParaguayBox") {
      await showAlert("Validación de Carga", "No se permite cargar paquetes de ParaguayBox en cargas que comiencen con AIR-MULTI.");
      return;
    }

    let finalCode = "";
    try {
      await runTransaction(db, async (transaction) => {
        const prefix = courierPrefix(form.courier);
        const counterRef = doc(db, "counters", "packageSequences");
        const counterDoc = await transaction.get(counterRef);

        if (!counterDoc.exists() || counterDoc.data()?.[prefix] === undefined) {
          throw new Error(`El contador para "${prefix}" no está configurado en Firestore.`);
        }

        let newCount = (counterDoc.data()[prefix] || 0) + 1;
        if (newCount > 999) newCount = 1;

        transaction.update(counterRef, { [prefix]: newCount });
        finalCode = `${prefix}${newCount}`;
      });
    } catch (e) {
      console.error("Error en la transacción del contador: ", e);
      await showAlert("Error de base de datos", `No se pudo generar el código del paquete. Error: ${e.message}`);
      return;
    }

    if (packages.some(p => p.flight_id === flightId && p.codigo === finalCode)) {
      await showAlert("Error de duplicado", `El código de paquete "${finalCode}" ya existe en esta carga. Intente de nuevo.`);
      return;
    }

    const newPackage = {
      flight_id: flightId,
      courier: form.courier, estado: form.estado, casilla: form.casilla,
      codigo: finalCode,
      codigo_full: `${fl?.codigo || "CARGA"}-${finalCode}`,
      fecha: form.fecha, ci_ruc: form.ci_ruc, empresa_envio: form.empresa, nombre_apellido: form.nombre,
      tracking: form.tracking, remitente: form.remitente,
      peso_real: peso, largo: L, ancho: A, alto: H,
      descripcion: form.desc, valor_aerolinea: parseComma(form.valor_txt),
      peso_facturable: Number(fact.toFixed(3)), peso_volumetrico: Number(vol.toFixed(3)), exceso_volumen: Number(exc.toFixed(3)),
      fotos: form.fotos,
      estado_bodega: "En bodega",
    };

    const medidas = `${L}x${A}x${H} cm`;
    const html = labelHTML({
      codigo: finalCode, nombre: form.nombre, casilla: form.casilla,
      pesoKg: peso, medidasTxt: medidas, desc: form.desc, cargaTxt: fl?.codigo || "-", fecha: form.fecha
    });

    await onAdd(newPackage);
    printHTMLInIframe(html);

    setFlightId("");
    setForm(f => ({
      ...f, courier: currentUser.role === "COURIER" ? f.courier : "", estado: "", casilla: "", codigo: "", ci_ruc: "", empresa: "", nombre: "", tracking: "", remitente: "",
      peso_real_txt: "", L_txt: "", A_txt: "", H_txt: "", desc: "", valor_txt: "", fotos: []
    }));
  };

  useEffect(() => {
    if (!camOpen) return;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = s; if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
      } catch { 
        showAlert("Error de cámara", "No se pudo acceder a la cámara.");
        setCamOpen(false); 
      }
    })();
    return () => { if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } };
  }, [camOpen, showAlert]);

  const handleImageUpload = async (imageDataUrl) => {
    if (!imageDataUrl) return;
    setIsUploading(true);
    try {
      const imageName = `paquetes/${uuid()}.jpg`;
      const storageRef = ref(storage, imageName);
      const snapshot = await uploadString(storageRef, imageDataUrl, 'data_url');
      const downloadURL = await getDownloadURL(snapshot.ref);
      setForm(f => ({ ...f, fotos: [...f.fotos, downloadURL] }));
    } catch (error) {
      console.error("Error al subir imagen:", error);
      await showAlert("Error de subida", "Hubo un error al subir la foto.");
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (urlToRemove) => {
    setForm(f => ({ ...f, fotos: f.fotos.filter(url => url !== urlToRemove) }));
  };

  const tomarFoto = () => {
    const v = videoRef.current; if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d"); ctx.drawImage(v, 0, 0);
    const data = canvas.toDataURL("image/jpeg", 0.85);
    handleImageUpload(data);
    setCamOpen(false);
  };

  const onFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => handleImageUpload(r.result);
    r.readAsDataURL(file);
  };

  if (currentUser.role === "COURIER") {
    return (<Section title="Recepción de paquete"><div className="text-gray-600">Tu rol no tiene acceso a Recepción.</div></Section>);
  }

  return (
    <Section
      title="Recepción de paquete"
      right={<Button onClick={() => setShowMgr(s => !s)}>Gestionar listas</Button>}
    >
      {showMgr && (
        <div className="grid md:grid-cols-2 gap-4 my-4 p-4 bg-slate-50 rounded-lg">
          <ManageList label="Couriers" items={couriers} onAdd={setCouriers.add} onRemove={setCouriers.remove} />
          <ManageList label="Estados" items={estados} onAdd={setEstados.add} onRemove={setEstados.remove} />
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Carga" required>
          <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={flightId} onChange={e => setFlightId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {vuelosBodega.map(f => <option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
          </select>
        </Field>
        <Field label="Casilla" required>
          <Input value={form.casilla} onChange={e => setForm({ ...form, casilla: limpiar(e.target.value) })} />
        </Field>
        <Field label="Courier" required>
          <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={form.courier} onChange={e => setForm({ ...form, courier: e.target.value })}>
            <option value="">Seleccionar…</option>
            {courierOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {codigoCargaSel.startsWith("AIR-PYBOX") && (
            <div className="text-xs text-francia-600 mt-1">Esta carga solo admite courier ParaguayBox.</div>
          )}
        </Field>
        <Field label="Estado" required>
          <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
            <option value="">Seleccionar…</option>
            {estadosPermitidos.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Código de paquete" required>
          <Input value={form.codigo} disabled placeholder="Se genera al elegir Courier" />
        </Field>
        <Field label="Fecha" required>
          <Input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
        </Field>
        <Field label="CI/Pasaporte/RUC"><Input value={form.ci_ruc} onChange={e => setForm({ ...form, ci_ruc: e.target.value })} /></Field>
        <Field label="Empresa de envío" required><Input value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })} /></Field>
        <Field label="Nombre y apellido" required><Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></Field>
        <Field label="Tracking" required><Input value={form.tracking} onChange={e => setForm({ ...form, tracking: e.target.value })} /></Field>
        <Field label="Remitente" required><Input value={form.remitente} onChange={e => setForm({ ...form, remitente: e.target.value })} /></Field>
        <Field label="Peso real (kg)" required><Input value={form.peso_real_txt} onChange={e => setForm({ ...form, peso_real_txt: e.target.value })} placeholder="3,128" /></Field>
        <Field label="Largo (cm)" required><Input value={form.L_txt} onChange={e => setForm({ ...form, L_txt: e.target.value })} placeholder="50" /></Field>
        <Field label="Ancho (cm)" required><Input value={form.A_txt} onChange={e => setForm({ ...form, A_txt: e.target.value })} placeholder="30" /></Field>
        <Field label="Alto (cm)" required><Input value={form.H_txt} onChange={e => setForm({ ...form, H_txt: e.target.value })} placeholder="20" /></Field>
        <Field label="Descripción" required><Input value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} /></Field>
        <Field label="Precio (EUR)" required>
          <Input value={form.valor_txt} onChange={e => setForm({ ...form, valor_txt: e.target.value })} placeholder="10,00" />
        </Field>
        <div className="md:col-span-3">
          <Field label="Fotos del paquete">
            <div className="flex gap-2 items-center">
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
              <Button onClick={() => fileRef.current?.click()} disabled={isUploading}>Seleccionar archivo</Button>
              <Button onClick={() => setCamOpen(true)} disabled={isUploading}>Tomar foto</Button>
              <Button onClick={startMobileUploadSession} disabled={isUploading}>{Iconos.mobile} Usar cámara del móvil</Button>
              {isUploading && <span className="text-francia-600 text-sm font-semibold">Subiendo...</span>}
            </div>
          </Field>
          <div className="flex flex-wrap gap-2 mt-2">
            {form.fotos.map((url, index) => (
              <div key={index} className="relative">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`Foto ${index + 1}`} className="w-20 h-20 object-cover rounded-md" />
                </a>
                <button onClick={() => removePhoto(url)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs">X</button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <InfoBox title="Peso facturable (mín 0,200 kg)" value={`${fmtPeso(fact)} kg`} />
        <InfoBox title="Peso volumétrico (A×H×L / 5000)" value={`${fmtPeso(vol)} kg`} />
        <InfoBox title="Exceso de volumen" value={`${fmtPeso(exc)} kg`} />
      </div>
      <div className="flex justify-end mt-6">
        <Button variant="primary" onClick={submit} disabled={isUploading}>
          {isUploading ? "Subiendo foto..." : "Guardar paquete"}
        </Button>
      </div>
      <Modal open={camOpen} onClose={() => setCamOpen(false)} title="Tomar foto" maxWidth="max-w-2xl">
        <div className="space-y-3">
          <video ref={videoRef} playsInline className="w-full rounded-xl bg-black/50" />
          <div className="flex justify-end"> <Button variant="primary" onClick={tomarFoto}>Capturar</Button></div>
        </div>
      </Modal>
      {mobileUploadSessionId && (
        <QrCodeModal 
          open={!!mobileUploadSessionId} 
          onClose={() => setMobileUploadSessionId(null)}
          sessionId={mobileUploadSessionId}
        />
      )}
    </Section>
  );
}