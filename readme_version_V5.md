# AI Pulse — Motor de evaluación AIQ, Rúbrica v5

Este documento describe la reescritura del motor de evaluación AIQ implementada en la rama
`feature/aiq-rubrica-v5`: qué cambió, dónde vive cada pieza, cómo funciona la rúbrica v5 al
detalle, dónde y cómo se persiste la data, y los comandos exactos para levantar todo en local.

> Fuente de verdad de las reglas de negocio: el documento HTML `tabla_rubrica_aipulse-v5.html`
> entregado por el equipo de producto. Todo lo que describe este README es una transcripción
> fiel de ese documento a código — no se agregó, reinterpretó ni "mejoró" ninguna regla.

---

## 1. Qué cambió (resumen)

El sistema anterior tenía **tres motores de scoring inconsistentes entre sí**, y el que
realmente corría en producción (`localScore()` en el store de Zustand) ni siquiera evaluaba
el contenido de las respuestas — puntuaba por longitud de texto. El motor LLM real
(`api/grade`) existía pero estaba desconectado.

La reescritura introduce:

- **Un solo motor server-side**, `api/shared/aiqEvaluatorV5.js`, que evalúa el contenido real
  de las respuestas contra la rúbrica v5 usando Azure OpenAI.
- **Un nuevo esquema de resultado**: `{ nombre, email, empresa, nivel, puntaje, A, B, C, flags, recomendaciones_ids }`.
- **Migración de toda la data histórica** al nuevo formato (script one-time, no automático).
- **Actualización de todos los consumidores downstream** (listados, dashboards, informes, coach) para que convivan registros legacy y v5 sin romperse.

---

## 2. Dónde vive cada pieza nueva

| Archivo | Qué es |
|---|---|
| `api/shared/aiqRubricV5.js` | Config pura: pesos de sección, rangos de nivel, mapeo B1, catálogo de recomendaciones, umbral Champion. Sin llamadas externas. |
| `api/shared/aiqPromptsV5.js` | `SYSTEM_PROMPT` + `buildQuestionPrompt(questionId, params)` — los prompts calificadores de E2/E3/E5/B2/B4/C1/C2/C3, copiados literal del HTML. |
| `api/shared/aiqEvaluatorV5.js` | El motor: orquesta las 8 llamadas LLM, aplica las reglas determinísticas (Capa 3, N2, Capa 1.5, REGLA1_SEGURIDAD, flags, selección de recomendaciones) y devuelve el resultado final. Export principal: `evaluateAssessment(answers, participant, options)`. |
| `api/shared/assembleAnswers.js` | Reconstruye el objeto `answers` desde las columnas particionadas `answersV/A/B/C/D` (o el formato legado de un solo campo). Antes estaba duplicado en ~7 archivos. |
| `api/shared/tableClient.js` | Wrapper de `@azure/data-tables` que agrega `{ allowInsecureConnection: true }` automáticamente cuando la connection string es HTTP (Azurite). |
| `api/scripts/migrateToV5.js` | Script one-time para migrar toda la data histórica de `assessmentResults` al formato v5. Ver sección 6. |
| `api/shared/__tests__/aiqEvaluatorV5.test.js` | 35 tests unitarios (Jest) sobre el motor, con el cliente LLM mockeado. |

Archivos **eliminados** (motores obsoletos): `api/grade/` (function completa), `src/lib/geminiClient.ts`, y en `src/store/useAssessmentStore.ts` las funciones `calculateAIQ`/`localScore`/`getLevelFromScore`/`gradeWithAI`.

Archivos **modificados** (consumidores downstream, ver detalle en el plan de implementación): `api/results-save/index.js`, `api/results-list/index.js`, `src/pages/AdminPage.tsx`, `src/pages/ThankYouPage.tsx`, `api/report-generate-company/index.js`, `worker/company-report-http/index.js`, `worker/report-http/index.js`, `worker/report-processor/index.js`, `api/coach-init/index.js`, `api/coach-chat/index.js`.

---

## 3. La rúbrica v5 — documentación completa

### 3.1 Dónde se "hospeda" la rúbrica

La rúbrica **no vive en la base de datos ni es configurable en runtime** — es código estático
versionado en el repo:

- **Reglas, pesos, rangos, catálogo de recomendaciones** → `api/shared/aiqRubricV5.js`
- **Prompts calificadores enviados al LLM** → `api/shared/aiqPromptsV5.js`
- **Orquestación de las reglas** → `api/shared/aiqEvaluatorV5.js`

