import React, { useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import * as XLSX from "xlsx";

// ===================== CONFIG / LISTAS =====================
const COURIERS_INIT = [
  "Aladín","Boss Box","Buzón","Caba Box","Click Box","Easy Box","Europa Envíos","FastBox",
  "Fixo Cargo","Fox Box","Global Box","Home Box","Inflight Box","Inter Couriers","MC Group",
  "Miami Express","One Box","ParaguayBox","Royal Box"
];
const ESTADOS_INIT = ["Aéreo", "Marítimo", "Ofrecer marítimo"];
const VUELO_ESTADOS = ["En bodega", "En tránsito", "Arribado"];

const TARIFFS = { procesamiento_usd_kg: 5, flete_real_usd_kg: 9, flete_exceso_usd_kg: 9, despacho_usd_kg: 10 };
function canjeGuiaUSD(kg){ if(kg<=5) return 10; if(kg<=10) return 13.5; if(kg<=30) return 17; if(kg<=50) return 37; if(kg<=100) return 57; return 100; }
const toNumber = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const sum = arr => arr.reduce((s,n)=>s+Number(n||0),0);

// XLSX util
function xlsxDownload(filename, sheets){
  const wb = XLSX.utils.book_new();
  sheets.forEach(({name, rows})=>{
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0,31));
  });
  XLSX.writeFile(wb, filename);
}

// UI helpers
function Section({ title, right, children }){ return (
  <div className="bg-white rounded-2xl shadow p-4 mb-6">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {right}
    </div>
    {children}
  </div>
); }
function Field({ label, children, required }){ return (
  <label className="block mb-3">
    <span className="text-sm text-gray-700">{label}{required && <span className="text-red-500"> *</span>}</span>
    <div className="mt-1">{children}</div>
  </label>
); }
function Input(props){ return <input {...props} className={"w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 ring-indigo-500 "+(props.className||"")} />; }
function Tabs({ tabs, current, onChange }){
  return <div className="flex gap-2 flex-wrap">
    {tabs.map(t=> <button key={t} onClick={()=>onChange(t)} className={"px-3 py-2 rounded-xl text-sm "+(current===t?"bg-indigo-600 text-white shadow":"bg-white text-gray-700 border hover:bg-gray-50")}>{t}</button>)}
  </div>;
}

// ===================== LOGIN =====================
function Login({ onLogin }){
  const [email,setEmail]=useState(""); const [role,setRole]=useState("ADMIN"); const [courier,setCourier]=useState("");
  const canSubmit = email && role && (role==="ADMIN" || courier);
  return <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md">
      <h1 className="text-2xl font-semibold mb-4">Acceso al sistema</h1>
      <Field label="Email" required><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@empresa.com" /></Field>
      <Field label="Rol" required>
        <select className="w-full rounded-xl border px-3 py-2" value={role} onChange={e=>setRole(e.target.value)}>
          <option>ADMIN</option>
          <option>COURIER</option>
        </select>
      </Field>
      {role==="COURIER" && <Field label="Courier" required><Input value={courier} onChange={e=>setCourier(e.target.value)} placeholder="Nombre del courier"/></Field>}
      <button onClick={()=>onLogin({ email, role, courier: role==="ADMIN"?null:courier })} disabled={!canSubmit} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 disabled:opacity-50">Entrar</button>
    </div>
  </div>;
}

