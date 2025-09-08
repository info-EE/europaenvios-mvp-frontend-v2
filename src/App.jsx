/*  Europa Envios – MVP 0.2.4
   - Armado de cajas: robusto, sin pantalla blanca, caja activa + Editar/Guardar, reordenar y eliminar.
   - Impresion via iframe oculto (evita about:blank).
   - Remuevo acentos al imprimir etiquetas (y couriers sin acentos).
   - Estado restringido por prefijo de carga (AIR/MAR/COMP) en Recepcion y Editor de Bodega.
   - Gestion de cargas: aviso si faltan paquetes sin escanear al pasar a En transito/Arribado.
   - Bodega XLSX con columnas pedidas y “Exceso de volumen” antes de “Medidas”.
   - Proformas: usa plantilla con colores; fecha de carga y courier; logo centrado con =IMAGE();
     cantidades 3 decimales, precios 2 decimales; 5 filas de “slots” para extras debajo de la comision 4%.
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import JsBarcode from "jsbarcode";

/* ===== Utils ===== */
const uuid = () => {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  } catch {}
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
const fmtPeso = (n) => Number(n || 0).toFixed(3).replace(".", ",");
const fmt2 = (n) => Number(n || 0).toFixed(2).replace(".", ",");
const sum = (a) => a.reduce((s, x) => s + Number(x || 0), 0);
const stripAccents = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "");
const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6", "#14B8A6", "#84CC16", "#F97316"];

/* ===== Impresion sin about:blank ===== */
function printHTMLInIframe(html) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const cleanup = () => setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 500);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      const after = () => { iframe.contentWindow.removeEventListener?.("afterprint", after); cleanup(); };
      iframe.contentWindow.addEventListener?.("afterprint", after);
      iframe.contentWindow.print();
    } catch {
      cleanup();
      alert("No se pudo generar la etiqueta.");
    }
  }, 50);
}

/* ===== XLSX helpers (fallback de estilos) ===== */
const bd = () => ({
  top: { style: "thin", color: { rgb: "FFCBD5E1" } },
  bottom: { style: "thin", color: { rgb: "FFCBD5E1" } },
  left: { style: "thin", color: { rgb: "FFCBD5E1" } },
  right: { style: "thin", color: { rgb: "FFCBD5E1" } },
});
const th = (txt) => ({
  v: txt,
  t: "s",
  s: {
    font: { bold: true, color: { rgb: "FFFFFFFF" } },
    fill: { fgColor: { rgb: "FF1F2937" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: bd(),
  },
});
const td = (v) => ({ v, t: "s", s: { alignment: { vertical: "center" }, border: bd() } });

function sheetFromAOAStyled(name, rows, opts = {}) {
  const ws = XLSX.utils.aoa_to_sheet(
    rows.map((r) => r.map((c) => (typeof c === "object" && c.v !== undefined ? c : td(String(c ?? "")))))
  );
  if (opts.cols) ws["!cols"] = opts.cols;
  if (opts.rows) ws["!rows"] = opts.rows;
  if (opts.merges) ws["!merges"] = opts.merges;
  return { name, ws };
}
function downloadXLSX(filename, sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, ws }) => XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)));
  XLSX.writeFile(wb, filename);
}

/* ===== Carga de plantillas desde /public/templates ===== */
async function tryLoadTemplate(path) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const wb = XLSX.read(ab, { cellStyles: true });
    return wb;
  } catch {
    return null;
  }
}
function replacePlaceholdersInWB(wb, map) {
  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (cell && typeof cell.v === "string") {
          if (cell.v.includes("{{LOGO}}") && map.LOGO) {
            ws[addr] = { t: "n", f: `IMAGE("${map.LOGO}",,1)` }; // fit, centrado por alineacion del template
            continue;
          }
          let txt = cell.v;
          Object.entries(map).forEach(([k, v]) => {
            txt = txt.replaceAll(`{{${k}}}`, v);
          });
          if (txt !== cell.v) ws[addr] = { ...cell, v: txt, t: "s" };
        }
      }
    }
  });
}
function appendSheet(wb, name, rows, opts = {}) {
  const { ws } = sheetFromAOAStyled(name, rows, opts);
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}

/* ===== UI ===== */
const BTN = "px-3 py-2 rounded-xl border bg-white hover:bg-gray-50";
const BTN_PRIMARY = "px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white";
const Section = ({ title, right, children }) => (
  <div className="bg-white rounded-2xl shadow p-4 mb-6">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {right}
    </div>
    {children}
  </div>
);
const Field = ({ label, required, children }) => (
  <label className="block">
    <div className="text-sm text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500"> *</span>}
    </div>
    {children}
  </label>
);
const Input = (p) => (
  <input
    {...p}
    className={
      "w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 ring-indigo-500 " + (p.className || "")
    }
  />
);
const Tabs = ({ tabs, current, onChange }) => (
  <div className="flex gap-2 flex-wrap mb-4">
    {tabs.map((t) => (
      <button
        key={t}
        onClick={() => onChange(t)}
        className={
          "px-3 py-2 rounded-xl text-sm " + (current === t ? "bg-indigo-600 text-white" : "bg-white border")
        }
      >
        {t}
      </button>
    ))}
  </div>
);

/* ===== Datos “listas” ===== */
const ESTADOS_INICIALES = ["Aereo", "Maritimo", "Ofrecer maritimo"]; // sin acentos
const COURIERS_INICIALES = [
  "Aladin",
  "Boss Box",
  "Buzon", // sin acento
  "Caba Box",
  "Click Box",
  "Easy Box",
  "Europa Envios",
  "FastBox",
  "Fixo Cargo",
  "Fox Box",
  "Global Box",
  "Home Box",
  "Inflight Box",
  "Inter Couriers",
  "MC Group",
  "Miami Express",
  "One Box",
  "ParaguayBox",
  "Royal Box",
];
const ESTADOS_CARGA = ["En bodega", "En transito", "Arribado"]; // sin acentos

/* restriccion por prefijo */
function estadosPermitidosPorCarga(codigo) {
  const s = String(codigo || "").toUpperCase();
  if (s.startsWith("AIR")) return ["Aereo"];
  if (s.startsWith("MAR")) return ["Maritimo"];
  if (s.startsWith("COMP")) return ["Ofrecer maritimo"];
  return ESTADOS_INICIALES;
}

/* ===== Login ===== */
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ADMIN");
  const [courier, setCourier] = useState("");
  const canSubmit = email && role && (role === "ADMIN" || courier);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-4">Acceso al sistema</h1>
        <Field label="Email" required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" />
        </Field>
        <Field label="Rol" required>
          <select className="w-full rounded-xl border px-3 py-2" value={role} onChange={(e) => setRole(e.target.value)}>
            <option>ADMIN</option>
            <option>COURIER</option>
          </select>
        </Field>
        {role === "COURIER" && (
          <Field label="Courier" required>
            <Input value={courier} onChange={(e) => setCourier(e.target.value)} />
          </Field>
        )}
        <button
          onClick={() => onLogin({ email, role, courier: role === "ADMIN" ? null : courier })}
          disabled={!canSubmit}
          className={BTN_PRIMARY + " w-full mt-2 disabled:opacity-50"}
        >
          Entrar
        </button>
      </div>
    </div>
  );
}

