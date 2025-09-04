import React, { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import * as XLSX from "xlsx";

// === MVP FRONTEND – versión 2 con cambios solicitados ===
// - Recepción: agregar courier/estado desde el desplegable; casilla sin placeholder; valor aerolínea (EUR)
// - Paquetes: exportar a XLSX; gráfico por courier + totales (kg reales / exceso)
// - Vuelos: exportar a XLSX; editar cajas (quitar/mover); peso y medidas de caja; resumen tipo planilla; volumétrico de caja = A*H*L/6000
// - Proformas: exportar XLSX por courier; pestaña Extras para asociar cargos por courier+vuelo

const COURIERS_INIT = [
  "Paraguay Box","Inflight Box","Caba Box","Fast Box","Click Box","Fixo Cargo",
  "Global Box","Home Box","Inter Courier CDE","MC Group","Royal Box",
  "Europa Envios","Punto Box","Santa Rita","CDE Box","Boss Box","Easy Box",
  "Frontliner","Royal Box (EN)","Miami Express","Wee Box","One Box","Red Cargo",
  "Buzon Courier","Royal Courier","Fox Box","Bubba Box","Metro Express","Aladín"
];

const ESTADOS_INIT = ["Aéreo", "Marítimo", "Ofrecer marítimo"];

const TARIFFS = { procesamiento_usd_kg: 5, flete_real_usd_kg: 9, flete_exceso_usd_kg: 9, despacho_usd_kg: 10 };

function canjeGuiaUSD(kg){ if(kg<=5) return 10; if(kg<=10) return 13.5; if(kg<=30) return 17; if(kg<=50) return 37; if(kg<=100) return 57; return 100; }
const toNumber = v => Number.isFinite(Number(v)) ? Number(v) : 0;

// Utilidades
function xlsxDownload(filename, sheets){
  const wb = XLSX.utils.book_new();
  sheets.forEach(({name, rows})=>{
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0,31));
  });
  XLSX.writeFile(wb, filename);
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
function Select({ options, value, onChange, allowAdd, placeholder="Seleccionar…", disabled }){
  return <div className="flex gap-2"> 
    <select value={value} onChange={onChange} disabled={disabled}
      className={"w-full rounded-xl border px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-indigo-500"}>
      <option value="">{placeholder}</option>
      {options.map(o=> <option key={o} value={o}>{o}</option>)}
      {allowAdd && <option value="__add__">➕ Añadir nuevo…</option>}
    </select>
  </div>;
}
function Tabs({ tabs, current, onChange }){
  return <div className="flex gap-2 flex-wrap">
    {tabs.map(t=> <button key={t} onClick={()=>onChange(t)} className={"px-3 py-2 rounded-xl text-sm "+(current===t?"bg-indigo-600 text-white shadow":"bg-white text-gray-700 border hover:bg-gray-50")}>{t}</button>)}
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
      {role==="COURIER" && <Field label="Courier" required><Input value={courier} onChange={e=>setCourier(e.target.value)} placeholder="Escribe tu courier"/></Field>}
      <button onClick={()=>onLogin({ email, role, courier: role==="ADMIN"?null:courier })} disabled={!canSubmit} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 disabled:opacity-50">Entrar</button>
    </div>
  </div>;
}