Cualquier cambio a la rúbrica (nuevo umbral, nueva tarjeta de recomendación, nuevo flag) implica
editar estos tres archivos y desplegar código — no hay un panel de administración para esto.

### 3.2 Qué preguntas requieren LLM y cuáles no

| Pregunta | Tipo | ¿LLM? |
|---|---|---|
| V1, V2, V3, V4 | Cerradas / selección | No — se capturan tal cual. Insumo de N2. |
| **E2 (P5), E3 (P6), E5 (P7)** | Abiertas — Sección A | **Sí** — 1 llamada cada una |
| B1 (P8) | Cerrada | No — mapeo directo opción→nivel |
| **B2 (P9), B4 (P10)** | Abiertas — Sección B | **Sí** — 1 llamada cada una |
| **C1 (P11), C2 (P12), C3 (P13)** | `prompt_input` — Sección C | **Sí** — 1 llamada cada una (framework RCTFR) |
| D1, D1b, D5, D6, D9 | Cerradas | No — se capturan tal cual (D5/D6 alimentan CANDIDATO_A_CHAMPION) |
| D2, D4, D7 | Abiertas, categorización temática | No — fuera de alcance del JSON individual, solo para informe organizacional |

Total: **8 llamadas a Azure OpenAI por evaluación**, lanzadas en paralelo con `Promise.allSettled`
(nunca `Promise.all`, para que el fallo de una no cancele las otras 7).

### 3.3 Reglas determinísticas aplicadas por pregunta

1. **Capa 3** (aplica a E2, E3, E5, B2, B4): si la respuesta está vacía, es `"."`/`"N/A"`, o tiene
   ≤3 palabras (`respuesta.trim().split(/\s+/).filter(Boolean)`) → **L1 directo, sin llamar al LLM**.
2. **N2 short-circuit**: si `V1=1` **y** `V2=["Ninguna todavía"]` → fuerza **L1** en E2, E3, E5, B1
   y B4 (toda Sección A + P8 + P10). **B2 nunca se ve afectada por esta regla** — siempre se evalúa
   con el LLM.
3. **Asignación de nivel por rúbrica**: el LLM devuelve el nivel L1-L4 según el prompt calificador
   específico de cada pregunta (criterio de calidad, no checklist mecánico).
4. **Capa 1.5** ("lenguaje prescriptivo / 3ª persona sin 'yo'"): baja 1 nivel respecto al asignado
   por el LLM, con piso en L1 (`Math.max(1, nivel - 1)`). En E3 esta capa es "especialmente fuerte".
5. **B1 (P8)** — mapeo directo, sin LLM: opción 1→L2, opción 2→L3, opción 3→L3, opción 4→L4, opción 5→L1.
6. **REGLA1_SEGURIDAD** (solo en B2): si la respuesta indica "comparto todo"/"no evito nada"/sin
   criterio de seguridad → dispara flag y **topa el puntaje y nivel finales globales en L2** (no
   solo el nivel de B2).
7. **C3 — CoT obligatorio**: sin señal explícita de razonamiento paso a paso → **techo L2 sin
   excepción**, sin importar qué tan bueno sea el resto del prompt (RCTFR no compensa la ausencia
   de Chain-of-Thought).
8. **C2 mide el delta**: se evalúan los elementos agregados sobre el prompt original, no los
   elementos totales del prompt mejorado.
9. **N4** (C1, C2, C3): si `tiempo_seg < 10` **y** el nivel calculado es ≥ L3 → cuenta como
   respuesta sospechosa de copy-paste. Si falta el dato de tiempo, esa pregunta se excluye del
   cómputo (nunca lanza excepción por campo faltante).

### 3.4 Cálculo de A, B, C, puntaje y nivel

- `A` = `Math.round(promedio(E2, E3, E5))` → entero 1-4
- `B` = `Math.round(promedio(B1, B2, B4))` → entero 1-4
- `C` = `Math.round(promedio(C1, C2, C3))` → entero 1-4
- `puntaje = A×0.30 + B×0.20 + C×0.50` (usando los enteros A/B/C ya redondeados) → rango 1.0-4.0
- `nivel` se deriva de `puntaje`:

  | Nivel | Rango de puntaje |
  |---|---|
  | L1 | 1.0 – 1.5 |
  | L2 | 1.6 – 2.5 |
  | L3 | 2.6 – 3.5 |
  | L4 | 3.6 – 4.0 |

  **Un solo nivel L4** — a diferencia del sistema anterior, no hay split L4T/L4L.

