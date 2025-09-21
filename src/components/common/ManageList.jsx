/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { Input } from "./Input";
import { Button } from "./Button";

export function ManageList({ label, items, onAdd, onRemove }) {
    const [txt, setTxt] = useState("");

    const handleAdd = () => {
        if (!txt.trim()) return;
        onAdd({ name: txt.trim() });
        setTxt("");
    };

    return (
        <div className="bg-slate-50 rounded-xl p-3">
            <div className="font-medium mb-2 text-slate-800">{label}</div>
            <div className="flex gap-2">
                <Input
                    value={txt}
                    onChange={e => setTxt(e.target.value)}
                    placeholder={`Agregar a ${label}`}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
                <Button onClick={handleAdd}>Añadir</Button>
            </div>
            <ul className="mt-2 text-sm">
                {items.map((x) => (
                    <li key={x.id} className="flex items-center justify-between py-1.5 border-b border-slate-200">
                        <span className="text-slate-700">{x.name}</span>
                        <button className="text-red-600 text-xs font-semibold" onClick={() => onRemove(x.id)}>Quitar</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}