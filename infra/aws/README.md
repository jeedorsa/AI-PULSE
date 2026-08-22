# AI Pulse en AWS — despliegue en EC2

Segundo despliegue de AI Pulse en la cuenta AWS de Vinka (`715472012963`), **conviviendo**
con el de Azure: Azure sigue sirviendo producción (`aipulse.vinka.one`), esto es un ambiente
paralelo para validar la migración.

Enfoque: **lift-and-shift**. Las Azure Functions no se reescribieron — corren tal cual bajo un
host Express (`server/index.js`) que replica el contrato del runtime de Azure.

---

## 1. Recursos creados

### AWS (`us-east-1`, perfil `vinka-oneimpact`, todos con tag `proyecto=ai-pulse`)

| Recurso | ID / valor |
|---|---|
| EC2 | `i-038fdafd137fdf6a1` — `ai-pulse-prod`, t3.micro, Ubuntu 24.04, gp3 30 GB, IMDSv2 |
| Elastic IP | **54.243.108.143** |
| Security group | `sg-04baef252048f8315` — 22/80/443 desde 0.0.0.0/0 |
| Key pair | `ai-pulse-aws` → `~/.ssh/ai-pulse-aws.pem` (ed25519, sin passphrase) |
| Budget | `ai-pulse-mensual` — 20 USD/mes, avisa al 50% real y 100% proyectado a jesus@vinka.one |

`ssh -i ~/.ssh/ai-pulse-aws.pem ubuntu@54.243.108.143`

### Azure (agregado para este ambiente)

| Recurso | Para qué |
|---|---|
| Storage account `aipulsedataws` | **Datos aislados** del ambiente AWS: las 6 tablas, 2 colas y 3 contenedores. Migrados desde producción el 22-ago (ver §6). Evita que el ambiente escriba en la data real de `aipulsedata`. |

El ambiente AWS sigue usando de Azure: **Azure OpenAI** (`aipulse-aoai`, gpt-5-mini) y
**Communication Services**. Eso es deliberado en la fase lift-and-shift — migrar el motor de
scoring a Bedrock cambiaría los puntajes de la rúbrica y es decisión de producto.

---

## 2. Cómo funciona

```
      Internet :80
          │
        nginx  ──────────────►  /opt/ai-pulse/dist        (build de Vite)
          │
          └── /api/*  proxy ─►  127.0.0.1:8080
                                     │
                             server/index.js  (PM2: "ai-pulse-api")
                                     │
                    ┌────────────────┼────────────────────┐
              api/*/index.js   worker/*-http     pollers de cola
              (29 functions)   (2 functions)   (report-processor,
                                                company-report-processor)
                                     │
                    ┌────────────────┼────────────────────┐
            aipulsedataws       Azure OpenAI         Azure ACS
          (tablas/colas/blobs)   (gpt-5-mini)      (emails, apagado)
```

### El host de functions (`server/index.js`)

Lee cada `function.json` y monta lo que declara, sin tocar los handlers:

- **httpTrigger** → `/api/<carpeta>` con los métodos declarados. Se construye un `context`
  compatible (`context.res`, `context.log.{info,warn,error}`) y al terminar se traduce
  `context.res` a la respuesta de Express.
- **queueTrigger** → un poller sobre la cola de Azure Storage que decodifica el base64 (igual
  que el runtime de Azure), invoca el handler, borra el mensaje al terminar bien y lo deja
  reaparecer si falla, descartándolo a los 5 intentos (`maxDequeueCount` de `host.json`).

Esto además resuelve un gap conocido de local dev: `worker/host.json` no tiene `extensionBundle`,
así que las funciones queue-triggered **no cargan** con `func start`. Bajo este host sí corren.

`WORKER_BASE_URL` apunta a `http://127.0.0.1:8080/api` — api y worker viven en el mismo proceso.

---

## 3. Operación

```bash
# Desplegar (build local + rsync + npm install + nginx + pm2)
bash infra/aws/deploy.sh

# Re-sincronizar la config desde las app settings de Azure
bash infra/aws/sync-env.sh

# Recrear la infra (idempotente, no duplica nada)
bash infra/aws/provision.sh

# Logs y estado
ssh -i ~/.ssh/ai-pulse-aws.pem ubuntu@54.243.108.143 'pm2 logs ai-pulse-api --lines 100'
ssh -i ~/.ssh/ai-pulse-aws.pem ubuntu@54.243.108.143 'pm2 status'
```

