# 🚀 AI-Pulse — Deployment Package para Azure

## ⚠️ Descubrimiento importante

Después de revisar el código, **la app actualmente NO hace llamadas a Gemini**.  
El scoring es 100% local (regex + heurísticas en el browser).  
El `GEMINI_API_KEY` existe en la config pero no se usa todavía.

**Consecuencia**: puedes desplegar ahora mismo sin preocuparte por la API key.  
**Y ya dejamos todo listo** para cuando quieras agregar IA real (calificación de prompts, feedback personalizado, etc.).

---

## Arquitectura resultante

```
Usuario
  │
  ▼
ai-pulse.javiercruz.com          ← Azure Static Web Apps (FREE)
  │
  ├── /                          ← React SPA (dist/)
  ├── /api/gemini-proxy          ← Azure Function (proxy seguro)  ← GEMINI_API_KEY aquí
  │                                                                   (nunca al browser)
  └── DNS CNAME → *.azurestaticapps.net
```

---

## 📁 Archivos que debes agregar a tu repo

```
AI-Pulse-main/
├── staticwebapp.config.json          ← Copiar desde root/
├── src/
│   └── lib/
│       └── geminiClient.ts           ← Copiar desde root/src/lib/
├── api/
│   ├── package.json
│   └── gemini-proxy/
│       ├── index.js
│       └── function.json
└── .github/
    └── workflows/
        └── azure-static-web-apps.yml
```

---

## 🔧 Pasos de despliegue

### 1. Agregar archivos al repo

Copia los archivos de este paquete a tu repositorio de AI-Pulse según la estructura de arriba.

### 2. Subir a GitHub

```bash
git add .
git commit -m "feat: add Azure deployment config + Gemini proxy"
git push origin main
```

### 3. Crear recurso en Azure Portal

1. Ve a [portal.azure.com](https://portal.azure.com)
2. **Crear recurso** → busca **"Static Web Apps"**
3. Configura:
   - **Resource Group**: `rg-aipulse` (nuevo)
   - **Name**: `ai-pulse`
   - **Plan**: **Free**
   - **Region**: East US 2
   - **Source**: GitHub
   - **Repo**: tu repositorio de AI-Pulse
   - **Branch**: `main`
   - **Build Preset**: **Vite**
   - **App location**: `/`
   - **API location**: `api`
   - **Output location**: `dist`
4. **Review + Create**

Azure inyecta automáticamente el workflow `.github/workflows/` — reemplázalo con el de este paquete.

### 4. Configurar el secreto AZURE_STATIC_WEB_APPS_API_TOKEN

Azure te da un token de despliegue. Agrégalo a GitHub:

1. Azure Portal → tu Static Web App → **Manage deployment token** → copiar
2. GitHub → tu repo → **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret**: `AZURE_STATIC_WEB_APPS_API_TOKEN` → pegar token

### 5. Configurar GEMINI_API_KEY en la Function App

La API key va en Azure, nunca en GitHub:

1. Azure Portal → tu Static Web App → **Configuration**
2. **+ Add** → Name: `GEMINI_API_KEY` → Value: tu key de [Google AI Studio](https://aistudio.google.com)
3. **Save**

### 6. Configurar subdominio

En Azure → tu Static Web App → **Custom domains** → **+ Add** → `ai-pulse.javiercruz.com`

En tu proveedor de DNS (GoDaddy/Namecheap/Cloudflare):

| Tipo | Nombre | Valor |
|------|--------|-------|
| CNAME | `ai-pulse` | `<nombre>.azurestaticapps.net` |
| TXT | `_dnsauth.ai-pulse` | (token que te da Azure) |

SSL se activa automáticamente en ~10 minutos.

---

## 💡 Cómo usar el cliente de Gemini cuando lo necesites

Cuando quieras agregar IA real (ej: calificar respuestas abiertas con Gemini), importa el helper:

```typescript
import { generateContent } from '../lib/geminiClient';

// En tu componente o store:
const feedback = await generateContent(`
  Califica este prompt de 1 a 5 según buenas prácticas de prompting:
  "${userPrompt}"
  
  Responde solo con un JSON: { "score": number, "feedback": string }
`);

const result = JSON.parse(feedback);
```

El helper llama a `/api/gemini-proxy` (Azure Function) — la API key nunca sale del servidor.

---

## 💰 Costo estimado en Azure

| Servicio | Tier | Costo/mes |
|---|---|---|
| Static Web Apps | Free | $0 |
| Azure Functions (incluido) | Free (1M llamadas/mes) | $0 |
| Bandwidth (100 GB incluidos) | — | $0 |
| **Total Azure** | | **~$0** |
| Gemini API (Google, externo) | pay-per-use | ~$2–10 según uso |

Tus $1,000 de Azure credit duran años con este uso.
