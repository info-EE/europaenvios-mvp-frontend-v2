/* eslint-disable react/prop-types */
import React, { useMemo, useRef, useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

// Context
import { useModal } from "/src/context/ModalContext.jsx"; // Corrected path

// Componentes
import { Section } from "/src/components/common/Section.jsx"; // Corrected path
import { Input } from "/src/components/common/Input.jsx"; // Corrected path
import { Field } from "/src/components/common/Field.jsx"; // Corrected path
import { Modal } from "/src/components/common/Modal.jsx"; // Corrected path
import { EmptyState } from "/src/components/common/EmptyState.jsx"; // Corrected path
import { Button } from "/src/components/common/Button.jsx"; // Corrected path
import { QrCodeModal } from "/src/components/common/QrCodeModal.jsx"; // Corrected path
import { CameraModal } from "/src/components/common/CameraModal.jsx"; // Corrected path
import { ImageViewerModal } from "/src/components/common/ImageViewerModal.jsx"; // Corrected path

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
  estadosPermitidosPorCarga,
  getColumnWidths
} from "/src/utils/helpers.jsx"; // Corrected path
import { getDownloadURL, ref, uploadString } from "firebase/storage";
import { db, storage } from "/src/firebase.js"; // Corrected path

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

export function PaquetesBodega({ packages, flights, user, onUpdate, onDelete, onPendiente, couriers, empresasEnvio }) {
  const [q, setQ] = useState("");
  const [flightId, setFlightId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setTo] = useState("");
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });
  const isCourier = user.role === "COURIER";
  const [editingCiRucPackage, setEditingCiRucPackage] = useState(null);
  const [isSavingCiRuc, setIsSavingCiRuc] = useState(false);


  const { showAlert, showConfirmation } = useModal();

  const toggleSort = (key) => {
    setSort(s => s.key === key ? { key, dir: (s.dir === "asc" ? "desc" : "asc") } : { key, dir: "asc" });
  };

  const pref = user.role === "COURIER" ? limpiar(user.courier) : null;

  const courierFlights = useMemo(() => {
    const flightsInBodega = flights.filter(f => f.estado === 'En bodega');

    if (!isCourier) {
      return flightsInBodega;
    }

    const courierFlightIds = new Set(
      packages
        .filter(p => p.courier === user.courier && p.flight_id)
        .map(p => p.flight_id)
    );

    return flightsInBodega.filter(f => courierFlightIds.has(f.id));
  }, [flights, packages, user, isCourier]);

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
      case "createdAt": return p.createdAt || p.fecha || "";
      case "fecha": return p.fecha || "";
      case "nombre": return (p.nombre_apellido||"").toLowerCase();
      case "tracking": return (p.tracking||"").toLowerCase();
      case "peso_real": return Number(p.peso_real||0);
      case "medidas": return Number((p.largo||0)*(p.ancho||0)*(p.alto||0));
      case "peso_volumetrico": return Number(p.peso_volumetrico||0); // Added for sorting
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
  const fileRef = useRef(null);
  const [viewerImages, setViewerImages] = useState([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

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

  const startEditCiRuc = (p) => {
    setEditingCiRucPackage({ ...p });
  };

  const saveCiRuc = async () => {
    if (!editingCiRucPackage || isSavingCiRuc) return;
    setIsSavingCiRuc(true);
    try {
        await onUpdate({
            id: editingCiRucPackage.id,
            ci_ruc: editingCiRucPackage.ci_ruc || ""
        });
    } catch (error) {
        console.error("Error al guardar CI/RUC:", error);
        showAlert("Error", "No se pudo guardar el CI/RUC.");
    } finally {
        setIsSavingCiRuc(false);
        setEditingCiRucPackage(null);
    }
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

  const onFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => handleImageUpload(r.result);
    r.readAsDataURL(file);
  };

  async function exportXLSX() {
    const header = [
        th("Carga"), th("Courier"), th("Estado"), th("Casilla"), th("Código de paquete"), th("Fecha"),
        th("CI/RUC"), th("Empresa de envío"), th("Nombre y apellido"), th("Tracking"), th("Remitente"),
        th("Peso real"), th("Peso facturable"), th("Medidas"), th("Peso volumétrico"), // Added header
        th("Exceso de volumen"),
        th("Descripción"), th("Precio (EUR)")
    ];
    const body = rows.map(p => {
        const carga = flights.find(f => f.id === p.flight_id)?.codigo || "";
        const medidas = `${p.largo}x${p.ancho}x${p.alto} cm`;
        return [
            td(carga), td(p.courier), td(p.estado), td(p.casilla), td(p.codigo), td(p.fecha),
            td(p.ci_ruc), td(p.empresa_envio), td(p.nombre_apellido), td(p.tracking), td(p.remitente),
            tdNum(p.peso_real, "0.000"), tdNum(p.peso_facturable, "0.000"),
            td(medidas), tdNum(p.peso_volumetrico, "0.000"), // Added data cell
            tdNum(p.exceso_volumen, "0.000"),
            td(p.descripcion), tdNum(p.valor_aerolinea, "0.00")
        ];
    });

    const columnWidths = getColumnWidths(header, body);

    const { ws } = sheetFromAOAStyled("Bodega", [header, ...body], {
        cols: columnWidths,
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
              {courierFlights.map(f=><option key={f.id} value={f.id}>{f.codigo}</option>)}
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
                <SortableHeader col="createdAt" sort={sort} toggleSort={toggleSort}>Fecha</SortableHeader>
                <SortableHeader col="nombre" sort={sort} toggleSort={toggleSort}>Nombre</SortableHeader>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">CI/RUC</th>
                <SortableHeader col="tracking" sort={sort} toggleSort={toggleSort}>Tracking</SortableHeader>
                <SortableHeader col="peso_real" sort={sort} toggleSort={toggleSort}>Peso real</SortableHeader>
                <SortableHeader col="medidas" sort={sort} toggleSort={toggleSort}>Medidas</SortableHeader>
                <SortableHeader col="peso_volumetrico" sort={sort} toggleSort={toggleSort}>P. Volum.</SortableHeader> {/* Added Header */}
                <SortableHeader col="exceso" sort={sort} toggleSort={toggleSort}>Exceso</SortableHeader>
                <SortableHeader col="descripcion" sort={sort} toggleSort={toggleSort}>Descripción</SortableHeader>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Fotos</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Acciones</th>
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
                  <td className="px-3 py-2 whitespace-nowrap font-mono">
                    {p.ci_ruc ? (
                        <span className="flex items-center gap-1 text-slate-700">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-500 flex-shrink-0"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.06 0l4-5.5z" clipRule="evenodd" /></svg>
                            {p.ci_ruc}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-amber-600 font-semibold text-xs">
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                            Pendiente
                        </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono">{p.tracking}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(p.peso_real)} kg</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.largo}x{p.ancho}x{p.alto} cm</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(p.peso_volumetrico)} kg</td> {/* Added Cell */}
                  <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(p.exceso_volumen)} kg</td>
                  <td className="px-3 py-2">{p.descripcion}</td>
                  <td className="px-3 py-2">
                    {(p.fotos && p.fotos.length > 0) ?
                        <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setViewerImages(p.fotos)}>Ver foto</Button>
                        : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {isCourier ? (
                        p.ci_ruc ? (
                            <Button variant="icon" onClick={() => startEditCiRuc(p)} title="Editar CI/RUC">
                                {Iconos.edit}
                            </Button>
                        ) : (
                            <Button onClick={() => startEditCiRuc(p)} className="!px-2 !py-1 text-xs whitespace-nowrap rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors">
                                Añadir CI/RUC
                            </Button>
                        )
                    ) : ( // Es Admin
                        <div className="flex gap-2">
                            <Button variant="icon" onClick={() => startEdit(p)} title="Editar">{Iconos.edit}</Button>
                            <Button variant="iconDanger" onClick={() => requestDelete(p)} title="Eliminar">{Iconos.delete}</Button>
                        </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={15}><EmptyState icon={Iconos.box} title="No hay paquetes en bodega" message="Utiliza el filtro para buscar o agrega paquetes en Recepción."/></td></tr>} {/* Updated colspan */}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {(() => {
          const aggReal = {};
          const aggExc = {};
          rows.forEach(p => {
            aggReal[p.courier] = (aggReal[p.courier] || 0) + p.peso_real;
            aggExc[p.courier] = (aggExc[p.courier] || 0) + p.exceso_volumen;
          });

          const dataReal = Object.entries(aggReal)
            .filter(([, kg]) => kg > 0)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

          const dataExc = Object.entries(aggExc)
            .filter(([, kg]) => kg > 0)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

          const totalReal = sum(dataReal.map(d => d.value));
          const totalExc = sum(dataExc.map(d => d.value));

          const charts = [
            { data: dataReal, key: "value", title: "Kg reales por courier", total: totalReal },
            { data: dataExc, key: "value", title: "Exceso volumétrico por courier", total: totalExc }
          ];

          return (
            <>
              {charts.map((chart, ix) => (
                <div key={chart.key} className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col">
                  <h3 className="font-semibold text-slate-700 mb-4">{chart.title}</h3>
                  <div className="flex-grow flex items-center">
                    {chart.data.length > 0 ? (
                      <>
                        <ResponsiveContainer width="50%" height={300}>
                          <PieChart>
                            <Pie data={chart.data} dataKey={chart.key} nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100}>
                              {chart.data.map((_, i) => (
                                <Cell key={`cell-${i}`} fill={COLORS[(i + (ix * 3)) % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v) => `${fmtPeso(v)} kg`} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="w-1/2 text-sm pl-4">
                          <ul className="space-y-1">
                            {chart.data.map((entry, index) => (
                              <li key={`item-${index}`} className="flex justify-between items-center py-1 border-b border-slate-100">
                                <span className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[(index + (ix * 3)) % COLORS.length] }} />
                                  {entry.name}
                                </span>
                                <span className="font-semibold">{fmtPeso(entry.value)} kg</span>
                              </li>
                            ))}
                            <li className="flex justify-between items-center py-2 font-bold mt-2 border-t-2 border-slate-300">
                              <span>TOTAL</span>
                              <span>{fmtPeso(chart.total)} kg</span>
                            </li>
                          </ul>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full w-full text-slate-500">
                        No hay datos para mostrar.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          );
        })()}
      </div>


      <Modal open={open} onClose={() => setOpen(false)} title="Editar paquete" maxWidth="max-w-4xl">
        {form && (
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Carga">
              <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={form.flight_id} onChange={e=>setForm({...form,flight_id:e.target.value})} >
                <option value="">—</option>
                {flights
                  .filter(f => f.estado === 'En bodega' || f.id === form.flight_id)
                  .map(f => <option key={f.id} value={f.id}>{f.codigo}</option>)
                }
              </select>
            </Field>
            <Field label="Courier">
                <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={form.courier} onChange={e=>setForm({...form,courier:e.target.value})} >
                    <option value="">Seleccionar...</option>
                    {couriers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
            </Field>
            <Field label="Estado">
              {(() => {
                const codigo = flights.find(f=>f.id===form.flight_id)?.codigo || "";
                const opts = estadosPermitidosPorCarga(codigo, ESTADOS_INICIALES);
                return (
                  <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})} >
                    {opts.map(s=><option key={s}>{s}</option>)}
                  </select>
                );
              })()}
            </Field>
            <Field label="Casilla"><Input value={form.casilla} onChange={e=>setForm({...form,casilla:e.target.value})} /></Field>
            <Field label="Código de paquete"><Input value={form.codigo} onChange={e=>setForm({...form,codigo:limpiar(e.target.value)})} disabled={true}/></Field>
            <Field label="Fecha"><Input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} /></Field>
            <Field label="CI/Pasaporte/RUC"><Input value={form.ci_ruc || ""} onChange={e=>setForm({...form,ci_ruc:e.target.value})} /></Field>
            <Field label="Empresa de envío">
                <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={form.empresa_envio || ""} onChange={e=>setForm({...form,empresa_envio:e.target.value})} >
                    <option value="">Seleccionar...</option>
                    {[...empresasEnvio].sort((a, b) => a.name.localeCompare(b.name)).map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                </select>
            </Field>
            <Field label="Nombre y apellido"><Input value={form.nombre_apellido} onChange={e=>setForm({...form,nombre_apellido:e.target.value})} /></Field>
            <Field label="Tracking"><Input value={form.tracking} onChange={e=>setForm({...form,tracking:e.target.value})} /></Field>
            <Field label="Remitente"><Input value={form.remitente||""} onChange={e=>setForm({...form,remitente:e.target.value})} /></Field>
            <Field label="Peso real (kg)"><Input value={form.peso_real_txt} onChange={e=>setForm({...form,peso_real_txt:e.target.value.replace('.', ',')})} /></Field>
            <Field label="Largo (cm)"><Input value={form.L_txt} onChange={e=>setForm({...form,L_txt:e.target.value})} /></Field>
            <Field label="Ancho (cm)"><Input value={form.A_txt} onChange={e=>setForm({...form,A_txt:e.target.value})} /></Field>
            <Field label="Alto (cm)"><Input value={form.H_txt} onChange={e=>setForm({...form,H_txt:e.target.value})} /></Field>
            <Field label="Descripción"><Input value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} /></Field>
            <Field label="Precio (EUR)"><Input value={form.valor_txt} onChange={e=>setForm({...form,valor_txt:e.target.value.replace('.', ',')})} /></Field>
            <div className="md:col-span-3">
              <Field label="Fotos del paquete">
                  <div className="flex gap-2 items-center flex-wrap">
                      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden"/>
                      <Button onClick={()=>fileRef.current?.click()} disabled={isUploading}>Seleccionar archivo</Button>
                      <Button onClick={()=>setIsCameraOpen(true)} disabled={isUploading}>Tomar foto</Button>
                      <Button onClick={startMobileUploadSession} disabled={isUploading}>Usar cámara del móvil</Button>
                      {isUploading && <span className="text-francia-600 text-sm font-semibold">Subiendo...</span>}
                  </div>
              </Field>
              <div className="flex flex-wrap gap-2 mt-2">
                  {form.fotos.map((url, index) => (
                      <div key={index} className="relative group">
                          <img src={url} alt={`Foto ${index+1}`} className="w-20 h-20 object-cover rounded-md cursor-pointer" onClick={() => setViewerImages([url])}/>
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity" onClick={() => setViewerImages([url])}>
                            <span className="text-white text-xs">Ver</span>
                          </div>
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

      <CameraModal open={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handleImageUpload} />

      <ImageViewerModal open={viewerImages.length > 0} onClose={() => setViewerImages([])} images={viewerImages} />

      <QrCodeModal open={!!uploadSessionId} onClose={() => setUploadSessionId(null)} sessionId={uploadSessionId} />

      <Modal open={!!editingCiRucPackage} onClose={() => setEditingCiRucPackage(null)} title="Gestionar CI/RUC del Cliente">
        {editingCiRucPackage && (
            <div className="space-y-4">
                <p className="text-sm text-slate-600">
                    Editando CI/RUC para el paquete <span className="font-bold">{editingCiRucPackage.codigo}</span> del cliente <span className="font-bold">{editingCiRucPackage.nombre_apellido}</span>.
                </p>
                <Field label="CI/Pasaporte/RUC" required>
                    <Input
                        value={editingCiRucPackage.ci_ruc || ""}
                        onChange={e => setEditingCiRucPackage({ ...editingCiRucPackage, ci_ruc: e.target.value })}
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && saveCiRuc()}
                    />
                </Field>
                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="secondary" onClick={() => setEditingCiRucPackage(null)}>Cancelar</Button>
                    <Button variant="primary" onClick={saveCiRuc} disabled={isSavingCiRuc}>
                        {isSavingCiRuc ? "Guardando..." : "Guardar"}
                    </Button>
                </div>
            </div>
        )}
    </Modal>

    </Section>
  );
}