- Si se disparó **REGLA1_SEGURIDAD**: `puntaje = Math.min(puntaje, 2.5)` y `nivel` se recalcula
  sobre ese puntaje ya topado (ambos campos quedan siempre consistentes entre sí).

### 3.5 Catálogo de flags (`flags: string[]`)

| Flag | Condición |
|---|---|
| `N1` | `max(A,B,C) - min(A,B,C) >= 2` (perfil desbalanceado) |
| `N2_short_circuit` | V1=1 y V2=["Ninguna todavía"] (ver 3.3.2) |
| `N2_suave` | V1 ∈ {3,4} pero el nivel calculado de Sección A dio L1 (discordancia) |
| `N3` | ≥50% de {E2,E3,E5,B2,B4} son ≤5 palabras o vacías/"."/"N/A" |
| `N4x1` / `N4x2` / `N4x3` | Cuenta cuántas de {C1,C2,C3} tienen tiempo<10s y nivel≥L3 |
| `REGLA1_SEGURIDAD` | Ver 3.3.6 |
| `CANDIDATO_A_CHAMPION` | Ver 3.6 (las 4 condiciones son obligatorias) |
| `EVAL_ERROR_<QUESTIONID>` | Flag técnico interno (no de negocio): esa pregunta no pudo evaluarse con el LLM tras agotar reintentos, se le asignó L1 conservador — requiere revisión manual |

### 3.6 CANDIDATO_A_CHAMPION (interpretación estricta)

Se dispara **solo si se cumplen las 4 condiciones simultáneamente**:
1. `puntaje >= 3.6`
2. `nivel(E5) = L4`
3. Las 3 señales Champion presentes en E5 (liderazgo, recurso recurrente, impacto medible)
4. `D5 = "yes_active"` **o** `D6 = 1`

### 3.7 Construcción de `recomendaciones_ids`

1. Se rankean las secciones A/B/C (redondeadas) de más débil a más fuerte; empate → prioridad **C > A > B**.
2. Dentro de cada sección elegida, se toma la pregunta con el **nivel individual más bajo**
   (desempate por orden de catálogo: P5<P6<P7 / P9<P10 / P11<P12<P13).
3. **B1/P8 se excluye siempre** de la selección — no tiene tarjetas en el catálogo. Si es la
   pregunta más débil de Sección B, se pasa a B2/B4.
4. No se repite la misma sección dos veces en la lista final (2-3 IDs).
5. Si el nivel general es ≥ L3, al menos una recomendación debe apuntar a una transición `->L4`.
6. Formato del ID: `<Sección>-P<##>-L#->L#` (ej. `C-P11-L1->L2`).
7. **Caso límite**: si no quedan preguntas elegibles (ej. participante en L4 en todo), el array
   puede devolver **menos de 2 elementos, incluso 0** — nunca se fabrica contenido no presente en el catálogo.

### 3.8 Resiliencia del motor LLM

- Parseo de la respuesta del LLM siempre en try/catch; si falla o no tiene un `nivel` válido en
  `{L1,L2,L3,L4}` → se trata como fallo de esa pregunta puntual, nunca tumba las otras 7.
- **1 reintento automático** por pregunta ante error de red/5xx/JSON inválido, con backoff corto
  (`500ms`, `1500ms`) — no se reintenta ante 4xx (indicaría bug de prompt, no problema transitorio).
- **Timeout de 45s por llamada** (`LLM_TIMEOUT_MS`), independiente del timeout global de la Function.
- Si una pregunta agota reintentos sin respuesta válida: se le asigna **L1 conservador** + flag
  técnico `EVAL_ERROR_<QUESTIONID>`. El resto de la evaluación y el guardado se completan igual.
- `max_completion_tokens: 2000` en la llamada real a Azure OpenAI — los modelos de razonamiento
  (ej. `gpt-5-mini`) consumen `reasoning_tokens` ocultos que cuentan contra ese límite; con 500 el
  output visible quedaba vacío.

---

## 4. Cómo y dónde se ejecuta el motor

