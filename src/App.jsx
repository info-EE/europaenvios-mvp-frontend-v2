/*  Europa Envíos – MVP 0.2.6
    Cambios de esta versión:
    - Proforma (ExcelJS): logo centrado en B1:D7; “Comisión 4%” + 5 filas reservadas debajo para extras; TOTAL va debajo de extras; formatos 0.000/0.00.
    - Etiquetas: impresión por iframe oculto y deaccent de todos los textos (sin tildes).
    - Armado de cajas: caja activa con Editar/Guardar (igual a v0.2.5).
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import * as XLSX from "xlsx-js-style";
import JsBarcode from "jsbarcode";
import ExcelJS from "exceljs/dist/exceljs.min.js";

/* ===== Utils ===== */
const uuid = () => {
  try { if (window.crypto?.randomUUID) return window.crypto.randomUUID(); } catch {}
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};
const deaccent = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

/* ===== Impresión sin about:blank ===== */
function printHTMLInIframe(html){
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, { position:"fixed", right:"0", bottom:"0", width:"0", height:"0", border:"0" });
  document.body.appendChild(iframe);
  const cleanup=()=>setTimeout(()=>{ try{document.body.removeChild(iframe);}catch{} },500);

  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(()=>{ try{
    iframe.contentWindow.focus();
    const after=()=>{ iframe.contentWindow.removeEventListener?.("afterprint",after); cleanup(); };
    iframe.contentWindow.addEventListener?.("afterprint",after);
    iframe.contentWindow.print();
  }catch{ cleanup(); alert("No se pudo generar la etiqueta."); }}, 60);
}

/* ===== XLSX helpers (fallback) ===== */
const bd = () => ({ top:{style:"thin",color:{rgb:"FFCBD5E1"}}, bottom:{style:"thin",color:{rgb:"FFCBD5E1"}},
  left:{style:"thin",color:{rgb:"FFCBD5E1"}}, right:{style:"thin",color:{rgb:"FFCBD5E1"}} });
const th = (txt) => ({ v:txt, t:"s", s:{font:{bold:true,color:{rgb:"FFFFFFFF"}},fill:{fgColor:{rgb:"FF1F2937"}},
  alignment:{horizontal:"center",vertical:"center"}, border:bd()} });
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

/* ===== Plantillas XLSX ===== */
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
          Object.entries(map).forEach(([k,v])=>{ txt = txt.replaceAll(`{{${k}}}`, v ?? ""); });
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

/* ===== ExcelJS para proformas (logo centrado + filas extras) ===== */
const LOGO_TL = { col: 2, row: 1 };   // B1
const LOGO_BR = { col: 4, row: 7 };   // D7

const PX_PER_CHAR = 7.2;
const PX_PER_POINT = 96/72;

function colWidthPx(ws, col){
  const c = ws.getColumn(col);
  const w = c.width ?? 8.43;
  return Math.round(w * PX_PER_CHAR);
}
function rowHeightPx(ws, row){
  const r = ws.getRow(row);
  const h = r.height ?? 15;
  return Math.round(h * PX_PER_POINT);
}
function boxSizePx(ws, tl, br){
  let w=0,h=0;
  for(let c=tl.col; c<=br.col; c++) w += colWidthPx(ws, c);
  for(let r=tl.row; r<=br.row; r++) h += rowHeightPx(ws, r);
  return { w, h };
}
function colFloatFromOffset(ws, startCol, px){
  let acc=0, c=startCol;
  while(true){
    const w = colWidthPx(ws, c);
    if (px <= acc + w) {
      const frac = (px - acc) / w;
      return (c - 1) + frac;
    }
    acc += w; c++;
  }
}
function rowFloatFromOffset(ws, startRow, px){
  let acc=0, r=startRow;
  while(true){
    const h = rowHeightPx(ws, r);
    if (px <= acc + h) {
      const frac = (px - acc) / h;
      return (r - 1) + frac;
    }
    acc += h; r++;
  }
}
async function loadLogoInfo(url){
  const resp = await fetch(url, { cache: "no-store" });
  if(!resp.ok) throw new Error("Logo no encontrado");
  const blob = await resp.blob();

  const base64 = await new Promise(res=>{
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(",")[1]);
    fr.readAsDataURL(blob);
  });

  const { width, height } = await new Promise((resolve,reject)=>{
    const img = new Image();
    img.onload = ()=>resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });

  return { base64, width, height };
}
function downloadBufferAsXlsx(buf, filename){
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}
function replacePlaceholdersExcelJS(ws, map){
  const maxR = Math.min(ws.rowCount || 200, 200);
  const maxC = Math.min(ws.columnCount || 30, 30);
  for(let r=1;r<=maxR;r++){
    for(let c=1;c<=maxC;c++){
      const cell = ws.getCell(r,c);
      const v = cell.value;
      let txt;
      if (v && typeof v === "object" && v.richText) txt = v.richText.map(t=>t.text).join("");
      else txt = (v ?? "").toString();
      if (!txt) continue;
      let changed = txt;
      Object.entries(map).forEach(([k,val])=>{ changed = changed.replaceAll(`{{${k}}}`, val ?? ""); });
      if (changed !== txt) cell.value = changed;
    }
  }
}

