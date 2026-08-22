# Contexto AI Pulse — recuperación de sesiones y estado del proyecto

> Generado el **21-ago-2026**. Consolida todo lo recuperable de las sesiones previas de Claude Code
> sobre AI Pulse más el estado real del repositorio y de los PRs.

---

## 1. Inventario de sesiones

### 1.1 Sesiones encontradas

| Sesión | Fecha | Proyecto | Estado del transcript |
|---|---|---|---|
| `546873e9-34d7-4867-b4db-8ca4395bd458` | 9-jul-2026 17:01 | `/Users/jeedorsa/Documents/AI-PULSE` | ❌ purgado |
| `68254c4a-900a-4509-a8fc-58aa4aa2ac07` | 9-jul-2026 17:08–17:43 | `/Users/jeedorsa/Documents/AI-PULSE` | ❌ purgado (memoria sobrevivió) |
| `67e6bfd7-d05a-43bf-9778-49a4037a8db3` | 9-jul-2026 17:50–19:31 | `/Users/jeedorsa/Documents/AI-PULSE` | ❌ purgado (memoria sobrevivió) |
| `571a8abc-94d1-4ba8-9443-ffc89b640f61` | 21-ago-2026 | `/Users/jeedorsa/Documents/VINKA/AI-PULSE` | ✅ actual |

**Por qué se perdieron:** el proyecto se movió de `~/Documents/AI-PULSE` a `~/Documents/VINKA/AI-PULSE`,
lo que creó un directorio de sesiones nuevo, y los `.jsonl` de julio quedaron fuera de la ventana de
retención de Claude Code (~30 días). Se verificó que no están en disco, ni en Papelera, ni en backups.
**Lo que sí sobrevivió**: la memoria persistente del proyecto y el historial de prompts (`~/.claude/history.jsonl`).

### 1.2 Descartadas (mencionan "AI-PULSE" solo en listados de directorio)

`VINKA/8b5c90be` (evaluación del repo yc-software/qm), `VINKA-one-impact/390c0739`, `WMT/ab052394`
(Callwave), `BCI/75b8893f`, `sr-lectorpdf-util/15f3f5e6`. Ninguna trabajó sobre AI Pulse.

---

## 2. Memoria recuperada (copiada a este proyecto)

Los 4 archivos de memoria de `~/.claude/projects/-Users-jeedorsa-Documents-AI-PULSE/memory/`
se copiaron a `~/.claude/projects/-Users-jeedorsa-Documents-VINKA-AI-PULSE/memory/`.

### 2.1 Pendientes al 9-jul-2026 (`ai-pulse-pendientes.md`)

1. ~~Diego Fernandez (diego@vinka.one) / Entra ID~~ **RESUELTO** — tiene rol *Application Administrator*
   en el tenant `javiervinka.onmicrosoft.com` (objectId `87e7be61-99f8-48c4-8dea-15a8687f4e66`, también
   Owner de la suscripción).
2. **diego@doro.one (Q18)** — esperando decisión de Jesús. ⚠️ **sigue abierto**
3. **DNS de email de vinka.one** — MX apunta a Google Workspace (`aspmx.l.google.com`), pero el SPF
   (`v=spf1 include:spf.protection.outlook.com include:dc-aa8e722993._spfm.vinka.one -all`) **no incluye**
   `include:_spf.google.com` y el DMARC está en `p=reject`. Riesgo: correos salientes desde Gmail fallan SPF.
   Revisar con Javier. ⚠️ **sigue abierto**

**Entorno Azure:**
- Subscription AI-PULSE: `6e19750c-5558-47d1-8189-5d6ca2eec58f`
- Resource group: `ai-pulse-javier_group`
- El `az` CLI de Jesús tiene por defecto el tenant de BCI (`jortisa@bci.cl`). Para tocar AI-PULSE usar
  **siempre** `--subscription 6e19750c-5558-47d1-8189-5d6ca2eec58f`.
