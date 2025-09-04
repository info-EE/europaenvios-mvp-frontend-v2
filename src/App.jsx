import React, { useMemo, useState } from "react";

// === MVP FRONTEND – 100% web ===
// Login simulado, recepción con validaciones, listado+export, armado de vuelo/cajas, proforma.
// Se conecta a una API real en el siguiente paso.

const COURIERS = [
  "Paraguay Box","Inflight Box","Caba Box","Fast Box","Click Box","Fixo Cargo",
  "Global Box","Home Box","Inter Courier CDE","MC Group","Royal Box",
  "Europa Envios","Punto Box","Santa Rita","CDE Box","Boss Box","Easy Box",
  "Frontliner","Royal Box (EN)","Miami Express","Wee Box","One Box","Red Cargo",
  "Buzon Courier","Royal Courier","Fox Box","Bubba Box","Metro Express","Aladín",
];

const ESTADOS = ["Aéreo","Marítimo","Ofrecer marítimo"];

const TARIFFS = { procesamiento_usd_kg: 5, flete_real_usd_kg: 9, flete_exceso_usd_kg: 9, despacho_usd_kg: 10 };

function canjeGuiaUSD(kg){ if(kg<=5) return 10; if(kg<=10) return 13.5; if(kg<=30) return 17; if(kg<=50) return 37; if(kg<=100) return 57; return 100; }
const toNumber = v => Number.isFinite(Number(v)) ? Number(v) : 0;

