/* ========== Armado de cajas (actualizado) ========== */
function ArmadoCajas({packages, flights, setFlights, onAssign}){
  const [flightId,setFlightId]=useState("");
  const flight = flights.find(f=>f.id===flightId);
  const [boxCode,setBoxCode]=useState("");
  const [activeBoxId,setActiveBoxId]=useState(null);
  const [scan,setScan]=useState("");

  function addBox(){
    const name = boxCode.trim();
    if(!flightId || !name) return;
    const id = uuid();
    setFlights(flights.map(f=>f.id!==flightId ? f : {
      ...f,
      cajas:[...f.cajas,{id, codigo:name, paquetes:[], peso:"", L:"", A:"", H:""}]
    }));
    setActiveBoxId(id);      // seleccionar la caja recién creada
    setBoxCode("");
  }

  function updBox(field,val){
    if(!flightId||!activeBoxId) return;
    setFlights(flights.map(f=>f.id!==flightId?f:{
      ...f,
      cajas:f.cajas.map(c=>c.id!==activeBoxId?c:{...c,[field]:val})
    }));
  }

  function assign(){
    if(!scan||!activeBoxId||!flight) return;
    const pkg = packages.find(p=> p.flight_id===flightId && p.codigo.toUpperCase()===scan.toUpperCase());
    if(!pkg){ alert("No existe ese código en esta carga."); setScan(""); return; }
    if(flight.cajas.some(c=>c.paquetes.includes(pkg.id))){ alert("Ya está en una caja."); setScan(""); return; }
    setFlights(flights.map(f=>f.id!==flightId?f:{
      ...f,
      cajas:f.cajas.map(c=>c.id!==activeBoxId?c:{...c,paquetes:[...c.paquetes, pkg.id]})
    }));
    onAssign(pkg.id); setScan("");
  }

  const volCaja=(c)=> (parseIntEU(c.A)*parseIntEU(c.H)*parseIntEU(c.L))/6000 || 0;

  /* mover sin duplicar: una sola actualización */
  function move(pid, fromId, toId){
    if(!toId||!flight || fromId===toId) return;
    setFlights(prev=>{
      return prev.map(f=>{
        if(f.id!==flightId) return f;
        const cajas = f.cajas.map(c=>({...c, paquetes:[...c.paquetes]}));
        const from = cajas.find(c=>c.id===fromId);
        const to = cajas.find(c=>c.id===toId);
        if(!from || !to) return f;
        from.paquetes = from.paquetes.filter(x=>x!==pid);
        if(!to.paquetes.includes(pid)) to.paquetes.push(pid);
        return {...f, cajas};
      });
    });
  }

  // export con plantilla (usa el nombre de la caja)
  async function exportBoxes(){
    if(!flight) return;
    const sheets=[];
    flight.cajas.forEach((caja)=>{
      const byCourier={};
      caja.paquetes.forEach(pid=>{
        const p=packages.find(x=>x.id===pid); if(!p) return;
        (byCourier[p.courier] ||= []).push(p.codigo);
      });
      const headers = Object.keys(byCourier);
      const max = headers.reduce((m,k)=>Math.max(m,byCourier[k].length),0);
      const rows=[];
      rows.push([th("CONTROL DE PAQUETES")]);
      rows.push([td(`CAJA: ${caja.codigo}`), td(`CANT PAQUETES: ${caja.paquetes.length}`)]);
      const peso = parseComma(caja.peso||"0"), L=parseIntEU(caja.L||0), A=parseIntEU(caja.A||0), H=parseIntEU(caja.H||0);
      rows.push([td(`Peso: ${fmtPeso(peso)} kg`), td(`Medidas: ${L}x${A}x${H} cm`), td(`Vol: ${fmtPeso(volCaja(caja))} kg`)]);
      rows.push(headers.map(h=>th(h)));
      for(let r=0;r<max;r++) rows.push(headers.map(h=>td(byCourier[h][r]||"")));
      const { ws } = sheetFromAOAStyled(caja.codigo, rows, {
        cols:[{wch:22},{wch:28},{wch:20},{wch:20},{wch:20},{wch:20}],
        rows:[{hpt:26},{hpt:20},{hpt:20},{hpt:24}]
      });
      // nombre de hoja = nombre de la caja (limitado a 31 chars)
      const sheetName = (caja.codigo || "CAJA").slice(0,31);
      sheets.push({name: sheetName, ws});
    });

    const tpl = await tryLoadTemplate("/templates/cajas.xlsx");
    if(tpl){
      replacePlaceholdersInWB(tpl, { CARGA: flight.codigo, FECHA: flight.fecha_salida||"" });
      const resumen = flight.cajas.map((c)=> [ c.codigo, fmtPeso(parseComma(c.peso||"0")), String(parseIntEU(c.L||0)), String(parseIntEU(c.A||0)), String(parseIntEU(c.H||0)), fmtPeso(volCaja(c)) ]);
      appendSheet(tpl, "RESUMEN", [[th("Caja"),th("Peso"),th("L"),th("A"),th("H"),th("Vol")], ...resumen]);
      sheets.forEach(s=>XLSX.utils.book_append_sheet(tpl, s.ws, s.name));
      XLSX.writeFile(tpl, `Armado_de_cajas_${flight.codigo}.xlsx`);
      return;
    }
    downloadXLSX(`Armado_de_cajas_${flight.codigo}.xlsx`, sheets.length? sheets : [{name:"CAJAS", ws: sheetFromAOAStyled("CAJAS", [[td("Sin cajas")]]).ws}]);
  }

  return (
    <Section title="Armado de cajas">
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Seleccionar carga" required>
          <select
            className="w-full rounded-xl border px-3 py-2"
            value={flightId}
            onChange={e=>{setFlightId(e.target.value); setActiveBoxId(null);}}
          >
            <option value="">—</option>
            {flights.filter(f=>f.estado==="En bodega").map(f=>
              <option key={f.id} value={f.id}>{f.codigo} · {f.fecha_salida}</option>
            )}
          </select>
        </Field>

        {/* Crear caja con nombre libre (ejemplo: "Caja 1") */}
        <Field label="Crear caja">
          <div className="flex gap-2">
            <Input placeholder="Caja 1" value={boxCode} onChange={e=>setBoxCode(e.target.value)}/>
            <button onClick={addBox} disabled={!flightId} className={"px-3 py-2 bg-gray-800 text-white rounded-xl disabled:opacity-50"}>Agregar</button>
          </div>
        </Field>

        {/* ⚡ Se quita el desplegable "Caja activa". Seguís eligiendo caja haciendo click en su título. */}

        <Field label="Escanear / ingresar código">
          <Input value={scan} onChange={e=>setScan(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&assign()} placeholder="BOSSBOX1"/>
        </Field>

        {activeBoxId && (
          <>
            <Field label="Peso caja (kg)"><Input value={flight.cajas.find(c=>c.id===activeBoxId)?.peso||""} onChange={e=>updBox("peso", e.target.value)} placeholder="3,128"/></Field>
            <Field label="Largo (cm)"><Input value={flight.cajas.find(c=>c.id===activeBoxId)?.L||""} onChange={e=>updBox("L", e.target.value)}/></Field>
            <Field label="Ancho (cm)"><Input value={flight.cajas.find(c=>c.id===activeBoxId)?.A||""} onChange={e=>updBox("A", e.target.value)}/></Field>
            <Field label="Alto (cm)"><Input value={flight.cajas.find(c=>c.id===activeBoxId)?.H||""} onChange={e=>updBox("H", e.target.value)}/></Field>
          </>
        )}

        <div className="md:col-span-3">
          {!flight && <div className="text-gray-500">Seleccioná una carga.</div>}
          {flight && flight.cajas.map((c)=>{
            const couriers = new Set(c.paquetes.map(pid=>packages.find(p=>p.id===pid)?.courier).filter(Boolean));
            const etiqueta = couriers.size===0? "—" : (couriers.size===1? [...couriers][0] : "MULTICOURIER");
            const peso = parseComma(c.peso||"0");
            const L=parseIntEU(c.L||0), A=parseIntEU(c.A||0), H=parseIntEU(c.H||0);
            const activa = activeBoxId===c.id;
            return (
              <div key={c.id} className={`border rounded-2xl p-3 mb-3 ${activa?"ring-2 ring-indigo-500":""}`}>
                {/* Título clickeable: usa el NOMBRE de la caja */}
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="font-medium cursor-pointer"
                    title="Seleccionar esta caja"
                    onClick={()=>setActiveBoxId(c.id)}
                  >
                    {c.codigo} — {etiqueta} — <span className="font-semibold">{fmtPeso(peso)} kg</span> — {L}x{A}x{H} cm
                  </div>
                </div>
                <ul className="text-sm max-h-48 overflow-auto">
                  {c.paquetes.map(pid=>{
                    const p=packages.find(x=>x.id===pid); if(!p) return null;
                    return (
                      <li key={pid} className="flex items-center gap-2 py-1 border-b">
                        <span className="font-mono">{p.codigo}</span><span className="text-gray-600">{p.courier}</span>
                        <button className="text-red-600 text-xs" onClick={()=>setFlights(flights.map(f=>f.id!==flightId?f:{...f,cajas:f.cajas.map(x=>x.id!==c.id?x:{...x,paquetes:x.paquetes.filter(z=>z!==pid)})}))}>Quitar</button>
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

        <div className="md:col-span-3 flex justify-end">
          <button onClick={exportBoxes} disabled={!flight} className={BTN_PRIMARY+" disabled:opacity-50"}>Exportar XLSX (cajas)</button>
        </div>
      </div>
    </Section>
  );
}
