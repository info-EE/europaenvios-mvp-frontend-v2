import React, { useMemo, useRef, useState } from "react";

/** ============================================================
 *  Europa Envíos – Frontend (App de pestañas en 1 archivo)
 *  - Pestañas incluidas: Recepción (demo), Paquetes en bodega, Armado de cajas, Extras
 *  - Cambios pedidos aplicados en esas tres pestañas
 *
 *  Reglas de formato del proyecto:
 *    - Peso con 3 decimales y coma (ej. 3,128)
 *    - Precios con 2 decimales y coma (ej. 4,12) [solo visible en Extras]
 *    - Medidas en cm como enteros
 *    - Reimpresión: etiqueta simple 100×60 mm (fallback). Si definís window.printLabelForPackage,
 *      se usará esa función para imprimir (por ejemplo, ZPL para Zebra ZP450).
 *  ============================================================ */

function formatPeso(kg) {
  if (kg == null || isNaN(Number(kg))) return "";
  return Number(kg).toFixed(3).replace(".", ",");
}
function formatPrecio(n) {
  if (n == null || isNaN(Number(n))) return "";
  return Number(n).toFixed(2).replace(".", ",");
}
function fechaES(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("es-ES");
}
function isDateLike(val) {
  if (typeof val !== "string") return false;
  const t = Date.parse(val);
  return !isNaN(t);
}
function compareSmart(a, b, asc = true) {
  const dir = asc ? 1 : -1;
  const va = a ?? "";
  const vb = b ?? "";

  const na = Number(va);
  const nb = Number(vb);
  if (!isNaN(na) && !isNaN(nb)) return na === nb ? 0 : na > nb ? dir : -dir;

  const da = isDateLike(va) ? new Date(va).getTime() : null;
  const db = isDateLike(vb) ? new Date(vb).getTime() : null;
  if (da != null && db != null) return da === db ? 0 : da > db ? dir : -dir;

  const sa = String(va).toLowerCase();
  const sb = String(vb).toLowerCase();
  return sa === sb ? 0 : sa > sb ? dir : -dir;
}

function pickUnique(arr, key) {
  return Array.from(
    new Set(
      (arr ?? [])
        .map((x) => x?.[key])
        .filter((v) => v != null && String(v).trim() !== "")
    )
  );
}

/* --------------------------- Datos de demo --------------------------- */
const DEMO_COURIERS = ["UPS", "DHL", "FedEx", "Cacesa", "LATAM Cargo"];
const DEMO_ESTADOS = ["En bodega", "En tránsito", "Arribado", "Entregado"];

const DEMO_PAQUETES = [
  {
    id: "PKG-1001",
    casilla: "AB12345",
    nombre: "Juan Pérez",
    descripcion: "Zapatillas",
    peso: 2.128,
    largo: 35,
    ancho: 25,
    alto: 12,
    fecha: "2025-09-01",
    courier: "UPS",
    estado: "En bodega",
    fotoUrl: "",
  },
  {
    id: "PKG-1002",
    casilla: "CD54321",
    nombre: "María López",
    descripcion: "Libros",
    peso: 3.5,
    largo: 30,
    ancho: 20,
    alto: 15,
    fecha: "2025-09-02",
    courier: "DHL",
    estado: "En bodega",
    fotoUrl: "",
  },
  {
    id: "PKG-1003",
    casilla: "EF98765",
    nombre: "Carlos Ruiz",
    descripcion: "Ropa",
    peso: 1.05,
    largo: 28,
    ancho: 22,
    alto: 10,
    fecha: "2025-09-03",
    courier: "Cacesa",
    estado: "En tránsito",
    fotoUrl: "",
  },
];

const DEMO_CAJAS = [
  { id: "BOX-1", titulo: "Caja 1", paquetes: [DEMO_PAQUETES[0]] },
  { id: "BOX-2", titulo: "Caja 2", paquetes: [DEMO_PAQUETES[1]] },
  { id: "BOX-3", titulo: "Caja 3", paquetes: [DEMO_PAQUETES[2]] },
];

