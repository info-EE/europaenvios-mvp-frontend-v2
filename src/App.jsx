/* Europa Envíos – MVP v1.6.0 (Ajuste Final de Etiquetas y Proformas)
    - Se rediseña la etiqueta de recepción al formato final solicitado.
    - Se añaden los 'extras' al cálculo de las proformas para cargas marítimas.
    - Se ajusta el filtro de la pestaña Proformas para mostrar solo cargas AIR/MAR y con fecha por defecto de 90 días.
    - Se modifica la lógica de exportación de proformas para cargas "MAR".
    - Se añade validación para evitar códigos de paquete duplicados por carga.
    - Se permite la carga de múltiples fotos por paquete.
    - Se añade el campo opcional "CI/Pasaporte/RUC".
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import * as XLSX from "xlsx-js-style";
import JsBarcode from "jsbarcode";
import ExcelJS from "exceljs/dist/exceljs.min.js";

// =======================================================
// IMPORTS DE FIREBASE (ACTUALIZADOS PARA AUTH Y CONTADORES)
// =======================================================
import { storage, db, auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "./firebase";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc, query, orderBy, getDoc, runTransaction } from "firebase/firestore";

// =======================================================

/* ========== Iconos SVG (Heroicons) ========== */
const Iconos = {
  upload: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>,
  file: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
  dashboard: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>,
  edit: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>,
  delete: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>,
  add: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>,
  save: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>,
  box: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>,
  userCircle: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>,
  paquetes: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>,
  envios: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>,
  gestion: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-4.663c.11-.256.217-.512.324-.768a3.375 3.375 0 016.082-2.348c.384.473.727.986 1.03 1.536a3.007 3.007 0 01-2.33 4.293c-.453.138-.927.234-1.4.301M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  logout: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>,
  print: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.061dec1.124 0 .904-.935 1.124-1.932 1.124-3.003 0-1.068-.22-2.072-.634-2.942m-1.124-3.003c.17-.283.352-.55.55-.81m0 0a3.003 3.003 0 00-2.095-2.095m0 0c-.26-.198-.537-.375-.81-.55m-2.095 2.095a3.003 3.003 0 00-2.095-2.095m0 0c-.283.17-.55.352-.81.55m2.095 2.095c.198.26.375.537.55.81" /></svg>,
};
const uuid = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const deaccent = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ñ/g, "n").replace(/Ñ/g, "N");
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
const bd = () => ({ top:{style:"thin",color:{rgb:"FF000000"}}, bottom:{style:"thin",color:{rgb:"FF000000"}}, left:{style:"thin",color:{rgb:"FF000000"}}, right:{style:"thin",color:{rgb:"FF000000"}} });
const th = (txt) => ({ v:txt, t:"s", s:{font:{bold:true,color:{rgb:"FFFFFFFF"}},fill:{fgColor:{rgb:"FF1F2937"}}, alignment:{horizontal:"center",vertical:"center"}, border:bd()} });
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
function courierPrefix(name){ return limpiar(name || ""); }
function tabsForRole(role){
  if(role==="COURIER") return ["Dashboard", "Paquetes sin casilla","Paquetes en bodega","Cargas enviadas", "Proformas"];
  return ["Dashboard", "Recepción","Paquetes sin casilla","Pendientes","Paquetes en bodega","Armado de cajas","Cargas enviadas","Gestión de cargas","Proformas","Usuarios","Extras"];
}
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
function barcodeSVG(text){
  const safe = deaccent(String(text)).toUpperCase();
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, safe, { format:"CODE128", displayValue:false, height:50, margin:0 });
  return new XMLSerializer().serializeToString(svg);
}
function labelHTML({ codigo, nombre, casilla, pesoKg, medidasTxt, desc, cargaTxt, fecha }){
  const svgHtml = barcodeSVG(codigo);
  const fechaFmt = fecha ? new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES') : '';
  return `
    <html><head><meta charset="utf-8"><title>Etiqueta ${codigo}</title>
    <style>
      @page { size: 100mm 50mm; margin: 3mm; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; font-size: 10pt; line-height: 1.3; }
      .label-container { display: flex; flex-direction: column; width: 94mm; height: 44mm; }
      .line { margin-bottom: 1mm; }
      .b { font-weight: bold; }
      .header { display: flex; justify-content: space-between; font-size: 11pt; }
      .barcode { text-align: center; margin: 1mm 0; }
      .barcode svg { width: 100%; height: 12mm; }
      .desc-line { white-space: normal; word-wrap: break-word; line-height: 1.2; }
    </style></head><body>
      <div class="label-container">
        <div class="header line">
          <span>Codigo: <span class="b">${deaccent(codigo ?? "")}</span></span>
          <span>${fechaFmt}</span>
        </div>
        <div class="barcode">${svgHtml}</div>
        <div class="line">Cliente: <span class="b">${deaccent(nombre ?? "")}</span></div>
        <div class="line">Casilla: <span class="b">${deaccent(casilla ?? "")}</span></div>
        <div class="line">Peso: <span class="b">${fmtPeso(pesoKg)} kg</span></div>
        <div class="line">Medidas: ${deaccent(medidasTxt ?? "")}</div>
        <div class="line desc-line">Desc: ${deaccent(desc ?? "")}</div>
        <div class="line" style="margin-top: auto;">Carga: <span class="b">${deaccent(cargaTxt ?? "-")}</span></div>
      </div>
    </body></html>`;
}
function boxLabelHTML({ courier, boxNumber, pesoKg, medidasTxt, fecha }) {
  const cajaDeTexto = `CAJA: ${boxNumber} de`;

  return `
    <html>
      <head>
        <meta charset="utf-8">
        <title>Etiqueta de Caja ${boxNumber}</title>
        <style>
          @page { size: 4in 6in; margin: 0; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; width: 4in; height: 6in; }
          .label { width: 100%; height: 100%; display: flex; flex-direction: column; text-align: center; padding: 4mm; box-sizing: border-box; overflow: hidden; }
          .header { flex-grow: 1.5; display: flex; flex-direction: column; justify-content: center; }
          .courier { font-size: 28pt; font-weight: bold; line-height: 1; word-break: break-word; }
          .box-title { font-size: 54pt; font-weight: bold; margin-top: 4mm; }
          .content { flex-grow: 2; display: flex; flex-direction: column; justify-content: center; }
          .detail-group { margin-bottom: 8mm; }
          .details-label { font-size: 16pt; font-weight: bold; }
          .details-value { font-size: 28pt; font-weight: bold; }
          .footer { flex-grow: 1; text-align: left; font-size: 11pt; line-height: 1.3; display: flex; flex-direction: column; justify-content: flex-end; }
          .footer-obs { padding-bottom: 4mm; }
          .company-info { font-size: 8pt; border-top: 1px solid black; padding-top: 2mm; }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="header">
            <div class="courier">${deaccent(courier || "").toUpperCase()}</div>
            <div class="box-title">CAJA ${boxNumber}</div>
          </div>
          <div class="content">
            <div class="detail-group">
              <div class="details-label">PESO:</div>
              <div class="details-value">${fmtPeso(pesoKg)} kg</div>
            </div>
            <div class="detail-group">
              <div class="details-label">MEDIDAS:</div>
              <div class="details-value">${deaccent(medidasTxt || "")}</div>
            </div>
          </div>
          <div class="footer">
            <div class="footer-obs">
                Fecha: ${fecha}<br/>
                ${cajaDeTexto}
            </div>
             <div class="company-info">
                <b>Europa Envíos</b><br/>
                Una empresa de LAMAQUINALOGISTICA SL<br/>
                Málaga, España.<br/>
                Teléfono: +34633740831<br/>
                info@europaenvios.com
             </div>
          </div>
        </div>
      </body>
    </html>`;
}
const BTN = "px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors duration-200";
const BTN_PRIMARY = "px-4 py-2 rounded-lg bg-francia-600 hover:bg-francia-700 text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md";
const BTN_ICON = "p-2 rounded-lg hover:bg-slate-100 transition-colors duration-200 text-slate-600";
const BTN_ICON_DANGER = "p-2 rounded-lg hover:bg-red-50 transition-colors duration-200 text-red-600";
const Section = ({title,right,children})=>(
  <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6">
    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
      <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      <div className="flex items-center gap-2">{right}</div>
    </div>{children}
  </div>
);
const Field = ({label,required,children})=>(
  <label className="block">
    <div className="text-sm font-medium text-slate-700 mb-1">
      {label}{required && <span className="text-red-500"> *</span>}
    </div>
    {children}
  </label>
);
const Input = (p)=>(
  <input {...p} className={"w-full text-sm rounded-lg border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-francia-500 focus:border-francia-500 transition-all " +(p.className||"")} />
);
function EmptyState({ icon, title, message }) {
  return (
    <div className="text-center py-10 px-4 border-2 border-dashed border-slate-200 rounded-lg">
      <div className="mx-auto w-12 h-12 text-slate-400">{icon}</div>
      <h3 className="mt-2 text-lg font-medium text-slate-800">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{message}</p>
    </div>
  );
}
function PasswordInput({value,onChange,placeholder}) {
  const [show,setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder} autoComplete="current-password" />
      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-600 font-semibold" onClick={()=>setShow(s=>!s)}>
        {show ? "Ocultar" : "Ver"}
      </button>
    </div>
  );
}
function Modal({open,onClose,title,children}){
  if(!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-auto flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className={BTN}>Cerrar</button>
        </div>
        <div className="p-4 sm:p-6 flex-grow">{children}</div>
      </div>
    </div>
  );
}
const ESTADOS_INICIALES = ["Aéreo","Marítimo","Ofrecer marítimo"];
const COURIERS_INICIALES = [
  "Aero Box", "Aladín","Boss Box","Buzón","Caba Box","Click Box","Easy Box","Europa Envíos",
  "FastBox","Fixo Cargo","Fox Box","Global Box","Home Box","Inflight Box","Inter Couriers",
  "MC Group","Miami Express","One Box","ParaguayBox","Royal Box"
];
const ESTADOS_CARGA = ["En bodega","En tránsito","Arribada", "Entregada", "Cobrada"];
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