```
Frontend (ThankYouPage.tsx)
   │  POST /api/results-save  { token, participant, answers, metadata }
   ▼
api/results-save/index.js
   │  1) Valida el participante (tabla "participants", PartitionKey=empresa, RowKey=email)
   │  2) Chequea idempotencia: si ya existe un resultado con rubricVersion="v5" para ese token,
   │     devuelve el resultado ya persistido SIN re-evaluar (el LLM no es determinista)
   │  3) Llama a aiqEvaluatorV5.evaluateAssessment(answers, { nombre, email, empresa })
   ▼
api/shared/aiqEvaluatorV5.js
   │  - Pre-checks deterministas (Capa 3, N2 short-circuit)
   │  - 8 llamadas paralelas a Azure OpenAI (Promise.allSettled) para E2,E3,E5,B2,B4,C1,C2,C3
   │  - B1 por mapeo directo (sin LLM)
   │  - Calcula A/B/C, puntaje, nivel, flags, recomendaciones_ids
   ▼
Resultado persistido en Azure Table Storage (tabla "assessmentResults")
   + devuelto en la respuesta HTTP como { success, assessmentId, resultado }
```

No hay cómputo de score en el navegador — el frontend solo dispara la request y muestra la
respuesta del backend.

---

## 5. Dónde y cómo se guarda la data

**Azure Table Storage** (NO Cosmos DB, NO SQL). Tabla `assessmentResults`,
`PartitionKey = empresa`, `RowKey = token`.

Se **reutilizan las columnas existentes** para los campos con equivalente directo (para minimizar
consumidores a tocar), y se agregan 2 columnas nuevas puramente aditivas:

| Columna en la tabla | Viene de | Notas |
|---|---|---|
| `aiqScore` | `puntaje` (float 1.0-4.0) | Antes escala 0-5. **Cambio de escala**, no solo rename. |
| `aiqLevel` | `nivel` (L1-L4) | Antes L1-L4T/L4L. Se colapsa a un solo L4. |
| `sectionA` / `sectionB` / `sectionC` | `A` / `B` / `C` (int 1-4) | Antes float ponderado por pregunta; ahora promedio simple redondeado. |
| `alerts` | `JSON.stringify(flags)` | Vocabulario de flags completamente distinto al anterior (`REGLA_1` → `REGLA1_SEGURIDAD`, etc.) |
| `recomendacionesIds` (**nueva**) | `JSON.stringify(recomendaciones_ids)` | Sin equivalente previo |
| `rubricVersion` (**nueva**) | `"v5"` | Discriminador legacy vs. v5. Ausente = registro legacy no migrado |
| `challengeProfile` | — | **Eliminado sin reemplazo** en registros nuevos/migrados |
| `answersV/A/B/C/D` | — | Sin cambios — la ingesta de respuestas no se tocó |

`rubricVersion` es el **discriminador único** que usan todos los consumidores (`results-list`,
`AdminPage`, informes, coach) para saber si un registro es legacy o v5 y así interpretar
correctamente la escala/vocabulario de cada uno.

No se persiste el razonamiento largo del LLM por pregunta (para no acercarse al límite de 32KB
por propiedad de Table Storage) — solo el nivel resultante.

---

## 6. Migración de datos históricos

Script one-time, **no es una Azure Function** — se corre manualmente con Node:

```bash
cd api

# 1. Dry-run (no escribe nada, solo loguea lo que haría)
node scripts/migrateToV5.js --dry-run

# 2. Modo escritura real — requiere backup obligatorio
node scripts/migrateToV5.js --write --backup-file=./backup-assessmentResults.json

# Flags opcionales
node scripts/migrateToV5.js --write --backup-file=./backup.json \
  --batch-size=3 \     # participantes en paralelo (default 3)
  --delay-ms=1000 \    # pausa entre lotes, para no saturar Azure OpenAI (default 1000)
  --empresa=Inchcape   # migrar solo una empresa puntual (pruebas)
```

Características:
- **Idempotente**: si una entidad ya tiene `rubricVersion="v5"`, se salta.
- **Backup obligatorio** antes de escribir contra producción (`--backup-file`, si no se pasa
  `--write` aborta).
- Usa `updateEntity(..., "Replace")` (no `"Merge"`) para poder eliminar `challengeProfile` —
  Table Storage Merge no puede borrar propiedades, solo Replace.
- Corre primero contra Azurite con datos de prueba antes de correr contra producción real.
- **Consecuencia importante**: cambia retroactivamente el nivel/puntaje visible de participantes
  ya evaluados (ej. alguien `L4T` bajo la rúbrica vieja puede terminar en `L3` bajo v5).

---

## 7. Cómo levantar todo en local