async function exportProformaExcelJS_usingTemplate({ plantillaUrl, logoUrl, nombreArchivo, datosFactura }){
  const wb = new ExcelJS.Workbook();
  const ab = await (await fetch(plantillaUrl, { cache: "no-store" })).arrayBuffer();
  await wb.xlsx.load(ab);

  const wsFactura = wb.getWorksheet("Factura") || wb.worksheets[0];

  // FECHA y COURIER
  replacePlaceholdersExcelJS(wsFactura, {
    FECHA: datosFactura.fechaCarga || "",
    COURIER: datosFactura.courier || ""
  });

  // LOGO centrado exacto en B1:D7
  try{
    const { base64, width: imgW, height: imgH } = await loadLogoInfo(logoUrl);
    const imageId = wb.addImage({ base64, extension: "png" });

    const { w: boxW, h: boxH } = boxSizePx(wsFactura, LOGO_TL, LOGO_BR);
    const scale = Math.min(boxW / imgW, boxH / imgH);
    const extW = Math.round(imgW * scale);
    const extH = Math.round(imgH * scale);
    const offX = Math.max(0, (boxW - extW) / 2);
    const offY = Math.max(0, (boxH - extH) / 2);

    const tlColFloat = colFloatFromOffset(wsFactura, LOGO_TL.col, offX);
    const tlRowFloat = rowFloatFromOffset(wsFactura, LOGO_TL.row, offY);

    wsFactura.addImage(imageId, {
      tl: { col: tlColFloat, row: tlRowFloat },
      ext: { width: extW, height: extH },
      editAs: "oneCell"
    });
  }catch(e){ console.warn("No se pudo insertar el logo:", e); }

  // === Localizar cabecera de tabla (Descripción / Cantidad / ...) ===
  let startRow = 16, colDesc = 1;
  outer:
  for(let r=1; r<=60; r++){
    for(let c=1; c<=20; c++){
      const v = wsFactura.getCell(r,c).value;
      const txt = typeof v === "object" && v?.richText ? v.richText.map(t=>t.text).join("") : v;
      if(String(txt).trim().toLowerCase() === "descripción" || String(txt).trim().toLowerCase() === "descripcion"){
        startRow = r + 1; colDesc = c; break outer;
      }
    }
  }
  const COL_CANT = colDesc + 1;
  const COL_UNIT = colDesc + 2;
  const COL_SUB  = colDesc + 3;

  // === Escribir filas: base + comisión 4% + espacio reservado + extras ===
  const baseRows = [
    ["Procesamiento", datosFactura.kg_fact, datosFactura.pu_proc, datosFactura.sub_proc],
    ["Flete peso real", datosFactura.kg_real, datosFactura.pu_real, datosFactura.sub_real],
    ["Flete exceso de volumen", datosFactura.kg_exc, datosFactura.pu_exc, datosFactura.sub_exc],
    ["Servicio de despacho", datosFactura.kg_fact, datosFactura.pu_desp, datosFactura.sub_desp],
    ["Comisión por canje de guía", 1, datosFactura.canje, datosFactura.canje],
    ["Comisión por transferencia (4%)","", "", datosFactura.comision],
  ];

  // Escribimos bases
  let cursor = startRow;
  for(const row of baseRows){
    wsFactura.getCell(cursor, colDesc).value = String(row[0]);
    if(row[1] !== "" && row[1] !== null && row[1] !== undefined){
      wsFactura.getCell(cursor, COL_CANT).value = Number(row[1]);
      wsFactura.getCell(cursor, COL_CANT).numFmt = "0.000";
    }
    if(row[2] !== "" && row[2] !== null && row[2] !== undefined){
      wsFactura.getCell(cursor, COL_UNIT).value = Number(row[2]);
      wsFactura.getCell(cursor, COL_UNIT).numFmt = "0.00";
    }
    if(row[3] !== "" && row[3] !== null && row[3] !== undefined){
      wsFactura.getCell(cursor, COL_SUB).value = Number(row[3]);
      wsFactura.getCell(cursor, COL_SUB).numFmt = "0.00";
    }
    cursor++;
  }

  // Reservar 5 filas vacías inmediatamente debajo de la comisión 4%
  const RESERVED = 5;
  const reservedStart = cursor;
  for(let i=0;i<RESERVED;i++){
    // dejamos celdas en blanco pero aplicamos formatos numéricos por si se usan
    wsFactura.getCell(reservedStart+i, COL_CANT).numFmt = "0.000";
    wsFactura.getCell(reservedStart+i, COL_UNIT).numFmt = "0.00";
    wsFactura.getCell(reservedStart+i, COL_SUB).numFmt = "0.00";
  }

  // Escribir EXTRAS sobre el bloque reservado (si hay más de 5, continúan luego)
  const extras = datosFactura.extras || [];
  for(let i=0;i<extras.length;i++){
    const r = (i < RESERVED) ? (reservedStart+i) : (reservedStart+RESERVED + (i-RESERVED));
    const [desc, qty, unit, total] = extras[i];
    wsFactura.getCell(r, colDesc).value = String(desc);
    wsFactura.getCell(r, COL_CANT).value = Number(qty);
    wsFactura.getCell(r, COL_CANT).numFmt = "0.000";
    wsFactura.getCell(r, COL_UNIT).value = Number(unit);
    wsFactura.getCell(r, COL_UNIT).numFmt = "0.00";
    wsFactura.getCell(r, COL_SUB).value = Number(total);
    wsFactura.getCell(r, COL_SUB).numFmt = "0.00";
  }

  // Calcular fila TOTAL: debajo del bloque reservado o debajo del último extra
  const usedExtrasRows = Math.max(RESERVED, extras.length);
  const TOTAL_ROW = reservedStart + usedExtrasRows;

  wsFactura.getCell(TOTAL_ROW, colDesc).value = "TOTAL USD";
  wsFactura.getCell(TOTAL_ROW, COL_SUB).value = Number(datosFactura.total.toFixed(2));
  wsFactura.getCell(TOTAL_ROW, COL_SUB).numFmt = "0.00";

  // (Opcional) dar un poquito de estilo al TOTAL (neutro por si tu plantilla ya lo tiene)
  wsFactura.getCell(TOTAL_ROW, colDesc).font = { bold: true };
  wsFactura.getCell(TOTAL_ROW, COL_SUB).font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();
  downloadBufferAsXlsx(buffer, nombreArchivo);
}