### Configuración

Vive en `/etc/ai-pulse/env` en el servidor (no en el repo). `sync-env.sh` la genera desde las
app settings de la SWA de Azure, con estas sustituciones para el ambiente AWS:

| Variable | Valor en AWS | Por qué |
|---|---|---|
| `AZURE_STORAGE_CONNECTION_STRING` | `aipulsedataws` | no tocar los datos de producción |
| `APP_BASE_URL` | `http://54.243.108.143` | los links de invitación apuntan acá |
| `WORKER_BASE_URL` | `http://127.0.0.1:8080/api` | el worker corre en el mismo proceso |
| `EMAIL_SENDER_ADDRESS` | *vacío* | **el ambiente no envía correos**. Para habilitarlos: `AI_PULSE_ENVIAR_EMAILS=1 bash infra/aws/sync-env.sh` |

---

## 4. Notas de la instancia

- **t3.micro tiene ~911 MB de RAM.** El user-data agrega **2 GB de swap** (`vm.swappiness=10`);
  sin eso `npm install` se cae. Misma lección que CallWave.
- Por eso el frontend **se construye en local** y se sube ya compilado — `vite build` en la
  instancia es lento e inestable.
- **El arranque tarda ~20-40 s**: cargar `openai` v6 desde `aiqEvaluatorV5` toma ~19 s solo en
  `require`. No es un cuelgue; PM2 lo reinicia bien.

---

## 5. Pendientes para que esto sea producción

1. **HTTPS y dominio.** Hoy solo HTTP sobre IP. Falta un subdominio (ej. `aws.aipulse.vinka.one`)
   y Let's Encrypt vía certbot. El DNS de `vinka.one` lo controla Javier.
2. **Login social roto en este ambiente.** Google y Microsoft exigen que el redirect URI esté
   registrado; `http://54.243.108.143` no lo está. Hay que agregarlo en ambas consolas, o probar
   solo el flujo por token de invitación.
3. **Datos.** Las tablas están vacías. Para validar con datos reales hay que copiar desde
   `aipulsedata` (~1000 participants, 439 results) — pendiente de decidir, son datos personales.
4. **SES.** La cuenta ya está fuera del sandbox (200 envíos/24 h) pero sin dominios verificados.
   Migrar de ACS a SES requiere registros DNS en `vinka.one`.
5. **Backups.** No hay snapshots programados del volumen EBS.
6. **Bedrock.** Disponible y probado en esta cuenta (`claude-haiku-4-5` responde). Cambiar el
   motor de scoring **alteraría los puntajes de la rúbrica** — no se tocó.


---

## 6. Migración de datos (22-ago-2026)

Toda la data de `aipulsedata` se copió a `aipulsedataws` con
[`migrate-data.cjs`](migrate-data.cjs) y se comprobó con
[`verify-data.cjs`](verify-data.cjs), que compara **cada propiedad de cada fila** y
el contenido de cada blob por hash.

| Tabla / contenedor | Filas o blobs |
|---|---|
| participants | 1820 |
| assessmentProgress | 637 |
| assessmentResults | 439 |
| waitlist | 10 |
| coachSessions | 2 |
| companies | 1 |
| aiq-reports / company-data / config | 10 / 1 / 1 |
| **Total** | **2909 filas + 12 blobs, 0 fallidas** |

Resultado de la verificación: todas las tablas idénticas, todos los blobs byte a byte.
El origen nunca se escribe (`migrate-data.cjs` es de solo lectura sobre SRC) y el
`--write` exige `--backup-file`.

```bash
D=... # connection strings
SRC_CONN=... DST_CONN=... node infra/aws/migrate-data.cjs --count
SRC_CONN=... DST_CONN=... node infra/aws/migrate-data.cjs --write --backup-file=./backup.json
SRC_CONN=... DST_CONN=... node infra/aws/verify-data.cjs
```

El respaldo JSON (3.7 MB) contiene datos personales: **no versionarlo**.

---

## 7. Motor LLM: Azure OpenAI ↔ Bedrock

`gpt-5-mini` se usaba en **9 lugares** (scoring AIQ, coach init/chat, y 5 rutas de
informes entre `api/` y `worker/`). Se introdujo el adaptador
`api/shared/llmClient.js` (copiado en `worker/shared/llmClient.js`, ver la nota del
archivo) que acepta el body de chat completions de OpenAI y devuelve la misma forma
de respuesta, de modo que cada llamador solo cambió la línea del `fetch`.

