import JsBarcode from "jsbarcode";
import * as XLSX from "xlsx-js-style";

/* ========== Iconos SVG (Heroicons) ========== */
export const Iconos = {
    mobileCam: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.776 48.776 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg>,
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

export const uuid = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const deaccent = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ñ/g, "n").replace(/Ñ/g, "N");
export const limpiar = (s) => deaccent(String(s || "")).toUpperCase().replace(/\s+/g, "");
export const parseComma = (txt) => {
    if (txt === null || txt === undefined) return 0;
    const s = String(txt).trim().replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
};
export const parseIntEU = (txt) => {
    const s = String(txt ?? "").replace(/[^\d-]/g, "");
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
};
export const fmtPeso = (n) => Number(n || 0).toFixed(3).replace(".", ",");
export const fmtMoney = (n) => Number(n || 0).toFixed(2).replace(".", ",");
export const sum = (a) => a.reduce((s, x) => s + Number(x || 0), 0);
export const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6", "#14B8A6", "#84CC16", "#F97316"];
export const MIN_FACTURABLE = 0.2;

export const ESTADOS_INICIALES = ["Aéreo", "Marítimo", "Ofrecer marítimo"];
export const COURIERS_INICIALES = [
    "Aero Box", "Aladín", "Boss Box", "Buzón", "Caba Box", "Click Box", "Easy Box", "Europa Envíos",
    "FastBox", "Fixo Cargo", "Fox Box", "Global Box", "Home Box", "Inflight Box", "Inter Couriers",
    "MC Group", "Miami Express", "One Box", "ParaguayBox", "Royal Box"
];
export const EMPRESAS_ENVIO_INICIALES = [
    "AMAZON", "ASENDIA", "CHINA POST", "COLISSIMO", "CORREOS", "CORREOS EXPRESS", "CTT EXPRESS",
    "DEUTSCHE POST", "DHL", "DPD", "ECO SCOOTING", "FEDEX", "GLS", "LIETUVOS PASTAS", "MRW",
    "NACEX", "ONTIME", "PAACK", "POSTE ITALIANE", "POSTNL", "ROYAL MAIL", "TIPSA", "TRANSAHER",
    "SENDING", "SEUR", "UPS", "ZELERIS"
];
export const ESTADOS_CARGA = ["En bodega", "En tránsito", "Arribada", "Entregada", "Cobrada"];
export const CASILLA_PREFIX_MAP = {
    "Aero Box": ["ABH", "ABC", "AB", "ABL", "ABK", "ACD"], "Aladín": ["ALD"], "Boss Box": ["BBC"],
    "Buzón": ["BP", "BA", "BS", "BE", "BC", "BJ", "BK"], "Caba Box": ["CABA", "CB", "PB"],
    "Click Box": ["CLI", "FM", "CDE", "MR", "MRA", "CBL", "CDELB", "CPO"], "Easy Box": ["EF", "EZ", "EB", "EBS", "EBC"],
    "Europa Envíos": ["EE"], "FastBox": ["FPY"], "Fixo Cargo": ["FCPY"], "Fox Box": ["FAS"],
    "Global Box": ["GB"], "Home Box": ["HB", "UNITED", "UB", "MYB"], "Inflight Box": ["IN", "IA", "IE", "IV"],
    "Inter Couriers": ["IC"], "MC Group": ["MC"], "Miami Express": ["ME", "ML"], "One Box": ["OB", "PGT"],
    "ParaguayBox": ["AB", "AS", "AY", "BE", "CB", "CC", "CE", "CH", "CN", "CZ", "ER", "FA", "FI", "GA", "KA", "LB", "LQ", "ML", "NB", "NW", "PI", "PJ", "SG", "SI", "SL", "SR", "SV", "TS", "VM", "TT"],
    "Royal Box": ["1A", "1B", "1E", "1G", "1M", "1P", "1Z", "2A", "2B", "2E", "2M", "2P", "2Z", "3E", "3P", "3Z", "4C", "4E", "1C", "1CB", "2C", "3C", "5C", "NB", "PI"]
};

export function courierPrefix(name) { return limpiar(name || ""); }

export function tabsForRole(role) {
    if (role === "COURIER") return ["Dashboard", "Paquetes sin casilla", "Paquetes en bodega", "Cargas enviadas", "Proformas"];
    return ["Dashboard", "Recepción", "Paquetes sin casilla", "Pendientes", "Paquetes en bodega", "Armado de cajas", "Cargas enviadas", "Gestión de cargas", "Proformas", "Usuarios", "Extras"];
}

