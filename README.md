# Gestor Operativo Europa Envíos

![Logo Europa Envíos](public/logo.png)

## Introducción

Este proyecto es una aplicación web interna desarrollada para **Europa Envíos**, diseñada para gestionar y optimizar todas las operaciones logísticas de la empresa. La plataforma centraliza el seguimiento de paquetes, desde su recepción en el almacén hasta el envío final, proporcionando herramientas clave para el personal administrativo y los couriers.

La aplicación está construida con tecnologías modernas, enfocándose en la eficiencia, la escalabilidad y una experiencia de usuario intuitiva.

---

## ✨ Características Principales

La aplicación cuenta con un sistema modular dividido por pestañas, con acceso restringido según el rol del usuario (Administrador o Courier).

* **📊 Dashboard Principal:** Visualización rápida de los indicadores clave de rendimiento (KPIs), como paquetes en bodega, cargas en tránsito y tareas pendientes. Incluye gráficos sobre el volumen de paquetes recibidos y la distribución de peso por courier.
* **📦 Recepción de Paquetes:** Formulario completo para registrar nuevos paquetes, con generación automática de códigos secuenciales y únicos por courier.
* **🖨️ Impresión de Etiquetas:** Generación e impresión de etiquetas de 100x50 mm con código de barras, optimizadas para impresoras térmicas como la Zebra ZP450.
* **🏭 Gestión de Bodega:** Visualización, filtrado y edición de todos los paquetes que se encuentran físicamente en el almacén.
* **📥 Paquetes sin Casilla:** Módulo para gestionar paquetes que llegan sin una casilla asignada, con la opción de crear tareas para su posterior asignación.
* **📋 Tareas Pendientes:** Sistema para crear y dar seguimiento a tareas manuales o generadas por el sistema (ej. asignar casilla, cambiar paquete de carga).
* **🗳️ Armado de Cajas:** Interfaz para agrupar paquetes de una carga en cajas, calcular pesos estimados y organizar los envíos.
* **✈️ Gestión de Cargas:** Creación, edición y seguimiento del estado de las cargas (aéreas y marítimas), con opción de adjuntar documentos relevantes.
* **📄 Generación de Proformas:** Creación automática de facturas proforma en formato XLSX, con cálculos diferenciados para cargas aéreas y marítimas.
* **🔐 Sistema de Autenticación:** Control de acceso seguro mediante Firebase Authentication, con roles de **Administrador** (acceso total) y **Courier** (vista limitada a su propia información).

---

## 🛠️ Tecnologías Utilizadas

Este proyecto fue construido utilizando un stack tecnológico moderno y eficiente:

* **Frontend:**
    * [**Vite**](https://vitejs.dev/): Entorno de desarrollo ultrarrápido.
    * [**React**](https://reactjs.org/): Biblioteca para construir la interfaz de usuario.
    * [**Tailwind CSS**](https://tailwindcss.com/): Framework de CSS para un diseño rápido y responsivo.
* **Backend y Base de Datos (BaaS):**
    * [**Firebase**](https://firebase.google.com/): Plataforma de Google que provee:
        * **Firestore:** Base de datos NoSQL en tiempo real.
        * **Firebase Authentication:** Para la gestión de usuarios y roles.
        * **Firebase Storage:** Para el almacenamiento de archivos (fotos de paquetes).
* **Librerías Clave:**
    * `recharts`: Para la creación de gráficos en el dashboard.
    * `exceljs`: Para la generación de archivos Excel (.xlsx) personalizados para las proformas.
    * `jsbarcode`: Para la creación de los códigos de barras en las etiquetas.

---

## 🚀 Cómo Empezar (Desarrollo Local)

Sigue estos pasos para ejecutar el proyecto en tu máquina local.

### Prerrequisitos

* Tener instalado [Node.js](https://nodejs.org/) (versión 18 o superior).
* Tener acceso al proyecto de Firebase de la empresa.

### Pasos de Instalación

1.  **Clonar el repositorio (si es necesario):**
    ```bash
    git clone <URL-DEL-REPOSITORIO>
    cd europaenvios-mvp-frontend-v2
    ```

2.  **Instalar las dependencias del proyecto:**
    ```bash
    npm install
    ```

3.  **Configurar las variables de entorno:**
    * Crea un archivo llamado `.env.local` en la raíz del proyecto.
    * Pide las credenciales del proyecto de Firebase y añádelas al archivo siguiendo este formato:

    ```env
    VITE_API_KEY="AIzaSy..."
    VITE_AUTH_DOMAIN="tu-proyecto.firebaseapp.com"
    VITE_PROJECT_ID="tu-proyecto"
    VITE_STORAGE_BUCKET="tu-proyecto.appspot.com"
    VITE_MESSAGING_SENDER_ID="..."
    VITE_APP_ID="1:..."
    VITE_MEASUREMENT_ID="G-..."
    ```

4.  **Ejecutar la aplicación:**
    * Inicia el servidor de desarrollo local con el siguiente comando:
        ```bash
        npm run dev
        ```
    * Abre tu navegador y visita `http://localhost:5173`.

---

## ☁️ Despliegue

La aplicación está configurada para un despliegue continuo en **Vercel**. Cualquier cambio que se suba a la rama `main` del repositorio de GitHub activará automáticamente un nuevo despliegue