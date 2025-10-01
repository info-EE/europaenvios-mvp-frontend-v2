/* eslint-disable react/prop-types */
import React, { useMemo, useState } from "react";

// Context
import { useModal } from "/src/context/ModalContext.jsx";

// Componentes
import { Section } from "/src/components/common/Section.jsx";
import { Field } from "/src/components/common/Field.jsx";
import { Input } from "/src/components/common/Input.jsx";
import { Button } from "/src/components/common/Button.jsx";
import { EmptyState } from "/src/components/common/EmptyState.jsx";
import { Modal } from "/src/components/common/Modal.jsx";
import { Iconos } from "/src/utils/helpers.jsx";

export function Pendientes({ items, onAdd, onUpdate, onRemove }) {
  const [editItem, setEditItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ type: 'MANUAL', fecha: new Date().toISOString().slice(0, 10), details: '' });
  const [viewer, setViewer] = useState(null);

  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("No realizada");

  const { showAlert, showConfirmation } = useModal();

  const filteredItems = useMemo(() => {
    return items
      .filter(item => statusFilter === 'Todas' || item.status === statusFilter)
      .filter(item => !from || (item.fecha || "") >= from)
      .filter(item => !to || (item.fecha || "") <= to)
      .filter(item => {
        if (!q) return true;
        const query = q.toLowerCase();
        // Improved search: check details for manual tasks, and stringify data for others
        const detailsString = item.type === 'MANUAL' 
            ? (item.data?.details || "").toLowerCase()
            : JSON.stringify(item.data).toLowerCase();
        return detailsString.includes(query);
      });
  }, [items, statusFilter, from, to, q]);
  
  const renderTaskDetailsAsString = (item) => {
    const { type, data } = item;
    switch (type) {
      case 'ASIGNAR_CASILLA': return `Mover paquete Nº ${data.numero} (${data.nombre}) a la casilla ${data.casilla}.`;
      case 'CAMBIO_CARGA': return `Cambiar paquete ${data.codigo} de la carga ${data.oldFlight} a la carga ${data.newFlight}.`;
      case 'MANUAL': return data.details || '';
      default: return JSON.stringify(data);
    }
  };


  const startEdit = (item) => {
    const detailsAsString = renderTaskDetailsAsString(item);
    setEditItem({ 
        ...item, 
        data: { ...item.data, details: detailsAsString } 
    });
  };

  const cancelEdit = () => setEditItem(null);

  const saveEdit = () => {
    if(!editItem) return;
    const itemToSave = {
        ...editItem,
        type: 'MANUAL', // Always save as manual after editing
        data: { details: editItem.data.details }
    };
    onUpdate(itemToSave);
    setEditItem(null);
  };

  const toggleStatus = (item) => {
    onUpdate({ ...item, status: item.status === 'Realizada' ? 'No realizada' : 'Realizada' });
  };

  const deleteTask = async (id) => {
    const confirmed = await showConfirmation(
        "Confirmar eliminación",
        "¿Seguro que quieres eliminar esta tarea pendiente? Esta acción no se puede deshacer."
    );
    if (confirmed) {
      onRemove(id);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.details.trim()) { 
      await showAlert("Campo requerido", "Por favor, ingresá los detalles de la tarea."); 
      return; 
    }
    const taskToAdd = {
      type: newTask.type, status: "No realizada", fecha: newTask.fecha,
      data: { details: newTask.details }
    };
    onAdd(taskToAdd);
    setModalOpen(false);
    setNewTask({ type: 'MANUAL', fecha: new Date().toISOString().slice(0, 10), details: '' });
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
        <Button variant="primary" onClick={() => setModalOpen(true)}>Agregar Tarea</Button>
      </div>
    }>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Fecha</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Tipo</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Detalles</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Foto</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredItems.map(item => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-3 py-2">{item.fecha}</td>
                <td className="px-3 py-2">{item.type === 'ASIGNAR_CASILLA' ? 'Asignar Casilla' : item.type === 'CAMBIO_CARGA' ? 'Cambio Carga' : 'Manual'}</td>
                <td className="px-3 py-2">{renderTaskDetails(item)}</td>
                <td className="px-3 py-2">
                  {item.data?.foto ? (
                    <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setViewer(item.data.foto)}>Ver foto</Button>
                  ) : '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 flex-wrap">
                    <button className={`px-3 py-1 text-xs rounded-lg text-white font-semibold transition-colors ${item.status === 'No realizada' ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-500 hover:bg-yellow-600'}`} onClick={() => toggleStatus(item)}>
                      {item.status === 'No realizada' ? 'Realizada' : 'Pendiente'}
                    </button>
                    <Button variant="icon" onClick={() => startEdit(item)}>{Iconos.edit}</Button>
                    <Button variant="iconDanger" onClick={() => deleteTask(item.id)}>{Iconos.delete}</Button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr><td colSpan="5"><EmptyState icon={Iconos.box} title="No hay tareas pendientes" message="El filtro no arrojó resultados o todo está al día." /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Crear Nueva Tarea Manual">
        <div className="space-y-4">
          <Field label="Fecha" required><Input type="date" value={newTask.fecha} onChange={e => setNewTask({ ...newTask, fecha: e.target.value })} /></Field>
          <Field label="Detalles de la Tarea" required>
            <textarea className="w-full text-sm rounded-lg border-slate-300 p-3" rows="4" value={newTask.details} onChange={e => setNewTask({ ...newTask, details: e.target.value })} placeholder="Ej: Revisar paquete GLOBALBOX123 por posible daño." />
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleCreateTask}>Guardar Tarea</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editItem} onClose={cancelEdit} title="Editar Tarea">
        {editItem && (
          <div className="space-y-4">
            <Field label="Fecha" required><Input type="date" value={editItem.fecha} onChange={e => setEditItem({ ...editItem, fecha: e.target.value })} /></Field>
            <Field label="Detalles de la Tarea" required>
              <textarea 
                className="w-full text-sm rounded-lg border-slate-300 p-3" 
                rows="4"
                value={editItem.data.details}
                onChange={e => {
                  const newData = { ...editItem.data, details: e.target.value };
                  setEditItem({ ...editItem, data: newData });
                }}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button onClick={cancelEdit}>Cancelar</Button>
              <Button variant="primary" onClick={saveEdit}>Guardar Cambios</Button>
            </div>
          </div>
        )}
      </Modal>
      
      <Modal open={!!viewer} onClose={() => setViewer(null)} title="Foto del Paquete">
        {viewer && (
          <a href={viewer} target="_blank" rel="noopener noreferrer" title="Abrir en nueva pestaña para hacer zoom">
            <img src={viewer} alt="Foto" className="max-w-full max-h-[70vh] rounded-xl cursor-zoom-in" />
          </a>
        )}
      </Modal>
    </Section>
  );
}