/* ===== UI base ===== */
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

/* ===== Datos iniciales (sin acentos) ===== */
const ESTADOS_INICIALES = ["Aereo","Maritimo","Ofrecer maritimo"];
const COURIERS_INICIALES = ["Aladin","Boss Box","Buzon","Caba Box","Click Box","Easy Box","Europa Envios","FastBox","Fixo Cargo","Fox Box","Global Box","Home Box","Inflight Box","Inter Couriers","MC Group","Miami Express","One Box","ParaguayBox","Royal Box"];
const ESTADOS_CARGA = ["En bodega","En transito","Arribado"];

function estadosPermitidosPorCarga(codigo){
  const s = String(codigo||"").toUpperCase();
  if (s.startsWith("AIR")) return ["Aereo"];
  if (s.startsWith("MAR")) return ["Maritimo"];
  if (s.startsWith("COMP")) return ["Ofrecer maritimo"];
  return ESTADOS_INICIALES;
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
        <button onClick={()=>onLogin({email,role,courier: role==="ADMIN"?null:courier})} disabled={!canSubmit} className={BTN_PRIMARY+" w-full mt-2 disabled:opacity-50"}>Entrar</button>
      </div>
    </div>
  );
}

/* ===== Gestión de cargas ===== */
function CargasAdmin({flights,setFlights, packages}){
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

  function missingScans(flight){
    const idsDeCarga = packages.filter(p=>p.flight_id===flight.id).map(p=>p.id);
    const asignados = new Set((flight.cajas||[]).flatMap(c=>c.paquetes||[]));
    return idsDeCarga.filter(id=>!asignados.has(id)).length;
  }

  function upd(id,field,value){
    if(field==="estado" && (value==="En transito" || value==="Arribado")){
      const f = flights.find(x=>x.id===id);
      if(f){
        const faltan = missingScans(f);
        if(faltan>0){
          const ok = window.confirm(`Atencion: faltan escanear ${faltan} paquete(s) en "Armado de cajas" para la carga ${f.codigo}. ¿Deseas continuar igualmente?`);
          if(!ok) return;
        }
      }
    }
    setFlights(flights.map(f=>f.id===id?{...f,[field]:value}:f));
  }

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

/* ===== Recepción ===== */
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

  const limpiar=(s)=>deaccent(String(s||"").toUpperCase().replace(/\s+/g,""));
  useEffect(()=>{
    if(!form.courier) return;
    const key="seq_"+limpiar(form.courier);
    const next=(Number(localStorage.getItem(key))||0)+1;
    const n= next>999?1:next;
    setForm(f=>({...f, codigo: `${limpiar(form.courier)}${n}`}));
    // eslint-disable-next-line
  },[form.courier]);

  const codigoCargaSel = flights.find(f=>f.id===flightId)?.codigo || "";
  const estadosPermitidos = estadosPermitidosPorCarga(codigoCargaSel);
  useEffect(()=>{
    if(form.estado && !estadosPermitidos.includes(form.estado)){
      setForm(f=>({...f, estado: estadosPermitidos[0] || ""}));
    }
    // eslint-disable-next-line
  },[flightId]);

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
      }catch{ alert("No se pudo acceder a la camara."); setCamOpen(false); }
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

  // etiqueta 100x60 (todo deaccent)
  const printLabel=()=>{
    const fl = flights.find(f=>f.id===flightId);
    if(!(form.codigo && form.desc && form.casilla && form.nombre)){ alert("Completa Codigo, Casilla, Nombre y Descripcion."); return; }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, String(form.codigo).toUpperCase(), { format:"CODE128", displayValue:false, height:50, margin:0 });
    const svgHtml = new XMLSerializer().serializeToString(svg);
    const medidas = `${L}x${A}x${H} cm`;
    const html = `
      <html><head><meta charset="utf-8"><title>Etiqueta</title>
      <style>
        @page { size: 100mm 60mm; margin: 5mm; } body { font-family: Arial, sans-serif; }
        .box { width: 100mm; height: 60mm; } .line { margin: 2mm 0; font-size: 12pt; } .b { font-weight: bold; }
        svg { width: 90mm; height: 18mm; }
      </style></head><body>
        <div class="box">
          <div class="line b">Codigo: ${deaccent(form.codigo)}</div>
          <div class="line">${svgHtml}</div>
          <div class="line">Cliente: ${deaccent(form.nombre)}</div>
          <div class="line">Casilla: ${deaccent(form.casilla)}</div>
          <div class="line">Peso: ${fmtPeso(peso)} kg</div>
          <div class="line">Medidas: ${deaccent(medidas)}</div>
          <div class="line">Desc: ${deaccent(form.desc)}</div>
          <div class="line">Carga: ${deaccent(fl?.codigo || "-")}</div>
        </div>
      </body></html>`;
    printHTMLInIframe(html);
  };

  const fileRef = useRef(null);
  const onFile = (e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader(); r.onload=()=>setForm(f=>({...f,foto:r.result})); r.readAsDataURL(file);
  };

  const [showMgr,setShowMgr]=useState(false);

  return (
    <Section
      title="Recepcion de paquete"
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
            <option value="">Seleccionar…</option>{estadosPermitidos.map(s=><option key={s}>{s}</option>)}
          </select>
        </Field>

        <Field label="Casilla" required><Input value={form.casilla} onChange={e=>setForm({...form,casilla:e.target.value})}/></Field>
        <Field label="Codigo de paquete" required><Input value={form.codigo} onChange={e=>setForm({...form,codigo:e.target.value.toUpperCase()})} placeholder="BOSSBOX1"/></Field>
        <Field label="Fecha" required><Input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})}/></Field>

        <Field label="Empresa de envio" required><Input value={form.empresa} onChange={e=>setForm({...form,empresa:e.target.value})}/></Field>
        <Field label="Nombre y apellido" required><Input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></Field>
        <Field label="Tracking" required><Input value={form.tracking} onChange={e=>setForm({...form,tracking:e.target.value})}/></Field>

        <Field label="Remitente" required><Input value={form.remitente} onChange={e=>setForm({...form,remitente:e.target.value})}/></Field>
        <Field label="Peso real (kg)" required><Input value={form.peso_real_txt} onChange={e=>setForm({...form,peso_real_txt:e.target.value})} placeholder="3,128"/></Field>
        <Field label="Largo (cm)" required><Input value={form.L_txt} onChange={e=>setForm({...form,L_txt:e.target.value})} placeholder="50"/></Field>
        <Field label="Ancho (cm)" required><Input value={form.A_txt} onChange={e=>setForm({...form,A_txt:e.target.value})} placeholder="30"/></Field>
        <Field label="Alto (cm)" required><Input value={form.H_txt} onChange={e=>setForm({...form,H_txt:e.target.value})} placeholder="20"/></Field>

        <Field label="Descripcion" required><Input value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})}/></Field>
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
        <InfoBox title="Peso facturable (min 0,200 kg)" value={`${fmtPeso(fact)} kg`}/>
        <InfoBox title="Peso volumetrico (A×H×L / 5000)" value={`${fmtPeso(vol)} kg`}/>
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

  const [viewer,setViewer]=useState(null);

  async function exportXLSX(){
    const header = [
      th("Carga"), th("Courier"), th("Estado"), th("Casilla"), th("Codigo de paquete"),
      th("Fecha"), th("Empresa de envio"), th("Nombre y apellido"), th("Tracking"),
      th("Remitente"), th("Peso facturable (min 0,200 kg)"), th("Exceso de volumen"),
      th("Medidas"), th("Descripcion"), th("Precio (EUR)")
    ];
    const body = rows.map(p=>{
      const carga = flights.find(f=>f.id===p.flight_id)?.codigo || "";
      const medidas = `${p.largo}x${p.ancho}x${p.alto} cm`;
      return [
        td(carga), td(p.courier), td(p.estado), td(p.casilla), td(p.codigo),
        td(p.fecha), td(p.empresa_envio||""), td(p.nombre_apellido||""), td(p.tracking||""),
        td(p.remitente||""), td(fmtPeso(p.peso_facturable)), td(fmtPeso(p.exceso_volumen)),
        td(medidas), td(p.descripcion||""), td(fmtMoney(p.valor_aerolinea||0))
      ];
    });

    const tpl = await tryLoadTemplate("/templates/bodega.xlsx");
    if(tpl){
      replacePlaceholdersInWB(tpl, { CARGA: flights.find(f=>f.id===flightId)?.codigo || "", FECHA: new Date().toISOString().slice(0,10) });
      appendSheet(tpl, "DATA", [header, ...body], {cols:[{wch:12},{wch:14},{wch:12},{wch:10},{wch:16},{wch:12},{wch:22},{wch:22},{wch:16},{wch:18},{wch:18},{wch:18},{wch:14},{wch:28},{wch:12}]});
      XLSX.writeFile(tpl, "Paquetes_en_bodega.xlsx");
      return;
    }
    const { ws } = sheetFromAOAStyled("Bodega", [header, ...body], {
      cols: [{wch:12},{wch:14},{wch:12},{wch:10},{wch:16},{wch:12},{wch:22},{wch:22},{wch:16},{wch:18},{wch:18},{wch:18},{wch:14},{wch:28},{wch:12}],
      rows: [{hpt:24}]
    });
    downloadXLSX("Paquetes_en_bodega.xlsx", [{name:"Bodega", ws}]);
  }

  const aggReal = {}; const aggExc = {};
  rows.forEach(p=>{ aggReal[p.courier]=(aggReal[p.courier]||0)+p.peso_real; aggExc[p.courier]=(aggExc[p.courier]||0)+p.exceso_volumen; });
  const dataReal = Object.entries(aggReal).map(([courier,kg_real])=>({courier,kg_real}));
  const dataExc  = Object.entries(aggExc).map(([courier,kg_exceso])=>({courier,kg_exceso}));
  const totalReal = sum(dataReal.map(d=>d.kg_real));
  const totalExc = sum(dataExc.map(d=>d.kg_exceso));

  function printPkgLabel(p){
    const L = p.largo||0, A=p.ancho||0, H=p.alto||0;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, String(p.codigo).toUpperCase(), { format:"CODE128", displayValue:false, height:50, margin:0 });
    const svgHtml = new XMLSerializer().serializeToString(svg);
    const medidas = `${L}x${A}x${H} cm`;
    const carga = flights.find(f=>f.id===p.flight_id)?.codigo || "-";
    const html = `
      <html><head><meta charset="utf-8"><title>Etiqueta</title>
      <style>
        @page { size: 100mm 60mm; margin: 5mm; } body { font-family: Arial, sans-serif; }
        .box { width: 100mm; height: 60mm; } .line { margin: 2mm 0; font-size: 12pt; } .b { font-weight: bold; }
        svg { width: 90mm; height: 18mm; }
      </style></head><body>
        <div class="box">
          <div class="line b">Codigo: ${deaccent(p.codigo)}</div>
          <div class="line">${svgHtml}</div>
          <div class="line">Cliente: ${deaccent(p.nombre_apellido||"")}</div>
          <div class="line">Casilla: ${deaccent(p.casilla||"")}</div>
          <div class="line">Peso: ${fmtPeso(p.peso_real||0)} kg</div>
          <div class="line">Medidas: ${deaccent(medidas)}</div>
          <div class="line">Desc: ${deaccent(p.descripcion||"")}</div>
          <div class="line">Carga: ${deaccent(carga)}</div>
        </div>
      </body></html>`;
    printHTMLInIframe(html);
  }

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
            {["Carga","Codigo","Casilla","Fecha","Nombre","Tracking","Peso real","Medidas","Exceso de volumen","Descripcion","Foto","Editar"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}
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

      {/* Graficos */}
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {[{data:dataReal,key:"kg_real",title:`Kg reales por courier. Total: `,total:totalReal},
          {data:dataExc,key:"kg_exceso",title:`Exceso volumetrico por courier. Total: `,total:totalExc}].map((g,ix)=>(
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

      <Modal open={open} onClose={()=>setOpen(false)} title="Editar paquete">
        {form && (
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Carga">
              <select className="w-full rounded-xl border px-3 py-2" value={form.flight_id} onChange={e=>setForm({...form,flight_id:e.target.value})}>
                {flights.map(f=><option key={f.id} value={f.id}>{f.codigo}</option>)}
              </select>
            </Field>
            <Field label="Courier"><Input value={form.courier} onChange={e=>setForm({...form,courier:e.target.value})}/></Field>
            <Field label="Estado">
              {(() => {
                const codigo = flights.find(f=>f.id===form.flight_id)?.codigo || "";
                const opts = estadosPermitidosPorCarga(codigo);
                return (
                  <select className="w-full rounded-xl border px-3 py-2" value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>
                    {opts.map(s=><option key={s}>{s}</option>)}
                  </select>
                );
              })()}
            </Field>

            <Field label="Casilla"><Input value={form.casilla} onChange={e=>setForm({...form,casilla:e.target.value})}/></Field>
            <Field label="Codigo de paquete"><Input value={form.codigo} onChange={e=>setForm({...form,codigo:e.target.value.toUpperCase()})}/></Field>
            <Field label="Fecha"><Input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})}/></Field>

            <Field label="Empresa de envio"><Input value={form.empresa_envio||""} onChange={e=>setForm({...form,empresa_envio:e.target.value})}/></Field>
            <Field label="Nombre y apellido"><Input value={form.nombre_apellido} onChange={e=>setForm({...form,nombre_apellido:e.target.value})}/></Field>
            <Field label="Tracking"><Input value={form.tracking} onChange={e=>setForm({...form,tracking:e.target.value})}/></Field>

            <Field label="Remitente"><Input value={form.remitente||""} onChange={e=>setForm({...form,remitente:e.target.value})}/></Field>
            <Field label="Peso real (kg)"><Input value={form.peso_real_txt} onChange={e=>setForm({...form,peso_real_txt:e.target.value})}/></Field>
            <Field label="Largo (cm)"><Input value={form.L_txt} onChange={e=>setForm({...form,L_txt:e.target.value})}/></Field>
            <Field label="Ancho (cm)"><Input value={form.A_txt} onChange={e=>setForm({...form,A_txt:e.target.value})}/></Field>
            <Field label="Alto (cm)"><Input value={form.H_txt} onChange={e=>setForm({...form,H_txt:e.target.value})}/></Field>

            <Field label="Descripcion"><Input value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})}/></Field>
            <Field label="Precio (EUR)"><Input value={form.valor_txt} onChange={e=>setForm({...form,valor_txt:e.target.value})}/></Field>

            <div className="md:col-span-3 flex items-center justify-between mt-2">
              <button onClick={()=>printPkgLabel(form)} className={BTN}>Reimprimir etiqueta</button>
              <div className="flex gap-2">
                <button onClick={save} className={BTN_PRIMARY}>Guardar</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!viewer} onClose={()=>setViewer(null)} title="Foto">
        {viewer && <img src={viewer} alt="foto" className="max-w-full rounded-xl" />}
      </Modal>
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

  async function exportTodo(){
    if(!flight) return;
    const headerP=[th("COURIER"),th("CODIGO"),th("CASILLA"),th("FECHA"),th("NOMBRE"),th("TRACKING"),th("PESO REAL"),th("FACTURABLE"),th("VOLUMETRICO"),th("EXCESO"),th("DESCRIPCION")];
    const bodyP=packages.filter(p=>p.flight_id===flightId).map(p=>[td(p.courier),td(p.codigo),td(p.casilla),td(p.fecha),td(p.nombre_apellido),td(p.tracking),td(fmtPeso(p.peso_real)),td(fmtPeso(p.peso_facturable)),td(fmtPeso(p.peso_volumetrico)),td(fmtPeso(p.exceso_volumen)),td(p.descripcion)]);

    const tpl = await tryLoadTemplate("/templates/cargas_enviadas.xlsx");
    if(tpl){
      replacePlaceholdersInWB(tpl, { CARGA: flight.codigo, FECHA: flight.fecha_salida||"" });
      appendSheet(tpl, "PAQUETES", [headerP,...bodyP], {cols:[{wch:16},{wch:14},{wch:10},{wch:12},{wch:22},{wch:16},{wch:12},{wch:12},{wch:14},{wch:12},{wch:28}]});
      appendSheet(tpl, "CAJAS", [[th("Nº Caja"),th("Courier"),th("Peso"),th("Largo"),th("Ancho"),th("Alto"),th("Volumetrico")], ...resumen.map(r=>[td(r.n),td(r.courier),td(fmtPeso(r.peso)),td(String(r.L)),td(String(r.A)),td(String(r.H)),td(fmtPeso(r.vol))]), [td(""),td("Totales"),td(fmtPeso(totPeso)),"","","",td(fmtPeso(totVol))]]);
      XLSX.writeFile(tpl, `Detalle_${flight.codigo}.xlsx`);
      return;
    }

    const shP=sheetFromAOAStyled("Paquetes", [headerP,...bodyP], {cols:[{wch:16},{wch:14},{wch:10},{wch:12},{wch:22},{wch:16},{wch:12},{wch:12},{wch:14},{wch:12},{wch:28}],rows:[{hpt:26}]});
    const shC=sheetFromAOAStyled("Cajas", [[th("Nº Caja"),th("Courier"),th("Peso"),th("Largo"),th("Ancho"),th("Alto"),th("Volumetrico")], ...resumen.map(r=>[td(r.n),td(r.courier),td(fmtPeso(r.peso)),td(String(r.L)),td(String(r.A)),td(String(r.H)),td(fmtPeso(r.vol))]), [td(""),td("Totales"),td(fmtPeso(totPeso)),"","","",td(fmtPeso(totVol))]]);
    downloadXLSX(`Detalle_${flight.codigo}.xlsx`, [shP, shC]);
  }

  return (
    <Section title="Cargas enviadas">
      <div className="grid md:grid-cols-5 gap-3">
        <Field label="Desde"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field>
        <Field label="Hasta"><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field>
        <Field label="Estado">
          <select className="w-full rounded-xl border px-3 py-2" value={estado} onChange={e=>setEstado(e.target.value)}>
            <option value="">Todos</option><option>En transito</option><option>Arribado</option>
          </select>
        </Field>
        <Field label="Carga">
          <select className="w-full rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {list.map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida} · {f.estado}</option>)}
          </select>
        </Field>
        <div className="flex items-end"><button onClick={exportTodo} disabled={!flight} className={BTN_PRIMARY+" w-full disabled:opacity-50"}>Exportar XLSX</button></div>
      </div>

      {!flight ? <div className="text-gray-500 mt-4">Elegi una carga para ver contenido.</div> : (
        <>
          <div className="overflow-auto mb-6 mt-4">
            <table className="min-w-full text-sm">
              <thead><tr className="bg-gray-50">{["Courier","Codigo","Casilla","Fecha","Nombre","Tracking","Peso real","Facturable","Volumetrico","Exceso"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
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
              <thead><tr className="bg-gray-50">{["Nº Caja","Courier","Peso","Largo","Ancho","Alto","Volumetrico"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
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
  const list = flights.filter(f=>!from || f.fecha_salida>=from).filter(f=>!to || f.fecha_salida<=to);
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

  async function exportX(r){
    if(!flight) return;
    const proc = r.kg_fact*T.proc, fr=r.kg_real*T.fleteReal, fe=r.kg_exc*T.fleteExc, desp=r.kg_fact*T.despacho;
    const canje=canjeGuiaUSD(r.kg_fact);
    const extrasList = extrasDeCourier(r.courier);
    const extrasMonto = extrasList.reduce((s,e)=>s+parseComma(e.monto),0);
    const com = 0.04*(proc+fr+fe+extrasMonto);
    const total = proc+fr+fe+desp+canje+extrasMonto+com;

    // detalle para la hoja DETALLE (transparencia)
    const detalle = [
      ["Procesamiento", Number(r.kg_fact.toFixed(3)), Number(T.proc.toFixed(2)), Number(proc.toFixed(2))],
      ["Flete peso real", Number(r.kg_real.toFixed(3)), Number(T.fleteReal.toFixed(2)), Number(fr.toFixed(2))],
      ["Flete exceso de volumen", Number(r.kg_exc.toFixed(3)), Number(T.fleteExc.toFixed(2)), Number(fe.toFixed(2))],
      ["Servicio de despacho", Number(r.kg_fact.toFixed(3)), Number(T.despacho.toFixed(2)), Number(desp.toFixed(2))],
      ["Comision por canje de guia", 1, Number(canje.toFixed(2)), Number(canje.toFixed(2))],
      ["Comision por transferencia (4%)","", "", Number(com.toFixed(2))],
      ...extrasList.map(e=>{
        const val = Number(parseComma(e.monto).toFixed(2));
        return [e.descripcion, 1, val, val]; // Cantidad 1,000 y unitario = total
      }),
    ];

    await exportProformaExcelJS_usingTemplate({
      plantillaUrl: "/templates/proforma.xlsx",
      logoUrl: "/logo.png",
      nombreArchivo: `proforma_${flight.codigo}_${r.courier}.xlsx`,
      datosFactura: {
        fechaCarga: flight.fecha_salida || "",
        courier: r.courier,
        kg_real: Number(r.kg_real.toFixed(3)),
        kg_fact: Number(r.kg_fact.toFixed(3)),
        kg_exc: Number(r.kg_exc.toFixed(3)),
        pu_proc: Number(T.proc.toFixed(2)), sub_proc: Number(proc.toFixed(2)),
        pu_real: Number(T.fleteReal.toFixed(2)), sub_real: Number(fr.toFixed(2)),
        pu_exc: Number(T.fleteExc.toFixed(2)), sub_exc: Number(fe.toFixed(2)),
        pu_desp: Number(T.despacho.toFixed(2)), sub_desp: Number(desp.toFixed(2)),
        canje: Number(canje.toFixed(2)),
        comision: Number(com.toFixed(2)),
        extras: extrasList.map(e=>{
          const val = Number(parseComma(e.monto).toFixed(2));
          return [e.descripcion, 1, val, val];
        }),
        total: Number(total.toFixed(2)),
        detalleParaSheet: detalle
      }
    });
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
      {!flight ? <div className="text-gray-500">Selecciona una carga.</div> : (
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

/* ===== Extras ===== */
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
  const del=(id)=> setExtras(extras.filter(e=>e.id!==id));

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
        <Field label="Descripcion"><Input value={desc} onChange={e=>setDesc(e.target.value)}/></Field>
        <Field label="Monto (USD)"><Input value={monto} onChange={e=>setMonto(e.target.value)} placeholder="10,00"/></Field>
        <Field label="Estado">
          <select className="w-full rounded-xl border px-3 py-2" value={estado} onChange={e=>setEstado(e.target.value)}>
            <option>Pendiente</option><option>Cobrado</option>
          </select>
        </Field>
        <Field label="Fecha"><Input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></Field>
      </div>
      <div className="flex justify-end mb-4">
        <button onClick={add} className={BTN_PRIMARY}>Agregar</button>
      </div>

      <div className="grid md:grid-cols-3 gap-2 mb-3">
        <Field label="Filtrar desde"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field>
        <Field label="Filtrar hasta"><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field>
        <div />
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="bg-gray-50">{["Fecha","Carga","Courier","Descripcion","Monto (USD)","Estado","Acciones"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(e=>{
              const carga = flights.find(f=>f.id===e.flight_id)?.codigo || "";
              return (
                <tr key={e.id} className="border-b">
                  <td className="px-3 py-2">{e.fecha || flights.find(f=>f.id===e.flight_id)?.fecha_salida || ""}</td>
                  <td className="px-3 py-2">{carga}</td>
                  <td className="px-3 py-2">{e.courier}</td>
                  <td className="px-3 py-2"><Input value={e.descripcion} onChange={ev=>upd(e.id,{descripcion:ev.target.value})}/></td>
                  <td className="px-3 py-2"><Input value={e.monto} onChange={ev=>upd(e.id,{monto:ev.target.value})}/></td>
                  <td className="px-3 py-2">
                    <select className="border rounded px-2 py-1" value={e.estado} onChange={ev=>upd(e.id,{estado:ev.target.value})}>
                      <option>Pendiente</option><option>Cobrado</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={()=>del(e.id)} className="px-2 py-1 border rounded text-red-600">Eliminar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ===== Manage lists ===== */
function ManageList({label,items,setItems}){
  const [txt,setTxt]=useState("");
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="font-medium mb-2">{label}</div>
      <div className="flex gap-2">
        <Input value={txt} onChange={e=>setTxt(e.target.value)} placeholder={`Agregar a ${label}`}/>
        <button className={BTN} onClick={()=>{ if(!txt.trim()) return; setItems([...items, txt.trim()]); setTxt(""); }}>Añadir</button>
      </div>
      <ul className="mt-2 text-sm">
        {items.map((x,i)=>(
          <li key={i} className="flex items-center justify-between py-1">
            <span>{x}</span>
            <button className="text-red-600 text-xs" onClick={()=>setItems(items.filter((_,j)=>j!==i))}>Quitar</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ===== App ===== */
function App(){
  const [currentUser,setCurrentUser]=useState(null);

  const [tab,setTab]=useState("Recepción");
  const tabs = ["Recepción","Paquetes en bodega","Armado de cajas","Cargas enviadas","Gestión de cargas","Proformas","Extras"];

  const [couriers,setCouriers]=useState(COURIERS_INICIALES);
  const [estados,setEstados]=useState(ESTADOS_INICIALES);

  const [flights,setFlights]=useState([
    { id:uuid(), codigo:"AIRSEP1 · 2025-09-07", fecha_salida:"2025-09-07", estado:"En bodega", awb:"", factura_cacesa:"", cajas:[] },
  ]);
  const [packages,setPackages]=useState([]);
  const [extras,setExtras]=useState([]);

  if(!currentUser) return <Login onLogin={setCurrentUser} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Gestor de Paquetes</div>
          <div className="text-xs text-gray-500">LaMaquinaLogistica / Europa Envios</div>
        </div>
        <div className="text-sm text-gray-600">{currentUser.role} — {currentUser.email}</div>
      </div>

      <div className="px-6">
        <div className="flex gap-2 flex-wrap mb-4">
          {tabs.map(t=>(
            <button key={t} onClick={()=>setTab(t)} className={"px-3 py-2 rounded-xl text-sm "+(tab===t?"bg-indigo-600 text-white":"bg-white border")}>{t}</button>
          ))}
        </div>

        {tab==="Recepción" && (
          <Reception
            currentUser={currentUser}
            couriers={couriers} setCouriers={setCouriers}
            estados={estados} setEstados={setEstados}
            flights={flights}
            onAdd={(p)=>setPackages([p,...packages])}
          />
        )}

        {tab==="Paquetes en bodega" && (
          <PaquetesBodega
            packages={packages}
            flights={flights}
            user={currentUser}
            onUpdate={(p)=>setPackages(packages.map(x=>x.id===p.id?p:x))}
          />
        )}

        {tab==="Armado de cajas" && (
          <ArmadoCajas
            packages={packages}
            flights={flights}
            setFlights={setFlights}
            onAssign={(id)=>setPackages(packages.map(p=>p.id===id?p:{...p}))}
          />
        )}

        {tab==="Cargas enviadas" && (
          <CargasEnviadas packages={packages} flights={flights} />
        )}

        {tab==="Gestión de cargas" && (
          <CargasAdmin flights={flights} setFlights={setFlights} packages={packages} />
        )}

        {tab==="Proformas" && (
          <Proformas packages={packages} flights={flights} extras={extras} />
        )}

        {tab==="Extras" && (
          <Extras flights={flights} couriers={couriers} extras={extras} setExtras={setExtras} />
        )}
      </div>
    </div>
  );
}

export default App;
