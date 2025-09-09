/* === Helpers para visibilidad de couriers (usar en todas las vistas) === */
const norm = (s) => deaccent(String(s || "")).toUpperCase().trim();
const courierPrefix = (name) => norm(name).replace(/\s+/g, ""); // ej: "Global Box" -> "GLOBALBOX"

/** Un paquete es "mío" si:
 *  - soy ADMIN (veo todo), o
 *  - el campo courier coincide (ignorando acentos/mayúsculas), o
 *  - el código del paquete empieza con el prefijo del courier (GLOBALBOX1, BUZON3, etc.)
 */
const isMine = (pkg, user) => {
  if (!user || user.role !== "COURIER") return true;
  const sameCourier = norm(pkg.courier) === norm(user.courier);
  const byPrefix = norm(pkg.codigo || "").startsWith(courierPrefix(user.courier));
  return sameCourier || byPrefix; // <<--- O (no Y)
};

/* === PasswordInput reutilizable SIN pérdida de foco ===
   - No roba el foco al tipear.
   - El botón "Ver/Ocultar" no cambia el foco (mouseDown preventDefault + tabIndex=-1).
   - Mantiene la posición del caret al togglear.
*/
function PasswordInput({ value, onChange, placeholder, autoComplete = "new-password" }) {
  const [show, setShow] = React.useState(false);
  const inputRef = React.useRef(null);

  // Al cambiar show, preservamos el foco y caret
  React.useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    if (document.activeElement === el) {
      // re-enfocar y restaurar caret en el mismo lugar
      setTimeout(() => {
        try { el.focus(); el.setSelectionRange(pos, pos); } catch {}
      }, 0);
    }
  }, [show]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoCapitalize="off"
        spellCheck={false}
        className="w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 ring-indigo-500"
      />
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()} // no robar foco
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600"
      >
        {show ? "Ocultar" : "Ver"}
      </button>
    </div>
  );
}
/* === Persistencia de usuarios === */
const USERS_KEY = "europaenvios_users_v1";

const loadUsers = () => {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch { return []; }
};
const saveUsers = (users) => localStorage.setItem(USERS_KEY, JSON.stringify(users));

/* Crea un ADMIN por defecto si la base está vacía (para primer ingreso) */
function ensureAdminSeed() {
  const users = loadUsers();
  const hasAdmin = users.some(u => u.role === "ADMIN");
  if (!hasAdmin) {
    users.push({
      id: uuid(),
      email: "admin@europa.local",
      password: "admin",
      role: "ADMIN",
      courier: null,
    });
    saveUsers(users);
  }
}
ensureAdminSeed();

/* === Login con PasswordInput (sin pérdida de foco) === */
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const users = loadUsers();

  const submit = () => {
    const user = users.find(u => norm(u.email) === norm(email));
    if (!user || String(user.password) !== String(password)) {
      alert("Email o contraseña incorrectos.");
      return;
    }
    onLogin({ email: user.email, role: user.role, courier: user.courier || null, id: user.id });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow p-6 w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-4">Acceso al sistema</h1>

        <Field label="Email" required>
          <Input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@empresa.com"/>
        </Field>

        <Field label="Contraseña" required>
          <PasswordInput value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" />
        </Field>

        <button
          onClick={submit}
          className={BTN_PRIMARY+" w-full mt-2"}
          disabled={!email || !password}
        >
          Entrar
        </button>

        <div className="text-xs text-gray-500 mt-3">
          Si es tu primer ingreso, usa <b>admin@europa.local / admin</b> y luego creá usuarios en la pestaña <b>Usuarios</b>.
        </div>
      </div>
    </div>
  );
}

