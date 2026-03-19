<div align="center">

# ⚡ AI PULSE

**Diagnóstico de Madurez en Inteligencia Artificial — Enterprise Edition**

Plataforma de evaluación que mide el AIQ (AI Quotient) de profesionales y organizaciones a través de una experiencia de assessment guiada por IA.

![Azure](https://img.shields.io/badge/Azure-Static_Web_Apps-0078D4?logo=microsoft-azure)
![Azure Functions](https://img.shields.io/badge/Azure-Functions_v4-FF7043?logo=azure-functions)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

🌐 **Producción:** [ai-pulse.javiercruz.ai](https://ai-pulse.javiercruz.ai)

</div>

---

## 📋 Descripción del Proyecto

AI Pulse es una plataforma de diagnóstico de madurez en IA que permite a las organizaciones evaluar el nivel de adopción y conocimiento de inteligencia artificial de sus equipos. La plataforma está diseñada para uso enterprise con **acceso controlado por invitación**.

### Flujo principal

```
Admin sube Excel con participantes
       ↓
Admin envía invitaciones por email (link único por participante)
       ↓
Participante accede con su link → completa assessment (31 preguntas, ~12 min)
       ↓
IA evalúa respuestas → genera score AIQ + reporte personalizado
       ↓
Admin consulta resultados con estado por participante/empresa
```

### Secciones del assessment
- **Fundamentos de IA** — Conceptos, modelos y tecnologías
- **Aplicación Práctica** — Uso en el trabajo, herramientas adoptadas
- **Estrategia & Liderazgo** — Visión organizacional, roadmap de IA
- **Ética & Riesgos** — Bias, privacidad, gobernanza

### Niveles AIQ
| Nivel | Rango | Descripción |
|-------|-------|-------------|
| 1 | 0–20 | Explorador |
| 2 | 21–40 | Adoptante |
| 3 | 41–60 | Practicante |
| 4 | 61–80 | Estratega |
| 5 | 81–100 | Vanguardista |

---

## 🏗️ Arquitectura

```
GitHub Repository
      │
      ├── / (Frontend - React/Vite/TypeScript)
      │     src/
      │     ├── pages/       LandingPage, GatePage, AssessmentPage,
      │     │                ResultPage, AdminPage, VerifyPage...
      │     ├── components/  Navbar, Button, AIQRing, ScoreRing...
      │     ├── store/       useAssessmentStore (Zustand)
      │     └── data/        questions.ts (31 preguntas calibradas)
      │
      └── /api (Azure Functions v4 - Node.js 18)
            ├── authenticate/        Login admin
            ├── auth-verify/         Verificar token admin
            ├── participants-upload/ Subir Excel de participantes
            ├── participants-list/   Listar participantes con estado
            ├── invitations-send/    Enviar emails de invitación
            ├── grade/               Evaluar respuestas con Azure OpenAI
            ├── results-save/        Guardar resultado en Table Storage
            └── health/              Health check del API

Azure Infrastructure:
  ├── Azure Static Web Apps   → Hosting frontend + funciones integradas
  ├── Azure Table Storage     → Participantes, resultados, tokens
  ├── Azure Communication Services → Envío de emails con links únicos
  └── Azure OpenAI            → Motor de evaluación/grading (GPT-4o mini)
```

---

## 🚀 Despliegue en Azure

### Prerrequisitos

- Cuenta de Azure con suscripción activa
- Node.js 18+
- Azure CLI instalado (`az`)
- Repositorio en GitHub

### 1. Crear recursos en Azure

```bash
# Resource Group
az group create --name rg-aipulse --location eastus

# Storage Account (para Table Storage)
az storage account create \
  --name staipulse \
  --resource-group rg-aipulse \
  --sku Standard_LRS \
  --kind StorageV2

# Azure Communication Services
az communication create \
  --name acs-aipulse \
  --resource-group rg-aipulse \
  --data-location unitedstates
```

### 2. Crear la Azure Static Web App

Desde el [Portal de Azure](https://portal.azure.com):

1. Buscar **Static Web Apps** → **Create**
2. Configurar:
   - **Resource Group:** `rg-aipulse`
   - **Name:** `aipulse`
   - **Plan type:** Free o Standard
   - **Region:** East US 2
   - **Source:** GitHub → seleccionar repositorio y branch `main`
3. En **Build Details**:
   - **App location:** `/`
   - **Api location:** `api`
   - **Output location:** `dist`
4. Click **Review + Create**

Esto crea automáticamente el archivo `.github/workflows/azure-static-web-apps-*.yml` en el repositorio y dispara el primer deploy.

### 3. Configurar variables de entorno

En el portal → Static Web App → **Configuration** → **Application settings**:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `ADMIN_PASSWORD` | Contraseña del panel admin | `MiPassword123!` |
| `JWT_SECRET` | Secreto para tokens JWT (mín 32 chars) | `super-secret-32-chars-here` |
| `AZURE_STORAGE_CONNECTION_STRING` | Conexión a Table Storage | `DefaultEndpointsProtocol=https;...` |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | Conexión a ACS | `endpoint=https://...` |
| `ACS_SENDER_EMAIL` | Email del remitente | `noreply@yourdomain.com` |
| `AZURE_OPENAI_ENDPOINT` | Endpoint de Azure OpenAI | `https://myresource.openai.azure.com/` |
| `AZURE_OPENAI_API_KEY` | API Key de Azure OpenAI | `abc123...` |
| `AZURE_OPENAI_DEPLOYMENT` | Nombre del deployment | `gpt-4o-mini` |
| `APP_URL` | URL base de la aplicación | `https://ai-pulse.javiercruz.ai` |

Obtener `AZURE_STORAGE_CONNECTION_STRING`:
```bash
az storage account show-connection-string \
  --name staipulse \
  --resource-group rg-aipulse \
  --query connectionString -o tsv
```

### 4. Node.js 18 en el workflow de CI/CD

El archivo `.github/workflows/azure-static-web-apps-*.yml` debe incluir el paso de setup-node **antes** del deploy:

```yaml
- name: Setup Node.js 18
  uses: actions/setup-node@v3
  with:
    node-version: '18'
```

Esto es necesario porque `@azure/data-tables` v13 requiere Node ≥ 18.

### 5. Dominio personalizado

En Azure Static Web Apps → **Custom domains** → **Add**:
1. Ingresar dominio: `ai-pulse.javiercruz.ai`
2. Crear registro CNAME en tu DNS apuntando al dominio `.azurestaticapps.net`
3. Azure provisiona el certificado SSL automáticamente (~5 min)

---

## 💻 Desarrollo Local

### 1. Instalar dependencias

```bash
npm install          # Frontend
cd api && npm install  # Azure Functions
```

### 2. Variables locales

Crear `api/local.settings.json` (nunca subir a Git — está en .gitignore):

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "ADMIN_PASSWORD": "admin123",
    "JWT_SECRET": "dev-secret-key-minimum-32-characters",
    "AZURE_STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "AZURE_COMMUNICATION_CONNECTION_STRING": "your-acs-connection-string",
    "ACS_SENDER_EMAIL": "noreply@yourdomain.com",
    "AZURE_OPENAI_ENDPOINT": "https://yourresource.openai.azure.com/",
    "AZURE_OPENAI_API_KEY": "your-key",
    "AZURE_OPENAI_DEPLOYMENT": "gpt-4o-mini",
    "APP_URL": "http://localhost:4280"
  }
}
```

### 3. Correr en local

```bash
# Instalar SWA CLI (una sola vez)
npm install -g @azure/static-web-apps-cli

# Terminal 1: Frontend Vite
npm run dev

# Terminal 2: SWA emulator (frontend + api en puerto 4280)
swa start http://localhost:5173 --api-location api
```

La app queda disponible en `http://localhost:4280`

---

## 📁 Estructura del Repositorio

```
AI-PULSE/
├── .github/workflows/
│   └── azure-static-web-apps-*.yml   # CI/CD automático (generado por Azure)
├── api/                               # Azure Functions (Node.js 18)
│   ├── authenticate/                  # POST /api/authenticate
│   ├── auth-verify/                   # POST /api/auth-verify
│   ├── grade/                         # POST /api/grade
│   ├── health/                        # GET  /api/health
│   ├── invitations-send/              # POST /api/invitations-send
│   ├── participants-list/             # GET  /api/participants-list
│   ├── participants-upload/           # POST /api/participants-upload
│   ├── results-save/                  # POST /api/results-save
│   ├── shared/adminAuth.js            # Middleware de autenticación admin
│   ├── host.json
│   └── package.json                   # Deps: @azure/data-tables, xlsx, uuid
├── src/
│   ├── components/
│   │   ├── question-types/            # MixedConditional, OpenQuestion, etc.
│   │   └── ui/                        # Navbar, Button, AIQRing, ScoreRing...
│   ├── data/questions.ts              # 31 preguntas calibradas
│   ├── pages/
│   │   ├── AdminPage.tsx              # /admin
│   │   ├── AssessmentPage.tsx         # /assessment
│   │   ├── LandingPage.tsx            # /
│   │   ├── ResultPage.tsx             # /result
│   │   └── VerifyPage.tsx             # /verify?token=...
│   ├── store/useAssessmentStore.ts    # Estado global (Zustand)
│   ├── App.tsx
│   └── index.css                      # Variables de tema + Tailwind
├── staticwebapp.config.json           # Rutas y reglas de navegación SPA
├── vite.config.ts
└── package.json
```

---

## 🔐 Seguridad

- **Acceso al assessment:** Solo por link único con token JWT (7 días de vigencia), enviado por email
- **Panel admin:** Contraseña + token de sesión en `sessionStorage`
- **APIs:** Middleware `requireAdmin` valida `X-Admin-Token` header en cada llamada
- **No hay registro público:** La landing muestra "Próximamente" para acceso directo

---

## 📊 Panel de Administración

Acceder en: `https://ai-pulse.javiercruz.ai/admin`

| Pestaña | Función |
|---------|---------|
| **Cargar Excel** | Subir lista de participantes (.xlsx). Columnas requeridas: `email`, `nombre`, `posicion`, `empresa`, `departamento` |
| **Participantes** | Lista completa con estado (`pending` / `started` / `completed`), columna empresa visible. Botón para exportar CSV |
| **Invitaciones** | Enviar emails con link único a participantes en estado `pending` |

---

## 🛠️ Stack Tecnológico

| Categoría | Tecnología |
|-----------|------------|
| Frontend | React 18, TypeScript, Vite |
| Estilos | Tailwind CSS v4 |
| Estado | Zustand |
| Animaciones | Motion (Framer Motion) |
| Backend | Azure Functions v4 (Node.js 18) |
| Hosting | Azure Static Web Apps |
| Base de datos | Azure Table Storage |
| Email | Azure Communication Services |
| IA / Evaluación | Azure OpenAI (GPT-4o mini) |
| CI/CD | GitHub Actions |
| Fuentes | Bebas Neue, DM Sans, DM Mono |

---

## 🐛 Troubleshooting

**Las funciones retornan 500**
- Verificar que el workflow incluye `setup-node@v3` con `node-version: '18'`
- Confirmar todas las variables en Azure → Static Web App → Configuration

**Error 401 en /admin**
- Confirmar que `ADMIN_PASSWORD` y `JWT_SECRET` están configurados

**No llegan los emails**
- Verificar que el dominio sender está verificado en Azure Communication Services
- Confirmar que `ACS_SENDER_EMAIL` usa ese dominio verificado

**Participantes no aparecen**
- Verificar que `AZURE_STORAGE_CONNECTION_STRING` es correcto
- El storage account debe existir; las tablas se crean automáticamente en el primer insert

---

<div align="center">
  <sub>Built for <a href="https://javiercruz.ai">JavierCruz.ai</a> · Powered by Azure Static Web Apps + React + Azure OpenAI</sub>
</div>
