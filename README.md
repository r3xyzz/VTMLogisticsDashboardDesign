# 🚛 VTM Logistics Dashboard

Sistema de gestión de transporte y logística para VTM Logistics. Permite administrar órdenes de servicio, flota de vehículos, tracking de cargas y cotizaciones en tiempo real.

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Ejecutar el Proyecto](#-ejecutar-el-proyecto)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Base de Datos](#-base-de-datos)
- [Comandos Útiles](#-comandos-útiles)
- [Solución de Problemas](#-solución-de-problemas)
- [Estado del Proyecto](#-estado-del-proyecto)
- [Próximos Pasos](#-próximos-pasos)
- [Contribución](#-contribución)
- [Licencia](#-licencia)
- [Contacto](#-contacto)

---

## ✨ Características

### Módulos Principales

- 📦 **Gestión de Órdenes**
  - Crear nuevas órdenes de servicio
  - Visualizar y filtrar órdenes por estado
  - Actualizar estado de órdenes (pendiente, asignada, en tránsito, entregada)
  - Ver detalles completos de cada orden

- 🚛 **Flota de Vehículos**
  - Administrar camiones propios
  - Ver disponibilidad y estado de cada unidad
  - Asignar conductores a vehículos
  - Control de mantenimiento

- 💰 **Cotizador Inteligente**
  - Cálculo automático de costos operativos
  - Diésel, peajes y mano de obra
  - Margen de ganancia en tiempo real
  - Modo flota propia o subcontratación
  - Margen automático del 20% en subcontratos

- 📊 **Dashboard de KPIs**
  - Resumen de órdenes activas
  - Estado de la flota
  - Indicadores de rendimiento
  - Gráficos y visualizaciones

- 📍 **Tracking en Tiempo Real**
  - Ubicación de vehículos en ruta
  - Historial de movimientos
  - Alertas de eventos (recogida, entrega, incidencias)

- 📄 **Documentos Digitales**
  - Gestión de POD (Proof of Delivery)
  - Guías de despacho
  - Facturas y cotizaciones
  - Firmas digitales

- 🔔 **Alertas y Notificaciones**
  - Incidentes en ruta
  - Retrasos en entregas
  - Notificaciones automáticas a clientes

### Requerimientos del Negocio Implementados

Basado en la transcripción de requerimientos:

- ✅ Gestión de solicitudes vía email
- ✅ Flota propia (no subcontratación)
- ✅ Tarifas estandarizadas para el triángulo VAP-SCL-SAI
- ✅ Cotizaciones especiales para cargas fuera del triángulo
- ✅ Registro completo: volumen, kilos, dimensiones, tipo de bulto
- ✅ Gestión de documentos (POD, guías de despacho)
- ✅ Control de documentos de conductores y vehículos (estándar minero)
- ✅ Monitoreo GPS de vehículos
- ✅ Alertas de retrasos e incidentes
- ✅ Notificaciones automáticas de estado
- ✅ Cálculo de márgenes y rentabilidad

---

## 🛠️ Tecnologías

### Frontend
| Tecnología | Versión | Propósito |
|:---|:---|:---|
| **React** | 19.0.0 | Framework UI |
| **TypeScript** | 5.7.0 | Tipado estático |
| **Vite** | 8.0.0 | Bundler y servidor de desarrollo |
| **Tailwind CSS** | 4.0.0 | Estilos y diseño |
| **Recharts** | 3.10.1 | Gráficos y visualización de datos |

### Backend / Base de Datos
| Tecnología | Propósito |
|:---|:---|
| **Supabase** | Backend como servicio (BaaS) |
| **PostgreSQL** | Base de datos relacional |
| **Row Level Security (RLS)** | Seguridad a nivel de fila |
| **Supabase Client** | Cliente JavaScript para React |

### Herramientas de Desarrollo
| Herramienta | Propósito |
|:---|:---|
| **pnpm** | Gestor de paquetes (rápido y eficiente) |
| **Git** | Control de versiones |
| **Oxfmt** | Formateo de código |
| **TypeScript** | Tipado y validación |

---

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

### 1. Node.js (v18 o superior)

```bash
# Verificar versión
node --version
# Debe mostrar v18.x.x o superior

# Instalar pnpm globalmente
npm install -g pnpm

# Verificar instalación
pnpm --version

# Verificar instalación
git --version

# Verificar instalación
git --version

# Usando pnpm (Recomendado)
pnpm install

# Usando npm
npm install

# Usando pnpm
pnpm run dev

# Usando npm
npm run dev

# Construir el proyecto
pnpm run build

# Previsualizar la versión construida
pnpm run preview
