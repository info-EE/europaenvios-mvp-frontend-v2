/* Europa Envíos – MVP v0.2.8
    - Armado de Cajas: Corregido el error de selección de caja, el problema de edición de campos y añadido formato al XLSX de respaldo.
    - Cargas Enviadas: Solucionado el formato de números en el archivo Excel exportado.
    - Proformas: Ajustado el tamaño del logo para tener un margen de 2mm.
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import * as XLSX from "xlsx-js-style";
import JsBarcode from "jsbarcode";
import ExcelJS from "exceljs/dist/exceljs.min.js";

/* ========== utils básicos ========== */
const uuid = () => {
  try { if (window.crypto?.randomUUID) return window.crypto.randomUUID(); } catch {}
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};
const deaccent = (s) => String(s ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/ñ/g, "n").replace(/Ñ/g, "N");
const limpiar = (s) => deaccent(String(s || "")).toUpperCase().replace(/\s+/g, "");
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

/* ========== XLSX helpers ========== */
const bd = () => ({ top:{style:"thin",color:{rgb:"FFCBD5E1"}}, bottom:{style:"thin",color:{rgb:"FFCBD5E1"}},
  left:{style:"thin",color:{rgb:"FFCBD5E1"}}, right:{style:"thin",color:{rgb:"FFCBD5E1"}} });
const th = (txt) => ({ v:txt, t:"s", s:{font:{bold:true,color:{rgb:"FFFFFFFF"}},fill:{fgColor:{rgb:"FF1F2937"}},
  alignment:{horizontal:"center",vertical:"center"}, border:bd()} });
const td = (v) => ({ v:String(v ?? ""), t:"s", s:{alignment:{vertical:"center"}, border:bd()} });
const tdNum = (v, fmt = "0.00") => ({ v: typeof v === 'number' ? v : parseComma(v), t: "n", s: { alignment: { vertical: "center" }, border: bd(), numFmt: fmt } });
const tdInt = (v) => ({ v: typeof v === 'number' ? v : parseIntEU(v), t: "n", s: { alignment: { vertical: "center" }, border: bd(), numFmt: "0" } });

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
function cloneSheetObject(ws){
  return JSON.parse(JSON.stringify(ws));
}
function findCells(ws, predicate){
  const out=[];
  const ref = ws["!ref"] || "A1";
  const rg = XLSX.utils.decode_range(ref);
  for(let r=rg.s.r; r<=rg.e.r; r++){
    for(let c=rg.s.c; c<=rg.e.c; c++){
      const addr = XLSX.utils.encode_cell({r,c});
      const cell = ws[addr];
      if(!cell) continue;
      const v = typeof cell.v === "string" ? cell.v : null;
      if(v && predicate(v)) out.push({r,c,addr,cell});
    }
  }
  return out;
}
function writeCell(ws, r, c, value){
  const addr = XLSX.utils.encode_cell({r,c});
  const prev = ws[addr] || { t:"s" };
  ws[addr] = { ...prev, v: String(value ?? ""), t: "s" };
}
function replacePlaceholdersInSheet(ws, map){
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
    for(let R=range.s.r; R<=range.e.r; R++){
      for(let C=range.s.c; C<=range.e.c; C++){
        const addr = XLSX.utils.encode_cell({r:R,c:C});
        const cell = ws[addr];
        if(cell && typeof cell.v==="string"){
          let txt = cell.v;
          Object.entries(map).forEach(([k,v])=>{ txt = txt.replaceAll(`{{${k}}}`, (v??"").toString()); });
          if(txt!==cell.v) ws[addr] = {...cell, v: txt, t:"s"};
        }
      }
    }
}
function fillCourierColumn(ws, headerCell, codes){
    let idx = 0;
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
    for(let R=headerCell.r+1; R<=range.e.r; R++){
      const addr = XLSX.utils.encode_cell({r:R, c:headerCell.c});
      const cell = ws[addr];
      const isPlaceholder = cell && typeof cell.v==="string" && cell.v.includes("{{PAQUETE}}");
      if(!isPlaceholder) continue;
      const val = (idx < codes.length) ? codes[idx++] : "";
      ws[addr] = { ...(cell||{t:"s"}), v: val, t:"s" };
    }
}

/* ========== helpers de autenticación/usuarios (localStorage) ========== */
const USERS_KEY = "ee_users_v1";

