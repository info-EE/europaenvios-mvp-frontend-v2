/*  Europa Envíos – MVP 0.2.0
    Cambios:
    - Código de paquete = sufijo (ej. BOSSBOX1). Guardamos también codigo_full = CARGA-SUFIX.
    - Medidas en cm: ENTEROS (sin coma).
    - Recepción: tomar foto con cámara + adjuntar archivo. Etiqueta Zebra 100x60mm con Nombre y Casilla.
    - Paquetes en bodega: filtro por carga (En bodega), columnas según pedido, editor en modal, gráficos 3 dec y totales en negrita.
    - Armado de cajas: título muestra peso y medidas; XLSX con formato mejorado.
    - Cargas enviadas: XLSX con formato mejorado.
    - Gestión de cargas: filtro de fechas.
    - Proformas: filtro de fechas, línea por cada extra, tabla con columnas pedidas; XLSX formateado.
    - Extras: filtro de fechas, editar y cambiar estado.
*/
import React, { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import * as XLSX from "xlsx-js-style";
import JsBarcode from "jsbarcode";

/* ===== UUID seguro ===== */
const uuid = () => {
  try {
    if (typeof window !== "undefined" && window.crypto?.randomUUID) return window.crypto.randomUUID();
  } catch {}
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

/* ===== ErrorBoundary + Global catcher ===== */
class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state={error:null}; }
  static getDerivedStateFromError(e){ return {error:e}; }
  componentDidCatch(e, info){ console.error(e, info); }
  render(){
    if (this.state.error) return (
      <div style={{padding:24,fontFamily:"sans-serif"}}>
        <h2>Se produjo un error</h2>
        <pre style={{whiteSpace:"pre-wrap"}}>{String(this.state.error)}</pre>
      </div>
    );
    return this.props.children;
  }
}
function GlobalErrorCatcher({children}){
  const [fatal,setFatal]=useState(null);
  useEffect(()=>{
    const onErr = (msg,src,l,c,err)=>{ setFatal(err||new Error(String(msg))); return false; };
    const onRej = (e)=> setFatal(e?.reason||new Error("Unhandled rejection"));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return ()=>{ window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  },[]);
  if (fatal) return (
    <div style={{padding:24,fontFamily:"sans-serif"}}>
      <h2>Error global</h2>
      <pre style={{whiteSpace:"pre-wrap"}}>{fatal?.stack||String(fatal)}</pre>
    </div>
  );
  return children;
}

/* ===== Utils formato ES ===== */
const parseComma = (txt) => { // número con coma
  if (txt === null || txt === undefined) return 0;
  const s = String(txt).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
const parseIntEU = (txt) => { // enteros cm
  const s = String(txt ?? "").replace(/[^\d-]/g, "");
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
};
const fmtPeso = (n) => Number(n||0).toFixed(3).replace(".", ",");
const fmtMoney = (n) => Number(n||0).toFixed(2).replace(".", ",");
const COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#3B82F6","#8B5CF6","#14B8A6","#84CC16","#F97316"];
const sum = (a) => a.reduce((s,x)=>s+Number(x||0),0);

/* ===== XLSX helpers con estilo ===== */
const th = (txt) => ({ v:txt, t:"s", s:{
  font:{bold:true,color:{rgb:"FFFFFFFF"}}, fill:{fgColor:{rgb:"FF1F2937"}},
  alignment:{horizontal:"center", vertical:"center"}, border:bd()
}});
const td = (v) => ({ v, t:"s", s:{ border:bd(), alignment:{vertical:"center"} } });
const bd = () => ({ top:{style:"thin",color:{rgb:"FF9CA3AF"}},
  bottom:{style:"thin",color:{rgb:"FF9CA3AF"}},
  left:{style:"thin",color:{rgb:"FF9CA3AF"}}, right:{style:"thin",color:{rgb:"FF9CA3AF"}} });
function sheetFromAOAStyled(name, rows, opts={}){
  const ws = XLSX.utils.aoa_to_sheet(rows.map(r=>r.map(c => (typeof c==="object"&&c.v!==undefined)?c:td(String(c??"")) )));
  if (opts.cols) ws["!cols"]=opts.cols;
  if (opts.rows) ws["!rows"]=opts.rows;
  if (opts.merges) ws["!merges"]=opts.merges;
  return { name, ws };
}
function downloadXLSX(filename, sheets){
  const wb = XLSX.utils.book_new();
  sheets.forEach(({name,ws})=>XLSX.utils.book_append_sheet(wb, ws, name.slice(0,31)));
  XLSX.writeFile(wb, filename);
}

/* ===== Datos iniciales ===== */
const ESTADOS_INICIALES = ["Aéreo","Marítimo","Ofrecer marítimo"];
const COURIERS_INICIALES = ["Aladín","Boss Box","Buzón","Caba Box","Click Box","Easy Box","Europa Envíos","FastBox","Fixo Cargo","Fox Box","Global Box","Home Box","Inflight Box","Inter Couriers","MC Group","Miami Express","One Box","ParaguayBox","Royal Box"];
const ESTADOS_CARGA = ["En bodega","En tránsito","Arribado"];

/* ===== UI primitivos ===== */
const Section = ({title,right,children})=>(
  <div className="bg-white rounded-2xl shadow p-4 mb-6">
    <div className="flex items-center justify-between mb-3"><h2 className="text-xl font-semibold">{title}</h2>{right}</div>
    {children}
  </div>
);
const Field = ({label,required,children})=>(
  <label className="block">
    <div className="text-sm text-gray-700 mb-1">{label}{required && <span className="text-red-500"> *</span>}</div>
    {children}
  </label>
);
const Input = (p)=>(<input {...p} className={"w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 ring-indigo-500 "+(p.className||"")} />);
const Tabs = ({tabs,current,onChange})=>(
  <div className="flex gap-2 flex-wrap mb-4">{tabs.map(t=>(
    <button key={t} onClick={()=>onChange(t)} className={"px-3 py-2 rounded-xl text-sm "+(current===t?"bg-indigo-600 text-white":"bg-white border")}>{t}</button>
  ))}</div>
);
function Modal({open,onClose,title,children}){
  if(!open) return null;
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="text-lg font-semibold">{title}</div>
          <button onClick={onClose} className="px-2 py-1 border rounded-xl">Cerrar</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/* ===== Login ===== */
function Login({onLogin}){
  const [email,setEmail]=useState("");
  const [role,setRole]=useState("ADMIN");
  const [courier,setCourier]=useState("");
  const canSubmit = email && role && (role==="ADMIN" || courier);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-4">Acceso al sistema</h1>
        <Field label="Email" required><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@empresa.com"/></Field>
        <Field label="Rol" required>
          <select className="w-full rounded-xl border px-3 py-2" value={role} onChange={(e)=>setRole(e.target.value)}>
            <option>ADMIN</option><option>COURIER</option>
          </select>
        </Field>
        {role==="COURIER" && <Field label="Courier" required><Input value={courier} onChange={e=>setCourier(e.target.value)}/></Field>}
        <button onClick={()=>onLogin({email,role,courier: role==="ADMIN"?null:courier})} disabled={!canSubmit} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 disabled:opacity-50">Entrar</button>
      </div>
    </div>
  );
}

/* ===== Gestión de cargas (con filtro fechas) ===== */
function CargasAdmin({flights,setFlights}){
  const [code,setCode]=useState("");
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [awb,setAwb]=useState("");
  const [fac,setFac]=useState("");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");

  function create(){
    if(!code) return;
    setFlights([{id:uuid(),codigo:code,fecha_salida:date,estado:"En bodega",awb,factura_cacesa:fac,cajas:[]},...flights]);
    setCode(""); setAwb(""); setFac("");
  }
  function upd(id,field,value){ setFlights(flights.map(f=>f.id===id?{...f,[field]:value}:f)); }

  const list = flights
    .filter(f=>!from || f.fecha_salida>=from)
    .filter(f=>!to || f.fecha_salida<=to);

  return (
    <Section title="Gestión de cargas"
      right={
        <div className="flex gap-2 items-end">
          <Field label="Desde"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field>
          <Field label="Hasta"><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field>
          <div className="w-px h-10 bg-gray-200 mx-1"/>
          <Input placeholder="Código de carga (ej. EE250905)" value={code} onChange={e=>setCode(e.target.value)}/>
          <Input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
          <Input placeholder="AWB (opcional)" value={awb} onChange={e=>setAwb(e.target.value)}/>
          <Input placeholder="Factura Cacesa (opcional)" value={fac} onChange={e=>setFac(e.target.value)}/>
          <button onClick={create} className="px-3 py-2 bg-indigo-600 text-white rounded-xl">Crear</button>
        </div>
      }>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="bg-gray-50">{["Código","Fecha salida","Estado","AWB","Factura Cacesa","Cajas"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {list.map(f=>(
              <tr key={f.id} className="border-b">
                <td className="px-3 py-2"><Input value={f.codigo} onChange={e=>upd(f.id,"codigo",e.target.value)}/></td>
                <td className="px-3 py-2"><Input type="date" value={f.fecha_salida} onChange={e=>upd(f.id,"fecha_salida",e.target.value)}/></td>
                <td className="px-3 py-2">
                  <select className="border rounded px-2 py-1" value={f.estado} onChange={e=>upd(f.id,"estado",e.target.value)}>
                    {ESTADOS_CARGA.map(s=><option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><Input value={f.awb||""} onChange={e=>upd(f.id,"awb",e.target.value)}/></td>
                <td className="px-3 py-2"><Input value={f.factura_cacesa||""} onChange={e=>upd(f.id,"factura_cacesa",e.target.value)}/></td>
                <td className="px-3 py-2">{f.cajas.length}</td>
              </tr>
            ))}
            {list.length===0 && <tr><td colSpan={6} className="text-center text-gray-500 py-6">Sin resultados.</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ===== RECEPCIÓN (Paquetes) ===== */
function Reception({ currentUser, couriers, setCouriers, estados, setEstados, flights, onAdd }){
  const vuelosBodega = flights.filter(f=>f.estado==="En bodega");
  const [flightId,setFlightId]=useState(vuelosBodega[0]?.id||"");
  const [form,setForm]=useState({
    courier: currentUser.role==="COURIER"? currentUser.courier : "",
    estado:"", casilla:"", codigo:"", // codigo = sufijo (BOSSBOX1)
    fecha:new Date().toISOString().slice(0,10),
    empresa:"", nombre:"", tracking:"", remitente:"",
    peso_real_txt:"", L_txt:"", A_txt:"", H_txt:"",
    desc:"", valor_txt:"0,00", foto:null
  });

  // correlativo por courier (continúa entre cargas)
  const limpiar=(s)=>String(s||"").toUpperCase().replace(/\s+/g,"");
  useEffect(()=>{
    if(!form.courier) return;
    const key="seq_"+limpiar(form.courier);
    const next=(Number(localStorage.getItem(key))||0)+1;
    const n= next>999?1:next;
    setForm(f=>({...f, codigo: `${limpiar(form.courier)}${n}`}));
    // eslint-disable-next-line
  },[form.courier]);

  // números
  const peso = parseComma(form.peso_real_txt);
  const L = parseIntEU(form.L_txt);
  const A = parseIntEU(form.A_txt);
  const H = parseIntEU(form.H_txt);
  const fact = Math.max(0.2, peso||0);
  const vol = A && H && L ? (A*H*L)/5000 : 0;
  const exc = Math.max(0, vol - fact);

  const allReq = ()=>["courier","estado","casilla","codigo","fecha","empresa","nombre","tracking","remitente","peso_real_txt","L_txt","A_txt","H_txt","desc","valor_txt"].every(k=>String(form[k]||"").trim()!=="");
  const submit=()=>{
    if(!allReq()){ alert("Faltan campos."); return; }
    const key="seq_"+limpiar(form.courier);
    let cur=(Number(localStorage.getItem(key))||0)+1; if(cur>999) cur=1;
    localStorage.setItem(key,String(cur));
    const flight = flights.find(f=>f.id===flightId);
    const p={
      id: uuid(), flight_id: flightId,
      courier: form.courier, estado: form.estado, casilla: form.casilla,
      codigo: form.codigo, // sufijo
      codigo_full: `${flight?.codigo||"CARGA"}-${form.codigo}`,
      fecha: form.fecha, empresa_envio: form.empresa, nombre_apellido: form.nombre,
      tracking: form.tracking, remitente: form.remitente,
      peso_real: peso,
      largo: L, ancho: A, alto: H, // enteros cm
      descripcion: form.desc, valor_aerolinea: parseComma(form.valor_txt),
      peso_facturable: Number(fact.toFixed(3)), peso_volumetrico: Number(vol.toFixed(3)), exceso_volumen: Number(exc.toFixed(3)),
      foto: form.foto, estado_bodega: "En bodega",
    };
    onAdd(p);
    setForm({...form, casilla:"", codigo:"", empresa:"", nombre:"", tracking:"", remitente:"", peso_real_txt:"", L_txt:"", A_txt:"", H_txt:"", desc:"", valor_txt:"0,00", foto:null });
  };

  // Foto: archivo + cámara
  const [camOpen,setCamOpen]=useState(false);
  const videoRef=useRef(null); const streamRef=useRef(null);
  useEffect(()=>{
    if(!camOpen) return;
    (async ()=>{
      try{
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode:"environment" } });
        streamRef.current=s;
        if(videoRef.current){ videoRef.current.srcObject=s; videoRef.current.play(); }
      }catch(e){ alert("No se pudo acceder a la cámara."); setCamOpen(false); }
    })();
    return ()=>{ if(streamRef.current){ streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current=null; } };
  },[camOpen]);
  const tomarFoto=()=>{
    const v=videoRef.current; if(!v) return;
    const canvas=document.createElement("canvas");
    canvas.width=v.videoWidth; canvas.height=v.videoHeight;
    const ctx=canvas.getContext("2d"); ctx.drawImage(v,0,0);
    const data=canvas.toDataURL("image/jpeg",0.85);
    setForm(f=>({...f, foto:data})); setCamOpen(false);
  };

  // Etiqueta: 100×60 mm Zebra
  const printLabel=()=>{
    const flight = flights.find(f=>f.id===flightId);
    if(!(form.codigo && form.desc && form.casilla && form.nombre)){ alert("Completá al menos Código, Casilla, Nombre y Descripción."); return; }
    // generar SVG de barras (usamos sufijo como código visible)
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, form.codigo, { format:"CODE128", displayValue:false, height:50, margin:0 });
    const svgHtml = new XMLSerializer().serializeToString(svg);
    const w=window.open("","_blank");
    const medidas = `${L}x${A}x${H} cm`;
    w.document.write(`
      <html><head><meta charset="utf-8"><title>Etiqueta</title>
      <style>
        @page { size: 100mm 60mm; margin: 5mm; }
        body { font-family: Arial, sans-serif; }
        .box { width: 100mm; height: 60mm; }
        .line { margin: 2mm 0; font-size: 12pt; }
        .b { font-weight: bold; }
      </style></head>
      <body>
        <div class="box">
          <div class="line b">Código: ${form.codigo}</div>
          <div class="line">${svgHtml}</div>
          <div class="line">Cliente: ${form.nombre_apellido || form.nombre}</div>
          <div class="line">Casilla: ${form.casilla}</div>
          <div class="line">Peso: ${fmtPeso(peso)} kg</div>
          <div class="line">Medidas: ${medidas}</div>
          <div class="line">Desc: ${form.desc}</div>
          <div class="line">Carga: ${flight?.codigo || "-"}</div>
        </div>
        <script>window.onload=()=>{window.print(); setTimeout(()=>window.close(), 300);}</script>
      </body></html>
    `);
    w.document.close();
  };

  const [showMgr,setShowMgr]=useState(false);
  const vuelosBodega = flights.filter(f=>f.estado==="En bodega");

  return (
    <Section
      title="Recepción de paquete"
      right={
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 border rounded-xl" onClick={()=>setShowMgr(s=>!s)}>Gestionar listas</button>
          <span className="text-sm text-gray-500">Todos los campos obligatorios</span>
        </div>
      }
    >
      {showMgr && (
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <ManageList label="Couriers" items={couriers} setItems={setCouriers}/>
          <ManageList label="Estados" items={estados} setItems={setEstados}/>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Código de carga (solo En bodega)" required>
          <select className="w-full rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
            {vuelosBodega.length===0 && <option value="">— No hay cargas En bodega —</option>}
            {vuelosBodega.map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
          </select>
        </Field>
        <Field label="Courier" required>
          <select className="w-full rounded-xl border px-3 py-2" value={form.courier} onChange={e=>setForm({...form,courier:e.target.value})} disabled={currentUser.role==="COURIER"}>
            <option value="">Seleccionar…</option>{couriers.map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Estado" required>
          <select className="w-full rounded-xl border px-3 py-2" value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>
            <option value="">Seleccionar…</option>{ESTADOS_INICIALES.map(s=><option key={s}>{s}</option>)}
          </select>
        </Field>

        <Field label="Casilla" required><Input value={form.casilla} onChange={e=>setForm({...form,casilla:e.target.value})}/></Field>
        <Field label="Nº de paquete (código — sufijo)" required>
          <Input value={form.codigo} onChange={e=>setForm({...form,codigo:e.target.value.toUpperCase()})} placeholder="BOSSBOX1"/>
        </Field>
        <Field label="Fecha" required><Input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})}/></Field>

        <Field label="Empresa de envío" required><Input value={form.empresa} onChange={e=>setForm({...form,empresa:e.target.value})}/></Field>
        <Field label="Nombre y apellido" required><Input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></Field>
        <Field label="Tracking" required><Input value={form.tracking} onChange={e=>setForm({...form,tracking:e.target.value})}/></Field>

        <Field label="Remitente" required><Input value={form.remitente} onChange={e=>setForm({...form,remitente:e.target.value})}/></Field>
        <Field label="Peso real (kg)" required><Input value={form.peso_real_txt} onChange={e=>setForm({...form,peso_real_txt:e.target.value})} placeholder="3,128"/></Field>
        <Field label="Largo (cm)" required><Input value={form.L_txt} onChange={e=>setForm({...form,L_txt:e.target.value})} placeholder="50"/></Field>
        <Field label="Ancho (cm)" required><Input value={form.A_txt} onChange={e=>setForm({...form,A_txt:e.target.value})} placeholder="30"/></Field>
        <Field label="Alto (cm)" required><Input value={form.H_txt} onChange={e=>setForm({...form,H_txt:e.target.value})} placeholder="20"/></Field>

        <Field label="Descripción" required><Input value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})}/></Field>
        <Field label="Valor declarado (aerolínea) (EUR)" required><Input value={form.valor_txt} onChange={e=>setForm({...form,valor_txt:e.target.value})} placeholder="10,00"/></Field>
        <Field label="Foto del paquete">
          <div className="flex gap-2">
            <input type="file" accept="image/*" onChange={(e)=>{ const file=e.target.files?.[0]; if(!file) return; const r=new FileReader(); r.onload=()=>setForm(f=>({...f,foto:r.result})); r.readAsDataURL(file); }}/>
            <button type="button" onClick={()=>setCamOpen(true)} className="px-3 py-2 border rounded-xl">Tomar foto</button>
          </div>
        </Field>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <div className="bg-gray-50 rounded-xl p-3"><div className="text-sm text-gray-600">Peso facturable (mín 0,200 kg)</div><div className="text-2xl font-semibold">{fmtPeso(fact)} kg</div></div>
        <div className="bg-gray-50 rounded-xl p-3"><div className="text-sm text-gray-600">Peso volumétrico (A×H×L / 5000)</div><div className="text-2xl font-semibold">{fmtPeso(vol)} kg</div></div>
        <div className="bg-gray-50 rounded-xl p-3"><div className="text-sm text-gray-600">Exceso de volumen</div><div className="text-2xl font-semibold">{fmtPeso(exc)} kg</div></div>
      </div>

      <div className="flex justify-between mt-4">
        <button onClick={printLabel} className="px-4 py-2 border rounded-xl">Imprimir etiqueta</button>
        <button onClick={submit} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">Guardar paquete</button>
      </div>

      {/* Modal de cámara */}
      <Modal open={camOpen} onClose={()=>setCamOpen(false)} title="Tomar foto">
        <div className="space-y-3">
          <video ref={videoRef} playsInline className="w-full rounded-xl bg-black/50" />
          <div className="flex justify-end">
            <button onClick={tomarFoto} className="px-3 py-2 bg-indigo-600 text-white rounded-xl">Capturar</button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

/* ===== Paquetes en bodega ===== */
function PaquetesBodega({packages, flights, user, onUpdate}){
  const [q,setQ]=useState("");
  const [flightId,setFlightId]=useState("");
  const vuelosBodega = flights.filter(f=>f.estado==="En bodega");

  const rows = packages
    .filter(p => flights.find(f=>f.id===p.flight_id)?.estado==="En bodega")
    .filter(p => !flightId || p.flight_id===flightId)
    .filter(p => (p.codigo + p.casilla + p.tracking + p.nombre_apellido + p.courier).toLowerCase().includes(q.toLowerCase()))
    .filter(p => user.role!=="COURIER" || p.courier===user.courier);

  // Editor en modal (como recepción)
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState(null);
  const start=(p)=>{
    setForm({
      ...p,
      peso_real_txt: fmtPeso(p.peso_real),
      L_txt: String(p.largo||0),
      A_txt: String(p.ancho||0),
      H_txt: String(p.alto||0),
      valor_txt: fmtMoney(p.valor_aerolinea)
    });
    setOpen(true);
  };
  const save=()=>{
    const peso = parseComma(form.peso_real_txt);
    const L = parseIntEU(form.L_txt), A = parseIntEU(form.A_txt), H = parseIntEU(form.H_txt);
    const fact = Math.max(0.2, peso||0);
    const vol = A&&H&&L ? (A*H*L)/5000 : 0;
    const exc = Math.max(0, vol - fact);
    const upd = {
      ...form,
      peso_real: peso, largo:L, ancho:A, alto:H,
      peso_facturable: Number(fact.toFixed(3)),
      peso_volumetrico: Number(vol.toFixed(3)),
      exceso_volumen: Number(exc.toFixed(3)),
      valor_aerolinea: parseComma(form.valor_txt),
    };
    onUpdate(upd); setOpen(false);
  };

  // Export XLSX con formato (packing en bodega)
  function exportXLSX(){
    const header = [th("CARGA"),th("CÓDIGO"),th("CASILLA"),th("FECHA"),th("NOMBRE"),th("TRACKING"),th("PESO REAL"),th("MEDIDAS"),th("EXCESO DE VOLUMEN"),th("DESCRIPCIÓN"),th("FOTO")];
    const body = rows.map(p=>{
      const carga = flights.find(f=>f.id===p.flight_id)?.codigo || "";
      const medidas = `${p.largo}x${p.ancho}x${p.alto} cm`;
      return [td(carga),td(p.codigo),td(p.casilla),td(p.fecha),td(p.nombre_apellido||""),td(p.tracking),td(fmtPeso(p.peso_real)),td(medidas),td(fmtPeso(p.exceso_volumen)),td(p.descripcion),td(p.foto?"Sí":"")];
    });
    const { ws } = sheetFromAOAStyled("Bodega", [header, ...body], {
      cols: [{wch:12},{wch:14},{wch:10},{wch:12},{wch:24},{wch:16},{wch:12},{wch:14},{wch:16},{wch:28},{wch:8}],
      rows: [{hpt:24}]
    });
    downloadXLSX("Paquetes_en_bodega.xlsx", [{name:"Bodega", ws}]);
  }

  // Gráficos
  const aggReal = {}; const aggExc = {};
  rows.forEach(p=>{ aggReal[p.courier]=(aggReal[p.courier]||0)+p.peso_real; aggExc[p.courier]=(aggExc[p.courier]||0)+p.exceso_volumen; });
  const dataReal = Object.entries(aggReal).map(([courier,kg_real])=>({courier,kg_real}));
  const dataExc  = Object.entries(aggExc).map(([courier,kg_exceso])=>({courier,kg_exceso}));
  const totalReal = sum(dataReal.map(d=>d.kg_real));
  const totalExc = sum(dataExc.map(d=>d.kg_exceso));

  return (
    <Section title="Paquetes en bodega"
      right={
        <div className="flex gap-2">
          <select className="rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
            <option value="">Todas las cargas (En bodega)</option>
            {vuelosBodega.map(f=><option key={f.id} value={f.id}>{f.codigo}</option>)}
          </select>
          <Input placeholder="Buscar…" value={q} onChange={e=>setQ(e.target.value)}/>
          <button onClick={exportXLSX} className="px-3 py-2 bg-gray-800 text-white rounded-xl">Exportar XLSX</button>
        </div>
      }
    >
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="bg-gray-50">
            {["Carga","Código","Casilla","Fecha","Nombre","Tracking","Peso real","Medidas","Exceso de volumen","Descripción","Foto","Editar"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map(p=>{
              const carga = flights.find(f=>f.id===p.flight_id)?.codigo || "";
              return (
                <tr key={p.id} className="border-b">
                  <td className="px-3 py-2">{carga}</td>
                  <td className="px-3 py-2 font-mono">{p.codigo}</td>
                  <td className="px-3 py-2">{p.casilla}</td>
                  <td className="px-3 py-2">{p.fecha}</td>
                  <td className="px-3 py-2">{p.nombre_apellido}</td>
                  <td className="px-3 py-2 font-mono">{p.tracking}</td>
                  <td className="px-3 py-2">{fmtPeso(p.peso_real)} kg</td>
                  <td className="px-3 py-2">{p.largo}x{p.ancho}x{p.alto} cm</td>
                  <td className="px-3 py-2">{fmtPeso(p.exceso_volumen)} kg</td>
                  <td className="px-3 py-2">{p.descripcion}</td>
                  <td className="px-3 py-2">{p.foto ? <img alt="foto" src={p.foto} className="w-14 h-14 object-cover rounded" /> : "—"}</td>
                  <td className="px-3 py-2"><button className="px-2 py-1 border rounded" onClick={()=>start(p)}>Editar</button></td>
                </tr>
              );
            })}
            {rows.length===0 && <tr><td colSpan={12} className="text-center text-gray-500 py-6">No hay paquetes.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Gráficos */}
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {[{data:dataReal,key:"kg_real",title:`Kg reales por courier. Total: `,total:totalReal},
          {data:dataExc,key:"kg_exceso",title:`Exceso volumétrico por courier. Total: `,total:totalExc}].map((g,ix)=>(
          <div key={g.key} className="bg-gray-50 rounded-xl p-3">
            <div className="text-sm text-gray-700 mb-2">{g.title}<b>{fmtPeso(g.total)} kg</b></div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={g.data} dataKey={g.key} nameKey="courier" outerRadius={100}
                       label={(e)=>`${e.courier}: ${fmtPeso(e[g.key])} kg`}>
                    {g.data.map((_,i)=><Cell key={i} fill={COLORS[(i+(ix?3:0))%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v)=>`${fmtPeso(v)} kg`}/>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de edición */}
      <Modal open={open} onClose={()=>setOpen(false)} title="Editar paquete">
        {form && (
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Courier"><Input value={form.courier} onChange={e=>setForm({...form,courier:e.target.value})}/></Field>
            <Field label="Casilla"><Input value={form.casilla} onChange={e=>setForm({...form,casilla:e.target.value})}/></Field>
            <Field label="Código (sufijo)"><Input value={form.codigo} onChange={e=>setForm({...form,codigo:e.target.value.toUpperCase()})}/></Field>

            <Field label="Fecha"><Input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})}/></Field>
            <Field label="Nombre y apellido"><Input value={form.nombre_apellido} onChange={e=>setForm({...form,nombre_apellido:e.target.value})}/></Field>
            <Field label="Tracking"><Input value={form.tracking} onChange={e=>setForm({...form,tracking:e.target.value})}/></Field>

            <Field label="Peso real (kg)"><Input value={form.peso_real_txt} onChange={e=>setForm({...form,peso_real_txt:e.target.value})}/></Field>
            <Field label="Largo (cm)"><Input value={form.L_txt} onChange={e=>setForm({...form,L_txt:e.target.value})}/></Field>
            <Field label="Ancho (cm)"><Input value={form.A_txt} onChange={e=>setForm({...form,A_txt:e.target.value})}/></Field>
            <Field label="Alto (cm)"><Input value={form.H_txt} onChange={e=>setForm({...form,H_txt:e.target.value})}/></Field>

            <Field label="Descripción" ><Input value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})}/></Field>
            <Field label="Valor EUR"><Input value={form.valor_txt} onChange={e=>setForm({...form,valor_txt:e.target.value})}/></Field>
            <div className="md:col-span-3 flex justify-end mt-2">
              <button onClick={save} className="px-3 py-2 bg-indigo-600 text-white rounded-xl">Guardar</button>
            </div>
          </div>
        )}
      </Modal>
    </Section>
  );
}

/* ===== Armado de cajas ===== */
function ArmadoCajas({packages, flights, setFlights, onAssign}){
  const [flightId,setFlightId]=useState("");
  const flight = flights.find(f=>f.id===flightId);
  const [boxCode,setBoxCode]=useState("");
  const [activeBoxId,setActiveBoxId]=useState(null);
  const [scan,setScan]=useState("");

  function addBox(){ if(!flightId||!boxCode) return;
    setFlights(flights.map(f=>f.id!==flightId?f:{...f,cajas:[...f.cajas,{id:uuid(),codigo:boxCode,paquetes:[],peso:"",L:"",A:"",H:""}]}));
    setBoxCode("");
  }
  function updBox(field,val){ if(!flightId||!activeBoxId) return;
    setFlights(flights.map(f=>f.id!==flightId?f:{...f,cajas:f.cajas.map(c=>c.id!==activeBoxId?c:{...c,[field]:val})}));
  }
  function assign(){
    if(!scan||!activeBoxId||!flight) return;
    const pkg = packages.find(p=> p.flight_id===flightId && p.codigo.toUpperCase()===scan.toUpperCase());
    if(!pkg){ alert("No existe ese código en esta carga."); setScan(""); return; }
    if(flight.cajas.some(c=>c.paquetes.includes(pkg.id))){ alert("Ya está en una caja."); setScan(""); return; }
    setFlights(flights.map(f=>f.id!==flightId?f:{...f, cajas:f.cajas.map(c=>c.id!==activeBoxId?c:{...c,paquetes:[...c.paquetes, pkg.id]})}));
    onAssign(pkg.id); setScan("");
  }
  const volCaja=(c)=> (parseIntEU(c.A)*parseIntEU(c.H)*parseIntEU(c.L))/6000 || 0;

  function move(pid,toId){
    if(!toId||!flight) return;
    setFlights(prev=>prev.map(f=>f.id!==flightId?f:{...f,cajas:f.cajas.map(c=>c.id===activeBoxId?{...c,paquetes:c.paquetes.filter(x=>x!==pid)}:c)}));
    setFlights(prev=>prev.map(f=>f.id!==flightId?f:{...f,cajas:f.cajas.map(c=>c.id===toId?{...c,paquetes:[...c.paquetes,pid]}:c)}));
  }

  // Export formato mejorado
  function exportBoxes(){
    if(!flight) return;
    const sheets=[];
    flight.cajas.forEach((caja, idx)=>{
      const byCourier={};
      caja.paquetes.forEach(pid=>{
        const p=packages.find(x=>x.id===pid); if(!p) return;
        (byCourier[p.courier] ||= []).push(p.codigo);
      });
      const headers = Object.keys(byCourier);
      const max = headers.reduce((m,k)=>Math.max(m,byCourier[k].length),0);
      const rows=[];
      rows.push([th("CONTROL DE PAQUETES")]);
      rows.push([td(`CAJA Nº ${idx+1}`), td(`CANT PAQUETES: ${caja.paquetes.length}`)]);
      const peso = parseComma(caja.peso||"0"), L=parseIntEU(caja.L||0), A=parseIntEU(caja.A||0), H=parseIntEU(caja.H||0);
      rows.push([td(`Peso: ${fmtPeso(peso)} kg`), td(`Medidas: ${L}x${A}x${H} cm`), td(`Vol: ${fmtPeso(volCaja(caja))} kg`)]);
      rows.push(headers.map(h=>th(h)));
      for(let r=0;r<max;r++) rows.push(headers.map(h=>td(byCourier[h][r]||"")));
      const { ws } = sheetFromAOAStyled(`CAJA ${idx+1}`, rows, {
        cols:[{wch:22},{wch:28},{wch:20},{wch:20},{wch:20},{wch:20}],
        rows:[{hpt:26},{hpt:20},{hpt:20},{hpt:24}]
      });
      sheets.push({name:`CAJA ${idx+1}`, ws});
    });
    downloadXLSX(`Armado_de_cajas_${flight.codigo}.xlsx`, sheets.length? sheets : [{name:"CAJAS", ws: sheetFromAOAStyled("CAJAS", [[td("Sin cajas")]]).ws}]);
  }

  return (
    <Section title="Armado de cajas">
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Seleccionar carga (En bodega)" required>
          <select className="w-full rounded-xl border px-3 py-2" value={flightId} onChange={e=>{setFlightId(e.target.value); setActiveBoxId(null);}}>
            <option value="">—</option>
            {flights.filter(f=>f.estado==="En bodega").map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
          </select>
        </Field>
        <Field label="Crear caja (código)">
          <div className="flex gap-2">
            <Input placeholder="Caja-01" value={boxCode} onChange={e=>setBoxCode(e.target.value)}/>
            <button onClick={addBox} disabled={!flightId} className="px-3 py-2 bg-gray-800 text-white rounded-xl disabled:opacity-50">Agregar</button>
          </div>
        </Field>
        <Field label="Caja activa">
          <select className="w-full rounded-xl border px-3 py-2" value={activeBoxId||""} onChange={e=>setActiveBoxId(e.target.value)}>
            <option value="">—</option>
            {flight?.cajas.map(c=><option key={c.id} value={c.id}>{c.codigo}</option>)}
          </select>
        </Field>

        <Field label="Escanear / ingresar código (sufijo)">
          <Input value={scan} onChange={e=>setScan(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&assign()} placeholder="BOSSBOX1"/>
        </Field>

        {activeBoxId && (
          <>
            <Field label="Peso caja (kg)"><Input value={flight.cajas.find(c=>c.id===activeBoxId)?.peso||""} onChange={e=>updBox("peso", e.target.value)} placeholder="3,128"/></Field>
            <Field label="Largo (cm)"><Input value={flight.cajas.find(c=>c.id===activeBoxId)?.L||""} onChange={e=>updBox("L", e.target.value)}/></Field>
            <Field label="Ancho (cm)"><Input value={flight.cajas.find(c=>c.id===activeBoxId)?.A||""} onChange={e=>updBox("A", e.target.value)}/></Field>
            <Field label="Alto (cm)"><Input value={flight.cajas.find(c=>c.id===activeBoxId)?.H||""} onChange={e=>updBox("H", e.target.value)}/></Field>
          </>
        )}

        <div className="md:col-span-3">
          {!flight && <div className="text-gray-500">Seleccioná una carga.</div>}
          {flight && flight.cajas.map((c,idx)=>{
            const couriers = new Set(c.paquetes.map(pid=>packages.find(p=>p.id===pid)?.courier).filter(Boolean));
            const etiqueta = couriers.size===0? "—" : (couriers.size===1? [...couriers][0] : "MULTICOURIER");
            const peso = parseComma(c.peso||"0");
            const L=parseIntEU(c.L||0), A=parseIntEU(c.A||0), H=parseIntEU(c.H||0);
            return (
              <div key={c.id} className={`border rounded-2xl p-3 mb-3 ${activeBoxId===c.id?"ring-2 ring-indigo-500":""}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">
                    Caja {idx+1} — {etiqueta} — <span className="font-semibold">{fmtPeso(peso)} kg</span> — {L}x{A}x{H} cm
                  </div>
                </div>
                <ul className="text-sm max-h-48 overflow-auto">
                  {c.paquetes.map(pid=>{
                    const p=packages.find(x=>x.id===pid); if(!p) return null;
                    return (
                      <li key={pid} className="flex items-center gap-2 py-1 border-b">
                        <span className="font-mono">{p.codigo}</span><span className="text-gray-600">{p.courier}</span>
                        <button className="text-red-600 text-xs" onClick={()=>setFlights(flights.map(f=>f.id!==flightId?f:{...f,cajas:f.cajas.map(x=>x.id!==c.id?x:{...x,paquetes:x.paquetes.filter(z=>z!==pid)})}))}>Quitar</button>
                        {flight.cajas.length>1 && (
                          <select className="text-xs border rounded px-1 py-0.5 ml-auto" defaultValue="" onChange={e=>move(pid,e.target.value)}>
                            <option value="" disabled>Mover a…</option>
                            {flight.cajas.filter(x=>x.id!==c.id).map(x=><option key={x.id} value={x.id}>{x.codigo}</option>)}
                          </select>
                        )}
                      </li>
                    );
                  })}
                  {c.paquetes.length===0 && <li className="text-gray-500">—</li>}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="md:col-span-3 flex justify-end">
          <button onClick={exportBoxes} disabled={!flight} className="px-3 py-2 bg-emerald-600 text-white rounded-xl disabled:opacity-50">Exportar XLSX (cajas)</button>
        </div>
      </div>
    </Section>
  );
}

/* ===== Cargas enviadas ===== */
function CargasEnviadas({packages, flights}){
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [estado,setEstado]=useState("");
  const [flightId,setFlightId]=useState("");
  const list = flights
    .filter(f=>f.estado!=="En bodega")
    .filter(f=>!from || f.fecha_salida>=from)
    .filter(f=>!to || f.fecha_salida<=to)
    .filter(f=>!estado || f.estado===estado);
  const flight = flights.find(f=>f.id===flightId);

  const resumen = useMemo(()=>{
    if(!flight) return [];
    return flight.cajas.map((c,i)=>{
      const peso=parseComma(c.peso||"0");
      const L=parseIntEU(c.L||0), A=parseIntEU(c.A||0), H=parseIntEU(c.H||0);
      const vol=(A*H*L)/6000 || 0;
      const couriers = new Set(c.paquetes.map(pid=>packages.find(p=>p.id===pid)?.courier).filter(Boolean));
      const etiqueta = couriers.size===0? "—" : (couriers.size===1? [...couriers][0] : "MULTICOURIER");
      return {n:i+1, courier:etiqueta, peso, L,A,H, vol};
    });
  },[flight,packages]);
  const totPeso=sum(resumen.map(r=>r.peso));
  const totVol=sum(resumen.map(r=>r.vol));

  function exportTodo(){
    if(!flight) return;
    const headerP=[th("COURIER"),th("CÓDIGO"),th("CASILLA"),th("FECHA"),th("NOMBRE"),th("TRACKING"),th("PESO REAL"),th("FACTURABLE"),th("VOLUMÉTRICO"),th("EXCESO"),th("DESCRIPCIÓN")];
    const bodyP=packages.filter(p=>p.flight_id===flightId).map(p=>[td(p.courier),td(p.codigo),td(p.casilla),td(p.fecha),td(p.nombre_apellido),td(p.tracking),td(fmtPeso(p.peso_real)),td(fmtPeso(p.peso_facturable)),td(fmtPeso(p.peso_volumetrico)),td(fmtPeso(p.exceso_volumen)),td(p.descripcion)]);
    const shP=sheetFromAOAStyled("Paquetes", [headerP,...bodyP], {cols:[{wch:16},{wch:14},{wch:10},{wch:12},{wch:22},{wch:16},{wch:12},{wch:12},{wch:14},{wch:12},{wch:28}],rows:[{hpt:26}]});

    const headerC=[th("Nº Caja"),th("Courier"),th("Peso"),th("Largo"),th("Ancho"),th("Alto"),th("Volumétrico")];
    const bodyC=resumen.map(r=>[td(r.n),td(r.courier),td(fmtPeso(r.peso)),td(String(r.L)),td(String(r.A)),td(String(r.H)),td(fmtPeso(r.vol))]);
    bodyC.push([td(""),td("Totales"),td(fmtPeso(totPeso)),td(""),td(""),td(""),td(fmtPeso(totVol))]);
    const shC=sheetFromAOAStyled("Cajas", [headerC,...bodyC], {cols:[{wch:10},{wch:22},{wch:12},{wch:10},{wch:10},{wch:10},{wch:14}]});

    downloadXLSX(`Detalle_${flight.codigo}.xlsx`, [shP, shC]);
  }

  return (
    <Section title="Cargas enviadas (En tránsito / Arribado)">
      <div className="grid md:grid-cols-5 gap-3">
        <Field label="Desde"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field>
        <Field label="Hasta"><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field>
        <Field label="Estado">
          <select className="w-full rounded-xl border px-3 py-2" value={estado} onChange={e=>setEstado(e.target.value)}>
            <option value="">Todos</option><option>En tránsito</option><option>Arribado</option>
          </select>
        </Field>
        <Field label="Carga">
          <select className="w-full rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {list.map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida} · {f.estado}</option>)}
          </select>
        </Field>
        <div className="flex items-end">
          <button onClick={exportTodo} disabled={!flight} className="px-3 py-2 bg-emerald-600 text-white rounded-xl disabled:opacity-50 w-full">Exportar XLSX</button>
        </div>
      </div>

      {!flight ? <div className="text-gray-500 mt-4">Elegí una carga para ver contenido.</div> : (
        <>
          <div className="mt-4 text-sm text-gray-600">Paquetes del vuelo <b>{flight.codigo}</b></div>
          <div className="overflow-auto mb-6">
            <table className="min-w-full text-sm">
              <thead><tr className="bg-gray-50">{["Courier","Código","Casilla","Fecha","Nombre","Tracking","Peso real","Facturable","Volumétrico","Exceso"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {packages.filter(p=>p.flight_id===flightId).map(p=>(
                  <tr key={p.id} className="border-b">
                    <td className="px-3 py-2">{p.courier}</td>
                    <td className="px-3 py-2 font-mono">{p.codigo}</td>
                    <td className="px-3 py-2">{p.casilla}</td>
                    <td className="px-3 py-2">{p.fecha}</td>
                    <td className="px-3 py-2">{p.nombre_apellido}</td>
                    <td className="px-3 py-2 font-mono">{p.tracking}</td>
                    <td className="px-3 py-2">{fmtPeso(p.peso_real)}</td>
                    <td className="px-3 py-2">{fmtPeso(p.peso_facturable)}</td>
                    <td className="px-3 py-2">{fmtPeso(p.peso_volumetrico)}</td>
                    <td className="px-3 py-2">{fmtPeso(p.exceso_volumen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="bg-gray-50">{["Nº Caja","Courier","Peso","Largo","Ancho","Alto","Volumétrico"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {resumen.map(r=>(
                  <tr key={r.n} className="border-b">
                    <td className="px-3 py-2">{r.n}</td>
                    <td className="px-3 py-2">{r.courier}</td>
                    <td className="px-3 py-2">{fmtPeso(r.peso)}</td>
                    <td className="px-3 py-2">{r.L}</td>
                    <td className="px-3 py-2">{r.A}</td>
                    <td className="px-3 py-2">{r.H}</td>
                    <td className="px-3 py-2">{fmtPeso(r.vol)}</td>
                  </tr>
                ))}
                <tr><td></td><td className="px-3 py-2 font-semibold">Totales</td><td className="px-3 py-2 font-semibold">{fmtPeso(totPeso)}</td><td></td><td></td><td></td><td className="px-3 py-2 font-semibold">{fmtPeso(totVol)}</td></tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  );
}

/* ===== Proformas ===== */
const T = { proc:5, fleteReal:9, fleteExc:9, despacho:10 };
const canjeGuiaUSD = (kg)=> kg<=5?10 : kg<=10?13.5 : kg<=30?17 : kg<=50?37 : kg<=100?57 : 100;

function Proformas({packages, flights, extras}){
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [flightId,setFlightId]=useState("");
  const list = flights
    .filter(f=>!from || f.fecha_salida>=from)
    .filter(f=>!to || f.fecha_salida<=to);
  const flight = flights.find(f=>f.id===flightId);

  const porCourier = useMemo(()=>{
    if(!flight) return [];
    const m=new Map();
    flight.cajas.forEach(c=>c.paquetes.forEach(pid=>{
      const p=packages.find(x=>x.id===pid); if(!p) return;
      if(!m.has(p.courier)) m.set(p.courier,{courier:p.courier,kg_real:0,kg_fact:0,kg_exc:0});
      const a=m.get(p.courier); a.kg_real+=p.peso_real; a.kg_fact+=p.peso_facturable; a.kg_exc+=p.exceso_volumen;
    }));
    return Array.from(m.values());
  },[flight,packages]);

  const extrasDeCourier = (courier)=> extras.filter(e=>e.flight_id===flightId && e.courier===courier);

  function exportX(r){
    const proc = r.kg_fact*T.proc, fr=r.kg_real*T.fleteReal, fe=r.kg_exc*T.fleteExc, desp=r.kg_fact*T.despacho;
    const canje=canjeGuiaUSD(r.kg_fact);
    const extrasList = extrasDeCourier(r.courier);
    const extrasMonto = extrasList.reduce((s,e)=>s+parseComma(e.monto),0);
    const com = 0.04*(proc+fr+fe+extrasMonto);
    const total = proc+fr+fe+desp+canje+extrasMonto+com;

    const rows = [
      [td("")],[td("Europa Envíos")],[td("LAMAQUINALOGISTICA, SOCIEDAD LIMITADA")],[td("N.I.F.: B56340656")],
      [td("CALLE ESTEBAN SALAZAR CHAPELA, NUM 20, PUERTA 87, NAVE 87")],[td("29004 MÁLAGA (ESPAÑA)")],[td("(34) 633 74 08 31")],
      [td("")],[th("Factura Proforma")],[td("Fecha: "+new Date().toISOString().slice(0,10))],[td("")],
      [th("Cliente"),th(""),th("Forma de pago"),th(""),th("Nº factura")],
      [td(r.courier),td(""),td(""),td(""),td("—")],[td("")],[td("")],
      [th("Descripción"),th("Cantidad"),th("Precio unitario"),th("Precio total")],
      [td("Procesamiento"),td(fmtPeso(r.kg_fact)),td(fmtMoney(T.proc)),td(fmtMoney(proc))],
      [td("Flete peso real"),td(fmtPeso(r.kg_real)),td(fmtMoney(T.fleteReal)),td(fmtMoney(fr))],
      [td("Flete exceso de volumen"),td(fmtPeso(r.kg_exc)),td(fmtMoney(T.fleteExc)),td(fmtMoney(fe))],
      [td("Servicio de despacho"),td(fmtPeso(r.kg_fact)),td(fmtMoney(T.despacho)),td(fmtMoney(desp))],
      [td("Comisión por canje de guía"),td("1"),td(fmtMoney(canje)),td(fmtMoney(canje))],
      ...extrasList.map(e=>[td(e.descripcion), td("1"), td(fmtMoney(parseComma(e.monto))), td(fmtMoney(parseComma(e.monto)))]),
      [td("Comisión por transferencia (4%)"),td(""),td(""),td(fmtMoney(com))],
      [th("TOTAL USD"),th(""),th(""),th(fmtMoney(total))]
    ];
    const { ws } = sheetFromAOAStyled("Factura", rows, {cols:[{wch:40},{wch:12},{wch:16},{wch:16}], rows:[{hpt:26}]});
    downloadXLSX(`proforma_${(flight?.codigo||"carga")}_${r.courier}.xlsx`, [{name:"Factura", ws}]);
  }

  return (
    <Section title="Proformas por courier"
      right={
        <div className="flex gap-2 items-end">
          <Field label="Desde"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field>
          <Field label="Hasta"><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field>
          <select className="rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
            <option value="">Seleccionar carga…</option>
            {list.map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
          </select>
        </div>
      }
    >
      {!flight ? <div className="text-gray-500">Seleccioná una carga.</div> : (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="bg-gray-50">{["Courier","Kg facturable","Kg exceso","TOTAL USD","XLSX"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {porCourier.map(r=>{
                const proc=r.kg_fact*T.proc, fr=r.kg_real*T.fleteReal, fe=r.kg_exc*T.fleteExc, desp=r.kg_fact*T.despacho;
                const canje=canjeGuiaUSD(r.kg_fact), extrasMonto=extrasDeCourier(r.courier).reduce((s,e)=>s+parseComma(e.monto),0);
                const com=0.04*(proc+fr+fe+extrasMonto); const tot = proc+fr+fe+desp+canje+extrasMonto+com;
                return (
                  <tr key={r.courier} className="border-b">
                    <td className="px-3 py-2">{r.courier}</td>
                    <td className="px-3 py-2">{fmtPeso(r.kg_fact)} kg</td>
                    <td className="px-3 py-2">{fmtPeso(r.kg_exc)} kg</td>
                    <td className="px-3 py-2 font-semibold">{fmtMoney(tot)}</td>
                    <td className="px-3 py-2"><button className="px-2 py-1 border rounded" onClick={()=>exportX(r)}>Descargar</button></td>
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

/* ===== Extras (filtro fechas + editar/cambiar estado) ===== */
function Extras({flights, couriers, extras, setExtras}){
  const [flightId,setFlightId]=useState("");
  const [courier,setCourier]=useState("");
  const [desc,setDesc]=useState("");
  const [monto,setMonto]=useState("");
  const [estado,setEstado]=useState("Pendiente");
  const [fecha,setFecha]=useState(new Date().toISOString().slice(0,10));

  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");

  const add=()=>{
    if(!(flightId && courier && desc && monto)) return;
    setExtras([...extras,{ id:uuid(), flight_id:flightId, courier, descripcion:desc, monto, estado, fecha }]);
    setDesc(""); setMonto("");
  };
  const filtered = extras
    .filter(e=>!from || (e.fecha || (flights.find(f=>f.id===e.flight_id)?.fecha_salida)||"")>=from)
    .filter(e=>!to || (e.fecha || (flights.find(f=>f.id===e.flight_id)?.fecha_salida)||"")<=to)
    .filter(e=>!flightId || e.flight_id===flightId);

  const upd=(id,patch)=> setExtras(extras.map(e=>e.id===id?{...e,...patch}:e));

  return (
    <Section title="Trabajos extras">
      <div className="grid md:grid-cols-6 gap-2 mb-2">
        <Field label="Carga">
          <select className="w-full rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
            <option value="">—</option>{flights.map(f=><option key={f.id} value={f.id}>{f.codigo}</option>)}
          </select>
        </Field>
        <Field label="Courier">
          <select className="w-full rounded-xl border px-3 py-2" value={courier} onChange={e=>setCourier(e.target.value)}>
            <option value="">—</option>{couriers.map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Descripción"><Input value={desc} onChange={e=>setDesc(e.target.value)}/></Field>
        <Field label="Monto (USD)"><Input value={monto} onChange={e=>setMonto(e.target.value)} placeholder="10,00"/></Field>
        <Field label="Estado">
          <select className="w-full rounded-xl border px-3 py-2" value={estado} onChange={e=>setEstado(e.target.value)}>
            <option>Pendiente</option><option>Cobrado</option>
          </select>
        </Field>
        <Field label="Fecha"><Input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></Field>
      </div>
      <div className="flex justify-end mb-4">
        <button onClick={add} className="px-3 py-2 bg-indigo-600 text-white rounded-xl">Agregar</button>
      </div>

      <div className="grid md:grid-cols-3 gap-2 mb-3">
        <Field label="Filtrar desde"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field>
        <Field label="Filtrar hasta"><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field>
        <div />
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="bg-gray-50">{["Fecha","Carga","Courier","Descripción","Monto (USD)","Estado","Editar"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(e=>{
              const carga = flights.find(f=>f.id===e.flight_id)?.codigo || "";
              return (
                <tr key={e.id} className="border-b">
                  <td className="px-3 py-2">{e.fecha || flights.find(f=>f.id===e.flight_id)?.fecha_salida || ""}</td>
                  <td className="px-3 py-2">{carga}</td>
                  <td className="px-3 py-2">{e.courier}</td>
                  <td className="px-3 py-2">
                    <Input value={e.descripcion} onChange={ev=>upd(e.id,{descripcion:ev.target.value})}/>
                  </td>
                  <td className="px-3 py-2">
                    <Input value={e.monto} onChange={ev=>upd(e.id,{monto:ev.target.value})}/>
                  </td>
                  <td className="px-3 py-2">
                    <select className="border rounded px-2 py-1" value={e.estado} onChange={ev=>upd(e.id,{estado:ev.target.value})}>
                      <option>Pendiente</option><option>Cobrado</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <button className="px-2 py-1 border rounded" onClick={()=>{ /* ya se guarda en vivo */ }}>OK</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length===0 && <tr><td colSpan={7} className="text-center text-gray-500 py-6">Sin extras.</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ===== APP ROOT ===== */
export default function App(){
  const [user,setUser]=useState(null);
  const [couriers,setCouriers]=useState(COURIERS_INICIALES);
  const [estados,setEstados]=useState(ESTADOS_INICIALES);
  const [flights,setFlights]=useState([]);
  const [packages,setPackages]=useState([]);
  const [extras,setExtras]=useState([]);

  function addPackage(p){
    // Unicidad por flight + codigo (sufijo)
    if (packages.find(x=>x.flight_id===p.flight_id && x.codigo===p.codigo)){ alert("Ya existe ese código en esta carga."); return; }
    setPackages([p, ...packages]);
  }
  function updatePackage(p){ setPackages(packages.map(x=>x.id===p.id?{...x,...p}:x)); }
  function assignToBox(id){ setPackages(packages.map(p=>p.id===id?{...p,estado_bodega:"En vuelo"}:p)); }

  const tabs = ["Recepción","Paquetes en bodega","Armado de cajas","Cargas enviadas","Gestión de cargas","Proformas","Extras"];
  const [tab,setTab]=useState(tabs[0]);

  return (
    <ErrorBoundary>
      <GlobalErrorCatcher>
        {!user ? <Login onLogin={setUser}/> : (
          <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
            <header className="bg-white border-b sticky top-0 z-10">
              <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600" />
                  <div>
                    <div className="font-semibold">Gestor de Paquetes</div>
                    <div className="text-xs text-gray-500">LaMaquinaLogistica / Europa Envíos</div>
                  </div>
                </div>
                <div className="text-sm text-gray-600">{user.role} {user.courier?`· ${user.courier}`:""} — {user.email}</div>
              </div>
            </header>
            <main className="max-w-7xl mx-auto px-4 py-6">
              <Tabs tabs={tabs} current={tab} onChange={setTab}/>
              {tab==="Recepción" && <Reception currentUser={user} couriers={couriers} setCouriers={setCouriers} estados={estados} setEstados={setEstados} flights={flights} onAdd={addPackage}/>}
              {tab==="Paquetes en bodega" && <PaquetesBodega packages={packages} flights={flights} user={user} onUpdate={updatePackage}/>}
              {tab==="Armado de cajas" && <ArmadoCajas packages={packages} flights={flights} setFlights={setFlights} onAssign={assignToBox}/>}
              {tab==="Cargas enviadas" && <CargasEnviadas packages={packages} flights={flights}/>}
              {tab==="Gestión de cargas" && <CargasAdmin flights={flights} setFlights={setFlights}/>}
              {tab==="Proformas" && <Proformas packages={packages} flights={flights} extras={extras}/>}
              {tab==="Extras" && <Extras flights={flights} couriers={couriers} extras={extras} setExtras={setExtras}/>}
            </main>
          </div>
        )}
      </GlobalErrorCatcher>
    </ErrorBoundary>
  );
}

/* Helpers de listas editable */
function ManageList({label, items, setItems}){
  const [txt,setTxt]=useState("");
  const add=()=>{ const v=txt.trim(); if(!v) return; if(!items.includes(v)) setItems([...items,v]); setTxt(""); };
  const del=(v)=> setItems(items.filter(x=>x!==v));
  return (
    <div className="bg-gray-50 rounded-xl p-2">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className="flex gap-2">
        <Input value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Nuevo…"/>
        <button onClick={add} className="px-3 py-2 bg-gray-800 text-white rounded-xl">Agregar</button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {items.map(v=>(
          <span key={v} className="text-xs bg-white border rounded-xl px-2 py-1">
            {v} <button onClick={()=>del(v)} className="text-red-600 ml-1">✕</button>
          </span>
        ))}
      </div>
    </div>
  );
}