### 7.1 Requisitos
- Node.js, Azure Functions Core Tools v4 (`func`), Azure Static Web Apps CLI (`swa`).
- Un único `api/local.settings.json` apuntando a Azurite (ver 7.2) — no existe ningún
  `local.settings.json` en `worker/`, ni copia ni symlink (ver nota abajo).

### 7.2 Variables de entorno relevantes (`local.settings.json`)

`api/local.settings.json` es el **único archivo** de configuración local en todo el repo —
`worker/` no tiene ninguno propio. Las credenciales (Azure OpenAI, Storage) viven en un solo
lugar y no se pueden desincronizar entre `api/` y `worker/`. `AzureWebJobsStorage` /
`AZURE_STORAGE_CONNECTION_STRING` deben apuntar a la connection string estándar de Azurite:

```
DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;
```

Azure Functions Core Tools solo lee `local.settings.json` desde el directorio actual — no hay
forma nativa de apuntarlo a un archivo de otra carpeta. Por eso `worker/scripts/start-local.js`
carga a mano las variables de `api/local.settings.json`, las inyecta al `process.env` del
subproceso y recién ahí arranca `func start --port 7072` (invocado vía `npm run start:local`
en `worker/`). `api/local.settings.json` está en `.gitignore` — no se versiona (contiene
credenciales reales de Azure OpenAI/ACS para pruebas).

### 7.3 Comandos, en orden (4 terminales)

```bash
# Terminal 1 — Azurite (emulador de Table/Blob/Queue Storage)
cd api
npm run azurite

# Terminal 2 — Azure Functions API (puerto 7071, default)
cd api
npm install          # si no se corrió antes
func start

# Terminal 3 — Azure Functions Worker (puerto 7072, informes + coach)
cd worker
npm install          # si no se corrió antes
npm run start:local  # carga api/local.settings.json al entorno y corre func start --port 7072

# Terminal 4 — Frontend (Vite) + proxy SWA
npm run dev                                             # Vite en :3000
swa start http://localhost:3000 --api-devserver-url http://localhost:7071   # proxy en :4280
```

La app completa queda en **http://localhost:4280** (frontend + `/api/*` proxied al Functions host real).

> Nota: `swa start http://localhost:3000 --api-location api` (dejando que SWA levante su propio
> Functions host) falla localmente porque intenta parsear
> `.github/workflows/azure-static-web-apps-*.yml` como config de build, y ese workflow usa
> `swa deploy` directo en vez del formato estándar de la acción oficial. Usar
> `--api-devserver-url http://localhost:7071` (con `func start` corriendo aparte, Terminal 2)
> evita ese problema por completo.

### 7.4 Tests unitarios

```bash
cd api
npm test     # 35 tests sobre aiqEvaluatorV5.js, LLM mockeado — no requiere Azurite ni func start
```

### 7.5 Limitación conocida (no introducida por este trabajo)

`worker/host.json` no tiene el bloque `"extensionBundle"` que sí tiene `api/host.json` — por eso
las funciones **queue-triggered** del worker (`report-processor`, `company-report-processor`, la
generación de informes en background) no cargan localmente (`func start` las reporta con
"binding type(s) 'queueTrigger' are not registered"). Los endpoints **HTTP** del worker
(`report-http`, `company-report-http`) sí funcionan normalmente. Este es un gap de configuración
preexistente en el repo, no relacionado con la rúbrica v5 — no se modificó como parte de este
trabajo.

### 7.6 Para probar el flujo completo (`results-save`)

`results-save` valida que exista un participante pre-cargado en la tabla `participants`
(`PartitionKey = empresa`, `RowKey = email`) antes de aceptar el token — igual que en producción,
donde el participante llega vía invitación. Para pruebas locales sin pasar por todo el flujo de
invitación, se puede sembrar un registro directamente en Azurite con `createTableClient` +
`upsertEntity`.

---

## 8. Esquema de resultado — referencia rápida

```json
{
  "nombre": "Ana Final",
  "email": "ana.final@test.com",
  "empresa": "General",
  "nivel": "L2",
  "puntaje": 2.3,
  "A": 3,
  "B": 2,
  "C": 2,
  "flags": [],
  "recomendaciones_ids": ["C-P11-L1->L2", "B-P9-L2->L3", "A-P5-L3->L4"]
}
```

Este es el único formato expuesto en la respuesta de `POST /api/results-save`
(`resultado`). Los campos internos (`rubricVersion`, `perQuestionLevels`) se persisten en la
tabla pero no se exponen en la respuesta pública.
