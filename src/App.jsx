/*  Europa Envíos – MVP 0.2.4 (proforma dinámica)
    - Etiquetas: CODE128 sin acentos.
    - Proformas: detección dinámica de columnas (Descripción/Cantidad/Unitario/Total) y fila de TOTAL.
      * Cantidad 3 decimales; Unitario/Total 2 decimales.
      * Extras y 4%: Cantidad=1,000 y Unitario=Total.
      * Respeta bordes/colores del template (no se tocan estilos).
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import * as XLSX from "xlsx-js-style";
import JsBarcode from "jsbarcode";
import ExcelJS from "exceljs/dist/exceljs.min.js";

/* ========== utils ========== */
const uuid = () => {
  try { if (window.crypto?.randomUUID) return window.crypto.randomUUID(); } catch {}
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};
const deaccent = (s) => String(s ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/ñ/g, "n").replace(/Ñ/g, "N");
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
const fmtPeso = (n) => Number(n || 0).toFixed(3).replace(".", ",");
const fmtMoney = (n) => Number(n || 0).toFixed(2).replace(".", ",");
const sum = (a) => a.reduce((s, x) => s + Number(x || 0), 0);
const COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#3B82F6","#8B5CF6","#14B8A6","#84CC16","#F97316"];
const MIN_FACTURABLE = 0.2;
const limpiar = (s) => deaccent(String(s || "")).toUpperCase().replace(/\s+/g, "");

/* ========== impresión sin about:blank ========== */
function printHTMLInIframe(html){
  const iframe = document.createElement("iframe");
  Object.assign(iframe.style, { position:"fixed", right:"0", bottom:"0", width:"0", height:"0", border:"0" });
  document.body.appendChild(iframe);
  const cleanup = () => setTimeout(()=> { try{ document.body.removeChild(iframe); }catch{} }, 500);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => {
    try{
      iframe.contentWindow.focus();
      const after = () => { iframe.contentWindow.removeEventListener?.("afterprint", after); cleanup(); };
      iframe.contentWindow.addEventListener?.("afterprint", after);
      iframe.contentWindow.print();
    }catch{
      cleanup();
      alert("No se pudo generar la etiqueta.");
    }
  }, 60);
}

/* ========== Etiquetas (fix acentos) ========== */
function barcodeSVG(text){
  const safe = deaccent(String(text)).toUpperCase(); // CODE128 solo ASCII
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, safe, { format:"CODE128", displayValue:false, height:50, margin:0 });
  return new XMLSerializer().serializeToString(svg);
}
function labelHTML({ codigo, nombre, casilla, pesoKg, medidasTxt, desc, cargaTxt }){
  const svgHtml = barcodeSVG(codigo);
  return `
    <html><head><meta charset="utf-8"><title>Etiqueta</title>
    <style>
      @page { size: 100mm 60mm; margin: 5mm; }
      body { font-family: Arial, sans-serif; }
      .box { width: 100mm; height: 60mm; }
      .line { margin: 2mm 0; font-size: 12pt; }
      .b { font-weight: bold; }
      svg { width: 90mm; height: 18mm; }
    </style></head><body>
      <div class="box">
        <div class="line b">Codigo: ${deaccent(codigo ?? "")}</div>
        <div class="line">${svgHtml}</div>
        <div class="line">Cliente: ${deaccent(nombre ?? "")}</div>
        <div class="line">Casilla: ${deaccent(casilla ?? "")}</div>
        <div class="line">Peso: ${fmtPeso(pesoKg)} kg</div>
        <div class="line">Medidas: ${deaccent(medidasTxt ?? "")}</div>
        <div class="line">Desc: ${deaccent(desc ?? "")}</div>
        <div class="line">Carga: ${deaccent(cargaTxt ?? "-")}</div>
      </div>
    </body></html>`;
}

/* ========== XLSX fallback (para otros exports) ========== */
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

/* ====== carga de plantillas XLSX (xlsx-js-style) ====== */
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