const DEMO_EXTRAS = [
  { id: "EXT-1", fecha: "2025-09-02", descripcion: "Embalaje especial", monto: 12.5 },
  { id: "EXT-2", fecha: "2025-09-03", descripcion: "Gestión documental", monto: 25.0 },
];

/* ------------------------- UI Auxiliares simples ------------------------- */
function Tabs({ value, onChange, items }) {
  return (
    <div className="flex flex-wrap gap-2 border-b mb-4">
      {items.map((it) => (
        <button
          key={it.key}
          className={`px-3 py-2 ${value === it.key ? "border-b-2 border-black font-medium" : "text-gray-600"}`}
          onClick={() => onChange(it.key)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ============================ Pestaña: Recepción ============================ */
/* Solo para “fuente de verdad” de los selects. No implementamos el alta completa aquí. */
function TabRecepcionDemo({ couriers, estados }) {
  return (
    <div className="p-4 space-y-3">
      <div className="text-sm text-gray-600">
        Esta pestaña actúa como <strong>fuente de opciones</strong> para Courier y Estado:
      </div>
      <div>
        <div className="font-medium mb-1">Couriers:</div>
        <div className="flex flex-wrap gap-2">
          {couriers.map((c) => (
            <span key={c} className="border rounded-xl px-2 py-1 text-sm">
              {c}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="font-medium mb-1">Estados:</div>
        <div className="flex flex-wrap gap-2">
          {estados.map((e) => (
            <span key={e} className="border rounded-xl px-2 py-1 text-sm">
              {e}
            </span>
          ))}
        </div>
      </div>
      <div className="text-xs text-gray-500">
        Paquetes en bodega usa estas opciones como desplegables al editar.
      </div>
    </div>
  );
}

/* ======================= Pestaña: Paquetes en bodega ======================= */
function TabPaquetesEnBodega({ paquetes, setPaquetes, couriers, estados }) {
  const [busqueda, setBusqueda] = useState("");
  const [ordenPor, setOrdenPor] = useState("fecha");
  const [asc, setAsc] = useState(false);
  const [editando, setEditando] = useState(null);
  const fileInputRef = useRef(null);

  const camposOrden = [
    { key: "casilla", label: "Casilla" },
    { key: "nombre", label: "Nombre" },
    { key: "descripcion", label: "Descripción" },
    { key: "peso", label: "Peso (kg)" },
    { key: "fecha", label: "Fecha" },
    { key: "courier", label: "Courier" },
    { key: "estado", label: "Estado" },
  ];

  const lista = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    let data = paquetes ?? [];
    if (t) {
      data = data.filter((p) =>
        [p.casilla, p.nombre, p.descripcion, p.courier, p.estado]
          .map((x) => (x ?? "").toLowerCase())
          .some((s) => s.includes(t))
      );
    }
    return [...data].sort((A, B) => compareSmart(A?.[ordenPor], B?.[ordenPor], asc));
  }, [paquetes, busqueda, ordenPor, asc]);

  function reimprimir(p) {
    if (typeof window !== "undefined" && typeof window.printLabelForPackage === "function") {
      window.printLabelForPackage(p);
      return;
    }
    // Fallback etiqueta 100×60 mm con datos básicos
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    const medidas = [
      parseInt(p.largo ?? 0, 10) || 0,
      parseInt(p.ancho ?? 0, 10) || 0,
      parseInt(p.alto ?? 0, 10) || 0,
    ].join("×");
    w.document.write(`
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>Etiqueta ${p.casilla ?? ""}</title>
          <style>
            @page { size: 100mm 60mm; margin: 4mm; }
            body { font-family: Arial, sans-serif; }
            .lbl { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
            .row { font-size: 12pt; }
            .hdr { font-size: 16pt; font-weight: bold; }
            .barcode { font-family: "Courier New", monospace; font-size: 22pt; letter-spacing: 2px; border: 1px dashed #000; padding: 4px; text-align:center; margin: 6px 0; }
          </style>
        </head>
        <body onload="window.print(); setTimeout(()=>window.close(), 100);">
          <div class="lbl">
            <div class="hdr">${(p.nombre ?? "").toUpperCase()}</div>
            <div class="row">Casilla: <strong>${p.casilla ?? ""}</strong></div>
            <div class="barcode">${p.id ?? p.casilla ?? "CODIGO"}</div>
            <div class="row">Peso: <strong>${formatPeso(p.peso)} kg</strong></div>
            <div class="row">Medidas: <strong>${medidas} cm</strong></div>
            <div class="row">Desc.: ${(p.descripcion ?? "").slice(0, 80)}</div>
          </div>
        </body>
      </html>
    `);
    w.document.close();
  }

  function abrirEditor(p) {
    setEditando({ ...p });
  }
  function cerrarEditor() {
    setEditando(null);
  }
  function guardarPaquete() {
    setPaquetes((prev) => prev.map((x) => (x.id === editando.id ? { ...editando } : x)));
    cerrarEditor();
  }
  function onPickFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEditando((h) => ({ ...h, fotoUrl: reader.result }));
    reader.readAsDataURL(file);
  }

  return (
    <div className="p-4 space-y-4">
      {/* Controles */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
        <div className="flex-1">
          <label className="text-sm font-medium">Buscar</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Nombre, casilla, descripción, courier, estado…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium">Ordenar por</label>
          <select
            className="w-52 border rounded-lg px-3 py-2"
            value={ordenPor}
            onChange={(e) => setOrdenPor(e.target.value)}
          >
            {camposOrden.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <button className="border rounded-lg px-3 py-2" onClick={() => setAsc((v) => !v)}>
          {asc ? "Asc ↑" : "Desc ↓"}
        </button>
      </div>

      {/* Tabla */}
      <div className="overflow-auto border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-2">Casilla</th>
              <th className="p-2">Nombre</th>
              <th className="p-2">Peso (kg)</th>
              <th className="p-2">Fecha</th>
              <th className="p-2">Courier</th>
              <th className="p-2">Estado</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.casilla}</td>
                <td className="p-2">{p.nombre}</td>
                <td className="p-2">{formatPeso(p.peso)}</td>
                <td className="p-2">{fechaES(p.fecha)}</td>
                <td className="p-2">{p.courier}</td>
                <td className="p-2">{p.estado}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button className="px-2 py-1 rounded-lg border" onClick={() => abrirEditor(p)}>
                      Editar
                    </button>
                    <button className="px-2 py-1 rounded-lg border" onClick={() => reimprimir(p)}>
                      Reimprimir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td className="p-4 text-gray-500" colSpan={7}>
                  No hay paquetes para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Editor modal */}
      {editando && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Editar paquete</h3>
              <button className="text-gray-500" onClick={cerrarEditor}>
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Nombre</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={editando.nombre ?? ""}
                  onChange={(e) => setEditando((p) => ({ ...p, nombre: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm">Casilla</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={editando.casilla ?? ""}
                  onChange={(e) => setEditando((p) => ({ ...p, casilla: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm">Descripción</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={editando.descripcion ?? ""}
                  onChange={(e) => setEditando((p) => ({ ...p, descripcion: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm">Peso (kg)</label>
                <input
                  type="number"
                  step="0.001"
                  className="w-full border rounded-lg px-3 py-2"
                  value={editando.peso ?? ""}
                  onChange={(e) => setEditando((p) => ({ ...p, peso: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm">Largo (cm)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2"
                  value={editando.largo ?? ""}
                  onChange={(e) =>
                    setEditando((p) => ({ ...p, largo: parseInt(e.target.value || 0, 10) }))
                  }
                />
              </div>
              <div>
                <label className="text-sm">Ancho (cm)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2"
                  value={editando.ancho ?? ""}
                  onChange={(e) =>
                    setEditando((p) => ({ ...p, ancho: parseInt(e.target.value || 0, 10) }))
                  }
                />
              </div>
              <div>
                <label className="text-sm">Alto (cm)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2"
                  value={editando.alto ?? ""}
                  onChange={(e) =>
                    setEditando((p) => ({ ...p, alto: parseInt(e.target.value || 0, 10) }))
                  }
                />
              </div>

              <div>
                <label className="text-sm">Fecha</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2"
                  value={(editando.fecha ?? "").slice(0, 10)}
                  onChange={(e) => setEditando((p) => ({ ...p, fecha: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm">Courier</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={editando.courier ?? ""}
                  onChange={(e) => setEditando((p) => ({ ...p, courier: e.target.value }))}
                >
                  <option value="">Seleccionar…</option>
                  {(couriers ?? []).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm">Estado</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={editando.estado ?? ""}
                  onChange={(e) => setEditando((p) => ({ ...p, estado: e.target.value }))}
                >
                  <option value="">Seleccionar…</option>
                  {(estados ?? []).map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm block mb-1">Foto del paquete</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={fileInputRef}
                    onChange={onPickFoto}
                  />
                  {editando.fotoUrl && (
                    <img
                      src={editando.fotoUrl}
                      alt="foto paquete"
                      className="h-16 w-16 object-cover rounded-lg border"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button className="px-3 py-2 border rounded-lg" onClick={() => reimprimir(editando)}>
                Reimprimir etiqueta
              </button>
              <div className="flex gap-2">
                <button className="px-3 py-2 border rounded-lg" onClick={cerrarEditor}>
                  Cancelar
                </button>
                <button className="px-3 py-2 rounded-lg bg-black text-white" onClick={guardarPaquete}>
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================== Pestaña: Armado de cajas ========================== */
function TabArmadoDeCajas({ cajas, setCajas }) {
  const [activaId, setActivaId] = useState(cajas?.[0]?.id ?? null);

  const activa = useMemo(() => (cajas ?? []).find((c) => c.id === activaId) ?? null, [cajas, activaId]);

  function moverPaquete({ paqueteId, desdeCajaId, haciaCajaId }) {
    if (!haciaCajaId || desdeCajaId === haciaCajaId) return;
    setCajas((prev) => {
      const next = (prev ?? []).map((c) => ({ ...c, paquetes: [...(c.paquetes ?? [])] }));
      const from = next.find((c) => c.id === desdeCajaId);
      const to = next.find((c) => c.id === haciaCajaId);
      if (!from || !to) return prev;

      const idx = (from.paquetes ?? []).findIndex((p) => p.id === paqueteId);
      if (idx === -1) return prev;

      const [pkg] = from.paquetes.splice(idx, 1); // ✅ elimina de origen
      const yaEsta = (to.paquetes ?? []).some((p) => p.id === paqueteId);
      if (!yaEsta) to.paquetes.push(pkg); // ✅ agrega en destino sin duplicar
      return next;
    });
  }

  const opcionesCajas = useMemo(() => (cajas ?? []).map((c) => ({ id: c.id, titulo: c.titulo })), [cajas]);

  return (
    <div className="p-4 space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        {(cajas ?? []).map((caja) => {
          const activaEsta = caja.id === activaId;
          return (
            <div key={caja.id} className={`rounded-2xl border p-4 ${activaEsta ? "ring-2 ring-black" : ""}`}>
              {/* Título clickeable = seleccionar caja */}
              <div className="text-lg font-semibold cursor-pointer mb-2" onClick={() => setActivaId(caja.id)} title="Seleccionar caja">
                {caja.titulo}
              </div>

              <div className="text-xs text-gray-500 mb-2">
                {caja.paquetes?.length ?? 0} paquetes
                {activaEsta && " · Caja activa"}
              </div>

              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {(caja.paquetes ?? []).map((p) => (
                  <div key={p.id} className="border rounded-xl p-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{p.nombre}</div>
                        <div className="text-xs text-gray-500">
                          {p.casilla} · {p.descripcion}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">Mover a</label>
                        <select
                          className="border rounded-lg px-2 py-1"
                          value=""
                          onChange={(e) =>
                            moverPaquete({
                              paqueteId: p.id,
                              desdeCajaId: caja.id,
                              haciaCajaId: e.target.value,
                            })
                          }
                        >
                          <option value="">Seleccionar…</option>
                          {opcionesCajas
                            .filter((x) => x.id !== caja.id)
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.titulo}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                {(caja.paquetes ?? []).length === 0 && <div className="text-sm text-gray-500">Sin paquetes</div>}
              </div>
            </div>
          );
        })}
      </div>

      {activa && (
        <div className="rounded-2xl border p-4">
          <div className="text-lg font-semibold mb-2">Caja seleccionada: {activa.titulo}</div>
          <div className="text-sm text-gray-600">Paquetes en esta caja: {activa.paquetes?.length ?? 0}</div>
        </div>
      )}
    </div>
  );
}

/* ============================= Pestaña: Extras ============================= */
function TabExtras({ extras, setExtras }) {
  function eliminar(id) {
    setExtras((prev) => prev.filter((x) => x.id !== id));
  }
  return (
    <div className="p-4 space-y-4">
      <div className="overflow-auto border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-2">Fecha</th>
              <th className="p-2">Descripción</th>
              <th className="p-2">Monto</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {extras.map((x) => (
              <tr key={x.id} className="border-t">
                <td className="p-2">{(x.fecha ?? "").slice(0, 10)}</td>
                <td className="p-2">{x.descripcion}</td>
                <td className="p-2">{formatPrecio(x.monto)}</td>
                <td className="p-2">
                  <button className="px-2 py-1 rounded-lg border" onClick={() => eliminar(x.id)} title="Eliminar">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {extras.length === 0 && (
              <tr>
                <td className="p-4 text-gray-500" colSpan={4}>
                  No hay extras para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================== APP ================================== */
export default function App() {
  // Fuente de verdad para selects (coinciden con “Recepción”)
  const [couriers] = useState(DEMO_COURIERS);
  const [estados] = useState(DEMO_ESTADOS);

  // Datos
  const [paquetes, setPaquetes] = useState(DEMO_PAQUETES);
  const [cajas, setCajas] = useState(DEMO_CAJAS);
  const [extras, setExtras] = useState(DEMO_EXTRAS);

  // Tab actual
  const [tab, setTab] = useState("recepcion");

  // (Opcional) Definí tu impresión real para Zebra/ZPL acá y se usará en Paquetes en bodega
  if (typeof window !== "undefined" && typeof window.printLabelForPackage !== "function") {
    window.printLabelForPackage = (p) => {
      // Placeholder: dejá así o reemplazá por tu lógica ZPL
      // (el fallback de la pestaña también imprime si quitás esta función)
      const w = window.open("", "_blank", "width=800,height=600");
      if (!w) return;
      w.document.write(`<pre style="font-family: monospace; padding:16px;">
Impresión simulada para: ${p.id}
Nombre: ${p.nombre}
Casilla: ${p.casilla}
Peso: ${formatPeso(p.peso)} kg
      </pre>`);
      w.document.close();
      setTimeout(() => {
        try { w.print(); } catch (_) {}
        try { w.close(); } catch (_) {}
      }, 50);
    };
  }

  const tabs = [
    { key: "recepcion", label: "Recepción" },
    { key: "bodega", label: "Paquetes en bodega" },
    { key: "cajas", label: "Armado de cajas" },
    { key: "extras", label: "Extras" },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">Europa Envíos — Dashboard</h1>
      <Tabs value={tab} onChange={setTab} items={tabs} />

      {tab === "recepcion" && <TabRecepcionDemo couriers={couriers} estados={estados} />}
      {tab === "bodega" && (
        <TabPaquetesEnBodega paquetes={paquetes} setPaquetes={setPaquetes} couriers={couriers} estados={estados} />
      )}
      {tab === "cajas" && <TabArmadoDeCajas cajas={cajas} setCajas={setCajas} />}
      {tab === "extras" && <TabExtras extras={extras} setExtras={setExtras} />}
    </div>
  );
}