export function couriersFromCasilla(casilla, availCouriers) {
    const c = limpiar(casilla).toUpperCase();
    if (!c) return [];
    const hits = new Set();
    Object.entries(CASILLA_PREFIX_MAP).forEach(([courier, prefixes]) => {
        if (!availCouriers.includes(courier)) return;
        for (const p of prefixes) {
            if (c.startsWith(p)) { hits.add(courier); break; }
        }
    });
    return Array.from(hits);
}

export function allowedCouriersByContext({ casilla, flightCode, avail }) {
    const code = (flightCode || "").toUpperCase();
    if (code.startsWith("AIR-PYBOX")) {
        return avail.includes("ParaguayBox") ? ["ParaguayBox"] : [];
    }
    const byCasilla = couriersFromCasilla(casilla, avail);
    return byCasilla.length ? byCasilla : avail;
}

export function estadosPermitidosPorCarga(codigo, estadosList) {
    const s = String(codigo || "").toUpperCase();
    if (s.startsWith("AIR")) return ["Aéreo"];
    if (s.startsWith("MAR")) return ["Marítimo"];
    if (s.startsWith("COMP")) return ["Ofrecer marítimo"];
    return estadosList && estadosList.length ? estadosList : ESTADOS_INICIALES;
}

const bd = () => ({ top:{style:"thin",color:{rgb:"FF000000"}}, bottom:{style:"thin",color:{rgb:"FF000000"}}, left:{style:"thin",color:{rgb:"FF000000"}}, right:{style:"thin",color:{rgb:"FF000000"}} });
export const th = (txt) => ({ v:txt, t:"s", s:{font:{bold:true,color:{rgb:"FFFFFFFF"}},fill:{fgColor:{rgb:"FF1F2937"}}, alignment:{horizontal:"center",vertical:"center"}, border:bd()} });
export const td = (v) => ({ v:String(v ?? ""), t:"s", s:{alignment:{vertical:"center"}, border:bd()} });
export const tdNum = (v, fmt = "0.00") => ({ v: typeof v === 'number' ? v : parseComma(v), t: "n", s: { alignment: { vertical: "center" }, border: bd(), numFmt: fmt } });
export const tdInt = (v) => ({ v: typeof v === 'number' ? v : parseIntEU(v), t: "n", s: { alignment: { vertical: "center" }, border: bd(), numFmt: "0" } });

export function sheetFromAOAStyled(name, rows, opts={}){
  const ws = XLSX.utils.aoa_to_sheet(rows.map(r=>r.map(c => (typeof c==="object"&&c.v!==undefined)?c:td(String(c??"")) )));
  if (opts.cols) ws["!cols"]=opts.cols;
  if (opts.rows) ws["!rows"]=opts.rows;
  if (opts.merges) ws["!merges"]=opts.merges;
  return { name, ws };
}
export function downloadXLSX(filename, sheets){
  const wb = XLSX.utils.book_new();
  sheets.forEach(({name,ws})=>XLSX.utils.book_append_sheet(wb, ws, name.slice(0,31)));
  XLSX.writeFile(wb, filename);
}

function barcodeSVG(text){
  const safe = deaccent(String(text)).toUpperCase();
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, safe, { format:"CODE128", displayValue:false, height:50, margin:0 });
  return new XMLSerializer().serializeToString(svg);
}

export function labelHTML({ codigo, nombre, casilla, pesoKg, medidasTxt, desc, cargaTxt, fecha }){
  const svgHtml = barcodeSVG(codigo);
  const fechaFmt = fecha ? new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES') : '';
  return `
    <html><head><meta charset="utf-8"><title>Etiqueta ${codigo}</title>
    <style>
      @page { size: 100mm 50mm; margin: 2mm; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; font-size: 9pt; line-height: 1.25; }
      .label-container { display: flex; flex-direction: column; width: 96mm; height: 46mm; }
      .line { margin-bottom: 0.8mm; }
      .b { font-weight: bold; }
      .header { display: flex; justify-content: space-between; font-size: 10pt; }
      .barcode { text-align: center; margin: 0.5mm 0; }
      .barcode svg { width: 100%; height: 10mm; }
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

// --- CAMBIO AÑADIDO: Se agrega `cargaTxt` a la función ---
export function boxLabelHTML({ courier, boxNumber, pesoKg, medidasTxt, fecha, cargaTxt }) {
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
            .detail-group { margin-bottom: 6mm; }
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
                  Carga: <b>${deaccent(cargaTxt || "")}</b><br/>
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

export function printHTMLInIframe(html){
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