- Para Microsoft Graph del tenant vinka:
  `az account get-access-token --subscription 6e19750c-... --resource-type ms-graph`.
  **Nunca** `az rest` a Graph sin token explícito — cae en el tenant BCI.

### 2.2 Previews de Azure SWA (`ai-pulse-swa-previews.md`)

SWA `ai-pulse-app` (rg `ai-pulse-javier_group`):
- **No cerrar/reabrir un PR** para relanzar el workflow: los runs de `closed`/`reopened` corren en desorden
  y el job "Close Preview Environment" borra el ambiente recién desplegado. Usar `gh run rerun <run-id>`.
- **La propagación del edge es lenta**: tras crear un preview, Azure dice "Ready"/"Succeeded" pero el
  hostname `black-water-0d824a310-<PR>.centralus.7.azurestaticapps.net` puede servir el 404 genérico
  durante ~30-60 min. No es corrupción — esperar antes de diagnosticar.
- Smoke test: `/api/health` (existe en prod y en previews).

### 2.3 Convenciones de trabajo

- **Sin coautoría de IA en commits** (`no-claude-coauthor.md`): no agregar `Co-Authored-By: Claude` ni
  menciones de IA en mensajes de commit ni descripciones de PR. Nota: ~20 commits antiguos aún lo traen
  (p. ej. `f117758`); no se reescribieron porque rompería las ramas de Diego y los PRs abiertos.
  ⚠️ Los commits de Diego de hoy (`2bbe382`, `67d35a5`) sí traen el trailer.
- **Español**: Jesús es colombiano — hablarle de "tú" ("puedes", "dime", "avísame"), nunca voseo.

---

## 3. Historial de prompts recuperado (9-jul-2026)

Reconstruido desde `~/.claude/history.jsonl`:

| Hora | Prompt |
|---|---|
| 17:01 | ¿estás ahí? ¿puedes ver la sesión que tuvimos acá? |
| 17:08 | hola / revisa la última sesión, tenemos mucho que hacer |
| 17:20 | pull al repo, Diego hizo hartos cambios; ¿por qué no se generó el link de preview del PR? |
| 17:38 | elimíname de los commits todo lo que diga que fue hecho por ti |
| 17:43 | no nos desviemos; el link no está funcionando ¿por qué? |
| 17:50 | ¿qué modelo estamos usando? y ¿por qué falla el link? |
| 19:04 | continúa |
| 19:10 | ¿puedes revisar los cambios que hizo Diego y validar que funcionaron bien? |
| 19:31 | (WhatsApp de Diego) faltan variables: `GOOGLE_CLIENT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_TENANT_ID`, `APP_BASE_URL` — en desarrollo `APP_BASE_URL` estaba en localhost y rompía el login |

**Temas de esa sesión:** previews de SWA que no se generaban, hardening del `results-save` (embedding +
indexado en Vector DB best-effort, commit `f117758`), recuperación de 2 encuestas terminadas de tebsa,
y el login Google/Microsoft de Diego.

---

## 4. Estado del repositorio (21-ago-2026)

Repo: `https://github.com/jeedorsa/AI-PULSE` · Producción: **`https://aipulse.vinka.one`** (dominio custom de la SWA; el README menciona `ai-pulse.javiercruz.ai`, desactualizado)

### 4.1 Ramas