```
AIQ_LLM_PROVIDER=azure     -> Azure OpenAI gpt-5-mini  (actual)
AIQ_LLM_PROVIDER=bedrock   -> Bedrock, BEDROCK_MODEL_ID
```

Cambiar de motor es una variable de entorno y un `pm2 restart` — no requiere
redesplegar código:

```bash
bash infra/aws/sync-env.sh                 # bedrock + Claude Haiku (default)
AI_PULSE_LLM=azure bash infra/aws/sync-env.sh   # volver a gpt-5-mini
```

Los **embeddings siguen en Azure OpenAI** (`text-embedding-3-large`) a propósito:
cambiarlos invalidaría los vectores ya indexados.

La EC2 llega a Bedrock por el instance profile **`ai-pulse-ec2`** (permisos
`bedrock:InvokeModel` sobre modelos Anthropic y perfiles de inferencia) — sin claves
en disco. El rol también trae `AmazonSSMManagedInstanceCore`.

### Habilitación de Anthropic en Bedrock (resuelto el 22-ago-2026)

Al principio toda invocación a un modelo de Anthropic devolvía
`ResourceNotFoundException: Model use case details have not been submitted for this
account`. La antigua página *Model access* de la consola **fue retirada por AWS**: el
formulario de caso de uso aparece ahora al invocar el modelo desde el **playground**
(Bedrock → Model catalog → el modelo → Open in Playground). Enviado el formulario, el
acceso se concede en minutos.

Intentar enviarlo por API (`put-use-case-for-model-access`) no funcionó: la API rechaza
con `Invalid form data` y AWS no documenta los valores aceptados de `industryOption`
ni `intendedUsers`. Hay que usar el playground.

### Límite de requests por minuto — importante

La cuenta tiene aplicado **10 requests/minuto** para Haiku 4.5
(`Cross-region model inference requests per minute`, cuota `L-CCA5DF70`), aunque el
default del servicio es 10000. Es la restricción que AWS pone a cuentas nuevas, y
**no se puede levantar con Service Quotas** (rechaza pedir menos que el default):
requiere un caso de soporte o acumular historial de facturación.

Como el motor AIQ dispara **9 llamadas por assessment**, sin control se estrangula
solo: todas las preguntas caían en `EVAL_ERROR` → L1 → puntajes falsamente bajos.
`llmClient.js` lo maneja con dos defensas:

- **Límite de concurrencia** (`BEDROCK_MAX_CONCURRENCIA`, default 2).
- **Reintentos con backoff exponencial y jitter** ante `ThrottlingException`
  (`BEDROCK_MAX_REINTENTOS`, default 5: 1s, 2s, 4s, 8s, 16s).

Con eso un assessment completa sin errores en ~16 s.

**La llamada consolidada de la rúbrica v6 resuelve el problema de fondo:** empaqueta
las 9 preguntas en **1 solo request**. Medido en la instancia: 1 llamada al LLM por
assessment, 0 fallos. Con los mismos 10 rpm el techo pasa de ~1 a **~10 assessments
por minuto**. Si la llamada consolidada falla, el motor cae a modo legacy (9 llamadas)
y ahí el límite de concurrencia vuelve a ser lo que evita el throttling.

Solicitudes de aumento de cuota abiertas el 22-ago (estado `PENDING`):
`9234807573b74e5b8932578d82b6266dgoU8ufux` y `66eb823df4cd4627ae1ad03943687da6GLI0a8v3`,
ambas pidiendo 12000 (la API no acepta pedir menos que el default de 10000). La vía
rápida es un caso de soporte: *Service limit increase* está incluido en el plan Basic.

---

## 8. Ojo: Diego montó un ALB sobre esta misma instancia

El 21-ago por la noche Diego creó `aipulse-alb` + `tg-aipulse` apuntando a
`i-038fdafd137fdf6a1` (la instancia de este despliegue) y le cambió el security
group por `ai-pulse-2-sg` ("SG del AI-Pulse V2"), que solo admite 80/443 **desde el
ALB** y no tiene puerto 22.

No se revirtió nada de eso. Se **añadió** `ai-pulse-sg` como segundo security group,
reducido a **22 desde una sola IP**, para recuperar SSH sin afectar su montaje.
Consecuencia: `http://54.243.108.143` ya no responde directo — el acceso HTTP es por
el ALB. Conviene coordinar con Diego quién es dueño de esta instancia antes de
seguir tocándola.