/* ========== Login con Firebase Authentication ========== */
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setErr("Usuario o contraseña incorrectos.");
      } else {
        console.error("Firebase Login Error:", error);
        setErr("Error al iniciar sesión. Inténtalo de nuevo.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 w-full max-w-md">
        <img src="/logo.png" alt="Logo Europa Envíos" className="w-48 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-slate-800 mb-4 text-center">Acceso al sistema</h1>
        <form onSubmit={handleLogin}>
          <Field label="Email" required>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@empresa.com" autoComplete="email"/>
          </Field>
          <div className="h-4" />
          <Field label="Contraseña" required>
            <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"/>
          </Field>
          {err && <div className="text-red-600 text-sm my-2 text-center">{err}</div>}
          <button type="submit" disabled={loading} className={BTN_PRIMARY + " w-full mt-4 disabled:opacity-50"}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}


/* ========== DASHBOARD ========== */
const KpiCard = ({ title, value, icon, color }) => (
  <div className={`bg-white p-6 rounded-xl shadow-md flex items-center gap-6 border-l-4 ${color}`}>
    <div className={`text-3xl ${color.replace('border', 'text')}`}>{icon}</div>
    <div>
      <div className="text-slate-500 text-sm font-medium">{title}</div>
      <div className="text-slate-800 text-3xl font-bold">{value}</div>
    </div>
  </div>
);

function Dashboard({ packages, flights, pendientes, onTabChange, currentUser }) {
  const isAdmin = currentUser.role === 'ADMIN';

  const paquetesEnBodega = useMemo(() => {
    let filteredPackages = packages.filter(p => flights.find(f => f.id === p.flight_id)?.estado === "En bodega");
    if (!isAdmin) {
      filteredPackages = filteredPackages.filter(p => p.courier === currentUser.courier);
    }
    return filteredPackages;
  }, [packages, flights, isAdmin, currentUser.courier]);

  const cargasEnTransito = useMemo(() => flights.filter(f => f.estado === "En tránsito"), [flights]);
  const tareasPendientes = useMemo(() => pendientes.filter(t => t.status === "No realizada"), [pendientes]);

  const paquetesPorDia = useMemo(() => {
    const data = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(5, 10); // MM-DD
        data[key] = 0;
    }
    let packagesToProcess = packages;
    if (!isAdmin) {
        packagesToProcess = packages.filter(p => p.courier === currentUser.courier);
    }
    packagesToProcess.forEach(p => {
        const d = new Date(p.fecha);
        const key = d.toISOString().slice(5, 10);
        if (data[key] !== undefined) {
            data[key]++;
        }
    });
    return Object.entries(data).map(([name, value]) => ({ name, paquetes: value }));
  }, [packages, isAdmin, currentUser.courier]);
  
  const kgPorCourier = useMemo(() => {
    const agg = {};
    let packagesToProcess = paquetesEnBodega;
    if (!isAdmin) {
        packagesToProcess = paquetesEnBodega.filter(p => p.courier === currentUser.courier);
    }
    packagesToProcess.forEach(p => {
        agg[p.courier] = (agg[p.courier] || 0) + p.peso_real;
    });
    return Object.entries(agg)
        .filter(([, kg]) => kg > 0)
        .map(([name, value]) => ({ name, value }));
  }, [paquetesEnBodega, isAdmin, currentUser.courier]);
  
  const totalKgBodega = useMemo(() => sum(kgPorCourier.map(c => c.value)), [kgPorCourier]);


  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h1>
      
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <KpiCard title="Paquetes en Bodega" value={paquetesEnBodega.length} icon={Iconos.box} color="border-francia-500" />
        {isAdmin && <KpiCard title="Cargas en Tránsito" value={cargasEnTransito.length} icon={Iconos.envios} color="border-amber-500" />}
        {isAdmin && <KpiCard title="Tareas Pendientes" value={tareasPendientes.length} icon={Iconos.gestion} color="border-red-500" />}
      </div>

      {/* Acciones Rápidas */}
      {isAdmin && (
        <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Acciones Rápidas</h2>
            <div className="flex flex-wrap gap-4">
                <button className={BTN_PRIMARY} onClick={() => onTabChange("Recepción")}>Registrar Nuevo Paquete</button>
                <button className={BTN_PRIMARY} onClick={() => onTabChange("Gestión de cargas")}>Crear Nueva Carga</button>
                <button className={BTN_PRIMARY} onClick={() => onTabChange("Armado de cajas")}>Armar Cajas</button>
            </div>
        </div>
      )}
      
      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="font-semibold text-slate-700 mb-4">Paquetes recibidos (últimos 7 días)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={paquetesPorDia} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="paquetes" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-md flex flex-col">
           <h3 className="font-semibold text-slate-700 mb-4">Kg Reales por Courier (en bodega)</h3>
           <div className="flex-grow flex items-center">
            {kgPorCourier.length > 0 ? (
                <>
                <ResponsiveContainer width="50%" height="100%">
                    <PieChart>
                        <Pie data={kgPorCourier} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80}>
                        {kgPorCourier.map((_, i) => (
                            <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                        ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${fmtPeso(value)} kg`} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="w-1/2 text-sm pl-4">
                    <ul>
                        {kgPorCourier.map((entry, index) => (
                            <li key={`item-${index}`} className="flex justify-between items-center py-1 border-b border-slate-100">
                                <span className="flex items-center"><div className="w-3 h-3 mr-2 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{entry.name}</span>
                                <span className="font-semibold">{fmtPeso(entry.value)} kg</span>
                            </li>
                        ))}
                         <li className="flex justify-between items-center py-2 font-bold mt-2 border-t-2 border-slate-300">
                            <span>TOTAL</span>
                            <span>{fmtPeso(totalKgBodega)} kg</span>
                        </li>
                    </ul>
                </div>
                </>
            ) : <div className="flex items-center justify-center h-full w-full text-slate-500">No hay paquetes en bodega</div> }
            </div>
        </div>
      </div>
    </div>
  );
}

/* ========== Gestión de Usuarios (REEMPLAZADO) ========== */
function Usuarios() {
  return (
    <Section title="Gestión de Usuarios">
      <div className="bg-francia-50 border-l-4 border-francia-500 p-4 rounded-r-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-francia-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-francia-800">Atención: Nueva gestión de usuarios</h3>
            <div className="mt-2 text-sm text-francia-700">
              <p>La gestión de usuarios (crear, editar, eliminar y cambiar contraseñas) ahora se realiza directamente en la Consola de Firebase para mayor seguridad.</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><b>Para añadir un usuario:</b> Ve a Firebase Console → Authentication → Users → Add user.</li>
                <li><b>Para asignar un rol:</b> Ve a Firebase Console → Firestore Database → `users` collection. Crea un documento con el UID del usuario y añade los campos `role` y `courier`.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ========== helpers listas sencillas ========== */
function ManageList({label, items, onAdd, onRemove}){
  const [txt,setTxt]=useState("");
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="font-medium mb-2 text-slate-800">{label}</div>
      <div className="flex gap-2">
        <Input value={txt} onChange={e=>setTxt(e.target.value)} placeholder={`Agregar a ${label}`}/>
        <button className={BTN} onClick={()=>{ if(!txt.trim()) return; onAdd({ name: txt.trim() }); setTxt(""); }}>Añadir</button>
      </div>
      <ul className="mt-2 text-sm">
        {items.map((x)=>(
          <li key={x.id} className="flex items-center justify-between py-1.5 border-b border-slate-200">
            <span className="text-slate-700">{x.name}</span>
            <button className="text-red-600 text-xs font-semibold" onClick={()=>onRemove(x.id)}>Quitar</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ========== SECCIÓN DE RECEPCIÓN (CON CONTADOR CENTRALIZADO) ========== */
function Reception({ currentUser, couriers, setCouriers, estados, setEstados, flights, packages, onAdd }){
  const vuelosBodega = flights.filter(f=>f.estado==="En bodega");
  const [flightId,setFlightId]=useState("");
  const [form,setForm]=useState({
    courier: currentUser.role==="COURIER"? (currentUser.courier || "") : "",
    estado:"", casilla:"", codigo:"",
    fecha:new Date().toISOString().slice(0,10),
    ci_ruc: "", empresa:"", nombre:"", tracking:"", remitente:"",
    peso_real_txt:"", L_txt:"", A_txt:"", H_txt:"",
    desc:"", valor_txt:"",
    fotos:[]
  });

  const [isUploading, setIsUploading] = useState(false);

  const codigoCargaSel = useMemo(() => flights.find(f=>f.id===flightId)?.codigo || "", [flightId, flights]);
  const estadosPermitidos = useMemo(() => estadosPermitidosPorCarga(codigoCargaSel, estados.map(e => e.name)), [codigoCargaSel, estados]);

  useEffect(() => {
    if (!form.courier) {
      setForm(f => ({ ...f, codigo: "" }));
      return;
    }
  
    const previewCode = async () => {
      const prefix = courierPrefix(form.courier);
      const counterRef = doc(db, "counters", "packageSequences");
      try {
        const counterSnap = await getDoc(counterRef);
        const currentCount = counterSnap.data()?.[prefix] ?? -1;
        if (currentCount === -1) {
           setForm(f => ({ ...f, codigo: "ERR" }));
           console.warn(`Contador para ${prefix} no encontrado en Firestore.`);
        } else {
          setForm(f => ({ ...f, codigo: `${prefix}${currentCount + 1}` }));
        }
      } catch (error) {
        console.error("Error al obtener vista previa del código:", error);
        setForm(f => ({ ...f, codigo: "ERR" }));
      }
    };
  
    previewCode();
  }, [form.courier]);

  useEffect(() => {
    if (estadosPermitidos.length === 1 && form.estado !== estadosPermitidos[0]) {
      setForm(f => ({ ...f, estado: estadosPermitidos[0] }));
    }
  }, [estadosPermitidos, form.estado]);

  const courierOptions = useMemo(()=>{
    return allowedCouriersByContext({
      casilla: form.casilla,
      flightCode: codigoCargaSel,
      avail: couriers.map(c => c.name)
    });
  }, [form.casilla, codigoCargaSel, couriers]);

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
      "courier","estado","casilla","fecha","empresa","nombre",
      "tracking","remitente","peso_real_txt","L_txt","A_txt","H_txt","desc","valor_txt"
    ].every(k=>String(form[k]||"").trim()!=="");

  const submit= async ()=>{
    if (isUploading) return;
    if(!flightId){ alert("Seleccioná una Carga."); return; }
    if(!okCampos()){ alert("Faltan campos."); return; }
    
    const fl = flights.find(f=>f.id===flightId);
    if (fl?.codigo.toUpperCase().startsWith("AIR-MULTI") && form.courier === "ParaguayBox") {
      alert("No se permite cargar paquetes de ParaguayBox en cargas que comiencen con AIR-MULTI.");
      return;
    }
    
    let finalCode = "";
    try {
      await runTransaction(db, async (transaction) => {
        const prefix = courierPrefix(form.courier);
        const counterRef = doc(db, "counters", "packageSequences");
        const counterDoc = await transaction.get(counterRef);

        if (!counterDoc.exists() || counterDoc.data()?.[prefix] === undefined) {
          throw new Error(`El contador para "${prefix}" no está configurado en Firestore.`);
        }
        
        let newCount = (counterDoc.data()[prefix] || 0) + 1;
        if (newCount > 999) newCount = 1; // Reinicia el contador si llega a 1000

        transaction.update(counterRef, { [prefix]: newCount });
        finalCode = `${prefix}${newCount}`;
      });
    } catch (e) {
      console.error("Error en la transacción del contador: ", e);
      alert(`No se pudo generar el código del paquete. Error: ${e.message}`);
      return;
    }

    const existingPackage = packages.find(p => p.flight_id === flightId && p.codigo === finalCode);
    if (existingPackage) {
      alert(`Error: El código de paquete "${finalCode}" ya existe en esta carga. Por favor, intente de nuevo.`);
      return;
    }

    const p={
      flight_id: flightId,
      courier: form.courier, estado: form.estado, casilla: form.casilla,
      codigo: finalCode,
      codigo_full: `${fl?.codigo||"CARGA"}-${finalCode}`,
      fecha: form.fecha, ci_ruc: form.ci_ruc, empresa_envio: form.empresa, nombre_apellido: form.nombre,
      tracking: form.tracking, remitente: form.remitente,
      peso_real: peso, largo: L, ancho: A, alto: H,
      descripcion: form.desc, valor_aerolinea: parseComma(form.valor_txt),
      peso_facturable: Number(fact.toFixed(3)), peso_volumetrico: Number(vol.toFixed(3)), exceso_volumen: Number(exc.toFixed(3)),
      fotos: form.fotos,
      estado_bodega: "En bodega",
    };

    const medidas = `${L}x${A}x${H} cm`;
    const html = labelHTML({
      codigo: finalCode, nombre: form.nombre, casilla: form.casilla,
      pesoKg: peso, medidasTxt: medidas, desc: form.desc, cargaTxt: fl?.codigo || "-", fecha: form.fecha
    });

    await onAdd(p);
    printHTMLInIframe(html);

    setFlightId("");
    setForm(f=>({
      ...f, courier: currentUser.role==="COURIER" ? f.courier : "", estado:"", casilla:"", codigo:"", ci_ruc: "", empresa:"", nombre:"", tracking:"", remitente:"",
      peso_real_txt:"", L_txt:"", A_txt:"", H_txt:"", desc:"", valor_txt:"", fotos:[]
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

  const handleImageUpload = async (imageDataUrl) => {
    if (!imageDataUrl) return;
    setIsUploading(true);
    try {
      const imageName = `paquetes/${uuid()}.jpg`;
      const storageRef = ref(storage, imageName);
      const snapshot = await uploadString(storageRef, imageDataUrl, 'data_url');
      const downloadURL = await getDownloadURL(snapshot.ref);
      setForm(f => ({ ...f, fotos: [...f.fotos, downloadURL] }));
    } catch (error) {
      console.error("Error al subir imagen:", error);
      alert("Hubo un error al subir la foto.");
    } finally {
      setIsUploading(false);
    }
  };
  
  const removePhoto = (urlToRemove) => {
    setForm(f => ({ ...f, fotos: f.fotos.filter(url => url !== urlToRemove) }));
  };

  const tomarFoto=()=>{
    const v=videoRef.current; if(!v) return;
    const canvas=document.createElement("canvas");
    canvas.width=v.videoWidth; canvas.height=v.videoHeight;
    const ctx=canvas.getContext("2d"); ctx.drawImage(v,0,0);
    const data=canvas.toDataURL("image/jpeg",0.85);
    handleImageUpload(data);
    setCamOpen(false);
  };

  const fileRef = useRef(null);
  const onFile = (e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    const r=new FileReader();
    r.onload=() => handleImageUpload(r.result);
    r.readAsDataURL(file);
  };

  const [showMgr,setShowMgr]=useState(false);

  if(currentUser.role==="COURIER"){
    return ( <Section title="Recepción de paquete"><div className="text-gray-600">Tu rol no tiene acceso a Recepción.</div></Section> );
  }

  return (
    <Section
      title="Recepción de paquete"
      right={ <div className="flex items-center gap-2"><button className={BTN} onClick={()=>setShowMgr(s=>!s)}>Gestionar listas</button></div> }
    >
      {showMgr && (
        <div className="grid md:grid-cols-2 gap-4 my-4 p-4 bg-slate-50 rounded-lg">
          <ManageList label="Couriers" items={couriers} onAdd={setCouriers.add} onRemove={setCouriers.remove}/>
          <ManageList label="Estados" items={estados} onAdd={setEstados.add} onRemove={setEstados.remove}/>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Carga" required>
          <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {vuelosBodega.map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
          </select>
        </Field>
        <Field label="Casilla" required>
          <Input value={form.casilla} onChange={e=>setForm({...form,casilla:limpiar(e.target.value)})}/>
        </Field>
        <Field label="Courier" required>
          <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={form.courier} onChange={e=>setForm({...form,courier:e.target.value})}>
            <option value="">Seleccionar…</option>
            {courierOptions.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          {codigoCargaSel.startsWith("AIR-PYBOX") && (
            <div className="text-xs text-francia-600 mt-1">Esta carga solo admite courier ParaguayBox.</div>
          )}
        </Field>
        <Field label="Estado" required>
          <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}>
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
        <Field label="CI/Pasaporte/RUC"><Input value={form.ci_ruc} onChange={e=>setForm({...form,ci_ruc:e.target.value})}/></Field>
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
        <div className="md:col-span-3">
            <Field label="Fotos del paquete">
                <div className="flex gap-2 items-center">
                    <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden"/>
                    <button type="button" onClick={()=>fileRef.current?.click()} className={BTN} disabled={isUploading}>Seleccionar archivo</button>
                    <button type="button" onClick={()=>setCamOpen(true)} className={BTN} disabled={isUploading}>Tomar foto</button>
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
      </div>
      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <InfoBox title="Peso facturable (mín 0,200 kg)" value={`${fmtPeso(fact)} kg`}/>
        <InfoBox title="Peso volumétrico (A×H×L / 5000)" value={`${fmtPeso(vol)} kg`}/>
        <InfoBox title="Exceso de volumen" value={`${fmtPeso(exc)} kg`}/>
      </div>
      <div className="flex justify-end mt-6">
        <button onClick={submit} className={BTN_PRIMARY} disabled={isUploading}>
          {isUploading ? "Subiendo foto..." : "Guardar paquete"}
        </button>
      </div>
      <Modal open={camOpen} onClose={()=>setCamOpen(false)} title="Tomar foto">
        <div className="space-y-3">
          <video ref={videoRef} playsInline className="w-full rounded-xl bg-black/50" />
          <div className="flex justify-end"> <button onClick={tomarFoto} className={BTN_PRIMARY}>Capturar</button></div>
        </div>
      </Modal>
    </Section>
  );
}

const InfoBox=({title,value})=>(
  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
    <div className="text-sm text-slate-600">{title}</div>
    <div className="text-2xl font-semibold text-slate-800">{value}</div>
  </div>
);
/* ========== Paquetes sin casilla ========== */
function PaquetesSinCasilla({ currentUser, items, onAdd, onUpdate, onRemove, onAsignarCasilla, setItems }){
const isAdmin = currentUser?.role === "ADMIN";
  const [q,setQ] = useState("");
  const [from,setFrom] = useState("");
  const [to,setTo] = useState("");
  const [fecha,setFecha]    = useState(new Date().toISOString().slice(0,10));
  const [nombre,setNombre] = useState("");
  const [tracking,setTracking] = useState("");
  const [editId,setEditId] = useState(null);
  const [editRow,setEditRow] = useState({ fecha:"", nombre:"", tracking:"" });
  const [isAdding, setIsAdding] = useState(false); // <-- NUEVO: Estado para deshabilitar el botón

  const add = async () => {
    if(!isAdmin || isAdding) return; // Evita doble clic
    if(!fecha || !nombre.trim()){ alert("Completá Fecha y Nombre."); return; }

    setIsAdding(true); // Deshabilita el botón

    let finalNumero = 0;
    try {
      const counterRef = doc(db, "counters", "sinCasillaSequence");
      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists()) {
          transaction.set(counterRef, { currentCount: 1 });
          finalNumero = 1;
        } else {
          let newCount = (counterDoc.data().currentCount || 0) + 1;
          if (newCount > 999) newCount = 1;
          transaction.update(counterRef, { currentCount: newCount });
          finalNumero = newCount;
        }
      });

      const row = { fecha, numero: finalNumero, nombre: nombre.trim(), tracking: tracking.trim() };
      await onAdd(row); // Guarda en la base de datos

      // YA NO actualizamos el estado manualmente. Dejamos que el listener de Firestore lo haga.

      setNombre("");
      setTracking("");
    } catch (e) {
      console.error("Error al crear paquete sin casilla: ", e);
      alert(`No se pudo generar el paquete. Error: ${e.message}`);
    } finally {
      setIsAdding(false); // Vuelve a habilitar el botón, incluso si hay un error
    }
  };

  const handleAsignarCasilla = (paquete) => {
    if(!isAdmin) return;
    const casilla = window.prompt(`Asignar casilla para el paquete Nº ${paquete.numero} (${paquete.nombre}):`);
    if (casilla && casilla.trim()) {
      onAsignarCasilla(paquete, casilla);
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
    onUpdate({ id: editId, ...editRow });
    setEditId(null);
  }
  function cancelEdit(){ setEditId(null); }
  function removeRow(r){
    if(!isAdmin) return;
    const ok = window.confirm(`¿Eliminar el paquete Nº ${r.numero}?`);
    if(!ok) return;
    onRemove(r.id);
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
      right={ isAdmin ? <button onClick={exportXLSX} className={BTN}>Exportar XLSX</button> : null }
    >
      {isAdmin && (
        <div className="grid md:grid-cols-6 gap-4 mb-4 p-4 bg-slate-50 rounded-lg">
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
            <button onClick={add} disabled={isAdding} className={BTN_PRIMARY + (isAdding ? " opacity-50 cursor-not-allowed" : "")}>{Iconos.add}</button>
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
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <Field label="Filtrar desde">
            <Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/>
          </Field>
          <Field label="Hasta">
            <Input type="date" value={to} onChange={e=>setTo(e.target.value)}/>
          </Field>
        </div>
      )}
      <div className="mb-4">
        <Input placeholder={isAdmin ? "Buscar por Nº, Nombre o Tracking…" : "Buscar por Nº o Nombre…"} value={q} onChange={e=>setQ(e.target.value)} />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Fecha recepción</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Nº paquete</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Nombre y apellido</th>
              {isAdmin && <th className="text-left px-3 py-2 font-semibold text-slate-600">Tracking</th>}
              {isAdmin && <th className="text-left px-3 py-2 font-semibold text-slate-600">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.map(r=>(
              <tr key={r.id} className="hover:bg-slate-50">
                {editId===r.id ? (
                  <>
                    <td className="px-3 py-1"><Input type="date" value={editRow.fecha} onChange={e=>setEditRow({...editRow,fecha:e.target.value})}/></td>
                    <td className="px-3 py-1">{r.numero}</td>
                    <td className="px-3 py-1"><Input value={editRow.nombre} onChange={e=>setEditRow({...editRow,nombre:e.target.value})}/></td>
                    {isAdmin && <td className="px-3 py-1"><Input value={editRow.tracking} onChange={e=>setEditRow({...editRow,tracking:e.target.value})}/></td>}
                    {isAdmin && (
                      <td className="px-3 py-1">
                        <div className="flex gap-2">
                          <button className={BTN_ICON + " bg-green-100 text-green-700"} onClick={saveEdit}>{Iconos.save}</button>
                          <button className={BTN_ICON} onClick={cancelEdit}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
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
                          <button className="px-3 py-1 text-xs rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors" onClick={()=>handleAsignarCasilla(r)}>Asignar casilla</button>
                          <button className={BTN_ICON} onClick={()=>startEdit(r)}>{Iconos.edit}</button>
                          <button className={BTN_ICON_DANGER} onClick={()=>removeRow(r)}>{Iconos.delete}</button>
                        </div>
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}
            {filtered.length===0 && <tr><td colSpan={isAdmin?5:3}><EmptyState icon={Iconos.box} title="No hay paquetes sin casilla"/></td></tr>}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
/* ========== Pestaña de Pendientes ========== */
function Pendientes({ items, onAdd, onUpdate, onRemove }) {
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
    onUpdate(editItem);
    setEditItem(null);
  };
  
  const toggleStatus = (item) => {
    onUpdate({ ...item, status: item.status === 'Realizada' ? 'No realizada' : 'Realizada' });
  };

  const deleteTask = (id) => {
    const ok = window.confirm("¿Seguro que quieres eliminar esta tarea pendiente? Esta acción no se puede deshacer.");
    if (ok) onRemove(id);
  };

  const handleCreateTask = () => {
    if (!newTask.details.trim()) { alert("Por favor, ingresá los detalles de la tarea."); return; }
    const taskToAdd = {
      type: newTask.type, status: "No realizada", fecha: newTask.fecha,
      data: { details: newTask.details }
    };
    onAdd(taskToAdd);
    setModalOpen(false);
    setNewTask({ type: 'MANUAL', fecha: new Date().toISOString().slice(0,10), details: '' });
  };

  const renderTaskDetails = (item) => {
    const { type, data } = item;
    switch (type) {
      case 'ASIGNAR_CASILLA': return <span>Mover paquete <b>Nº {data.numero}</b> ({data.nombre}) a la casilla <b>{data.casilla}</b>.</span>;
      case 'CAMBIO_CARGA': return <span>Cambiar paquete <b>{data.codigo}</b> de la carga <s>{data.oldFlight}</s> a la carga <b>{data.newFlight}</b>.</span>;
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
          <select className="text-sm rounded-lg border-slate-300 px-3 py-2" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="No realizada">No realizada</option>
            <option value="Realizada">Realizada</option>
            <option value="Todas">Todas</option>
          </select>
        </Field>
        <Input placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} />
        <button onClick={() => setModalOpen(true)} className={BTN_PRIMARY}>Agregar Tarea</button>
      </div>
    }>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Fecha</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Tipo</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Detalles</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredItems.map(item => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">{item.fecha}</td>
                <td className="px-3 py-2">{ item.type === 'ASIGNAR_CASILLA' ? 'Asignar Casilla' : item.type === 'CAMBIO_CARGA' ? 'Cambio Carga' : 'Manual' }</td>
                <td className="px-3 py-2">{renderTaskDetails(item)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 flex-wrap">
                    <button className={`px-3 py-1 text-xs rounded-lg text-white font-semibold transition-colors ${item.status === 'No realizada' ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-500 hover:bg-yellow-600'}`} onClick={() => toggleStatus(item)}>
                      {item.status === 'No realizada' ? 'Realizada' : 'Pendiente'}
                    </button>
                    <button className={BTN_ICON} onClick={() => startEdit(item)}>{Iconos.edit}</button>
                    <button className={BTN_ICON_DANGER} onClick={() => deleteTask(item.id)}>{Iconos.delete}</button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr><td colSpan="4"><EmptyState icon={Iconos.box} title="No hay tareas pendientes" message="El filtro no arrojó resultados o todo está al día."/></td></tr>
            )}
          </tbody>
        </table>
      </div>
      
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Crear Nueva Tarea Manual">
        <div className="space-y-4">
          <Field label="Fecha" required><Input type="date" value={newTask.fecha} onChange={e => setNewTask({...newTask, fecha: e.target.value})} /></Field>
          <Field label="Detalles de la Tarea" required>
            <textarea className="w-full text-sm rounded-lg border-slate-300 p-3" rows="4" value={newTask.details} onChange={e => setNewTask({...newTask, details: e.target.value})} placeholder="Ej: Revisar paquete GLOBALBOX123 por posible daño."/>
          </Field>
          <div className="flex justify-end gap-2"><button className={BTN} onClick={() => setModalOpen(false)}>Cancelar</button><button className={BTN_PRIMARY} onClick={handleCreateTask}>Guardar Tarea</button></div>
        </div>
      </Modal>

      <Modal open={!!editItem} onClose={cancelEdit} title="Editar Tarea">
        {editItem && (
          <div className="space-y-4">
            <Field label="Fecha" required><Input type="date" value={editItem.fecha} onChange={e => setEditItem({...editItem, fecha: e.target.value})} /></Field>
            <Field label="Detalles de la Tarea" required>
              <textarea className="w-full text-sm rounded-lg border-slate-300 p-3" rows="4"
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

/* ========== Paquetes en bodega ========== */
function PaquetesBodega({packages, flights, user, onUpdate, onDelete, onPendiente}){
  const [q,setQ]=useState("");
  const [flightId,setFlightId]=useState("");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [sort, setSort] = useState({ key: null, dir: "asc" });

  const toggleSort = (key) => {
    setSort(s => s.key===key ? {key, dir: (s.dir==="asc"?"desc":"asc")} : {key, dir:"asc"});
  };
  const Arrow = ({col})=>{
    if(sort.key!==col) return <span className="ml-1 text-slate-400">↕</span>;
    return <span className="ml-1">{sort.dir==="asc"?"▲":"▼"}</span>;
  };

  const pref = user.role==="COURIER" ? courierPrefix(user.courier) : null;

  const baseRows = useMemo(() => {
    const paquetesEnCajaIds = new Set(flights.flatMap(f => f.cajas || []).flatMap(c => c.paquetes || []));
    
    return packages
      .filter(p => {
        const flight = flights.find(f => f.id === p.flight_id);
        if (!flight) return false;
        return flight.estado === "En bodega" || !paquetesEnCajaIds.has(p.id);
      })
      .filter(p => !flightId || p.flight_id === flightId)
      .filter(p => !dateFrom || (p.fecha || "") >= dateFrom)
      .filter(p => !dateTo || (p.fecha || "") <= dateTo)
      .filter(p => (p.codigo + p.casilla + p.tracking + p.nombre_apellido + p.courier + p.ci_ruc).toLowerCase().includes(q.toLowerCase()))
      .filter(p => user.role !== "COURIER" || (p.courier === user.courier && String(p.codigo || "").toUpperCase().startsWith(pref)));
  }, [packages, flights, flightId, dateFrom, dateTo, q, user, pref]);


  const getSortVal = (p, key)=>{
    switch(key){
      case "carga": return (flights.find(f=>f.id===p.flight_id)?.codigo || "").toLowerCase();
      case "codigo": return (p.codigo||"").toLowerCase();
      case "casilla": return (p.casilla||"").toLowerCase();
      case "fecha": return p.fecha || "";
      case "nombre": return (p.nombre_apellido||"").toLowerCase();
      case "ci/ruc": return (p.ci_ruc||"").toLowerCase();
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
      cargaTxt: flights.find(f=>f.id===p.flight_id)?.codigo || "-",
      fecha: p.fecha
    });
    printHTMLInIframe(html);
  }

  const [open,setOpen]=useState(false);
  const [form,setForm]=useState(null);
  const start=(p)=>{
    setForm({
      ...p,
      fotos: p.fotos || [],
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
            type: "CAMBIO_CARGA",
            status: "No realizada",
            fecha: new Date().toISOString().slice(0, 10),
            data: {
                codigo: form.codigo,
                oldFlight: oldFlight?.codigo || 'N/A',
                newFlight: newFlight?.codigo || 'N/A',
            }
        };
        onPendiente(tarea);
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
            <div className="w-3 h-3 mr-2 rounded-sm" style={{ backgroundColor: entry.color }} />
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
          <select className="text-sm rounded-lg border-slate-300 px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
            <option value="">Todas las cargas</option>
            {flights.map(f=><option key={f.id} value={f.id}>{f.codigo}</option>)}
          </select>
          <Field label="Desde"> <Input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} /> </Field>
          <Field label="Hasta"> <Input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} /> </Field>
          <Input placeholder="Buscar…" value={q} onChange={e=>setQ(e.target.value)}/>
          <button onClick={exportXLSX} className={BTN}>Exportar XLSX</button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              {["Carga", "Código", "Casilla", "Fecha", "Nombre", "CI/RUC", "Tracking", "Peso real", "Medidas", "Exceso", "Descripción"].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-semibold text-slate-600 cursor-pointer select-none" onClick={()=>toggleSort(h.toLowerCase().replace(" ", "_"))}>{h}<Arrow col={h.toLowerCase().replace(" ", "_")}/></th>
              ))}
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Fotos</th>
              {user.role === 'ADMIN' && <th className="text-left px-3 py-2 font-semibold text-slate-600">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map(p=>{
              const carga = flights.find(f=>f.id===p.flight_id)?.codigo || "";
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap">{carga}</td>
                  <td className="px-3 py-2 font-mono whitespace-nowrap">{p.codigo}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.casilla}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.fecha}</td>
                  <td className="px-3 py-2">{p.nombre_apellido}</td>
                  <td className="px-3 py-2">{p.ci_ruc || "—"}</td>
                  <td className="px-3 py-2 font-mono">{p.tracking}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(p.peso_real)} kg</td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.largo}x{p.ancho}x{p.alto} cm</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtPeso(p.exceso_volumen)} kg</td>
                  <td className="px-3 py-2">{p.descripcion}</td>
                  <td className="px-3 py-2">
                    {(p.fotos && p.fotos.length > 0) ? 
                        <img alt="foto" src={p.fotos[0]} className="w-12 h-12 object-cover rounded-md cursor-pointer" onClick={()=>setViewer(p.fotos)} /> 
                        : "—"}
                  </td>
                  {user.role === 'ADMIN' &&
                    <td className="px-3 py-2">
                        <div className="flex gap-2">
                        <button className={BTN_ICON} onClick={()=>start(p)}>{Iconos.edit}</button>
                        <button className={BTN_ICON_DANGER} onClick={()=>requestDelete(p)}>{Iconos.delete}</button>
                        </div>
                    </td>
                  }
                </tr>
              );
            })}
            {rows.length===0 && <tr><td colSpan={13}><EmptyState icon={Iconos.box} title="No hay paquetes en bodega" message="Utiliza el filtro para buscar en otras cargas o agrega paquetes en la pestaña de Recepción."/></td></tr>}
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

      <Modal open={open} onClose={()=>setOpen(false)} title="Editar paquete">
        {form && (
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Carga">
              <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={form.flight_id} onChange={e=>setForm({...form,flight_id:e.target.value})} disabled={user.role==="COURIER"}>
                {flights.map(f=><option key={f.id} value={f.id}>{f.codigo}</option>)}
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
            <Field label="CI/Pasaporte/RUC"><Input value={form.ci_ruc} onChange={e=>setForm({...form,ci_ruc:e.target.value})} /></Field>
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
            <div className="md:col-span-3 flex items-center justify-between mt-4">
              <button onClick={()=>printPkgLabel(form)} className={BTN}>Reimprimir etiqueta</button>
              <div className="flex gap-2">
                <button onClick={save} className={BTN_PRIMARY}>Guardar</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!viewer} onClose={()=>setViewer(null)} title="Fotos del Paquete">
        {viewer && (
            <div className="flex flex-wrap gap-4 justify-center">
                {viewer.map((url, index) => (
                    <img key={index} src={url} alt={`Foto ${index + 1}`} className="max-w-full max-h-[70vh] rounded-xl" />
                ))}
            </div>
        )}
      </Modal>
    </Section>
  );
}