| Rama | HEAD | Fecha | Estado |
|---|---|---|---|
| `origin/main` | `21df6cd` | 19-jul | Merge del PR #26. Tiene **toda la rúbrica v5** |
| `origin/feature/aiq-rubrica-v5` | `67d35a5` | **21-ago (hoy)** | 4 commits sobre main → **rúbrica v6**. Es el PR #27 |
| `origin/fix/critical-security-post-v5` | `63a7657` | 13-jul | Ya mergeada en main (PRs #23, #24) |
| `origin/staging`, `origin/diego-2`, `origin/diego-2.0`, `origin/develop-diego`, 5× `origin/devin/*` | — | mar–jul | Históricas, candidatas a limpieza |

⚠️ La rama local `fix/critical-security-post-v5` está **1 commit detrás** del remoto y su trabajo ya
está en `main`. Para continuar hay que moverse a `feature/aiq-rubrica-v5`.

### 4.2 PR #27 — ABIERTO, esperando tu review

**`feat(aiq): reemplazar motor de evaluación v5 por v6 + bloqueo de copy-paste`**
Autor: DiegoB276 · Abierto: 21-jul-2026 · Actualizado: **hoy 21-ago 21:26** · +1791 / −815
Reviewer solicitado: **jeedorsa (tú)** · `MERGEABLE` / `CLEAN` · Build ✅ pasa
Preview: `https://black-water-0d824a310-27.centralus.7.azurestaticapps.net`

**Commits:**
1. `fee1868` reemplazar motor AIQ v5 por v6
2. `63a2e6a` bloquear copy-paste en preguntas abiertas y Sección C
3. `2bbe382` **Optimización de evaluation V6** (hoy 10:34)
4. `67d35a5` **feat(admin): gestión de habilitación de empresas** (hoy 14:25) ← *posterior a la descripción del PR*

**Cambios de comportamiento del motor v6 vs v5:**

| Regla | v5 | v6 |
|---|---|---|
| Rangos de nivel | L1 1.0–1.5 · L2 1.6–2.5 · L3 2.6–3.5 · L4 3.6–4.0 | L1 1.0–1.8 · L2 1.9–2.8 · L3 2.9–3.8 · L4 3.9–4.0 |
| Tope `REGLA1_SEGURIDAD` | 2.5 | **2.8** |
| Umbral `CANDIDATO_A_CHAMPION` | ≥ 3.6 | **≥ 3.9** |
| E6 | fuera del motor | renumerada a **P8 en Sección A**, excluida de N3 y del catálogo de recomendaciones |
| N4x# (copy-paste por tiempo) | < 10 s | **< 50 s**; si dispara junto con Sección C en L4, fuerza esa sección a nivel 3 antes de la fórmula ponderada |
| `coach-access` | — | degrada a `recomendaciones: []` para filas que no sean `rubricVersion: "v6"` |

**No es una migración**: los resultados v5 existentes quedan intactos, sin recompute.

**Bloqueo de copy-paste:** hook `usePasteGuard` en `OpenQuestion.tsx` (E2/E3/E5/E6/B2/B4/D2/D4/D7) y
`PromptingIDE.tsx` (C1/C2/C3) — intercepta el evento `paste`, lo bloquea y avisa.

**Optimización V6 (`2bbe382`, hoy):** llamada **consolidada** al LLM — 1 request para las 9 preguntas
calificables en vez de 9 individuales. Timeout de 150 s (vs 90 s individual). Palanca de reversión sin
deploy: `AIQ_LLM_MODE=legacy` en la Function App; además cae a legacy automáticamente por assessment si
la consolidada falla entera. Tests: `aiqEvaluatorV6.test.js`.

**Gestión de empresas (`67d35a5`, hoy):** permite desactivar el acceso de una empresa desde el panel
admin, bloqueando nuevos inicios (link directo, whitelist o dominio abierto) sin afectar a quienes ya
están respondiendo. Endpoints nuevos `companies-list`, `company-update`; shared `companyAccess.js`.

### 4.3 Working tree

```
 M .DS_Store
?? añadido_javier/     (Excel Copilot EC-CO, Maestro AIPulse Inchcape, 3 dashboards HTML)
?? scripts/            (migrate-callwave.sh — parece no pertenecer a este repo)
```

Ninguno está versionado. `añadido_javier/` son entregables de Javier; `scripts/migrate-callwave.sh`
probablemente se traspapeló desde el proyecto Callwave.

---

## 5. Arquitectura (referencia rápida)

```
React 18 + Vite + TS (src/)  →  Azure Static Web Apps
        │
        ├── /api    Azure Functions v4 Node 18 (35 functions)
        └── /worker Azure Functions (informes + coach, puerto 7072 en local)

Azure Table Storage   participants, assessmentResults (PartitionKey=empresa, RowKey=token)
Azure OpenAI          motor de evaluación AIQ
Azure Communication Services  emails de invitación
```

Documentación completa del motor y de cómo levantar local: **`readme_version_V5.md`** (359 líneas) —
rúbrica al detalle, esquema de persistencia, script de migración, los 4 terminales de local dev.

**Gotchas de local dev ya documentados ahí:**
- `api/local.settings.json` es el **único** archivo de config local; `worker/scripts/start-local.js` lo
  inyecta al entorno del worker.
- Usar `swa start http://localhost:3000 --api-devserver-url http://localhost:7071` — la variante
  `--api-location api` falla al parsear el workflow de GitHub.
- `worker/host.json` no tiene `extensionBundle` → las funciones queue-triggered del worker no cargan en
  local (gap preexistente).

---

## 6. Pendientes abiertos

1. **Revisar y decidir el PR #27** — lleva un mes abierto y Diego siguió empujando hoy. Los dos commits
   de hoy (optimización consolidada del LLM y gestión de empresas) **no están descritos** en el cuerpo
   del PR.
2. **Q18 / diego@doro.one** — esperando tu decisión desde julio.
3. **SPF de vinka.one** — falta `include:_spf.google.com` con DMARC en `p=reject`. Revisar con Javier.
4. **Trailer de coautoría de IA** en los commits nuevos de Diego (`2bbe382`, `67d35a5`), contra la
   convención del repo.
5. **Limpieza de ramas** — 5 ramas `devin/*` y 3 de Diego, todas ya mergeadas o abandonadas.
6. **Retención de sesiones** — subir `cleanupPeriodDays` en `~/.claude/settings.json` para no volver a
   perder transcripts.


---

## 7. Despliegue en AWS (21-ago-2026)

Segundo ambiente en la cuenta AWS de Vinka (`715472012963`), **conviviendo** con Azure.
Enfoque lift-and-shift: las Azure Functions corren sin modificar bajo un host Express.

**Estado: desplegado y verificado** → http://54.243.108.143

| Componente | En Azure | En AWS |
|---|---|---|
| Frontend | Static Web App | nginx + build de Vite en `/opt/ai-pulse/dist` |
| 29 functions HTTP | Azure Functions runtime | `server/index.js` bajo PM2, puerto 8080 |
| 2 queue-triggered | queueTrigger | pollers sobre la cola de Azure Storage |
| Datos | `aipulsedata` | **`aipulsedataws`** — storage aislado, tablas vacías |
| LLM | Azure OpenAI gpt-5-mini | el mismo (Bedrock disponible pero sin usar) |
| Email | ACS | apagado (`EMAIL_SENDER_ADDRESS` vacío) |

Verificado end-to-end: frontend 200, SPA fallback, `/api/health` con `openai_test: ok`,
escritura real en tabla, los 2 pollers escuchando, 0 errores y 0 reinicios en PM2.
Se confirmó que la escritura fue al storage aislado y que producción quedó intacta.

Detalle completo, operación y pendientes: `infra/aws/README.md`.

### Lo que falta para que AWS sea producción

1. **HTTPS y dominio** — hoy solo HTTP sobre IP. Requiere DNS de `vinka.one` (lo controla Javier).
2. **Login social** — Google/Microsoft rechazan `http://54.243.108.143` como redirect URI.
3. **Datos** — las tablas están vacías; copiar desde producción es decisión pendiente (datos personales).
4. **SES** — fuera del sandbox pero sin dominios verificados; migrar de ACS requiere DNS.
5. **Backups** — sin snapshots del EBS.