/* ===== Gestion de cargas ===== */
function CargasAdmin({ flights, setFlights, packages }) {
  const [code, setCode] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [awb, setAwb] = useState("");
  const [fac, setFac] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function create() {
    if (!code) return;
    setFlights([{ id: uuid(), codigo: code, fecha_salida: date, estado: "En bodega", awb, factura_cacesa: fac, cajas: [] }, ...flights]);
    setCode("");
    setAwb("");
    setFac("");
  }

  // cuantos paquetes de la carga NO asignados a cajas
  function missingScans(flight) {
    const idsDeCarga = packages.filter((p) => p.flight_id === flight.id).map((p) => p.id);
    const asignados = new Set((flight.cajas || []).flatMap((c) => c.paquetes || []));
    return idsDeCarga.filter((id) => !asignados.has(id)).length;
  }

  function upd(id, field, value) {
    if (field === "estado" && (value === "En transito" || value === "Arribado")) {
      const f = flights.find((x) => x.id === id);
      if (f) {
        const faltan = missingScans(f);
        if (faltan > 0) {
          const ok = window.confirm(
            `Atencion: faltan escanear ${faltan} paquete(s) en "Armado de cajas" para la carga ${f.codigo}. ¿Deseas continuar igualmente?`
          );
          if (!ok) return;
        }
      }
    }
    setFlights(flights.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  }

  const list = flights.filter((f) => (!from || f.fecha_salida >= from) && (!to || f.fecha_salida <= to));

  return (
    <Section
      title="Gestion de cargas"
      right={
        <div className="flex gap-2 items-end">
          <Field label="Desde">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <div className="w-px h-10 bg-gray-200 mx-1" />
          <Input placeholder="Codigo de carga" value={code} onChange={(e) => setCode(e.target.value)} />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input placeholder="AWB (opcional)" value={awb} onChange={(e) => setAwb(e.target.value)} />
          <Input placeholder="Factura Cacesa (opcional)" value={fac} onChange={(e) => setFac(e.target.value)} />
          <button onClick={create} className={BTN_PRIMARY}>
            Crear
          </button>
        </div>
      }
    >
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {["Codigo", "Fecha salida", "Estado", "AWB", "Factura Cacesa", "Cajas"].map((h) => (
                <th key={h} className="text-left px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((f) => (
              <tr key={f.id} className="border-b">
                <td className="px-3 py-2">
                  <Input value={f.codigo} onChange={(e) => upd(f.id, "codigo", e.target.value)} />
                </td>
                <td className="px-3 py-2">
                  <Input type="date" value={f.fecha_salida} onChange={(e) => upd(f.id, "fecha_salida", e.target.value)} />
                </td>
                <td className="px-3 py-2">
                  <select className="border rounded px-2 py-1" value={f.estado} onChange={(e) => upd(f.id, "estado", e.target.value)}>
                    {ESTADOS_CARGA.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <Input value={f.awb || ""} onChange={(e) => upd(f.id, "awb", e.target.value)} />
                </td>
                <td className="px-3 py-2">
                  <Input value={f.factura_cacesa || ""} onChange={(e) => upd(f.id, "factura_cacesa", e.target.value)} />
                </td>
                <td className="px-3 py-2">{f.cajas.length}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-500 py-6">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ===== Recepcion ===== */
function ManageList({ label, items, setItems }) {
  const [val, setVal] = useState("");
  const add = () => {
    const v = val.trim();
    if (!v) return;
    if (items.some((x) => x.toLowerCase() === v.toLowerCase())) return setVal("");
    setItems([...items, v]);
    setVal("");
  };
  const del = (i) => setItems(items.filter((_, idx) => idx !== i));
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="text-sm font-medium mb-2">{label}</div>
      <div className="flex gap-2 mb-2">
        <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder={`Nuevo ${label.slice(0, -1)}`} />
        <button className={BTN} onClick={add}>
          Agregar
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((it, i) => (
          <span key={i} className="px-2 py-1 bg-white border rounded">
            {it}{" "}
            <button onClick={() => del(i)} className="text-red-600">
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
function InfoBox({ title, value }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Reception({ currentUser, couriers, setCouriers, estados, setEstados, flights, onAdd }) {
  const vuelosBodega = flights.filter((f) => f.estado === "En bodega");
  const [flightId, setFlightId] = useState(vuelosBodega[0]?.id || "");
  const [form, setForm] = useState({
    courier: currentUser.role === "COURIER" ? currentUser.courier : "",
    estado: "",
    casilla: "",
    codigo: "",
    fecha: new Date().toISOString().slice(0, 10),
    empresa: "",
    nombre: "",
    tracking: "",
    remitente: "",
    peso_real_txt: "",
    L_txt: "",
    A_txt: "",
    H_txt: "",
    desc: "",
    valor_txt: "0,00",
    foto: null,
  });

  const limpiar = (s) => String(s || "").toUpperCase().replace(/\s+/g, "");
  useEffect(() => {
    if (!form.courier) return;
    const key = "seq_" + limpiar(form.courier);
    const next = (Number(localStorage.getItem(key)) || 0) + 1;
    const n = next > 999 ? 1 : next;
    setForm((f) => ({ ...f, codigo: `${limpiar(form.courier)}${n}` }));
    // eslint-disable-next-line
  }, [form.courier]);

  // estados permitidos por la carga
  const codigoCargaSel = flights.find((f) => f.id === flightId)?.codigo || "";
  const estadosPermitidos = estadosPermitidosPorCarga(codigoCargaSel);
  useEffect(() => {
    if (form.estado && !estadosPermitidos.includes(form.estado)) {
      setForm((f) => ({ ...f, estado: estadosPermitidos[0] || "" }));
    }
    // eslint-disable-next-line
  }, [flightId]);

  const peso = parseComma(form.peso_real_txt);
  const L = parseIntEU(form.L_txt),
    A = parseIntEU(form.A_txt),
    H = parseIntEU(form.H_txt);
  const fact = Math.max(0.2, peso || 0);
  const vol = A && H && L ? (A * H * L) / 5000 : 0;
  const exc = Math.max(0, vol - fact);

  const ok = () =>
    [
      "courier",
      "estado",
      "casilla",
      "codigo",
      "fecha",
      "empresa",
      "nombre",
      "tracking",
      "remitente",
      "peso_real_txt",
      "L_txt",
      "A_txt",
      "H_txt",
      "desc",
      "valor_txt",
    ].every((k) => String(form[k] || "").trim() !== "");
  const submit = () => {
    if (!ok()) {
      alert("Faltan campos.");
      return;
    }
    const key = "seq_" + limpiar(form.courier);
    let cur = (Number(localStorage.getItem(key)) || 0) + 1;
    if (cur > 999) cur = 1;
    localStorage.setItem(key, String(cur));
    const fl = flights.find((f) => f.id === flightId);
    const p = {
      id: uuid(),
      flight_id: flightId,
      courier: form.courier,
      estado: form.estado,
      casilla: form.casilla,
      codigo: form.codigo,
      codigo_full: `${fl?.codigo || "CARGA"}-${form.codigo}`,
      fecha: form.fecha,
      empresa_envio: form.empresa,
      nombre_apellido: form.nombre,
      tracking: form.tracking,
      remitente: form.remitente,
      peso_real: peso,
      largo: L,
      ancho: A,
      alto: H,
      descripcion: form.desc,
      valor_aerolinea: parseComma(form.valor_txt),
      peso_facturable: Number(fact.toFixed(3)),
      peso_volumetrico: Number(vol.toFixed(3)),
      exceso_volumen: Number(exc.toFixed(3)),
      foto: form.foto,
      estado_bodega: "En bodega",
    };
    onAdd(p);
    setForm({
      ...form,
      casilla: "",
      codigo: "",
      empresa: "",
      nombre: "",
      tracking: "",
      remitente: "",
      peso_real_txt: "",
      L_txt: "",
      A_txt: "",
      H_txt: "",
      desc: "",
      valor_txt: "0,00",
      foto: null,
    });
  };

  // camara
  const [camOpen, setCamOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  useEffect(() => {
    if (!camOpen) return;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play();
        }
      } catch {
        alert("No se pudo acceder a la camara.");
        setCamOpen(false);
      }
    })();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [camOpen]);
  const tomarFoto = () => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(v, 0, 0);
    const data = canvas.toDataURL("image/jpeg", 0.85);
    setForm((f) => ({ ...f, foto: data }));
    setCamOpen(false);
  };

  // archivo
  const fileRef = useRef(null);
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setForm((f) => ({ ...f, foto: r.result }));
    r.readAsDataURL(file);
  };

  // etiqueta 100x60 (texto sin acentos)
  const printLabel = () => {
    const fl = flights.find((f) => f.id === flightId);
    if (!(form.codigo && form.desc && form.casilla && form.nombre)) {
      alert("Completa Codigo, Casilla, Nombre y Descripcion.");
      return;
    }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, String(form.codigo), { format: "CODE128", displayValue: false, height: 50, margin: 0 });
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
          <div class="line b">Codigo: ${stripAccents(form.codigo)}</div>
          <div class="line">${svgHtml}</div>
          <div class="line">Cliente: ${stripAccents(form.nombre)}</div>
          <div class="line">Casilla: ${stripAccents(form.casilla)}</div>
          <div class="line">Peso: ${fmtPeso(peso)} kg</div>
          <div class="line">Medidas: ${stripAccents(medidas)}</div>
          <div class="line">Desc: ${stripAccents(form.desc)}</div>
          <div class="line">Carga: ${stripAccents(fl?.codigo || "-")}</div>
        </div>
      </body></html>`;
    printHTMLInIframe(html);
  };

  const [showMgr, setShowMgr] = useState(false);

  return (
    <Section
      title="Recepcion de paquete"
      right={
        <div className="flex items-center gap-2">
          <button className={BTN} onClick={() => setShowMgr((s) => !s)}>
            Gestionar listas
          </button>
          <span className="text-sm text-gray-500">Todos los campos obligatorios</span>
        </div>
      }
    >
      {showMgr && (
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <ManageList label="Couriers" items={couriers} setItems={setCouriers} />
          <ManageList label="Estados" items={estados} setItems={setEstados} />
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Carga" required>
          <select className="w-full rounded-xl border px-3 py-2" value={flightId} onChange={(e) => setFlightId(e.target.value)}>
            {vuelosBodega.length === 0 && <option value="">— No hay cargas En bodega —</option>}
            {vuelosBodega.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo} · {f.fecha_salida}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Courier" required>
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={form.courier}
            onChange={(e) => setForm({ ...form, courier: e.target.value })}
            disabled={currentUser.role === "COURIER"}
          >
            <option value="">Seleccionar…</option>
            {COURIERS_INICIALES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Estado" required>
          <select className="w-full rounded-xl border px-3 py-2" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
            <option value="">Seleccionar…</option>
            {estadosPermitidos.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>

        <Field label="Casilla" required>
          <Input value={form.casilla} onChange={(e) => setForm({ ...form, casilla: e.target.value })} />
        </Field>
        <Field label="Codigo de paquete" required>
          <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} placeholder="BOSSBOX1" />
        </Field>
        <Field label="Fecha" required>
          <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
        </Field>

        <Field label="Empresa de envio" required>
          <Input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
        </Field>
        <Field label="Nombre y apellido" required>
          <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </Field>
        <Field label="Tracking" required>
          <Input value={form.tracking} onChange={(e) => setForm({ ...form, tracking: e.target.value })} />
        </Field>

        <Field label="Remitente" required>
          <Input value={form.remitente} onChange={(e) => setForm({ ...form, remitente: e.target.value })} />
        </Field>
        <Field label="Peso real (kg)" required>
          <Input value={form.peso_real_txt} onChange={(e) => setForm({ ...form, peso_real_txt: e.target.value })} placeholder="3,128" />
        </Field>
        <Field label="Largo (cm)" required>
          <Input value={form.L_txt} onChange={(e) => setForm({ ...form, L_txt: e.target.value })} placeholder="50" />
        </Field>
        <Field label="Ancho (cm)" required>
          <Input value={form.A_txt} onChange={(e) => setForm({ ...form, A_txt: e.target.value })} placeholder="30" />
        </Field>
        <Field label="Alto (cm)" required>
          <Input value={form.H_txt} onChange={(e) => setForm({ ...form, H_txt: e.target.value })} placeholder="20" />
        </Field>

        <Field label="Descripcion" required>
          <Input value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
        </Field>
        <Field label="Precio (EUR)" required>
          <Input value={form.valor_txt} onChange={(e) => setForm({ ...form, valor_txt: e.target.value })} placeholder="10,00" />
        </Field>

        <Field label="Foto del paquete">
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()} className={BTN}>
              Seleccionar archivo
            </button>
            <button type="button" onClick={() => setCamOpen(true)} className={BTN}>
              Tomar foto
            </button>
          </div>
        </Field>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <InfoBox title="Peso facturable (min 0,200 kg)" value={`${fmtPeso(fact)} kg`} />
        <InfoBox title="Peso volumetrico (A×H×L / 5000)" value={`${fmtPeso(vol)} kg`} />
        <InfoBox title="Exceso de volumen" value={`${fmtPeso(exc)} kg`} />
      </div>

      <div className="flex justify-between mt-4">
        <button onClick={printLabel} className={BTN}>
          Imprimir etiqueta
        </button>
        <button onClick={submit} className={BTN_PRIMARY}>
          Guardar paquete
        </button>
      </div>

      {camOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow w-full max-w-3xl">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="text-lg font-semibold">Tomar foto</div>
              <button className={BTN} onClick={() => setCamOpen(false)}>
                Cerrar
              </button>
            </div>
            <div className="p-4 space-y-3">
              <video ref={videoRef} playsInline className="w-full rounded-xl bg-black/50" />
              <div className="flex justify-end">
                <button onClick={tomarFoto} className={BTN_PRIMARY}>
                  Capturar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ===== Paquetes en bodega ===== */
function PaquetesBodega({ packages, flights, user, onUpdate }) {
  const [q, setQ] = useState("");
  const [flightId, setFlightId] = useState("");
  const vuelosBodega = flights.filter((f) => f.estado === "En bodega");

  const rows = packages
    .filter((p) => flights.find((f) => f.id === p.flight_id)?.estado === "En bodega")
    .filter((p) => !flightId || p.flight_id === flightId)
    .filter((p) => (p.codigo + p.casilla + p.tracking + p.nombre_apellido + p.courier).toLowerCase().includes(q.toLowerCase()))
    .filter((p) => user.role !== "COURIER" || p.courier === user.courier);

  // editor
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const start = (p) => {
    setForm({
      ...p,
      peso_real_txt: fmtPeso(p.peso_real),
      L_txt: String(p.largo || 0),
      A_txt: String(p.ancho || 0),
      H_txt: String(p.alto || 0),
      valor_txt: fmt2(p.valor_aerolinea),
    });
    setOpen(true);
  };
  const save = () => {
    const peso = parseComma(form.peso_real_txt);
    const L = parseIntEU(form.L_txt),
      A = parseIntEU(form.A_txt),
      H = parseIntEU(form.H_txt);
    const fact = Math.max(0.2, peso || 0);
    const vol = A && H && L ? (A * H * L) / 5000 : 0;
    const exc = Math.max(0, vol - fact);
    const upd = {
      ...form,
      peso_real: peso,
      largo: L,
      ancho: A,
      alto: H,
      peso_facturable: Number(fact.toFixed(3)),
      peso_volumetrico: Number(vol.toFixed(3)),
      exceso_volumen: Number(exc.toFixed(3)),
      valor_aerolinea: parseComma(form.valor_txt),
    };
    onUpdate(upd);
    setOpen(false);
  };

  // foto
  const [viewer, setViewer] = useState(null);

  // export
  async function exportXLSX() {
    const header = [
      th("Carga"),
      th("Courier"),
      th("Estado"),
      th("Casilla"),
      th("Codigo de paquete"),
      th("Fecha"),
      th("Empresa de envio"),
      th("Nombre y apellido"),
      th("Tracking"),
      th("Remitente"),
      th("Peso facturable (min 0,200 kg)"),
      th("Exceso de volumen"),
      th("Medidas"),
      th("Descripcion"),
      th("Precio (EUR)"),
    ];
    const body = rows.map((p) => {
      const carga = flights.find((f) => f.id === p.flight_id)?.codigo || "";
      const medidas = `${p.largo}x${p.ancho}x${p.alto} cm`;
      return [
        td(carga),
        td(p.courier),
        td(p.estado),
        td(p.casilla),
        td(p.codigo),
        td(p.fecha),
        td(p.empresa_envio || ""),
        td(p.nombre_apellido || ""),
        td(p.tracking || ""),
        td(p.remitente || ""),
        td(fmtPeso(p.peso_facturable)),
        td(fmtPeso(p.exceso_volumen)),
        td(medidas),
        td(p.descripcion || ""),
        td(fmt2(p.valor_aerolinea || 0)),
      ];
    });

    const tpl = await tryLoadTemplate("/templates/bodega.xlsx");
    if (tpl) {
      replacePlaceholdersInWB(tpl, { CARGA: flights.find((f) => f.id === flightId)?.codigo || "", FECHA: new Date().toISOString().slice(0, 10) });
      appendSheet(tpl, "DATA", [header, ...body], {
        cols: [{ wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 28 }, { wch: 12 }],
      });
      XLSX.writeFile(tpl, "Paquetes_en_bodega.xlsx");
      return;
    }

    const { ws } = sheetFromAOAStyled("Bodega", [header, ...body], {
      cols: [{ wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 28 }, { wch: 12 }],
      rows: [{ hpt: 24 }],
    });
    downloadXLSX("Paquetes_en_bodega.xlsx", [{ name: "Bodega", ws }]);
  }

  // graficos
  const aggReal = {};
  const aggExc = {};
  rows.forEach((p) => {
    aggReal[p.courier] = (aggReal[p.courier] || 0) + p.peso_real;
    aggExc[p.courier] = (aggExc[p.courier] || 0) + p.exceso_volumen;
  });
  const dataReal = Object.entries(aggReal).map(([courier, kg_real]) => ({ courier, kg_real }));
  const dataExc = Object.entries(aggExc).map(([courier, kg_exceso]) => ({ courier, kg_exceso }));
  const totalReal = sum(dataReal.map((d) => d.kg_real));
  const totalExc = sum(dataExc.map((d) => d.kg_exceso));

  function printPkgLabel(p) {
    const L = p.largo || 0,
      A = p.ancho || 0,
      H = p.alto || 0;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, String(p.codigo), { format: "CODE128", displayValue: false, height: 50, margin: 0 });
    const svgHtml = new XMLSerializer().serializeToString(svg);
    const medidas = `${L}x${A}x${H} cm`;
    const carga = flights.find((f) => f.id === p.flight_id)?.codigo || "-";
    const html = `
      <html><head><meta charset="utf-8"><title>Etiqueta</title>
      <style>
        @page { size: 100mm 60mm; margin: 5mm; } body { font-family: Arial, sans-serif; }
        .box { width: 100mm; height: 60mm; } .line { margin: 2mm 0; font-size: 12pt; } .b { font-weight: bold; }
        svg { width: 90mm; height: 18mm; }
      </style></head><body>
        <div class="box">
          <div class="line b">Codigo: ${stripAccents(p.codigo)}</div>
          <div class="line">${svgHtml}</div>
          <div class="line">Cliente: ${stripAccents(p.nombre_apellido || "")}</div>
          <div class="line">Casilla: ${stripAccents(p.casilla || "")}</div>
          <div class="line">Peso: ${fmtPeso(p.peso_real || 0)} kg</div>
          <div class="line">Medidas: ${stripAccents(medidas)}</div>
          <div class="line">Desc: ${stripAccents(p.descripcion || "")}</div>
          <div class="line">Carga: ${stripAccents(carga)}</div>
        </div>
      </body></html>`;
    printHTMLInIframe(html);
  }

  return (
    <Section
      title="Paquetes en bodega"
      right={
        <div className="flex gap-2">
          <select className="rounded-xl border px-3 py-2" value={flightId} onChange={(e) => setFlightId(e.target.value)}>
            <option value="">Todas las cargas (En bodega)</option>
            {vuelosBodega.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo}
              </option>
            ))}
          </select>
          <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button onClick={exportXLSX} className="px-3 py-2 bg-gray-800 text-white rounded-xl">
            Exportar XLSX
          </button>
        </div>
      }
    >
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {[
                "Carga",
                "Codigo",
                "Casilla",
                "Fecha",
                "Nombre",
                "Tracking",
                "Peso real",
                "Medidas",
                "Exceso de volumen",
                "Descripcion",
                "Foto",
                "Editar",
              ].map((h) => (
                <th key={h} className="text-left px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const carga = flights.find((f) => f.id === p.flight_id)?.codigo || "";
              return (
                <tr key={p.id} className="border-b">
                  <td className="px-3 py-2">{carga}</td>
                  <td className="px-3 py-2 font-mono">{p.codigo}</td>
                  <td className="px-3 py-2">{p.casilla}</td>
                  <td className="px-3 py-2">{p.fecha}</td>
                  <td className="px-3 py-2">{p.nombre_apellido}</td>
                  <td className="px-3 py-2 font-mono">{p.tracking}</td>
                  <td className="px-3 py-2">{fmtPeso(p.peso_real)} kg</td>
                  <td className="px-3 py-2">
                    {p.largo}x{p.ancho}x{p.alto} cm
                  </td>
                  <td className="px-3 py-2">{fmtPeso(p.exceso_volumen)} kg</td>
                  <td className="px-3 py-2">{p.descripcion}</td>
                  <td className="px-3 py-2">
                    {p.foto ? (
                      <img alt="foto" src={p.foto} className="w-14 h-14 object-cover rounded cursor-pointer" onClick={() => setViewer(p.foto)} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button className="px-2 py-1 border rounded" onClick={() => start(p)}>
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center text-gray-500 py-6">
                  No hay paquetes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Graficos */}
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {[
          { data: dataReal, key: "kg_real", title: `Kg reales por courier. Total: `, total: totalReal },
          { data: dataExc, key: "kg_exceso", title: `Exceso volumetrico por courier. Total: `, total: totalExc },
        ].map((g, ix) => (
          <div key={g.key} className="bg-gray-50 rounded-xl p-3">
            <div className="text-sm text-gray-700 mb-2">
              {g.title}
              <b>{fmtPeso(g.total)} kg</b>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={g.data} dataKey={g.key} nameKey="courier" outerRadius={100} label={(e) => `${e.courier}: ${fmtPeso(e[g.key])} kg`}>
                    {g.data.map((_, i) => (
                      <Cell key={i} fill={COLORS[(i + (ix ? 3 : 0)) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${fmtPeso(v)} kg`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Modal editar */}
      {open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow w-full max-w-4xl">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="text-lg font-semibold">Editar paquete</div>
              <button className={BTN} onClick={() => setOpen(false)}>
                Cerrar
              </button>
            </div>
            <div className="p-4 grid md:grid-cols-3 gap-3">
              <Field label="Carga">
                <select
                  className="w-full rounded-xl border px-3 py-2"
                  value={form.flight_id}
                  onChange={(e) => setForm({ ...form, flight_id: e.target.value })}
                >
                  {flights.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.codigo}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Courier">
                <Input value={form.courier} onChange={(e) => setForm({ ...form, courier: e.target.value })} />
              </Field>
              <Field label="Estado">
                {(() => {
                  const codigo = flights.find((f) => f.id === form.flight_id)?.codigo || "";
                  const opts = estadosPermitidosPorCarga(codigo);
                  return (
                    <select className="w-full rounded-xl border px-3 py-2" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                      {opts.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  );
                })()}
              </Field>

              <Field label="Casilla">
                <Input value={form.casilla} onChange={(e) => setForm({ ...form, casilla: e.target.value })} />
              </Field>
              <Field label="Codigo de paquete">
                <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Fecha">
                <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </Field>

              <Field label="Empresa de envio">
                <Input value={form.empresa_envio || ""} onChange={(e) => setForm({ ...form, empresa_envio: e.target.value })} />
              </Field>
              <Field label="Nombre y apellido">
                <Input value={form.nombre_apellido} onChange={(e) => setForm({ ...form, nombre_apellido: e.target.value })} />
              </Field>
              <Field label="Tracking">
                <Input value={form.tracking} onChange={(e) => setForm({ ...form, tracking: e.target.value })} />
              </Field>

              <Field label="Remitente">
                <Input value={form.remitente || ""} onChange={(e) => setForm({ ...form, remitente: e.target.value })} />
              </Field>
              <Field label="Peso real (kg)">
                <Input value={form.peso_real_txt} onChange={(e) => setForm({ ...form, peso_real_txt: e.target.value })} />
              </Field>
              <Field label="Largo (cm)">
                <Input value={form.L_txt} onChange={(e) => setForm({ ...form, L_txt: e.target.value })} />
              </Field>
              <Field label="Ancho (cm)">
                <Input value={form.A_txt} onChange={(e) => setForm({ ...form, A_txt: e.target.value })} />
              </Field>
              <Field label="Alto (cm)">
                <Input value={form.H_txt} onChange={(e) => setForm({ ...form, H_txt: e.target.value })} />
              </Field>

              <Field label="Descripcion">
                <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              </Field>
              <Field label="Precio (EUR)">
                <Input value={form.valor_txt} onChange={(e) => setForm({ ...form, valor_txt: e.target.value })} />
              </Field>

              <div className="md:col-span-3 flex items-center justify-between mt-2">
                <button onClick={() => printPkgLabel(form)} className={BTN}>
                  Reimprimir etiqueta
                </button>
                <div className="flex gap-2">
                  <button onClick={save} className={BTN_PRIMARY}>
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* visor foto */}
      {viewer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow w-full max-w-3xl">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="text-lg font-semibold">Foto</div>
              <button className={BTN} onClick={() => setViewer(null)}>
                Cerrar
              </button>
            </div>
            <div className="p-4">
              <img src={viewer} alt="foto" className="max-w-full rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ===== Armado de cajas (robusto + seleccion + Editar/Guardar) ===== */
function ArmadoCajas({ packages, flights, setFlights, onAssign }) {
  const [flightId, setFlightId] = useState("");
  const [scan, setScan] = useState("");
  const [activeBoxId, setActiveBoxId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const flight = flights.find((f) => f.id === flightId) || null;
  const cajas = flight?.cajas ?? [];

  const nInt = (v) => parseIntEU(v ?? 0);
  const nDec = (v) => parseComma(v ?? "0");
  const uniqNameOk = (id, nombre) => {
    const name = String(nombre || "").trim().toLowerCase();
    if (!name) return false;
    return !cajas.some((c) => c.id !== id && String(c.codigo || "").trim().toLowerCase() === name);
  };

  function addBox() {
    if (!flight) return alert("Selecciona una carga primero.");
    const n = cajas.length + 1;
    const nueva = { id: uuid(), codigo: `Caja ${n}`, paquetes: [], peso: "", L: "", A: "", H: "" };
    setFlights(flights.map((f) => (f.id !== flightId ? f : { ...f, cajas: [...cajas, nueva] })));
    setActiveBoxId(nueva.id);
    setEditingId(nueva.id);
  }
  function updBox(id, patch) {
    if (!flight) return;
    setFlights(
      flights.map((f) => (f.id !== flightId ? f : { ...f, cajas: cajas.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
    );
  }
  function saveBox(id) {
    const c = cajas.find((x) => x.id === id);
    if (!c) return;
    if (!uniqNameOk(id, c.codigo)) {
      alert("El nombre de la caja ya existe en esta carga. Debe ser unico.");
      return;
    }
    setEditingId(null);
  }
  function removeBox(id) {
    if (!flight) return;
    setFlights(flights.map((f) => (f.id !== flightId ? f : { ...f, cajas: cajas.filter((c) => c.id !== id) })));
    if (activeBoxId === id) setActiveBoxId(null);
    if (editingId === id) setEditingId(null);
  }
  function reorderBox(id, dir) {
    if (!flight) return;
    const arr = [...cajas];
    const i = arr.findIndex((c) => c.id === id);
    if (i < 0) return;
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setFlights(flights.map((f) => (f.id !== flightId ? f : { ...f, cajas: arr })));
  }

  function assign() {
    if (!flight) return alert("Selecciona una carga.");
    const code = String(scan || "").trim().toUpperCase();
    if (!code) return;
    const pkg = packages.find((p) => p.flight_id === flightId && String(p.codigo).toUpperCase() === code);
    if (!pkg) {
      alert("No existe ese codigo en esta carga.");
      setScan("");
      return;
    }
    if (!activeBoxId) {
      alert("Selecciona una caja (o crea una) para asignar el paquete.");
      return;
    }
    if (cajas.some((c) => c.paquetes.includes(pkg.id))) {
      alert("Ese paquete ya esta asignado a una caja.");
      setScan("");
      return;
    }
    setFlights(
      flights.map((f) =>
        f.id !== flightId ? f : { ...f, cajas: cajas.map((c) => (c.id !== activeBoxId ? c : { ...c, paquetes: [...c.paquetes, pkg.id] })) }
      )
    );
    onAssign?.(pkg.id);
    setScan("");
  }

  function move(pid, fromId, toId) {
    if (!flight || !toId) return;
    if (fromId === toId) return;
    setFlights((prev) =>
      prev.map((f) => (f.id !== flightId ? f : { ...f, cajas: f.cajas.map((c) => (c.id === fromId ? { ...c, paquetes: c.paquetes.filter((x) => x !== pid) } : c)) }))
    );
    setFlights((prev) =>
      prev.map((f) => (f.id !== flightId ? f : { ...f, cajas: f.cajas.map((c) => (c.id === toId ? { ...c, paquetes: [...c.paquetes, pid] } : c)) }))
    );
  }

  return (
    <Section title="Armado de cajas">
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Seleccionar carga" required>
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={flightId}
            onChange={(e) => {
              const id = e.target.value;
              setFlightId(id);
              setActiveBoxId(null);
              setEditingId(null);
            }}
          >
            <option value="">—</option>
            {flights
              .filter((f) => f.estado === "En bodega")
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.codigo} · {f.fecha_salida}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Escanear / ingresar codigo">
          <Input value={scan} onChange={(e) => setScan(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && assign()} placeholder="BOSSBOX1" />
        </Field>

        <div className="flex items-end">
          <button onClick={addBox} disabled={!flight} className="px-3 py-2 bg-gray-800 text-white rounded-xl disabled:opacity-50">
            Agregar caja
          </button>
        </div>

        <div className="md:col-span-3">
          {!flight && <div className="text-gray-500">Selecciona una carga.</div>}

          {flight &&
            cajas.map((c) => {
              const isActive = c.id === activeBoxId;
              const isEditing = c.id === editingId;

              const couriers = new Set(
                (c.paquetes || []).map((pid) => packages.find((p) => p.id === pid)?.courier).filter(Boolean)
              );
              const etiqueta = couriers.size === 0 ? "—" : couriers.size === 1 ? [...couriers][0] : "MULTICOURIER";

              const peso = parseComma(c.peso || "0");
              const L = parseIntEU(c.L || 0),
                A = parseIntEU(c.A || 0),
                H = parseIntEU(c.H || 0);

              return (
                <div
                  key={c.id}
                  onClick={() => setActiveBoxId(c.id)}
                  className={
                    "border rounded-2xl p-3 mb-3 hover:ring-2 hover:ring-indigo-300 cursor-pointer " + (isActive ? "ring-2 ring-indigo-500" : "")
                  }
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">
                      {c.codigo} — {etiqueta} — <span className="font-semibold">{fmtPeso(peso)} kg</span> — {L}x{A}x{H} cm
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="px-2 py-1 border rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          reorderBox(c.id, "up");
                        }}
                      >
                        ↑
                      </button>
                      <button
                        className="px-2 py-1 border rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          reorderBox(c.id, "down");
                        }}
                      >
                        ↓
                      </button>
                      {!isEditing ? (
                        <button
                          className="px-2 py-1 border rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(c.id);
                          }}
                        >
                          Editar
                        </button>
                      ) : (
                        <button
                          className="px-2 py-1 border rounded bg-indigo-600 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            saveBox(c.id);
                          }}
                        >
                          Guardar
                        </button>
                      )}
                      <button
                        className="px-2 py-1 border rounded text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBox(c.id);
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="grid md:grid-cols-4 gap-2 mb-2">
                      <Field label="Nombre de caja">
                        <Input value={c.codigo} onChange={(e) => updBox(c.id, { codigo: e.target.value })} />
                      </Field>
                      <Field label="Peso caja (kg)">
                        <Input value={c.peso || ""} onChange={(e) => updBox(c.id, { peso: e.target.value })} placeholder="3,128" />
                      </Field>
                      <Field label="Largo (cm)">
                        <Input value={c.L || ""} onChange={(e) => updBox(c.id, { L: e.target.value })} />
                      </Field>
                      <Field label="Ancho (cm)">
                        <Input value={c.A || ""} onChange={(e) => updBox(c.id, { A: e.target.value })} />
                      </Field>
                      <Field label="Alto (cm)">
                        <Input value={c.H || ""} onChange={(e) => updBox(c.id, { H: e.target.value })} />
                      </Field>
                    </div>
                  )}

                  <ul className="text-sm max-h-48 overflow-auto">
                    {(c.paquetes || []).map((pid) => {
                      const p = packages.find((x) => x.id === pid);
                      if (!p) return null;
                      return (
                        <li key={pid} className="flex items-center gap-2 py-1 border-b">
                          <span className="font-mono">{p.codigo}</span>
                          <span className="text-gray-600">{p.courier}</span>
                          <button
                            className="text-red-600 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              updBox(c.id, { paquetes: c.paquetes.filter((z) => z !== pid) });
                            }}
                          >
                            Quitar
                          </button>
                          {cajas.length > 1 && (
                            <select
                              className="text-xs border rounded px-1 py-0.5 ml-auto"
                              defaultValue=""
                              onChange={(e) => {
                                e.stopPropagation();
                                move(pid, c.id, e.target.value);
                              }}
                            >
                              <option value="" disabled>
                                Mover a…
                              </option>
                              {cajas
                                .filter((x) => x.id !== c.id)
                                .map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.codigo}
                                  </option>
                                ))}
                            </select>
                          )}
                        </li>
                      );
                    })}
                    {(c.paquetes || []).length === 0 && <li className="text-gray-500">—</li>}
                  </ul>
                </div>
              );
            })}
        </div>
      </div>
    </Section>
  );
}

