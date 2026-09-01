<div align="center">

# ⚡ AI PULSE

**Diagnóstico de Madurez en Inteligencia Artificial — Enterprise Edition**

Plataforma de evaluación que mide el AIQ (AI Quotient) de profesionales y organizaciones a través de una experiencia de assessment guiada por IA.

![Azure](https://img.shields.io/badge/Azure-Static_Web_Apps-0078D4?logo=microsoft-azure)
![Azure Functions](https://img.shields.io/badge/Azure-Functions_v4-FF7043?logo=azure-functions)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

🌐 **Producción:** [aipulse.vinka.one](https://aipulse.vinka.one)

</div>

---

## 📋 Descripción del Proyecto

AI Pulse es una plataforma de diagnóstico de madurez en IA que permite a las organizaciones evaluar el nivel de adopción y conocimiento de inteligencia artificial de sus equipos. La plataforma está diseñada para uso enterprise, con **acceso controlado principalmente por invitación** (ver otras vías de acceso soportadas en [Seguridad](#-seguridad)).

### Flujo principal

```
Admin sube Excel con participantes
       ↓
Admin envía invitaciones por email (link único por participante)
       ↓
Participante accede con su link → completa el assessment (22 preguntas)
       ↓
IA evalúa respuestas → genera score AIQ + reporte personalizado
       ↓
Admin consulta resultados con estado por participante/empresa
```

El set de 22 preguntas en `src/data/questions.ts` es el **default embebido**: en tiempo de ejecución el frontend pide `/api/questions-config` y, si el API responde con una lista no vacía, la usa en su lugar — el cuestionario real en producción puede diferir de lo versionado en el repo.

### Secciones del assessment

El motor de scoring (`api/shared/aiqEvaluatorV6.js`) organiza las preguntas en 5 secciones, con pesos distintos sobre el puntaje AIQ final:

| Sección | Enfoque | Peso en el AIQ |
|---------|---------|-----------------|
| **V — Punto de partida** | Autopercepción y contexto inicial | No puntúa (alimenta reglas de consistencia) |
| **A — Experiencia real con IA** | Uso concreto en el trabajo diario | 30% |
| **B — Capacidades técnicas** | Verificación de resultados, seguridad de datos, uso multimodal | 20% |
| **C — Laboratorio de ejecución** | Prompts evaluados en vivo, con tiempos de respuesta | 50% |
| **D — Cultura, impacto y futuro** | Visión organizacional | No puntúa el AIQ individual; alimenta el reporte enterprise |

### Niveles AIQ

| Nivel | Rango de puntaje | Nombre |
|-------|-------------------|--------|
| L1 | 1.0 – 1.8 | Novato |
| L2 | 1.9 – 2.8 | Experimentador |
| L3 | 2.9 – 3.8 | Practicante |
| L4 | 3.9 – 4.0 | Amplificador (Técnico o Estratégico, según señales) |

### Coaching post-assessment

Tras completar el assessment y generarse su reporte, el participante puede activar un coach conversacional potenciado por LLM: recibe un plan de tareas de seguimiento a partir de su propio resultado y puede conversar con el coach para resolver dudas. Es un add-on independiente (tabla y login propios) que se habilita automáticamente cuando el reporte queda listo.

---

## 🏗️ Arquitectura

```
GitHub Repository
      │
      ├── / (Frontend - React/Vite/TypeScript)
      │     src/
      │     ├── pages/       LandingPage, AssessmentPage, ProcessingPage,
      │     │                ThankYouPage, ResultPage, AdminPage, VerifyPage,
      │     │                CoachPage, DashboardPage, LoginPage, AccessPage...
      │     ├── components/  ui/ (Navbar, AIQRing, ScoreRing...),
      │     │                question-types/ (OpenQuestion, PromptInputQuestion...)
      │     ├── hooks/
      │     ├── store/       useAssessmentStore (Zustand)
      │     └── data/        questions.ts (set por defecto, 22 preguntas)
      │
      ├── /api (Azure Functions v4 - Node.js, runtime Node 20 en Azure)
      │     ├── Auth / Admin                authenticate, auth-verify, google-auth,
      │     │                                microsoft-auth, domain-register,
      │     │                                access-request, client-config
      │     ├── Participantes / Invitaciones participants-upload, participants-list,
      │     │                                participant-update, invitations-send,
      │     │                                invitation-resend, companies-list,
      │     │                                company-update, company-upload, waitlist
      │     ├── Motor AIQ / Progreso          progress-save, progress-get, results-save,
      │     │                                results-list, questions-config
      │     ├── Coach                         coach-access, coach-init, coach-chat,
      │     │                                coach-demo, tasks-update
      │     ├── Reportes                      report-generate, report-generate-company
      │     └── Utilitarias                   health, dashboard-html
      │
      └── /worker (2da app de Azure Functions, deploy independiente)
            ├── report-http / company-report-http               (HTTP)
            └── report-processor / company-report-processor     (queue-triggered)

Azure Infrastructure:
  ├── Azure Static Web Apps    → Hosting frontend + api/ (producción)
  ├── Azure Table Storage      → Participantes, resultados, tokens, progreso, coaching
  ├── Azure Blob Storage       → Informes generados (HTML), archivos subidos
  ├── Azure Queue Storage      → Cola "report-generation" (api/ → worker/)
  ├── Azure Communication Services → Envío de emails con links únicos
  └── Azure OpenAI              → Motor de evaluación/grading (gpt-5-mini),
                                   proveedor configurable vía AIQ_LLM_PROVIDER

Despliegue paralelo: infra/aws/ mantiene un ambiente de validación en AWS EC2
(lift-and-shift del mismo código) — ver infra/aws/README.md.
```

`api/report-generate` y `report-generate-company` no generan el informe por sí mismos: revisan si ya existe el HTML cacheado en Blob Storage y, si no, delegan la generación a `worker/` (vía la cola `report-generation` o una llamada HTTP directa, según el disparador), respondiendo `202` de inmediato.

> Nota: `src/pages/GatePage.tsx` existe en el repo pero es código muerto — está completamente comentado y no se importa en `App.tsx`; no forma parte del flujo activo.

---

## 🚀 Despliegue en Azure

### Prerrequisitos

- Cuenta de Azure con suscripción activa
- Node.js 20+
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
| `ADMIN_PASSWORD` | Contraseña del panel admin (protege el token `X-Admin-Token`) | `MiPassword123!` |
| `SESSION_SECRET` | Secreto HMAC para sesiones de participante/coach (SSO) — distinto de `ADMIN_PASSWORD` a propósito | `otro-secreto-largo-y-distinto` |
| `AZURE_STORAGE_CONNECTION_STRING` | Conexión a Table/Blob/Queue Storage | `DefaultEndpointsProtocol=https;...` |
| `APP_BASE_URL` | URL base de la app (usada por CORS y por los links de invitación) | `https://aipulse.vinka.one` |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | Conexión a Azure Communication Services | `endpoint=https://...` |
| `EMAIL_SENDER_ADDRESS` | Email del remitente (debe estar verificado en ACS) | `noreply@yourdomain.com` |
| `AZURE_OPENAI_ENDPOINT` | Endpoint de Azure OpenAI | `https://myresource.openai.azure.com/` |
| `AZURE_OPENAI_API_KEY` | API Key de Azure OpenAI | `abc123...` |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment usado para grading (hoy: `gpt-5-mini`) | `gpt-5-mini` |
| `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` | Deployment de embeddings | `text-embedding-3-large` |
| `GOOGLE_CLIENT_ID` / `MICROSOFT_CLIENT_ID` | SSO opcional de participante/coach | `xxx.apps.googleusercontent.com` |

Hay variables adicionales de uso avanzado (proveedor Bedrock, vector DB) usadas solo en el ambiente paralelo de AWS — ver `infra/aws/README.md`.

Obtener `AZURE_STORAGE_CONNECTION_STRING`:
```bash
az storage account show-connection-string \
  --name staipulse \
  --resource-group rg-aipulse \
  --query connectionString -o tsv
```

### 4. Node.js 20 en el workflow de CI/CD

El archivo `.github/workflows/azure-static-web-apps-*.yml` (autogenerado por Azure al crear la Static Web App) debe incluir el paso de setup-node **antes** del build, con la misma versión que corre en producción (`platform.apiRuntime: "node:20"` en `staticwebapp.config.json`):

```yaml
- name: Setup Node.js 20
  uses: actions/setup-node@v4
  with:
    node-version: '20'
```

### 5. Dominio personalizado

En Azure Static Web Apps → **Custom domains** → **Add**:
1. Ingresar el dominio deseado (ej. `aipulse.vinka.one`)
2. Crear registro CNAME en tu DNS apuntando al dominio `.azurestaticapps.net`
3. Azure provisiona el certificado SSL automáticamente (~5 min)

---

## 💻 Desarrollo Local

### 1. Instalar dependencias

```bash
npm install                    # Frontend
cd api && npm install          # Azure Functions (api/)
cd ../worker && npm install    # Azure Functions (worker/)
```

### 2. Variables locales

Crear `api/local.settings.json` (nunca subir a Git — está en .gitignore). Es el **único** archivo de configuración para todo el backend: `worker/` no tiene config propia, la toma de este mismo archivo al arrancar.

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "ADMIN_PASSWORD": "admin123",
    "SESSION_SECRET": "dev-session-secret-local-only",
    "AZURE_STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "AZURE_COMMUNICATION_CONNECTION_STRING": "your-acs-connection-string",
    "EMAIL_SENDER_ADDRESS": "noreply@yourdomain.com",
    "AZURE_OPENAI_ENDPOINT": "https://yourresource.openai.azure.com/",
    "AZURE_OPENAI_API_KEY": "your-key",
    "AZURE_OPENAI_DEPLOYMENT": "gpt-5-mini",
    "APP_BASE_URL": "http://localhost:4280"
  }
}
```

### 3. Correr en local

**Camino rápido** — dos scripts que levantan/detienen todo el stack (Azurite, admin de tablas, `func start`, frontend y el proxy de SWA):

```bash
bash scripts/dev-up.sh     # levanta todo
bash scripts/dev-down.sh   # lo detiene
```

**Manual (4 terminales)**, si prefieres controlar cada proceso por separado:

```bash
# Terminal 1 — storage emulator
cd api && npm run azurite

# Terminal 2 — API
cd api && func start

# Terminal 3 — worker (generación de reportes en background)
cd worker && npm run start:local

# Terminal 4 — frontend + proxy SWA
npm run dev
swa start http://localhost:3000 --api-devserver-url http://localhost:7071
```

**Importante:** nunca uses `swa start --api-location api` — no funciona en este repo. Usa siempre `--api-devserver-url` apuntando a un `func start` que ya esté corriendo.

La app queda disponible en `http://localhost:4280`.

---

## 📁 Estructura del Repositorio

```
AI-PULSE/
├── .github/workflows/
│   ├── azure-static-web-apps-*.yml   # CI/CD del frontend + api/ (generado por Azure)
│   └── deploy-worker-new.yml         # CI/CD del worker/ (deploy independiente)
├── api/                               # Azure Functions (Node.js, runtime Node 20 en Azure)
│   ├── authenticate/ auth-verify/ google-auth/ microsoft-auth/    # Auth
│   ├── domain-register/ access-request/ client-config/            # Acceso alternativo
│   ├── participants-upload/ participants-list/ participant-update/
│   ├── invitations-send/ invitation-resend/ companies-list/ company-update/
│   ├── progress-save/ progress-get/ results-save/ results-list/ questions-config/
│   ├── coach-access/ coach-init/ coach-chat/ coach-demo/ tasks-update/
│   ├── report-generate/ report-generate-company/
│   ├── health/ dashboard-html/ waitlist/
│   ├── shared/                        # aiqEvaluatorV6.js, aiqRubricV6.js, aiqPromptsV6.js,
│   │                                  # llmClient.js, adminAuth.js, sessionAuth.js, cors.js...
│   ├── host.json
│   └── package.json                   # Deps: @azure/data-tables, xlsx, uuid, openai
├── worker/                             # 2da app de Azure Functions (deploy independiente)
│   ├── report-http/ company-report-http/            # HTTP
│   ├── report-processor/ company-report-processor/  # queue-triggered
│   ├── shared/llmClient.js            # copia de api/shared/llmClient.js (paquete separado)
│   └── host.json, package.json
├── infra/aws/                          # Ambiente de validación paralelo en AWS EC2
│   └── (provisioning, deploy, migración de datos — ver infra/aws/README.md)
├── azurite_emulator/                   # Herramienta dev-only (nunca se despliega):
│   └── UI web en :4300 para inspeccionar/editar filas de Azurite en local
├── server/                             # Shim Express usado solo por el despliegue en AWS
├── scripts/                            # dev-up.sh / dev-down.sh (stack local completo)
├── src/
│   ├── components/
│   │   ├── question-types/            # MixedConditional, OpenQuestion, PromptInputQuestion...
│   │   └── ui/                        # Navbar, Button, AIQRing, ScoreRing...
│   ├── hooks/
│   ├── data/questions.ts              # Set de preguntas por defecto (22)
│   ├── pages/
│   │   ├── AdminPage.tsx              # /admin
│   │   ├── AssessmentPage.tsx         # /assessment
│   │   ├── LandingPage.tsx            # /
│   │   ├── ProcessingPage.tsx         # /processing (animación decorativa)
│   │   ├── ThankYouPage.tsx           # /thank-you
│   │   ├── ResultPage.tsx             # /result (preview admin)
│   │   ├── CoachPage.tsx              # /coach
│   │   ├── DashboardPage.tsx          # /dashboard/:tipo
│   │   └── VerifyPage.tsx             # /verify?token=...
│   ├── store/useAssessmentStore.ts    # Estado global (Zustand)
│   ├── App.tsx
│   └── index.css                      # Variables de tema + Tailwind
├── public/dashboards/                  # Dashboards estáticos pre-renderizados
├── staticwebapp.config.json           # Rutas y reglas de navegación SPA
├── vite.config.ts
├── package.json
└── CLAUDE.md, CONTEXTO-AI-PULSE.md, readme_version_V5.md   # Documentación de referencia
```

---

## 🔐 Seguridad

Coexisten tres esquemas de autenticación independientes, cada uno con su propio secreto — deliberadamente separados para que filtrar uno no permita forjar otro:

- **Panel admin** (`/admin`): `ADMIN_PASSWORD` + token HMAC-SHA256 con 24 h de vigencia, validado en cada llamada vía header `X-Admin-Token`.
- **Sesión de participante/coach** (SSO Google/Microsoft, login de coach): `SESSION_SECRET`, HMAC, 7 días de vigencia. El SSO de participante viaja por redirect/store; los endpoints de coach (`coach-chat`, `coach-init`, `tasks-update`) validan el mismo token por request vía headers `X-Coach-Token`/`X-Coach-Email`.
- **Acceso a la invitación del assessment**: token único por participante, validado contra su fila real en `participants` (empresa+email por sí solos no bastan) y su expiración.
- **CORS**: whitelist estricta de orígenes, sin wildcard.

### Puntos de entrada de un participante

- **Invitación por admin** (la vía principal): `participants-upload` + `invitations-send` crean la fila y envían el link con token único; `auth-verify` lo valida al abrir el link.
- **Auto-registro por dominio** (`domain-register`): público, sin login previo, pero solo funciona si el dominio del email coincide con un allowlist configurado y la empresa está habilitada — no es un registro abierto a cualquiera.
- **Recuperación de acceso** (`access-request`): no crea participantes nuevos — es un frente de recuperación para quien perdió su email de invitación; busca la fila existente por email y le reenvía su token.
- **Waitlist**: sin relación con el assessment — señales de interés desde la landing pública.

---

## 📊 Panel de Administración

Acceder en: `https://aipulse.vinka.one/admin`

| Pestaña | Función |
|---------|---------|
| **Cargar Excel** | Subir lista de participantes (.xlsx). Columnas requeridas: `email`, `nombre`, `posicion`, `empresa`, `departamento` |
| **Participantes** | Lista completa con estado (`pending` / `started` / `completed`), columna empresa visible |
| **Empresas** | Habilitar/deshabilitar el acceso al assessment por empresa (multi-tenant) |
| **Invitaciones** | Enviar/reenviar emails con link único a participantes en estado `pending` |
| **Links de Acceso** | Gestionar y recuperar links de invitación individuales |
| **Reportería** | Generar y consultar los informes AIQ individuales y organizacionales |
| **Archivos** | Subir y listar archivos de referencia por empresa |
| **Preguntas** | Editar el cuestionario servido por `/api/questions-config` |

---

## 🛠️ Stack Tecnológico

| Categoría | Tecnología |
|-----------|------------|
| Frontend | React 19, TypeScript, Vite 6 |
| Estilos | Tailwind CSS v4 |
| Estado | Zustand |
| Routing | React Router v7 |
| Animaciones | `motion` (se importa como `motion/react`) |
| Backend | Azure Functions v4 — dos apps independientes: `api/` (síncrono) y `worker/` (generación de reportes en background) |
| Hosting | Azure Static Web Apps (producción) + ambiente de validación paralelo en AWS EC2 (`infra/aws/`) |
| Base de datos | Azure Table Storage + Blob Storage (informes) + Queue Storage |
| Email | Azure Communication Services |
| IA / Evaluación | Azure OpenAI (`gpt-5-mini`), proveedor configurable vía `AIQ_LLM_PROVIDER` |
| CI/CD | GitHub Actions |
| Fuentes | Bebas Neue, DM Sans, DM Mono, Big Shoulders Display |

---

## 🐛 Troubleshooting

**Las funciones retornan 500**
- Verificar que el workflow incluye `setup-node@v4` con `node-version: '20'`
- Confirmar todas las variables en Azure → Static Web App → Configuration (especialmente `ADMIN_PASSWORD`, `SESSION_SECRET`, `AZURE_STORAGE_CONNECTION_STRING`)

**Error 401 en /admin**
- Confirmar que `ADMIN_PASSWORD` está configurado

**No llegan los emails**
- Verificar que el dominio sender está verificado en Azure Communication Services
- Confirmar que `EMAIL_SENDER_ADDRESS` usa ese dominio verificado

**Participantes no aparecen**
- Verificar que `AZURE_STORAGE_CONNECTION_STRING` es correcto
- El storage account debe existir; las tablas se crean automáticamente en el primer insert

**`swa start` no arranca en local**
- No usar `swa start --api-location api` — usar siempre `--api-devserver-url http://localhost:7071` contra un `func start` ya corriendo (o directamente `scripts/dev-up.sh`)

---

<div align="center">
  <sub>Built for <a href="https://javiercruz.ai">JavierCruz.ai</a> · Powered by Azure Static Web Apps + React + Azure OpenAI</sub>
</div>
