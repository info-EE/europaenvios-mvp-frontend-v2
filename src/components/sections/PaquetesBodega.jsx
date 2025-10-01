/* eslint-disable react/prop-types */
import React, { useMemo, useRef, useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

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

// Helpers & Constantes
import {
  Iconos,
  fmtPeso,
  fmtMoney,
  limpiar,
  parseComma,
  parseIntEU,
  labelHTML,
  printHTMLInIframe,
  uuid,
  sum,
  COLORS,
  MIN_FACTURABLE,
  ESTADOS_INICIALES,
  sheetFromAOAStyled,
  downloadXLSX,
  th,
  td,
  tdNum,
  tdInt,
  estadosPermitidosPorCarga
} from "../../utils/helpers.jsx";
import { getDownloadURL, ref, uploadString } from "firebase/storage";
import { db, storage } from "../../firebase.js";

const CustomPieLegend = ({ payload }) => (
    <div className="w-1/3 text-xs overflow-y-auto" style={{maxHeight: '16rem'}}>
      <ul className="space-y-1">
        {payload.map((entry, index) => (
          <li key={`item-${index}`} className="flex items-center">
            <div className="w-3 h-3 mr-2 rounded-sm" style={{ backgroundColor: entry.color }} />
            <span>{entry.value}: <span className="font-semibold">{fmtPeso(entry.payload.value)} kg</span></span>
          </li>
        ))}
      </ul>
    </div>
);

const SortableHeader = ({ children, col, sort, toggleSort }) => {
    const isSorted = sort.key === col;
    const arrow = isSorted ? (sort.dir === "asc" ? "▲" : "▼") : <span className="text-slate-400">↕</span>;
    return (
        <th className="text-left px-3 py-2 font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort(col)}>
            {children}
            <span className="ml-1">{arrow}</span>
        </th>
    );
};

export function PaquetesBodega({ packages, flights, user, onUpdate, onDelete, onPendiente }) {
  const [q, setQ] = useState("");
  const [flightId, setFlightId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setTo] = useState("");
  const [sort, setSort] = useState({ key: 'fecha', dir: 'desc' });

  const { showAlert, showConfirmation } = useModal();

  const toggleSort = (key) => {
    setSort(s => s.key === key ? { key, dir: (s.dir === "asc" ? "desc" : "asc") } : { key, dir: "asc" });
  };
  
  const pref = user.role === "COURIER" ? limpiar(user.courier) : null;

  const baseRows = useMemo(() => {
    return packages
      .filter(p => {
        const flight = flights.find(f => f.id === p.flight_id);
        if (!flight) return false;
        return flight.estado === "En bodega";
      })
      .filter(p => !flightId || p.flight_id === flightId)
      .filter(p => !dateFrom || (p.fecha || "") >= dateFrom)
      .filter(p => !dateTo || (p.fecha || "") <= dateTo)
      .filter(p => (p.codigo + p.casilla + p.tracking + p.nombre_apellido + p.courier).toLowerCase().includes(q.toLowerCase()))
      .filter(p => user.role !== "COURIER" || (p.courier === user.courier && String(p.codigo || "").toUpperCase().startsWith(pref)));
  }, [packages, flights, flightId, dateFrom, dateTo, q, user, pref]);

  const getSortVal = (p, key) => {
    switch(key){
      case "carga": return (flights.find(f=>f.id===p.flight_id)?.codigo || "").toLowerCase();
      case "codigo": return (p.codigo||"").toLowerCase();
      case "casilla": return (p.casilla||"").toLowerCase();
      case "fecha": return p.fecha || "";
      case "nombre": return (p.nombre_apellido||"").toLowerCase();
      case "tracking": return (p.tracking||"").toLowerCase();
      case "peso_real": return Number(p.peso_real||0);
      case "medidas": return Number((p.largo||0)*(p.ancho||0)*(p.alto||0));
      case "exceso": return Number(p.exceso_volumen||0);
      case "descripcion": return (p.descripcion||"").toLowerCase();
      default: return 0;
    }
  };

  const rows = useMemo(() => {
    const arr = [...baseRows];
    if (sort.key) {
      arr.sort((a, b) => {
        const va = getSortVal(a, sort.key);
        const vb = getSortVal(b, sort.key);
        if (va < vb) return sort.dir === "asc" ? -1 : 1;
        if (va > vb) return sort.dir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return arr;
  }, [baseRows, sort]);

  const printPkgLabel = (p) => {
    const medidas = `${p.largo || 0}x${p.ancho || 0}x${p.alto || 0} cm`;
    const html = labelHTML({
      codigo: p.codigo, nombre: p.nombre_apellido, casilla: p.casilla,
      pesoKg: p.peso_real, medidasTxt: medidas, desc: p.descripcion,
      cargaTxt: flights.find(f => f.id === p.flight_id)?.codigo || "-",
      fecha: p.fecha,
      courier: p.courier
    });
    printHTMLInIframe(html);
  };

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [viewer, setViewer] = useState(null);
  
  const [uploadSessionId, setUploadSessionId] = useState(null);

  useEffect(() => {
    if (!uploadSessionId) return;

    const sessionRef = doc(db, "mobileUploadSessions", uploadSessionId);
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.photoUrls && data.photoUrls.length > 0) {
                setForm(f => ({
                    ...f,
                    fotos: [...new Set([...f.fotos, ...data.photoUrls])]
                }));
            }
        }
    });
    return () => unsubscribe();
  }, [uploadSessionId]);

  const startEdit = (p) => {
    setForm({
      ...p,
      fotos: p.fotos || [],
      peso_real_txt: fmtPeso(p.peso_real),
      L_txt: String(p.largo || 0),
      A_txt: String(p.ancho || 0),
      H_txt: String(p.alto || 0),
      valor_txt: fmtMoney(p.valor_aerolinea)
    });
    setOpen(true);
  };

  const saveEdit = () => {
    if (!form) return;
    const originalPackage = packages.find(p => p.id === form.id);
    if (originalPackage && originalPackage.flight_id !== form.flight_id) {
        const oldFlight = flights.find(f => f.id === originalPackage.flight_id);
        const newFlight = flights.find(f => f.id === form.flight_id);
        const tarea = {
            type: "CAMBIO_CARGA", status: "No realizada", fecha: new Date().toISOString().slice(0, 10),
            data: {
                codigo: form.codigo,
                oldFlight: oldFlight?.codigo || 'N/A',
                newFlight: newFlight?.codigo || 'N/A',
                foto: form.fotos?.[0] || null,
            }
        };
        onPendiente(tarea);
    }

    const peso = parseComma(form.peso_real_txt);
    const L = parseIntEU(form.L_txt), A = parseIntEU(form.A_txt), H = parseIntEU(form.H_txt);
    const fact = Math.max(MIN_FACTURABLE, peso || 0);
    const vol = A && H && L ? (A * H * L) / 5000 : 0;
    const exc = Math.max(0, vol - fact);
    const upd = {
      ...form,
      peso_real: peso, largo: L, ancho: A, alto: H,
      peso_facturable: Number(fact.toFixed(3)),
      peso_volumetrico: Number(vol.toFixed(3)),
      exceso_volumen: Number(exc.toFixed(3)),
      valor_aerolinea: parseComma(form.valor_txt),
    };
    onUpdate(upd);
    setOpen(false);
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
    if (!imageDataUrl || !form) return;
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

  async function exportXLSX(){
    const header = [
        th("Carga"), th("Courier"), th("Estado"), th("Casilla"), th("Código de paquete"), th("Fecha"),
        th("CI/RUC"), th("Empresa de envío"), th("Nombre y apellido"), th("Tracking"), th("Remitente"),
        th("Peso real"), th("Peso facturable"), th("Medidas"), th("Exceso de volumen"),
        th("Descripción"), th("Precio (EUR)")
    ];
    const body = rows.map(p => {
        const carga = flights.find(f => f.id === p.flight_id)?.codigo || "";
        const medidas = `${p.largo}x${p.ancho}x${p.alto} cm`;
        return [
            td(carga), td(p.courier), td(p.estado), td(p.casilla), td(p.codigo), td(p.fecha),
            td(p.ci_ruc), td(p.empresa_envio), td(p.nombre_apellido), td(p.tracking), td(p.remitente),
            tdNum(p.peso_real, "0.000"), tdNum(p.peso_facturable, "0.000"),
            td(medidas), tdNum(p.exceso_volumen, "0.000"),
            td(p.descripcion), tdNum(p.valor_aerolinea, "0.00")
        ];
    });
    const { ws } = sheetFromAOAStyled("Bodega", [header, ...body], {
        cols: [
            {wch:12},{wch:14},{wch:12},{wch:10},{wch:18},{wch:12},{wch:15},
            {wch:20},{wch:22},{wch:18},{wch:18},{wch:12},{wch:14},
            {wch:14},{wch:14},{wch:28},{wch:12}
        ],
        rows: [{ hpt: 24 }]
    });
    downloadXLSX("Paquetes_en_bodega.xlsx", [{ name: "Bodega", ws }]);
  }

  const requestDelete = async (p) => {
    const confirmed = await showConfirmation(
        "Confirmar eliminación",
        `¿Eliminar el paquete ${p.codigo}? Esta acción no se puede deshacer.`
    );
    if (confirmed) {
      onDelete(p.id);
    }
  };
  
  return (
    <Section title="Paquetes en bodega">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 items-end">
          <Field label="Carga en Bodega">
            <select className="text-sm rounded-lg border-slate-300 px-3 py-2 w-full" value={flightId} onChange={e=>setFlightId(e.target.value)}>
              <option value="">Todas</option>
              {flights.filter(f => f.estado === 'En bodega').map(f=><option key={f.id} value={f.id}>{f.codigo}</option>)}
            </select>
          </Field>
          <Field label="Desde"> <Input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} /> </Field>
          <Field label="Hasta"> <Input type="date" value={dateTo} onChange={e=>setTo(e.target.value)} /> </Field>
          <div className="sm:col-span-2 lg:col-span-3">
             <Field label="Buscar">
                <Input placeholder="Buscar por código, casilla, tracking, nombre..." value={q} onChange={e=>setQ(e.target.value)}/>
            </Field>
          </div>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <Button onClick={exportXLSX}>Exportar XLSX</Button>
          </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
                <SortableHeader col="carga" sort={sort} toggleSort={toggleSort}>Carga</SortableHeader>
                <SortableHeader col="codigo" sort={sort} toggleSort={toggleSort}>Código</SortableHeader>
                <SortableHeader col="casilla" sort={sort} toggleSort={toggleSort}>Casilla</SortableHeader>
                <SortableHeader col="fecha" sort={sort} toggleSort={toggleSort}>Fecha</SortableHeader>
                <SortableHeader col="nombre" sort={sort} toggleSort={toggleSort}>Nombre</SortableHeader>
                <SortableHeader col="tracking" sort={sort} toggleSort={toggleSort}>Tracking</SortableHeader>
                <SortableHeader col="peso_real" sort={sort} toggleSort={toggleSort}>Peso real</SortableHeader>
                <SortableHeader col="medidas" sort={sort} toggleSort={toggleSort}>Medidas</SortableHeader>
                <SortableHeader col="exceso" sort={sort} toggleSort={toggleSort}>Exceso</SortableHeader>
                <SortableHeader col="descripcion" sort={sort} toggleSort={toggleSort}>Descripción</SortableHeader>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Fotos</th>
                {user.role === 'ADMIN' && <th className="text-left px-3 py-2 font-semibold text-slate-600">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map(p => {
              const carga = flights.find(f => f.id === p.flight_id)?.codigo || "";
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap">{carga}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{p.codigo}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.casilla}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.fecha}</td>
                  <td className="px-3 py-2">{p.nombre_apellido}</td>
                  <td className="px-3 py-2 font-mono">{p.tracking}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(p.peso_real)} kg</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.largo}x{p.ancho}x{p.alto} cm</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(p.exceso_volumen)} kg</td>
                  <td className="px-3 py-2">{p.descripcion}</td>
                  <td className="px-3 py-2">
                    {(p.fotos && p.fotos.length > 0) ? 
                        <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setViewer(p.fotos)}>Ver foto</Button>
                        : "—"}
                  </td>
                  {user.role === 'ADMIN' &&
                    <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <Button variant="icon" onClick={() => startEdit(p)}>{Iconos.edit}</Button>
                          <Button variant="iconDanger" onClick={() => requestDelete(p)}>{Iconos.delete}</Button>
                        </div>
                    </td>
                  }
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={12}><EmptyState icon={Iconos.box} title="No hay paquetes en bodega" message="Utiliza el filtro para buscar o agrega paquetes en Recepción."/></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {(() => {
          const aggReal = {}; const aggExc = {};
          rows.forEach(p=>{ aggReal[p.courier]=(aggReal[p.courier]||0)+p.peso_real; aggExc[p.courier]=(aggExc[p.courier]||0)+p.exceso_volumen; });
          const dataReal = Object.entries(aggReal).filter(([, kg]) => kg > 0).map(([courier,kg_real])=>({courier,kg_real, name: courier}));
          const dataExc  = Object.entries(aggExc).filter(([, kg]) => kg > 0).map(([courier,kg_exceso])=>({courier,kg_exceso, name: courier}));
          const totalReal = sum(dataReal.map(d=>d.kg_real));
          const totalExc = sum(dataExc.map(d=>d.kg_exceso));
          return (
            <>
              {[{data:dataReal,key:"kg_real",title:`Kg reales por courier. Total: `,total:totalReal},
                {data:dataExc,key:"kg_exceso",title:`Exceso volumétrico por courier. Total: `,total:totalExc}].map((g,ix)=>(
                <div key={g.key} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <div className="text-sm font-semibold text-slate-700 mb-2">{g.title}<b>{fmtPeso(g.total)} kg</b></div>
                  <div className="h-64 flex">
                    <ResponsiveContainer width="66%" height="100%">
                      <PieChart>
                        <Pie data={g.data} dataKey={g.key} nameKey="name" outerRadius="80%" cx="50%" cy="50%">
                          {g.data.map((_,i)=><Cell key={i} fill={COLORS[(i+(ix?3:0))%COLORS.length]}/>)}
                        </Pie>
                        <Tooltip formatter={(v)=>`${fmtPeso(v)} kg`}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <CustomPieLegend payload={g.data.map((entry, i) => ({
                        value: entry.name,
                        color: COLORS[(i+(ix?3:0))%COLORS.length],
                        payload: { value: entry[g.key] }
                    }))} />
                  </div>
                </div>
              ))}
            </>
          );
        })()}
      </div>

      <Modal open={open} onClose={() => {}} title="Editar paquete" maxWidth="max-w-4xl">
        {form && (
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Carga">
              <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={form.flight_id} onChange={e=>setForm({...form,flight_id:e.target.value})} disabled={user.role==="COURIER"}>
                <option value="">—</option>
                {flights
                  .filter(f => f.estado === 'En bodega' || f.id === form.flight_id)
                  .map(f => <option key={f.id} value={f.id}>{f.codigo}</option>)
                }
              </select>
            </Field>
            <Field label="Courier"><Input value={form.courier} onChange={e=>setForm({...form,courier:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Estado">
              {(() => {
                const codigo = flights.find(f=>f.id===form.flight_id)?.codigo || "";
                const opts = estadosPermitidosPorCarga(codigo, ESTADOS_INICIALES);
                return (
                  <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})} disabled={user.role==="COURIER"}>
                    {opts.map(s=><option key={s}>{s}</option>)}
                  </select>
                );
              })()}
            </Field>
            <Field label="Casilla"><Input value={form.casilla} onChange={e=>setForm({...form,casilla:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Código de paquete"><Input value={form.codigo} onChange={e=>setForm({...form,codigo:limpiar(e.target.value)})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Fecha"><Input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="CI/Pasaporte/RUC"><Input value={form.ci_ruc || ""} onChange={e=>setForm({...form,ci_ruc:e.target.value})} /></Field>
            <Field label="Empresa de envío"><Input value={form.empresa_envio||""} onChange={e=>setForm({...form,empresa_envio:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Nombre y apellido"><Input value={form.nombre_apellido} onChange={e=>setForm({...form,nombre_apellido:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Tracking"><Input value={form.tracking} onChange={e=>setForm({...form,tracking:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Remitente"><Input value={form.remitente||""} onChange={e=>setForm({...form,remitente:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Peso real (kg)"><Input value={form.peso_real_txt} onChange={e=>setForm({...form,peso_real_txt:e.target.value})} /></Field>
            <Field label="Largo (cm)"><Input value={form.L_txt} onChange={e=>setForm({...form,L_txt:e.target.value})} /></Field>
            <Field label="Ancho (cm)"><Input value={form.A_txt} onChange={e=>setForm({...form,A_txt:e.target.value})} /></Field>
            <Field label="Alto (cm)"><Input value={form.H_txt} onChange={e=>setForm({...form,H_txt:e.target.value})} /></Field>
            <Field label="Descripción"><Input value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} /></Field>
            <Field label="Precio (EUR)"><Input value={form.valor_txt} onChange={e=>setForm({...form,valor_txt:e.target.value})} /></Field>
            <div className="md:col-span-3">
              <Field label="Fotos del paquete">
                  <div className="flex gap-2 items-center flex-wrap">
                      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden"/>
                      <Button onClick={()=>fileRef.current?.click()} disabled={isUploading}>Seleccionar archivo</Button>
                      <Button onClick={()=>setCamOpen(true)} disabled={isUploading}>Tomar foto</Button>
                      <Button onClick={startMobileUploadSession} disabled={isUploading}>Usar cámara del móvil</Button>
                      {isUploading && <span className="text-francia-600 text-sm font-semibold">Subiendo...</span>}
                  </div>
              </Field>
              <div className="flex flex-wrap gap-2 mt-2">
                  {form.fotos.map((url, index) => (
                      <div key={index} className="relative">
                          <a href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt={`Foto ${index+1}`} className="w-20 h-20 object-cover rounded-md"/>
                          </a>
                          <button onClick={() => removePhoto(url)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs">X</button>
                      </div>
                  ))}
              </div>
            </div>
            <div className="md:col-span-3 flex items-center justify-between mt-4">
              <Button onClick={() => printPkgLabel(form)}>Reimprimir etiqueta</Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button variant="primary" onClick={saveEdit} disabled={isUploading}>{isUploading ? 'Subiendo...' : 'Guardar'}</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={camOpen} onClose={() => setCamOpen(false)} title="Tomar foto">
        <div className="space-y-3">
          <video ref={videoRef} playsInline className="w-full rounded-xl bg-black/50" />
          <div className="flex justify-end"> <Button variant="primary" onClick={tomarFoto}>Capturar</Button></div>
        </div>
      </Modal>

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

      <QrCodeModal open={!!uploadSessionId} onClose={() => setUploadSessionId(null)} sessionId={uploadSessionId} />

    </Section>
  );
}