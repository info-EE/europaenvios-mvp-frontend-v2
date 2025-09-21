import React from "react";
import { Section } from "../common/Section.jsx";

export function Usuarios() {
  return (
    <Section title="Gestión de Usuarios">
      <div className="bg-francia-50 border-l-4 border-francia-500 p-4 rounded-r-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-francia-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-francia-800">Atención: Nueva gestión de usuarios</h3>
            <div className="mt-2 text-sm text-francia-700">
              <p>La gestión de usuarios (crear, editar, eliminar y cambiar contraseñas) ahora se realiza directamente en la Consola de Firebase para mayor seguridad.</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><b>Para añadir un usuario:</b> Ve a Firebase Console → Authentication → Users → Add user.</li>
                <li><b>Para asignar un rol:</b> Ve a Firebase Console → Firestore Database → `users` collection. Crea un documento con el UID del usuario y añade los campos `role` y `courier`.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}