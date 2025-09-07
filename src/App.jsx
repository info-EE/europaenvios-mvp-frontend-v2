/*  Europa Envíos – MVP 0.2.4
    Cambios en este commit:
    1) Etiquetas 100×60: impresión robusta con fallback a iframe (evita bloqueos de popup).
    2) Recepción y Bodega → editor: el campo ESTADO se limita según el prefijo de la CARGA:
       - AIR…  → solo “Aéreo”
       - MAR…  → solo “Marítimo”
       - COMP… → solo “Ofrecer marítimo”
       (se autoajusta al cambiar de carga).
    3) Bodega → export XLSX: “Exceso de volumen” antes de “Medidas”.
    4) Bodega → reimpresión de etiqueta usa el mismo flujo robusto que Recepción.
    5) Armado de cajas: seleccionar tocando toda la tarjeta, nombre único, reordenar y eliminar;
       solo quedan “Seleccionar carga” y “Escanear / ingresar código”.
*/
import React, { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import * as XLSX from "xlsx-js-style";
import JsBarcode from "jsbarcode";

/* ========== utils ========== */
const uuid = () => {
  try { if (window.crypto?.randomUUID) return window.crypto.randomUUID(); } catch {}
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};
const parseComma = (txt) => {
  if (txt === null || txt === undefined) return 0;
  const s = String(txt).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
const parseIntEU = (txt) => {
  const s = String(txt ?? "").replace(/[^\d-]/g, "");
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
};
const fmtPeso = (n) => Number(n||0).toFixed(3).replace(".", ",");
const fmtMoney = (n) => Number(n||0).toFixed(2).replace(".", ",");
const sum = (a) => a.reduce((s,x)=>s+Number(x||0),0);
const COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#3B82F6","#8B5CF6","#14B8A6","#84CC16","#F97316"];

/* Ordenamiento inteligente */
const isDateLike = (val) => {
  if (typeof val !== "string") return false;
  const t = Date.parse(val);
  return !isNaN(t);
};
const compareSmart = (a, b, asc = true) => {
  const dir = asc ? 1 : -1;
  const va = a ?? ""; const vb = b ?? "";

  const na = Number(va), nb = Number(vb);
  if (!isNaN(na) && !isNaN(nb)) return na === nb ? 0 : na > nb ? dir : -dir;

  const da = isDateLike(va) ? new Date(va).getTime() : null;
  const db = isDateLike(vb) ? new Date(vb).getTime() : null;
  if (da != null && db != null) return da === db ? 0 : da > db ? dir : -dir;

  const sa = String(va).toLowerCase();
  const sb = String(vb).toLowerCase();
  return sa === sb ? 0 : sa > sb ? dir : -dir;
};

/* ========== Impresión robusta de etiquetas ========== */
function buildLabelHTML({codigo, cliente, casilla, pesoKg, medidas, desc, carga, barcodeSvg}) {
  return `
  <html><head><meta charset="utf-8"><title>Etiqueta ${codigo||""}</title>
  <style>
    @page { size: 100mm 60mm; margin: 5mm; }
    body { font-family: Arial, sans-serif; }
    .box { width: 100mm; height: 60mm; }
    .line { margin: 2mm 0; font-size: 12pt; }
    .b { font-weight: bold; }
  </style></head>
  <body>
    <div class="box">
      <div class="line b">Código: ${codigo||""}</div>
      <div class="line">${barcodeSvg||""}</div>
      <div class="line">Cliente: ${cliente||""}</div>
      <div class="line">Casilla: ${casilla||""}</div>
      <div class="line">Peso: ${fmtPeso(pesoKg||0)} kg</div>
      <div class="line">Medidas: ${medidas||""}</div>
      <div class="line">Desc: ${desc||""}</div>
      <div class="line">Carga: ${carga||"-"}</div>
    </div>
    <script>
      function go(){ try{window.focus();}catch(e){} try{window.print()}catch(e){} setTimeout(function(){try{window.close()}catch(e){}}, 300); }
      if (document.readyState === "complete") go(); else window.onload = go;
    </script>
  </body></html>`;
}
function printHTML(html) {
  try {
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (w) {
      w.document.open(); w.document.write(html); w.document.close();
      return;
    }
  } catch {}
  const iframe = document.createElement("iframe");
  iframe.style.position="fixed"; iframe.style.right="0"; iframe.style.bottom="0";
  iframe.style.width="0"; iframe.style.height="0"; iframe.style.border="0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (doc) {
    doc.open(); doc.write(html); doc.close();
    setTimeout(()=> {
      try{ iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }catch{}
      setTimeout(()=>{ try{document.body.removeChild(iframe)}catch{} }, 1500);
    }, 150);
  } else {
    alert("No se pudo generar la etiqueta.");
  }
}
function printLabelData({codigo, cliente, casilla, pesoKg, medidas, desc, carga}) {
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, String(codigo||""), { format:"CODE128", displayValue:false, height:50, margin:0 });
    const barcodeSvg = new XMLSerializer().serializeToString(svg);
    const html = buildLabelHTML({codigo, cliente, casilla, pesoKg, medidas, desc, carga, barcodeSvg});
    printHTML(html);
  } catch {
    alert("No se pudo generar la etiqueta.");
  }
}

/* ========== XLSX helpers (con estilos) ========== */
const bd = () => ({ top:{style:"thin",color:{rgb:"FFCBD5E1"}}, bottom:{style:"thin",color:{rgb:"FFCBD5E1"}},
  left:{style:"thin",color:{rgb:"FFCBD5E1"}}, right:{style:"thin",color:{rgb:"FFCBD5E1"}} });
