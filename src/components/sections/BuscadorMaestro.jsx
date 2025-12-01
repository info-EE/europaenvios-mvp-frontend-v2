/* eslint-disable react/prop-types */
import React, { useState, useMemo } from "react";
import { Section } from "../common/Section.jsx";
import { Input } from "../common/Input.jsx";
import { EmptyState } from "../common/EmptyState.jsx";
import { Button } from "../common/Button.jsx";
import { Modal } from "../common/Modal.jsx";
import { Field } from "../common/Field.jsx";
import { ImageViewerModal } from "../common/ImageViewerModal.jsx";
import { Iconos, fmtPeso } from "../../utils/helpers.jsx";

export function BuscadorMaestro({ packages, flights, sinCasillaItems, user }) {
  const [q, setQ] = useState("");
  const [viewerImages, setViewerImages] = useState([]); 
  const [detailsPackage, setDetailsPackage] = useState(null); // Estado para el paquete seleccionado
  
  // Modificación para incluir COURIER_CS
  const isCourier = ["COURIER", "COURIER_CS"].includes(user?.role);
  const courierName = user?.courier;

  // Lógica de búsqueda unificada
  const resultados = useMemo(() => {
    const query = q.toLowerCase().trim();
    if (!query) return [];

    // 1. Buscar en Paquetes (Bodega y Enviados)
    const resultadosPaquetes = packages.filter(p => {
      // Filtro de seguridad para Couriers: Solo ver sus propios paquetes
      if (isCourier && p.courier !== courierName) {
        return false;
      }

      const searchStr = `${p.codigo} ${p.tracking} ${p.nombre_apellido} ${p.casilla} ${p.courier}`.toLowerCase();
      return searchStr.includes(query);
    }).map(p => {
      // Enriquecer con info de la carga
      const vuelo = flights.find(f => f.id === p.flight_id);
      const estadoCarga = vuelo ? vuelo.estado : "Desconocido";
      const codigoCarga = (vuelo ? vuelo.codigo : "—") || "";
      
      let ubicacion = "En Bodega";
      if (estadoCarga !== "En bodega") ubicacion = `Enviado (${estadoCarga})`;

      // Detectar condiciones para colores
      const isComplicado = codigoCarga.toUpperCase().startsWith("COMP");
      const isMaritimo = codigoCarga.toUpperCase().startsWith("MAR");

      return {
        id: p.id,
        tipo: "Paquete",
        ubicacion: ubicacion,
        codigo: p.codigo,
        cliente: p.nombre_apellido,
        tracking: p.tracking,
        infoAdicional: `Carga: ${codigoCarga} | Casilla: ${p.casilla}`,
        fecha: p.fecha,
        createdAt: p.createdAt, 
        courier: p.courier,
        fotos: p.fotos || [],
        isComplicado,
        isMaritimo,
        // Datos completos para el modal de detalles
        peso_real: p.peso_real,
        largo: p.largo,
        ancho: p.ancho,
        alto: p.alto,
        peso_volumetrico: p.peso_volumetrico,
        peso_facturable: p.peso_facturable,
        exceso_volumen: p.exceso_volumen,
        descripcion: p.descripcion,
        remitente: p.remitente,
        empresa_envio: p.empresa_envio,
        casilla: p.casilla,
        carga_codigo: codigoCarga
      };
    });

    // 2. Buscar en Paquetes Sin Casilla
    const resultadosSinCasilla = sinCasillaItems.filter(item => {
      const searchStr = `${item.nombre} ${item.tracking} ${item.numero}`.toLowerCase();
      return searchStr.includes(query);
    }).map(item => ({
      id: item.id,
      tipo: "Sin Casilla",
      ubicacion: "Recepción (Sin Casilla)",
      codigo: `SC-${item.numero}`,
      cliente: item.nombre,
      tracking: isCourier ? "—" : (item.tracking || "—"), 
      infoAdicional: "Pendiente de asignar",
      fecha: item.fecha,
      createdAt: item.createdAt || item.fecha,
      courier: "—",
      fotos: item.foto ? [item.foto] : [],
      isSinCasilla: true,
      // Datos mínimos para el modal
      descripcion: "Paquete registrado sin casilla asignada.",
      peso_real: 0, largo: 0, ancho: 0, alto: 0
    }));

    // Combinar y ordenar
    return [...resultadosPaquetes, ...resultadosSinCasilla].sort((a, b) => {
      const dateA = a.createdAt || a.fecha || "";
      const dateB = b.createdAt || b.fecha || "";
      if (dateA < dateB) return 1;
      if (dateA > dateB) return -1;
      return 0;
    });

  }, [q, packages, flights, sinCasillaItems, isCourier, courierName]);

  // Función para determinar los colores del header del modal
  const getHeaderColors = (pkg) => {
    if (pkg.isComplicado) {
      return {
        bg: "bg-red-100 border-red-200",
        text: "text-red-900",
        label: "text-red-800/70"
      };
    }
    if (pkg.isSinCasilla) {
      return {
        bg: "bg-yellow-100 border-yellow-200",
        text: "text-yellow-900",
        label: "text-yellow-800/70"
      };
    }
    if (pkg.isMaritimo) {
      return {
        bg: "bg-sky-100 border-sky-200",
        text: "text-sky-900",
        label: "text-sky-800/70"
      };
    }
    // Default (Aéreo / Normal)
    return {
      bg: "bg-slate-50 border-slate-200",
      text: "text-slate-800",
      label: "text-slate-500"
    };
  };

  return (
    <Section title="Buscador de paquetes">
      <div className="mb-6">
        <Input 
          placeholder="Escribe para buscar (Código, Tracking, Nombre, Casilla...)" 
          value={q} 
          onChange={(e) => setQ(e.target.value)} 
          className="text-lg py-3"
          autoFocus
        />
        <p className="text-xs text-slate-500 mt-2 ml-1">
          Buscando en: Paquetes en bodega, Cargas enviadas y Paquetes sin casilla.
        </p>
      </div>

      {q === "" ? (
        <EmptyState 
          icon={Iconos.gestion} 
          title="Empieza a buscar" 
          message="Ingresa algún dato del paquete para encontrarlo en todo el sistema." 
        />
      ) : resultados.length === 0 ? (
        <EmptyState 
          icon={Iconos.box} 
          title="Sin resultados" 
          message={`No se encontró nada con "${q}".`} 
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm relative max-h-[600px]">
          <table className="min-w-full text-sm bg-white">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Tipo / Ubicación</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Código</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Cliente</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Tracking</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Info Extra</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Fecha</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resultados.map((row) => {
                const showPhoto = !isCourier || row.tipo === "Paquete";

                let rowClass = "hover:bg-francia-50 transition-colors";
                if (row.isComplicado) rowClass = "bg-red-100 hover:bg-red-200 text-red-900";
                else if (row.isSinCasilla) rowClass = "bg-yellow-100 hover:bg-yellow-200 text-yellow-900";
                else if (row.isMaritimo) rowClass = "bg-sky-100 hover:bg-sky-200 text-sky-900";

                return (
                  <tr key={`${row.tipo}-${row.id}`} className={rowClass}>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        row.tipo === "Sin Casilla" ? "bg-white text-red-800 border border-red-200" :
                        row.ubicacion === "En Bodega" ? "bg-blue-100 text-blue-800" :
                        "bg-green-100 text-green-800"
                      }`}>
                        {row.ubicacion}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold whitespace-nowrap">{row.codigo}</td>
                    <td className="px-4 py-3 font-semibold">{row.cliente}</td>
                    <td className="px-4 py-3 font-mono opacity-80">{row.tracking}</td>
                    <td className="px-4 py-3 text-xs opacity-90">{row.infoAdicional}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.fecha}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* Botón Ver Detalles */}
                        {row.tipo === "Paquete" && (
                            <Button 
                                variant="secondary" 
                                className="!px-2 !py-1 text-xs bg-white/50 hover:bg-white"
                                onClick={() => setDetailsPackage(row)}
                                title="Ver información completa"
                            >
                                Ver detalles
                            </Button>
                        )}

                        {/* Botón Ver Foto */}
                        {showPhoto && row.fotos && row.fotos.length > 0 ? (
                          <Button 
                            variant="secondary" 
                            className="!px-2 !py-1 text-xs bg-white/50 hover:bg-white" 
                            onClick={() => setViewerImages(row.fotos)}
                          >
                            Ver foto
                          </Button>
                        ) : (
                          row.tipo === "Paquete" && <span className="opacity-50 text-xs px-2">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Detalles del Paquete */}
      <Modal 
        open={!!detailsPackage} 
        onClose={() => setDetailsPackage(null)} 
        title={`Detalles del Paquete: ${detailsPackage?.codigo}`}
        maxWidth="max-w-4xl"
      >
        {detailsPackage && (() => {
            const colors = getHeaderColors(detailsPackage);
            return (
                <div className="space-y-6">
                    {/* Cabecera con información clave y colores dinámicos */}
                    <div className={`${colors.bg} p-4 rounded-lg border grid grid-cols-2 md:grid-cols-4 gap-4`}>
                        <div>
                            <span className={`text-xs uppercase font-bold ${colors.label}`}>Estado</span>
                            <div className={`text-sm font-semibold ${colors.text}`}>{detailsPackage.ubicacion}</div>
                        </div>
                        <div>
                            <span className={`text-xs uppercase font-bold ${colors.label}`}>Carga</span>
                            <div className={`text-sm font-semibold ${colors.text}`}>{detailsPackage.carga_codigo || "N/A"}</div>
                        </div>
                        <div>
                            <span className={`text-xs uppercase font-bold ${colors.label}`}>Fecha</span>
                            <div className={`text-sm font-semibold ${colors.text}`}>{detailsPackage.fecha}</div>
                        </div>
                        <div>
                            <span className={`text-xs uppercase font-bold ${colors.label}`}>Casilla</span>
                            <div className={`text-sm font-semibold ${colors.text}`}>{detailsPackage.casilla}</div>
                        </div>
                    </div>

                    {/* Datos del Cliente y Envío (Sin CI/RUC) */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <Field label="Cliente"><Input value={detailsPackage.cliente} readOnly className="bg-slate-50" /></Field>
                        <Field label="Tracking"><Input value={detailsPackage.tracking} readOnly className="bg-slate-50 font-mono" /></Field>
                        <Field label="Empresa de envío"><Input value={detailsPackage.empresa_envio || ""} readOnly className="bg-slate-50" /></Field>
                        <Field label="Remitente"><Input value={detailsPackage.remitente || ""} readOnly className="bg-slate-50" /></Field>
                        <div className="md:col-span-2">
                            <Field label="Descripción"><Input value={detailsPackage.descripcion || ""} readOnly className="bg-slate-50" /></Field>
                        </div>
                    </div>

                    {/* Pesos y Medidas */}
                    <div>
                        <h4 className="text-sm font-bold text-slate-700 mb-3 border-b pb-1">Pesos y Medidas</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Peso Real: Neutro (Gris) */}
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="text-xs text-slate-500 font-bold">Peso Real</div>
                                <div className="text-lg font-mono text-slate-700">{fmtPeso(detailsPackage.peso_real)} kg</div>
                            </div>
                            {/* Peso Volumétrico: Neutro (Gris) */}
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="text-xs text-slate-500 font-bold">Peso Volumétrico</div>
                                <div className="text-lg font-mono text-slate-700">{fmtPeso(detailsPackage.peso_volumetrico)} kg</div>
                            </div>
                            {/* Exceso Volumen: Resaltado (Naranja) */}
                            <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                                <div className="text-xs text-orange-700 font-bold">Exceso Volumen</div>
                                <div className="text-lg font-mono text-orange-800">{fmtPeso(detailsPackage.exceso_volumen)} kg</div>
                            </div>
                            {/* Peso Facturable: Resaltado (Verde) */}
                            <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                                <div className="text-xs text-green-700 font-bold">Peso Facturable</div>
                                <div className="text-xl font-bold font-mono text-green-800">{fmtPeso(detailsPackage.peso_facturable)} kg</div>
                            </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-4 text-center">
                            <div className="bg-slate-50 p-2 rounded">
                                <span className="text-xs text-slate-500 block">Largo</span>
                                <span className="font-mono font-semibold">{detailsPackage.largo} cm</span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded">
                                <span className="text-xs text-slate-500 block">Ancho</span>
                                <span className="font-mono font-semibold">{detailsPackage.ancho} cm</span>
                            </div>
                            <div className="bg-slate-50 p-2 rounded">
                                <span className="text-xs text-slate-500 block">Alto</span>
                                <span className="font-mono font-semibold">{detailsPackage.alto} cm</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button onClick={() => setDetailsPackage(null)}>Cerrar</Button>
                    </div>
                </div>
            );
        })()}
      </Modal>

      <ImageViewerModal 
        open={viewerImages.length > 0} 
        onClose={() => setViewerImages([])} 
        images={viewerImages} 
      />
    </Section>
  );
}