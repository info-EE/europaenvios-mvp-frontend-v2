/*  Europa Envíos – MVP (v2 + fixes uuid + ErrorBoundary)
    - Formatos: peso 3 decimales con coma, precio 2 decimales con coma
    - XLSX con xlsx-js-style y etiquetas con JsBarcode
*/
import React, { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import * as XLSX from "xlsx-js-style";
import JsBarcode from "jsbarcode";

/* ===== UUID seguro en todos los navegadores ===== */
const uuid = () => {
  try {
    if (
      typeof window !== "undefined" &&
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }
  } catch {}
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

/* ===== ErrorBoundary para evitar pantalla blanca ===== */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error(error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "sans-serif" }}>
          <h2>Se produjo un error en la aplicación</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{String(this.state.error)}</pre>
          <p>Revisá la consola del navegador para más detalle.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/* =================== UTILIDADES =================== */
// Parsear texto con coma como decimal (y opcional miles) -> número JS
const parseComma = (txt) => {
  if (txt === null || txt === undefined) return 0;
  const s = String(txt).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
// Formatos con coma
const fmtPeso = (n) => Number(n || 0).toFixed(3).replace(".", ",");
const fmtMoney = (n) => Number(n || 0).toFixed(2).replace(".", ",");

const sum = (arr) => arr.reduce((s, a) => s + Number(a || 0), 0);
const COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#8B5CF6",
  "#14B8A6",
  "#84CC16",
  "#F97316",
];

// Tarifa y funciones de proforma
const T = { proc: 5, fleteReal: 9, fleteExc: 9, despacho: 10 };
const canjeGuiaUSD = (kg) =>
  kg <= 5 ? 10 : kg <= 10 ? 13.5 : kg <= 30 ? 17 : kg <= 50 ? 37 : kg <= 100 ? 57 : 100;

// XLSX helpers
const th = (txt) => ({
  v: txt,
  t: "s",
  s: {
    font: { bold: true, color: { rgb: "FFFFFFFF" } },
    fill: { fgColor: { rgb: "FF1F2937" } },
    alignment: { horizontal: "center" },
    border: _bd(),
  },
});
const td = (v) => ({ v, t: "s", s: { border: _bd() } });
const _bd = () => ({
  top: { style: "thin", color: { rgb: "FF9CA3AF" } },
  bottom: { style: "thin", color: { rgb: "FF9CA3AF" } },
  left: { style: "thin", color: { rgb: "FF9CA3AF" } },
  right: { style: "thin", color: { rgb: "FF9CA3AF" } },
});

// crea hoja desde AOA con estilos
function sheetFromAOAStyled(name, rows) {
  const ws = XLSX.utils.aoa_to_sheet(
    rows.map((r) =>
      r.map((c) => (typeof c === "object" && c.v !== undefined ? c : td(String(c ?? ""))))
    )
  );
  return { name, ws };
}
function downloadXLSX(filename, sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, ws }) => XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)));
  XLSX.writeFile(wb, filename);
}

/* =================== DATOS INICIALES =================== */
const ESTADOS_INICIALES = ["Aéreo", "Marítimo", "Ofrecer marítimo"];
const COURIERS_INICIALES = [
  "Aladín",
  "Boss Box",
  "Buzón",
  "Caba Box",
  "Click Box",
  "Easy Box",
  "Europa Envíos",
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
const ESTADOS_CARGA = ["En bodega", "En tránsito", "Arribado"];

/* =================== COMPONENTES UI =================== */
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

const Input = (props) => (
  <input
    {...props}
    className={
      "w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 ring-indigo-500 " +
      (props.className || "")
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
          "px-3 py-2 rounded-xl text-sm " +
          (current === t ? "bg-indigo-600 text-white" : "bg-white border")
        }
      >
        {t}
      </button>
    ))}
  </div>
);

