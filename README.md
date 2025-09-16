# Europa Envíos — Gestor de Paquetes

Aplicación web interna para la gestión integral de paquetes y cargas de Europa Envíos. Esta herramienta permite un control completo del ciclo de vida de un paquete, desde su recepción en el almacén hasta su envío final, utilizando una base de datos en tiempo real con Firebase.

## ✨ Características Principales

La aplicación está organizada en módulos para facilitar la gestión logística:

  * **📊 Dashboard:** Visualización rápida de los principales indicadores (KPIs), como paquetes en bodega, cargas en tránsito y tareas pendientes, con gráficos sobre la actividad reciente.
  * **📦 Recepción de Paquetes:** Formulario para registrar nuevos paquetes, incluyendo datos del cliente, pesos, medidas, fotos y generación automática de etiquetas con código de barras (formato 100x60 mm).
  * **倉庫 Bodega:** Gestión de paquetes almacenados. Permite la edición de datos, reimpresión de etiquetas, exportación de listados a Excel y visualización de gráficos por courier.
  * **🗳️ Armado de Cajas:** Herramienta para crear cajas, asignarles paquetes (evitando duplicados) y gestionar su información (peso, medidas, etc.).
  * **✈️ Gestión de Cargas:** Administración del estado de las cargas (En bodega, En tránsito, Arribado), permitiendo un seguimiento claro del proceso de envío.
  * **📤 Cargas Enviadas:** Visualización y resumen de las cargas ya despachadas, con opción de exportar el manifiesto y el packing list a Excel.
  * **🧾 Proformas por Courier:** Generación automática de facturas proforma basadas en plantillas de Excel, calculando costes por courier.
  * **✅ Tareas Pendientes:** Módulo para gestionar y dar seguimiento a tareas internas, como la asignación de casillas o cambios de carga.
  * **⭐ Extras:** Registro y gestión de trabajos o servicios adicionales asociados a una carga y courier específicos.
  * **👥 Gestión de Usuarios:** Creación y administración de usuarios con roles (Administrador, Courier) para controlar el acceso a las diferentes funcionalidades.

## 🚀 Tecnologías Utilizadas

  * **Frontend:** React y Vite.
  * **Backend y Base de Datos:** Firebase (Cloud Firestore, Storage y Authentication) para la gestión de datos en tiempo real.
  * **Estilos:** Tailwind CSS.
  * **Gráficos:** Recharts.
  * **Exportación a Excel:** ExcelJS y `xlsx-js-style`.
  * **Generación de Códigos de Barras:** JsBarcode.

## 🔧 Instalación y Puesta en Marcha

### Prerrequisitos

  * Node.js (versión 14 o superior)
  * npm

### 1\. Clonar el repositorio

```bash
git clone https://github.com/nicolasdibe/europaenvios-mvp-frontend.git
cd europaenvios-mvp-frontend
```

### 2\. Instalar dependencias

Ejecuta el siguiente comando para instalar todas las librerías necesarias definidas en el `package.json`:

```bash
npm install
```

### 3\. Configurar las variables de entorno

Para que la aplicación se conecte a Firebase, necesitas crear tu propio proyecto de Firebase y configurar tus credenciales.

1.  Crea un archivo llamado `.env.local` en la raíz del proyecto.
2.  Añade las siguientes variables con las credenciales de tu proyecto de Firebase:

<!-- end list -->

```
VITE_API_KEY="TU_API_KEY"
VITE_AUTH_DOMAIN="TU_AUTH_DOMAIN"
VITE_PROJECT_ID="TU_PROJECT_ID"
VITE_STORAGE_BUCKET="TU_STORAGE_BUCKET"
VITE_MESSAGING_SENDER_ID="TU_MESSAGING_SENDER_ID"
VITE_APP_ID="TU_APP_ID"
VITE_MEASUREMENT_ID="TU_MEASUREMENT_ID"
```

*El archivo `.env.local` está incluido en el `.gitignore` para evitar subir claves privadas al repositorio.*

### 4\. Ejecutar la aplicación

Una vez instaladas las dependencias y configurado el entorno, puedes iniciar la aplicación en modo de desarrollo:

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173` (o el puerto que se indique en la consola).

## 📜 Scripts Disponibles

  * `npm run dev`: Inicia el servidor de desarrollo con Vite.
  * `npm run build`: Compila la aplicación para producción.
  * `npm run preview`: Sirve la versión de producción compilada localmente para previsualización.