function downloadCSV(filename, rows){
  const esc=v=>{ if(v==null) return ""; const s=String(v); return /[\",\\n]/.test(s)?'"'+s.replace(/\"/g,'\"\"')+'"' : s; };
  const csv = rows.map(r=>r.map(esc).join(",")).join("\\n");
  const blob = new Blob(["\\ufeff"+csv], {type:"text/csv;charset=utf-8;"});
  const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}

function Section({ title, right, children }){
  return <div className="bg-white rounded-2xl shadow p-4 mb-6">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xl font-semibold">{title}</h2>{right}
    </div>{children}
  </div>;
}
function Field({ label, children, required }){
  return <label className="block mb-3"><span className="text-sm text-gray-700">{label}{required && <span className="text-red-500"> *</span>}</span><div className="mt-1">{children}</div></label>;
}
function Input(props){ return <input {...props} className={"w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 ring-indigo-500 "+(props.className||"")} />; }
function Select({ options, ...props }){ return <select {...props} className={"w-full rounded-xl border px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-indigo-500 "+(props.className||"")}>
  <option value="">Seleccionar…</option>
  {options.map(o=><option key={o} value={o}>{o}</option>)}
</select>; }
function Tabs({ tabs, current, onChange }){
  return <div className="flex gap-2 flex-wrap">
    {tabs.map(t=><button key={t} onClick={()=>onChange(t)} className={"px-3 py-2 rounded-xl text-sm "+(current===t?"bg-indigo-600 text-white shadow":"bg-white text-gray-700 border hover:bg-gray-50")}>{t}</button>)}
  </div>;
}

function Login({ onLogin }){
  const [email,setEmail]=useState(""); const [role,setRole]=useState("COURIER"); const [courier,setCourier]=useState("");
  const canSubmit = email && role && (role==="ADMIN" || courier);
  return <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md">
      <h1 className="text-2xl font-semibold mb-4">Acceso al sistema</h1>
      <Field label="Email" required><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@empresa.com" /></Field>
      <Field label="Rol" required><Select value={role} onChange={e=>setRole(e.target.value)} options={["ADMIN","COURIER"]} /></Field>
      {role==="COURIER" && <Field label="Courier" required><Select value={courier} onChange={e=>setCourier(e.target.value)} options={COURIERS} /></Field>}
      <button onClick={()=>onLogin({ email, role, courier: role==="ADMIN"?null:courier })} disabled={!canSubmit} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 disabled:opacity-50">Entrar</button>
    </div>
  </div>;
}

function ReceptionForm({ currentUser, onAdd }){
  const [form,setForm]=useState({
    courier: currentUser.role==="COURIER"?currentUser.courier:"",
    estado:"", casilla:"", codigo:"", fecha:new Date().toISOString().slice(0,10),
    empresa_envio:"", nombre_apellido:"", tracking:"", remitente:"",
    peso_real:"", largo:"", ancho:"", alto:"", descripcion:"", valor_aerolinea:"0",
  });
  const pesoReal=toNumber(form.peso_real), largo=toNumber(form.largo), ancho=toNumber(form.ancho), alto=toNumber(form.alto);
  const pesoFacturable = useMemo(()=> pesoReal ? Math.max(0.2, Number(pesoReal)) : 0.2, [pesoReal]);
  const pesoVol = useMemo(()=> (ancho&&alto&&largo)?(ancho*alto*largo)/5000:0, [ancho,alto,largo]);
  const exceso = Math.max(0, pesoVol - pesoFacturable);
  const allRequired = Object.entries({
    courier:form.courier, estado:form.estado, casilla:form.casilla, codigo:form.codigo, fecha:form.fecha,
    empresa_envio:form.empresa_envio, nombre_apellido:form.nombre_apellido, tracking:form.tracking, remitente:form.remitente,
    peso_real:form.peso_real, largo:form.largo, ancho:form.ancho, alto:form.alto, descripcion:form.descripcion, valor_aerolinea:form.valor_aerolinea,
  }).every(([_,v])=>String(v).trim()!=="");

  function submit(){
    if(!allRequired) return;
    const pkg = {
      ...form,
      peso_real:Number(form.peso_real), largo:Number(form.largo), ancho:Number(form.ancho), alto:Number(form.alto),
      valor_aerolinea:Number(form.valor_aerolinea),
      peso_facturable:Number(pesoFacturable.toFixed(3)), peso_volumetrico:Number(pesoVol.toFixed(3)), exceso_volumen:Number(exceso.toFixed(3)),
      id: crypto.randomUUID(), created_at: new Date().toISOString(), estado_bodega:"En bodega",
    };
    onAdd(pkg);
    setForm({ courier: currentUser.role==="COURIER"?currentUser.courier:"", estado:"", casilla:"", codigo:"", fecha:new Date().toISOString().slice(0,10),
      empresa_envio:"", nombre_apellido:"", tracking:"", remitente:"", peso_real:"", largo:"", ancho:"", alto:"", descripcion:"", valor_aerolinea:"0" });
  }

  return <Section title="Recepción de paquete" right={<span className="text-sm text-gray-500">Todos los campos son obligatorios</span>}>
    <div className="grid md:grid-cols-3 gap-4">
      <Field label="Courier" required><Select value={form.courier} onChange={e=>setForm({...form, courier:e.target.value})} options={COURIERS} disabled={currentUser.role==="COURIER"} /></Field>
      <Field label="Estado" required><Select value={form.estado} onChange={e=>setForm({...form, estado:e.target.value})} options={ESTADOS} /></Field>
      <Field label="Casilla" required><Input value={form.casilla} onChange={e=>setForm({...form, casilla:e.target.value})} placeholder="GB M689" /></Field>
      <Field label="Nº de paquete (código)" required><Input value={form.codigo} onChange={e=>setForm({...form, codigo:e.target.value.toUpperCase()})} placeholder="GBM187" onKeyDown={e=>{ if(e.key==="Enter"){ const el = document.getElementById("tracking"); if(el) el.focus(); }}} /></Field>
      <Field label="Fecha" required><Input type="date" value={form.fecha} onChange={e=>setForm({...form, fecha:e.target.value})} /></Field>
      <Field label="Empresa de envío" required><Input value={form.empresa_envio} onChange={e=>setForm({...form, empresa_envio:e.target.value})} /></Field>
      <Field label="Nombre y apellido" required><Input value={form.nombre_apellido} onChange={e=>setForm({...form, nombre_apellido:e.target.value})} /></Field>
      <Field label="Tracking" required><Input id="tracking" value={form.tracking} onChange={e=>setForm({...form, tracking:e.target.value})} /></Field>
      <Field label="Remitente" required><Input value={form.remitente} onChange={e=>setForm({...form, remitente:e.target.value})} /></Field>
      <Field label="Peso real (kg)" required><Input type="number" step="0.001" value={form.peso_real} onChange={e=>setForm({...form, peso_real:e.target.value})} /></Field>
      <Field label="Largo (cm)" required><Input type="number" step="0.1" value={form.largo} onChange={e=>setForm({...form, largo:e.target.value})} /></Field>
      <Field label="Ancho (cm)" required><Input type="number" step="0.1" value={form.ancho} onChange={e=>setForm({...form, ancho:e.target.value})} /></Field>
      <Field label="Alto (cm)" required><Input type="number" step="0.1" value={form.alto} onChange={e=>setForm({...form, alto:e.target.value})} /></Field>
      <Field label="Descripción" required><Input value={form.descripcion} onChange={e=>setForm({...form, descripcion:e.target.value})} /></Field>
      <Field label="Valor declarado (aerolínea) USD" required><Input type="number" step="0.01" value={form.valor_aerolinea} onChange={e=>setForm({...form, valor_aerolinea:e.target.value})} /></Field>
    </div>
    <div className="grid md:grid-cols-3 gap-4 mt-4">
      <div className="bg-gray-50 rounded-xl p-3"><div className="text-sm text-gray-600">Peso facturable (mín 0,200 kg)</div><div className="text-2xl font-semibold">{pesoFacturable.toFixed(3)} kg</div></div>
      <div className="bg-gray-50 rounded-xl p-3"><div className="text-sm text-gray-600">Peso volumétrico (A×H×L / 5000)</div><div className="text-2xl font-semibold">{pesoVol.toFixed(3)} kg</div></div>
      <div className="bg-gray-50 rounded-xl p-3"><div className="text-sm text-gray-600">Exceso de volumen</div><div className="text-2xl font-semibold">{exceso.toFixed(3)} kg</div></div>
    </div>
    <div className="flex justify-end mt-4">
      <button onClick={submit} disabled={!allRequired} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50">Guardar paquete</button>
    </div>
  </Section>;
}

function PackagesList({ data, currentUser }){
  const [q,setQ]=useState(""), [estado,setEstado]=useState("");
  const rows = data.filter(p=>{
    if(currentUser.role==="COURIER" && p.courier!==currentUser.courier) return false;
    if(estado && p.estado!==estado) return false;
    const text=(p.codigo+p.tracking+p.casilla+p.nombre_apellido+p.courier).toLowerCase();
    return text.includes(q.toLowerCase());
  });
  function exportCSV(){
    const header=[
      "Courier","Estado","Casilla","Código","Fecha","Empresa de envío","Nombre y apellido","Tracking","Remitente",
      "Peso real","Peso facturable","Largo","Ancho","Alto","Peso volumétrico","Exceso volumen","Descripción","Valor aerolínea (USD)","Estado bodega"
    ];
    const body = rows.map(p=>[p.courier,p.estado,p.casilla,p.codigo,p.fecha,p.empresa_envio,p.nombre_apellido,p.tracking,p.remitente,
      p.peso_real,p.peso_facturable,p.largo,p.ancho,p.alto,p.peso_volumetrico,p.exceso_volumen,p.descripcion,p.valor_aerolinea,p.estado_bodega]);
    downloadCSV("paquetes.csv",[header,...body]);
  }
  return <Section title="Paquetes en bodega" right={<div className="flex gap-2">
      <Select value={estado} onChange={e=>setEstado(e.target.value)} options={["",...ESTADOS]} />
      <Input placeholder="Buscar…" value={q} onChange={e=>setQ(e.target.value)} />
      <button onClick={exportCSV} className="px-3 py-2 bg-gray-800 text-white rounded-xl">Exportar CSV</button>
    </div>}>
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead><tr className="bg-gray-50">{["Courier","Estado","Casilla","Código","Fecha","Nombre","Tracking","Peso real","Facturable","Volumétrico","Exceso","Valor (USD)","Bodega"].map(h=><th key={h} className="text-left px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map(p=>(<tr key={p.id} className="border-b">
            <td className="px-3 py-2 whitespace-nowrap">{p.courier}</td>
            <td className="px-3 py-2 whitespace-nowrap">{p.estado}</td>
            <td className="px-3 py-2 whitespace-nowrap">{p.casilla}</td>
            <td className="px-3 py-2 whitespace-nowrap font-mono">{p.codigo}</td>
            <td className="px-3 py-2 whitespace-nowrap">{p.fecha}</td>
            <td className="px-3 py-2 whitespace-nowrap">{p.nombre_apellido}</td>
            <td className="px-3 py-2 whitespace-nowrap font-mono">{p.tracking}</td>
            <td className="px-3 py-2 whitespace-nowrap">{p.peso_real.toFixed(3)}</td>
            <td className="px-3 py-2 whitespace-nowrap">{p.peso_facturable.toFixed(3)}</td>
            <td className="px-3 py-2 whitespace-nowrap">{p.peso_volumetrico.toFixed(3)}</td>
            <td className="px-3 py-2 whitespace-nowrap">{p.exceso_volumen.toFixed(3)}</td>
            <td className="px-3 py-2 whitespace-nowrap">{p.valor_aerolinea.toFixed(2)}</td>
            <td className="px-3 py-2 whitespace-nowrap">{p.estado_bodega}</td>
          </tr>))}
          {rows.length===0 && <tr><td colSpan={13} className="text-center text-gray-500 py-6">No hay resultados.</td></tr>}
        </tbody>
      </table>
    </div>
  </Section>;
}

function Flights({ packages, onAssign, flights, setFlights }){
  const [code,setCode]=useState(""), [boxCode,setBoxCode]=useState(""), [scan,setScan]=useState(""), [currentFlight,setCurrentFlight]=useState("");
  function createFlight(){ if(!code) return; const id=crypto.randomUUID(); setFlights([...flights,{id,codigo:code,fecha_salida:new Date().toISOString().slice(0,10),cajas:[]}]); setCurrentFlight(id); setCode(""); }
  function addBox(){ if(!currentFlight||!boxCode) return; setFlights(flights.map(f=>f.id===currentFlight?{...f,cajas:[...f.cajas,{id:crypto.randomUUID(),codigo:boxCode,paquetes:[]}]}:f)); setBoxCode(""); }
  function assignByScan(){
    if(!scan||!currentFlight) return;
    const flight = flights.find(f=>f.id===currentFlight); if(!flight||flight.cajas.length===0) return;
    const box = flight.cajas[flight.cajas.length-1];
    const pkg = packages.find(p=>p.codigo.toUpperCase()===scan.toUpperCase());
    if(!pkg){ alert("Paquete no encontrado en bodega"); setScan(""); return; }
    const already = flights.some(f=>f.cajas.some(c=>c.paquetes.includes(pkg.id))); if(already){ alert("Ese paquete ya fue asignado a una caja"); setScan(""); return; }
    const updated = flights.map(f=> f.id!==currentFlight?f:{...f,cajas:f.cajas.map((c,i)=> i===f.cajas.length-1?{...c,paquetes:[...c.paquetes,pkg.id]}:c)});
    setFlights(updated); onAssign(pkg.id); setScan("");
  }
  function exportManifest(){
    const flight = flights.find(f=>f.id===currentFlight); if(!flight) return;
    const rows = [["Caja","Código paquete","Courier","Peso real","Facturable","Volumétrico","Exceso","Valor (USD)"]];
    flight.cajas.forEach(caja=>{ caja.paquetes.forEach(pid=>{ const p=packages.find(x=>x.id===pid); if(!p) return; rows.push([caja.codigo,p.codigo,p.courier,p.peso_real,p.peso_facturable,p.peso_volumetrico,p.exceso_volumen,p.valor_aerolinea]); }); });
    downloadCSV(`manifiesto_${flight.codigo}.csv`, rows);
  }
  return <Section title="Armado de vuelo" right={<div className="flex gap-2 items-center">
      <Input placeholder="Código de vuelo (ej. EE-001)" value={code} onChange={e=>setCode(e.target.value)} />
      <button onClick={createFlight} className="px-3 py-2 bg-indigo-600 text-white rounded-xl">Crear vuelo</button>
    </div>}>
    <div className="grid md:grid-cols-3 gap-4">
      <div className="md:col-span-1">
        <Field label="Seleccionar vuelo" required>
          <select className="w-full rounded-xl border px-3 py-2" value={currentFlight} onChange={e=>setCurrentFlight(e.target.value)}>
            <option value="">—</option>{flights.map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
          </select>
        </Field>
        <Field label="Crear caja (código)" required>
          <div className="flex gap-2"><Input placeholder="Caja-01" value={boxCode} onChange={e=>setBoxCode(e.target.value)} /><button onClick={addBox} className="px-3 py-2 bg-gray-800 text-white rounded-xl">Agregar</button></div>
        </Field>
        <Field label="Escanear / ingresar código de paquete" required>
          <Input value={scan} onChange={e=>setScan(e.target.value.toUpperCase())} onKeyDown={e=> e.key==="Enter" && assignByScan()} placeholder="GBM187" autoFocus />
        </Field>
        <button onClick={exportManifest} className="px-3 py-2 bg-emerald-600 text-white rounded-xl">Exportar manifiesto CSV</button>
      </div>
      <div className="md:col-span-2">
        <div className="space-y-4">
          {flights.map(f=>(<div key={f.id} className={`rounded-xl border ${f.id===currentFlight?"ring-2 ring-indigo-500":""}`}>
            <div className="px-3 py-2 bg-gray-50 rounded-t-xl flex justify-between"><div className="font-medium">Vuelo {f.codigo} · {f.fecha_salida}</div><div className="text-sm text-gray-600">Cajas: {f.cajas.length}</div></div>
            <div className="p-3 grid md:grid-cols-2 gap-3">
              {f.cajas.map(c=>(<div key={c.id} className="border rounded-xl p-3"><div className="font-medium mb-2">Caja {c.codigo}</div>
                <ul className="text-sm max-h-48 overflow-auto">
                  {c.paquetes.map(pid=>{ const p=packages.find(x=>x.id===pid); return <li key={pid} className="flex justify-between border-b py-1"><span className="font-mono">{p?.codigo}</span><span className="text-gray-600">{p?.peso_real.toFixed(2)} kg</span></li>; })}
                  {c.paquetes.length===0 && <li className="text-gray-500">—</li>}
                </ul></div>))}
              {f.cajas.length===0 && <div className="text-gray-500 p-3">Aún no hay cajas.</div>}
            </div>
          </div>))}
          {flights.length===0 && <div className="text-gray-500">Crea un vuelo para comenzar.</div>}
        </div>
      </div>
    </div>
  </Section>;
}

function Proforma({ packages, flights }){
  const [flightId,setFlightId]=useState(""); const flight = flights.find(f=>f.id===flightId);
  const dataByCourier = useMemo(()=>{
    if(!flight) return [];
    const map=new Map();
    flight.cajas.forEach(c=>{ c.paquetes.forEach(pid=>{ const p=packages.find(x=>x.id===pid); if(!p) return;
      if(!map.has(p.courier)) map.set(p.courier,{courier:p.courier,kg_real:0,kg_facturable:0,kg_exceso:0,bultos:0});
      const agg=map.get(p.courier); agg.kg_real+=p.peso_real; agg.kg_facturable+=p.peso_facturable; agg.kg_exceso+=p.exceso_volumen; agg.bultos+=1;
    });});
    return Array.from(map.values());
  },[flight,packages]);
  function exportProformas(){
    const rows=[[ "Courier","Bultos","Kg real","Kg facturable","Kg exceso","Procesamiento","Flete real","Flete exceso","Despacho","Canje guía","Extras (USD)","Comisión transf (4%)","TOTAL USD" ]];
    dataByCourier.forEach(r=>{
      const procesamiento=r.kg_facturable*TARIFFS.procesamiento_usd_kg, fleteReal=r.kg_real*TARIFFS.flete_real_usd_kg, fleteExceso=r.kg_exceso*TARIFFS.flete_exceso_usd_kg, despacho=r.kg_facturable*TARIFFS.despacho_usd_kg;
      const canje=canjeGuiaUSD(r.kg_facturable), extras=0, comision=0.04*(procesamiento+fleteReal+fleteExceso+extras);
      const total=procesamiento+fleteReal+fleteExceso+despacho+canje+extras+comision;
      rows.push([ r.courier, r.bultos, r.kg_real.toFixed(3), r.kg_facturable.toFixed(3), r.kg_exceso.toFixed(3), procesamiento.toFixed(2), fleteReal.toFixed(2), fleteExceso.toFixed(2), despacho.toFixed(2), canje.toFixed(2), extras.toFixed(2), comision.toFixed(2), total.toFixed(2) ]);
    });
    downloadCSV(`proformas_${flight?.codigo || "vuelo"}.csv`, rows);
  }
  return <Section title="Proformas por courier" right={<div className="flex gap-2 items-center">
      <select className="rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
        <option value="">Seleccionar vuelo…</option>{flights.map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
      </select>
      <button onClick={exportProformas} disabled={!flight} className="px-3 py-2 bg-emerald-600 text-white rounded-xl disabled:opacity-50">Exportar CSV</button>
    </div>}>
    {!flight && <div className="text-gray-500">Selecciona un vuelo para ver el cálculo.</div>}
    {flight && <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead><tr className="bg-gray-50">{["Courier","Bultos","Kg real","Kg facturable","Kg exceso","Procesamiento","Flete real","Flete exceso","Despacho","Canje guía","Extras","Comisión 4%","TOTAL USD"].map(h=><th key={h} className="text-left px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>
          {dataByCourier.map(r=>{
            const procesamiento=r.kg_facturable*TARIFFS.procesamiento_usd_kg, fleteReal=r.kg_real*TARIFFS.flete_real_usd_kg, fleteExceso=r.kg_exceso*TARIFFS.flete_exceso_usd_kg, despacho=r.kg_facturable*TARIFFS.despacho_usd_kg;
            const canje=canjeGuiaUSD(r.kg_facturable), extras=0, comision=0.04*(procesamiento+fleteReal+fleteExceso+extras);
            const total=procesamiento+fleteReal+fleteExceso+despacho+canje+extras+comision;
            return (<tr key={r.courier} className="border-b">
              <td className="px-3 py-2 whitespace-nowrap">{r.courier}</td>
              <td className="px-3 py-2 whitespace-nowrap">{r.bultos}</td>
              <td className="px-3 py-2 whitespace-nowrap">{r.kg_real.toFixed(3)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{r.kg_facturable.toFixed(3)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{r.kg_exceso.toFixed(3)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{procesamiento.toFixed(2)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{fleteReal.toFixed(2)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{fleteExceso.toFixed(2)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{despacho.toFixed(2)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{canje.toFixed(2)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{extras.toFixed(2)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{comision.toFixed(2)}</td>
              <td className="px-3 py-2 whitespace-nowrap font-semibold">{total.toFixed(2)}</td>
            </tr>);
          })}
          {dataByCourier.length===0 && <tr><td colSpan={13} className="text-center text-gray-500 py-6">No hay datos para este vuelo.</td></tr>}
        </tbody>
      </table>
    </div>}
  </Section>;
}

export default function App(){
  const [user,setUser]=useState(null); const [packages,setPackages]=useState([]); const [flights,setFlights]=useState([]); const [tab,setTab]=useState("Recepción");
  function addPackage(p){ const dup=packages.find(x=>x.codigo===p.codigo && x.courier===p.courier); if(dup){ alert("Ya existe un paquete con ese código para este courier."); return; } setPackages([p, ...packages]); }
  function assignToBox(id){ setPackages(packages.map(p=>p.id===id?{...p, estado_bodega:"En vuelo"}:p)); }
  if(!user) return <Login onLogin={setUser} />;
  const tabs = ["Recepción","Paquetes","Vuelos","Proformas"];
  return <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
    <header className="bg-white border-b sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-indigo-600" /><div><div className="font-semibold">Gestor de Paquetes</div><div className="text-xs text-gray-500">LaMaquinaLogistica / Europa Envíos</div></div></div>
        <div className="text-sm text-gray-600">{user.role} {user.courier?`· ${user.courier}`:""} — {user.email}</div>
      </div>
    </header>
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-4"><Tabs tabs={tabs} current={tab} onChange={setTab} /></div>
      {tab==="Recepción" && <ReceptionForm currentUser={user} onAdd={addPackage} />}
      {tab==="Paquetes" && <PackagesList data={packages} currentUser={user} />}
      {tab==="Vuelos" && <Flights packages={packages} flights={flights} setFlights={setFlights} onAssign={assignToBox} />}
      {tab==="Proformas" && <Proforma packages={packages} flights={flights} />}
    </main>
  </div>;
}
