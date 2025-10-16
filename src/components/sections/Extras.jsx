/* eslint-disable react/prop-types */
import React, { useState, useMemo } from "react";

// Context
import { useModal } from "../../context/ModalContext.jsx";

// Componentes
import { Section } from "../common/Section.jsx";
import { Input } from "../common/Input.jsx";
import { Field } from "../common/Field.jsx";
import { Button } from "../common/Button.jsx";
import { Modal } from "../common/Modal.jsx"; // Importamos el componente Modal

// Helpers & Constantes
import { Iconos } from "../../utils/helpers.jsx";

export function Extras({ flights, couriers, extras, onAdd, onUpdate, onDelete }) {
    const [flightId, setFlightId] = useState("");
    const [courier, setCourier] = useState("");
    const [desc, setDesc] = useState("");
    const [monto, setMonto] = useState("");
    const [estado, setEstado] = useState("Pendiente");
    const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [statusFilter, setStatusFilter] = useState("Pendiente");
    
    // Estado para manejar el modal de edición
    const [editingExtra, setEditingExtra] = useState(null);

    const { showAlert, showConfirmation } = useModal();

    const CargasDisponibles = useMemo(() => {
        return flights.filter(f => {
            const code = (f.codigo || "").toUpperCase();
            return code.startsWith("AIR") || code.startsWith("MAR");
        });
    }, [flights]);

    const add = async () => {
        if (!(flightId && courier && desc && monto)) {
            await showAlert("Campos incompletos", "Por favor, completa todos los campos para agregar un extra.");
            return;
        }
        onAdd({ flight_id: flightId, courier, descripcion: desc, monto, estado, fecha });
        setDesc(""); setMonto("");
    };

    const filtered = extras
        .filter(e => !from || (e.fecha || (flights.find(f => f.id === e.flight_id)?.fecha_salida) || "") >= from)
        .filter(e => !to || (e.fecha || (flights.find(f => f.id === e.flight_id)?.fecha_salida) || "") <= to)
        .filter(e => !flightId || e.flight_id === flightId)
        .filter(e => statusFilter === 'Todos' || e.estado === statusFilter);

    const deleteItem = async (id) => {
        const confirmed = await showConfirmation("Confirmar eliminación", "¿Seguro que quieres eliminar este extra?");
        if (confirmed) {
            onDelete(id);
        }
    };

    // --- Funciones para el modal de edición ---
    const handleEditClick = (extra) => {
        setEditingExtra({ ...extra });
    };

    const handleCancelEdit = () => {
        setEditingExtra(null);
    };

    const handleSaveChanges = () => {
        if (editingExtra) {
            onUpdate(editingExtra);
        }
        setEditingExtra(null);
    };

    return (
        <Section title="Trabajos extras">
            {/* Formulario para agregar nuevos extras */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-4 p-4 bg-slate-50 rounded-lg items-end">
                <Field label="Carga">
                    <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={flightId} onChange={e => setFlightId(e.target.value)}>
                        <option value="">Todas</option>
                        {CargasDisponibles.map(f => <option key={f.id} value={f.id}>{f.codigo}</option>)}
                    </select>
                </Field>
                <Field label="Courier">
                    <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={courier} onChange={e => setCourier(e.target.value)}>
                        <option value="">Seleccionar...</option>
                        {couriers.map(c => <option key={c.id}>{c.name}</option>)}
                    </select>
                </Field>
                <Field label="Descripción"><Input value={desc} onChange={e => setDesc(e.target.value)} /></Field>
                <Field label="Monto (USD)"><Input value={monto} onChange={e => setMonto(e.target.value.replace('.', ','))} placeholder="10,00" /></Field>
                <Field label="Estado">
                    <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={estado} onChange={e => setEstado(e.target.value)}>
                        <option>Pendiente</option>
                        <option>Cobrado</option>
                    </select>
                </Field>
                <Field label="Fecha"><Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></Field>
                <div className="col-span-1 sm:col-span-2 lg:col-span-4 xl:col-span-6 flex justify-end">
                    <Button variant="primary" onClick={add}>Agregar</Button>
                </div>
            </div>

            {/* Filtros de la tabla */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <Field label="Filtrar desde"><Input type="date" value={from} onChange={e => setFrom(e.target.value)}/></Field>
                <Field label="Filtrar hasta"><Input type="date" value={to} onChange={e => setTo(e.target.value)}/></Field>
                <Field label="Filtrar por estado">
                    <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="Pendiente">Pendiente</option>
                        <option value="Cobrado">Cobrado</option>
                        <option value="Todos">Todos</option>
                    </select>
                </Field>
            </div>

            {/* Tabla de extras */}
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50">
                            {["Fecha", "Carga", "Courier", "Descripción", "Monto (USD)", "Estado"].map(h => 
                                <th key={h} className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                            )}
                            <th className="text-right px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filtered.map(e => {
                            const carga = flights.find(f => f.id === e.flight_id)?.codigo || "";
                            return (
                                <tr key={e.id} className="hover:bg-slate-50">
                                    <td className="px-3 py-2 whitespace-nowrap">{e.fecha || flights.find(f => f.id === e.flight_id)?.fecha_salida || ""}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{carga}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{e.courier}</td>
                                    <td className="px-3 py-2 max-w-sm whitespace-normal break-words">{e.descripcion}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{e.monto}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${e.estado === 'Cobrado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {e.estado}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-right">
                                        <Button variant="icon" onClick={() => handleEditClick(e)} title="Editar">{Iconos.edit}</Button>
                                        <Button variant="iconDanger" onClick={() => deleteItem(e.id)} title="Eliminar">{Iconos.delete}</Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Modal de Edición */}
            <Modal open={!!editingExtra} onClose={handleCancelEdit} title="Editar Extra">
                {editingExtra && (
                    <div className="space-y-4">
                        <Field label="Carga">
                            <Input value={flights.find(f => f.id === editingExtra.flight_id)?.codigo || 'N/A'} disabled />
                        </Field>
                         <Field label="Courier">
                            <Input value={editingExtra.courier} disabled />
                        </Field>
                        <Field label="Fecha">
                            <Input 
                                type="date" 
                                value={editingExtra.fecha} 
                                onChange={e => setEditingExtra({...editingExtra, fecha: e.target.value})} 
                            />
                        </Field>
                        <Field label="Descripción">
                            <Input 
                                value={editingExtra.descripcion} 
                                onChange={e => setEditingExtra({...editingExtra, descripcion: e.target.value})} 
                            />
                        </Field>
                        <Field label="Monto (USD)">
                            <Input 
                                value={editingExtra.monto} 
                                onChange={e => setEditingExtra({...editingExtra, monto: e.target.value.replace('.', ',')})} 
                            />
                        </Field>
                        <Field label="Estado">
                            <select 
                                className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" 
                                value={editingExtra.estado} 
                                onChange={e => setEditingExtra({...editingExtra, estado: e.target.value})}
                            >
                                <option>Pendiente</option>
                                <option>Cobrado</option>
                            </select>
                        </Field>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="secondary" onClick={handleCancelEdit}>Cancelar</Button>
                            <Button variant="primary" onClick={handleSaveChanges}>Guardar Cambios</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </Section>
    );
}