/* ========== ExcelJS helpers (proforma con logo/formatos) ========== */
const LOGO_TL = { col: 2, row: 2 };   // B2
const LOGO_BR = { col: 4, row: 8 };   // D8
const PX_PER_CHAR = 7.2;
const PX_PER_POINT = 96/72;
function colWidthPx(ws, col){ const c = ws.getColumn(col); const w = c.width ?? 8.43; return Math.round(w * PX_PER_CHAR); }
function rowHeightPx(ws, row){ const r = ws.getRow(row); const h = r.height ?? 15; return Math.round(h * PX_PER_POINT); }
function boxSizePx(ws, tl, br){
  let w=0,h=0;
  for(let c=tl.col; c<=br.col; c++) w += colWidthPx(ws, c);
  for(let r=tl.row; r<=br.row; r++) h += rowHeightPx(ws, r);
  return { w, h };
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

/* ====== NUEVO: detección dinámica de columnas y fila TOTAL ====== */
function normalizeTxt(x){
  return deaccent(String(x||"").trim()).toUpperCase().replace(/\s+/g," ");
}
function findProformaAnchors(ws){
  // Busca una fila que contenga (en cualquier orden) los encabezados clave
  const wanted = {
    DESC: ["DESCRIPCION","DESCRIPCIÓN"],
    CANT: ["CANTIDAD"],
    UNIT: ["PRECIO UNITARIO","P. UNITARIO","P.UNITARIO","UNITARIO"],
    SUBT: ["PRECIO TOTAL","IMPORTE","TOTAL LINEA","TOTAL LÍNEA"]
  };
  let headerRow = null;
  const matchCell = (txt, arr) => arr.some(k=>normalizeTxt(txt)===k);
  for(let r=1; r<=100; r++){
    let found = {DESC:null,CANT:null,UNIT:null,SUBT:null};
    for(let c=1; c<=30; c++){
      const v = ws.getCell(r,c).value;
      const txt = (v && typeof v==="object" && v.richText) ? v.richText.map(t=>t.text).join("") : v;
      if(!txt) continue;
      const n = normalizeTxt(txt);
      if(!found.DESC && wanted.DESC.some(k=>n===k)) found.DESC = c;
      if(!found.CANT && wanted.CANT.some(k=>n===k)) found.CANT = c;
      if(!found.UNIT && wanted.UNIT.some(k=>n===k)) found.UNIT = c;
      if(!found.SUBT && wanted.SUBT.some(k=>n===k)) found.SUBT = c;
    }
    if(found.DESC && found.CANT && found.UNIT && found.SUBT){
      headerRow = r;
      // columnas detectadas directamente (no asumimos contigüidad)
      return { headerRow, colDesc:found.DESC, colCant:found.CANT, colUnit:found.UNIT, colSub:found.SUBT };
    }
  }
  // fallback clásico (si no se detecta, usa A:D desde fila 16)
  return { headerRow: 15, colDesc:1, colCant:2, colUnit:3, colSub:4 };
}
function findTotalRow(ws, preferCol){
  // Busca una celda que contenga "TOTAL" (con o sin USD), priorizando la columna preferida (normalmente Descripción)
  let candidate = null;
  for(let r=1; r<=200; r++){
    for(let c=1; c<=30; c++){
      const v = ws.getCell(r,c).value;
      const txt = (v && typeof v==="object" && v.richText) ? v.richText.map(t=>t.text).join("") : v;
      if(!txt) continue;
      const n = normalizeTxt(txt);
      if(n.includes("TOTAL")){
        if(preferCol && c===preferCol) return r;
        if(!candidate) candidate = r;
      }
    }
  }
  return candidate; // puede ser null; en tal caso pondremos total debajo de la última línea escrita
}

/* 
  Exportación de PROFORMA con plantilla nueva (dinámica):
  - Detecta la fila de encabezados y columnas para Descripción/Cantidad/Unitario/Total.
  - Escribe ítems sin tocar estilos (solo .value y .numFmt).
  - Formatos: Cantidad 0.000; Unit/Total 0.00
  - Extras y 4%: Cantidad=1,000 y Unitario=Total
  - TOTAL: si existe celda con "TOTAL" la usa (mismo r) y escribe en colSub; si no, lo pone al final.
*/
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

  // LOGO (se coloca en el cuadro B2:D8; no toca estilos de la hoja)
  try{
    const { base64, width: imgW, height: imgH } = await loadLogoInfo(logoUrl);
    const imageId = wb.addImage({ base64, extension: "png" });

    const { w: boxW, h: boxH } = boxSizePx(wsFactura, LOGO_TL, LOGO_BR);
    const scale = Math.min(boxW / imgW, boxH / imgH);
    const extW = Math.round(imgW * scale);
    const extH = Math.round(imgH * scale);
    const offX = Math.max(0, (boxW - extW) / 2);
    const offY = Math.max(0, (boxH - extH) / 2);

    const tlColWidth = colWidthPx(wsFactura, LOGO_TL.col);
    const tlRowHeight = rowHeightPx(wsFactura, LOGO_TL.row);

    const tlColFloat = (LOGO_TL.col - 1) + (offX / tlColWidth);
    const tlRowFloat = (LOGO_TL.row - 1) + (offY / tlRowHeight);

    wsFactura.addImage(imageId, {
      tl: { col: tlColFloat, row: tlRowFloat },
      ext: { width: extW, height: extH },
      editAs: "oneCell"
    });
  }catch(e){ console.warn("No se pudo insertar el logo:", e); }

  // Detectar anclajes de tabla (encabezados)
  const { headerRow, colDesc, colCant, colUnit, colSub } = findProformaAnchors(wsFactura);
  const startRow = headerRow + 1;

  // Limpiar área (solo values; conserva estilos)
  const maxFilas = 80;
  for (let r = startRow; r < startRow + maxFilas; r++) {
    wsFactura.getCell(r, colDesc).value = "";
    wsFactura.getCell(r, colCant).value = "";
    wsFactura.getCell(r, colUnit).value = "";
    wsFactura.getCell(r, colSub ).value = "";
  }

  // Construcción de filas a escribir
  const filas = [
    ["Procesamiento", datosFactura.kg_fact, datosFactura.pu_proc, datosFactura.sub_proc],
    ["Flete peso real", datosFactura.kg_real, datosFactura.pu_real, datosFactura.sub_real],
    ["Flete exceso de volumen", datosFactura.kg_exc, datosFactura.pu_exc, datosFactura.sub_exc],
    ["Servicio de despacho", datosFactura.kg_fact, datosFactura.pu_desp, datosFactura.sub_desp],
    ["Comisión por canje de guía", 1, datosFactura.canje, datosFactura.canje],
    // Extras: Cantidad=1, Unitario=Total (mantiene colores del template)
    ...datosFactura.extras.map(([desc, , , total]) => [desc, 1, total, total]),
    // 4%: Cantidad=1, Unitario=Total
    ["Comisión por transferencia (4%)", 1, datosFactura.comision, datosFactura.comision]
  ];

  // Escribir respetando formatos
  filas.forEach((row, i)=>{
    const r = startRow+i;
    wsFactura.getCell(r, colDesc).value = String(row[0]);

    const qty = row[1];
    if(qty !== "" && qty !== null && qty !== undefined){
      wsFactura.getCell(r, colCant).value = Number(qty);
      wsFactura.getCell(r, colCant).numFmt = "0.000";
    }

    const unit = row[2];
    if(unit !== "" && unit !== null && unit !== undefined){
      wsFactura.getCell(r, colUnit).value = Number(unit);
      wsFactura.getCell(r, colUnit).numFmt = "0.00";
    }

    const sub = row[3];
    if(sub !== "" && sub !== null && sub !== undefined){
      wsFactura.getCell(r, colSub).value = Number(sub);
      wsFactura.getCell(r, colSub).numFmt = "0.00";
    }
  });

  // TOTAL: buscar fila con "TOTAL" (en cualquier columna), priorizando la columna de Descripción
  let totalRow = findTotalRow(wsFactura, colDesc);
  if(!totalRow) totalRow = startRow + filas.length;

  // Escribir solamente en la columna de total (sin tocar colores/bordes)
  wsFactura.getCell(totalRow, colSub).value  = Number(datosFactura.total.toFixed(2));
  wsFactura.getCell(totalRow, colSub).numFmt = "0.00";

  // Hoja DETALLE (opcional, solo para control)
  const wsDet = wb.getWorksheet("DETALLE") || wb.addWorksheet("DETALLE");
  wsDet.getRow(1).values = ["Descripción","Cantidad","P. unitario","Total"];
  datosFactura.detalleParaSheet.forEach((row, i)=>{
    const r = wsDet.getRow(2+i);
    r.getCell(1).value = row[0];
    if(row[1] !== "" && row[1] !== null && row[1] !== undefined){
      r.getCell(2).value = Number(row[1]); r.getCell(2).numFmt = "0.000";
    }
    if(row[2] !== "" && row[2] !== null && row[2] !== undefined){
      r.getCell(3).value = Number(row[2]); r.getCell(3).numFmt = "0.00";
    }
    if(row[3] !== "" && row[3] !== null && row[3] !== undefined){
      r.getCell(4).value = Number(row[3]); r.getCell(4).numFmt = "0.00";
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  downloadBufferAsXlsx(buffer, nombreArchivo);
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
    <div className="text-sm text-gray-700 mb-1">
      {label}{required && <span className="text-red-500"> *</span>}
    </div>
    {children}
  </label>
);
const Input = (p)=>(
  <input {...p} className={"w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 ring-indigo-500 "+(p.className||"")} />
);
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

/* ========== datos iniciales (listas) ========== */
const ESTADOS_INICIALES = ["Aéreo","Marítimo","Ofrecer marítimo"];
const COURIERS_INICIALES = [
  "Aladín","Boss Box","Buzón","Caba Box","Click Box","Easy Box","Europa Envíos",
  "FastBox","Fixo Cargo","Fox Box","Global Box","Home Box","Inflight Box","Inter Couriers",
  "MC Group","Miami Express","One Box","ParaguayBox","Royal Box"
];
const ESTADOS_CARGA = ["En bodega","En tránsito","Arribado"];

function estadosPermitidosPorCarga(codigo){
  const s = String(codigo||"").toUpperCase();
  if (s.startsWith("AIR")) return ["Aéreo"];
  if (s.startsWith("MAR")) return ["Marítimo"];
  if (s.startsWith("COMP")) return ["Ofrecer marítimo"];
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
        <Field label="Email" required>
          <Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@empresa.com"/>
        </Field>
        <Field label="Rol" required>
          <select className="w-full rounded-xl border px-3 py-2" value={role} onChange={(e)=>setRole(e.target.value)}>
            <option>ADMIN</option><option>COURIER</option>
          </select>
        </Field>
        {role==="COURIER" && (
          <Field label="Courier" required>
            <Input value={courier} onChange={e=>setCourier(e.target.value)}/>
          </Field>
        )}
        <button
          onClick={()=>onLogin({email,role,courier: role==="ADMIN"?null:courier})}
          disabled={!canSubmit}
          className={BTN_PRIMARY+" w-full mt-2 disabled:opacity-50"}
        >
          Entrar
        </button>
      </div>
    </div>
  );
}

/* ========== Gestión de cargas (con ELIMINAR) ========== */
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

  // paquetes sin asignar a caja (para alerta)
  function missingScans(flight){
    const idsDeCarga = packages.filter(p=>p.flight_id===flight.id).map(p=>p.id);
    const asignados = new Set((flight.cajas||[]).flatMap(c=>c.paquetes||[]));
    return idsDeCarga.filter(id=>!asignados.has(id)).length;
  }

  function upd(id,field,value){
    if(field==="estado" && (value==="En tránsito" || value==="Arribado")){
      const f = flights.find(x=>x.id===id);
      if(f){
        const faltan = missingScans(f);
        if(faltan>0){
          const ok = window.confirm(`Atención: faltan escanear ${faltan} paquete(s) en "Armado de cajas" para la carga ${f.codigo}. ¿Deseás continuar igualmente?`);
          if(!ok) return;
        }
      }
    }
    setFlights(flights.map(f=>f.id===id?{...f,[field]:value}:f));
  }

  function del(id){
    const f = flights.find(x=>x.id===id);
    const nombre = f?.codigo || "esta carga";
    const confirmar = window.confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`);
    if(!confirmar) return;
    setFlights(flights.filter(f=>f.id!==id));
  }

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
          <Input placeholder="Código de carga" value={code} onChange={e=>setCode(e.target.value)}/>
          <Input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
          <Input placeholder="AWB (opcional)" value={awb} onChange={e=>setAwb(e.target.value)}/>
          <Input placeholder="Factura Cacesa (opcional)" value={fac} onChange={e=>setFac(e.target.value)}/>
          <button onClick={create} className={BTN_PRIMARY}>Crear</button>
        </div>
      }>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {["Código","Fecha salida","Estado","AWB","Factura Cacesa","Cajas","Acciones"].map(h=>
                <th key={h} className="text-left px-3 py-2">{h}</th>
              )}
            </tr>
          </thead>
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
                <td className="px-3 py-2">
                  <button className="px-2 py-1 border rounded text-red-600" onClick={()=>del(f.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {list.length===0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-500 py-6">Sin resultados.</td>
              </tr>
            )}
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

  // Generar código basado en courier sin acentos/espacios (ej: "EUROPAENVIOS23")
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
  const fact = Math.max(MIN_FACTURABLE, peso||0);
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
      codigo: form.codigo, // ya saneado
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

  // Cámara
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

  // Etiqueta 100x60: labelHTML deacentúa todo (código, cliente, etc.)
  const printLabel=()=>{
    const fl = flights.find(f=>f.id===flightId);
    if(!(form.codigo && form.desc && form.casilla && form.nombre)){ alert("Completá Código, Casilla, Nombre y Descripción."); return; }
    const medidas = `${L}x${A}x${H} cm`;
    const html = labelHTML({
      codigo: form.codigo,
      nombre: form.nombre,
      casilla: form.casilla,
      pesoKg: peso,
      medidasTxt: medidas,
      desc: form.desc,
      cargaTxt: fl?.codigo || "-"
    });
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
            <option value="">Seleccionar…</option>{estadosPermitidos.map(s=><option key={s}>{s}</option>)}
          </select>
        </Field>

        <Field label="Casilla" required><Input value={form.casilla} onChange={e=>setForm({...form,casilla:e.target.value})}/></Field>
        <Field label="Código de paquete" required>
          <Input value={form.codigo} onChange={e=>setForm({...form,codigo:limpiar(e.target.value)})} placeholder="BOSSBOX1"/>
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
function PaquetesBodega({packages, flights, user, onUpdate}){
  const [q,setQ]=useState("");
  const [flightId,setFlightId]=useState("");
  const vuelosBodega = flights.filter(f=>f.estado==="En bodega");

  const rows = packages
    .filter(p => flights.find(f=>f.id===p.flight_id)?.estado==="En bodega")
    .filter(p => !flightId || p.flight_id===flightId)
    .filter(p => (p.codigo + p.casilla + p.tracking + p.nombre_apellido + p.courier).toLowerCase().includes(q.toLowerCase()))
    .filter(p => user.role!=="COURIER" || p.courier===user.courier);

  // editor
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
    const fact = Math.max(MIN_FACTURABLE, peso||0);
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

  // EXPORT bodega
  async function exportXLSX(){
    const header = [
      th("Carga"), th("Courier"), th("Estado"), th("Casilla"), th("Código de paquete"),
      th("Fecha"), th("Empresa de envío"), th("Nombre y apellido"), th("Tracking"),
      th("Remitente"), th("Peso facturable (mín 0,200 kg)"), th("Exceso de volumen"),
      th("Medidas"), th("Descripción"), th("Precio (EUR)")
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

  // agregados
  const aggReal = {}; const aggExc = {};
  rows.forEach(p=>{ aggReal[p.courier]=(aggReal[p.courier]||0)+p.peso_real; aggExc[p.courier]=(aggExc[p.courier]||0)+p.exceso_volumen; });
  const dataReal = Object.entries(aggReal).map(([courier,kg_real])=>({courier,kg_real}));
  const dataExc  = Object.entries(aggExc).map(([courier,kg_exceso])=>({courier,kg_exceso}));
  const totalReal = sum(dataReal.map(d=>d.kg_real));
  const totalExc = sum(dataExc.map(d=>d.kg_exceso));

  function printPkgLabel(p){
    const L = p.largo||0, A=p.ancho||0, H=p.alto||0;
    const carga = flights.find(f=>f.id===p.flight_id)?.codigo || "-";
    const html = labelHTML({
      codigo: p.codigo,
      nombre: p.nombre_apellido || "",
      casilla: p.casilla || "",
      pesoKg: p.peso_real || 0,
      medidasTxt: `${L}x${A}x${H} cm`,
      desc: p.descripcion || "",
      cargaTxt: carga
    });
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
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button className="px-2 py-1 border rounded" onClick={()=>start(p)}>Editar</button>
                      <button className="px-2 py-1 border rounded" onClick={()=>printPkgLabel(p)}>Etiqueta</button>
                    </div>
                  </td>
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

      {/* Modal edición */}
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
            <Field label="Código de paquete"><Input value={form.codigo} onChange={e=>setForm({...form,codigo:limpiar(e.target.value)})}/></Field>
            <Field label="Fecha"><Input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})}/></Field>

            <Field label="Empresa de envío"><Input value={form.empresa_envio||""} onChange={e=>setForm({...form,empresa_envio:e.target.value})}/></Field>
            <Field label="Nombre y apellido"><Input value={form.nombre_apellido} onChange={e=>setForm({...form,nombre_apellido:e.target.value})}/></Field>
            <Field label="Tracking"><Input value={form.tracking} onChange={e=>setForm({...form,tracking:e.target.value})}/></Field>

            <Field label="Remitente"><Input value={form.remitente||""} onChange={e=>setForm({...form,remitente:e.target.value})}/></Field>
            <Field label="Peso real (kg)"><Input value={form.peso_real_txt} onChange={e=>setForm({...form,peso_real_txt:e.target.value})}/></Field>
            <Field label="Largo (cm)"><Input value={form.L_txt} onChange={e=>setForm({...form,L_txt:e.target.value})}/></Field>
            <Field label="Ancho (cm)"><Input value={form.A_txt} onChange={e=>setForm({...form,A_txt:e.target.value})}/></Field>
            <Field label="Alto (cm)"><Input value={form.H_txt} onChange={e=>setForm({...form,H_txt:e.target.value})}/></Field>

            <Field label="Descripción"><Input value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})}/></Field>
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

      {/* Visor de foto */}
      <Modal open={!!viewer} onClose={()=>setViewer(null)} title="Foto">
        {viewer && <img src={viewer} alt="foto" className="max-w-full rounded-xl" />}
      </Modal>
    </Section>
  );
}

/* ========== Armado de cajas (Editar / Guardar y caja activa) ========== */
function ArmadoCajas({packages, flights, setFlights, onAssign}){
  const [flightId,setFlightId]=useState("");
  const flight = flights.find(f=>f.id===flightId);
  const [scan,setScan]=useState("");
  const [activeBoxId, setActiveBoxId] = useState(null);
  const [editingBoxId, setEditingBoxId] = useState(null);

  useEffect(()=>{
    // cuando cambia la carga, establecer la primera caja activa
    if(flight && flight.cajas.length>0){
      setActiveBoxId(flight.cajas[0].id);
      setEditingBoxId(null);
    }else{
      setActiveBoxId(null);
      setEditingBoxId(null);
    }
  },[flightId]); // eslint-disable-line

  function addBox(){ if(!flightId) return;
    const n = (flight?.cajas?.length||0)+1;
    setFlights(flights.map(f=>f.id!==flightId?f:{...f,cajas:[...f.cajas,{id:uuid(),codigo:`Caja ${n}`,paquetes:[],peso:"",L:"",A:"",H:""}]}));
    setTimeout(()=>{
      const nf = flights.find(f=>f.id===flightId);
      if(nf?.cajas?.length) setActiveBoxId(nf.cajas[nf.cajas.length-1]?.id);
    },0);
  }
  function updBox(id,field,val){ if(!flightId||!id) return;
    // valida nombre único
    if(field==="codigo"){
      const dup = flight.cajas.some(c=>c.id!==id && String(c.codigo).trim().toLowerCase()===String(val).trim().toLowerCase());
      if(dup){ alert("El nombre de la caja no puede repetirse para esta carga."); return; }
    }
    setFlights(flights.map(f=>f.id!==flightId?f:{...f,cajas:f.cajas.map(c=>c.id!==id?c:{...c,[field]:val})}));
  }
  function assign(){
    if(!scan||!flight) return;
    const pkg = packages.find(p=> p.flight_id===flightId && p.codigo.toUpperCase()===scan.toUpperCase());
    if(!pkg){ alert("No existe ese código en esta carga."); setScan(""); return; }
    if(flight.cajas.some(c=>c.paquetes.includes(pkg.id))){ alert("Ya está en una caja."); setScan(""); return; }
    const activeId = activeBoxId || flight.cajas[0]?.id;
    if(!activeId){ alert("Creá una caja primero."); return; }
    setFlights(flights.map(f=>f.id!==flightId?f:{...f, cajas:f.cajas.map(c=>c.id!==activeId?c:{...c,paquetes:[...c.paquetes, pkg.id]})}));
    onAssign(pkg.id); setScan("");
  }
  function move(pid,fromId,toId){
    if(!toId||!flight) return;
    setFlights(prev=>prev.map(f=>f.id!==flightId?f:{...f,cajas:f.cajas.map(c=>c.id===fromId?{...c,paquetes:c.paquetes.filter(x=>x!==pid)}:c)}));
    setFlights(prev=>prev.map(f=>f.id!==flightId?f:{...f,cajas:f.cajas.map(c=>c.id===toId?{...c,paquetes:[...c.paquetes,pid]}:c)}));
  }
  function removeBox(id){
    if(!flight) return;
    setFlights(flights.map(f=>f.id!==flightId?f:{...f,cajas:f.cajas.filter(c=>c.id!==id)}));
    if(activeBoxId===id) setActiveBoxId(null);
    if(editingBoxId===id) setEditingBoxId(null);
  }
  function reorderBox(id,dir){
    if(!flight) return;
    const arr=[...flight.cajas];
    const i=arr.findIndex(c=>c.id===id); if(i<0) return;
    const j = dir==="up"? i-1 : i+1;
    if(j<0||j>=arr.length) return;
    [arr[i],arr[j]]=[arr[j],arr[i]];
    setFlights(flights.map(f=>f.id!==flightId?f:{...f,cajas:arr}));
  }

  return (
    <Section title="Armado de cajas">
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Seleccionar carga" required>
          <select className="w-full rounded-xl border px-3 py-2" value={flightId} onChange={e=>{setFlightId(e.target.value);}}>
            <option value="">—</option>
            {flights.filter(f=>f.estado==="En bodega").map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
          </select>
        </Field>

        <Field label="Escanear / ingresar código">
          <Input value={scan} onChange={e=>setScan(limpiar(e.target.value))} onKeyDown={e=>e.key==="Enter"&&assign()} placeholder="BOSSBOX1"/>
        </Field>

        <div className="flex items-end">
          <button onClick={addBox} disabled={!flightId} className={"px-3 py-2 bg-gray-800 text-white rounded-xl disabled:opacity-50"}>Agregar caja</button>
        </div>

        <div className="md:col-span-3">
          {!flight && <div className="text-gray-500">Seleccioná una carga.</div>}
          {flight && flight.cajas.map((c)=>{
            const couriers = new Set(c.paquetes.map(pid=>packages.find(p=>p.id===pid)?.courier).filter(Boolean));
            const etiqueta = couriers.size===0? "—" : (couriers.size===1? [...couriers][0] : "MULTICOURIER");
            const isActive = activeBoxId===c.id;
            const isEditing = editingBoxId===c.id;
            const peso = parseComma(c.peso||"0");
            const L=parseIntEU(c.L||0), A=parseIntEU(c.A||0), H=parseIntEU(c.H||0);

            return (
              <div key={c.id} className={`border rounded-2xl p-3 mb-3 ${isActive?"ring-2 ring-indigo-400":"hover:ring-1 hover:ring-indigo-200"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">
                    {c.codigo} — {etiqueta} — <span className="font-semibold">{fmtPeso(peso)} kg</span> — {L}x{A}x{H} cm
                    {isActive && <span className="ml-2 text-indigo-600 text-sm">(activa)</span>}
                  </div>
                  <div className="flex gap-2">
                    {!isEditing
                      ? <button className="px-2 py-1 border rounded" onClick={()=>{setActiveBoxId(c.id); setEditingBoxId(c.id);}}>Editar</button>
                      : <button className="px-2 py-1 border rounded bg-indigo-600 text-white" onClick={()=>{setEditingBoxId(null); setActiveBoxId(c.id);}}>Guardar</button>
                    }
                    <button className="px-2 py-1 border rounded" onClick={()=>reorderBox(c.id,"up")}>↑</button>
                    <button className="px-2 py-1 border rounded" onClick={()=>reorderBox(c.id,"down")}>↓</button>
                    <button className="px-2 py-1 border rounded text-red-600" onClick={()=>removeBox(c.id)}>Eliminar</button>
                  </div>
                </div>

                {isEditing && (
                  <div className="grid md:grid-cols-5 gap-2 mb-2">
                    <Field label="Nombre de caja">
                      <Input value={c.codigo} onChange={e=>updBox(c.id,"codigo",e.target.value)}/>
                    </Field>
                    <Field label="Peso caja (kg)"><Input value={c.peso||""} onChange={e=>updBox(c.id,"peso", e.target.value)} placeholder="3,128"/></Field>
                    <Field label="Largo (cm)"><Input value={c.L||""} onChange={e=>updBox(c.id,"L", e.target.value)}/></Field>
                    <Field label="Ancho (cm)"><Input value={c.A||""} onChange={e=>updBox(c.id,"A", e.target.value)}/></Field>
                    <Field label="Alto (cm)"><Input value={c.H||""} onChange={e=>updBox(c.id,"H", e.target.value)}/></Field>
                  </div>
                )}

                <ul className="text-sm max-h-48 overflow-auto">
                  {c.paquetes.map(pid=>{
                    const p=packages.find(x=>x.id===pid); if(!p) return null;
                    return (
                      <li key={pid} className="flex items-center gap-2 py-1 border-b">
                        <span className="font-mono">{p.codigo}</span><span className="text-gray-600">{p.courier}</span>
                        <button className="text-red-600 text-xs" onClick={()=>updBox(c.id,"paquetes", c.paquetes.filter(z=>z!==pid))}>Quitar</button>
                        {flight.cajas.length>1 && (
                          <select className="text-xs border rounded px-1 py-0.5 ml-auto" defaultValue="" onChange={e=>move(pid,c.id,e.target.value)}>
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
      </div>
    </Section>
  );
}
/* ========== Cargas enviadas ========== */
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
    const headerP=[th("COURIER"),th("CÓDIGO"),th("CASILLA"),th("FECHA"),th("NOMBRE"),th("TRACKING"),th("PESO REAL"),th("FACTURABLE"),th("VOLUMÉTRICO"),th("EXCESO"),th("DESCRIPCIÓN")];
    const bodyP=packages
      .filter(p=>p.flight_id===flightId)
      .map(p=>[
        td(p.courier),td(p.codigo),td(p.casilla),td(p.fecha),td(p.nombre_apellido),
        td(p.tracking),td(fmtPeso(p.peso_real)),td(fmtPeso(p.peso_facturable)),
        td(fmtPeso(p.peso_volumetrico)),td(fmtPeso(p.exceso_volumen)),td(p.descripcion)
      ]);

    const tpl = await tryLoadTemplate("/templates/cargas_enviadas.xlsx");
    if(tpl){
      replacePlaceholdersInWB(tpl, { CARGA: flight.codigo, FECHA: flight.fecha_salida||"" });
      appendSheet(tpl, "PAQUETES", [headerP,...bodyP], {cols:[{wch:16},{wch:14},{wch:10},{wch:12},{wch:22},{wch:16},{wch:12},{wch:12},{wch:14},{wch:12},{wch:28}]});
      appendSheet(tpl, "CAJAS", [
        [th("Nº Caja"),th("Courier"),th("Peso"),th("Largo"),th("Ancho"),th("Alto"),th("Volumétrico")],
        ...resumen.map(r=>[td(r.n),td(r.courier),td(fmtPeso(r.peso)),td(String(r.L)),td(String(r.A)),td(String(r.H)),td(fmtPeso(r.vol))]),
        [td(""),td("Totales"),td(fmtPeso(totPeso)),"","","",td(fmtPeso(totVol))]
      ]);
      XLSX.writeFile(tpl, `Detalle_${flight.codigo}.xlsx`);
      return;
    }

    const shP=sheetFromAOAStyled("Paquetes", [headerP,...bodyP], {
      cols:[{wch:16},{wch:14},{wch:10},{wch:12},{wch:22},{wch:16},{wch:12},{wch:12},{wch:14},{wch:12},{wch:28}],
      rows:[{hpt:26}]
    });
    const shC=sheetFromAOAStyled("Cajas", [
      [th("Nº Caja"),th("Courier"),th("Peso"),th("Largo"),th("Ancho"),th("Alto"),th("Volumétrico")],
      ...resumen.map(r=>[td(r.n),td(r.courier),td(fmtPeso(r.peso)),td(String(r.L)),td(String(r.A)),td(String(r.H)),td(fmtPeso(r.vol))]),
      [td(""),td("Totales"),td(fmtPeso(totPeso)),"","","",td(fmtPeso(totVol))]
    ]);
    downloadXLSX(`Detalle_${flight.codigo}.xlsx`, [shP, shC]);
  }

  return (
    <Section title="Cargas enviadas">
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
        <div className="flex items-end"><button onClick={exportTodo} disabled={!flight} className={BTN_PRIMARY+" w-full disabled:opacity-50"}>Exportar XLSX</button></div>
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

/* ========== Proformas (cant 3 decimales; unit/sub 2; extras y 4% con cant=1) ========== */
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

  async function exportX(r){
    if(!flight) return;
    const proc = r.kg_fact*T.proc, fr=r.kg_real*T.fleteReal, fe=r.kg_exc*T.fleteExc, desp=r.kg_fact*T.despacho;
    const canje=canjeGuiaUSD(r.kg_fact);
    const extrasList = extrasDeCourier(r.courier);
    const extrasMonto = extrasList.reduce((s,e)=>s+parseComma(e.monto),0);
    const com = 0.04*(proc+fr+fe+extrasMonto);
    const total = proc+fr+fe+desp+canje+extrasMonto+com;

    const detalle = [
      ["Procesamiento", Number(r.kg_fact.toFixed(3)), Number(T.proc.toFixed(2)), Number(proc.toFixed(2))],
      ["Flete peso real", Number(r.kg_real.toFixed(3)), Number(T.fleteReal.toFixed(2)), Number(fr.toFixed(2))],
      ["Flete exceso de volumen", Number(r.kg_exc.toFixed(3)), Number(T.fleteExc.toFixed(2)), Number(fe.toFixed(2))],
      ["Servicio de despacho", Number(r.kg_fact.toFixed(3)), Number(T.despacho.toFixed(2)), Number(desp.toFixed(2))],
      ["Comisión por canje de guía", 1, Number(canje.toFixed(2)), Number(canje.toFixed(2))],
      ...extrasList.map(e=>[e.descripcion, 1, Number(parseComma(e.monto).toFixed(2)), Number(parseComma(e.monto).toFixed(2))]),
      ["Comisión por transferencia (4%)", 1, Number(com.toFixed(2)), Number(com.toFixed(2))],
    ];

    await exportProformaExcelJS_usingTemplate({
      plantillaUrl: "/templates/proforma.xlsx", // nueva plantilla en /public/templates
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
        // extras para la hoja DETALLE (el motor ExcelJS re-mapea a cant=1 y unit=sub al escribir en "Factura")
        extras: extrasList.map(e=>[e.descripcion, "", "", Number(parseComma(e.monto).toFixed(2))]),
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

/* ========== Extras ========== */
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
        <button onClick={add} className={BTN_PRIMARY}>Agregar</button>
      </div>

      <div className="grid md:grid-cols-3 gap-2 mb-3">
        <Field label="Filtrar desde"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field>
        <Field label="Filtrar hasta"><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field>
        <div />
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="bg-gray-50">{["Fecha","Carga","Courier","Descripción","Monto (USD)","Estado","Acciones"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
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

/* ========== helpers listas sencillas ========== */
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

/* ========== App ========== */
function App(){
  const [currentUser,setCurrentUser]=useState(null);

  const [tab,setTab]=useState("Recepción");
  const tabs = ["Recepción","Paquetes en bodega","Armado de cajas","Cargas enviadas","Gestión de cargas","Proformas","Extras"];

  const [couriers,setCouriers]=useState(COURIERS_INICIALES);
  const [estados,setEstados]=useState(ESTADOS_INICIALES);

  // Sin carga por defecto
  const [flights,setFlights]=useState([]);
  const [packages,setPackages]=useState([]);
  const [extras,setExtras]=useState([]);

  if(!currentUser) return <Login onLogin={setCurrentUser} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Gestor de Paquetes</div>
          <div className="text-xs text-gray-500">LaMaquinaLogistica / Europa Envíos</div>
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