/* ===== Cargas enviadas (resumen + XLSX) ===== */
function CargasEnviadas({ packages, flights }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [estado, setEstado] = useState("");
  const [flightId, setFlightId] = useState("");
  const list = flights.filter((f) => f.estado !== "En bodega").filter((f) => (!from || f.fecha_salida >= from) && (!to || f.fecha_salida <= to) && (!estado || f.estado === estado));
  const flight = flights.find((f) => f.id === flightId);

  const resumen = useMemo(() => {
    if (!flight) return [];
    return flight.cajas.map((c, i) => {
      const peso = parseComma(c.peso || "0");
      const L = parseIntEU(c.L || 0),
        A = parseIntEU(c.A || 0),
        H = parseIntEU(c.H || 0);
      const vol = (A * H * L) / 6000 || 0;
      const couriers = new Set(c.paquetes.map((pid) => packages.find((p) => p.id === pid)?.courier).filter(Boolean));
      const etiqueta = couriers.size === 0 ? "—" : couriers.size === 1 ? [...couriers][0] : "MULTICOURIER";
      return { n: i + 1, courier: etiqueta, peso, L, A, H, vol };
    });
  }, [flight, packages]);
  const totPeso = sum(resumen.map((r) => r.peso));
  const totVol = sum(resumen.map((r) => r.vol));

  async function exportTodo() {
    if (!flight) return;
    const headerP = [th("COURIER"), th("CODIGO"), th("CASILLA"), th("FECHA"), th("NOMBRE"), th("TRACKING"), th("PESO REAL"), th("FACTURABLE"), th("VOLUMETRICO"), th("EXCESO"), th("DESCRIPCION")];
    const bodyP = packages
      .filter((p) => p.flight_id === flightId)
      .map((p) => [td(p.courier), td(p.codigo), td(p.casilla), td(p.fecha), td(p.nombre_apellido), td(p.tracking), td(fmtPeso(p.peso_real)), td(fmtPeso(p.peso_facturable)), td(fmtPeso(p.peso_volumetrico)), td(fmtPeso(p.exceso_volumen)), td(p.descripcion)]);

    const tpl = await tryLoadTemplate("/templates/cargas_enviadas.xlsx");
    if (tpl) {
      replacePlaceholdersInWB(tpl, { CARGA: flight.codigo, FECHA: flight.fecha_salida || "" });
      appendSheet(tpl, "PAQUETES", [headerP, ...bodyP], {
        cols: [{ wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 28 }],
      });
      appendSheet(tpl, "CAJAS", [[th("Nº Caja"), th("Courier"), th("Peso"), th("Largo"), th("Ancho"), th("Alto"), th("Volumetrico")], ...resumen.map((r) => [td(r.n), td(r.courier), td(fmtPeso(r.peso)), td(String(r.L)), td(String(r.A)), td(String(r.H)), td(fmtPeso(r.vol))]), [td(""), td("Totales"), td(fmtPeso(totPeso)), "", "", "", td(fmtPeso(totVol))]]);
      XLSX.writeFile(tpl, `Detalle_${flight.codigo}.xlsx`);
      return;
    }

    const shP = sheetFromAOAStyled("Paquetes", [headerP, ...bodyP], {
      cols: [{ wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 28 }],
      rows: [{ hpt: 26 }],
    });
    const shC = sheetFromAOAStyled("Cajas", [[th("Nº Caja"), th("Courier"), th("Peso"), th("Largo"), th("Ancho"), th("Alto"), th("Volumetrico")], ...resumen.map((r) => [td(r.n), td(r.courier), td(fmtPeso(r.peso)), td(String(r.L)), td(String(r.A)), td(String(r.H)), td(fmtPeso(r.vol))]), [td(""), td("Totales"), td(fmtPeso(totPeso)), "", "", "", td(fmtPeso(totVol))]]);
    downloadXLSX(`Detalle_${flight.codigo}.xlsx`, [shP, shC]);
  }

  return (
    <Section title="Cargas enviadas">
      <div className="grid md:grid-cols-5 gap-3">
        <Field label="Desde">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Estado">
          <select className="w-full rounded-xl border px-3 py-2" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            <option>En transito</option>
            <option>Arribado</option>
          </select>
        </Field>
        <Field label="Carga">
          <select className="w-full rounded-xl border px-3 py-2" value={flightId} onChange={(e) => setFlightId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {list.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo} · {f.fecha_salida} · {f.estado}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end">
          <button onClick={exportTodo} disabled={!flight} className={BTN_PRIMARY + " w-full disabled:opacity-50"}>
            Exportar XLSX
          </button>
        </div>
      </div>

      {!flight ? (
        <div className="text-gray-500 mt-4">Elegi una carga para ver contenido.</div>
      ) : (
        <>
          <div className="mt-4 text-sm text-gray-600">
            Paquetes del vuelo <b>{flight.codigo}</b>
          </div>
          <div className="overflow-auto mb-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {["Courier", "Codigo", "Casilla", "Fecha", "Nombre", "Tracking", "Peso real", "Facturable", "Volumetrico", "Exceso"].map((h) => (
                    <th key={h} className="text-left px-3 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {packages
                  .filter((p) => p.flight_id === flightId)
                  .map((p) => (
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
              <thead>
                <tr className="bg-gray-50">
                  {["Nº Caja", "Courier", "Peso", "Largo", "Ancho", "Alto", "Volumetrico"].map((h) => (
                    <th key={h} className="text-left px-3 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumen.map((r) => (
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
                <tr>
                  <td></td>
                  <td className="px-3 py-2 font-semibold">Totales</td>
                  <td className="px-3 py-2 font-semibold">{fmtPeso(totPeso)}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td className="px-3 py-2 font-semibold">{fmtPeso(totVol)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  );
}

/* ===== Proformas (usa plantilla con colores) ===== */
const TARIFAS = { proc: 5, real: 9, exc: 9, despacho: 10 }; // USD
const canjeGuiaUSD = (kg) => (kg <= 5 ? 10 : kg <= 10 ? 13.5 : kg <= 30 ? 17 : kg <= 50 ? 37 : kg <= 100 ? 57 : 100);

function Proformas({ packages, flights, extras }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [flightId, setFlightId] = useState("");
  const list = flights.filter((f) => (!from || f.fecha_salida >= from) && (!to || f.fecha_salida <= to));
  const flight = flights.find((f) => f.id === flightId);

  const porCourier = useMemo(() => {
    if (!flight) return [];
    const m = new Map();
    flight.cajas.forEach((c) =>
      c.paquetes.forEach((pid) => {
        const p = packages.find((x) => x.id === pid);
        if (!p) return;
        if (!m.has(p.courier)) m.set(p.courier, { courier: p.courier, kg_real: 0, kg_fact: 0, kg_exc: 0 });
        const a = m.get(p.courier);
        a.kg_real += p.peso_real;
        a.kg_fact += p.peso_facturable;
        a.kg_exc += p.exceso_volumen;
      })
    );
    return Array.from(m.values());
  }, [flight, packages]);

  const extrasDeCourier = (courier) => extras.filter((e) => e.flight_id === flightId && e.courier === courier);

  // escribe directo en la hoja "Factura" del template manteniendo colores
  function writeFacturaSheet(wb, r) {
    const ws = wb.Sheets["Factura"];
    if (!ws) return;

    // Fecha (A9) y Courier (A12) — posiciones segun tu plantilla
    ws["A9"] = { v: flight?.fecha_salida || "", t: "s", s: ws["A9"]?.s || {} };
    ws["A12"] = { v: r.courier, t: "s", s: ws["A12"]?.s || {} };

    // Detalle: fila 16 en adelante
    const start = 16;
    const fmtQty = "#,##0.000";
    const fmtMoney = "#,##0.00";

    // limpiar 16..(16+20) para evitar residuos
    for (let i = 0; i < 30; i++) {
      ["A", "B", "C", "D"].forEach((col) => {
        const addr = `${col}${start + i}`;
        if (ws[addr]) ws[addr].v = "";
      });
    }

    const lines = [];
    const proc = r.kg_fact * TARIFAS.proc;
    const fr = r.kg_real * TARIFAS.real;
    const fe = r.kg_exc * TARIFAS.exc;
    const desp = r.kg_fact * TARIFAS.despacho;
    const canje = canjeGuiaUSD(r.kg_fact);

    lines.push(["Procesamiento", r.kg_fact, TARIFAS.proc, proc]);
    lines.push(["Flete peso real", r.kg_real, TARIFAS.real, fr]);
    lines.push(["Flete exceso de volumen", r.kg_exc, TARIFAS.exc, fe]);
    lines.push(["Servicio de despacho", r.kg_fact, TARIFAS.despacho, desp]);
    lines.push(["Comision por canje de guia", 1, canje, canje]);

    // 5 filas “slots” para extras (luego pueden ocuparlas)
    const extrasList = extrasDeCourier(r.courier);
    const comisionBase = 0.04 * (proc + fr + fe + extrasList.reduce((s, e) => s + parseComma(e.monto), 0));
    lines.push(["Comision por transferencia (4%)", 0, 0, comisionBase]);

    // reservar 5 filas vacias
    for (let i = 0; i < 5; i++) lines.push(["", "", "", ""]);

    // extras => cantidad 1.000 y unitario = total
    extrasList.forEach((e) => {
      const total = parseComma(e.monto);
      lines.push([e.descripcion, 1, total, total]);
    });

    // escribir lineas
    lines.forEach((ln, idx) => {
      const row = start + idx;
      const [desc, qty, unit, total] = ln;
      ws[`A${row}`] = { v: desc, t: "s", s: ws[`A${row}`]?.s || {} };
      ws[`B${row}`] = { v: typeof qty === "number" ? qty : qty || "", t: "n", z: fmtQty, s: ws[`B${row}`]?.s || {} };
      ws[`C${row}`] = { v: typeof unit === "number" ? unit : unit || "", t: "n", z: fmtMoney, s: ws[`C${row}`]?.s || {} };
      ws[`D${row}`] = { v: typeof total === "number" ? total : total || "", t: "n", z: fmtMoney, s: ws[`D${row}`]?.s || {} };
    });

    // Total USD (fila 22, columna D) y etiqueta en A22
    const totalNum = lines.reduce((s, ln) => s + (Number(ln[3]) || 0), 0);
    ws["A22"] = { v: "TOTAL USD", t: "s", s: ws["A22"]?.s || {} };
    ws["D22"] = { v: totalNum, t: "n", z: fmtMoney, s: ws["D22"]?.s || {} };

    // Logo centrado: usamos celda B2 con =IMAGE(url, , 1) y que el merge/alineacion del template lo centre
    const logoUrl = `${location.origin}/logo.png`;
    ws["B2"] = { t: "n", f: `IMAGE("${logoUrl}",,1)` };
  }

  async function exportX(r) {
    const tpl = await tryLoadTemplate("/templates/proforma.xlsx");
    if (tpl) {
      // placeholder simples
      replacePlaceholdersInWB(tpl, {
        FECHA: flight?.fecha_salida || new Date().toISOString().slice(0, 10),
        COURIER: r.courier,
        LOGO: `${location.origin}/logo.png`,
      });
      writeFacturaSheet(tpl, r);
      XLSX.writeFile(tpl, `proforma_${(flight?.codigo || "carga")}_${r.courier}.xlsx`);
      return;
    }

    // Fallback (sin plantilla, pero con algo de estilo)
    const proc = r.kg_fact * TARIFAS.proc;
    const fr = r.kg_real * TARIFAS.real;
    const fe = r.kg_exc * TARIFAS.exc;
    const desp = r.kg_fact * TARIFAS.despacho;
    const canje = canjeGuiaUSD(r.kg_fact);
    const extrasList = extrasDeCourier(r.courier);
    const extrasMonto = extrasList.reduce((s, e) => s + parseComma(e.monto), 0);
    const com = 0.04 * (proc + fr + fe + extrasMonto);
    const total = proc + fr + fe + desp + canje + extrasMonto + com;

    const rows = [
      [td("Europa Envios")],
      [td("LAMAQUINALOGISTICA, SOCIEDAD LIMITADA")],
      [td("N.I.F.: B56340656")],
      [td("CALLE ESTEBAN SALAZAR CHAPELA, NUM 20, PUERTA 87, NAVE 87")],
      [td("29004 MALAGA (ESPANA)")],
      [td("(34) 633 74 08 31")],
      [td("")],
      [th("Factura Proforma")],
      [td("Fecha: " + (flight?.fecha_salida || new Date().toISOString().slice(0, 10)))],
      [td("")],
      [th("Cliente"), th(""), th("Forma de pago"), th(""), th("Nº factura")],
      [td(r.courier), td(""), td(""), td(""), td("—")],
      [td("")],
      [td("")],
      [th("Descripcion"), th("Cantidad"), th("Precio unitario"), th("Precio total")],
      [td("Procesamiento"), td(fmtPeso(r.kg_fact)), td(fmt2(TARIFAS.proc)), td(fmt2(proc))],
      [td("Flete peso real"), td(fmtPeso(r.kg_real)), td(fmt2(TARIFAS.real)), td(fmt2(fr))],
      [td("Flete exceso de volumen"), td(fmtPeso(r.kg_exc)), td(fmt2(TARIFAS.exc)), td(fmt2(fe))],
      [td("Servicio de despacho"), td(fmtPeso(r.kg_fact)), td(fmt2(TARIFAS.despacho)), td(fmt2(desp))],
      [td("Comision por canje de guia"), td("1,000"), td(fmt2(canje)), td(fmt2(canje))],
      ...extrasList.map((e) => [td(e.descripcion), td("1,000"), td(fmt2(parseComma(e.monto))), td(fmt2(parseComma(e.monto)))]),
      [td("Comision por transferencia (4%)"), td(""), td(""), td(fmt2(com))],
      [th("TOTAL USD"), th(""), th(""), th(fmt2(total))],
    ];
    const { ws } = sheetFromAOAStyled("Factura", rows, { cols: [{ wch: 40 }, { wch: 12 }, { wch: 16 }, { wch: 16 }], rows: [{ hpt: 26 }] });
    downloadXLSX(`proforma_${(flight?.codigo || "carga")}_${r.courier}.xlsx`, [{ name: "Factura", ws }]);
  }

  return (
    <Section
      title="Proformas por courier"
      right={
        <div className="flex gap-2 items-end">
          <Field label="Desde">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <select className="rounded-xl border px-3 py-2" value={flightId} onChange={(e) => setFlightId(e.target.value)}>
            <option value="">Seleccionar carga…</option>
            {list.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo} · {f.fecha_salida}
              </option>
            ))}
          </select>
        </div>
      }
    >
      {!flight ? (
        <div className="text-gray-500">Selecciona una carga.</div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {["Courier", "Kg facturable", "Kg exceso", "TOTAL USD", "XLSX"].map((h) => (
                  <th key={h} className="text-left px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {porCourier.map((r) => {
                const proc = r.kg_fact * TARIFAS.proc,
                  fr = r.kg_real * TARIFAS.real,
                  fe = r.kg_exc * TARIFAS.exc,
                  desp = r.kg_fact * TARIFAS.despacho;
                const extrasMonto = extrasDeCourier(r.courier).reduce((s, e) => s + parseComma(e.monto), 0);
                const com = 0.04 * (proc + fr + fe + extrasMonto);
                const tot = proc + fr + fe + desp + canjeGuiaUSD(r.kg_fact) + extrasMonto + com;
                return (
                  <tr key={r.courier} className="border-b">
                    <td className="px-3 py-2">{r.courier}</td>
                    <td className="px-3 py-2">{fmtPeso(r.kg_fact)} kg</td>
                    <td className="px-3 py-2">{fmtPeso(r.kg_exc)} kg</td>
                    <td className="px-3 py-2 font-semibold">{fmt2(tot)}</td>
                    <td className="px-3 py-2">
                      <button className="px-2 py-1 border rounded" onClick={() => exportX(r)}>
                        Descargar
                      </button>
                    </td>
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
function Extras({ flights, couriers, extras, setExtras }) {
  const [flightId, setFlightId] = useState("");
  const [courier, setCourier] = useState("");
  const [desc, setDesc] = useState("");
  const [monto, setMonto] = useState("");
  const [estado, setEstado] = useState("Pendiente");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const add = () => {
    if (!(flightId && courier && desc && monto)) return;
    setExtras([...extras, { id: uuid(), flight_id: flightId, courier, descripcion: desc, monto, estado, fecha }]);
    setDesc("");
    setMonto("");
  };
  const filtered = extras
    .filter((e) => !from || (e.fecha || flights.find((f) => f.id === e.flight_id)?.fecha_salida || "") >= from)
    .filter((e) => !to || (e.fecha || flights.find((f) => f.id === e.flight_id)?.fecha_salida || "") <= to)
    .filter((e) => !flightId || e.flight_id === flightId);

  const upd = (id, patch) => setExtras(extras.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const del = (id) => setExtras(extras.filter((e) => e.id !== id));

  return (
    <Section title="Trabajos extras">
      <div className="grid md:grid-cols-6 gap-2 mb-2">
        <Field label="Carga">
          <select className="w-full rounded-xl border px-3 py-2" value={flightId} onChange={(e) => setFlightId(e.target.value)}>
            <option value="">—</option>
            {flights.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Courier">
          <select className="w-full rounded-xl border px-3 py-2" value={courier} onChange={(e) => setCourier(e.target.value)}>
            <option value="">—</option>
            {couriers.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Descripcion">
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <Field label="Monto (USD)">
          <Input value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="10,00" />
        </Field>
        <Field label="Estado">
          <select className="w-full rounded-xl border px-3 py-2" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option>Pendiente</option>
            <option>Cobrado</option>
          </select>
        </Field>
        <Field label="Fecha">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end mb-4">
        <button onClick={add} className={BTN_PRIMARY}>
          Agregar
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-2 mb-3">
        <Field label="Filtrar desde">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Filtrar hasta">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <div />
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {["Fecha", "Carga", "Courier", "Descripcion", "Monto (USD)", "Estado", "Acciones"].map((h) => (
                <th key={h} className="text-left px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const carga = flights.find((f) => f.id === e.flight_id)?.codigo || "";
              return (
                <tr key={e.id} className="border-b">
                  <td className="px-3 py-2">{e.fecha || flights.find((f) => f.id === e.flight_id)?.fecha_salida || ""}</td>
                  <td className="px-3 py-2">{carga}</td>
                  <td className="px-3 py-2">{e.courier}</td>
                  <td className="px-3 py-2">
                    <Input value={e.descripcion} onChange={(ev) => upd(e.id, { descripcion: ev.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input value={e.monto} onChange={(ev) => upd(e.id, { monto: ev.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <select className="border rounded px-2 py-1" value={e.estado} onChange={(ev) => upd(e.id, { estado: ev.target.value })}>
                      <option>Pendiente</option>
                      <option>Cobrado</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <button className="px-2 py-1 border rounded" onClick={() => del(e.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-500 py-6">
                  Sin extras.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ===== App raiz ===== */
export default function App() {
  const [tab, setTab] = useState("Recepcion");
  const [currentUser, setCurrentUser] = useState(null);

  const [couriers, setCouriers] = useState(COURIERS_INICIALES);
  const [estados, setEstados] = useState(ESTADOS_INICIALES);

  const [flights, setFlights] = useState([]);
  const [packages, setPackages] = useState([]);
  const [extras, setExtras] = useState([]);

  const onAddPackage = (p) => setPackages([p, ...packages]);
  const onUpdatePackage = (p) => setPackages(packages.map((x) => (x.id === p.id ? p : x)));

  useEffect(() => {
    document.title = "Gestor de Paquetes";
  }, []);

  if (!currentUser) return <Login onLogin={setCurrentUser} />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* header */}
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Gestor de Paquetes</div>
            <div className="text-xs text-gray-500">LaMaquinaLogistica / Europa Envios</div>
          </div>
          <div className="text-sm text-gray-600">
            {currentUser.role} — {currentUser.email}
          </div>
        </div>
        <div className="mt-3">
          <Tabs
            tabs={["Recepcion", "Paquetes en bodega", "Armado de cajas", "Cargas enviadas", "Gestion de cargas", "Proformas", "Extras"]}
            current={tab}
            onChange={setTab}
          />
        </div>
      </div>

      {/* contenido */}
            <div className="p-6">
        {tab === "Recepcion" && (
          <Reception
            currentUser={currentUser}
            couriers={couriers}
            setCouriers={setCouriers}
            estados={estados}
            setEstados={setEstados}
            flights={flights}
            onAdd={onAddPackage}
          />
        )}

        {tab === "Paquetes en bodega" && (
          <PaquetesBodega
            packages={packages}
            flights={flights}
            user={currentUser}
            onUpdate={onUpdatePackage}
          />
        )}

        {tab === "Armado de cajas" && (
          <ArmadoCajas
            packages={packages}
            flights={flights}
            setFlights={setFlights}
            onAssign={(pid) =>
              setPackages((prev) =>
                prev.map((p) =>
                  p.id === pid ? { ...p, estado_bodega: "Armado" } : p
                )
              )
            }
          />
        )}

        {tab === "Cargas enviadas" && (
          <CargasEnviadas packages={packages} flights={flights} />
        )}

        {tab === "Gestion de cargas" && (
          <CargasAdmin
            flights={flights}
            setFlights={setFlights}
            packages={packages}
          />
        )}

        {tab === "Proformas" && (
          <Proformas packages={packages} flights={flights} extras={extras} />
        )}

        {tab === "Extras" && (
          <Extras
            flights={flights}
            couriers={couriers}
            extras={extras}
            setExtras={setExtras}
          />
        )}
      </div>
    </div>
  );
}

       