function ReceptionForm({ currentUser, onAdd, couriers, setCouriers, estados, setEstados }){
  const [form,setForm]=useState({
    courier: currentUser.role==="COURIER"?currentUser.courier:"",
    estado:"", casilla:"", codigo:"", fecha:new Date().toISOString().slice(0,10),
    empresa_envio:"", nombre_apellido:"", tracking:"", remitente:"",
    peso_real:"", largo:"", ancho:"", alto:"", descripcion:"", valor_aerolinea:"0",
  });

  function handleCourierChange(e){
    const v = e.target.value;
    if(v === "__add__"){
      const name = prompt("Nombre del nuevo courier");
      if(name && !couriers.includes(name)) setCouriers([...couriers, name]);
      return;
    }
    setForm({...form, courier:v});
  }
  function handleEstadoChange(e){
    const v = e.target.value;
    if(v === "__add__"){
      const name = prompt("Nuevo estado");
      if(name && !estados.includes(name)) setEstados([...estados, name]);
      return;
    }
    setForm({...form, estado:v});
  }

  const pesoReal=toNumber(form.peso_real), largo=toNumber(form.largo), ancho=toNumber(form.ancho), alto=toNumber(form.alto);
  const pesoFacturable = useMemo(()=> pesoReal ? Math.max(0.2, Number(pesoReal)) : 0.2, [pesoReal]);
  const pesoVol = useMemo(()=> (ancho&&alto&&largo)?(ancho*alto*largo)/5000:0, [ancho,alto,largo]);
  const exceso = Math.max(0, pesoVol - pesoFacturable);
  const allRequired = Object.entries({
    courier:form.courier, estado:form.estado, casilla:form.casilla, codigo:form.codigo, fecha:form.fecha,
    empresa_envio:form.empresa_envio, nombre_apellido:form.nombre_apellido, tracking:form.tracking, remitente:form.remitente,
    peso_real:form.peso_real, largo:form.largo, ancho:form.ancho, alto:form.alto, descripcion:form.descripcion, valor_aerolinea:form.valor_aerolinea,
  }).every(([_,v])=>String(v).trim()!=='');

  function submit(){
    if(!allRequired) return;
    const pkg = {
      ...form,
      peso_real:Number(form.peso_real), largo:Number(form.largo), ancho:Number(form.ancho), alto:Number(form.alto),
      valor_aerolinea:Number(form.valor_aerolinea), // EUR
      peso_facturable:Number(pesoFacturable.toFixed(3)), peso_volumetrico:Number(pesoVol.toFixed(3)), exceso_volumen:Number(exceso.toFixed(3)),
      id: crypto.randomUUID(), created_at: new Date().toISOString(), estado_bodega:"En bodega",
    };
    onAdd(pkg);
    setForm({ courier: currentUser.role==="COURIER"?currentUser.courier:"", estado:"", casilla:"", codigo:"", fecha:new Date().toISOString().slice(0,10), empresa_envio:"", nombre_apellido:"", tracking:"", remitente:"", peso_real:"", largo:"", ancho:"", alto:"", descripcion:"", valor_aerolinea:"0" });
  }

  return <Section title="Recepción de paquete" right={<span className="text-sm text-gray-500">Todos los campos son obligatorios</span>}>
    <div className="grid md:grid-cols-3 gap-4">
      <Field label="Courier" required>
        <Select value={form.courier} onChange={handleCourierChange} options={couriers} allowAdd={!currentUser.courier} disabled={currentUser.role==="COURIER"} />
      </Field>
      <Field label="Estado" required>
        <Select value={form.estado} onChange={handleEstadoChange} options={estados} allowAdd />
      </Field>
      <Field label="Casilla" required>
        <Input value={form.casilla} onChange={e=>setForm({...form, casilla:e.target.value})} placeholder="" />
      </Field>
      <Field label="Nº de paquete (código)" required>
        <Input value={form.codigo} onChange={e=>setForm({...form, codigo:e.target.value.toUpperCase()})} placeholder="GBM187" onKeyDown={e=>{ if(e.key==="Enter"){ const el = document.getElementById("tracking"); if(el) el.focus(); }}} />
      </Field>
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
      <Field label="Valor declarado (aerolínea) (EUR)" required><Input type="number" step="0.01" value={form.valor_aerolinea} onChange={e=>setForm({...form, valor_aerolinea:e.target.value})} /></Field>
    </div>
    <div className="grid md:grid-cols-3 gap-4 mt-4">
      <div className="bg-gray-50 rounded-xl p-3"><div className="text-sm text-gray-600">Peso facturable (mín 0,200 kg)</div><div className="text-2xl font-semibold">{pesoFacturable.toFixed(3)} kg</div></div>
      <div className="bg-gray-50 rounded-xl p-3"><div className="text-sm text-gray-600">Peso volumétrico (A×H×L / 5000)</div><div className="text-2xl font-semibold">{pesoVol.toFixed(3)} kg</div></div>
      <div className="bg-gray-50 rounded-xl p-3"><div className="text-sm text-gray-600">Exceso de volumen</div><div className="text-2xl font-semibold">{exceso.toFixed(3)} kg</div></div>
    </div>
    <div className="flex justify-end mt-4"><button onClick={submit} disabled={!allRequired} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50">Guardar paquete</button></div>
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

  // Totales por courier para gráfico
  const agg = useMemo(()=>{
    const m = new Map();
    rows.forEach(p=>{
      if(!m.has(p.courier)) m.set(p.courier,{courier:p.courier, kg_real:0, kg_exceso:0});
      const a = m.get(p.courier); a.kg_real+=p.peso_real; a.kg_exceso+=p.exceso_volumen;
    });
    return Array.from(m.values());
  },[rows]);

  const totReal = agg.reduce((s,a)=>s+a.kg_real,0);
  const totExceso = agg.reduce((s,a)=>s+a.kg_exceso,0);

  function exportXLSX(){
    const header=["Courier","Estado","Casilla","Código","Fecha","Empresa de envío","Nombre y apellido","Tracking","Remitente","Peso real","Peso facturable","Largo","Ancho","Alto","Peso volumétrico","Exceso volumen","Descripción","Valor aerolínea (EUR)","Estado bodega"];
    const body = rows.map(p=>[p.courier,p.estado,p.casilla,p.codigo,p.fecha,p.empresa_envio,p.nombre_apellido,p.tracking,p.remitente,p.peso_real,p.peso_facturable,p.largo,p.ancho,p.alto,p.peso_volumetrico,p.exceso_volumen,p.descripcion,p.valor_aerolinea,p.estado_bodega]);
    const resumen=[ ["Courier","Kg real","Kg exceso"], ...agg.map(a=>[a.courier, a.kg_real, a.kg_exceso]), ["TOTAL", totReal, totExceso] ];
    xlsxDownload("paquetes.xlsx", [ {name:"Paquetes", rows:[header, ...body]}, {name:"Resumen", rows: resumen} ]);
  }

  return <Section title="Paquetes en bodega" right={<div className="flex gap-2">
      <Input placeholder="Buscar…" value={q} onChange={e=>setQ(e.target.value)} />
      <button onClick={exportXLSX} className="px-3 py-2 bg-gray-800 text-white rounded-xl">Exportar XLSX</button>
    </div>}>
    <div className="overflow-auto mb-6">
      <table className="min-w-full text-sm">
        <thead><tr className="bg-gray-50">{["Courier","Estado","Casilla","Código","Fecha","Nombre","Tracking","Peso real","Facturable","Volumétrico","Exceso","Valor (EUR)","Bodega"].map(h=> <th key={h} className="text-left px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map(p=> (<tr key={p.id} className="border-b">
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
    <div className="grid md:grid-cols-3 gap-4 items-start">
      <div className="bg-gray-50 rounded-xl p-3"><div className="text-sm text-gray-600">Total kg reales</div><div className="text-2xl font-semibold">{totReal.toFixed(3)}</div></div>
      <div className="bg-gray-50 rounded-xl p-3"><div className="text-sm text-gray-600">Total exceso volumétrico</div><div className="text-2xl font-semibold">{totExceso.toFixed(3)}</div></div>
      <div className="h-56 md:col-span-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={agg}>
            <XAxis dataKey="courier" hide/>
            <YAxis/>
            <Tooltip/>
            <Legend/>
            <Bar dataKey="kg_real" name="Kg reales" />
            <Bar dataKey="kg_exceso" name="Exceso" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </Section>;
}

function Flights({ packages, onAssign, flights, setFlights }){
  const [code,setCode]=useState(""), [scan,setScan]=useState(""), [currentFlight,setCurrentFlight]=useState("");
  const [boxCode,setBoxCode]=useState("");

  function createFlight(){ if(!code) return; const id=crypto.randomUUID(); setFlights([...flights,{id,codigo:code,fecha_salida:new Date().toISOString().slice(0,10),cajas:[]}]); setCurrentFlight(id); setCode(""); }
  function addBox(){ if(!currentFlight||!boxCode) return; setFlights(flights.map(f=>f.id===currentFlight?{...f,cajas:[...f.cajas,{id:crypto.randomUUID(),codigo:boxCode,paquetes:[],peso_caja_kg:"",largo:"",ancho:"",alto:""}]}:f)); setBoxCode(""); }

  function assignByScan(){
    if(!scan||!currentFlight) return; const flight = flights.find(f=>f.id===currentFlight); if(!flight||flight.cajas.length===0) return;
    const activeIdx = flight.cajas.length-1; const pkg = packages.find(p=>p.codigo.toUpperCase()===scan.toUpperCase());
    if(!pkg){ alert("Paquete no encontrado en bodega"); setScan(""); return; }
    const already = flights.some(f=>f.cajas.some(c=>c.paquetes.includes(pkg.id))); if(already){ alert("Ese paquete ya fue asignado a una caja"); setScan(""); return; }
    const updated = flights.map(f=> f.id!==currentFlight?f:{...f,cajas:f.cajas.map((c,i)=> i===activeIdx?{...c,paquetes:[...c.paquetes,pkg.id]}:c)});
    setFlights(updated); onAssign(pkg.id); setScan("");
  }

  function removeFromBox(fId, cId, pid){
    setFlights(flights.map(f=> f.id!==fId?f:{...f,cajas:f.cajas.map(c=> c.id!==cId?c:{...c, paquetes:c.paquetes.filter(x=>x!==pid)})}));
  }
  function moveToBox(fId, fromId, toId, pid){
    if(fromId===toId) return; removeFromBox(fId, fromId, pid);
    setFlights(prev=> prev.map(f=> f.id!==fId?f:{...f,cajas:f.cajas.map(c=> c.id!==toId?c:{...c, paquetes:[...c.paquetes, pid]})}));
  }

  function updateBoxMeta(fId,cId,field,value){
    setFlights(flights.map(f=> f.id!==fId?f:{...f,cajas:f.cajas.map(c=> c.id!==cId?c:{...c,[field]:value})}));
  }

  function boxCourierLabel(caja){
    const couriers = new Set(caja.paquetes.map(pid=> packages.find(p=>p.id===pid)?.courier).filter(Boolean));
    if(couriers.size===1) return Array.from(couriers)[0];
    if(couriers.size>1) return "MULTICOURIER";
    return "—";
  }

  function boxVolumetric(caja){ // A*H*L / 6000
    const L=toNumber(caja.largo), A=toNumber(caja.alto), An=toNumber(caja.ancho);
    if(!(L&&A&&An)) return 0; return (An*A*L)/6000;
  }

  function exportManifest(){
    const flight = flights.find(f=>f.id===currentFlight); if(!flight) return;
    const rows = [["N° Caja","Courier","Peso caja (kg)","Largo","Ancho","Alto","Peso volumétrico (caja)","Código paquete","Courier (paquete)","Peso real","Facturable","Volumétrico","Exceso","Valor (EUR)"]];
    const resumen = [["N° Caja","Courier","Peso (kg)","Largo","Ancho","Alto","Peso volumétrico"]];

    flight.cajas.forEach((caja, idx)=>{
      const label = boxCourierLabel(caja);
      const volC = boxVolumetric(caja);
      let pesoCaja = toNumber(caja.peso_caja_kg) || 0;
      // filas de detalle por paquete
      caja.paquetes.forEach(pid=>{
        const p = packages.find(x=>x.id===pid); if(!p) return;
        rows.push([idx+1,label,pesoCaja,caja.largo,caja.ancho,caja.alto,volC,p.codigo,p.courier,p.peso_real,p.peso_facturable,p.peso_volumetrico,p.exceso_volumen,p.valor_aerolinea]);
      });
      // resumen por caja (usa peso caja manual)
      resumen.push([idx+1, label, pesoCaja, caja.largo, caja.ancho, caja.alto, volC]);
    });

    xlsxDownload(`manifiesto_${flight.codigo}.xlsx`, [ {name:"Detalle", rows}, {name:"Resumen", rows: resumen} ]);
  }

  return <Section title="Armado de vuelo" right={<div className="flex gap-2 items-center">
      <Input placeholder="Código de vuelo (ej. EE-001)" value={code} onChange={e=>setCode(e.target.value)} />
      <button onClick={createFlight} className="px-3 py-2 bg-indigo-600 text-white rounded-xl">Crear vuelo</button>
    </div>}>
    <div className="grid md:grid-cols-3 gap-4">
      <div className="md:col-span-1">
        <Field label="Seleccionar vuelo" required>
          <select className="w-full rounded-xl border px-3 py-2" value={currentFlight} onChange={e=>setCurrentFlight(e.target.value)}>
            <option value="">—</option>{flights.map(f=> <option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
          </select>
        </Field>
        <Field label="Crear caja (código)" required>
          <div className="flex gap-2"><Input placeholder="Caja-01" value={boxCode} onChange={e=>setBoxCode(e.target.value)} /><button onClick={addBox} className="px-3 py-2 bg-gray-800 text-white rounded-xl">Agregar</button></div>
        </Field>
        <Field label="Escanear / ingresar código de paquete" required>
          <Input value={scan} onChange={e=>setScan(e.target.value.toUpperCase())} onKeyDown={e=> e.key==="Enter" && assignByScan()} placeholder="GBM187" autoFocus />
        </Field>
        <button onClick={exportManifest} className="px-3 py-2 bg-emerald-600 text-white rounded-xl">Exportar manifiesto XLSX</button>
      </div>
      <div className="md:col-span-2">
        <div className="space-y-4">
          {flights.map(f=> (
            <div key={f.id} className={`rounded-xl border ${f.id===currentFlight?"ring-2 ring-indigo-500":""}`}>
              <div className="px-3 py-2 bg-gray-50 rounded-t-xl flex justify-between">
                <div className="font-medium">Vuelo {f.codigo} · {f.fecha_salida}</div>
                <div className="text-sm text-gray-600">Cajas: {f.cajas.length}</div>
              </div>
              <div className="p-3 grid md:grid-cols-2 gap-3">
                {f.cajas.map((c)=> (
                  <div key={c.id} className="border rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">Caja {c.codigo} · <span className="text-xs text-gray-600">{boxCourierLabel(c)}</span></div>
                      <button className="text-xs px-2 py-1 border rounded" onClick={()=> updateBoxMeta(f.id, c.id, 'paquetes', [])}>Vaciar</button>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-2 text-sm">
                      <Input placeholder="Peso (kg)" value={c.peso_caja_kg} onChange={e=>updateBoxMeta(f.id,c.id,'peso_caja_kg', e.target.value)} />
                      <Input placeholder="Largo" value={c.largo} onChange={e=>updateBoxMeta(f.id,c.id,'largo', e.target.value)} />
                      <Input placeholder="Ancho" value={c.ancho} onChange={e=>updateBoxMeta(f.id,c.id,'ancho', e.target.value)} />
                      <Input placeholder="Alto" value={c.alto} onChange={e=>updateBoxMeta(f.id,c.id,'alto', e.target.value)} />
                    </div>
                    <div className="text-xs text-gray-600 mb-2">Volumétrico caja (A×H×L ÷ 6000): {boxVolumetric(c).toFixed(3)} kg</div>
                    <ul className="text-sm max-h-48 overflow-auto">
                      {c.paquetes.map((pid)=>{ const p=packages.find(x=>x.id===pid); if(!p) return null; return (
                        <li key={pid} className="flex items-center justify-between border-b py-1 gap-2">
                          <span className="font-mono">{p.codigo}</span>
                          <span className="text-gray-600">{p.peso_real.toFixed(2)} kg</span>
                          <button className="text-red-600 text-xs" onClick={()=>removeFromBox(f.id, c.id, pid)}>Quitar</button>
                          {f.cajas.length>1 && (
                            <select className="text-xs border rounded px-1 py-0.5" value={c.id} onChange={e=>moveToBox(f.id, c.id, e.target.value, pid)}>
                              {f.cajas.map(c2=> <option key={c2.id} value={c2.id}>Mover a {c2.codigo}</option>)}
                            </select>
                          )}
                        </li>
                      );})}
                      {c.paquetes.length===0 && <li className="text-gray-500">—</li>}
                    </ul>
                  </div>
                ))}
                {f.cajas.length===0 && <div className="text-gray-500 p-3">Aún no hay cajas.</div>}
              </div>
            </div>
          ))}
          {flights.length===0 && <div className="text-gray-500">Crea un vuelo para comenzar.</div>}
        </div>
      </div>
    </div>
  </Section>;
}

function Proforma({ packages, flights, extras }){
  const [flightId,setFlightId]=useState(""); const flight = flights.find(f=>f.id===flightId);
  const dataByCourier = useMemo(()=>{
    if(!flight) return [];
    const map=new Map();
    flight.cajas.forEach(c=>{ c.paquetes.forEach(pid=>{ const p=packages.find(x=>x.id===pid); if(!p) return;
      if(!map.has(p.courier)) map.set(p.courier,{courier:p.courier,kg_real:0,kg_facturable:0,kg_exceso:0,bultos:0});
      const agg=map.get(p.courier); agg.kg_real+=p.peso_real; agg.kg_facturable+=p.peso_facturable; agg.kg_exceso+=p.exceso_volumen; agg.bultos+=1; });});
    return Array.from(map.values());
  },[flight,packages]);

  function extrasFor(courier){
    return extras.filter(e=> e.flight_id===flightId && e.courier===courier).reduce((s,e)=> s+toNumber(e.monto),0);
  }

  function exportOne(courierRow){
    const r=courierRow; const procesamiento=r.kg_facturable*TARIFFS.procesamiento_usd_kg, fleteReal=r.kg_real*TARIFFS.flete_real_usd_kg, fleteExceso=r.kg_exceso*TARIFFS.flete_exceso_usd_kg, despacho=r.kg_facturable*TARIFFS.despacho_usd_kg; const canje=canjeGuiaUSD(r.kg_facturable); const extrasMonto=extrasFor(r.courier); const comision=0.04*(procesamiento+fleteReal+fleteExceso+extrasMonto); const total=procesamiento+fleteReal+fleteExceso+despacho+canje+extrasMonto+comision;
    const rows = [
      ["Proforma – Vuelo", flight?.codigo || ""],
      ["Courier", r.courier],
      [],
      ["Concepto","Importe (USD)"],
      ["Procesamiento ("+r.kg_facturable.toFixed(3)+" kg)", procesamiento.toFixed(2)],
      ["Flete peso real ("+r.kg_real.toFixed(3)+" kg)", fleteReal.toFixed(2)],
      ["Flete exceso volumen ("+r.kg_exceso.toFixed(3)+" kg)", fleteExceso.toFixed(2)],
      ["Servicio de despacho ("+r.kg_facturable.toFixed(3)+" kg)", despacho.toFixed(2)],
      ["Canje de guía", canje.toFixed(2)],
      ["Trabajos extras", extrasMonto.toFixed(2)],
      ["Comisión transferencia 4%", comision.toFixed(2)],
      ["TOTAL USD", total.toFixed(2)],
    ];
    xlsxDownload(`proforma_${(flight?.codigo||'vuelo')}_${r.courier}.xlsx`, [{name:"Proforma", rows}]);
  }

  return <Section title="Proformas por courier" right={<div className="flex gap-2 items-center">
      <select className="rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
        <option value="">Seleccionar vuelo…</option>{flights.map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
      </select>
    </div>}>
    {!flight && <div className="text-gray-500">Selecciona un vuelo para ver el cálculo.</div>}
    {flight && <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead><tr className="bg-gray-50">{["Courier","Bultos","Kg real","Kg facturable","Kg exceso","Procesamiento","Flete real","Flete exceso","Despacho","Canje guía","Extras","Comisión 4%","TOTAL USD","Descargar"].map(h=> <th key={h} className="text-left px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>
          {dataByCourier.map(r=>{
            const procesamiento=r.kg_facturable*TARIFFS.procesamiento_usd_kg, fleteReal=r.kg_real*TARIFFS.flete_real_usd_kg, fleteExceso=r.kg_exceso*TARIFFS.flete_exceso_usd_kg, despacho=r.kg_facturable*TARIFFS.despacho_usd_kg; const canje=canjeGuiaUSD(r.kg_facturable); const extrasMonto=extrasFor(r.courier); const comision=0.04*(procesamiento+fleteReal+fleteExceso+extrasMonto); const total=procesamiento+fleteReal+fleteExceso+despacho+canje+extrasMonto+comision;
            return <tr key={r.courier} className="border-b">
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
              <td className="px-3 py-2 whitespace-nowrap">{extrasMonto.toFixed(2)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{comision.toFixed(2)}</td>
              <td className="px-3 py-2 whitespace-nowrap font-semibold">{total.toFixed(2)}</td>
              <td className="px-3 py-2 whitespace-nowrap"><button className="px-2 py-1 border rounded" onClick={()=>exportOne(r)}>XLSX</button></td>
            </tr>;
          })}
          {dataByCourier.length===0 && <tr><td colSpan={13} className="text-center text-gray-500 py-6">No hay datos para este vuelo.</td></tr>}
        </tbody>
      </table>
    </div>}
  </Section>;
}

function ExtrasTab({ flights, extras, setExtras }){
  const [flightId,setFlightId]=useState("");
  const [courier,setCourier]=useState("");
  const [desc,setDesc]=useState("");
  const [monto,setMonto]=useState("");

  function add(){ if(!(flightId && courier && desc && monto)) return; setExtras([...extras,{ id:crypto.randomUUID(), flight_id:flightId, courier, descripcion:desc, monto:Number(monto)}]); setDesc(""); setMonto(""); }
  const filtered = extras.filter(e=> e.flight_id===flightId);

  return <Section title="Trabajos extras">
    <div className="grid md:grid-cols-4 gap-2">
      <Field label="Vuelo" required>
        <select className="w-full rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
          <option value="">—</option>{flights.map(f=> <option key={f.id} value={f.id}>{f.codigo}</option>)}
        </select>
      </Field>
      <Field label="Courier" required><Input value={courier} onChange={e=>setCourier(e.target.value)} placeholder="Nombre del courier" /></Field>
      <Field label="Descripción" required><Input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Detalle del trabajo" /></Field>
      <Field label="Monto (USD)" required><Input type="number" step="0.01" value={monto} onChange={e=>setMonto(e.target.value)} /></Field>
    </div>
    <div className="flex justify-end"><button onClick={add} className="px-3 py-2 bg-indigo-600 text-white rounded-xl">Agregar</button></div>
    <div className="overflow-auto mt-4">
      <table className="min-w-full text-sm"><thead><tr className="bg-gray-50">{["Vuelo","Courier","Descripción","Monto"].map(h=> <th key={h} className="text-left px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{h}</th>)}</tr></thead>
      <tbody>
        {filtered.map(e=> <tr key={e.id} className="border-b"><td className="px-3 py-2">{flights.find(f=>f.id===e.flight_id)?.codigo}</td><td className="px-3 py-2">{e.courier}</td><td className="px-3 py-2">{e.descripcion}</td><td className="px-3 py-2">{e.monto.toFixed(2)}</td></tr>)}
        {filtered.length===0 && <tr><td className="px-3 py-6 text-gray-500" colSpan={4}>Sin extras para el vuelo seleccionado.</td></tr>}
      </tbody></table>
    </div>
  </Section>;
}

export default function App(){
  const [user,setUser]=useState(null); const [packages,setPackages]=useState([]); const [flights,setFlights]=useState([]); const [tab,setTab]=useState("Recepción"); const [extras,setExtras]=useState([]);
  const [couriers,setCouriers]=useState(COURIERS_INIT); const [estados,setEstados]=useState(ESTADOS_INIT);

  function addPackage(p){ const dup=packages.find(x=>x.codigo===p.codigo && x.courier===p.courier); if(dup){ alert("Ya existe un paquete con ese código para este courier."); return; } setPackages([p, ...packages]); }
  function assignToBox(id){ setPackages(packages.map(p=>p.id===id?{...p, estado_bodega:"En vuelo"}:p)); }

  if(!user) return <Login onLogin={setUser} />;

  const tabs = ["Recepción","Paquetes","Vuelos","Proformas","Extras"];
  return <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
    <header className="bg-white border-b sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-indigo-600" /><div><div className="font-semibold">Gestor de Paquetes</div><div className="text-xs text-gray-500">LaMaquinaLogistica / Europa Envíos</div></div></div>
        <div className="text-sm text-gray-600">{user.role} {user.courier?`· ${user.courier}`:""} — {user.email}</div>
      </div>
    </header>
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-4"><Tabs tabs={tabs} current={tab} onChange={setTab} /></div>
      {tab==="Recepción" && <ReceptionForm currentUser={user} onAdd={addPackage} couriers={couriers} setCouriers={setCouriers} estados={estados} setEstados={setEstados} />}
      {tab==="Paquetes" && <PackagesList data={packages} currentUser={user} />}
      {tab==="Vuelos" && <Flights packages={packages} flights={flights} setFlights={setFlights} onAssign={assignToBox} />}
      {tab==="Proformas" && <Proforma packages={packages} flights={flights} extras={extras} />}
      {tab==="Extras" && <ExtrasTab flights={flights} extras={extras} setExtras={setExtras} />}
    </main>
  </div>;
}