async function sha256Hex(str){
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function loadUsers(){
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch { return []; }
}
function saveUsers(users){
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
function courierPrefix(name){ return limpiar(name || ""); }
function tabsForRole(role){
  if(role==="COURIER") return ["Paquetes sin casilla","Paquetes en bodega","Cargas enviadas"];
  return ["Recepción","Paquetes sin casilla","Pendientes","Paquetes en bodega","Armado de cajas","Cargas enviadas","Gestión de cargas","Proformas","Usuarios","Extras"];
}

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

/* ========== Etiquetas (sanitiza a ASCII para CODE128) ========== */
function barcodeSVG(text){
  const safe = deaccent(String(text)).toUpperCase();
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

/* ========== ExcelJS específicos (Proforma con logo centrado en B1:D8) ========== */
const LOGO_TL_PROFORMA = { col: 2, row: 1 };   // B1
const LOGO_BR_PROFORMA = { col: 4, row: 10 };  // D10
const PX_PER_CHAR = 7.2;
const PX_PER_POINT = 96/72;
const PIXELS_PER_MM = 3.78; // Approx. 96 DPI / 25.4 mm/inch

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
function normalizeTxt(x){
  return deaccent(String(x||"").trim()).toUpperCase().replace(/\s+/g," ");
}
function findProformaAnchors(ws){
  const wanted = {
    DESC: ["DESCRIPCION","DESCRIPCIÓN"],
    CANT: ["CANTIDAD"],
    UNIT: ["PRECIO UNITARIO","P. UNITARIO","P.UNITARIO","UNITARIO"],
    SUBT: ["PRECIO TOTAL","IMPORTE","TOTAL LINEA","TOTAL LÍNEA"]
  };
  for(let r=1; r<=100; r++){
    let found = {DESC:null,CANT:null,UNIT:null,SUBT:null};
    for(let c=1; c<=30; c++){
      const v = ws.getCell(r,c).value;
      const txt = (v && typeof v==="object" && v.richText) ? v.richText.map(t=>t.text).join("") : v;
      const n = normalizeTxt(txt);
      if(!n) continue;
      if(!found.DESC && wanted.DESC.some(k=>n===k)) found.DESC = c;
      if(!found.CANT && wanted.CANT.some(k=>n===k)) found.CANT = c;
      if(!found.UNIT && wanted.UNIT.some(k=>n===k)) found.UNIT = c;
      if(!found.SUBT && wanted.SUBT.some(k=>n===k)) found.SUBT = c;
    }
    if(found.DESC && found.CANT && found.UNIT && found.SUBT){
      return { headerRow:r, colDesc:found.DESC, colCant:found.CANT, colUnit:found.UNIT, colSub:found.SUBT };
    }
  }
  return { headerRow: 15, colDesc:1, colCant:2, colUnit:3, colSub:4 };
}

async function exportProformaExcelJS_usingTemplate({ plantillaUrl, logoUrl, nombreArchivo, datosFactura }){
  const wb = new ExcelJS.Workbook();
  const ab = await (await fetch(plantillaUrl, { cache: "no-store" })).arrayBuffer();
  await wb.xlsx.load(ab);

  const wsFactura = wb.getWorksheet("Factura") || wb.worksheets[0];

  replacePlaceholdersExcelJS(wsFactura, {
    FECHA: datosFactura.fechaCarga || "",
    COURIER: datosFactura.courier || ""
  });

  wsFactura.getCell("D15").value = "Precio Total";
  wsFactura.getCell("A28").value = "Total";

  try{
    const { base64, width: imgW, height: imgH } = await loadLogoInfo(logoUrl);
    const imageId = wb.addImage({ base64, extension: "png" });

    const { w: boxW, h: boxH } = boxSizePx(wsFactura, LOGO_TL_PROFORMA, LOGO_BR_PROFORMA);
    const marginPx = 2 * PIXELS_PER_MM;
    const effectiveBoxW = boxW - (2 * marginPx);
    const effectiveBoxH = boxH - (2 * marginPx);

    const scale = Math.min(effectiveBoxW / imgW, effectiveBoxH / imgH);
    const extW = Math.round(imgW * scale);
    const extH = Math.round(imgH * scale);
    
    const offX = Math.max(0, (boxW - extW) / 2);
    const offY = Math.max(0, (boxH - extH) / 2);

    const tlColWidth = colWidthPx(wsFactura, LOGO_TL_PROFORMA.col);
    const tlRowHeight = rowHeightPx(wsFactura, LOGO_TL_PROFORMA.row);
    const tlColFloat = (LOGO_TL_PROFORMA.col - 1) + (offX / tlColWidth);
    const tlRowFloat = (LOGO_TL_PROFORMA.row - 1) + (offY / tlRowHeight);

    wsFactura.addImage(imageId, {
      tl: { col: tlColFloat, row: tlRowFloat },
      ext: { width: extW, height: extH },
      editAs: "oneCell"
    });
  }catch(e){ console.warn("No se pudo insertar el logo:", e); }

  const { headerRow, colDesc, colCant, colUnit, colSub } = findProformaAnchors(wsFactura);
  const startRow = headerRow + 1;

  const maxFilas = 80;
  for (let r = startRow; r < startRow + maxFilas; r++) {
    wsFactura.getCell(r, colDesc).value = "";
    wsFactura.getCell(r, colCant).value = "";
    wsFactura.getCell(r, colUnit).value = "";
    wsFactura.getCell(r, colSub ).value = "";
  }

  const filas = [
    ["Procesamiento", datosFactura.kg_fact, datosFactura.pu_proc, datosFactura.sub_proc],
    ["Flete peso real", datosFactura.kg_real, datosFactura.pu_real, datosFactura.sub_real],
    ["Flete exceso de volumen", datosFactura.kg_exc, datosFactura.pu_exc, datosFactura.sub_exc],
    ["Servicio de despacho", datosFactura.kg_fact, datosFactura.pu_desp, datosFactura.sub_desp],
    ["Comisión por canje de guía", 1, datosFactura.canje, datosFactura.canje],
    ...datosFactura.extras.map(([desc, , , total]) => [desc, 1, total, total]),
    ["Comisión por transferencia (4%)", 1, datosFactura.comision, datosFactura.comision]
  ];

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

  wsFactura.getCell("D28").value  = Number(datosFactura.total.toFixed(2));
  wsFactura.getCell("D28").numFmt = "0.00";

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

function PasswordInput({value,onChange,placeholder}) {
  const [show,setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="current-password"
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600"
        onClick={()=>setShow(s=>!s)}
      >
        {show ? "Ocultar" : "Ver"}
      </button>
    </div>
  );
}

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
  "Aero Box", "Aladín","Boss Box","Buzón","Caba Box","Click Box","Easy Box","Europa Envíos",
  "FastBox","Fixo Cargo","Fox Box","Global Box","Home Box","Inflight Box","Inter Couriers",
  "MC Group","Miami Express","One Box","ParaguayBox","Royal Box"
];
const ESTADOS_CARGA = ["En bodega","En tránsito","Arribada", "Entregada", "Cobrada"];

/* ---- Restricciones por prefijo de CASILLA y por CARGA ---- */
const CASILLA_PREFIX_MAP = {
  "Aero Box": ["ABH","ABC","AB","ABL","ABK","ACD"], "Aladín": ["ALD"], "Boss Box": ["BBC"],
  "Buzón": ["BP","BA","BS","BE","BC","BJ","BK"], "Caba Box": ["CABA","CB","PB"],
  "Click Box": ["CLI","FM","CDE","MR","MRA","CBL","CDELB","CPO"], "Easy Box": ["EF","EZ","EB","EBS","EBC"],
  "Europa Envíos": ["EE"], "FastBox": ["FPY"], "Fixo Cargo": ["FCPY"], "Fox Box": ["FAS"],
  "Global Box": ["GB"], "Home Box": ["HB","UNITED","UB","MYB"], "Inflight Box": ["IN","IA","IE","IV"],
  "Inter Couriers": ["IC"], "MC Group": ["MC"], "Miami Express": ["ME","ML"], "One Box": ["OB","PGT"],
  "ParaguayBox": ["AB","AS","AY","BE","CB","CC","CE","CH","CN","CZ","ER","FA","FI","GA","KA","LB","LQ","ML","NB","NW","PI","PJ","SG","SI","SL","SR","SV","TS","VM","TT"],
  "Royal Box": ["1A","1B","1E","1G","1M","1P","1Z","2A","2B","2E","2M","2P","2Z","3E","3P","3Z","4C","4E","1C","1CB","2C","3C","5C","NB","PI"]
};

function couriersFromCasilla(casilla, availCouriers){
  const c = limpiar(casilla).toUpperCase();
  if(!c) return [];
  const hits = new Set();
  Object.entries(CASILLA_PREFIX_MAP).forEach(([courier, prefixes])=>{
    if(!availCouriers.includes(courier)) return;
    for(const p of prefixes){
      if(c.startsWith(p)) { hits.add(courier); break; }
    }
  });
  return Array.from(hits);
}

function allowedCouriersByContext({ casilla, flightCode, avail }){
  const code = (flightCode||"").toUpperCase();
  if(code.startsWith("AIR-PYBOX")){
    return avail.includes("ParaguayBox") ? ["ParaguayBox"] : [];
  }
  const byCasilla = couriersFromCasilla(casilla, avail);
  return byCasilla.length ? byCasilla : avail;
}

function estadosPermitidosPorCarga(codigo, estadosList){
  const s = String(codigo||"").toUpperCase();
  if (s.startsWith("AIR")) return ["Aéreo"];
  if (s.startsWith("MAR")) return ["Marítimo"];
  if (s.startsWith("COMP")) return ["Ofrecer marítimo"];
  return estadosList && estadosList.length ? estadosList : ESTADOS_INICIALES;
}

/* ========== Login con contraseña (localStorage + SHA-256) ========== */
function Login({onLogin}){
  const [users,setUsers] = useState(loadUsers());
  const [mode,setMode] = useState(users.length===0 ? "setup-admin" : "login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [err,setErr]=useState("");
  const [adminEmail,setAdminEmail]=useState("");
  const [adminPass1,setAdminPass1]=useState("");
  const [adminPass2,setAdminPass2]=useState("");
  const [creating,setCreating]=useState(false);

  async function handleLogin(){
    setErr("");
    const u = users.find(u=>u.email.trim().toLowerCase()===email.trim().toLowerCase());
    if(!u){ setErr("Usuario no encontrado."); return; }
    const h = await sha256Hex(password);
    if(u.pwHash !== h){ setErr("Contraseña incorrecta."); return; }
    onLogin({ id:u.id, email:u.email, role:u.role, courier:u.courier || null });
  }

  async function createFirstAdmin(e){
    e?.preventDefault();
    if(creating) return;
    setErr("");
    if(!adminEmail || !adminPass1 || !adminPass2){ setErr("Completá todos los campos."); return; }
    if(adminPass1!==adminPass2){ setErr("Las contraseñas no coinciden."); return; }
    setCreating(true);
    try{
      const newU = { id: uuid(), email: adminEmail.trim(), role: "ADMIN", courier: null, pwHash: await sha256Hex(adminPass1) };
      const next = [newU];
      saveUsers(next);
      setUsers(next);
      onLogin({ id:newU.id, email:newU.email, role:newU.role, courier:null });
    }finally{
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md">
        {mode==="login" ? (
          <>
            <h1 className="text-2xl font-semibold mb-4">Acceso al sistema</h1>
            <Field label="Email" required>
              <Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@empresa.com"/>
            </Field>
            <Field label="Contraseña" required>
              <PasswordInput value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/>
            </Field>
            {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
            <button onClick={handleLogin} className={BTN_PRIMARY+" w-full mt-2"}>Entrar</button>

            {users.length===0 && (
              <div className="text-xs text-gray-500 mt-3">
                No hay usuarios creados.{" "}
                <button className="underline" onClick={()=>setMode("setup-admin")}>Crear primer ADMIN</button>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold mb-1">Configurar primer ADMIN</h1>
            <p className="text-sm text-gray-600 mb-4">No se encontraron usuarios. Creá la cuenta de administrador.</p>
            <Field label="Email del ADMIN" required>
              <Input type="email" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} placeholder="admin@empresa.com"/>
            </Field>
            <Field label="Contraseña" required>
              <PasswordInput value={adminPass1} onChange={e=>setAdminPass1(e.target.value)} placeholder="••••••••"/>
            </Field>
            <Field label="Repetir contraseña" required>
              <PasswordInput value={adminPass2} onChange={e=>setAdminPass2(e.target.value)} placeholder="••••••••"/>
            </Field>
            {err && <div className="text-red-600 text-sm mb-2">{err}</div>}
            <button onClick={createFirstAdmin} disabled={creating} className={BTN_PRIMARY+" w-full mt-2 disabled:opacity-50"}>
              {creating ? "Creando..." : "Crear ADMIN y entrar"}
            </button>
            <div className="text-xs text-gray-500 mt-3">
              ¿Ya tenías usuarios?{" "}
              <button className="underline" onClick={()=>setMode("login")}>Volver al login</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ========== Gestión de Usuarios (solo ADMIN) ========== */
function Usuarios({ currentUser, onCurrentUserChange }){
  const [users,setUsers] = useState(loadUsers());
  const [q,setQ] = useState("");
  const [emailNew,setEmailNew]=useState("");
  const [roleNew,setRoleNew]=useState("COURIER");
  const [courierNew,setCourierNew]=useState("");
  const [pw1,setPw1]=useState("");
  const [pw2,setPw2]=useState("");
  const [err,setErr]=useState("");
  const [edit,setEdit]=useState(null);
  const [pw1e,setPw1e]=useState("");
  const [pw2e,setPw2e]=useState("");

  const filtered = users.filter(u =>
    (u.email+u.role+(u.courier||"")).toLowerCase().includes(q.toLowerCase())
  );

  function refresh(){ setUsers(loadUsers()); }

  async function addUser(){
    setErr("");
    if(!emailNew || !pw1 || !pw2){ setErr("Completá email y contraseña."); return; }
    if(pw1!==pw2){ setErr("Las contraseñas no coinciden."); return; }
    if(users.some(u=>u.email.trim().toLowerCase()===emailNew.trim().toLowerCase())){ setErr("Ya existe un usuario con ese email."); return; }
    if(roleNew==="COURIER" && !courierNew.trim()){ setErr("Seleccioná/ingresá un courier."); return; }

    const newU = {
      id: uuid(),
      email: emailNew.trim(),
      role: roleNew,
      courier: roleNew==="COURIER" ? courierNew.trim() : null,
      pwHash: await sha256Hex(pw1)
    };
    const next = [...users, newU];
    saveUsers(next);
    setUsers(next);
    setEmailNew(""); setRoleNew("COURIER"); setCourierNew("");
    setPw1(""); setPw2("");
  }

  async function updateUser(){
    if(!edit) return;
    setErr("");
    const idx = users.findIndex(u=>u.id===edit.id);
    if(idx<0) return;

    if(!edit.email){ setErr("El email es obligatorio."); return; }
    if(users.some((u,i)=>i!==idx && u.email.trim().toLowerCase()===edit.email.trim().toLowerCase())){ setErr("Ya existe un usuario con ese email."); return; }
    if(edit.role==="COURIER" && !edit.courier?.trim()){ setErr("El courier es obligatorio para rol COURIER."); return; }

    const next = [...users];
    const current = {...edit};
    if(pw1e || pw2e){
      if(pw1e!==pw2e){ setErr("Las contraseñas no coinciden."); return; }
      current.pwHash = await sha256Hex(pw1e);
    }
    next[idx] = current;
    saveUsers(next);
    setUsers(next);

    if(currentUser?.id === current.id){
      onCurrentUserChange?.({ id:current.id, email:current.email, role:current.role, courier:current.courier||null });
    }
    setEdit(null); setPw1e(""); setPw2e("");
  }

  function deleteUser(u){
    if(u.role==="ADMIN" && users.filter(x=>x.role==="ADMIN").length<=1){
      alert("No podés eliminar el último ADMIN.");
      return;
    }
    const ok = window.confirm(`¿Eliminar el usuario ${u.email}?`);
    if(!ok) return;
    const next = users.filter(x=>x.id!==u.id);
    saveUsers(next);
    setUsers(next);
  }

  return (
    <Section
      title="Usuarios"
      right={<div className="flex gap-2 items-end">
        <Input placeholder="Buscar…" value={q} onChange={e=>setQ(e.target.value)}/>
        <button className={BTN} onClick={refresh}>Recargar</button>
      </div>}
    >
      {/* Alta */}
      <div className="bg-gray-50 rounded-xl p-3 mb-4">
        <div className="font-medium mb-2">Crear usuario</div>
        <div className="grid md:grid-cols-5 gap-2">
          <Field label="Email" required><Input value={emailNew} onChange={e=>setEmailNew(e.target.value)} placeholder="usuario@empresa.com"/></Field>
          <Field label="Rol" required>
            <select className="w-full rounded-xl border px-3 py-2" value={roleNew} onChange={e=>setRoleNew(e.target.value)}>
              <option>COURIER</option>
              <option>ADMIN</option>
            </select>
          </Field>
          <Field label="Courier (si corresponde)">
            <Input list="courierList" value={courierNew} onChange={e=>setCourierNew(e.target.value)} placeholder="Aero Box / Global Box / ..." />
            <datalist id="courierList">
              {COURIERS_INICIALES.map(c=><option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label="Contraseña" required>
            <PasswordInput value={pw1} onChange={e=>setPw1(e.target.value)} placeholder="••••••••"/>
          </Field>
          <Field label="Repetir contraseña" required>
            <PasswordInput value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="••••••••"/>
          </Field>
        </div>
        {err && <div className="text-red-600 text-sm mt-2">{err}</div>}
        <div className="flex justify-end mt-3">
          <button className={BTN_PRIMARY} onClick={addUser}>Crear</button>
        </div>
      </div>

      {/* Listado */}
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {["Email","Rol","Courier","Acciones"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u=>(
              <tr key={u.id} className="border-b">
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.role}</td>
                <td className="px-3 py-2">{u.role==="COURIER" ? (u.courier||"—") : "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button className="px-2 py-1 border rounded" onClick={()=>{ setEdit({...u}); setPw1e(""); setPw2e(""); }}>Editar</button>
                    <button className="px-2 py-1 border rounded text-red-600" onClick={()=>deleteUser(u)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length===0 && (
              <tr><td colSpan={4} className="text-center text-gray-500 py-6">Sin usuarios.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Edición */}
      <Modal open={!!edit} onClose={()=>setEdit(null)} title="Editar usuario">
        {edit && (
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Email" required>
              <Input value={edit.email} onChange={e=>setEdit({...edit, email:e.target.value})}/>
            </Field>
            <Field label="Rol" required>
              <select className="w-full rounded-xl border px-3 py-2" value={edit.role} onChange={e=>setEdit({...edit, role:e.target.value})}>
                <option>COURIER</option>
                <option>ADMIN</option>
              </select>
            </Field>
            <Field label="Courier (si corresponde)">
              <Input list="courierList" value={edit.courier||""} onChange={e=>setEdit({...edit, courier:e.target.value})}/>
            </Field>

            <Field label="Nueva contraseña (opcional)">
              <PasswordInput value={pw1e} onChange={e=>setPw1e(e.target.value)} placeholder="Dejar vacío para no cambiar"/>
            </Field>
            <Field label="Repetir contraseña (opcional)">
              <PasswordInput value={pw2e} onChange={e=>setPw2e(e.target.value)} placeholder="Dejar vacío para no cambiar"/>
            </Field>

            <div className="md:col-span-3 flex justify-end gap-2 mt-2">
              <button className={BTN} onClick={()=>setEdit(null)}>Cancelar</button>
              <button className={BTN_PRIMARY} onClick={updateUser}>Guardar cambios</button>
            </div>
          </div>
        )}
      </Modal>
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

/* ========== Recepción (listas dinámicas + foto opcional + REGLAS NUEVAS) ========== */
function Reception({ currentUser, couriers, setCouriers, estados, setEstados, flights, onAdd }){
  const vuelosBodega = flights.filter(f=>f.estado==="En bodega");
  const [flightId,setFlightId]=useState("");
  const [form,setForm]=useState({
    courier: currentUser.role==="COURIER"? (currentUser.courier || "") : "",
    estado:"", casilla:"", codigo:"",
    fecha:new Date().toISOString().slice(0,10),
    empresa:"", nombre:"", tracking:"", remitente:"",
    peso_real_txt:"", L_txt:"", A_txt:"", H_txt:"",
    desc:"", valor_txt:"",
    foto:null // opcional
  });

  const codigoCargaSel = useMemo(() => flights.find(f=>f.id===flightId)?.codigo || "", [flightId, flights]);
  const estadosPermitidos = useMemo(() => estadosPermitidosPorCarga(codigoCargaSel, estados), [codigoCargaSel, estados]);

  // Código correlativo por courier
  useEffect(()=>{
    if(!form.courier) { setForm(f=>({...f, codigo:""})); return; }
    const key="seq_"+courierPrefix(form.courier);
    const next=(Number(localStorage.getItem(key))||0)+1;
    const n= next>999?1:next;
    setForm(f=>({...f, codigo: `${courierPrefix(form.courier)}${n}`}));
  },[form.courier]);

  // Si solo hay un estado permitido, seleccionarlo automáticamente
  useEffect(() => {
    if (estadosPermitidos.length === 1 && form.estado !== estadosPermitidos[0]) {
      setForm(f => ({ ...f, estado: estadosPermitidos[0] }));
    }
  }, [estadosPermitidos, form.estado]);


  // Limitar opciones de courier
  const courierOptions = useMemo(()=>{
    return allowedCouriersByContext({
      casilla: form.casilla,
      flightCode: codigoCargaSel,
      avail: couriers
    });
  }, [form.casilla, codigoCargaSel, couriers]);

  // Auto-ajustar courier
  useEffect(()=>{
    if(!courierOptions.includes(form.courier)){
      setForm(f=>({...f, courier: courierOptions.length===1 ? courierOptions[0] : ""}));
    }
  },[courierOptions, form.courier]);

  const peso = parseComma(form.peso_real_txt);
  const L = parseIntEU(form.L_txt), A=parseIntEU(form.A_txt), H=parseIntEU(form.H_txt);
  const fact = Math.max(MIN_FACTURABLE, peso||0);
  const vol = A && H && L ? (A*H*L)/5000 : 0;
  const exc = Math.max(0, vol - fact);

  const okCampos = ()=>[
      "courier","estado","casilla","codigo","fecha","empresa","nombre",
      "tracking","remitente","peso_real_txt","L_txt","A_txt","H_txt","desc","valor_txt"
    ].every(k=>String(form[k]||"").trim()!=="");

  const submit=()=>{
    const fl = flights.find(f=>f.id===flightId);
    if (fl?.codigo.toUpperCase().startsWith("AIR-MULTI") && form.courier === "ParaguayBox") {
      alert("No se permite cargar paquetes de ParaguayBox en cargas que comiencen con AIR-MULTI.");
      return;
    }

    if(!flightId){ alert("Seleccioná una Carga."); return; }
    if(!okCampos()){ alert("Faltan campos."); return; }

    const key="seq_"+courierPrefix(form.courier);
    let cur=(Number(localStorage.getItem(key))||0)+1; if(cur>999) cur=1;
    localStorage.setItem(key,String(cur));

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

    const medidas = `${L}x${A}x${H} cm`;
    const html = labelHTML({
      codigo: form.codigo, nombre: form.nombre, casilla: form.casilla,
      pesoKg: peso, medidasTxt: medidas, desc: form.desc, cargaTxt: fl?.codigo || "-"
    });

    onAdd(p);
    printHTMLInIframe(html);

    setFlightId("");
    setForm(f=>({
      ...f, courier:"", estado:"", casilla:"", codigo:"", empresa:"", nombre:"", tracking:"", remitente:"",
      peso_real_txt:"", L_txt:"", A_txt:"", H_txt:"", desc:"", valor_txt:"", foto:null
    }));
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

  const fileRef = useRef(null);
  const onFile = (e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader(); r.onload=()=>setForm(f=>({...f,foto:r.result})); r.readAsDataURL(file);
  };

  const [showMgr,setShowMgr]=useState(false);

  if(currentUser.role==="COURIER"){
    return (
      <Section title="Recepción de paquete">
        <div className="text-gray-600">Tu rol no tiene acceso a Recepción.</div>
      </Section>
    );
  }

  return (
    <Section
      title="Recepción de paquete"
      right={
        <div className="flex items-center gap-2">
          <button className={BTN} onClick={()=>setShowMgr(s=>!s)}>Gestionar listas</button>
          <span className="text-sm text-gray-500">Todos los campos obligatorios (salvo foto)</span>
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
            <option value="">Seleccionar…</option>
            {vuelosBodega.map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
          </select>
        </Field>
        <Field label="Casilla" required>
          <Input value={form.casilla} onChange={e=>setForm({...form,casilla:limpiar(e.target.value)})}/>
        </Field>
        <Field label="Courier" required>
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={form.courier}
            onChange={e=>setForm({...form,courier:e.target.value})}
          >
            <option value="">Seleccionar…</option>
            {courierOptions.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          {codigoCargaSel.startsWith("AIR-PYBOX") && (
            <div className="text-xs text-indigo-600 mt-1">Esta carga solo admite courier ParaguayBox.</div>
          )}
        </Field>
        <Field label="Estado" required>
          <select className="w-full rounded-xl border px-3 py-2" value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>
            <option value="">Seleccionar…</option>
            {estadosPermitidos.map(s=><option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Código de paquete" required>
          <Input value={form.codigo} disabled placeholder="Se genera al elegir Courier"/>
        </Field>
        <Field label="Fecha" required>
          <Input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})}/>
        </Field>
        <Field label="Empresa de envío" required><Input value={form.empresa} onChange={e=>setForm({...form,empresa:e.target.value})}/></Field>
        <Field label="Nombre y apellido" required><Input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></Field>
        <Field label="Tracking" required><Input value={form.tracking} onChange={e=>setForm({...form,tracking:e.target.value})}/></Field>
        <Field label="Remitente" required><Input value={form.remitente} onChange={e=>setForm({...form,remitente:e.target.value})}/></Field>
        <Field label="Peso real (kg)" required><Input value={form.peso_real_txt} onChange={e=>setForm({...form,peso_real_txt:e.target.value})} placeholder="3,128"/></Field>
        <Field label="Largo (cm)" required><Input value={form.L_txt} onChange={e=>setForm({...form,L_txt:e.target.value})} placeholder="50"/></Field>
        <Field label="Ancho (cm)" required><Input value={form.A_txt} onChange={e=>setForm({...form,A_txt:e.target.value})} placeholder="30"/></Field>
        <Field label="Alto (cm)" required><Input value={form.H_txt} onChange={e=>setForm({...form,H_txt:e.target.value})} placeholder="20"/></Field>
        <Field label="Descripción" required><Input value={form.desc} onChange={e=>setForm({...form,desc:e.target.value})}/></Field>
        <Field label="Precio (EUR)" required>
          <Input value={form.valor_txt} onChange={e=>setForm({...form,valor_txt:e.target.value})} placeholder="10,00"/>
        </Field>
        <Field label="Foto del paquete (opcional)">
          <div className="flex gap-2 items-center">
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden"/>
            <button type="button" onClick={()=>fileRef.current?.click()} className={BTN}>Seleccionar archivo</button>
            <button type="button" onClick={()=>setCamOpen(true)} className={BTN}>Tomar foto</button>
            {form.foto ? <span className="text-green-600 text-sm">✓ foto cargada</span> : <span className="text-gray-500 text-sm">Opcional</span>}
          </div>
        </Field>
      </div>
      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <InfoBox title="Peso facturable (mín 0,200 kg)" value={`${fmtPeso(fact)} kg`}/>
        <InfoBox title="Peso volumétrico (A×H×L / 5000)" value={`${fmtPeso(vol)} kg`}/>
        <InfoBox title="Exceso de volumen" value={`${fmtPeso(exc)} kg`}/>
      </div>
      <div className="flex justify-end mt-4">
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
/* ========== Paquetes sin casilla (con tracking + edición/borrado ADMIN, visibilidad por rol) ========== */
function PaquetesSinCasilla({ currentUser, items, setItems, setPendientes }){
  const isAdmin = currentUser?.role === "ADMIN";
  const [q,setQ] = useState("");
  const [from,setFrom] = useState("");
  const [to,setTo] = useState("");
  const [fecha,setFecha]   = useState(new Date().toISOString().slice(0,10));
  const [nombre,setNombre] = useState("");
  const [tracking,setTracking] = useState("");
  const [editId,setEditId] = useState(null);
  const [editRow,setEditRow] = useState({ fecha:"", nombre:"", tracking:"" });

  function nextNumero(){
    const key="seq_sincasilla_v1";
    let cur = (Number(localStorage.getItem(key))||0)+1;
    if(cur>999) cur = 1;
    localStorage.setItem(key,String(cur));
    return cur;
  }

  function add(){
    if(!isAdmin) return;
    if(!fecha || !nombre.trim()){ alert("Completá Fecha y Nombre."); return; }
    const numero = nextNumero();
    const row = { id: uuid(), fecha, numero, nombre: nombre.trim(), tracking: tracking.trim() };
    setItems([ ...items, row ]);
    setNombre(""); setTracking("");
  }

  const handleAsignarCasilla = (paquete) => {
    if(!isAdmin) return;
    const casilla = window.prompt(`Asignar casilla para el paquete Nº ${paquete.numero} (${paquete.nombre}):`);
    if (casilla && casilla.trim()) {
      const nuevaTarea = {
        id: uuid(),
        type: "ASIGNAR_CASILLA",
        status: "No realizada",
        fecha: new Date().toISOString().slice(0,10),
        data: {
          numero: paquete.numero,
          nombre: paquete.nombre,
          tracking: paquete.tracking,
          casilla: casilla.trim().toUpperCase(),
        }
      };
      setPendientes(prev => [nuevaTarea, ...prev]);
      setItems(prev => prev.filter(p => p.id !== paquete.id));
    }
  };

  const filtered = useMemo(()=>{
    const arr = items
      .filter(r => !from || (r.fecha||"") >= from)
      .filter(r => !to   || (r.fecha||"") <= to)
      .filter(r => {
        const qq = q.toLowerCase();
        const base = String(r.numero).includes(q) || (r.nombre||"").toLowerCase().includes(qq);
        return isAdmin ? (base || (r.tracking||"").toLowerCase().includes(qq)) : base;
      });
    return arr.slice().sort((a,b)=>Number(a.numero)-Number(b.numero));
  },[items,from,to,q,isAdmin]);

  function startEdit(r){
    if(!isAdmin) return;
    setEditId(r.id);
    setEditRow({ fecha:r.fecha||"", nombre:r.nombre||"", tracking:r.tracking||"" });
  }
  function saveEdit(){
    if(!isAdmin) return;
    if(!editId) return;
    const next = items.map(r => r.id===editId ? { ...r, ...editRow, nombre:(editRow.nombre||"").trim() } : r);
    setItems(next);
    setEditId(null);
  }
  function cancelEdit(){ setEditId(null); }
  function removeRow(r){
    if(!isAdmin) return;
    const ok = window.confirm(`¿Eliminar el paquete Nº ${r.numero}?`);
    if(!ok) return;
    setItems(items.filter(x=>x.id!==r.id));
  }

  function exportXLSX(){
    if(!isAdmin) return;
    const header = isAdmin
      ? [ th("Fecha recepción"), th("Nº paquete"), th("Nombre y apellido"), th("Tracking") ]
      : [ th("Fecha recepción"), th("Nº paquete"), th("Nombre y apellido") ];
    const body = filtered.map(r=>{
      const row = [ td(r.fecha||""), td(String(r.numero)), td(r.nombre||"") ];
      if(isAdmin) row.push(td(r.tracking||""));
      return row;
    });
    const { ws } = sheetFromAOAStyled("Sin casilla", [header, ...body], {
      cols: isAdmin ? [{wch:14},{wch:12},{wch:28},{wch:24}] : [{wch:14},{wch:12},{wch:28}],
      rows:[{hpt:24}]
    });
    downloadXLSX("Paquetes_sin_casilla.xlsx", [{name:"Sin casilla", ws}]);
  }

  return (
    <Section
      title="Paquetes sin casilla"
      right={ isAdmin ? <button onClick={exportXLSX} className="px-3 py-2 bg-gray-800 text-white rounded-xl">Exportar XLSX</button> : null }
    >
      {isAdmin && (
        <div className="grid md:grid-cols-6 gap-3 mb-3">
          <Field label="Fecha recepción" required>
            <Input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/>
          </Field>
          <Field label="Nombre y apellido" required>
            <Input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Juan Pérez"/>
          </Field>
          <Field label="Tracking">
            <Input value={tracking} onChange={e=>setTracking(e.target.value)} placeholder="1Z999..." />
          </Field>
          <div className="flex items-end">
            <button onClick={add} className={BTN_PRIMARY}>Agregar</button>
          </div>
          <Field label="Filtrar desde">
            <Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/>
          </Field>
          <Field label="Hasta">
            <Input type="date" value={to} onChange={e=>setTo(e.target.value)}/>
          </Field>
        </div>
      )}
      {!isAdmin && (
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <Field label="Filtrar desde">
            <Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/>
          </Field>
          <Field label="Hasta">
            <Input type="date" value={to} onChange={e=>setTo(e.target.value)}/>
          </Field>
        </div>
      )}
      <div className="flex items-center gap-2 mb-3">
        <Input placeholder={isAdmin ? "Buscar por Nº, Nombre o Tracking…" : "Buscar por Nº o Nombre…"} value={q} onChange={e=>setQ(e.target.value)} />
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2">Fecha recepción</th>
              <th className="text-left px-3 py-2">Nº paquete</th>
              <th className="text-left px-3 py-2">Nombre y apellido</th>
              {isAdmin && <th className="text-left px-3 py-2">Tracking</th>}
              {isAdmin && <th className="text-left px-3 py-2">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r=>(
              <tr key={r.id} className="border-b">
                {editId===r.id ? (
                  <>
                    <td className="px-3 py-2"><Input type="date" value={editRow.fecha} onChange={e=>setEditRow({...editRow,fecha:e.target.value})}/></td>
                    <td className="px-3 py-2">{r.numero}</td>
                    <td className="px-3 py-2"><Input value={editRow.nombre} onChange={e=>setEditRow({...editRow,nombre:e.target.value})}/></td>
                    {isAdmin && <td className="px-3 py-2"><Input value={editRow.tracking} onChange={e=>setEditRow({...editRow,tracking:e.target.value})}/></td>}
                    {isAdmin && (
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button className="px-2 py-1 border rounded bg-indigo-600 text-white" onClick={saveEdit}>Guardar</button>
                          <button className="px-2 py-1 border rounded" onClick={cancelEdit}>Cancelar</button>
                        </div>
                      </td>
                    )}
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2">{r.fecha||""}</td>
                    <td className="px-3 py-2">{r.numero}</td>
                    <td className="px-3 py-2">{r.nombre||""}</td>
                    {isAdmin && <td className="px-3 py-2">{r.tracking||"—"}</td>}
                    {isAdmin && (
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button className="px-2 py-1 border rounded bg-green-600 text-white" onClick={()=>handleAsignarCasilla(r)}>Asignar casilla</button>
                          <button className="px-2 py-1 border rounded" onClick={()=>startEdit(r)}>Editar</button>
                          <button className="px-2 py-1 border rounded text-red-600" onClick={()=>removeRow(r)}>Eliminar</button>
                        </div>
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}
            {filtered.length===0 && <tr><td colSpan={isAdmin?5:3} className="text-center text-gray-500 py-6">Sin datos.</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
/* ========== Pestaña de Pendientes (con filtros, estados y creación manual) ========== */
function Pendientes({ items, setItems }) {
  const [editItem, setEditItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ type: 'MANUAL', fecha: new Date().toISOString().slice(0,10), details: '' });
  
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("No realizada");

  const filteredItems = useMemo(() => {
    return items
      .filter(item => statusFilter === 'Todas' || item.status === statusFilter)
      .filter(item => !from || (item.fecha || "") >= from)
      .filter(item => !to || (item.fecha || "") <= to)
      .filter(item => {
        if (!q) return true;
        const query = q.toLowerCase();
        const dataString = JSON.stringify(item.data).toLowerCase();
        return dataString.includes(query);
      });
  }, [items, statusFilter, from, to, q]);
  
  const startEdit = (item) => setEditItem({ ...item });
  const cancelEdit = () => setEditItem(null);

  const saveEdit = () => {
    setItems(prev => prev.map(item => item.id === editItem.id ? editItem : item ));
    setEditItem(null);
  };
  
  const toggleStatus = (id) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, status: item.status === 'Realizada' ? 'No realizada' : 'Realizada' } : item ));
  };

  const deleteTask = (id) => {
    const ok = window.confirm("¿Seguro que quieres eliminar esta tarea pendiente? Esta acción no se puede deshacer.");
    if (ok) setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleCreateTask = () => {
    if (!newTask.details.trim()) { alert("Por favor, ingresá los detalles de la tarea."); return; }
    const taskToAdd = {
      id: uuid(), type: newTask.type, status: "No realizada", fecha: newTask.fecha,
      data: { details: newTask.details }
    };
    setItems(prev => [taskToAdd, ...prev]);
    setModalOpen(false);
    setNewTask({ type: 'MANUAL', fecha: new Date().toISOString().slice(0,10), details: '' });
  };

  const renderTaskDetails = (item) => {
    const { type, data } = item;
    switch (type) {
      case 'ASIGNAR_CASILLA': return `Mover paquete Nº ${data.numero} (${data.nombre}) a la casilla ${data.casilla}.`;
      case 'CAMBIO_CARGA': return `Cambiar paquete ${data.codigo} de la carga ${data.oldFlight} a la carga ${data.newFlight}.`;
      case 'MANUAL': return data.details;
      default: return JSON.stringify(data);
    }
  };

  return (
    <Section title="Tareas Pendientes en Bodega" right={
      <div className="flex gap-2 flex-wrap items-end">
        <Field label="Desde"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="Hasta"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
        <Field label="Estado">
          <select className="rounded-xl border px-3 py-2" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="No realizada">No realizada</option>
            <option value="Realizada">Realizada</option>
            <option value="Todas">Todas</option>
          </select>
        </Field>
        <Input placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} />
        <button onClick={() => setModalOpen(true)} className={BTN_PRIMARY}>Agregar Tarea</button>
      </div>
    }>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2">Fecha</th>
              <th className="text-left px-3 py-2">Tipo</th>
              <th className="text-left px-3 py-2">Detalles</th>
              <th className="text-left px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => (
              <tr key={item.id} className="border-b">
                <td className="px-3 py-2">{item.fecha}</td>
                <td className="px-3 py-2">{ item.type === 'ASIGNAR_CASILLA' ? 'Asignar Casilla' : item.type === 'CAMBIO_CARGA' ? 'Cambio Carga' : 'Manual' }</td>
                <td className="px-3 py-2">{renderTaskDetails(item)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 flex-wrap">
                    <button className={`px-2 py-1 border rounded text-white ${item.status === 'No realizada' ? 'bg-green-600' : 'bg-yellow-500'}`} onClick={() => toggleStatus(item.id)}>
                      {item.status === 'No realizada' ? 'Realizada' : 'Pendiente'}
                    </button>
                    <button className="px-2 py-1 border rounded" onClick={() => startEdit(item)}>Editar</button>
                    <button className="px-2 py-1 border rounded text-red-600" onClick={() => deleteTask(item.id)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr><td colSpan="4" className="text-center text-gray-500 py-6">No hay tareas para el filtro seleccionado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Crear Nueva Tarea Manual">
        <div className="space-y-4">
          <Field label="Fecha" required><Input type="date" value={newTask.fecha} onChange={e => setNewTask({...newTask, fecha: e.target.value})} /></Field>
          <Field label="Detalles de la Tarea" required>
            <textarea className="w-full rounded-xl border px-3 py-2" rows="4" value={newTask.details} onChange={e => setNewTask({...newTask, details: e.target.value})} placeholder="Ej: Revisar paquete GLOBALBOX123 por posible daño."/>
          </Field>
          <div className="flex justify-end gap-2"><button className={BTN} onClick={() => setModalOpen(false)}>Cancelar</button><button className={BTN_PRIMARY} onClick={handleCreateTask}>Guardar Tarea</button></div>
        </div>
      </Modal>

      <Modal open={!!editItem} onClose={cancelEdit} title="Editar Tarea">
        {editItem && (
          <div className="space-y-4">
            <Field label="Fecha" required><Input type="date" value={editItem.fecha} onChange={e => setEditItem({...editItem, fecha: e.target.value})} /></Field>
            <Field label="Detalles de la Tarea" required>
              <textarea className="w-full rounded-xl border px-3 py-2" rows="4"
                defaultValue={renderTaskDetails(editItem)}
                onChange={e => {
                  const newData = { details: e.target.value };
                  setEditItem({...editItem, data: newData, type: 'MANUAL'});
                }}
              />
            </Field>
            <div className="flex justify-end gap-2"><button className={BTN} onClick={cancelEdit}>Cancelar</button><button className={BTN_PRIMARY} onClick={saveEdit}>Guardar Cambios</button></div>
          </div>
        )}
      </Modal>
    </Section>
  );
}

/* ========== Paquetes en bodega (filtro por rol/courier + prefijo) ========== */
function PaquetesBodega({packages, flights, user, onUpdate, onDelete, setPendientes}){
  const [q,setQ]=useState("");
  const [flightId,setFlightId]=useState("");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [sort, setSort] = useState({ key: null, dir: "asc" });

  const toggleSort = (key) => {
    setSort(s => s.key===key ? {key, dir: (s.dir==="asc"?"desc":"asc")} : {key, dir:"asc"});
  };
  const Arrow = ({col})=>{
    if(sort.key!==col) return <span className="ml-1 text-gray-400">↕</span>;
    return <span className="ml-1">{sort.dir==="asc"?"▲":"▼"}</span>;
  };

  const vuelosBodega = flights.filter(f=>f.estado==="En bodega");
  const pref = user.role==="COURIER" ? courierPrefix(user.courier) : null;

  const baseRows = packages
    .filter(p => flights.find(f=>f.id===p.flight_id)?.estado==="En bodega")
    .filter(p => !flightId || p.flight_id===flightId)
    .filter(p => !dateFrom || (p.fecha||"") >= dateFrom)
    .filter(p => !dateTo   || (p.fecha||"") <= dateTo)
    .filter(p => (p.codigo + p.casilla + p.tracking + p.nombre_apellido + p.courier).toLowerCase().includes(q.toLowerCase()))
    .filter(p => user.role!=="COURIER" || (p.courier===user.courier && String(p.codigo||"").toUpperCase().startsWith(pref)));

  const getSortVal = (p, key)=>{
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

  const rows = useMemo(()=>{
    const arr = [...baseRows];
    if(sort.key){
      arr.sort((a,b)=>{
        const va = getSortVal(a, sort.key);
        const vb = getSortVal(b, sort.key);
        if(va<vb) return sort.dir==="asc"?-1:1;
        if(va>vb) return sort.dir==="asc"? 1:-1;
        return 0;
      });
    }
    return arr;
  },[baseRows, sort]);

  function printPkgLabel(p){
    const medidas = `${p.largo}x${p.ancho}x${p.alto} cm`;
    const html = labelHTML({
      codigo: p.codigo, nombre: p.nombre_apellido, casilla: p.casilla,
      pesoKg: p.peso_real, medidasTxt: medidas, desc: p.descripcion,
      cargaTxt: flights.find(f=>f.id===p.flight_id)?.codigo || "-"
    });
    printHTMLInIframe(html);
  }

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
    const originalPackage = packages.find(p => p.id === form.id);
    if (originalPackage && originalPackage.flight_id !== form.flight_id) {
        const oldFlight = flights.find(f => f.id === originalPackage.flight_id);
        const newFlight = flights.find(f => f.id === form.flight_id);
        const tarea = {
            id: uuid(),
            type: "CAMBIO_CARGA",
            status: "No realizada",
            fecha: new Date().toISOString().slice(0, 10),
            data: {
                codigo: form.codigo,
                oldFlight: oldFlight?.codigo || 'N/A',
                newFlight: newFlight?.codigo || 'N/A',
            }
        };
        setPendientes(prev => [tarea, ...prev]);
    }

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

    const { ws } = sheetFromAOAStyled("Bodega", [header, ...body], {
      cols: [{wch:12},{wch:14},{wch:12},{wch:10},{wch:16},{wch:12},{wch:22},{wch:22},{wch:16},{wch:18},{wch:18},{wch:18},{wch:14},{wch:28},{wch:12}],
      rows: [{hpt:24}]
    });
    downloadXLSX("Paquetes_en_bodega.xlsx", [{name:"Bodega", ws}]);
  }

  const requestDelete = (p)=>{
    const ok = window.confirm(`¿Eliminar el paquete ${p.codigo}? Esta acción no se puede deshacer.`);
    if(!ok) return;
    if(typeof onDelete === "function") onDelete(p.id);
  };
  
  const CustomPieLegend = ({ payload }) => (
    <div className="w-1/3 text-xs overflow-y-auto" style={{maxHeight: '16rem'}}>
      <ul className="space-y-1">
        {payload.map((entry, index) => (
          <li key={`item-${index}`} className="flex items-center">
            <div className="w-3 h-3 mr-2" style={{ backgroundColor: entry.color }} />
            <span>{entry.value}: <span className="font-semibold">{fmtPeso(entry.payload.value)} kg</span></span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Section title="Paquetes en bodega"
      right={
        <div className="flex gap-2 flex-wrap items-end">
          <select className="rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
            <option value="">Todas las cargas (En bodega)</option>
            {vuelosBodega.map(f=><option key={f.id} value={f.id}>{f.codigo}</option>)}
          </select>
          <Field label="Desde"> <Input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} /> </Field>
          <Field label="Hasta"> <Input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} /> </Field>
          <Input placeholder="Buscar…" value={q} onChange={e=>setQ(e.target.value)}/>
          <button onClick={exportXLSX} className="px-3 py-2 bg-gray-800 text-white rounded-xl">Exportar XLSX</button>
        </div>
      }
    >
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={()=>toggleSort("carga")}>Carga<Arrow col="carga"/></th>
              <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={()=>toggleSort("codigo")}>Código<Arrow col="codigo"/></th>
              <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={()=>toggleSort("casilla")}>Casilla<Arrow col="casilla"/></th>
              <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={()=>toggleSort("fecha")}>Fecha<Arrow col="fecha"/></th>
              <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={()=>toggleSort("nombre")}>Nombre<Arrow col="nombre"/></th>
              <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={()=>toggleSort("tracking")}>Tracking<Arrow col="tracking"/></th>
              <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={()=>toggleSort("peso_real")}>Peso real<Arrow col="peso_real"/></th>
              <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={()=>toggleSort("medidas")}>Medidas<Arrow col="medidas"/></th>
              <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={()=>toggleSort("exceso")}>Exceso<Arrow col="exceso"/></th>
              <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={()=>toggleSort("descripcion")}>Descripción<Arrow col="descripcion"/></th>
              <th className="text-left px-3 py-2">Foto</th>
              <th className="text-left px-3 py-2">Editar</th>
            </tr>
          </thead>
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
                      <button className="px-2 py-1 border rounded" onClick={()=>start(p)} disabled={user.role==="COURIER"}>Editar</button>
                      <button className="px-2 py-1 border rounded" onClick={()=>printPkgLabel(p)}>Etiqueta</button>
                      <button className="px-2 py-1 border rounded text-red-600" onClick={()=>requestDelete(p)} disabled={user.role==="COURIER"}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length===0 && <tr><td colSpan={12} className="text-center text-gray-500 py-6">No hay paquetes.</td></tr>}
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
                <div key={g.key} className="bg-gray-50 rounded-xl p-3">
                  <div className="text-sm text-gray-700 mb-2">{g.title}<b>{fmtPeso(g.total)} kg</b></div>
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

      <Modal open={open} onClose={()=>setOpen(false)} title="Editar paquete">
        {form && (
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Carga">
              <select className="w-full rounded-xl border px-3 py-2" value={form.flight_id} onChange={e=>setForm({...form,flight_id:e.target.value})} disabled={user.role==="COURIER"}>
                {flights.map(f=><option key={f.id} value={f.id}>{f.codigo}</option>)}
              </select>
            </Field>
            <Field label="Courier"><Input value={form.courier} onChange={e=>setForm({...form,courier:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Estado">
              {(() => {
                const codigo = flights.find(f=>f.id===form.flight_id)?.codigo || "";
                const opts = estadosPermitidosPorCarga(codigo, ESTADOS_INICIALES);
                return (
                  <select className="w-full rounded-xl border px-3 py-2" value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})} disabled={user.role==="COURIER"}>
                    {opts.map(s=><option key={s}>{s}</option>)}
                  </select>
                );
              })()}
            </Field>
            <Field label="Casilla"><Input value={form.casilla} onChange={e=>setForm({...form,casilla:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Código de paquete"><Input value={form.codigo} onChange={e=>setForm({...form,codigo:limpiar(e.target.value)})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Fecha"><Input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Empresa de envío"><Input value={form.empresa_envio||""} onChange={e=>setForm({...form,empresa_envio:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Nombre y apellido"><Input value={form.nombre_apellido} onChange={e=>setForm({...form,nombre_apellido:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Tracking"><Input value={form.tracking} onChange={e=>setForm({...form,tracking:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Remitente"><Input value={form.remitente||""} onChange={e=>setForm({...form,remitente:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Peso real (kg)"><Input value={form.peso_real_txt} onChange={e=>setForm({...form,peso_real_txt:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Largo (cm)"><Input value={form.L_txt} onChange={e=>setForm({...form,L_txt:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Ancho (cm)"><Input value={form.A_txt} onChange={e=>setForm({...form,A_txt:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Alto (cm)"><Input value={form.H_txt} onChange={e=>setForm({...form,H_txt:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Descripción"><Input value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Precio (EUR)"><Input value={form.valor_txt} onChange={e=>setForm({...form,valor_txt:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <div className="md:col-span-3 flex items-center justify-between mt-2">
              <button onClick={()=>printPkgLabel(form)} className={BTN}>Reimprimir etiqueta</button>
              <div className="flex gap-2">
                <button onClick={save} className={BTN_PRIMARY} disabled={user.role==="COURIER"}>Guardar</button>
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
/* ========== Armado de cajas (peso de cartón al crear + Peso estimado + Export cajas.xlsx con una hoja por caja) ========== */
function ArmadoCajas({packages, flights, setFlights, onAssign}){
  const [flightId,setFlightId]=useState("");
  const flight = flights.find(f=>f.id===flightId);
  const [scan,setScan]=useState("");
  const [activeBoxId, setActiveBoxId] = useState(null);

  const [editingBoxId, setEditingBoxId] = useState(null);
  const [editingBoxData, setEditingBoxData] = useState(null);

  useEffect(()=>{
    if (flightId) {
        const currentFlight = flights.find(f => f.id === flightId);
        if (currentFlight?.cajas?.length > 0) {
            setActiveBoxId(currentFlight.cajas[0].id);
        } else {
            setActiveBoxId(null);
        }
        setEditingBoxId(null);
        setEditingBoxData(null);
    }
  },[flightId]);

  const startEditing = (box) => {
    setEditingBoxId(box.id);
    setEditingBoxData({ ...box });
  };

  const cancelEditing = () => {
    setEditingBoxId(null);
    setEditingBoxData(null);
  };
  
  const saveBoxChanges = () => {
    setFlights(flights.map(f =>
      f.id !== flightId ? f : {
        ...f,
        cajas: f.cajas.map(c => c.id !== editingBoxId ? c : editingBoxData)
      }
    ));
    cancelEditing();
  };
  
  function addBox(){
    if(!flightId) return;
    const inTxt = window.prompt("Ingresá el peso de la caja de cartón (kg), ej: 0,250", "0,250");
    if(inTxt===null) return;
    const peso_carton = fmtPeso(parseComma(inTxt));
    const n = (flight?.cajas?.length||0)+1;
    const newBox = {id:uuid(),codigo:`Caja ${n}`,paquetes:[],peso:"",L:"",A:"",H:"", peso_carton};
    const updatedFlights = flights.map(f =>
      f.id !== flightId ? f : { ...f, cajas: [...f.cajas, newBox] }
    );
    setFlights(updatedFlights);
    setActiveBoxId(newBox.id);
  }

  function assign(){
    if(!scan||!flight) return;
    const pkg = packages.find(p=> p.flight_id===flightId && String(p.codigo||"").toUpperCase()===scan.toUpperCase());
    if(!pkg){ alert("No existe ese código en esta carga."); setScan(""); return; }
    if(flight.cajas.some(c=>c.paquetes.includes(pkg.id))){ alert("Ya está en una caja."); setScan(""); return; }
    const currentActiveId = activeBoxId || flight.cajas[0]?.id;
    if(!currentActiveId){ alert("Creá una caja primero."); return; }
    
    const updatedFlights = flights.map(f => {
      if (f.id !== flightId) return f;
      const updatedCajas = f.cajas.map(c => 
        c.id !== currentActiveId ? c : {...c, paquetes: [...c.paquetes, pkg.id]}
      );
      return {...f, cajas: updatedCajas};
    });
    setFlights(updatedFlights);
    onAssign(pkg.id); setScan("");
  }
  function move(pid,fromId,toId){
    if(!toId||!flight) return;
    let updatedFlights = flights.map(f => {
        if(f.id !== flightId) return f;
        const newCajas = f.cajas.map(c => {
            if(c.id === fromId) return {...c, paquetes: c.paquetes.filter(p => p !== pid)};
            if(c.id === toId) return {...c, paquetes: [...c.paquetes, pid]};
            return c;
        });
        return {...f, cajas: newCajas};
    });
    setFlights(updatedFlights);
  }
  function removeBox(id){
    if(!flight) return;
    setFlights(flights.map(f=>f.id!==flightId?f:{...f,cajas:f.cajas.filter(c=>c.id!==id)}));
    if(activeBoxId===id) setActiveBoxId(null);
    if(editingBoxId===id) cancelEditing();
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

  function pesoEstimado(caja){
    const pesoCarton = parseComma(caja.peso_carton||"0");
    const ids = caja.paquetes||[];
    const pesoPkgs = sum(ids.map(pid => {
      const p = packages.find(x=>x.id===pid);
      return p ? Number(p.peso_real||0) : 0;
    }));
    return Number(pesoCarton + pesoPkgs);
  }

  async function exportCajasXLSX(){
    if(!flight){ alert("Seleccioná una carga."); return; }

    const tpl = await tryLoadTemplate("/templates/cajas.xlsx");
    if(tpl){
      const baseName = tpl.SheetNames[0];
      const baseWs   = tpl.Sheets[baseName];
      const outWb = XLSX.utils.book_new();

      (flight.cajas||[]).forEach((caja, idx)=>{
        const pkgObjs = (caja.paquetes||[]).map(pid=>packages.find(p=>p.id===pid)).filter(Boolean);
        const byCourier = {};
        pkgObjs.forEach(p=>{
          if(!byCourier[p.courier]) byCourier[p.courier]=[];
          byCourier[p.courier].push(p.codigo);
        });
        const couriers = Object.keys(byCourier).sort();
        const cantPaquetes = pkgObjs.length;
        const ws = cloneSheetObject(baseWs);
        replacePlaceholdersInSheet(ws, {
          "NUMERO DE CAJA": String(idx+1),
          "CANTIDAD DE PAQUETES": String(cantPaquetes)
        });

        const headers = findCells(ws, v => v.includes("{{COURIER}}")).sort((a,b)=>a.c-b.c);
        headers.forEach((h, i)=>{
          const name = couriers[i] || "";
          writeCell(ws, h.r, h.c, name);
          fillCourierColumn(ws, {r:h.r, c:h.c}, byCourier[name] || []);
        });

        XLSX.utils.book_append_sheet(outWb, ws, `CAJA ${idx+1}`.slice(0,31));
      });

      XLSX.writeFile(outWb, `cajas_${flight.codigo}.xlsx`);
    } else {
        alert("No se encontró la plantilla 'cajas.xlsx'. Se usará un formato básico con bordes y colores.");
        const header = [th("Caja"), th("Peso caja (kg)"), th("Peso cartón (kg)"), th("Peso estimado (kg)"), th("Largo"), th("Ancho"), th("Alto"), th("Paquetes")];
        const body = (flight.cajas||[]).map(c=>{
          const est = fmtPeso(pesoEstimado(c));
          const pkgs = (c.paquetes||[]).map(pid=>packages.find(p=>p.id===pid)?.codigo).filter(Boolean).join(", ");
          return [ td(c.codigo), td(fmtPeso(parseComma(c.peso||"0"))), td(fmtPeso(parseComma(c.peso_carton||"0"))), td(est),
                  td(String(c.L||"")), td(String(c.A||"")), td(String(c.H||"")), td(pkgs) ];
        });
        const { ws } = sheetFromAOAStyled(`Cajas_${flight.codigo}`, [header, ...body], {
          cols:[{wch:12},{wch:16},{wch:16},{wch:18},{wch:10},{wch:10},{wch:10},{wch:40}],
          rows:[{hpt:24}]
        });
        downloadXLSX(`Cajas_${flight.codigo}.xlsx`, [{name:`Cajas_${flight.codigo}`.slice(0,31), ws}]);
    }
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
        <div className="flex items-end gap-2">
          <button onClick={addBox} disabled={!flightId} className={"px-3 py-2 bg-gray-800 text-white rounded-xl disabled:opacity-50"}>Agregar caja</button>
          <button onClick={exportCajasXLSX} disabled={!flight} className={"px-3 py-2 bg-gray-800 text-white rounded-xl disabled:opacity-50"}>Exportar XLSX</button>
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
            const est = pesoEstimado(c);

            return (
              <div key={c.id} className={`border rounded-2xl p-3 mb-3 ${isActive?"ring-2 ring-indigo-400":"hover:ring-1 hover:ring-indigo-200"}`} onClick={() => setActiveBoxId(c.id)}>
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium">
                    {c.codigo} — {etiqueta} — <span className="font-semibold">{fmtPeso(peso)} kg</span> — {L}x{A}x{H} cm
                    {isActive && <span className="ml-2 text-indigo-600 text-sm">(activa)</span>}
                  </div>
                  <div className="flex gap-2">
                    {!isEditing
                      ? <button className="px-2 py-1 border rounded" onClick={(e)=>{e.stopPropagation(); startEditing(c);}}>Editar</button>
                      : <button className="px-2 py-1 border rounded bg-indigo-600 text-white" onClick={(e)=>{e.stopPropagation(); saveBoxChanges();}}>Guardar</button>
                    }
                    <button className="px-2 py-1 border rounded" onClick={(e)=>{e.stopPropagation(); reorderBox(c.id,"up")}}>↑</button>
                    <button className="px-2 py-1 border rounded" onClick={(e)=>{e.stopPropagation(); reorderBox(c.id,"down")}>↓</button>
                    <button className="px-2 py-1 border rounded text-red-600" onClick={(e)=>{e.stopPropagation(); removeBox(c.id)}}>Eliminar</button>
                  </div>
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  <b>Peso estimado:</b> {fmtPeso(est)} kg (cartón {fmtPeso(parseComma(c.peso_carton||"0"))} kg + paquetes reales)
                </div>
                {isEditing && editingBoxData && (
                  <div className="grid md:grid-cols-5 gap-2 mb-2" onClick={e=>e.stopPropagation()}>
                    <Field label="Nombre de caja"><Input value={editingBoxData.codigo} onChange={e=>setEditingBoxData({...editingBoxData, codigo: e.target.value})}/></Field>
                    <Field label="Peso caja (kg)"><Input value={editingBoxData.peso||""} onChange={e=>setEditingBoxData({...editingBoxData, peso: e.target.value})} placeholder="3,128"/></Field>
                    <Field label="Largo (cm)"><Input value={editingBoxData.L||""} onChange={e=>setEditingBoxData({...editingBoxData, L: e.target.value})}/></Field>
                    <Field label="Ancho (cm)"><Input value={editingBoxData.A||""} onChange={e=>setEditingBoxData({...editingBoxData, A: e.target.value})}/></Field>
                    <Field label="Alto (cm)"><Input value={editingBoxData.H||""} onChange={e=>setEditingBoxData({...editingBoxData, H: e.target.value})}/></Field>
                  </div>
                )}
                <ul className="text-sm max-h-48 overflow-auto">
                  {c.paquetes.map(pid=>{
                    const p=packages.find(x=>x.id===pid); if(!p) return null;
                    return (
                      <li key={pid} className="flex items-center gap-2 py-1 border-b">
                        <span className="font-mono">{p.codigo}</span><span className="text-gray-600">{p.courier}</span>
                        <button className="text-red-600 text-xs" onClick={(e)=>{e.stopPropagation(); updBox(c.id,"paquetes", c.paquetes.filter(z=>z!==pid))}}>Quitar</button>
                        {flight.cajas.length>1 && (
                          <select className="text-xs border rounded px-1 py-0.5 ml-auto" defaultValue="" onChange={e=>{e.stopPropagation(); move(pid,c.id,e.target.value)}}>
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

/* ========== Cargas enviadas (filtro + export XLSX) ========== */
function CargasEnviadas({packages, flights, user}){
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
  const pref = user.role==="COURIER" ? courierPrefix(user.courier) : null;

  const paquetesDeVuelo = (flight
    ? packages.filter(p=>p.flight_id===flightId)
    : []
  ).filter(p => user.role!=="COURIER" || (p.courier===user.courier && String(p.codigo||"").toUpperCase().startsWith(pref)));

  const resumenCajas = useMemo(()=>{
    if(!flight) return [];
    return flight.cajas.map((c,i)=>{
      const peso=parseComma(c.peso||"0");
      const L=parseIntEU(c.L||0), A=parseIntEU(c.A||0), H=parseIntEU(c.H||0);
      const vol=(A*H*L)/6000 || 0;
      const visibleIds = new Set(paquetesDeVuelo.map(p=>p.id));
      const idsDeCaja = c.paquetes.filter(pid=> visibleIds.has(pid));
      const couriers = new Set(idsDeCaja.map(pid=>packages.find(p=>p.id===pid)?.courier).filter(Boolean));
      const etiqueta = couriers.size===0? "—" : (couriers.size===1? [...couriers][0] : "MULTICOURIER");
      return {n:i+1, codigo: c.codigo, courier:etiqueta, peso, L,A,H, vol};
    });
  },[flight,packages,paquetesDeVuelo]);

  const totPeso=sum(resumenCajas.map(r=>r.peso));
  const totVol=sum(resumenCajas.map(r=>r.vol));

  function exportFlightXLSX(){
    if(!flight){ alert("Seleccioná una carga."); return; }

    const headerPacking = ["Courier", "Casilla", "Código de paquete", "Fecha", "Empresa de envío", "Nombre y apellido", "Tracking", "Remitente", "Peso real", "Peso facturable", "Medidas", "Exceso de volumen", "Descripción", "Precio (EUR)"].map(th);
    const bodyPacking = paquetesDeVuelo.map(p => [
      td(p.courier), td(p.casilla), td(p.codigo), td(p.fecha), td(p.empresa_envio), td(p.nombre_apellido),
      td(p.tracking), td(p.remitente), tdNum(p.peso_real, "0.000"), tdNum(p.peso_facturable, "0.000"),
      td(`${p.largo}x${p.ancho}x${p.alto} cm`), tdNum(p.exceso_volumen, "0.000"), td(p.descripcion), tdNum(p.valor_aerolinea, "0.00")
    ]);
    const sheetPacking = sheetFromAOAStyled("Packing list", [headerPacking, ...bodyPacking], {
        cols: [{wch:16},{wch:10},{wch:18},{wch:12},{wch:20},{wch:22},{wch:18},{wch:18},{wch:12},{wch:14},{wch:14},{wch:14},{wch:28},{wch:12}],
        rows: [{hpt:24}]
    });

    const headerCajas = ["Nº de Caja", "Courier", "Peso", "Largo", "Ancho", "Alto", "Volumétrico"].map(th);
    const bodyCajas = resumenCajas.map(c => [
      td(c.codigo), td(c.courier), tdNum(c.peso, "0.000"), tdInt(c.L), tdInt(c.A), tdInt(c.H), tdNum(c.vol, "0.000")
    ]);
    const totalsRow = [
      td(""), th("Totales"), tdNum(totPeso, "0.000"), td(""), td(""), td(""), tdNum(totVol, "0.000")
    ];
    const sheetCajas = sheetFromAOAStyled("Cajas", [headerCajas, ...bodyCajas, totalsRow], {
        cols: [{wch:14},{wch:20},{wch:12},{wch:10},{wch:10},{wch:10},{wch:14}],
        rows: [{hpt:24}]
    });

    downloadXLSX(`Carga_${flight.codigo}.xlsx`, [sheetPacking, sheetCajas]);
  }

  return (
    <Section title="Cargas enviadas">
      <div className="grid md:grid-cols-6 gap-3 items-end">
        <Field label="Desde"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field>
        <Field label="Hasta"><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field>
        <Field label="Estado">
          <select className="w-full rounded-xl border px-3 py-2" value={estado} onChange={e=>setEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS_CARGA.filter(s => s !== 'En bodega').map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Carga">
          <select className="w-full rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {list.map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida} · {f.estado}</option>)}
          </select>
        </Field>
        <div className="md:col-span-2 flex items-end justify-end">
          <button onClick={exportFlightXLSX} disabled={!flight} className={"px-3 py-2 bg-gray-800 text-white rounded-xl disabled:opacity-50"}>
            Exportar XLSX
          </button>
        </div>
      </div>

      {!flight ? <div className="text-gray-500 mt-4">Elegí una carga para ver contenido.</div> : (
        <>
          <div className="mt-4 text-sm text-gray-600">Paquetes del vuelo <b>{flight.codigo}</b></div>
          <div className="overflow-auto mb-6">
            <table className="min-w-full text-sm">
              <thead><tr className="bg-gray-50">{["Courier","Código","Casilla","Fecha","Nombre","Tracking","Peso real","Medidas","Exceso","Descripción"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {paquetesDeVuelo.map(p=>(
                  <tr key={p.id} className="border-b">
                    <td className="px-3 py-2">{p.courier}</td>
                    <td className="px-3 py-2 font-mono">{p.codigo}</td>
                    <td className="px-3 py-2">{p.casilla}</td>
                    <td className="px-3 py-2">{p.fecha}</td>
                    <td className="px-3 py-2">{p.nombre_apellido}</td>
                    <td className="px-3 py-2 font-mono">{p.tracking}</td>
                    <td className="px-3 py-2">{fmtPeso(p.peso_real)}</td>
                    <td className="px-3 py-2">{p.largo}x{p.ancho}x{p.alto} cm</td>
                    <td className="px-3 py-2">{fmtPeso(p.exceso_volumen)}</td>
                    <td className="px-3 py-2">{p.descripcion}</td>
                  </tr>
                ))}
                {paquetesDeVuelo.length===0 && <tr><td colSpan={10} className="text-center text-gray-500 py-6">No hay paquetes para tu usuario.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="bg-gray-50">{["Nº Caja","Courier","Peso","Largo","Ancho","Alto","Volumétrico"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {resumenCajas.map(r=>(
                  <tr key={r.n} className="border-b">
                    <td className="px-3 py-2">{r.codigo}</td>
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
/* ========== Gestión de cargas (crear/editar/eliminar con confirmación) ========== */
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
  
  function getMissingScanPackages(flight, allPackages) {
    const idsDeCarga = allPackages.filter(p => p.flight_id === flight.id).map(p => p.id);
    const asignados = new Set((flight.cajas || []).flatMap(c => c.paquetes || []));
    const missingIds = idsDeCarga.filter(id => !asignados.has(id));
    return missingIds.map(id => allPackages.find(p => p.id === id)?.codigo || 'ID desconocido');
  }

  function upd(id,field,value){
    if(field==="estado" && value!=="En bodega"){
      const f = flights.find(x=>x.id===id);
      if(f && f.estado === 'En bodega'){
        const missingPackages = getMissingScanPackages(f, packages);
        if(missingPackages.length > 0){
          const packageList = missingPackages.join(', ');
          const message = `Atención: Faltan escanear ${missingPackages.length} paquete(s) en "Armado de cajas" para la carga ${f.codigo}.\n\nPaquetes faltantes: ${packageList}\n\n¿Deseás continuar igualmente?`;
          const ok = window.confirm(message);
          if(!ok) return;
        }
      }
    }
    setFlights(flights.map(f=>f.id===id?{...f,[field]:value}:f));
  }
  function del(id){
    const f = flights.find(x=>x.id===id);
    const tienePaquetes = packages.some(p=>p.flight_id===id);
    if(tienePaquetes){
      alert(`No se puede eliminar la carga ${f?.codigo||""} porque tiene paquetes asociados.`);
      return;
    }
    const ok = window.confirm(`¿Eliminar la carga ${f?.codigo||id}?`);
    if(!ok) return;
    setFlights(flights.filter(x=>x.id!==id));
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
          <thead><tr className="bg-gray-50">{["Código","Fecha salida","Estado","AWB","Factura Cacesa","Cajas","Acciones"].map(h=><th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
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
            {list.length===0 && <tr><td colSpan={7} className="text-center text-gray-500 py-6">Sin resultados.</td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ========== Proformas (cant 3 dec; unit/sub 2; extras y 4% con cant=1) ========== */
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
  const [statusFilter, setStatusFilter] = useState("Pendiente");

  const add=()=>{
    if(!(flightId && courier && desc && monto)) return;
    setExtras([...extras,{ id:uuid(), flight_id:flightId, courier, descripcion:desc, monto, estado, fecha }]);
    setDesc(""); setMonto("");
  };
  const filtered = extras
    .filter(e=>!from || (e.fecha || (flights.find(f=>f.id===e.flight_id)?.fecha_salida)||"")>=from)
    .filter(e=>!to || (e.fecha || (flights.find(f=>f.id===e.flight_id)?.fecha_salida)||"")<=to)
    .filter(e=>!flightId || e.flight_id===flightId)
    .filter(e => statusFilter === 'Todos' || e.estado === statusFilter);

  const upd=(id,patch)=> setExtras(extras.map(e=>e.id===id?{...e,...patch}:e));
  const del=(id)=> setExtras(extras.filter(e=>e.id!==id));

  return (
    <Section title="Trabajos extras">
      <div className="grid md:grid-cols-6 gap-2 mb-2">
        <Field label="Carga"><select className="w-full rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}><option value="">—</option>{flights.map(f=><option key={f.id} value={f.id}>{f.codigo}</option>)}</select></Field>
        <Field label="Courier"><select className="w-full rounded-xl border px-3 py-2" value={courier} onChange={e=>setCourier(e.target.value)}><option value="">—</option>{couriers.map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Descripción"><Input value={desc} onChange={e=>setDesc(e.target.value)}/></Field>
        <Field label="Monto (USD)"><Input value={monto} onChange={e=>setMonto(e.target.value)} placeholder="10,00"/></Field>
        <Field label="Estado"><select className="w-full rounded-xl border px-3 py-2" value={estado} onChange={e=>setEstado(e.target.value)}><option>Pendiente</option><option>Cobrado</option></select></Field>
        <Field label="Fecha"><Input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></Field>
      </div>
      <div className="flex justify-end mb-4"><button onClick={add} className={BTN_PRIMARY}>Agregar</button></div>

      <div className="grid md:grid-cols-3 gap-2 mb-3">
        <Field label="Filtrar desde"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field>
        <Field label="Filtrar hasta"><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field>
        <Field label="Filtrar por estado">
            <select className="w-full rounded-xl border px-3 py-2" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="Pendiente">Pendiente</option>
                <option value="Cobrado">Cobrado</option>
                <option value="Todos">Todos</option>
            </select>
        </Field>
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
                  <td className="px-3 py-2"><button onClick={()=>del(e.id)} className="px-2 py-1 border rounded text-red-600">Eliminar</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ========== App (tabs por rol + Usuarios + Sin Casilla con permisos) ========== */
function App(){
  const [currentUser,setCurrentUser]=useState(null);
  const [tab,setTab]=useState("Recepción");
  const [couriers,setCouriers]=useState(COURIERS_INICIALES);
  const [estados,setEstados]=useState(ESTADOS_INICIALES);
  const [flights,setFlights]=useState([]);
  const [packages,setPackages]=useState([]);
  const [extras,setExtras]=useState([]);

  const SINCASILLA_KEY = "ee_sincasilla_v1";
  const [sinCasillaItems, setSinCasillaItems] = useState([]);
  useEffect(()=>{
    try{
      const raw = localStorage.getItem(SINCASILLA_KEY);
      if(raw) setSinCasillaItems(JSON.parse(raw));
    }catch{}
  },[]);
  useEffect(()=>{
    localStorage.setItem(SINCASILLA_KEY, JSON.stringify(sinCasillaItems));
  },[sinCasillaItems]);

  const PENDIENTES_KEY = "ee_pendientes_v2";
  const [pendientes, setPendientes] = useState([]);
  useEffect(()=>{
    try{
      const raw = localStorage.getItem(PENDIENTES_KEY);
      if(raw) setPendientes(JSON.parse(raw));
    }catch{}
  },[]);
  useEffect(()=>{
    localStorage.setItem(PENDIENTES_KEY, JSON.stringify(pendientes));
  },[pendientes]);

  useEffect(()=>{
    if(currentUser){
      const allowed = tabsForRole(currentUser.role);
      if(!allowed.includes(tab)) setTab(allowed[0]);
    }
  },[currentUser, tab]);

  if(!currentUser) return <Login onLogin={setCurrentUser} />;

  const allowedTabs = tabsForRole(currentUser.role);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Gestor de Paquetes</div>
          <div className="text-xs text-gray-500">LaMaquinaLogistica / Europa Envíos</div>
        </div>
        <div className="text-sm text-gray-600">
          {currentUser.role} — {currentUser.email}
        </div>
      </div>
      <div className="px-6">
        <div className="flex gap-2 flex-wrap mb-4">
          {allowedTabs.map(t=>(
            <button
              key={t}
              onClick={()=>setTab(t)}
              className={"px-3 py-2 rounded-xl text-sm " + (tab===t ? "bg-indigo-600 text-white" : "bg-white border")}
            >
              {t}
            </button>
          ))}
        </div>

        {tab==="Recepción" && <Reception currentUser={currentUser} couriers={couriers} setCouriers={setCouriers} estados={estados} setEstados={setEstados} flights={flights} onAdd={(p)=>setPackages([p,...packages])}/>}
        {tab==="Paquetes sin casilla" && <PaquetesSinCasilla currentUser={currentUser} items={sinCasillaItems} setItems={setSinCasillaItems} setPendientes={setPendientes}/>}
        {tab==="Pendientes" && <Pendientes items={pendientes} setItems={setPendientes}/>}
        {tab==="Paquetes en bodega" && <PaquetesBodega packages={packages} flights={flights} user={currentUser} onUpdate={(p)=>setPackages(packages.map(x=>x.id===p.id?p:x))} onDelete={(id)=>setPackages(packages.filter(p=>p.id!==id))} setPendientes={setPendientes}/>}
        {tab==="Armado de cajas" && <ArmadoCajas packages={packages} flights={flights} setFlights={setFlights} onAssign={(id)=>setPackages(packages.map(p=>p.id===id?p:{...p}))}/>}
        {tab==="Cargas enviadas" && <CargasEnviadas packages={packages} flights={flights} user={currentUser}/>}
        {tab==="Gestión de cargas" && <CargasAdmin flights={flights} setFlights={setFlights} packages={packages}/>}
        {tab==="Proformas" && <Proformas packages={packages} flights={flights} extras={extras}/>}
        {tab==="Usuarios" && <Usuarios currentUser={currentUser} onCurrentUserChange={(u)=>setCurrentUser(u)}/>}
        {tab==="Extras" && <Extras flights={flights} couriers={couriers} extras={extras} setExtras={setExtras}/>}
      </div>
    </div>
  );
}

export default App;