/* ========== Armado de cajas ========== */
function ArmadoCajas({packages, flights, onUpdateFlight, onAssign}){
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
            if (!activeBoxId || !currentFlight.cajas.some(c => c.id === activeBoxId)) {
                setActiveBoxId(currentFlight.cajas[0].id);
            }
        } else {
            setActiveBoxId(null);
        }
        setEditingBoxId(null);
        setEditingBoxData(null);
    }
  },[flightId, flights]);

  const startEditing = (box) => {
    setEditingBoxId(box.id);
    setEditingBoxData({ ...box });
  };

  const cancelEditing = () => {
    setEditingBoxId(null);
    setEditingBoxData(null);
  };
  
  const saveBoxChanges = () => {
    if(!editingBoxData || !flight) return;
    const updatedCajas = flight.cajas.map(c => c.id !== editingBoxId ? c : editingBoxData);
    onUpdateFlight({ ...flight, cajas: updatedCajas });
    cancelEditing();
  };
  
  function addBox(){
    if(!flightId || !flight) return;
    const inTxt = window.prompt("Ingresá el peso de la caja de cartón (kg), ej: 0,250", "0,250");
    if(inTxt===null) return;
    const peso_carton = fmtPeso(parseComma(inTxt));
    const n = (flight?.cajas?.length||0)+1;
    const newBox = {id:uuid(),codigo:`Caja ${n}`,paquetes:[],peso:"",L:"",A:"",H:"", peso_carton};
    const updatedCajas = [...(flight.cajas || []), newBox];
    onUpdateFlight({ ...flight, cajas: updatedCajas });
    setActiveBoxId(newBox.id);
  }

  function assign(){
    if(!scan||!flight) return;
    const pkg = packages.find(p=> p.flight_id===flightId && String(p.codigo||"").toUpperCase()===scan.toUpperCase());
    if(!pkg){ alert("No existe ese código en esta carga."); setScan(""); return; }
    if(flight.cajas.some(c=>c.paquetes.includes(pkg.id))){ alert("Ya está en una caja."); setScan(""); return; }
    const currentActiveId = activeBoxId || flight.cajas[0]?.id;
    if(!currentActiveId){ alert("Creá una caja primero."); return; }
    
    const updatedCajas = flight.cajas.map(c => 
      c.id !== currentActiveId ? c : {...c, paquetes: [...c.paquetes, pkg.id]}
    );
    onUpdateFlight({...flight, cajas: updatedCajas});
    onAssign(pkg.id); setScan("");
  }
  function move(pid,fromId,toId){
    if(!toId||!flight) return;
    const newCajas = flight.cajas.map(c => {
        if(c.id === fromId) return {...c, paquetes: c.paquetes.filter(p => p !== pid)};
        if(c.id === toId) return {...c, paquetes: [...c.paquetes, pid]};
        return c;
    });
    onUpdateFlight({...flight, cajas: newCajas});
  }
  function removeBox(id){
    if(!flight) return;
    const updatedCajas = flight.cajas.filter(c=>c.id!==id);
    onUpdateFlight({...flight, cajas: updatedCajas});
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
    onUpdateFlight({...flight,cajas:arr});
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

  async function exportCajasXLSX() {
    if (!flight) {
        alert("Seleccioná una carga.");
        return;
    }
    if (!flight.cajas || flight.cajas.length === 0) {
        alert("No hay cajas en esta carga para exportar.");
        return;
    }

    const wb = new ExcelJS.Workbook();

    const thinBorder = { style: "thin", color: { argb: "FF000000" } };
    const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

    (flight.cajas || []).forEach((caja, idx) => {
      const ws = wb.addWorksheet(`CAJA ${idx + 1}`);
      const pkgObjs = (caja.paquetes || []).map(pid => packages.find(p => p.id === pid)).filter(Boolean);
      const cantPaquetes = pkgObjs.length;

      const byCourier = {};
      pkgObjs.forEach(p => {
          if (!byCourier[p.courier]) byCourier[p.courier] = [];
          byCourier[p.courier].push(p.codigo);
      });

      const couriers = Object.keys(byCourier).sort();
      
      ws.getCell('B2').value = "CONTROL DE PAQUETES";
      ws.getCell('B2').font = { bold: true, color: { argb: "FFFFFFFF" }, sz: 12 };
      ws.getCell('B2').fill = { type: 'pattern', pattern:'solid', fgColor:{argb:'FF4F4F4F'} };
      ws.getCell('B2').alignment = { horizontal: "center", vertical: "center" };
      ws.mergeCells('B2:L2');
      
      ws.getCell('B3').value = `CAJA Nº ${idx + 1}`;
      ws.getCell('B3').font = { bold: true };
      ws.mergeCells('B3:F3');

      ws.getCell('G3').value = `CANTIDAD DE PAQUETES: ${cantPaquetes}`;
      ws.getCell('G3').font = { bold: true };
      ws.mergeCells('G3:L3');

      let col = 2;
      couriers.forEach(c => {
        const cell = ws.getCell(4, col);
        cell.value = c;
        cell.fill = { type: 'pattern', pattern:'solid', fgColor:{argb:'FFE6F2F7'} };
        cell.alignment = { vertical: "center", horizontal: "center" };
        let row = 5;
        byCourier[c].forEach(p => {
          const pkgCell = ws.getCell(row, col);
          pkgCell.value = p;
          pkgCell.fill = { type: 'pattern', pattern:'solid', fgColor:{argb:'FFFFEBE0'} };
          row++;
        });
        col++;
      });
      
      for(let r = 2; r < 33; r++) {
        for(let c = 2; c < 13; c++) {
          const cell = ws.getCell(r,c);
          if(!cell.border) {
            cell.border = allBorders;
          }
        }
      }
    });

    wb.xlsx.writeBuffer().then(buffer => {
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cajas_${flight.codigo}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
    });
  }

  function handlePrintBoxLabel(caja, index) {
    if (!flight) return;
    const couriers = new Set(caja.paquetes.map(pid=>packages.find(p=>p.id===pid)?.courier).filter(Boolean));
    const etiqueta = couriers.size === 0 ? flight.codigo : (couriers.size === 1 ? [...couriers][0] : "MULTICOURIER");

    const data = {
      courier: etiqueta,
      boxNumber: index + 1,
      pesoKg: parseComma(caja.peso || "0"),
      medidasTxt: `${caja.L || 0} x ${caja.A || 0} x ${caja.H || 0}`,
      fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
    };
    const html = boxLabelHTML(data);
    printHTMLInIframe(html);
  }

  return (
    <Section title="Armado de cajas">
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Seleccionar carga" required>
          <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={flightId} onChange={e=>{setFlightId(e.target.value);}}>
            <option value="">—</option>
            {flights.filter(f=>f.estado==="En bodega").map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
          </select>
        </Field>
        <Field label="Escanear / ingresar código">
          <Input value={scan} onChange={e=>setScan(limpiar(e.target.value))} onKeyDown={e=>e.key==="Enter"&&assign()} placeholder="BOSSBOX1"/>
        </Field>
        <div className="flex items-end gap-2">
          <button onClick={addBox} disabled={!flightId} className={BTN_PRIMARY}>Agregar caja</button>
          <button onClick={exportCajasXLSX} disabled={!flight} className={BTN}>Exportar XLSX</button>
        </div>
        <div className="md:col-span-3">
          {!flight && <EmptyState icon={Iconos.box} title="Selecciona una carga" message="Elige una carga para empezar a armar las cajas."/>}
          {flight && flight.cajas.map((c, idx)=>{
            const couriers = new Set(c.paquetes.map(pid=>packages.find(p=>p.id===pid)?.courier).filter(Boolean));
            const etiqueta = couriers.size===0? "—" : (couriers.size===1? [...couriers][0] : "MULTICOURIER");
            const isActive = activeBoxId===c.id;
            const isEditing = editingBoxId===c.id;
            const peso = parseComma(c.peso||"0");
            const L=parseIntEU(c.L||0), A=parseIntEU(c.A||0), H=parseIntEU(c.H||0);
            const est = pesoEstimado(c);

            return (
              <div key={c.id} className={`border rounded-xl p-4 mb-3 transition-shadow ${isActive?"ring-2 ring-francia-500 shadow-lg":"hover:shadow-md"}`} onClick={() => setActiveBoxId(c.id)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-slate-800">
                    {c.codigo} — {etiqueta} — <span>{fmtPeso(peso)} kg</span> — {L}x{A}x{H} cm
                    {isActive && <span className="ml-2 text-francia-600 text-xs font-bold">(ACTIVA)</span>}
                  </div>
                  <div className="flex gap-2">
                    <button className={BTN_ICON} onClick={(e)=>{e.stopPropagation(); handlePrintBoxLabel(c, idx);}} title="Imprimir etiqueta de caja">{Iconos.print}</button>
                    {!isEditing
                      ? <button className={BTN_ICON} onClick={(e)=>{e.stopPropagation(); startEditing(c);}}>{Iconos.edit}</button>
                      : <button className={BTN_ICON + " bg-green-100 text-green-700"} onClick={(e)=>{e.stopPropagation(); saveBoxChanges();}}>{Iconos.save}</button>
                    }
                    <button className={BTN_ICON} onClick={(e)=>{e.stopPropagation(); reorderBox(c.id,"up")}}>↑</button>
                    <button className={BTN_ICON} onClick={(e)=>{e.stopPropagation(); reorderBox(c.id,"down")}}>↓</button>
                    <button className={BTN_ICON_DANGER} onClick={(e)=>{e.stopPropagation(); removeBox(c.id)}}>{Iconos.delete}</button>
                  </div>
                </div>
                <div className="text-xs text-slate-600 mb-3">
                  <b>Peso estimado:</b> {fmtPeso(est)} kg (cartón {fmtPeso(parseComma(c.peso_carton||"0"))} kg + paquetes)
                </div>
                {isEditing && editingBoxData && (
                  <div className="grid md:grid-cols-5 gap-4 mb-3 p-3 bg-slate-50 rounded-lg" onClick={e=>e.stopPropagation()}>
                    <Field label="Nombre"><Input value={editingBoxData.codigo} onChange={e=>setEditingBoxData({...editingBoxData, codigo: e.target.value})}/></Field>
                    <Field label="Peso (kg)"><Input value={editingBoxData.peso||""} onChange={e=>setEditingBoxData({...editingBoxData, peso: e.target.value})} placeholder="3,128"/></Field>
                    <Field label="Largo (cm)"><Input value={editingBoxData.L||""} onChange={e=>setEditingBoxData({...editingBoxData, L: e.target.value})}/></Field>
                    <Field label="Ancho (cm)"><Input value={editingBoxData.A||""} onChange={e=>setEditingBoxData({...editingBoxData, A: e.target.value})}/></Field>
                    <Field label="Alto (cm)"><Input value={editingBoxData.H||""} onChange={e=>setEditingBoxData({...editingBoxData, H: e.target.value})}/></Field>
                  </div>
                )}
                <ul className="text-sm space-y-2">
                  {c.paquetes.map(pid=>{
                    const p=packages.find(x=>x.id===pid); if(!p) return null;
                    return (
                      <li key={pid} className="flex items-center gap-3 p-2 bg-slate-50 rounded-md">
                        <span className="font-mono text-slate-800">{p.codigo}</span><span className="text-slate-500">{p.courier}</span>
                        <div className="flex-grow" />
                        {flight.cajas.length>1 && (
                          <select className="text-xs border-slate-300 rounded px-1 py-0.5" defaultValue="" onChange={e=>{e.stopPropagation(); move(pid,c.id,e.target.value)}}>
                            <option value="" disabled>Mover a…</option>
                            {flight.cajas.filter(x=>x.id!==c.id).map(x=><option key={x.id} value={x.id}>{x.codigo}</option>)}
                          </select>
                        )}
                        <button className={BTN_ICON_DANGER} onClick={(e)=>{e.stopPropagation(); 
                          const updatedPaquetes = c.paquetes.filter(z => z !== pid);
                          const updatedCaja = {...c, paquetes: updatedPaquetes};
                          const updatedCajas = flight.cajas.map(cj => cj.id === c.id ? updatedCaja : cj);
                          onUpdateFlight({ ...flight, cajas: updatedCajas });
                        }}>{Iconos.delete}</button>
                      </li>
                    );
                  })}
                  {c.paquetes.length===0 && <li className="text-slate-500 text-center py-2 text-xs">Arrastra paquetes aquí o escanea su código</li>}
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
function CargasEnviadas({packages, flights, user}){
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [estado,setEstado]=useState("");
  const [flightId,setFlightId]=useState("");
  const isAdmin = user.role === 'ADMIN';
  const isCourier = user.role === 'COURIER';

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

  const courierTotals = useMemo(() => {
    if (!flight || !isCourier) return { facturable: 0, exceso: 0 };
    const courierPackages = packages.filter(p => p.flight_id === flightId && p.courier === user.courier);
    return {
      facturable: sum(courierPackages.map(p => p.peso_facturable)),
      exceso: sum(courierPackages.map(p => p.exceso_volumen))
    };
  }, [flight, packages, isCourier, user.courier, flightId]);


  const resumenCajas = useMemo(()=>{
    if(!flight) return [];
    return (flight.cajas || []).map((c,i)=>{
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

    if (isAdmin) {
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
    } else {
        downloadXLSX(`Carga_${flight.codigo}.xlsx`, [sheetPacking]);
    }
  }

  return (
    <Section title="Cargas enviadas">
      <div className="grid md:grid-cols-6 gap-4 items-end">
        <Field label="Desde"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field>
        <Field label="Hasta"><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field>
        <Field label="Estado">
          <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={estado} onChange={e=>setEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS_CARGA.filter(s => s !== 'En bodega').map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Carga">
          <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {list.map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida} · {f.estado}</option>)}
          </select>
        </Field>
        <div className="md:col-span-2 flex items-end justify-end">
          <button onClick={exportFlightXLSX} disabled={!flight} className={BTN}>
            Exportar XLSX
          </button>
        </div>
      </div>

      {!flight ? <EmptyState icon={Iconos.box} title="Selecciona una carga" message="Elige una carga para ver sus paquetes y cajas." /> : (
        <>
          <div className="flex justify-between items-center mt-6 mb-2">
            <h3 className="text-lg font-semibold text-slate-800">Paquetes del vuelo: {flight.codigo}</h3>
            {isCourier && (
              <div className="flex gap-4 text-sm">
                <div><b>Kg Facturables:</b> <span className="font-mono">{fmtPeso(courierTotals.facturable)} kg</span></div>
                <div><b>Exceso Volumétrico:</b> <span className="font-mono">{fmtPeso(courierTotals.exceso)} kg</span></div>
              </div>
            )}
          </div>
          <div className="overflow-x-auto mb-6">
            <table className="min-w-full text-sm">
              <thead><tr className="bg-slate-50">{["Courier","Código","Casilla","Fecha","Nombre","Tracking","Peso real","Medidas","Exceso","Descripción"].map(h=><th key={h} className="text-left px-3 py-2 font-semibold text-slate-600">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-200">
                {paquetesDeVuelo.map(p=>(
                  <tr key={p.id} className="hover:bg-slate-50">
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
                {paquetesDeVuelo.length===0 && <tr><td colSpan={10}><EmptyState icon={Iconos.box} title="Sin paquetes" message="No hay paquetes para mostrar para tu usuario en esta carga." /></td></tr>}
              </tbody>
            </table>
          </div>
          {isAdmin && 
            <>
                <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Resumen de Cajas</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                    <thead><tr className="bg-slate-50">{["Nº Caja","Courier","Peso","Largo","Ancho","Alto","Volumétrico"].map(h=><th key={h} className="text-left px-3 py-2 font-semibold text-slate-600">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-200">
                        {resumenCajas.map(r=>(
                        <tr key={r.n} className="hover:bg-slate-50">
                            <td className="px-3 py-2">{r.codigo}</td>
                            <td className="px-3 py-2">{r.courier}</td>
                            <td className="px-3 py-2">{fmtPeso(r.peso)}</td>
                            <td className="px-3 py-2">{r.L}</td>
                            <td className="px-3 py-2">{r.A}</td>
                            <td className="px-3 py-2">{r.H}</td>
                            <td className="px-3 py-2">{fmtPeso(r.vol)}</td>
                        </tr>
                        ))}
                        <tr className="bg-slate-100 font-bold"><td className="px-3 py-2"></td><td className="px-3 py-2">Totales</td><td className="px-3 py-2">{fmtPeso(totPeso)}</td><td></td><td></td><td></td><td className="px-3 py-2">{fmtPeso(totVol)}</td></tr>
                    </tbody>
                    </table>
                </div>
            </>
          }
        </>
      )}
    </Section>
  );
}
/* ========== Gestión de cargas ========== */
function CargasAdmin({flights, onAdd, onUpdate, onDelete, packages}){
  const [code,setCode]=useState("");
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [awb,setAwb]=useState("");
  const [fac,setFac]=useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const today = new Date();
  const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30)).toISOString().slice(0, 10);
  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to,setTo]=useState("");

  function create(){
    if(!code) return;
    onAdd({codigo:code,fecha_salida:date,estado:"En bodega",awb,factura_cacesa:fac,cajas:[], docs: []});
    setCode(""); setAwb(""); setFac("");
  }
  
  function getMissingScanPackages(flight, allPackages) {
    const idsDeCarga = allPackages.filter(p => p.flight_id === flight.id).map(p => p.id);
    const asignados = new Set((flight.cajas || []).flatMap(c => c.paquetes || []));
    const missingIds = idsDeCarga.filter(id => !asignados.has(id));
    return missingIds.map(id => allPackages.find(p => p.id === id)?.codigo || 'ID desconocido');
  }

  function upd(f,field,value){
    if(field==="estado" && value!=="En bodega" && f.estado === 'En bodega'){
        const missingPackages = getMissingScanPackages(f, packages);
        if(missingPackages.length > 0){
          const packageList = missingPackages.join(', ');
          const message = `Atención: Faltan escanear ${missingPackages.length} paquete(s) en "Armado de cajas" para la carga ${f.codigo}.\n\nPaquetes faltantes: ${packageList}\n\n¿Deseás continuar igualmente?`;
          const ok = window.confirm(message);
          if(!ok) return;
        }
    }
    onUpdate({...f, [field]:value});
  }
  function del(id, codigo){
    const tienePaquetes = packages.some(p=>p.flight_id===id);
    if(tienePaquetes){
      alert(`No se puede eliminar la carga ${codigo||""} porque tiene paquetes asociados.`);
      return;
    }
    const ok = window.confirm(`¿Eliminar la carga ${codigo||id}?`);
    if(!ok) return;
    onDelete(id);
  }
  
  const handleFileUpload = (e, flight) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const newDoc = {
        id: uuid(),
        name: file.name,
        data: event.target.result,
      };
      onUpdate({ ...flight, docs: [...(flight.docs || []), newDoc] });
    };
    reader.readAsDataURL(file);
  };

  const deleteDocument = (flight, docId) => {
    onUpdate({ ...flight, docs: flight.docs.filter(d => d.id !== docId) });
  };


  const list = flights
    .filter(f=>!from || f.fecha_salida>=from)
    .filter(f=>!to || f.fecha_salida<=to)
    .filter(f=> statusFilter === 'Todos' || f.estado === statusFilter);

  return (
    <Section title="Gestión de cargas"
      right={
        <div className="flex gap-2 items-end">
          <Field label="Desde"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field>
          <Field label="Hasta"><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field>
           <Field label="Estado">
            <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="Todos">Todos</option>
              {ESTADOS_CARGA.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      }>
      <div className="bg-slate-50 rounded-xl p-4 mb-6 grid md:grid-cols-5 gap-4 items-end">
        <Field label="Código de carga" required><Input placeholder="AIR-..." value={code} onChange={e=>setCode(e.target.value)}/></Field>
        <Field label="Fecha de salida" required><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field>
        <Field label="AWB (opcional)"><Input value={awb} onChange={e=>setAwb(e.target.value)}/></Field>
        <Field label="Factura Cacesa (opcional)"><Input value={fac} onChange={e=>setFac(e.target.value)}/></Field>
        <button onClick={create} className={BTN_PRIMARY}>Crear Carga</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {list.length > 0 ? list.map(f => (
            <div key={f.id} className="bg-white rounded-xl shadow-md border border-slate-200 flex flex-col">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <Input className="text-lg font-bold !border-0 !p-0 !ring-0" value={f.codigo} onChange={e => upd(f, "codigo", e.target.value)} />
                <div className="flex gap-2">
                    <button className={BTN_ICON} onClick={() => document.getElementById(`file-input-${f.id}`).click()}>{Iconos.upload}</button>
                    <input type="file" id={`file-input-${f.id}`} className="hidden" onChange={(e) => handleFileUpload(e, f)} />
                    <button className={BTN_ICON_DANGER} onClick={()=>del(f.id, f.codigo)}>{Iconos.delete}</button>
                </div>
              </div>
              <div className="p-4 space-y-3 flex-grow">
                 <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-500">Estado</span>
                  <select className="text-sm rounded-lg border-slate-300 px-2 py-1" value={f.estado} onChange={e => upd(f, "estado", e.target.value)}>
                    {ESTADOS_CARGA.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                 <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-500">Fecha Salida</span>
                  <Input type="date" value={f.fecha_salida} onChange={e => upd(f, "fecha_salida", e.target.value)} />
                </div>
                 <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-500">AWB</span>
                  <Input value={f.awb || ""} onChange={e => upd(f, "awb", e.target.value)} />
                </div>
                 <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-500">Factura</span>
                  <Input value={f.factura_cacesa || ""} onChange={e => upd(f, "factura_cacesa", e.target.value)} />
                </div>
                 <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-500">Cajas</span>
                  <span className="text-sm font-bold text-slate-800">{f.cajas?.length || 0}</span>
                </div>
              </div>
               {(f.docs && f.docs.length > 0) && (
                <div className="p-4 border-t border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-600 mb-2">Documentos Adjuntos</h4>
                    <ul className="space-y-2">
                        {f.docs.map(doc => (
                            <li key={doc.id} className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded-md">
                                <a href={doc.data} download={doc.name} className="text-francia-600 hover:underline flex items-center gap-2">
                                    {Iconos.file} {doc.name}
                                </a>
                                <button onClick={() => deleteDocument(f, doc.id)} className={BTN_ICON_DANGER}>{Iconos.delete}</button>
                            </li>
                        ))}
                    </ul>
                </div>
               )}
            </div>
          )) : (
          <div className="lg:col-span-3">
             <EmptyState icon={Iconos.box} title="No hay cargas" message="Crea una nueva carga para empezar a asociar paquetes." />
          </div>
        )}
      </div>
    </Section>
  );
}


/* ========== Proformas ========== */
const T = { proc:5, fleteReal:9, fleteExc:9, despacho:10, fleteMaritimo: 12 };
const canjeGuiaUSD = (kg)=> kg<=5?10 : kg<=10?13.5 : kg<=30?17 : kg<=50?37 : kg<=100?57 : 100;

function Proformas({packages, flights, extras, user}){
  const getInitialFromDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  };

  const [from,setFrom] = useState(getInitialFromDate());
  const [to,setTo] = useState("");
  const [flightId,setFlightId] = useState("");
  const isCourier = user.role === 'COURIER';

  const list = flights
    .filter(f => {
      const code = (f.codigo || "").toUpperCase();
      return code.startsWith("AIR") || code.startsWith("MAR");
    })
    .sort((a, b) => new Date(b.fecha_salida) - new Date(a.fecha_salida));

  const flight = flights.find(f=>f.id===flightId);

  const porCourier = useMemo(()=>{
    if(!flight) return [];
    const m=new Map();
    (flight.cajas || []).forEach(c=>c.paquetes.forEach(pid=>{
      const p=packages.find(x=>x.id===pid); if(!p) return;
      if (isCourier && p.courier !== user.courier) return;
      if(!m.has(p.courier)) m.set(p.courier,{courier:p.courier,kg_real:0,kg_fact:0,kg_exc:0});
      const a=m.get(p.courier); a.kg_real+=p.peso_real; a.kg_fact+=p.peso_facturable; a.kg_exc+=p.exceso_volumen;
    }));
    return Array.from(m.values());
  },[flight,packages, isCourier, user.courier]);

  const extrasDeCourier = (courier)=> extras.filter(e=>e.flight_id===flightId && e.courier===courier);

  async function exportX(r){
    if(!flight) return;

    let detalle = [];
    let total = 0;
    const isMaritimo = flight.codigo.toUpperCase().startsWith("MAR");
    const extrasList = extrasDeCourier(r.courier);
    const extrasMonto = extrasList.reduce((s,e)=>s+parseComma(e.monto),0);

    if(isMaritimo) {
        const fleteTotal = r.kg_fact * T.fleteMaritimo;
        total = fleteTotal + extrasMonto;
        detalle = [
            ["Envío marítimo España-Paraguay", Number(r.kg_fact.toFixed(3)), Number(T.fleteMaritimo.toFixed(2)), Number(fleteTotal.toFixed(2))],
            ...extrasList.map(e=>[e.descripcion, 1, Number(parseComma(e.monto).toFixed(2)), Number(parseComma(e.monto).toFixed(2))])
        ];
    } else {
        const proc = r.kg_fact*T.proc, fr=r.kg_real*T.fleteReal, fe=r.kg_exc*T.fleteExc, desp=r.kg_fact*T.despacho;
        const canje=canjeGuiaUSD(r.kg_fact);
        const com = 0.04*(proc+fr+fe+extrasMonto);
        total = proc+fr+fe+desp+canje+extrasMonto+com;

        detalle = [
          ["Procesamiento", Number(r.kg_fact.toFixed(3)), Number(T.proc.toFixed(2)), Number(proc.toFixed(2))],
          ["Flete peso real", Number(r.kg_real.toFixed(3)), Number(T.fleteReal.toFixed(2)), Number(fr.toFixed(2))],
          ["Flete exceso de volumen", Number(r.kg_exc.toFixed(3)), Number(T.fleteExc.toFixed(2)), Number(fe.toFixed(2))],
          ["Servicio de despacho", Number(r.kg_fact.toFixed(3)), Number(T.despacho.toFixed(2)), Number(desp.toFixed(2))],
          ["Comisión por canje de guía", 1, Number(canje.toFixed(2)), Number(canje.toFixed(2))],
          ...extrasList.map(e=>[e.descripcion, 1, Number(parseComma(e.monto).toFixed(2)), Number(parseComma(e.monto).toFixed(2))]),
          ["Comisión por transferencia (4%)", 1, Number(com.toFixed(2)), Number(com.toFixed(2))],
        ];
    }
    
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Factura");

    // Estilos
    const boldStyle = { font: { bold: true } };
    const headerStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern:'solid', fgColor:{argb:'FF1F2937'} }, alignment: { horizontal: 'center' } };
    const totalStyle = { font: { bold: true }, alignment: { horizontal: 'right' } };

    // Cabecera de la empresa
    ws.getCell('A1').value = "Europa Envíos";
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.mergeCells('A1:D1');
    ws.getCell('A2').value = "LAMAQUINALOGISTICA, SOCIEDAD LIMITADA";
    ws.getCell('A3').value = "N.I.F.: B56340656";
    ws.getCell('A4').value = "CALLE ESTEBAN SALAZAR CHAPELA, NUM 20, PUERTA 87, NAVE 87";
    ws.getCell('A5').value = "29004 MÁLAGA (ESPAÑA)";
    ws.getCell('A6').value = "(34) 633 74 08 31";

    // Título y fecha
    ws.getCell('A8').value = "Factura Proforma";
    ws.getCell('A8').font = { bold: true, size: 16 };
    ws.mergeCells('A8:D8');
    ws.getCell('A9').value = new Date().toLocaleDateString('es-ES');
    ws.mergeCells('A9:D9');

    // Datos del cliente
    ws.getCell('A11').value = "Cliente";
    ws.getCell('A11').style = boldStyle;
    ws.getCell('B11').value = "Nº factura";
    ws.getCell('B11').style = boldStyle;
    ws.getCell('A12').value = r.courier;
    ws.getCell('B12').value = "-";

    // Cabecera de la tabla de detalles
    ws.getCell('A15').value = "Descripción";
    ws.getCell('A15').style = headerStyle;
    ws.getCell('B15').value = "Cantidad";
    ws.getCell('B15').style = headerStyle;
    ws.getCell('C15').value = "Precio unitario";
    ws.getCell('C15').style = headerStyle;
    ws.getCell('D15').value = "Precio total";
    ws.getCell('D15').style = headerStyle;

    // Filas con detalles
    let currentRow = 16;
    detalle.forEach(item => {
        ws.getCell(`A${currentRow}`).value = item[0];
        ws.getCell(`B${currentRow}`).value = item[1];
        ws.getCell(`B${currentRow}`).numFmt = '#,##0.000';
        ws.getCell(`C${currentRow}`).value = item[2];
        ws.getCell(`C${currentRow}`).numFmt = '#,##0.00';
        ws.getCell(`D${currentRow}`).value = item[3];
        ws.getCell(`D${currentRow}`).numFmt = '#,##0.00';
        currentRow++;
    });

    // Total
    const totalRow = currentRow + 2;
    ws.getCell(`C${totalRow}`).value = "Total";
    ws.getCell(`C${totalRow}`).style = totalStyle;
    ws.getCell(`D${totalRow}`).value = Number(total.toFixed(2));
    ws.getCell(`D${totalRow}`).style = { font: { bold: true } };
    ws.getCell(`D${totalRow}`).numFmt = '#,##0.00';

    // Ancho de columnas
    ws.columns = [
        { width: 30 }, { width: 15 }, { width: 15 }, { width: 15 }
    ];

    // Descargar el archivo
    wb.xlsx.writeBuffer().then(buffer => {
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Proforma_${r.courier}_${flight.codigo}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
    });
  }

  return (
    <Section title="Proformas por courier"
      right={
        <div className="flex gap-2 items-end">
          <Field label="Desde"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field>
          <Field label="Hasta"><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field>
          <select className="text-sm rounded-lg border-slate-300 px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
            <option value="">Seleccionar carga…</option>
            {list
              .filter(f => !from || f.fecha_salida >= from)
              .filter(f => !to || f.fecha_salida <= to)
              .map(f=><option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>)}
          </select>
        </div>
      }
    >
      {!flight ? <EmptyState icon={Iconos.box} title="Selecciona una carga" message="Elige una carga para ver las proformas por courier." /> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="bg-slate-50">{["Courier","Kg facturable","Kg exceso","TOTAL USD","XLSX"].map(h=><th key={h} className="text-left px-3 py-2 font-semibold text-slate-600">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-200">
              {porCourier.map(r=>{
                let tot;
                const extrasMonto = extrasDeCourier(r.courier).reduce((s,e)=>s+parseComma(e.monto),0);
                if (flight.codigo.toUpperCase().startsWith("MAR")) {
                    tot = (r.kg_fact * T.fleteMaritimo) + extrasMonto;
                } else {
                    const proc=r.kg_fact*T.proc, fr=r.kg_real*T.fleteReal, fe=r.kg_exc*T.fleteExc, desp=r.kg_fact*T.despacho;
                    const canje=canjeGuiaUSD(r.kg_fact);
                    const com=0.04*(proc+fr+fe+extrasMonto);
                    tot = proc+fr+fe+desp+canje+extrasMonto+com;
                }
                return (
                  <tr key={r.courier} className="hover:bg-slate-50">
                    <td className="px-3 py-2">{r.courier}</td>
                    <td className="px-3 py-2">{fmtPeso(r.kg_fact)} kg</td>
                    <td className="px-3 py-2">{fmtPeso(r.kg_exc)} kg</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{fmtMoney(tot)}</td>
                    <td className="px-3 py-2"><button className={BTN} onClick={()=>exportX(r)}>Descargar</button></td>
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
function Extras({flights, couriers, extras, onAdd, onUpdate, onDelete}){
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
    onAdd({ flight_id:flightId, courier, descripcion:desc, monto, estado, fecha });
    setDesc(""); setMonto("");
  };
  const filtered = extras
    .filter(e=>!from || (e.fecha || (flights.find(f=>f.id===e.flight_id)?.fecha_salida)||"")>=from)
    .filter(e=>!to || (e.fecha || (flights.find(f=>f.id===e.flight_id)?.fecha_salida)||"")<=to)
    .filter(e=>!flightId || e.flight_id===flightId)
    .filter(e => statusFilter === 'Todos' || e.estado === statusFilter);

  const upd=(id,patch)=> onUpdate({id, ...patch});
  const del=(id)=> onDelete(id);

  return (
    <Section title="Trabajos extras">
      <div className="grid md:grid-cols-6 gap-4 mb-4 p-4 bg-slate-50 rounded-lg items-end">
        <Field label="Carga"><select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}><option value="">—</option>{flights.map(f=><option key={f.id} value={f.id}>{f.codigo}</option>)}</select></Field>
        <Field label="Courier"><select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={courier} onChange={e=>setCourier(e.target.value)}><option value="">—</option>{couriers.map(c=><option key={c.name}>{c.name}</option>)}</select></Field>
        <Field label="Descripción"><Input value={desc} onChange={e=>setDesc(e.target.value)}/></Field>
        <Field label="Monto (USD)"><Input value={monto} onChange={e=>setMonto(e.target.value)} placeholder="10,00"/></Field>
        <Field label="Estado"><select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={estado} onChange={e=>setEstado(e.target.value)}><option>Pendiente</option><option>Cobrado</option></select></Field>
        <Field label="Fecha"><Input type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></Field>
        <div className="md:col-span-6 flex justify-end"><button onClick={add} className={BTN_PRIMARY}>Agregar</button></div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <Field label="Filtrar desde"><Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></Field>
        <Field label="Filtrar hasta"><Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></Field>
        <Field label="Filtrar por estado">
            <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="Pendiente">Pendiente</option>
                <option value="Cobrado">Cobrado</option>
                <option value="Todos">Todos</option>
            </select>
        </Field>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="bg-slate-50">{["Fecha","Carga","Courier","Descripción","Monto (USD)","Estado","Acciones"].map(h=><th key={h} className="text-left px-3 py-2 font-semibold text-slate-600">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.map(e=>{
              const carga = flights.find(f=>f.id===e.flight_id)?.codigo || "";
              return (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-3 py-1">{e.fecha || flights.find(f=>f.id===e.flight_id)?.fecha_salida || ""}</td>
                  <td className="px-3 py-1">{carga}</td>
                  <td className="px-3 py-1">{e.courier}</td>
                  <td className="px-3 py-1"><Input value={e.descripcion} onChange={ev=>upd(e.id,{descripcion:ev.target.value})}/></td>
                  <td className="px-3 py-1"><Input value={e.monto} onChange={ev=>upd(e.id,{monto:ev.target.value})}/></td>
                  <td className="px-3 py-1">
                    <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={e.estado} onChange={ev=>upd(e.id,{estado:ev.target.value})}>
                      <option>Pendiente</option><option>Cobrado</option>
                    </select>
                  </td>
                  <td className="px-3 py-1"><button onClick={()=>del(e.id)} className={BTN_ICON_DANGER}>{Iconos.delete}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ========== Componente Principal de la Aplicación ========== */
function App(){
  const [currentUser, setCurrentUser] = useState(null);
  const [initialising, setInitialising] = useState(true);
  const [tab, setTab] = useState("Dashboard");

  // Estados para los datos de la aplicación
  const [couriers, setCouriers] = useState([]);
  const [estados, setEstados] = useState([]);
  const [flights, setFlights] = useState([]);
  const [packages, setPackages] = useState([]);
  const [extras, setExtras] = useState([]);
  const [sinCasillaItems, setSinCasillaItems] = useState([]);
  const [pendientes, setPendientes] = useState([]);

  // Listener de autenticación de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Usuario está logueado, obtenemos su rol desde Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setCurrentUser({ uid: user.uid, email: user.email, ...userDoc.data() });
        } else {
          // Si no tiene rol en Firestore, lo deslogueamos
          console.warn(`El usuario ${user.email} no tiene un rol asignado en Firestore.`);
          await signOut(auth);
          setCurrentUser(null);
        }
      } else {
        // No hay usuario logueado
        setCurrentUser(null);
      }
      setInitialising(false);
    });
    return unsubscribe; // Limpiar el listener al desmontar
  }, []);

 // --- Conexión a Firestore en tiempo real (CORREGIDA) ---
  useEffect(() => {
    // Si no hay un usuario logueado, no hacemos nada.
    // Esto previene que se pidan datos antes de tiempo.
    if (!currentUser) {
      // Opcional: limpiar los datos de la pantalla al cerrar sesión
      setFlights([]);
      setPackages([]);
      setCouriers([]);
      setEstados([]);
      setExtras([]);
      setSinCasillaItems([]);
      setPendientes([]);
      return;
    }

    // Si hay un usuario, ahora sí, creamos los listeners para obtener los datos.
    const createListener = (collectionName, setter, initialData, orderByField = null) => {
      const collRef = orderByField
        ? query(collection(db, collectionName), orderBy(orderByField, "desc"))
        : collection(db, collectionName);

      return onSnapshot(collRef, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        if (items.length === 0 && initialData) {
          initialData.forEach(item => addDoc(collection(db, collectionName), { name: item }));
        }
        setter(items);
      });
    };

    const unsubCouriers = createListener("couriers", setCouriers, COURIERS_INICIALES);
    const unsubEstados = createListener("estados", setEstados, ESTADOS_INICIALES);
    const unsubFlights = createListener("flights", setFlights, null, "fecha_salida");
    const unsubPackages = createListener("packages", setPackages, null, "fecha");
    const unsubExtras = createListener("extras", setExtras, null, "fecha");
    const unsubSinCasilla = createListener("sinCasilla", setSinCasillaItems, null, "fecha");
    const unsubPendientes = createListener("pendientes", setPendientes, null, "fecha");

    // Función de limpieza que se ejecuta cuando el usuario cierra sesión.
    return () => {
      unsubCouriers(); unsubEstados(); unsubFlights(); unsubPackages();
      unsubExtras(); unsubSinCasilla(); unsubPendientes();
    };
  }, [currentUser]); // <-- LA CLAVE: Este efecto se ejecuta solo cuando 'currentUser' cambia.

  // --- Funciones CRUD genéricas ---
  const createCrudHandlers = (collectionName) => ({
    add: async (data) => addDoc(collection(db, collectionName), data),
    update: async (data) => {
      const { id, ...rest } = data;
      await setDoc(doc(db, collectionName, id), rest, { merge: true });
    },
    remove: async (id) => deleteDoc(doc(db, collectionName, id)),
  });

  const couriersHandlers = createCrudHandlers("couriers");
  const estadosHandlers = createCrudHandlers("estados");
  const flightsHandlers = createCrudHandlers("flights");
  const packagesHandlers = createCrudHandlers("packages");
  const extrasHandlers = createCrudHandlers("extras");
  const sinCasillaHandlers = createCrudHandlers("sinCasilla");
  const pendientesHandlers = createCrudHandlers("pendientes");

  const moverPaqueteAPendientes = (paquete, casilla) => {
    const nuevaTarea = {
      type: "ASIGNAR_CASILLA", status: "No realizada", fecha: new Date().toISOString().slice(0,10),
      data: {
        numero: paquete.numero, nombre: paquete.nombre,
        tracking: paquete.tracking, casilla: casilla.trim().toUpperCase(),
      }
    };
    pendientesHandlers.add(nuevaTarea);
    sinCasillaHandlers.remove(paquete.id);
  };
  
  useEffect(()=>{
    if(currentUser){
      const allowed = tabsForRole(currentUser.role);
      if(!allowed.includes(tab)) setTab(allowed[0]);
    }
  },[currentUser, tab]);

  if (initialising) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-lg font-semibold">Cargando...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }
  
  const handleLogout = async () => {
    await signOut(auth);
  };

  const allowedTabs = tabsForRole(currentUser.role);

  const navStructure = [
    { category: "Principal", icon: Iconos.dashboard, tabs: ["Dashboard"] },
    { category: "Paquetes", icon: Iconos.paquetes, tabs: ["Recepción", "Paquetes en bodega", "Paquetes sin casilla", "Pendientes"] },
    { category: "Envíos", icon: Iconos.envios, tabs: ["Armado de cajas", "Cargas enviadas", "Gestión de cargas", "Proformas", "Extras"] },
    { category: "Administración", icon: Iconos.gestion, tabs: ["Usuarios"] },
  ];

  return (
    <div className="h-screen w-screen grid grid-cols-[256px_1fr] grid-rows-[auto_1fr] bg-slate-100">
      <aside className="row-span-2 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 h-32 border-b border-slate-200 flex items-center justify-center">
            <img src="/logo.png" alt="Logo Europa Envíos" className="max-w-full max-h-full" />
        </div>
        <nav className="flex-grow p-4 space-y-6 overflow-y-auto">
          {navStructure.map(group => {
            const visibleTabs = group.tabs.filter(t => allowedTabs.includes(t));
            if (visibleTabs.length === 0) return null;

            return (
              <div key={group.category}>
                <h3 className="px-2 mb-2 text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  {group.category}
                </h3>
                <ul className="space-y-1">
                  {visibleTabs.map(t => (
                    <li key={t}>
                      <button
                        onClick={() => setTab(t)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 flex items-center gap-3 ${
                          tab === t
                            ? "bg-francia-100 text-francia-700"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                        }`}
                      >
                        {t}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>

      <header className="bg-white border-b border-slate-200 flex items-center justify-end px-6 h-16">
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-700">{currentUser.email}</p>
            <p className="text-xs text-slate-500">{currentUser.role}{currentUser.role === 'COURIER' && ` (${currentUser.courier})`}</p>
          </div>
          <button onClick={handleLogout} className={BTN_ICON + " text-slate-500"} title="Cerrar sesión">
            {Iconos.logout}
          </button>
        </div>
      </header>

      <main className="overflow-y-auto p-4 sm:p-6 lg:p-8">
        {tab==="Dashboard" && <Dashboard packages={packages} flights={flights} pendientes={pendientes} onTabChange={setTab} currentUser={currentUser} />}
        {tab==="Recepción" && <Reception currentUser={currentUser} couriers={couriers} setCouriers={couriersHandlers} estados={estados} setEstados={estadosHandlers} flights={flights} packages={packages} onAdd={packagesHandlers.add}/>}
        {tab==="Paquetes sin casilla" && <PaquetesSinCasilla currentUser={currentUser} items={sinCasillaItems} onAdd={sinCasillaHandlers.add} onUpdate={sinCasillaHandlers.update} onRemove={sinCasillaHandlers.remove} onAsignarCasilla={moverPaqueteAPendientes} setItems={setSinCasillaItems} />}
        {tab==="Pendientes" && <Pendientes items={pendientes} onAdd={pendientesHandlers.add} onUpdate={pendientesHandlers.update} onRemove={pendientesHandlers.remove} />}
        {tab==="Paquetes en bodega" && <PaquetesBodega packages={packages} flights={flights} user={currentUser} onUpdate={packagesHandlers.update} onDelete={packagesHandlers.remove} onPendiente={pendientesHandlers.add} />}
        {tab==="Armado de cajas" && <ArmadoCajas packages={packages} flights={flights} onUpdateFlight={flightsHandlers.update} onAssign={()=>{}}/>}
        {tab==="Cargas enviadas" && <CargasEnviadas packages={packages} flights={flights} user={currentUser}/>}
        {tab==="Gestión de cargas" && <CargasAdmin flights={flights} onAdd={flightsHandlers.add} onUpdate={flightsHandlers.update} onDelete={flightsHandlers.remove} packages={packages}/>}
        {tab==="Proformas" && <Proformas packages={packages} flights={flights} extras={extras} user={currentUser}/>}
        {tab==="Usuarios" && <Usuarios />}
        {tab==="Extras" && <Extras flights={flights} couriers={couriers} extras={extras} onAdd={extrasHandlers.add} onUpdate={extrasHandlers.update} onDelete={extrasHandlers.remove} />}
      </main>
    </div>
  );
}

export default App;