// Gestor simple para agregar/borrar valores de una lista (Couriers/Estados)
function ManageList({ label, items, setItems }) {
  const [txt, setTxt] = useState("");
  const add = () => {
    const v = txt.trim();
    if (!v) return;
    if (!items.includes(v)) setItems([...items, v]);
    setTxt("");
  };
  const del = (v) => setItems(items.filter((x) => x !== v));
  return (
    <div className="bg-gray-50 rounded-xl p-2">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className="flex gap-2">
        <Input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Nuevo…" />
        <button onClick={add} className="px-3 py-2 bg-gray-800 text-white rounded-xl">
          Agregar
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {items.map((v) => (
          <span key={v} className="text-xs bg-white border rounded-xl px-2 py-1">
            {v}{" "}
            <button onClick={() => del(v)} className="text-red-600 ml-1">
              ✕
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

/* =================== LOGIN =================== */
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
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@empresa.com"
          />
        </Field>
        <Field label="Rol" required>
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
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
          className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 disabled:opacity-50"
        >
          Entrar
        </button>
      </div>
    </div>
  );
}

/* =================== GESTIÓN DE CARGAS =================== */
function CargasAdmin({ flights, setFlights }) {
  const [code, setCode] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [awb, setAwb] = useState("");
  const [fac, setFac] = useState("");

  function create() {
    if (!code) return;
    setFlights([
      {
        id: uuid(),
        codigo: code,
        fecha_salida: date,
        estado: "En bodega",
        awb,
        factura_cacesa: fac,
        cajas: [],
      },
      ...flights,
    ]);
    setCode("");
    setAwb("");
    setFac("");
  }
  function upd(id, field, value) {
    setFlights(flights.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  }
  return (
    <Section
      title="Gestión de cargas"
      right={
        <div className="flex gap-2">
          <Input
            placeholder="Código de carga (ej. EE250905)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input placeholder="AWB (opcional)" value={awb} onChange={(e) => setAwb(e.target.value)} />
          <Input
            placeholder="Factura Cacesa (opcional)"
            value={fac}
            onChange={(e) => setFac(e.target.value)}
          />
          <button onClick={create} className="px-3 py-2 bg-indigo-600 text-white rounded-xl">
            Crear
          </button>
        </div>
      }
    >
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {["Código", "Fecha salida", "Estado", "AWB", "Factura Cacesa", "Cajas"].map((h) => (
                <th key={h} className="text-left px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flights.map((f) => (
              <tr key={f.id} className="border-b">
                <td className="px-3 py-2">
                  <Input value={f.codigo} onChange={(e) => upd(f.id, "codigo", e.target.value)} />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="date"
                    value={f.fecha_salida}
                    onChange={(e) => upd(f.id, "fecha_salida", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    className="border rounded px-2 py-1"
                    value={f.estado}
                    onChange={(e) => upd(f.id, "estado", e.target.value)}
                  >
                    {ESTADOS_CARGA.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <Input value={f.awb || ""} onChange={(e) => upd(f.id, "awb", e.target.value)} />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={f.factura_cacesa || ""}
                    onChange={(e) => upd(f.id, "factura_cacesa", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">{f.cajas.length}</td>
              </tr>
            ))}
            {flights.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-500 py-6">
                  Aún no hay cargas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* =================== RECEPCIÓN =================== */
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
    largo_txt: "",
    ancho_txt: "",
    alto_txt: "",
    desc: "",
    valor_txt: "0,00",
    foto: null,
  });
  // Números
  const peso = parseComma(form.peso_real_txt),
    L = parseComma(form.largo_txt),
    A = parseComma(form.ancho_txt),
    H = parseComma(form.alto_txt);
  const fact = Math.max(0.2, peso || 0);
  const vol = A && H && L ? (A * H * L) / 5000 : 0;
  const exc = Math.max(0, vol - fact);

  // Autocódigo según carga+courier
  const flight = flights.find((f) => f.id === flightId);
  const limpiar = (s) => String(s || "").toUpperCase().replace(/\s+/g, "");
  useEffect(() => {
    if (!flight || !form.courier) return;
    const key = "seq_" + limpiar(form.courier);
    const next = (Number(localStorage.getItem(key)) || 0) + 1;
    const n = next > 999 ? 1 : next;
    const codigo = `${flight.codigo}-${limpiar(form.courier)}${n}`;
    setForm((f) => ({ ...f, codigo }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightId, form.courier]);

  // Guardar paquete
  const allReq = () =>
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
      "largo_txt",
      "ancho_txt",
      "alto_txt",
      "desc",
      "valor_txt",
    ].every((k) => String(form[k] || "").trim() !== "");
  const submit = () => {
    if (!allReq()) {
      alert("Faltan campos.");
      return;
    }
    // persistir correlativo
    const key = "seq_" + limpiar(form.courier);
    let cur = (Number(localStorage.getItem(key)) || 0) + 1;
    if (cur > 999) cur = 1;
    localStorage.setItem(key, String(cur));
    const p = {
      id: uuid(),
      flight_id: flightId,
      courier: form.courier,
      estado: form.estado,
      casilla: form.casilla,
      codigo: form.codigo,
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
      largo_txt: "",
      ancho_txt: "",
      alto_txt: "",
      desc: "",
      valor_txt: "0,00",
      foto: null,
    });
  };

  // Foto
  const onPickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, foto: reader.result }));
    reader.readAsDataURL(file);
  };

  // Imprimir etiqueta (código de barras + datos)
  const printLabel = () => {
    if (!(form.codigo && form.desc)) {
      alert("Completá al menos Código y Descripción.");
      return;
    }
    const w = window.open("", "_blank");
    w.document.write(`
      <html><head><meta charset="utf-8"><title>Etiqueta</title>
      <style>body{font-family:Arial;margin:20px} .box{border:1px solid #111;padding:12px;width:360px}
      .row{margin:6px 0} .b{font-weight:bold}</style></head><body>
      <div class="box">
        <div class="row b">Código: ${form.codigo}</div>
        <div class="row"><svg id="bc"></svg></div>
        <div class="row">Peso: ${fmtPeso(peso)} kg</div>
        <div class="row">Medidas: ${fmtPeso(L)}×${fmtPeso(A)}×${fmtPeso(H)} cm</div>
        <div class="row">Desc: ${form.desc}</div>
      </div>
      <script>
        window.addEventListener('load', ()=> {
          (${JsBarcode.toString})(document.getElementById('bc'), '${form.codigo}', {format:'CODE128', displayValue:false, height:50});
          window.print(); setTimeout(()=>window.close(), 300);
        });
      </script></body></html>
    `);
    w.document.close();
  };

  // Gestión listas (editable)
  const [showMgr, setShowMgr] = useState(false);

  return (
    <Section
      title="Recepción de paquete"
      right={
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 border rounded-xl" onClick={() => setShowMgr((s) => !s)}>
            Gestionar listas
          </button>
          <span className="text-sm text-gray-500">Todos los campos son obligatorios</span>
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
        <Field label="Código de carga (solo En bodega)" required>
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={flightId}
            onChange={(e) => setFlightId(e.target.value)}
          >
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
            {couriers.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Estado" required>
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={form.estado}
            onChange={(e) => setForm({ ...form, estado: e.target.value })}
          >
            <option value="">Seleccionar…</option>
            {estados.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>

        <Field label="Casilla" required>
          <Input value={form.casilla} onChange={(e) => setForm({ ...form, casilla: e.target.value })} />
        </Field>
        <Field label="Nº de paquete (código)" required>
          <Input
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
            placeholder="EE250905-BOSSBOX1"
          />
        </Field>
        <Field label="Fecha" required>
          <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
        </Field>

        <Field label="Empresa de envío" required>
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
          <Input
            value={form.peso_real_txt}
            onChange={(e) => setForm({ ...form, peso_real_txt: e.target.value })}
            placeholder="3,128"
          />
        </Field>
        <Field label="Largo (cm)" required>
          <Input
            value={form.largo_txt}
            onChange={(e) => setForm({ ...form, largo_txt: e.target.value })}
            placeholder="50,0"
          />
        </Field>
        <Field label="Ancho (cm)" required>
          <Input
            value={form.ancho_txt}
            onChange={(e) => setForm({ ...form, ancho_txt: e.target.value })}
            placeholder="30,0"
          />
        </Field>
        <Field label="Alto (cm)" required>
          <Input
            value={form.alto_txt}
            onChange={(e) => setForm({ ...form, alto_txt: e.target.value })}
            placeholder="20,0"
          />
        </Field>

        <Field label="Descripción" required>
          <Input value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
        </Field>
        <Field label="Valor declarado (aerolínea) (EUR)" required>
          <Input
            value={form.valor_txt}
            onChange={(e) => setForm({ ...form, valor_txt: e.target.value })}
            placeholder="10,00"
          />
        </Field>
        <Field label="Foto del paquete">
          <input type="file" accept="image/*" capture="environment" onChange={onPickPhoto} />
        </Field>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-sm text-gray-600">Peso facturable (mín 0,200 kg)</div>
          <div className="text-2xl font-semibold">{fmtPeso(fact)} kg</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-sm text-gray-600">Peso volumétrico (A×H×L / 5000)</div>
          <div className="text-2xl font-semibold">{fmtPeso(vol)} kg</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <div className="text-sm text-gray-600">Exceso de volumen</div>
          <div className="text-2xl font-semibold">{fmtPeso(exc)} kg</div>
        </div>
      </div>

      <div className="flex justify-between mt-4">
        <button onClick={printLabel} className="px-4 py-2 border rounded-xl">
          Imprimir etiqueta
        </button>
        <button
          onClick={submit}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
        >
          Guardar paquete
        </button>
      </div>
    </Section>
  );
}

/* =================== PAQUETES EN BODEGA =================== */
function PaquetesBodega({ packages, flights, user, onUpdate }) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const vueloEsBodega = (p) => flights.find((f) => f.id === p.flight_id)?.estado === "En bodega";
  const rows = packages
    .filter((p) => vueloEsBodega(p) && (user.role !== "COURIER" || p.courier === user.courier))
    .filter((p) =>
      (p.codigo + p.casilla + p.tracking + p.nombre_apellido + p.courier)
        .toLowerCase()
        .includes(q.toLowerCase())
    );

  // editor como recepción
  const [form, setForm] = useState(null);
  const start = (p) => {
    setEditing(p.id);
    setForm({
      ...p,
      peso_real_txt: fmtPeso(p.peso_real),
      largo_txt: fmtPeso(p.largo),
      ancho_txt: fmtPeso(p.ancho),
      alto_txt: fmtPeso(p.alto),
      valor_txt: fmtMoney(p.valor_aerolinea),
    });
  };
  const save = () => {
    const upd = {
      ...form,
      peso_real: parseComma(form.peso_real_txt),
      largo: parseComma(form.largo_txt),
      ancho: parseComma(form.ancho_txt),
      alto: parseComma(form.alto_txt),
      valor_aerolinea: parseComma(form.valor_txt),
    };
    onUpdate(upd);
    setEditing(null);
  };

  function exportXLSX() {
    const header = [
      th("COURIER"),
      th("CÓDIGO"),
      th("CASILLA"),
      th("FECHA"),
      th("EMPRESA ENVIO"),
      th("NOMBRE Y APELLIDO"),
      th("TRACKING"),
      th("REMITENTE"),
      th("PESO REAL"),
      th("PESO FACTURABLE"),
      th("LARGO"),
      th("ANCHO"),
      th("ALTO"),
      th("PESO VOLUMÉTRICO"),
      th("EXCESO DE VOLUMEN"),
      th("DESCRIPCIÓN"),
      th("VALOR EUR"),
    ];
    const body = rows.map((p) => [
      td(p.courier),
      td(p.codigo),
      td(p.casilla),
      td(p.fecha),
      td(p.empresa_envio),
      td(p.nombre_apellido),
      td(p.tracking),
      td(p.remitente),
      td(fmtPeso(p.peso_real)),
      td(fmtPeso(p.peso_facturable)),
      td(fmtPeso(p.largo)),
      td(fmtPeso(p.ancho)),
      td(fmtPeso(p.alto)),
      td(fmtPeso(p.peso_volumetrico)),
      td(fmtPeso(p.exceso_volumen)),
      td(p.descripcion),
      td(fmtMoney(p.valor_aerolinea)),
    ]);
    const { ws } = sheetFromAOAStyled("Packing List", [header, ...body]);
    downloadXLSX("Paquetes_en_bodega.xlsx", [{ name: "Packing List", ws }]);
  }

  return (
    <Section
      title="Paquetes en bodega"
      right={
        <div className="flex gap-2">
          <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button onClick={exportXLSX} className="px-3 py-2 bg-gray-800 text-white rounded-xl">
            Exportar XLSX
          </button>
        </div>
      }
    >
      {/* listado */}
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {[
                "Courier",
                "Casilla",
                "Código",
                "Fecha",
                "Nombre",
                "Tracking",
                "Peso real",
                "Facturable",
                "Volumétrico",
                "Exceso",
                "Valor (EUR)",
                "Acciones",
              ].map((h) => (
                <th key={h} className="text-left px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) =>
              editing === p.id ? (
                <tr key={p.id} className="border-b">
                  <td className="px-3 py-2">
                    <Input
                      value={form.courier}
                      onChange={(e) => setForm({ ...form, courier: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={form.casilla}
                      onChange={(e) => setForm({ ...form, casilla: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={form.codigo}
                      onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={form.fecha}
                      onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={form.nombre_apellido}
                      onChange={(e) =>
                        setForm({ ...form, nombre_apellido: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={form.tracking}
                      onChange={(e) => setForm({ ...form, tracking: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={form.peso_real_txt}
                      onChange={(e) => setForm({ ...form, peso_real_txt: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={form.peso_facturable}
                      onChange={(e) =>
                        setForm({ ...form, peso_facturable: parseComma(e.target.value) })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={form.peso_volumetrico}
                      onChange={(e) =>
                        setForm({ ...form, peso_volumetrico: parseComma(e.target.value) })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={form.exceso_volumen}
                      onChange={(e) =>
                        setForm({ ...form, exceso_volumen: parseComma(e.target.value) })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={form.valor_txt}
                      onChange={(e) => setForm({ ...form, valor_txt: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button className="px-2 py-1 border rounded mr-2" onClick={save}>
                      Guardar
                    </button>
                    <button
                      className="px-2 py-1 border rounded"
                      onClick={() => setEditing(null)}
                    >
                      Cancelar
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="border-b">
                  <td className="px-3 py-2">{p.courier}</td>
                  <td className="px-3 py-2">{p.casilla}</td>
                  <td className="px-3 py-2 font-mono">{p.codigo}</td>
                  <td className="px-3 py-2">{p.fecha}</td>
                  <td className="px-3 py-2">{p.nombre_apellido}</td>
                  <td className="px-3 py-2 font-mono">{p.tracking}</td>
                  <td className="px-3 py-2">{fmtPeso(p.peso_real)}</td>
                  <td className="px-3 py-2">{fmtPeso(p.peso_facturable)}</td>
                  <td className="px-3 py-2">{fmtPeso(p.peso_volumetrico)}</td>
                  <td className="px-3 py-2">{fmtPeso(p.exceso_volumen)}</td>
                  <td className="px-3 py-2">{fmtMoney(p.valor_aerolinea)}</td>
                  <td className="px-3 py-2">
                    <button className="px-2 py-1 border rounded" onClick={() => start(p)}>
                      Editar
                    </button>
                  </td>
                </tr>
              )
            )}
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

      {/* Gráficos torta */}
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {["kg_real", "kg_exceso"].map((key, ix) => {
          const agg = {};
          rows.forEach((p) => {
            agg[p.courier] ??= { courier: p.courier, kg_real: 0, kg_exceso: 0 };
            agg[p.courier][key] += key === "kg_real" ? p.peso_real : p.exceso_volumen;
          });
          const data = Object.values(agg);
          const total = data.reduce((s, a) => s + a[key], 0);
          return (
            <div key={key} className="bg-gray-50 rounded-xl p-3">
              <div className="text-sm text-gray-600 mb-2">
                {key === "kg_real" ? "Kg reales" : "Exceso volumétrico"} por courier. Total:{" "}
                {fmtPeso(total)} kg
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data} dataKey={key} nameKey="courier" outerRadius={100} label>
                      {data.map((_, i) => (
                        <Cell
                          key={i}
                          fill={COLORS[(i + (ix ? 3 : 0)) % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* =================== ARMADO DE CAJAS =================== */
function ArmadoCajas({ packages, flights, setFlights, onAssign }) {
  const [flightId, setFlightId] = useState("");
  const flight = flights.find((f) => f.id === flightId);

  const [boxCode, setBoxCode] = useState("");
  const [activeBoxId, setActiveBoxId] = useState(null);
  const [scan, setScan] = useState("");

  function addBox() {
    if (!flightId || !boxCode) return;
    setFlights(
      flights.map((f) =>
        f.id !== flightId
          ? f
          : {
              ...f,
              cajas: [
                ...f.cajas,
                { id: uuid(), codigo: boxCode, paquetes: [], peso: "", L: "", A: "", H: "" },
              ],
            }
      )
    );
    setBoxCode("");
  }
  function updBox(field, val) {
    if (!flightId || !activeBoxId) return;
    setFlights(
      flights.map((f) =>
        f.id !== flightId
          ? f
          : { ...f, cajas: f.cajas.map((c) => (c.id !== activeBoxId ? c : { ...c, [field]: val })) }
      )
    );
  }
  function assign() {
    if (!scan || !activeBoxId || !flight) return;
    const pkg = packages.find(
      (p) => p.codigo.toUpperCase() === scan.toUpperCase() && p.flight_id === flightId
    );
    if (!pkg) {
      alert("No existe ese código en esta carga.");
      setScan("");
      return;
    }
    if (flight.cajas.some((c) => c.paquetes.includes(pkg.id))) {
      alert("Ya está en una caja.");
      setScan("");
      return;
    }
    setFlights(
      flights.map((f) =>
        f.id !== flightId
          ? f
          : {
              ...f,
              cajas: f.cajas.map((c) =>
                c.id !== activeBoxId ? c : { ...c, paquetes: [...c.paquetes, pkg.id] }
              ),
            }
      )
    );
    onAssign(pkg.id);
    setScan("");
  }
  const volCaja = (c) => (parseComma(c.A) * parseComma(c.H) * parseComma(c.L)) / 6000 || 0;
  function move(pid, toId) {
    if (!toId || !flight) return;
    setFlights((prev) =>
      prev.map((f) =>
        f.id !== flightId
          ? f
          : { ...f, cajas: f.cajas.map((c) => (c.id === activeBoxId ? { ...c, paquetes: c.paquetes.filter((x) => x !== pid) } : c)) }
      )
    );
    setFlights((prev) =>
      prev.map((f) =>
        f.id !== flightId
          ? f
          : { ...f, cajas: f.cajas.map((c) => (c.id === toId ? { ...c, paquetes: [...c.paquetes, pid] } : c)) }
      )
    );
  }

  // Export: hoja por caja (cabecera y tabulado por courier)
  function exportBoxes() {
    if (!flight) return;
    const sheets = [];
    flight.cajas.forEach((caja, idx) => {
      const byCourier = {};
      caja.paquetes.forEach((pid) => {
        const p = packages.find((x) => x.id === pid);
        if (!p) return;
        (byCourier[p.courier] ||= []).push(p.codigo);
      });
      const headers = Object.keys(byCourier);
      const max = headers.reduce((m, k) => Math.max(m, byCourier[k].length), 0);
      const rows = [];
      rows.push([td(""), td("")]);
      rows.push([th("CONTROL DE PAQUETES")]);
      rows.push([td(`CAJA Nº ${idx + 1}`), td(`CANTIDAD DE PAQUETES: ${caja.paquetes.length}`)]);
      rows.push(headers.map((h) => th(h)));
      for (let r = 0; r < max; r++) {
        rows.push(headers.map((h) => td(byCourier[h][r] || "")));
      }
      const { ws } = sheetFromAOAStyled(`CAJA ${idx + 1}`, rows);
      sheets.push({ name: `CAJA ${idx + 1}`, ws });
    });
    downloadXLSX(
      `Armado_de_cajas_${flight.codigo}.xlsx`,
      sheets.length ? sheets : [{ name: "CAJAS", ws: sheetFromAOAStyled("CAJAS", [[td("Sin cajas")]]).ws }]
    );
  }

  return (
    <Section title="Armado de cajas">
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Seleccionar carga (En bodega)" required>
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={flightId}
            onChange={(e) => {
              setFlightId(e.target.value);
              setActiveBoxId(null);
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
        <Field label="Crear caja (código)">
          <div className="flex gap-2">
            <Input placeholder="Caja-01" value={boxCode} onChange={(e) => setBoxCode(e.target.value)} />
            <button
              onClick={addBox}
              disabled={!flightId}
              className="px-3 py-2 bg-gray-800 text-white rounded-xl disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        </Field>
        <Field label="Caja activa">
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={activeBoxId || ""}
            onChange={(e) => setActiveBoxId(e.target.value)}
          >
            <option value="">—</option>
            {flight?.cajas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Escanear / ingresar código de paquete">
          <Input
            value={scan}
            onChange={(e) => setScan(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && assign()}
            placeholder="EE250905-BOSSBOX1"
          />
        </Field>

        {activeBoxId && (
          <>
            <Field label="Peso caja (kg)">
              <Input
                value={flight.cajas.find((c) => c.id === activeBoxId)?.peso || ""}
                onChange={(e) => updBox("peso", e.target.value)}
                placeholder="3,128"
              />
            </Field>
            <Field label="Largo (cm)">
              <Input
                value={flight.cajas.find((c) => c.id === activeBoxId)?.L || ""}
                onChange={(e) => updBox("L", e.target.value)}
              />
            </Field>
            <Field label="Ancho (cm)">
              <Input
                value={flight.cajas.find((c) => c.id === activeBoxId)?.A || ""}
                onChange={(e) => updBox("A", e.target.value)}
              />
            </Field>
            <Field label="Alto (cm)">
              <Input
                value={flight.cajas.find((c) => c.id === activeBoxId)?.H || ""}
                onChange={(e) => updBox("H", e.target.value)}
              />
            </Field>
            <div className="text-sm text-gray-600">
              Volumétrico caja (A×H×L ÷ 6000):{" "}
              {fmtPeso(volCaja(flight.cajas.find((c) => c.id === activeBoxId) || {}))} kg
            </div>
          </>
        )}

        <div className="md:col-span-3">
          {!flight && <div className="text-gray-500">Seleccioná una carga.</div>}
          {flight &&
            flight.cajas.map((c) => {
              const couriers = new Set(
                c.paquetes.map((pid) => packages.find((p) => p.id === pid)?.courier).filter(Boolean)
              );
              const etiqueta = couriers.size === 0 ? "—" : couriers.size === 1 ? [...couriers][0] : "MULTICOURIER";
              return (
                <div
                  key={c.id}
                  className={`border rounded-xl p-3 mb-3 ${activeBoxId === c.id ? "ring-2 ring-indigo-500" : ""}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">
                      Caja {c.codigo} · <span className="text-xs text-gray-600">{etiqueta}</span>
                    </div>
                    {/* sin botón Activar; se elige desde el selector */}
                  </div>
                  <ul className="text-sm max-h-48 overflow-auto">
                    {c.paquetes.map((pid) => {
                      const p = packages.find((x) => x.id === pid);
                      if (!p) return null;
                      return (
                        <li key={pid} className="flex items-center gap-2 py-1 border-b">
                          <span className="font-mono">{p.codigo}</span>
                          <span className="text-gray-600">{p.courier}</span>
                          <button
                            className="text-red-600 text-xs"
                            onClick={() =>
                              setFlights(
                                flights.map((f) =>
                                  f.id !== flightId
                                    ? f
                                    : {
                                        ...f,
                                        cajas: f.cajas.map((x) =>
                                          x.id !== c.id
                                            ? x
                                            : { ...x, paquetes: x.paquetes.filter((z) => z !== pid) }
                                        ),
                                      }
                                )
                              )
                            }
                          >
                            Quitar
                          </button>
                          {flight.cajas.length > 1 && (
                            <select
                              className="text-xs border rounded px-1 py-0.5 ml-auto"
                              defaultValue=""
                              onChange={(e) => move(pid, e.target.value)}
                            >
                              <option value="" disabled>
                                Mover a…
                              </option>
                              {flight.cajas
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
                    {c.paquetes.length === 0 && <li className="text-gray-500">—</li>}
                  </ul>
                </div>
              );
            })}
        </div>

        <div className="md:col-span-3 flex justify-end">
          <button
            onClick={exportBoxes}
            disabled={!flight}
            className="px-3 py-2 bg-emerald-600 text-white rounded-xl disabled:opacity-50"
          >
            Exportar XLSX (cajas)
          </button>
        </div>
      </div>
    </Section>
  );
}

/* =================== CARGAS ENVIADAS =================== */
function CargasEnviadas({ packages, flights }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [estado, setEstado] = useState("");
  const [flightId, setFlightId] = useState("");
  const list = flights
    .filter((f) => f.estado !== "En bodega")
    .filter((f) => !from || f.fecha_salida >= from)
    .filter((f) => !to || f.fecha_salida <= to)
    .filter((f) => !estado || f.estado === estado);
  const flight = flights.find((f) => f.id === flightId);

  const resumen = useMemo(() => {
    if (!flight) return [];
    return flight.cajas.map((c, i) => {
      const peso = parseComma(c.peso);
      const L = parseComma(c.L),
        A = parseComma(c.A),
        H = parseComma(c.H);
      const vol = (A * H * L) / 6000 || 0;
      const couriers = new Set(
        c.paquetes.map((pid) => packages.find((p) => p.id === pid)?.courier).filter(Boolean)
      );
      const etiqueta = couriers.size === 0 ? "—" : couriers.size === 1 ? [...couriers][0] : "MULTICOURIER";
      return { n: i + 1, courier: etiqueta, peso, L, A, H, vol };
    });
  }, [flight, packages]);

  const totPeso = sum(resumen.map((r) => r.peso));
  const totVol = sum(resumen.map((r) => r.vol));

  function exportTodo() {
    if (!flight) return;
    // Hoja paquetes
    const headerP = [
      th("COURIER"),
      th("CÓDIGO"),
      th("CASILLA"),
      th("FECHA"),
      th("EMPRESA ENVIO"),
      th("NOMBRE Y APELLIDO"),
      th("TRACKING"),
      th("REMITENTE"),
      th("PESO REAL"),
      th("PESO FACTURABLE"),
      th("LARGO"),
      th("ANCHO"),
      th("ALTO"),
      th("PESO VOLUMÉTRICO"),
      th("EXCESO DE VOLUMEN"),
      th("DESCRIPCIÓN"),
      th("VALOR EUR"),
    ];
    const bodyP = packages
      .filter((p) => p.flight_id === flightId)
      .map((p) => [
        td(p.courier),
        td(p.codigo),
        td(p.casilla),
        td(p.fecha),
        td(p.empresa_envio),
        td(p.nombre_apellido),
        td(p.tracking),
        td(p.remitente),
        td(fmtPeso(p.peso_real)),
        td(fmtPeso(p.peso_facturable)),
        td(fmtPeso(p.largo)),
        td(fmtPeso(p.ancho)),
        td(fmtPeso(p.alto)),
        td(fmtPeso(p.peso_volumetrico)),
        td(fmtPeso(p.exceso_volumen)),
        td(p.descripcion),
        td(fmtMoney(p.valor_aerolinea)),
      ]);
    const { ws: wsP } = sheetFromAOAStyled("Paquetes", [headerP, ...bodyP]);

    // Hoja cajas
    const headerC = [
      th("Nº de Caja"),
      th("Courier"),
      th("Peso"),
      th("Largo"),
      th("Ancho"),
      th("Alto"),
      th("Peso volumétrico"),
    ];
    const bodyC = resumen.map((r) => [
      td(r.n),
      td(r.courier),
      td(fmtPeso(r.peso)),
      td(fmtPeso(r.L)),
      td(fmtPeso(r.A)),
      td(fmtPeso(r.H)),
      td(fmtPeso(r.vol)),
    ]);
    bodyC.push([td(""), td(""), td(fmtPeso(totPeso)), td(""), td(""), td(""), td(fmtPeso(totVol))]);
    const { ws: wsC } = sheetFromAOAStyled("Cajas", [headerC, ...bodyC]);

    downloadXLSX(`Detalle_${flight.codigo}.xlsx`, [
      { name: "Paquetes", ws: wsP },
      { name: "Cajas", ws: wsC },
    ]);
  }

  return (
    <Section title="Cargas enviadas (En tránsito / Arribado)">
      <div className="grid md:grid-cols-5 gap-3">
        <Field label="Desde">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Estado">
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            <option value="">Todos</option>
            <option>En tránsito</option>
            <option>Arribado</option>
          </select>
        </Field>
        <Field label="Carga">
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={flightId}
            onChange={(e) => setFlightId(e.target.value)}
          >
            <option value="">Seleccionar…</option>
            {list.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo} · {f.fecha_salida} · {f.estado}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end">
          <button
            onClick={exportTodo}
            disabled={!flight}
            className="px-3 py-2 bg-emerald-600 text-white rounded-xl disabled:opacity-50 w-full"
          >
            Exportar XLSX
          </button>
        </div>
      </div>

      {!flight ? (
        <div className="text-gray-500 mt-4">Elegí una carga para ver contenido.</div>
      ) : (
        <>
          <div className="mt-4 text-sm text-gray-600">
            Paquetes del vuelo <b>{flight.codigo}</b>
          </div>
          <div className="overflow-auto mb-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {[
                    "Courier",
                    "Casilla",
                    "Código",
                    "Fecha",
                    "Nombre",
                    "Tracking",
                    "Peso real",
                    "Facturable",
                    "Volumétrico",
                    "Exceso",
                    "Valor (EUR)",
                  ].map((h) => (
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
                      <td className="px-3 py-2">{p.casilla}</td>
                      <td className="px-3 py-2 font-mono">{p.codigo}</td>
                      <td className="px-3 py-2">{p.fecha}</td>
                      <td className="px-3 py-2">{p.nombre_apellido}</td>
                      <td className="px-3 py-2 font-mono">{p.tracking}</td>
                      <td className="px-3 py-2">{fmtPeso(p.peso_real)}</td>
                      <td className="px-3 py-2">{fmtPeso(p.peso_facturable)}</td>
                      <td className="px-3 py-2">{fmtPeso(p.peso_volumetrico)}</td>
                      <td className="px-3 py-2">{fmtPeso(p.exceso_volumen)}</td>
                      <td className="px-3 py-2">{fmtMoney(p.valor_aerolinea)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {["Nº de Caja", "Courier", "Peso", "Largo", "Ancho", "Alto", "Peso volumétrico"].map(
                    (h) => (
                      <th key={h} className="text-left px-3 py-2">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {resumen.map((r) => (
                  <tr key={r.n} className="border-b">
                    <td className="px-3 py-2">{r.n}</td>
                    <td className="px-3 py-2">{r.courier}</td>
                    <td className="px-3 py-2">{fmtPeso(r.peso)}</td>
                    <td className="px-3 py-2">{fmtPeso(r.L)}</td>
                    <td className="px-3 py-2">{fmtPeso(r.A)}</td>
                    <td className="px-3 py-2">{fmtPeso(r.H)}</td>
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

/* =================== PROFORMAS =================== */
function Proformas({ packages, flights, extras }) {
  const [flightId, setFlightId] = useState("");
  const flight = flights.find((f) => f.id === flightId);

  const porCourier = useMemo(() => {
    if (!flight) return [];
    const m = new Map();
    flight.cajas.forEach((c) =>
      c.paquetes.forEach((pid) => {
        const p = packages.find((x) => x.id === pid);
        if (!p) return;
        if (!m.has(p.courier))
          m.set(p.courier, { courier: p.courier, bultos: 0, kg_real: 0, kg_fact: 0, kg_exc: 0 });
        const a = m.get(p.courier);
        a.bultos++;
        a.kg_real += p.peso_real;
        a.kg_fact += p.peso_facturable;
        a.kg_exc += p.exceso_volumen;
      })
    );
    return Array.from(m.values());
  }, [flight, packages]);

  const extrasDe = (c) =>
    extras
      .filter((e) => e.flight_id === flightId && e.courier === c)
      .reduce((s, e) => s + parseComma(e.monto), 0);

  function exportX(r) {
    const proc = r.kg_fact * T.proc,
      fr = r.kg_real * T.fleteReal,
      fe = r.kg_exc * T.fleteExc,
      desp = r.kg_fact * T.despacho;
    const canje = canjeGuiaUSD(r.kg_fact);
    const extrasMonto = extrasDe(r.courier);
    const com = 0.04 * (proc + fr + fe + extrasMonto);
    const total = proc + fr + fe + desp + canje + extrasMonto + com;

    const rows = [
      [td("")],
      [td("Europa Envíos")],
      [td("LAMAQUINALOGISTICA, SOCIEDAD LIMITADA")],
      [td("N.I.F.: B56340656")],
      [td("CALLE ESTEBAN SALAZAR CHAPELA, NUM 20, PUERTA 87, NAVE 87")],
      [td("29004 MÁLAGA (ESPAÑA)")],
      [td("(34) 633 74 08 31")],
      [td("")],
      [th("Factura Proforma")],
      [td("Fecha: " + new Date().toISOString().slice(0, 10))],
      [td("")],
      [th("Cliente"), th(""), th("Forma de pago"), th(""), th("Nº factura")],
      [td(r.courier), td(""), td(""), td(""), td("—")],
      [td("")],
      [td("")],
      [th("Descripción"), th("Cantidad"), th("Precio unitario"), th("Precio total")],
      [td("Procesamiento"), td(fmtPeso(r.kg_fact)), td(fmtMoney(T.proc)), td(fmtMoney(proc))],
      [td("Flete peso real"), td(fmtPeso(r.kg_real)), td(fmtMoney(T.fleteReal)), td(fmtMoney(fr))],
      [
        td("Flete exceso de volumen"),
        td(fmtPeso(r.kg_exc)),
        td(fmtMoney(T.fleteExc)),
        td(fmtMoney(fe)),
      ],
      [td("Servicio de despacho"), td(fmtPeso(r.kg_fact)), td(fmtMoney(T.despacho)), td(fmtMoney(desp))],
      [td("Comisión por canje de guía"), td("1"), td(fmtMoney(canje)), td(fmtMoney(canje))],
      [td("Trabajos extras"), td("1"), td(fmtMoney(extrasMonto)), td(fmtMoney(extrasMonto))],
      [td("Comisión por transferencia (4%)"), td(""), td(""), td(fmtMoney(com))],
      [th("TOTAL USD"), th(""), th(""), th(fmtMoney(total))],
    ];
    const { ws } = sheetFromAOAStyled("Factura", rows);
    downloadXLSX(`proforma_${(flight?.codigo || "carga")}_${r.courier}.xlsx`, [
      { name: "Factura", ws },
    ]);
  }

  return (
    <Section
      title="Proformas por courier"
      right={
        <select
          className="rounded-xl border px-3 py-2"
          value={flightId}
          onChange={(e) => setFlightId(e.target.value)}
        >
          <option value="">Seleccionar carga…</option>
          {flights.map((f) => (
            <option key={f.id} value={f.id}>
              {f.codigo}
            </option>
          ))}
        </select>
      }
    >
      {!flight ? (
        <div className="text-gray-500">Seleccioná una carga.</div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {[
                  "Courier",
                  "Bultos",
                  "Kg real",
                  "Kg facturable",
                  "Kg exceso",
                  "TOTAL USD",
                  "XLSX",
                ].map((h) => (
                  <th key={h} className="text-left px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {porCourier.map((r) => {
                const proc = r.kg_fact * T.proc,
                  fr = r.kg_real * T.fleteReal,
                  fe = r.kg_exc * T.fleteExc,
                  desp = r.kg_fact * T.despacho;
                const canje = canjeGuiaUSD(r.kg_fact);
                const extrasMonto = extrasDe(r.courier);
                const com = 0.04 * (proc + fr + fe + extrasMonto);
                const tot = proc + fr + fe + desp + canje + extrasMonto + com;
                return (
                  <tr key={r.courier} className="border-b">
                    <td className="px-3 py-2">{r.courier}</td>
                    <td className="px-3 py-2">{r.bultos}</td>
                    <td className="px-3 py-2">{fmtPeso(r.kg_real)}</td>
                    <td className="px-3 py-2">{fmtPeso(r.kg_fact)}</td>
                    <td className="px-3 py-2">{fmtPeso(r.kg_exc)}</td>
                    <td className="px-3 py-2 font-semibold">{fmtMoney(tot)}</td>
                    <td className="px-3 py-2">
                      <button className="px-2 py-1 border rounded" onClick={() => exportX(r)}>
                        Descambiar
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

/* =================== EXTRAS =================== */
function Extras({ flights, couriers, extras, setExtras }) {
  const [flightId, setFlightId] = useState("");
  const [courier, setCourier] = useState("");
  const [desc, setDesc] = useState("");
  const [monto, setMonto] = useState("");
  const [estado, setEstado] = useState("Pendiente");
  const add = () => {
    if (!(flightId && courier && desc && monto)) return;
    setExtras([
      ...extras,
      { id: uuid(), flight_id: flightId, courier, descripcion: desc, monto, estado },
    ]);
    setDesc("");
    setMonto("");
  };
  const filtered = extras.filter((e) => e.flight_id === flightId);
  return (
    <Section title="Trabajos extras">
      <div className="grid md:grid-cols-5 gap-2">
        <Field label="Carga">
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={flightId}
            onChange={(e) => setFlightId(e.target.value)}
          >
            <option value="">—</option>
            {flights.map((f) => (
              <option key={f.id} value={f.id}>
                {f.codigo}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Courier">
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={courier}
            onChange={(e) => setCourier(e.target.value)}
          >
            <option value="">—</option>
            {couriers.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Descripción">
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <Field label="Monto (USD)">
          <Input value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="10,00" />
        </Field>
        <Field label="Estado de cobro">
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            <option>Pendiente</option>
            <option>Cobrado</option>
          </select>
        </Field>
      </div>
      <div className="flex justify-end mt-2">
        <button onClick={add} className="px-3 py-2 bg-indigo-600 text-white rounded-xl">
          Agregar
        </button>
      </div>
      <div className="overflow-auto mt-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {["Carga", "Courier", "Descripción", "Monto (USD)", "Estado"].map((h) => (
                <th key={h} className="text-left px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-b">
                <td className="px-3 py-2">{flights.find((f) => f.id === e.flight_id)?.codigo}</td>
                <td className="px-3 py-2">{e.courier}</td>
                <td className="px-3 py-2">{e.descripcion}</td>
                <td className="px-3 py-2">{fmtMoney(parseComma(e.monto))}</td>
                <td className="px-3 py-2">{e.estado}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-gray-500 py-6">
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

/* =================== APP ROOT =================== */
export default function App() {
  const [user, setUser] = useState(null);
  const [couriers, setCouriers] = useState(COURIERS_INICIALES);
  const [estados, setEstados] = useState(ESTADOS_INICIALES);
  const [flights, setFlights] = useState([]);
  const [packages, setPackages] = useState([]);
  const [extras, setExtras] = useState([]);

  function addPackage(p) {
    const dup = packages.find((x) => x.codigo === p.codigo);
    if (dup) {
      alert("Ya existe ese código.");
      return;
    }
    setPackages([p, ...packages]);
  }
  function updatePackage(p) {
    setPackages(packages.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
  }
  function assignToBox(id) {
    setPackages(packages.map((p) => (p.id === id ? { ...p, estado_bodega: "En vuelo" } : p)));
  }

  if (!user) return <Login onLogin={setUser} />;

  const tabs = [
    "Recepción",
    "Paquetes en bodega",
    "Armado de cajas",
    "Cargas enviadas",
    "Gestión de cargas",
    "Proformas",
    "Extras",
  ];
  const [tab, setTab] = useState(tabs[0]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600" />
              <div>
                <div className="font-semibold">Gestor de Paquetes</div>
                <div className="text-xs text-gray-500">LaMaquinaLogistica / Europa Envíos</div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {user.role} {user.courier ? `· ${user.courier}` : ""} — {user.email}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6">
          <Tabs tabs={tabs} current={tab} onChange={setTab} />

          {tab === "Recepción" && (
            <Reception
              currentUser={user}
              couriers={couriers}
              setCouriers={setCouriers}
              estados={estados}
              setEstados={setEstados}
              flights={flights}
              onAdd={addPackage}
            />
          )}
          {tab === "Paquetes en bodega" && (
            <PaquetesBodega
              packages={packages}
              flights={flights}
              user={user}
              onUpdate={updatePackage}
            />
          )}
          {tab === "Armado de cajas" && (
            <ArmadoCajas
              packages={packages}
              flights={flights}
              setFlights={setFlights}
              onAssign={assignToBox}
            />
          )}
          {tab === "Cargas enviadas" && (
            <CargasEnviadas packages={packages} flights={flights} />
          )}
          {tab === "Gestión de cargas" && (
            <CargasAdmin flights={flights} setFlights={setFlights} />
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
        </main>
      </div>
    </ErrorBoundary>
  );
}