/* === Gestión de Usuarios (ADMIN) === */
function Usuarios({ currentUser, onCurrentUserChange }) {
  const [users, setUsers] = useState(loadUsers());
  const [form, setForm] = useState({ email:"", role:"COURIER", courier:"", password:"" });

  useEffect(()=>{ saveUsers(users); }, [users]);

  const add = () => {
    const { email, role, courier, password } = form;
    if (!email || !password) { alert("Email y contraseña son obligatorios."); return; }
    if (users.some(u => norm(u.email) === norm(email))) { alert("Ese email ya existe."); return; }
    if (role === "COURIER" && !courier) { alert("Seleccioná el Courier para este usuario."); return; }
    const u = { id: uuid(), email, role, courier: role==="COURIER" ? courier : null, password };
    setUsers([ ...users, u ]);
    setForm({ email:"", role:"COURIER", courier:"", password:"" });
  };

  const upd = (id, patch) => setUsers(users.map(u => u.id===id ? { ...u, ...patch } : u));
  const del = (id) => {
    if (id === currentUser?.id) { alert("No podés eliminar el usuario con el que estás logueado."); return; }
    const u = users.find(x=>x.id===id);
    const ok = window.confirm(`¿Eliminar ${u?.email || "usuario"}?`);
    if (!ok) return;
    setUsers(users.filter(u => u.id !== id));
  };

  const changeMyPassword = (newPass) => {
    if (!currentUser) return;
    const updated = users.map(u => u.id===currentUser.id ? { ...u, password:newPass } : u);
    setUsers(updated);
    // refrescar objeto de sesión si hiciera falta en el futuro
    onCurrentUserChange?.(currentUser);
  };

  return (
    <Section
      title="Usuarios"
      right={<div className="text-sm text-gray-500">Sólo ADMIN</div>}
    >
      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <Field label="Email" required>
          <Input value={form.email} onChange={e=>setForm({...form, email:e.target.value})} placeholder="user@empresa.com" />
        </Field>
        <Field label="Rol" required>
          <select className="w-full rounded-xl border px-3 py-2"
                  value={form.role}
                  onChange={e=>setForm({...form, role:e.target.value})}>
            <option>ADMIN</option>
            <option>COURIER</option>
          </select>
        </Field>
        <Field label="Courier">
          <select className="w-full rounded-xl border px-3 py-2"
                  value={form.courier}
                  onChange={e=>setForm({...form, courier:e.target.value})}
                  disabled={form.role!=="COURIER"}>
            <option value="">—</option>
            {COURIERS_INICIALES.map(c=> <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Contraseña" required>
          <PasswordInput value={form.password} onChange={e=>setForm({...form, password:e.target.value})} placeholder="••••••••" />
        </Field>
        <div className="md:col-span-4 flex justify-end">
          <button onClick={add} className={BTN_PRIMARY}>Crear usuario</button>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {["Email","Rol","Courier","Contraseña","Acciones"].map(h=>(
                <th key={h} className="text-left px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u=>(
              <tr key={u.id} className="border-b">
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">
                  <select className="border rounded px-2 py-1"
                          value={u.role}
                          onChange={e=>upd(u.id,{ role:e.target.value, courier: e.target.value==="COURIER" ? (u.courier||"") : null })}>
                    <option>ADMIN</option>
                    <option>COURIER</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select className="border rounded px-2 py-1"
                          value={u.courier || ""}
                          onChange={e=>upd(u.id,{ courier:e.target.value })}
                          disabled={u.role!=="COURIER"}>
                    <option value="">—</option>
                    {COURIERS_INICIALES.map(c=> <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <div className="max-w-xs">
                    <PasswordInput
                      value={u.password}
                      onChange={e=>upd(u.id,{ password:e.target.value })}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button className="px-2 py-1 border rounded"
                            onClick={()=>alert("Los cambios se guardan automáticamente.")}>
                      Guardado
                    </button>
                    <button className="px-2 py-1 border rounded text-red-600" onClick={()=>del(u.id)}>
                      Eliminar
                    </button>
                    {currentUser?.id===u.id && (
                      <button className="px-2 py-1 border rounded"
                              onClick={()=>changeMyPassword(prompt("Nueva contraseña:", u.password) || u.password)}>
                        Cambiar mi contraseña
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length===0 && (
              <tr><td colSpan={5} className="text-center text-gray-500 py-6">Sin usuarios.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
/* ========== Paquetes en bodega (filtro por isMine + sin edición para COURIER) ========== */
function PaquetesBodega({packages, flights, user, onUpdate, onDelete}){
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

  // 1) Filtro base (estado/carga/fechas/búsqueda) + 2) visibilidad por courier (isMine)
  const baseRows = packages
    .filter(p => flights.find(f=>f.id===p.flight_id)?.estado==="En bodega")
    .filter(p => !flightId || p.flight_id===flightId)
    .filter(p => !dateFrom || (p.fecha||"") >= dateFrom)
    .filter(p => !dateTo   || (p.fecha||"") <= dateTo)
    .filter(p => (p.codigo + p.casilla + p.tracking + p.nombre_apellido + p.courier).toLowerCase().includes(q.toLowerCase()))
    .filter(p => isMine(p, user)); // <<< clave: courier ve solo lo suyo

  const getSortVal = (p, key)=>{
    switch(key){
      case "carga": {
        const carga = flights.find(f=>f.id===p.flight_id)?.codigo || "";
        return carga.toLowerCase();
      }
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

  // Export (sin cambios)
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

  const requestDelete = (p)=>{
    const ok = window.confirm(`¿Eliminar el paquete ${p.codigo}? Esta acción no se puede deshacer.`);
    if(!ok) return;
    if(typeof onDelete === "function") onDelete(p.id);
  };

  // Etiqueta para un paquete (sin acentos en barcode)
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

  const isCourier = user.role==="COURIER";

  return (
    <Section title="Paquetes en bodega"
      right={
        <div className="flex gap-2 flex-wrap items-end">
          <select className="rounded-xl border px-3 py-2" value={flightId} onChange={e=>setFlightId(e.target.value)}>
            <option value="">Todas las cargas (En bodega)</option>
            {vuelosBodega.map(f=><option key={f.id} value={f.id}>{f.codigo}</option>)}
          </select>
          <Field label="Desde">
            <Input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
          </Field>
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
              <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={()=>toggleSort("exceso")}>Exceso de volumen<Arrow col="exceso"/></th>
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
                      <button className="px-2 py-1 border rounded" onClick={()=>start(p)} disabled={isCourier}>Editar</button>
                      <button className="px-2 py-1 border rounded" onClick={()=>printPkgLabel(p)}>Etiqueta</button>
                      <button className="px-2 py-1 border rounded text-red-600" onClick={()=>requestDelete(p)} disabled={isCourier}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length===0 && <tr><td colSpan={12} className="text-center text-gray-500 py-6">No hay paquetes.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Gráficos (sin cambios) */}
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {(() => {
          const aggReal = {}; const aggExc = {};
          rows.forEach(p=>{ aggReal[p.courier]=(aggReal[p.courier]||0)+p.peso_real; aggExc[p.courier]=(aggExc[p.courier]||0)+p.exceso_volumen; });
          const dataReal = Object.entries(aggReal).map(([courier,kg_real])=>({courier,kg_real}));
          const dataExc  = Object.entries(aggExc).map(([courier,kg_exceso])=>({courier,kg_exceso}));
          const totalReal = sum(dataReal.map(d=>d.kg_real));
          const totalExc = sum(dataExc.map(d=>d.kg_exceso));
          return (
            <>
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
            </>
          );
        })()}
      </div>

      {/* Modal edición */}
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
                const opts = estadosPermitidosPorCarga(codigo);
                return (
                  <select className="w-full rounded-xl border px-3 py-2" value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})} disabled={user.role==="COURIER"}>
                    {opts.map(s=><option key={s}>{s}</option>)}
                  </select>
                );
              })()}
            </Field>

            <Field label="Casilla"><Input value={form.casilla} onChange={e=>setForm({...form,casilla:e.target.value})} disabled={user.role==="COURIER"}/></Field>
            <Field label="Código de paquete"><Input value={form.codigo} onChange={e=>setForm({...form,codigo:deaccent(String(e.target.value||"")).toUpperCase()})} disabled={user.role==="COURIER"}/></Field>
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

      {/* Visor de foto */}
      <Modal open={!!viewer} onClose={()=>setViewer(null)} title="Foto">
        {viewer && <img src={viewer} alt="foto" className="max-w-full rounded-xl" />}
      </Modal>
    </Section>
  );
}
/* ========== Cargas enviadas (solo ve lo propio si es COURIER) ========== */
function CargasEnviadas({packages, flights, user}){
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [estado,setEstado]=useState("");
  const [flightId,setFlightId]=useState("");

  // Vuelos enviados (no en bodega) y con algún paquete "mío" si soy courier
  const list = useMemo(()=>{
    return flights
      .filter(f=>f.estado!=="En bodega")
      .filter(f=>!from || f.fecha_salida>=from)
      .filter(f=>!to || f.fecha_salida<=to)
      .filter(f=>!estado || f.estado===estado)
      .filter(f=>{
        if(user.role!=="COURIER") return true;
        return packages.some(p=>p.flight_id===f.id && isMine(p,user));
      });
  },[flights, packages, user, from, to, estado]);

  const flight = flights.find(f=>f.id===flightId && list.some(x=>x.id===f.id));

  // Paquetes visibles en el vuelo elegido (filtrados por courier si corresponde)
  const paquetesDeVuelo = useMemo(()=>{
    if(!flight) return [];
    const rows = packages.filter(p=>p.flight_id===flight.id);
    return (user.role==="COURIER") ? rows.filter(p=>isMine(p,user)) : rows;
  },[packages, flight, user]);

  // Resumen por cajas: sólo cajas que contengan al menos 1 paquete visible
  const resumen = useMemo(()=>{
    if(!flight) return [];
    const res = [];
    flight.cajas.forEach((c,i)=>{
      const ids = new Set(c.paquetes||[]);
      const miosEnCaja = paquetesDeVuelo.filter(p=>ids.has(p.id));
      if(miosEnCaja.length===0) return; // ocultar cajas sin paquetes míos
      const peso=parseComma(c.peso||"0");
      const L=parseIntEU(c.L||0), A=parseIntEU(c.A||0), H=parseIntEU(c.H||0);
      const vol=(A*H*L)/6000 || 0;
      // etiqueta original (puede seguir diciendo MULTICOURIER, está bien para info)
      const couriers = new Set(miosEnCaja.map(p=>p.courier).filter(Boolean));
      const etiqueta = couriers.size===0? "—" : (couriers.size===1? [...couriers][0] : "MULTICOURIER");
      res.push({n:i+1, courier:etiqueta, peso, L,A,H, vol});
    });
    return res;
  },[flight, paquetesDeVuelo]);

  const totPeso=sum(resumen.map(r=>r.peso));
  const totVol=sum(resumen.map(r=>r.vol));

  async function exportTodo(){
    if(!flight) return;
    const headerP=[th("COURIER"),th("CÓDIGO"),th("CASILLA"),th("FECHA"),th("NOMBRE"),th("TRACKING"),th("PESO REAL"),th("FACTURABLE"),th("VOLUMÉTRICO"),th("EXCESO"),th("DESCRIPCIÓN")];
    const bodyP=paquetesDeVuelo.map(p=>[
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
                {paquetesDeVuelo.map(p=>(
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
                {paquetesDeVuelo.length===0 && (
                  <tr><td colSpan={10} className="text-center text-gray-500 py-6">No hay paquetes visibles para tu usuario.</td></tr>
                )}
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
                {resumen.length>0 && (
                  <tr><td></td><td className="px-3 py-2 font-semibold">Totales</td><td className="px-3 py-2 font-semibold">{fmtPeso(totPeso)}</td><td></td><td></td><td></td><td className="px-3 py-2 font-semibold">{fmtPeso(totVol)}</td></tr>
                )}
                {resumen.length===0 && (
                  <tr><td colSpan={7} className="text-center text-gray-500 py-6">No hay cajas con paquetes visibles para tu usuario.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  );
}
/* ========== Tabs permitidas por rol ========== */
function tabsForRole(role){
  if(role === "ADMIN"){
    return [
      "Recepción",
      "Paquetes en bodega",
      "Armado de cajas",
      "Cargas enviadas",
      "Gestión de cargas",
      "Proformas",
      "Usuarios",
      "Extras",
    ];
  }
  // COURIER
  return ["Paquetes en bodega","Cargas enviadas"];
}

/* ========== App ========== */
function App(){
  const [currentUser,setCurrentUser]=useState(null);

  // pestaña actual; se ajusta cuando cambia el usuario
  const [tab,setTab]=useState("Recepción");

  const [couriers,setCouriers]=useState(COURIERS_INICIALES);
  const [estados,setEstados]=useState(ESTADOS_INICIALES);

  // Sin cargas por defecto
  const [flights,setFlights]=useState([]);
  const [packages,setPackages]=useState([]);
  const [extras,setExtras]=useState([]);

  // al cambiar usuario, si la pestaña no es válida para su rol, saltar a la primera permitida
  useEffect(()=>{
    if(!currentUser) return;
    const allowed = tabsForRole(currentUser.role);
    if(!allowed.includes(tab)) setTab(allowed[0]);
    // si es courier y está en "Recepción", lo mandamos a "Paquetes en bodega"
    if(currentUser.role==="COURIER" && tab==="Recepción") setTab("Paquetes en bodega");
  },[currentUser]); // eslint-disable-line

  if(!currentUser) return <Login onLogin={setCurrentUser} />;

  const allowedTabs = tabsForRole(currentUser.role);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* header simple */}
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
              className={"px-3 py-2 rounded-xl text-sm "+(tab===t?"bg-indigo-600 text-white":"bg-white border")}
            >
              {t}
            </button>
          ))}
        </div>

        {tab==="Recepción" && currentUser.role==="ADMIN" && (
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
            onDelete={(id)=>setPackages(packages.filter(p=>p.id!==id))}
          />
        )}

        {tab==="Armado de cajas" && currentUser.role==="ADMIN" && (
          <ArmadoCajas
            packages={packages}
            flights={flights}
            setFlights={setFlights}
            onAssign={(id)=>setPackages(packages.map(p=>p.id===id?p:{...p}))}
          />
        )}

        {tab==="Cargas enviadas" && (
          <CargasEnviadas packages={packages} flights={flights} user={currentUser} />
        )}

        {tab==="Gestión de cargas" && currentUser.role==="ADMIN" && (
          <CargasAdmin flights={flights} setFlights={setFlights} packages={packages} />
        )}

        {tab==="Proformas" && currentUser.role==="ADMIN" && (
          <Proformas packages={packages} flights={flights} extras={extras} />
        )}

        {tab==="Usuarios" && currentUser.role==="ADMIN" && (
          <Usuarios
            currentUser={currentUser}
            onCurrentUserChange={(u)=>setCurrentUser(u)}
          />
        )}

        {tab==="Extras" && currentUser.role==="ADMIN" && (
          <Extras flights={flights} couriers={couriers} extras={extras} setExtras={setExtras} />
        )}
      </div>
    </div>
  );
}

export default App;