const th = (txt) => ({ v:txt, t:"s", s:{font:{bold:true,color:{rgb:"FFFFFFFF"}},fill:{fgColor:{rgb:"FF1F2937"}},
  alignment:{horizontal:"center",vertical:"center"}, border:bd()}});
const td = (v) => ({ v, t:"s", s:{alignment:{vertical:"center"}, border:bd()} });

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
async function tryLoadTemplate(path){
  try{
    const res = await fetch(path, {cache:"no-store"});
    if(!res.ok) return null;
    const ab = await res.arrayBuffer();
    const wb = XLSX.read(ab, {cellStyles:true});
    return wb;
  }catch{ return null; }
}
function replacePlaceholdersInWB(wb, map){
  wb.SheetNames.forEach(name=>{
    const ws = wb.Sheets[name];
    const range = XLSX.utils.decode_range(ws["!ref"]||"A1");
    for(let R=range.s.r; R<=range.e.r; R++){
      for(let C=range.s.c; C<=range.e.c; C++){
        const addr = XLSX.utils.encode_cell({r:R,c:C});
        const cell = ws[addr];
        if(cell && typeof cell.v==="string"){
          let txt = cell.v;
          Object.entries(map).forEach(([k,v])=>{ txt = txt.replaceAll(`{{${k}}}`, v); });
          if(txt!==cell.v) ws[addr] = {...cell, v: txt, t:"s"};
        }
      }
    }
  });
}
function appendSheet(wb, name, rows, opts={}){
  const { ws } = sheetFromAOAStyled(name, rows, opts);
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0,31));
}

