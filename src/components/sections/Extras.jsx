/* eslint-disable react/prop-types */
import React, { useState, useMemo } from "react";

// Context
import { useModal } from "../../context/ModalContext.jsx";

// Componentes
import { Section } from "../common/Section.jsx";
import { Input } from "../common/Input.jsx";
import { Field } from "../common/Field.jsx";
import { Button } from "../common/Button.jsx";

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

    const updateItem = (id, patch) => onUpdate({ id, ...patch });
    
    const deleteItem = async (id) => {
        const confirmed = await showConfirmation("Confirmar eliminación", "¿Seguro que quieres eliminar este extra?");
        if (confirmed) {
            onDelete(id);
        }
    };

    return (
        <Section title="Trabajos extras">
            <div className="grid md:grid-cols-6 gap-4 mb-4 p-4 bg-slate-50 rounded-lg items-end">
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
                <Field label="Monto (USD)"><Input value={monto} onChange={e => setMonto(e.target.value)} placeholder="10,00" /></Field>
                <Field label="Estado">
                    <select className="w-full text-sm rounded-lg border-slate-300 px-3 py-2" value={estado} onChange={e => setEstado(e.target.value)}>
                        <option>Pendiente</option>
                        <option>Cobrado</option>
                    </select>
                </Field>
                <Field label="Fecha"><Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></Field>
                <div className="md:col-span-6 flex justify-end">
                    <Button variant="primary" onClick={add}>Agregar</Button>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-4">
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

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50">
                            {["Fecha", "Carga", "Courier", "Descripción", "Monto (USD)", "Estado", "Acciones"].map(h => 
                                <th key={h} className="text-left px-3 py-2 font-semibold text-slate-600">{h}</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filtered.map(e => {
                            const carga = flights.find(f => f.id === e.flight_id)?.codigo || "";
                            return (
                                <tr key={e.id} className="hover:bg-slate-50">
                                    <td className="px-3 py-1">{e.fecha || flights.find(f => f.id === e.flight_id)?.fecha_salida || ""}</td>
                                    <td className="px-3 py-1">{carga}</td>
                                    <td className="px-3 py-1">{e.courier}</td>
                                    <td className="px-3 py-1"><Input value={e.descripcion} onChange={ev => updateItem(e.id, { descripcion: ev.target.value })} /></td>
                                    <td className="px-3 py-1"><Input value={e.monto} onChange={ev => updateItem(e.id, { monto: ev.target.value })} /></td>
                                    <td className="px-3 py-1">
                                        <select className="w-full text-sm rounded-lg border-slate-300 px-2 py-1" value={e.estado} onChange={ev => updateItem(e.id, { estado: ev.target.value })}>
                                            <option>Pendiente</option>
                                            <option>Cobrado</option>
                                        </select>
                                    </td>
                                    <td className="px-3 py-1">
                                        <Button variant="iconDanger" onClick={() => deleteItem(e.id)}>{Iconos.delete}</Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Section>
    );
}