// ===================== GESTIÓN DE VUELOS =====================
function FlightsAdmin({ flights, setFlights }){
  const [code,setCode]=useState(""); const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  function createFlight(){
    if(!code) return;
    setFlights([{ id:crypto.randomUUID(), codigo:code, fecha_salida:date, estado:"En bodega", cajas:[] }, ...flights]);
    setCode("");
  }
  function changeStatus(id, estado){ setFlights(flights.map(f=> f.id===id?{...f, estado}:f)); }
  return <Section title="Gestión de vuelos" right={
    <div className="flex gap-2">
      <Input placeholder="Nombre de vuelo (ej. EE-001)" value={code} onChange={e=>setCode(e.target.value)} />
      <Input type="date" value={date} onChange={e=>setDate(e.target.value)} />
      <button onClick={createFlight} className="px-3 py-2 bg-indigo-600 text-white rounded-xl">Crear</button>
    </div>
  }>
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead><tr className="bg-gray-50">
          {["Código","Fecha","Estado","Cajas"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}
        </tr></thead>
        <tbody>
          {flights.map(f=>(
            <tr key={f.id} className="border-b">
              <td className="px-3 py-2">{f.codigo}</td>
              <td className="px-3 py-2">{f.fecha_salida}</td>
              <td className="px-3 py-2">
                <select className="border rounded px-2 py-1" value={f.estado} onChange={e=>changeStatus(f.id, e.target.value)}>
                  {VUELO_ESTADOS.map(s=><option key={s}>{s}</option>)}
                </select>
              </td>
              <td className="px-3 py-2">{f.cajas.length}</td>
            </tr>
          ))}
          {flights.length===0 && <tr><td colSpan={4} className="text-gray-500 py-6 text-center">Aún no hay vuelos.</td></tr>}
        </tbody>
      </table>
    </div>
  </Section>;
}

// ===================== RECEPCIÓN =====================
function ReceptionForm({ currentUser, onAdd, couriers, estados, flights }){
  // solo vuelos En bodega
  const availableFlights = flights.filter(f=> f.estado==="En bodega");
  const [form,setForm]=useState({
    flight_id: availableFlights[0]?.id || "",
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
    flight_id:form.flight_id, courier:form.courier, estado:form.estado, casilla:form.casilla, codigo:form.codigo, fecha:form.fecha,
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
    setForm({ ...form, codigo:"", nombre_apellido:"", tracking:"", remitente:"", peso_real:"", largo:"", ancho:"", alto:"", descripcion:"", valor_aerolinea:"0" });
  }

  return <Section title="Recepción de paquete" right={<span className="text-sm text-gray-500">Todos los campos son obligatorios</span>}>
    <div className="grid md:grid-cols-3 gap-4">
      <Field label="Vuelo (solo En bodega)" required>
        <select className="w-full rounded-xl border px-3 py-2" value={form.flight_id} onChange={e=>setForm({...form, flight_id:e.target.value})}>
          {availableFlights.map(f=> <option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
          {availableFlights.length===0 && <option value="">— No hay vuelos En bodega —</option>}
        </select>
      </Field>
      <Field label="Courier" required>
        <select className="w-full rounded-xl border px-3 py-2" value={form.courier} onChange={e=>setForm({...form, courier:e.target.value})} disabled={currentUser.role==="COURIER"}>
          <option value="">Seleccionar…</option>
          {COURIERS_INIT.map(c=> <option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Estado" required>
        <select className="w-full rounded-xl border px-3 py-2" value={form.estado} onChange={e=>setForm({...form, estado:e.target.value})}>
          <option value="">Seleccionar…</option>
          {ESTADOS_INIT.map(s=> <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Casilla" required><Input value={form.casilla} onChange={e=>setForm({...form, casilla:e.target.value})} placeholder="" /></Field>
      <Field label="Nº de paquete (código)" required><Input value={form.codigo} onChange={e=>setForm({...form, codigo:e.target.value.toUpperCase()})} placeholder="GBM187" /></Field>
      <Field label="Fecha" required><Input type="date" value={form.fecha} onChange={e=>setForm({...form, fecha:e.target.value})} /></Field>
      <Field label="Empresa de envío" required><Input value={form.empresa_envio} onChange={e=>setForm({...form, empresa_envio:e.target.value})} /></Field>
      <Field label="Nombre y apellido" required><Input value={form.nombre_apellido} onChange={e=>setForm({...form, nombre_apellido:e.target.value})} /></Field>
      <Field label="Tracking" required><Input value={form.tracking} onChange={e=>setForm({...form, tracking:e.target.value})} /></Field>
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

// ===================== PAQUETES (bodega) =====================
function PackagesList({ data, currentUser, flights, onUpdate }){
  const [q,setQ]=useState("");

  // solo paquetes de vuelos En bodega
  const rows = data.filter(p=>{
    const vuelo = flights.find(f=>f.id===p.flight_id);
    if(!vuelo || vuelo.estado!=="En bodega") return false;
    if(currentUser.role==="COURIER" && p.courier!==currentUser.courier) return false;
    const text=(p.codigo+p.tracking+p.casilla+p.nombre_apellido+p.courier).toLowerCase();
    return text.includes(q.toLowerCase());
  });

  // Edición
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState({});
  function startEdit(p){ setEditingId(p.id); setEdit({...p}); }
  function saveEdit(){ onUpdate(edit); setEditingId(null); }
  function cancelEdit(){ setEditingId(null); }

  // agregados para gráficas
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
  const COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#3B82F6","#8B5CF6","#14B8A6","#84CC16","#F97316"];

  function exportXLSX(){
    const header = ["COURIER","CÓDIGO/CASILLA","Nº","FECHA","EMPRESA ENVIO","NOMBRE Y APELLIDO","TRACKING","REMITENTE","PESO REAL","PESO FACTURABLE","LARGO","ANCHO","ALTO","PESO VOLUMETRICO","EXCESO DE VOLUMEN","DESCRIPCIÓN","PRECIO"];
    const body = rows.map((p,i)=>[
      p.courier, `${p.codigo}/${p.casilla}`, i+1, p.fecha, p.empresa_envio, p.nombre_apellido, p.tracking, p.remitente,
      p.peso_real, p.peso_facturable, p.largo, p.ancho, p.alto, p.peso_volumetrico, p.exceso_volumen, p.descripcion, p.valor_aerolinea
    ]);
    xlsxDownload("Paquetes.xlsx", [{name:"Packing List", rows:[header, ...body]}]);
  }

  return <Section title="Paquetes en bodega" right={<div className="flex gap-2">
      <Input placeholder="Buscar…" value={q} onChange={e=>setQ(e.target.value)} />
      <button onClick={exportXLSX} className="px-3 py-2 bg-gray-800 text-white rounded-xl">Exportar XLSX</button>
    </div>}>
    <div className="overflow-auto mb-6">
      <table className="min-w-full text-sm">
        <thead><tr className="bg-gray-50">
          {["Courier","Estado","Casilla","Código","Fecha","Nombre","Tracking","Peso real","Facturable","Volumétrico","Exceso","Valor (EUR)","Acciones"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map(p=> editingId===p.id ? (
            <tr key={p.id} className="border-b">
              <td className="px-3 py-2"><Input value={edit.courier} onChange={e=>setEdit({...edit, courier:e.target.value})} /></td>
              <td className="px-3 py-2"><Input value={edit.estado} onChange={e=>setEdit({...edit, estado:e.target.value})} /></td>
              <td className="px-3 py-2"><Input value={edit.casilla} onChange={e=>setEdit({...edit, casilla:e.target.value})} /></td>
              <td className="px-3 py-2"><Input value={edit.codigo} onChange={e=>setEdit({...edit, codigo:e.target.value})} /></td>
              <td className="px-3 py-2"><Input value={edit.fecha} onChange={e=>setEdit({...edit, fecha:e.target.value})} /></td>
              <td className="px-3 py-2"><Input value={edit.nombre_apellido} onChange={e=>setEdit({...edit, nombre_apellido:e.target.value})} /></td>
              <td className="px-3 py-2"><Input value={edit.tracking} onChange={e=>setEdit({...edit, tracking:e.target.value})} /></td>
              <td className="px-3 py-2"><Input type="number" value={edit.peso_real} onChange={e=>setEdit({...edit, peso_real:Number(e.target.value)})} /></td>
              <td className="px-3 py-2"><Input type="number" value={edit.peso_facturable} onChange={e=>setEdit({...edit, peso_facturable:Number(e.target.value)})} /></td>
              <td className="px-3 py-2"><Input type="number" value={edit.peso_volumetrico} onChange={e=>setEdit({...edit, peso_volumetrico:Number(e.target.value)})} /></td>
              <td className="px-3 py-2"><Input type="number" value={edit.exceso_volumen} onChange={e=>setEdit({...edit, exceso_volumen:Number(e.target.value)})} /></td>
              <td className="px-3 py-2"><Input type="number" value={edit.valor_aerolinea} onChange={e=>setEdit({...edit, valor_aerolinea:Number(e.target.value)})} /></td>
              <td className="px-3 py-2">
                <button className="px-2 py-1 border rounded mr-2" onClick={saveEdit}>Guardar</button>
                <button className="px-2 py-1 border rounded" onClick={cancelEdit}>Cancelar</button>
              </td>
            </tr>
          ) : (
            <tr key={p.id} className="border-b">
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
              <td className="px-3 py-2 whitespace-nowrap">
                <button className="px-2 py-1 border rounded" onClick={()=>startEdit(p)}>Editar</button>
              </td>
            </tr>
          ))}
          {rows.length===0 && <tr><td colSpan={13} className="text-center text-gray-500 py-6">No hay resultados.</td></tr>}
        </tbody>
      </table>
    </div>

    {/* Gráficos de torta */}
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-gray-50 rounded-xl p-3">
        <div className="text-sm text-gray-600 mb-2">Kg reales por courier (Total: {totReal.toFixed(3)} kg)</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={agg} dataKey="kg_real" nameKey="courier" outerRadius={100} label>
                {agg.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip/><Legend/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-gray-50 rounded-xl p-3">
        <div className="text-sm text-gray-600 mb-2">Exceso volumétrico por courier (Total: {totExceso.toFixed(3)} kg)</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={agg} dataKey="kg_exceso" nameKey="courier" outerRadius={100} label>
                {agg.map((entry, index) => <Cell key={index} fill={COLORS[(index+3) % COLORS.length]} />)}
              </Pie>
              <Tooltip/><Legend/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </Section>;
}

// ===================== ARMADO DE CAJAS (antes "Vuelos") =====================
function ArmadoCajas({ packages, flights, setFlights, onAssign }){
  const [flightId,setFlightId]=useState("");
  const [dateFrom,setDateFrom]=useState(""); const [dateTo,setDateTo]=useState("");
  const filteredFlights = flights
    .filter(f=> f.estado==="En bodega")
    .filter(f=> !dateFrom || f.fecha_salida>=dateFrom)
    .filter(f=> !dateTo || f.fecha_salida<=dateTo);

  const [activeBoxId,setActiveBoxId]=useState(null);
  const [boxCode,setBoxCode]=useState(""); const [scan,setScan]=useState("");

  const flight = flights.find(f=>f.id===flightId);

  function addBox(){
    if(!flightId || !boxCode) return;
    setFlights(flights.map(f=> f.id!==flightId?f:{...f, cajas:[...f.cajas, {id:crypto.randomUUID(), codigo:boxCode, paquetes:[], peso_caja_kg:"", largo:"", ancho:"", alto:""}]}));
    setBoxCode("");
  }
  function updateBoxMeta(field,value){
    if(!flightId||!activeBoxId) return;
    setFlights(flights.map(f=> f.id!==flightId?f:{...f, cajas:f.cajas.map(c=> c.id!==activeBoxId?c:{...c,[field]:value})}));
  }
  function assignByScan(){
    if(!scan||!flightId||!activeBoxId) return;
    const f = flights.find(x=>x.id===flightId); const caja = f?.cajas.find(c=>c.id===activeBoxId);
    const pkg = packages.find(p=>p.codigo.toUpperCase()===scan.toUpperCase() && p.flight_id===flightId);
    if(!pkg){ alert("Paquete no encontrado en este vuelo"); setScan(""); return; }
    const already = flights.some(fl=> fl.cajas.some(c=>c.paquetes.includes(pkg.id))); if(already){ alert("Ese paquete ya fue asignado a una caja"); setScan(""); return; }
    setFlights(flights.map(fl=> fl.id!==flightId?fl:{...fl, cajas:fl.cajas.map(c=> c.id!==activeBoxId?c:{...c, paquetes:[...c.paquetes, pkg.id]})}));
    onAssign(pkg.id); setScan("");
  }
  function removeFromBox(pid){ setFlights(flights.map(f=> f.id!==flightId?f:{...f,cajas:f.cajas.map(c=> c.id!==activeBoxId?c:{...c, paquetes:c.paquetes.filter(x=>x!==pid)})})); }
  function moveToBox(pid, toId){
    if(!toId || toId===activeBoxId) return;
    // quitar del actual
    setFlights(prev => prev.map(f=> f.id!==flightId?f:{...f, cajas:f.cajas.map(c=> c.id!==activeBoxId?c:{...c, paquetes:c.paquetes.filter(x=>x!==pid)})}));
    // agregar al destino
    setFlights(prev => prev.map(f=> f.id!==flightId?f:{...f, cajas:f.cajas.map(c=> c.id!==toId?c:{...c, paquetes:[...c.paquetes, pid]})}));
  }
  function boxCourierLabel(caja){
    const couriers = new Set(caja.paquetes.map(pid=> packages.find(p=>p.id===pid)?.courier).filter(Boolean));
    if(couriers.size===1) return Array.from(couriers)[0];
    if(couriers.size>1) return "MULTICOURIER";
    return "—";
  }
  function boxVolumetric(caja){ const L=toNumber(caja.largo), A=toNumber(caja.alto), An=toNumber(caja.ancho); if(!(L&&A&&An)) return 0; return (An*A*L)/6000; }

  // Export: hojas por caja estilo ejemplo
  function exportBoxes(){
    if(!flight) return;
    const sheets = [];
    flight.cajas.forEach((caja, idx)=>{
      // organizar paquetes por courier
      const byCourier = {};
      caja.paquetes.forEach(pid=>{
        const p = packages.find(x=>x.id===pid); if(!p) return;
        if(!byCourier[p.courier]) byCourier[p.courier] = [];
        byCourier[p.courier].push(p.codigo);
      });
      const couriers = Object.keys(byCourier).sort();
      const maxRows = couriers.reduce((m,k)=> Math.max(m, byCourier[k].length), 0);
      const rows = [];
      rows.push(["", "", "", "", "", ""]);
      rows.push(["CONTROL DE PAQUETES"]);
      rows.push([`CAJA Nº ${idx+1}`, "", "", "", "", `CANTIDAD DE PAQUETES: ${caja.paquetes.length}`]);
      rows.push(couriers); // encabezados (couriers)
      for(let r=0;r<maxRows;r++){
        rows.push(couriers.map(c=> byCourier[c][r] || ""));
      }
      sheets.push({name:`CAJA ${idx+1}`, rows});
    });
    xlsxDownload(`Armado_de_cajas_${flight.codigo}.xlsx`, sheets.length? sheets : [{name:"CAJAS", rows:[["Sin cajas"]] }]);
  }

  return <Section title="Armado de cajas" right={
    <div className="flex gap-2 items-center">
      <div className="text-sm text-gray-600">Filtrar por fecha:</div>
      <Input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
      <Input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
    </div>
  }>
    <div className="grid md:grid-cols-3 gap-4">
      <div className="md:col-span-1">
        <Field label="Seleccionar vuelo (En bodega)" required>
          <select className="w-full rounded-xl border px-3 py-2" value={flightId} onChange={e=>{ setFlightId(e.target.value); setActiveBoxId(null); }}>
            <option value="">—</option>
            {filteredFlights.map(f=> <option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
          </select>
        </Field>
        <Field label="Crear caja (código)" required>
          <div className="flex gap-2">
            <Input placeholder="Caja-01" value={boxCode} onChange={e=>setBoxCode(e.target.value)} />
            <button onClick={addBox} disabled={!flightId} className="px-3 py-2 bg-gray-800 text-white rounded-xl disabled:opacity-50">Agregar</button>
          </div>
        </Field>
        <Field label="Caja activa">
          <select className="w-full rounded-xl border px-3 py-2" value={activeBoxId||""} onChange={e=>setActiveBoxId(e.target.value)}>
            <option value="">—</option>
            {flight?.cajas.map(c=> <option key={c.id} value={c.id}>{c.codigo}</option>)}
          </select>
        </Field>
        <Field label="Escanear / ingresar código de paquete">
          <Input value={scan} onChange={e=>setScan(e.target.value.toUpperCase())} onKeyDown={e=> e.key==="Enter" && assignByScan()} placeholder="GBM187" />
        </Field>
        <button onClick={exportBoxes} disabled={!flight} className="px-3 py-2 bg-emerald-600 text-white rounded-xl disabled:opacity-50">Exportar XLSX (cajas)</button>
      </div>

      <div className="md:col-span-2">
        {!flight && <div className="text-gray-500">Selecciona un vuelo.</div>}
        {flight && (
          <div className="space-y-4">
            {flight.cajas.map(c=>(
              <div key={c.id} className={`border rounded-xl p-3 ${activeBoxId===c.id?"ring-2 ring-indigo-500":""}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Caja {c.codigo} · <span className="text-xs text-gray-600">{(function(){const s=new Set(c.paquetes.map(pid=> packages.find(p=>p.id===pid)?.courier).filter(Boolean)); return s.size===0?"—":(s.size===1?[...s][0]:"MULTICOURIER");})()}</span></div>
                  <button className="text-xs px-2 py-1 border rounded" onClick={()=> setActiveBoxId(c.id)}>Activar</button>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-2 text-sm">
                  <Input placeholder="Peso (kg)" value={c.peso_caja_kg} onChange={e=>updateBoxMeta('peso_caja_kg', e.target.value)} />
                  <Input placeholder="Largo" value={c.largo} onChange={e=>updateBoxMeta('largo', e.target.value)} />
                  <Input placeholder="Ancho" value={c.ancho} onChange={e=>updateBoxMeta('ancho', e.target.value)} />
                  <Input placeholder="Alto" value={c.alto} onChange={e=>updateBoxMeta('alto', e.target.value)} />
                </div>
                <div className="text-xs text-gray-600 mb-2">Volumétrico caja (A×H×L ÷ 6000): {((toNumber(c.ancho)*toNumber(c.alto)*toNumber(c.largo))/6000 || 0).toFixed(3)} kg</div>
                <ul className="text-sm max-h-48 overflow-auto">
                  {c.paquetes.map((pid)=>{ const p=packages.find(x=>x.id===pid); if(!p) return null; return (
                    <li key={pid} className="flex items-center justify-between border-b py-1 gap-2">
                      <span className="font-mono">{p.codigo}</span>
                      <span className="text-gray-600">{p.courier}</span>
                      <button className="text-red-600 text-xs" onClick={()=>removeFromBox(pid)}>Quitar</button>
                      {flight.cajas.length>1 && (
                        <select className="text-xs border rounded px-1 py-0.5" onChange={e=>moveToBox(pid, e.target.value)} defaultValue="">
                          <option value="" disabled>Mover a…</option>
                          {flight.cajas.filter(x=>x.id!==c.id).map(c2=> <option key={c2.id} value={c2.id}>{c2.codigo}</option>)}
                        </select>
                      )}
                    </li>
                  );})}
                  {c.paquetes.length===0 && <li className="text-gray-500">—</li>}
                </ul>
              </div>
            ))}
            {flight.cajas.length===0 && <div className="text-gray-500">Aún no hay cajas.</div>}
          </div>
        )}
      </div>
    </div>
  </Section>;
}

// ===================== CARGAS ENVIADAS =====================
function CargasEnviadas({ packages, flights }){
  const [dateFrom,setDateFrom]=useState(""); const [dateTo,setDateTo]=useState("");
  const [estado,setEstado]=useState(""); const [flightId,setFlightId]=useState("");

  const vuelos = flights
    .filter(f=> !dateFrom || f.fecha_salida>=dateFrom)
    .filter(f=> !dateTo || f.fecha_salida<=dateTo)
    .filter(f=> !estado || f.estado===estado)
    .filter(f=> f.estado!=="En bodega"); // solo enviados

  const flight = flights.find(f=> f.id===flightId);

  // resumen de cajas como tu planilla
  const resumenCajas = useMemo(()=>{
    if(!flight) return [];
    return flight.cajas.map((c,idx)=>{
      const label = (function(){
        const s=new Set(c.paquetes.map(pid=> packages.find(p=>p.id===pid)?.courier).filter(Boolean));
        return s.size===0?"—":(s.size===1?[...s][0]:"MULTICOURIER");
      })();
      return {
        n: idx+1, courier: label,
        peso: toNumber(c.peso_caja_kg),
        largo: toNumber(c.largo), ancho: toNumber(c.ancho), alto: toNumber(c.alto),
        volum: (toNumber(c.ancho)*toNumber(c.alto)*toNumber(c.largo))/6000 || 0,
        obs: ""
      };
    });
  },[flight,packages]);

  const totalPeso = sum(resumenCajas.map(r=>r.peso));
  const totalVol = sum(resumenCajas.map(r=>r.volum));

  return <Section title="Cargas enviadas (En tránsito / Arribado)">
    <div className="grid md:grid-cols-5 gap-3 mb-3">
      <Field label="Desde"><Input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} /></Field>
      <Field label="Hasta"><Input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} /></Field>
      <Field label="Estado">
        <select className="w-full rounded-xl border px-3 py-2" value={estado} onChange={e=>setEstado(e.target.value)}>
          <option value="">Todos</option>
          {["En tránsito","Arribado"].map(s=> <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Carga / Vuelo">
        <select className="w-full rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
          <option value="">Seleccionar…</option>
          {vuelos.map(f=> <option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida} · {f.estado}</option>)}
        </select>
      </Field>
    </div>

    {!flight && <div className="text-gray-500">Elegí una carga para ver su contenido.</div>}
    {flight && <>
      <div className="mb-3 text-sm text-gray-600">Paquetes del vuelo <b>{flight.codigo}</b> · {flight.fecha_salida} · {flight.estado}</div>
      <div className="overflow-auto mb-6">
        <table className="min-w-full text-sm">
          <thead><tr className="bg-gray-50">
            {["Courier","Estado","Casilla","Código","Fecha","Nombre","Tracking","Peso real","Facturable","Volumétrico","Exceso","Valor (EUR)"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}
          </tr></thead>
          <tbody>
            {packages.filter(p=> p.flight_id===flightId).map(p=>(
              <tr key={p.id} className="border-b">
                <td className="px-3 py-2">{p.courier}</td><td className="px-3 py-2">{p.estado}</td>
                <td className="px-3 py-2">{p.casilla}</td><td className="px-3 py-2 font-mono">{p.codigo}</td><td className="px-3 py-2">{p.fecha}</td>
                <td className="px-3 py-2">{p.nombre_apellido}</td><td className="px-3 py-2 font-mono">{p.tracking}</td>
                <td className="px-3 py-2">{p.peso_real.toFixed(3)}</td><td className="px-3 py-2">{p.peso_facturable.toFixed(3)}</td>
                <td className="px-3 py-2">{p.peso_volumetrico.toFixed(3)}</td><td className="px-3 py-2">{p.exceso_volumen.toFixed(3)}</td>
                <td className="px-3 py-2">{p.valor_aerolinea.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="bg-gray-50">
            {["N° de Caja","Courier","Peso","Largo","Ancho","Alto","Peso volumétrico","Observaciones"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}
          </tr></thead>
          <tbody>
            {resumenCajas.map(r=>(
              <tr key={r.n} className="border-b">
                <td className="px-3 py-2">{r.n}</td><td className="px-3 py-2">{r.courier}</td>
                <td className="px-3 py-2">{r.peso.toFixed(3)}</td><td className="px-3 py-2">{r.largo}</td><td className="px-3 py-2">{r.ancho}</td><td className="px-3 py-2">{r.alto}</td>
                <td className="px-3 py-2">{r.volum.toFixed(3)}</td><td className="px-3 py-2">{r.obs}</td>
              </tr>
            ))}
            <tr><td colSpan={2} className="px-3 py-2 font-semibold text-right">Peso real</td><td className="px-3 py-2 font-semibold">{totalPeso.toFixed(3)}</td><td colSpan={3}></td><td className="px-3 py-2 font-semibold">{totalVol.toFixed(3)}</td><td className="px-3 py-2 font-semibold">Peso volumétrico</td></tr>
          </tbody>
        </table>
      </div>
    </>}
  </Section>;
}

// ===================== PROFORMAS =====================
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

  function extrasFor(courier){ return extras.filter(e=> e.flight_id===flightId && e.courier===courier).reduce((s,e)=> s+toNumber(e.monto),0); }

  function exportOne(r){
    const procesamiento=r.kg_facturable*TARIFFS.procesamiento_usd_kg, fleteReal=r.kg_real*TARIFFS.flete_real_usd_kg, fleteExceso=r.kg_exceso*TARIFFS.flete_exceso_usd_kg, despacho=r.kg_facturable*TARIFFS.despacho_usd_kg; const canje=canjeGuiaUSD(r.kg_facturable); const extrasMonto=extrasFor(r.courier); const comision=0.04*(procesamiento+fleteReal+fleteExceso+extrasMonto); const total=procesamiento+fleteReal+fleteExceso+despacho+canje+extrasMonto+comision;

    const rows = [
      ["",""],["","Europa Envíos"],["","LAMAQUINALOGISTICA, SOCIEDAD LIMITADA"],["","N.I.F.: B56340656"],["","CALLE ESTEBAN SALAZAR CHAPELA, NUM 20, PUERTA 87, NAVE 87"],["","29004 MÁLAGA (ESPAÑA)"],["","(34) 633 74 08 31"],["",""],["","Factura Proforma"],["","Fecha: "+(new Date().toISOString().slice(0,10))],["",""],["","Cliente","","Forma de Pago","","N.º de factura"],["",r.courier,"","", "", "—"],["",""],["",""],["",""],["","Descripción","","",""],["","Cantidad","Precio unitario","Precio total"],
      ["","Procesamiento", r.kg_facturable.toFixed(3), TARIFFS.procesamiento_usd_kg, (procesamiento).toFixed(2)],
      ["","Flete peso real", r.kg_real.toFixed(3), TARIFFS.flete_real_usd_kg, (fleteReal).toFixed(2)],
      ["","Flete exceso de volumen", r.kg_exceso.toFixed(3), TARIFFS.flete_exceso_usd_kg, (fleteExceso).toFixed(2)],
      ["","Servicio de despacho", r.kg_facturable.toFixed(3), TARIFFS.despacho_usd_kg, (despacho).toFixed(2)],
      ["","Comisión por canje de guía", 1, canje.toFixed(2), canje.toFixed(2)],
      ["","Trabajos extras", 1, extrasMonto.toFixed(2), extrasMonto.toFixed(2)],
      ["","Comisión por transferencia", "4%", "", comision.toFixed(2)],
      ["","TOTAL USD","","", total.toFixed(2)]
    ];
    xlsxDownload(`proforma_${(flight?.codigo||'vuelo')}_${r.courier}.xlsx`, [{name:"Factura", rows}]);
  }

  return <Section title="Proformas por courier" right={
    <select className="rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
      <option value="">Seleccionar vuelo…</option>{flights.map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
    </select>
  }>
    {!flight && <div className="text-gray-500">Selecciona un vuelo.</div>}
    {flight && <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead><tr className="bg-gray-50">{"Courier,Bultos,Kg real,Kg facturable,Kg exceso,Procesamiento,Flete real,Flete exceso,Despacho,Canje guía,Extras,Comisión 4%,TOTAL USD,Descargar".split(",").map(h=> <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
        <tbody>
          {dataByCourier.map(r=>{
            const procesamiento=r.kg_facturable*TARIFFS.procesamiento_usd_kg, fleteReal=r.kg_real*TARIFFS.flete_real_usd_kg, fleteExceso=r.kg_exceso*TARIFFS.flete_exceso_usd_kg, despacho=r.kg_facturable*TARIFFS.despacho_usd_kg; const canje=canjeGuiaUSD(r.kg_facturable); const extrasMonto=extrasFor(r.courier); const comision=0.04*(procesamiento+fleteReal+fleteExceso+extrasMonto); const total=procesamiento+fleteReal+fleteExceso+despacho+canje+extrasMonto+comision;
            return <tr key={r.courier} className="border-b">
              <td className="px-3 py-2">{r.courier}</td><td className="px-3 py-2">{r.bultos}</td>
              <td className="px-3 py-2">{r.kg_real.toFixed(3)}</td><td className="px-3 py-2">{r.kg_facturable.toFixed(3)}</td><td className="px-3 py-2">{r.kg_exceso.toFixed(3)}</td>
              <td className="px-3 py-2">{(procesamiento).toFixed(2)}</td><td className="px-3 py-2">{(fleteReal).toFixed(2)}</td><td className="px-3 py-2">{(fleteExceso).toFixed(2)}</td><td className="px-3 py-2">{(despacho).toFixed(2)}</td>
              <td className="px-3 py-2">{(canje).toFixed(2)}</td><td className="px-3 py-2">{(extrasMonto).toFixed(2)}</td><td className="px-3 py-2">{(comision).toFixed(2)}</td>
              <td className="px-3 py-2 font-semibold">{(total).toFixed(2)}</td>
              <td className="px-3 py-2"><button className="px-2 py-1 border rounded" onClick={()=>exportOne(r)}>XLSX</button></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>}
  </Section>;
}

// ===================== EXTRAS =====================
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
      <table className="min-w-full text-sm"><thead><tr className="bg-gray-50">{"Vuelo,Courier,Descripción,Monto".split(",").map(h=> <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
      <tbody>
        {filtered.map(e=> <tr key={e.id} className="border-b"><td className="px-3 py-2">{flights.find(f=>f.id===e.flight_id)?.codigo}</td><td className="px-3 py-2">{e.courier}</td><td className="px-3 py-2">{e.descripcion}</td><td className="px-3 py-2">{e.monto.toFixed(2)}</td></tr>)}
        {filtered.length===0 && <tr><td className="px-3 py-6 text-gray-500" colSpan={4}>Sin extras para el vuelo seleccionado.</td></tr>}
      </tbody></table>
    </div>
  </Section>;
}

// ===================== APP ROOT =====================
export default function App(){
  const [user,setUser]=useState(null);
  const [packages,setPackages]=useState([]);
  const [flights,setFlights]=useState([]);
  const [extras,setExtras]=useState([]);
  const [tab,setTab]=useState("Recepción");

  function addPackage(p){ const dup=packages.find(x=>x.codigo===p.codigo && x.courier===p.courier && x.flight_id===p.flight_id); if(dup){ alert("Ya existe un paquete con ese código para este courier en ese vuelo."); return; } setPackages([p, ...packages]); }
  function assignToBox(id){ setPackages(packages.map(p=>p.id===id?{...p, estado_bodega:"En vuelo"}:p)); }
  function updatePackage(p){ setPackages(packages.map(x=> x.id===p.id?{...x, ...p}:x)); }

  if(!user) return <Login onLogin={setUser} />;

  const tabs = ["Recepción","Paquetes","Armado de cajas","Cargas enviadas","Gestión de vuelos","Proformas","Extras"];

  return <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
    <header className="bg-white border-b sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-indigo-600" /><div><div className="font-semibold">Gestor de Paquetes</div><div className="text-xs text-gray-500">LaMaquinaLogistica / Europa Envíos</div></div></div>
        <div className="text-sm text-gray-600">{user.role} {user.courier?`· ${user.courier}`:""} — {user.email}</div>
      </div>
    </header>
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-4"><Tabs tabs={tabs} current={tab} onChange={setTab} /></div>
      {tab==="Recepción" && <ReceptionForm currentUser={user} onAdd={addPackage} couriers={COURIERS_INIT} estados={ESTADOS_INIT} flights={flights} />}
      {tab==="Paquetes" && <PackagesList data={packages} currentUser={user} flights={flights} onUpdate={updatePackage} />}
      {tab==="Armado de cajas" && <ArmadoCajas packages={packages} flights={flights} setFlights={setFlights} onAssign={assignToBox} />}
      {tab==="Cargas enviadas" && <CargasEnviadas packages={packages} flights={flights} />}
      {tab==="Gestión de vuelos" && <FlightsAdmin flights={flights} setFlights={setFlights} />}
      {tab==="Proformas" && <Proforma packages={packages} flights={flights} extras={extras} />}
      {tab==="Extras" && <ExtrasTab flights={flights} extras={extras} setExtras={setExtras} />}
    </main>
  </div>;
}