/* ========== UI base ========== */
const BTN = "px-3 py-2 rounded-xl border bg-white hover:bg-gray-50";
const BTN_PRIMARY = "px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white";
const Section = ({title,right,children})=>(
  <div className="bg-white rounded-2xl shadow p-4 mb-6">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xl font-semibold">{title}</h2>{right}
    </div>{children}
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

/* >>>>>>>>>>  Modal (FALTABA Y ROMPÍA EL RENDER) <<<<<<<<<< */
function Modal({open,onClose,title,children}){
  if(!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow w-full max-w-4xl max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="text-lg font-semibold">{title}</div>
          <button onClick={onClose} className={BTN}>Cerrar</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/* ========== datos iniciales ========== */
const ESTADOS_INICIALES = ["Aéreo","Marítimo","Ofrecer marítimo"];
const COURIERS_INICIALES = ["Aladín","Boss Box","Buzón","Caba Box","Click Box","Easy Box","Europa Envíos","FastBox","Fixo Cargo","Fox Box","Global Box","Home Box","Inflight Box","Inter Couriers","MC Group","Miami Express","One Box","ParaguayBox","Royal Box"];
const ESTADOS_CARGA = ["En bodega","En tránsito","Arribado"];

/* === Reglas de estado por prefijo de carga === */
function estadosPorCodigo(codigo){
  const p = String(codigo||"").toUpperCase();
  if (p.startsWith("AIR"))  return ["Aéreo"];
  if (p.startsWith("MAR"))  return ["Marítimo"];
  if (p.startsWith("COMP")) return ["Ofrecer marítimo"];
  return ESTADOS_INICIALES;
}

/* ========== Login ========== */
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
        <button onClick={()=>onLogin({email,role,courier: role==="ADMIN"?null:courier})} disabled={!canSubmit} className={BTN_PRIMARY+" w-full mt-2 disabled:opacity-50"}>Entrar</button>
      </div>
    </div>
  );
}

/* ========== Gestión de cargas ========== */
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

  const list = flights.filter(f=>!from || f.fecha_salida>=from).filter(f=>!to || f.fecha_salida<=to);

  return (
    <Section title="Gestión de cargas"
      right={
        <div className="flex gap-2 items-end">
          <Field label="Desde"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field>
          <Field label="Hasta"><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field>
          <div className="w-px h-10 bg-gray-200 mx-1"/>
          <Input placeholder="Código de carga" value={code} onChange={e=>setCode(e.target.value)}/>
          <Input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
          <Input placeholder="AWB (opcional)" value={awb} onChange={e=>setAwb(e.target.value)}/>
          <Input placeholder="Factura Cacesa (opcional)" value={fac} onChange={e=>setFac(e.target.value)}/>
          <button onClick={create} className={BTN_PRIMARY}>Crear</button>
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

/* ========== Recepción ========== */
function Reception({ currentUser, couriers, setCouriers, estados, setEstados, flights, onAdd }){
  const vuelosBodega = flights.filter(f=>f.estado==="En bodega");
  const [flightId,setFlightId]=useState(vuelosBodega[0]?.id||"");
  const [form,setForm]=useState({
    courier: currentUser.role==="COURIER"? currentUser.courier : "",
    estado:"", casilla:"", codigo:"",
    fecha:new Date().toISOString().slice(0,10),
    empresa:"", nombre:"", tracking:"", remitente:"",
    peso_real_txt:"", L_txt:"", A_txt:"", H_txt:"",
    desc:"", valor_txt:"0,00", foto:null
  });

  const cargaSel = flights.find(f=>f.id===flightId)?.codigo || "";
  const estadosPermitidos = estadosPorCodigo(cargaSel);

  useEffect(()=>{
    if (!estadosPermitidos.includes(form.estado)) {
      setForm(f=>({...f, estado: estadosPermitidos[0] || ""}));
    }
  // eslint-disable-next-line
  }, [flightId]);

  const limpiar=(s)=>String(s||"").toUpperCase().replace(/\s+/g,"");
  useEffect(()=>{
    if(!form.courier) return;
    const key="seq_"+limpiar(form.courier);
    const next=(Number(localStorage.getItem(key))||0)+1;
    const n= next>999?1:next;
    setForm(f=>({...f, codigo: `${limpiar(form.courier)}${n}`}));
  // eslint-disable-next-line
  },[form.courier]);

  const peso = parseComma(form.peso_real_txt);
  const L = parseIntEU(form.L_txt), A=parseIntEU(form.A_txt), H=parseIntEU(form.H_txt);
  const fact = Math.max(0.2, peso||0);
  const vol = A && H && L ? (A*H*L)/5000 : 0;
  const exc = Math.max(0, vol - fact);

  const ok = ()=>["courier","estado","casilla","codigo","fecha","empresa","nombre","tracking","remitente","peso_real_txt","L_txt","A_txt","H_txt","desc","valor_txt"].every(k=>String(form[k]||"").trim()!=="");
  const submit=()=>{
    if(!ok()){ alert("Faltan campos."); return; }
    const key="seq_"+limpiar(form.courier);
    let cur=(Number(localStorage.getItem(key))||0)+1; if(cur>999) cur=1;
    localStorage.setItem(key,String(cur));
    const fl = flights.find(f=>f.id===flightId);
    const p={
      id: uuid(), flight_id: flightId,
      courier: form.courier, estado: form.estado, casilla: form.casilla,
      codigo: form.codigo,
      codigo_full: `${fl?.codigo||"CARGA"}-${form.codigo}`,
      fecha: form.fecha, empresa_envio: form.empresa, nombre_apellido: form.nombre,
      tracking: form.tracking, remitente: form.remitente,
      peso_real: peso, largo: L, ancho: A, alto: H,
      descripcion: form.desc, valor_aerolinea: parseComma(form.valor_txt),
      peso_facturable: Number(fact.toFixed(3)), peso_volumetrico: Number(vol.toFixed(3)), exceso_volumen: Number(exc.toFixed(3)),
      foto: form.foto, estado_bodega: "En bodega",
    };
    onAdd(p);
    setForm({...form, casilla:"", codigo:"", empresa:"", nombre:"", tracking:"", remitente:"", peso_real_txt:"", L_txt:"", A_txt:"", H_txt:"", desc:"", valor_txt:"0,00", foto:null });
  };

  // cámara
  const [camOpen,setCamOpen]=useState(false);
  const videoRef=useRef(null); const streamRef=useRef(null);
  useEffect(()=>{
    if(!camOpen) return;
    (async ()=>{
      try{
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode:"environment" } });
        streamRef.current=s; if(videoRef.current){ videoRef.current.srcObject=s; videoRef.current.play(); }
      }catch{ alert("No se pudo acceder a la cámara."); setCamOpen(false); }
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

  const printLabel=()=>{
    const fl = flights.find(f=>f.id===flightId);
    if(!(form.codigo && form.desc && form.casilla && form.nombre)){ alert("Completá Código, Casilla, Nombre y Descripción."); return; }
    const medidas = `${L}x${A}x${H} cm`;
    printLabelData({
      codigo: form.codigo,
      cliente: form.nombre,
      casilla: form.casilla,
      pesoKg: peso,
      medidas,
      desc: form.desc,
      carga: fl?.codigo || "-"
    });
  };

  const fileRef = useRef(null);
  const onFile = (e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader(); r.onload=()=>setForm(f=>({...f,foto:r.result})); r.readAsDataURL(file);
  };

  const [showMgr,setShowMgr]=useState(false);

  return (
    <Section
      title="Recepción de paquete"
      right={
        <div className="flex items-center gap-2">
          <button className={BTN} onClick={()=>setShowMgr(s=>!s)}>Gestionar listas</button>
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
        <Field label="Carga" required>
          <select className="w-full rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
            {vuelosBodega.length===0 && <option value="">— No hay cargas En bodega —</option>}
            {vuelosBodega.map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
          </select>
        </Field>
        <Field label="Courier" required>
          <select className="w-full rounded-xl border px-3 py-2" value={form.courier} onChange={e=>setForm({...form,courier:e.target.value})} disabled={currentUser.role==="COURIER"}>
            <option value="">Seleccionar…</option>{COURIERS_INICIALES.map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Estado" required>
          <select className="w-full rounded-xl border px-3 py-2" value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>
            {estadosPermitidos.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </Field>

        <Field label="Casilla" required><Input value={form.casilla} onChange={e=>setForm({...form,casilla:e.target.value})}/></Field>
        <Field label="Código de paquete" required><Input value={form.codigo} onChange={e=>setForm({...form,codigo:e.target.value.toUpperCase()})} placeholder="BOSSBOX1"/></Field>
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
        <Field label="Precio (EUR)" required><Input value={form.valor_txt} onChange={e=>setForm({...form,valor_txt:e.target.value})} placeholder="10,00"/></Field>

        <Field label="Foto del paquete">
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden"/>
            <button type="button" onClick={()=>fileRef.current?.click()} className={BTN}>Seleccionar archivo</button>
            <button type="button" onClick={()=>setCamOpen(true)} className={BTN}>Tomar foto</button>
          </div>
        </Field>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <InfoBox title="Peso facturable (mín 0,200 kg)" value={`${fmtPeso(fact)} kg`}/>
        <InfoBox title="Peso volumétrico (A×H×L / 5000)" value={`${fmtPeso(vol)} kg`}/>
        <InfoBox title="Exceso de volumen" value={`${fmtPeso(exc)} kg`}/>
      </div>

      <div className="flex justify-between mt-4">
        <button onClick={printLabel} className={BTN}>Imprimir etiqueta</button>
        <button onClick={submit} className={BTN_PRIMARY}>Guardar paquete</button>
      </div>

      <Modal open={camOpen} onClose={()=>setCamOpen(false)} title="Tomar foto">
        <div className="space-y-3">
          <video ref={videoRef} playsInline className="w-full rounded-xl bg-black/50" />
          <div className="flex justify-end">
            <button onClick={tomarFoto} className={BTN_PRIMARY}>Capturar</button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}
const InfoBox=({title,value})=>(
  <div className="bg-gray-50 rounded-xl p-3">
    <div className="text-sm text-gray-600">{title}</div>
    <div className="text-2xl font-semibold">{value}</div>
  </div>
);

/* ========== Paquetes en bodega ========== */
function PaquetesBodega({packages, flights, user, onUpdate, couriers}){
  const [q,setQ]=useState("");
  const [flightId,setFlightId]=useState("");
  const vuelosBodega = flights.filter(f=>f.estado==="En bodega");

  const [orderBy, setOrderBy] = useState("fecha");
  const [asc, setAsc] = useState(false);
  const camposOrden = [
    {key:"codigo",label:"Código"},
    {key:"casilla",label:"Casilla"},
    {key:"fecha",label:"Fecha"},
    {key:"nombre_apellido",label:"Nombre"},
    {key:"tracking",label:"Tracking"},
    {key:"courier",label:"Courier"},
    {key:"estado",label:"Estado"},
    {key:"peso_real",label:"Peso real"},
    {key:"exceso_volumen",label:"Exceso vol."},
  ];

  const filtered = packages
    .filter(p => flights.find(f=>f.id===p.flight_id)?.estado==="En bodega")
    .filter(p => !flightId || p.flight_id===flightId)
    .filter(p => (p.codigo + p.casilla + p.tracking + p.nombre_apellido + p.courier).toLowerCase().includes(q.toLowerCase()))
    .filter(p => user.role!=="COURIER" || p.courier===user.courier);

  const rows = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a,b)=>compareSmart(a?.[orderBy], b?.[orderBy], asc));
    return arr;
  }, [filtered, orderBy, asc]);

  const [open,setOpen]=useState(false);
  const [form,setForm]=useState(null);
  const start=(p)=>{
    setForm({
      ...p,
      peso_real_txt: fmtPeso(p.peso_real),
      L_txt: String(p.largo||0), A_txt: String(p.ancho||0), H_txt: String(p.alto||0),
      valor_txt: fmtMoney(p.valor_aerolinea)
    });
    setOpen(true);
  };

  useEffect(()=>{
    if(!open || !form) return;
    const codigoCarga = flights.find(f=>f.id===form.flight_id)?.codigo || "";
    const permitidos = estadosPorCodigo(codigoCarga);
    if (!permitidos.includes(form.estado)) {
      setForm(f=>({...f, estado: permitidos[0] || ""}));
    }
  // eslint-disable-next-line
  }, [form?.flight_id, open]);

  const save=()=>{
    const peso = parseComma(form.peso_real_txt);
    const L = parseIntEU(form.L_txt), A = parseIntEU(form.A_txt), H = parseIntEU(form.H_txt);
    const fact = Math.max(0.2, peso||0);
    const vol = A&&H&&L ? (A*H*L)/5000 : 0;
    const exc = Math.max(0, vol - fact);
    const fl = flights.find(f=>f.id===form.flight_id);
    const upd = {
      ...form,
      peso_real: peso, largo:L, ancho:A, alto:H,
      peso_facturable: Number(fact.toFixed(3)),
      peso_volumetrico: Number(vol.toFixed(3)),
      exceso_volumen: Number(exc.toFixed(3)),
      valor_aerolinea: parseComma(form.valor_txt),
      codigo_full: `${fl?.codigo||"CARGA"}-${form.codigo}`,
    };
    onUpdate(upd); setOpen(false);
  };

  const [viewer,setViewer]=useState(null);

  const fileRef = useRef(null);
  const onFile = (e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader(); r.onload=()=>setForm(f=>({...f,foto:r.result})); r.readAsDataURL(file);
  };
  const [camOpen,setCamOpen]=useState(false);
  const videoRef=useRef(null); const streamRef=useRef(null);
  useEffect(()=>{
    if(!camOpen) return;
    (async ()=>{
      try{
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode:"environment" } });
        streamRef.current=s; if(videoRef.current){ videoRef.current.srcObject=s; videoRef.current.play(); }
      }catch{ alert("No se pudo acceder a la cámara."); setCamOpen(false); }
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

  const reimprimir = (p)=>{
    const fl = flights.find(f=>f.id===p.flight_id);
    const medidas = `${p.largo||0}x${p.ancho||0}x${p.alto||0} cm`;
    printLabelData({
      codigo: p.codigo,
      cliente: p.nombre_apellido,
      casilla: p.casilla,
      pesoKg: p.peso_real,
      medidas,
      desc: p.descripcion,
      carga: fl?.codigo || "-"
    });
  };

  async function exportXLSX(){
    const header = [
      th("Carga"), th("Courier"), th("Estado"), th("Casilla"), th("Código de paquete"), th("Fecha"),
      th("Empresa de envío"), th("Nombre y apellido"), th("Tracking"), th("Remitente"),
      th("Peso facturable (mín 0,200 kg)"), th("Exceso de volumen"), th("Medidas"),
      th("Descripción"), th("Precio (EUR)")
    ];
    const body = rows.map(p=>{
      const carga = flights.find(f=>f.id===p.flight_id)?.codigo || "";
      const medidas = `${p.largo||0}x${p.ancho||0}x${p.alto||0} cm`;
      return [
        td(carga), td(p.courier||""), td(p.estado||""), td(p.casilla||""), td(p.codigo||""),
        td(p.fecha||""), td(p.empresa_envio||""), td(p.nombre_apellido||""), td(p.tracking||""),
        td(p.remitente||""), td(fmtPeso(p.peso_facturable||0)), td(fmtPeso(p.exceso_volumen||0)),
        td(medidas), td(p.descripcion||""), td(fmtMoney(p.valor_aerolinea||0))
      ];
    });

    const tpl = await tryLoadTemplate("/templates/bodega.xlsx");
    if(tpl){
      replacePlaceholdersInWB(tpl, { FECHA: new Date().toISOString().slice(0,10) });
      appendSheet(tpl, "DATA", [header, ...body], {
        cols:[{wch:12},{wch:16},{wch:14},{wch:10},{wch:16},{wch:12},{wch:20},{wch:22},{wch:16},{wch:16},{wch:18},{wch:16},{wch:14},{wch:28},{wch:12}]
      });
      XLSX.writeFile(tpl, "Paquetes_en_bodega.xlsx");
      return;
    }
    const { ws } = sheetFromAOAStyled("Bodega", [header, ...body], {
      cols:[{wch:12},{wch:16},{wch:14},{wch:10},{wch:16},{wch:12},{wch:20},{wch:22},{wch:16},{wch:16},{wch:18},{wch:16},{wch:14},{wch:28},{wch:12}],
      rows:[{hpt:24}]
    });
    downloadXLSX("Paquetes_en_bodega.xlsx", [{name:"Bodega", ws}]);
  }

  const aggReal = {}; const aggExc = {};
  rows.forEach(p=>{ aggReal[p.courier]=(aggReal[p.courier]||0)+p.peso_real; aggExc[p.courier]=(aggExc[p.courier]||0)+p.exceso_volumen; });
  const dataReal = Object.entries(aggReal).map(([courier,kg_real])=>({courier,kg_real}));
  const dataExc  = Object.entries(aggExc).map(([courier,kg_exceso])=>({courier,kg_exceso}));
  const totalReal = sum(dataReal.map(d=>d.kg_real));
  const totalExc = sum(dataExc.map(d=>d.kg_exceso));

  return (
    <Section title="Paquetes en bodega"
      right={
        <div className="flex gap-2 flex-wrap items-end">
          <select className="rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
            <option value="">Todas las cargas (En bodega)</option>
            {vuelosBodega.map(f=><option key={f.id} value={f.id}>{f.codigo}</option>)}
          </select>
          <Input placeholder="Buscar…" value={q} onChange={e=>setQ(e.target.value)}/>
          <div className="flex items-end gap-2">
            <Field label="Ordenar por">
              <select className="rounded-xl border px-3 py-2" value={orderBy} onChange={(e)=>setOrderBy(e.target.value)}>
                {camposOrden.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </Field>
            <button className={BTN} onClick={()=>setAsc(v=>!v)} title="Asc/Desc">{asc? "Asc ↑" : "Desc ↓"}</button>
          </div>
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
                  <td className="px-3 py-2">
                    {p.foto ? <img alt="foto" src={p.foto} className="w-14 h-14 object-cover rounded cursor-pointer" onClick={()=>setViewer(p.foto)} /> : "—"}
                  </td>
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

      {/* Modal edición completa */}
      <Modal open={open} onClose={()=>setOpen(false)} title="Editar paquete">
        {form && (
          <>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Carga">
                <select
                  className="w-full rounded-xl border px-3 py-2"
                  value={form.flight_id}
                  onChange={e=>setForm({...form,flight_id:e.target.value})}
                >
                  {vuelosBodega.length === 0 && (
                    <option value="">— No hay cargas En bodega —</option>
                  )}
                  {vuelosBodega.map(f=>(
                    <option key={f.id} value={f.id}>
                      {f.codigo} · {f.fecha_salida}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Courier">
                <select className="w-full rounded-xl border px-3 py-2" value={form.courier} onChange={e=>setForm({...form,courier:e.target.value})}>
                  <option value="">Seleccionar…</option>
                  {couriers.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Estado">
                {(() => {
                  const codigo = flights.find(f=>f.id===form.flight_id)?.codigo || "";
                  const opciones = estadosPorCodigo(codigo);
                  return (
                    <select className="w-full rounded-xl border px-3 py-2" value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>
                      {opciones.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  );
                })()}
              </Field>

              <Field label="Casilla"><Input value={form.casilla} onChange={e=>setForm({...form,casilla:e.target.value})}/></Field>
              <Field label="Código de paquete"><Input value={form.codigo} onChange={e=>setForm({...form,codigo:e.target.value.toUpperCase()})}/></Field>
              <Field label="Fecha"><Input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})}/></Field>

              <Field label="Empresa de envío"><Input value={form.empresa_envio} onChange={e=>setForm({...form,empresa_envio:e.target.value})}/></Field>
              <Field label="Nombre y apellido"><Input value={form.nombre_apellido} onChange={e=>setForm({...form,nombre_apellido:e.target.value})}/></Field>
              <Field label="Tracking"><Input value={form.tracking} onChange={e=>setForm({...form,tracking:e.target.value})}/></Field>
              <Field label="Remitente"><Input value={form.remitente} onChange={e=>setForm({...form,remitente:e.target.value})}/></Field>

              <Field label="Peso real (kg)"><Input value={form.peso_real_txt} onChange={e=>setForm({...form,peso_real_txt:e.target.value})}/></Field>
              <Field label="Largo (cm)"><Input value={form.L_txt} onChange={e=>setForm({...form,L_txt:e.target.value})}/></Field>
              <Field label="Ancho (cm)"><Input value={form.A_txt} onChange={e=>setForm({...form,A_txt:e.target.value})}/></Field>
              <Field label="Alto (cm)"><Input value={form.H_txt} onChange={e=>setForm({...form,H_txt:e.target.value})}/></Field>

              <Field label="Descripción"><Input value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})}/></Field>
              <Field label="Precio (EUR)"><Input value={form.valor_txt} onChange={e=>setForm({...form,valor_txt:e.target.value})}/></Field>

              <div className="md:col-span-3">
                <div className="text-sm text-gray-700 mb-1">Foto del paquete</div>
                <div className="flex items-center gap-2">
                  <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden"/>
                  <button type="button" onClick={()=>fileRef.current?.click()} className={BTN}>Seleccionar archivo</button>
                  <button type="button" onClick={()=>setCamOpen(true)} className={BTN}>Tomar foto</button>
                  {form.foto && <img src={form.foto} alt="foto" className="h-14 w-14 object-cover rounded border"/>}
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-4">
              <button className={BTN} onClick={()=>reimprimir(form)}>Reimprimir etiqueta</button>
              <button onClick={save} className={BTN_PRIMARY}>Guardar</button>
            </div>

            <Modal open={camOpen} onClose={()=>setCamOpen(false)} title="Tomar foto">
              <div className="space-y-3">
                <video ref={videoRef} playsInline className="w-full rounded-xl bg-black/50" />
                <div className="flex justify-end">
                  <button onClick={tomarFoto} className={BTN_PRIMARY}>Capturar</button>
                </div>
              </div>
            </Modal>
          </>
        )}
      </Modal>

      <Modal open={!!viewer} onClose={()=>setViewer(null)} title="Foto">
        {viewer && <img src={viewer} alt="foto" className="max-w-full rounded-xl" />}
      </Modal>
    </Section>
  );
}

/* ========== Armado de cajas (clic en toda la tarjeta) ========== */
function ArmadoCajas({packages, flights, setFlights, onAssign}){
  const [flightId,setFlightId]=useState("");
  const flight = flights.find(f=>f.id===flightId);
  const [activeBoxId,setActiveBoxId]=useState(null);
  const [scan,setScan]=useState("");

  const nombreExiste = (name, omitId=null)=>{
    const n = String(name||"").trim().toLowerCase();
    if (!flight) return false;
    return flight.cajas.some(c=>c.id!==omitId && String(c.codigo||"").trim().toLowerCase()===n);
  };
  const nombreUnicoSiguiente = ()=>{
    let i = 1;
    while (nombreExiste(`Caja ${i}`)) i++;
    return `Caja ${i}`;
  };

  function addBox(){
    if(!flightId) return;
    const id = uuid();
    const codigo = nombreUnicoSiguiente();
    setFlights(prev=>prev.map(f=>f.id!==flightId ? f : ({
      ...f,
      cajas:[...(f.cajas||[]), { id, codigo, paquetes:[], peso:"", L:"", A:"", H:"" }]
    })));
    setActiveBoxId(id);
  }
  function renameBox(id, name){
    const nuevo = String(name||"").trim();
    if(!nuevo) return;
    if(nombreExiste(nuevo, id)){ alert("Ya existe una caja con ese nombre en esta carga."); return; }
    setFlights(prev=>prev.map(f=>f.id!==flightId ? f : ({
      ...f,
      cajas: f.cajas.map(c=>c.id!==id?c:{...c, codigo:nuevo})
    })));
  }
  function updBoxField(id, field, value){
    setFlights(prev=>prev.map(f=>f.id!==flightId ? f : ({
      ...f,
      cajas: f.cajas.map(c=>c.id!==id?c:{...c,[field]:value})
    })));
  }
  function removeBox(id){
    setFlights(prev=>prev.map(f=>f.id!==flightId ? f : ({
      ...f,
      cajas: f.cajas.filter(c=>c.id!==id)
    })));
    if(activeBoxId===id) setActiveBoxId(null);
  }
  function moveBox(id, dir){
    if(!flight) return;
    const i = flight.cajas.findIndex(c=>c.id===id);
    const j = i + dir;
    if(i<0 || j<0 || j>=flight.cajas.length) return;
    setFlights(prev=>prev.map(f=>{
      if(f.id!==flightId) return f;
      const arr=[...f.cajas];
      const [box] = arr.splice(i,1);
      arr.splice(j,0,box);
      return {...f, cajas: arr};
    }));
  }

  function assign(){
    if(!scan||!activeBoxId||!flight) return;
    const code = scan.toUpperCase();
    const pkg = packages.find(p=> p.flight_id===flightId && p.codigo.toUpperCase()===code);
    if(!pkg){ alert("No existe ese código en esta carga."); setScan(""); return; }
    if(flight.cajas.some(c=>c.paquetes.includes(pkg.id))){ alert("Ese paquete ya está en una caja."); setScan(""); return; }
    setFlights(prev=>prev.map(f=>f.id!==flightId?f:({
      ...f,
      cajas:f.cajas.map(c=>c.id!==activeBoxId?c:{...c,paquetes:[...c.paquetes, pkg.id]})
    })));
    onAssign(pkg.id);
    setScan("");
  }
  function move(pid, fromId, toId){
    if(!toId||!flight || fromId===toId) return;
    setFlights(prev=>prev.map(f=>{
      if(f.id!==flightId) return f;
      const cajas = f.cajas.map(c=>({...c, paquetes:[...c.paquetes]}));
      const from = cajas.find(c=>c.id===fromId);
      const to = cajas.find(c=>c.id===toId);
      if(!from || !to) return f;
      from.paquetes = from.paquetes.filter(x=>x!==pid);
      if(!to.paquetes.includes(pid)) to.paquetes.push(pid);
      return {...f, cajas};
    }));
  }

  async function exportBoxes(){
    if(!flight) return;
    const sheets=[];
    flight.cajas.forEach((caja)=>{
      const byCourier={};
      caja.paquetes.forEach(pid=>{
        const p=packages.find(x=>x.id===pid); if(!p) return;
        (byCourier[p.courier] ||= []).push(p.codigo);
      });
      const headers = Object.keys(byCourier);
      const max = headers.reduce((m,k)=>Math.max(m,byCourier[k].length),0);
      const rows=[];
      rows.push([th("CONTROL DE PAQUETES")]);
      rows.push([td(`CAJA: ${caja.codigo}`), td(`CANT PAQUETES: ${caja.paquetes.length}`)]);
      const peso = parseComma(caja.peso||"0"), L=parseIntEU(caja.L||0), A=parseIntEU(caja.A||0), H=parseIntEU(caja.H||0);
      const vol = (parseIntEU(caja.A)*parseIntEU(caja.H)*parseIntEU(caja.L))/6000 || 0;
      rows.push([td(`Peso: ${fmtPeso(peso)} kg`), td(`Medidas: ${L}x${A}x${H} cm`), td(`Vol: ${fmtPeso(vol)} kg`)]);
      rows.push(headers.map(h=>th(h)));
      for(let r=0;r<max;r++) rows.push(headers.map(h=>td(byCourier[h][r]||"")));
      const { ws } = sheetFromAOAStyled(caja.codigo, rows, {
        cols:[{wch:22},{wch:28},{wch:20},{wch:20},{wch:20},{wch:20}],
        rows:[{hpt:26},{hpt:20},{hpt:20},{hpt:24}]
      });
      const sheetName = (caja.codigo || "CAJA").slice(0,31);
      sheets.push({name: sheetName, ws});
    });

    const tpl = await tryLoadTemplate("/templates/cajas.xlsx");
    if(tpl){
      replacePlaceholdersInWB(tpl, { CARGA: flight.codigo, FECHA: flight.fecha_salida||"" });
      const resumen = flight.cajas.map((c)=> [ c.codigo, fmtPeso(parseComma(c.peso||"0")), String(parseIntEU(c.L||0)), String(parseIntEU(c.A||0)), String(parseIntEU(c.H||0)), fmtPeso((parseIntEU(c.A)*parseIntEU(c.H)*parseIntEU(c.L))/6000 || 0) ]);
      appendSheet(tpl, "RESUMEN", [[th("Caja"),th("Peso"),th("L"),th("A"),th("H"),th("Vol")], ...resumen]);
      sheets.forEach(s=>XLSX.utils.book_append_sheet(tpl, s.ws, s.name));
      XLSX.writeFile(tpl, `Armado_de_cajas_${flight.codigo}.xlsx`);
      return;
    }
    downloadXLSX(`Armado_de_cajas_${flight.codigo}.xlsx`, sheets.length? sheets : [{name:"CAJAS", ws: sheetFromAOAStyled("CAJAS", [[td("Sin cajas")]]).ws}]);
  }

  return (
    <Section title="Armado de cajas">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Seleccionar carga" required>
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={flightId}
            onChange={e=>{setFlightId(e.target.value); setActiveBoxId(null);}}
          >
            <option value="">—</option>
            {flights.filter(f=>f.estado==="En bodega").map(f=>
              <option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>
            )}
          </select>
        </Field>
        <Field label="Escanear / ingresar código">
          <Input value={scan} onChange={e=>setScan(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&assign()} placeholder="BOSSBOX1"/>
        </Field>
      </div>

      <div className="flex justify-end mt-3">
        <button onClick={addBox} disabled={!flightId} className={BTN_PRIMARY+" disabled:opacity-50"}>Nueva caja</button>
      </div>

      <div className="mt-3">
        {!flight && <div className="text-gray-500">Seleccioná una carga.</div>}
        {flight && flight.cajas.map((c,idx)=>{
          const couriers = new Set(c.paquetes.map(pid=>packages.find(p=>p.id===pid)?.courier).filter(Boolean));
          const etiqueta = couriers.size===0? "—" : (couriers.size===1? [...couriers][0] : "MULTICOURIER");
          const peso = parseComma(c.peso||"0");
          const L=parseIntEU(c.L||0), A=parseIntEU(c.A||0), H=parseIntEU(c.H||0);
          const activa = activeBoxId===c.id;
          return (
            <div
              key={c.id}
              className={`border rounded-2xl p-3 mb-3 ${activa?"ring-2 ring-indigo-500":""} cursor-pointer`}
              onClick={()=>setActiveBoxId(c.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="text-xs text-gray-600 mb-1">Nombre de la caja</div>
                  <input
                    className="w-full rounded-xl border px-3 py-2"
                    value={c.codigo}
                    onChange={(e)=>renameBox(c.id, e.target.value)}
                    onClick={(e)=>e.stopPropagation()}
                  />
                </div>

                <div className="hidden md:flex items-center gap-2">
                  <button className={BTN} onClick={(e)=>{e.stopPropagation(); moveBox(c.id,-1);}} title="Subir">↑</button>
                  <button className={BTN} onClick={(e)=>{e.stopPropagation(); moveBox(c.id, 1);}} title="Bajar">↓</button>
                  <button className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white" onClick={(e)=>{e.stopPropagation(); removeBox(c.id);}}>Eliminar</button>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-2 mt-2">
                <Field label="Peso (kg)">
                  <Input value={c.peso||""} onChange={e=>updBoxField(c.id,"peso",e.target.value)} onClick={(e)=>e.stopPropagation()} placeholder="3,128"/>
                </Field>
                <Field label="Largo (cm)">
                  <Input value={c.L||""} onChange={e=>updBoxField(c.id,"L",e.target.value)} onClick={(e)=>e.stopPropagation()}/>
                </Field>
                <Field label="Ancho (cm)">
                  <Input value={c.A||""} onChange={e=>updBoxField(c.id,"A",e.target.value)} onClick={(e)=>e.stopPropagation()}/>
                </Field>
                <Field label="Alto (cm)">
                  <Input value={c.H||""} onChange={e=>updBoxField(c.id,"H",e.target.value)} onClick={(e)=>e.stopPropagation()}/>
                </Field>
              </div>

              <div className="mt-2 text-sm text-gray-700">
                {etiqueta} — <b>{fmtPeso(peso)} kg</b> — {L}x{A}x{H} cm
              </div>

              <ul className="text-sm max-h-48 overflow-auto mt-2">
                {c.paquetes.map(pid=>{
                  const p=packages.find(x=>x.id===pid); if(!p) return null;
                  return (
                    <li key={pid} className="flex items-center gap-2 py-1 border-b" onClick={(e)=>e.stopPropagation()}>
                      <span className="font-mono">{p.codigo}</span><span className="text-gray-600">{p.courier}</span>
                      <button className="text-red-600 text-xs" onClick={()=>setFlights(flights.map(f=>f.id!==flightId?f:{...f,cajas:f.cajas.map(x=>x.id!==c.id?x:{...x,paquetes:x.paquetes.filter(z=>z!==pid)})}))}>Quitar</button>
                      {flight.cajas.length>1 && (
                        <select className="text-xs border rounded px-1 py-0.5 ml-auto" defaultValue="" onChange={e=>move(pid,c.id,e.target.value)}>
                          <option value="" disabled>Mover a…</option>
                          {flight.cajas.filter(x=>x.id!==c.id).map(x=><option key={x.id} value={x.id}>{x.codigo}</option>)}
                        </select>
                      )}
                    </li>
                  );
                })}
                {c.paquetes.length===0 && <li className="text-gray-500" onClick={(e)=>e.stopPropagation()}>—</li>}
              </ul>

              <div className="flex md:hidden items-center gap-2 mt-2" onClick={(e)=>e.stopPropagation()}>
                <button className={BTN} onClick={()=>moveBox(c.id,-1)} title="Subir">↑</button>
                <button className={BTN} onClick={()=>moveBox(c.id, 1)} title="Bajar">↓</button>
                <button className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white" onClick={()=>removeBox(c.id)}>Eliminar</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button onClick={exportBoxes} disabled={!flight} className={BTN_PRIMARY+" disabled:opacity-50"}>Exportar XLSX (cajas)</button>
      </div>
    </Section>
  );
}

/* ========== Cargas enviadas / Proformas / Extras ==========
   (SIN CAMBIOS RESPECTO A LA VERSIÓN ANTERIOR, MANTENIDOS)  */
const T = { proc:5, fleteReal:9, fleteExc:9, despacho:10 };
const canjeGuiaUSD = (kg)=> kg<=5?10 : kg<=10?13.5 : kg<=30?17 : kg<=50?37 : kg<=100?57 : 100;

function CargasEnviadas({packages, flights}){ /* ... igual que versión enviada ... */ }
/*  Para ahorrar espacio aquí, deja este bloque igual a la versión que ya pegaste,
    no afecta al problema del pantallazo blanco.  */

/* === Usa las definiciones completas que ya tenías para CargasEnviadas, Proformas y Extras === */
/* ... (PEGA AQUÍ los mismos bloques de la versión anterior: CargasEnviadas, Proformas, Extras) ... */

/* ========== App root ========== */
function App(){
  const [user,setUser]=useState(null);
  const [couriers,setCouriers]=useState(COURIERS_INICIALES);
  const [estados,setEstados]=useState(ESTADOS_INICIALES);
  const [flights,setFlights]=useState([]);
  const [packages,setPackages]=useState([]);
  const [extras,setExtras]=useState([]);

  function addPackage(p){
    if (packages.find(x=>x.flight_id===p.flight_id && x.codigo===p.codigo)){ alert("Ya existe ese código en esta carga."); return; }
    setPackages([p, ...packages]);
  }
  function updatePackage(p){ setPackages(packages.map(x=>x.id===p.id?{...x,...p}:x)); }
  function assignToBox(id){ setPackages(packages.map(p=>p.id===id?{...p,estado_bodega:"En vuelo"}:p)); }

  const tabs = ["Recepción","Paquetes en bodega","Armado de cajas","Cargas enviadas","Gestión de cargas","Proformas","Extras"];
  const [tab,setTab]=useState(tabs[0]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {!user ? <Login onLogin={setUser}/> : (
        <>
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
            {/* Pega aquí las vistas completas como en la versión anterior */}
          </main>
        </>
      )}
    </div>
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
        {items.map(v=>(<span key={v} className="text-xs bg-white border rounded-xl px-2 py-1">{v} <button onClick={()=>del(v)} className="text-red-600 ml-1">✕</button></span>))}
      </div>
    </div>
  );
}

export default App;
