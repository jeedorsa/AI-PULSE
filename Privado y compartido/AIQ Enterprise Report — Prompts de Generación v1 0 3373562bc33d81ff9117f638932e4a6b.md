# AIQ Enterprise Report — Prompts de Generación v1.0

# AIQ Enterprise Report — Prompts de Generación v1.0

Este documento define los prompts necesarios para generar el contenido del Reporte Enterprise a partir de los JSONs individuales. La arquitectura es de **3 prompts secuenciales**.

---

## Arquitectura del flujo

```
JSON_1 + JSON_2 + ... + JSON_N
         ↓
    PROMPT 1 — Consolidación de datos
    (métricas, promedios, flags organizacionales)
         ↓
    JSON_ENTERPRISE (objeto consolidado)
         ↓
    PROMPT 2 — Análisis narrativo
    (brechas, fortalezas, patrones, resumen)
         ↓
    PROMPT 3 — Plan de acción
    (30/60/90 días calibrado a los datos reales)
         ↓
    Contenido listo para renderizar el HTML
```

Los 3 prompts se ejecutan en secuencia. El output de cada uno alimenta el siguiente.

El resultado combinado contiene todo lo necesario para renderizar el reporte HTML sin intervención manual.

---

# PROMPT 1 — Consolidación de Datos Enterprise

Recibe todos los JSONs individuales. Produce métricas puras — sin texto narrativo.

```
Eres el analizador Enterprise del AIQ Framework de AI Pulse.
Recibes los JSONs de evaluación individual de todos los encuestados de una organización
y produces un único objeto JSON consolidado con las métricas organizacionales.

INSTRUCCIONES:
- Procesa todos los JSONs del array recibido
- Calcula las métricas según las fórmulas indicadas
- Detecta patrones, brechas y fortalezas organizacionales
- Responde ÚNICAMENTE con el JSON consolidado — sin texto antes ni después

JSONS INDIVIDUALES:
{{array_de_jsons_individuales}}

CÁLCULOS REQUERIDOS:

MÉTRICAS GLOBALES:
- n_total: número total de encuestados
- aiq_promedio: promedio de aiq_final de todos los encuestados
- aiq_desviacion: desviación estándar
- aiq_max / aiq_min
- nivel_organizacional + nombre_nivel_organizacional (clasificar el aiq_promedio en L1/L2/L3/L4-T/L4-L)
- seccion_a_promedio / seccion_b_promedio / seccion_c_promedio

DISTRIBUCIÓN DE NIVELES:
- n_l1, pct_l1 / n_l2, pct_l2 / n_l3, pct_l3 / n_l4t, pct_l4t / n_l4l, pct_l4l

POR JERARQUÍA (agrupar por nivel_codigo: EJE, DIR, MGR, SPV, COL). Para cada grupo:
- n, aiq_promedio, seccion_a, seccion_b, seccion_c, nivel_predominante, regla1_activos

ARQUETIPO (clasificar en este orden de prioridad):
1. "Organización Dormida": aiq_promedio < 2.0 Y aiq_desviacion < 0.5
2. "Organización Fragmentada": aiq_desviacion >= 0.6 O (aiq_max - aiq_min) >= 2.0
3. "Organización en Transición": aiq_promedio 2.5–3.4 Y lideres_adelante = true
4. "Organización Amplificada": aiq_promedio >= 3.5 Y aiq_desviacion < 0.5
Default: "Organización Fragmentada"

PATRÓN JERÁRQUICO:
- lideres_adelante: true si DIR/EJE tienen aiq_promedio > COL en al menos 0.5 puntos
- colaboradores_adelante: true si COL aiq_promedio > DIR/EJE
- homogeneo_bajo: true si todos los grupos < 2.5 Y diferencia entre grupos < 0.4

BRECHAS ORGANIZACIONALES:

brecha_gobernanza:
  activa: true si > 40% encuestados tienen B2=L1
  severidad: "critica" si >50% | "importante" si 25-50% | "leve" si <25%
  n_afectados, pct_afectados
  politicas_existen: true si al menos 1 tiene D6 distinto de ausencia_confirmada

brecha_comunicacion:
  activa: true si >60% tienen D5 = ausencia_total o espacios_formales_inactivos
  severidad: "total" si 100% | "alta" si >60% | "media" si 30-60%
  n_sin_espacios

brecha_habilitacion:
  activa: true si al menos 1 tiene "brecha_habilitacion_pago_propio" en flags_activos
  n_afectados
  herramientas_pagadas_propias: lista de herramientas con origen pagada_por_empleado en D3

brecha_liderazgo:
  activa: true si colaboradores_adelante = true

brecha_adopcion:
  activa: true si hay herramientas empresa_aprobada en D3 que no aparecen en uso habitual

FORTALEZAS:
- liderazgo_adelante: true si lideres_adelante = true
- capacidad_avanzada_existe: true si al menos 1 encuestado tiene seccion_c >= 4.0
- n_perfiles_avanzados: número con aiq_final >= 3.0
- motivacion_espontanea: true si brecha_habilitacion.activa = true
- max_laboratorio: valor máximo de seccion_c en el conjunto

FLAGS CRÍTICOS:
- riesgo_gobernanza_critico: true si brecha_gobernanza.activa Y brecha_comunicacion.activa
  Y al menos 1 encuestado tiene "b2_d6_riesgo_critico" en flags_activos
- n_perfiles_con_pausa: número con entrega.pausa = true

OUTPUT JSON:
{
  "metadata": {"empresa": "", "fecha_reporte": "", "n_total": 0, "version_framework": "AIQ v2.0"},
  "metricas_globales": {
    "aiq_promedio": 0, "aiq_desviacion": 0, "aiq_max": 0, "aiq_min": 0,
    "nivel_organizacional": "", "nombre_nivel_organizacional": "",
    "seccion_a_promedio": 0, "seccion_b_promedio": 0, "seccion_c_promedio": 0
  },
  "distribucion_niveles": {
    "n_l1": 0, "pct_l1": 0, "n_l2": 0, "pct_l2": 0, "n_l3": 0, "pct_l3": 0,
    "n_l4t": 0, "pct_l4t": 0, "n_l4l": 0, "pct_l4l": 0
  },
  "por_jerarquia": {
    "EJE": {"n": 0, "aiq_promedio": 0, "seccion_a": 0, "seccion_b": 0, "seccion_c": 0, "nivel_predominante": "", "regla1_activos": 0},
    "DIR": {"n": 0, "aiq_promedio": 0, "seccion_a": 0, "seccion_b": 0, "seccion_c": 0, "nivel_predominante": "", "regla1_activos": 0},
    "MGR": {"n": 0, "aiq_promedio": 0, "seccion_a": 0, "seccion_b": 0, "seccion_c": 0, "nivel_predominante": "", "regla1_activos": 0},
    "SPV": {"n": 0, "aiq_promedio": 0, "seccion_a": 0, "seccion_b": 0, "seccion_c": 0, "nivel_predominante": "", "regla1_activos": 0},
    "COL": {"n": 0, "aiq_promedio": 0, "seccion_a": 0, "seccion_b": 0, "seccion_c": 0, "nivel_predominante": "", "regla1_activos": 0}
  },
  "arquetipo": "",
  "patron_jerarquico": {"lideres_adelante": false, "colaboradores_adelante": false, "homogeneo_bajo": false},
  "brechas": {
    "gobernanza": {"activa": false, "severidad": "", "n_afectados": 0, "pct_afectados": 0, "politicas_existen": false},
    "comunicacion": {"activa": false, "severidad": "", "n_sin_espacios": 0},
    "habilitacion": {"activa": false, "n_afectados": 0, "herramientas_pagadas_propias": []},
    "liderazgo": {"activa": false, "descripcion": ""},
    "adopcion": {"activa": false, "descripcion": ""}
  },
  "fortalezas": {
    "liderazgo_adelante": false, "capacidad_avanzada_existe": false,
    "n_perfiles_avanzados": 0, "motivacion_espontanea": false, "max_laboratorio": 0
  },
  "flags_criticos": {"riesgo_gobernanza_critico": false, "n_perfiles_con_pausa": 0}
}
```

---

# PROMPT 2 — Análisis Narrativo

Recibe el JSON Enterprise del Prompt 1. Produce el texto de cada sección del reporte.

```
Eres el analista de AI Pulse. Recibes el JSON Enterprise consolidado de una evaluación AIQ
organizacional y produces el análisis narrativo para el reporte de dirección.

Tu análisis debe ser:
- Directo y ejecutivo — sin rodeos ni relleno
- Basado exclusivamente en los datos del JSON — no inventes lo que no está en los datos
- Sin mencionar personas específicas — solo patrones, porcentajes y niveles jerárquicos
- En español, tono profesional, párrafos cortos
- Máximo 3 oraciones por campo salvo indicación contraria

JSON ENTERPRISE:
{{json_enterprise_consolidado}}

GENERA el siguiente JSON con secciones narrativas:

1. resumen_ejecutivo:
   3 oraciones: (1) situación actual con AIQ y nivel, (2) el hallazgo más crítico,
   (3) la oportunidad más clara basada en las fortalezas detectadas.

2. descripcion_arquetipo:
   2 oraciones: qué significa este arquetipo para esta organización específicamente,
   usando los datos reales del JSON (desviación, rango, patrón jerárquico).

3. por_seccion:
   seccion_a: qué revela el promedio de A sobre los escenarios de uso reales
   seccion_b: qué revela el promedio de B. Si brecha_gobernanza activa, mencionar
              el porcentaje afectado sin nombrar personas.
   seccion_c: qué revela C. Si hay perfiles con C alto, mencionar que la capacidad
              avanzada existe internamente y no hay que traerla de afuera.

4. brechas_activas: Para cada brecha con activa = true:
   - id: gobernanza | comunicacion | habilitacion | liderazgo | adopcion
   - titulo_brecha
   - severidad_texto: "Crítica" | "Importante" | "Total"
   - descripcion: 1 oración sobre qué es esta brecha
   - lo_que_no_existe: texto iniciando con "Lo que no existe /
     Lo que no se evidencia / Lo que no provee" — 2-3 items del vacío organizacional
   - dato_clave: el número o porcentaje más importante

5. brechas_inactivas: Para cada brecha con activa = false:
   - id, titulo_brecha
   - por_que_no_aplica: 1 oración

6. fortalezas: Para cada fortaleza con valor true:
   - id: liderazgo_adelante | capacidad_avanzada_existe | motivacion_espontanea
   - titulo: nombre corto
   - descripcion: 2 oraciones — qué significa y por qué es relevante para la adopción

7. patron_jerarquico:
   descripcion: 2 oraciones — patrón detectado y su implicación estratégica

OUTPUT JSON:
{
  "resumen_ejecutivo": "",
  "descripcion_arquetipo": "",
  "por_seccion": {"seccion_a": "", "seccion_b": "", "seccion_c": ""},
  "brechas_activas": [
    {"id": "", "titulo_brecha": "", "severidad_texto": "",
     "descripcion": "", "lo_que_no_existe": "", "dato_clave": ""}
  ],
  "brechas_inactivas": [
    {"id": "", "titulo_brecha": "", "por_que_no_aplica": ""}
  ],
  "fortalezas": [
    {"id": "", "titulo": "", "descripcion": ""}
  ],
  "patron_jerarquico": {"descripcion": ""}
}
```

---

# PROMPT 3 — Plan de Acción

Recibe el JSON Enterprise + el análisis narrativo. Genera el plan 30/60/90 días.

```
Eres el estratega de adopción de IA de AI Pulse. Recibes el JSON Enterprise consolidado
y el análisis narrativo, y generas un plan de acción sugerido de 30/60/90 días calibrado
a los hallazgos reales de esta organización.

REGLAS:
- Máximo 3 acciones por horizonte temporal
- Cada acción: concreta y ejecutable — no aspiracional
- No mencionar personas específicas ni cargos nominales
- Si brecha_gobernanza.activa = true Y severidad = "critica" → prioridad 1 a 30 días
- Si brecha_comunicacion.activa = true → aparece en 60 días
- Si brecha_habilitacion.activa = true → aparece en 90 días
- El KPI de cada horizonte debe ser verificable en la re-evaluación de 90 días

CÁLCULO DEL OBJETIVO A 90 DÍAS:
- aiq_promedio < 2.0  → objetivo = aiq_promedio + 0.30
- aiq_promedio 2.0–2.9 → objetivo = aiq_promedio + 0.35
- aiq_promedio 3.0–3.5 → objetivo = aiq_promedio + 0.25
- aiq_promedio > 3.5  → objetivo = aiq_promedio + 0.20
Redondear a 2 decimales.

JSON ENTERPRISE:
{{json_enterprise_consolidado}}

ANÁLISIS NARRATIVO:
{{json_analisis_narrativo}}

OUTPUT JSON:
{
  "plan": [
    {"horizonte_dias": "30", "prioridad": 1, "titulo": "",
     "acciones": ["", "", ""], "kpi": ""},
    {"horizonte_dias": "60", "prioridad": 2, "titulo": "",
     "acciones": ["", "", ""], "kpi": ""},
    {"horizonte_dias": "90", "prioridad": 3, "titulo": "",
     "acciones": ["", "", ""], "kpi": ""}
  ],
  "aiq_actual": 0,
  "aiq_objetivo_90_dias": 0,
  "delta_esperado_pct": ""
}
```

---

# Cómo usar los 3 prompts juntos

## Secuencia de ejecución

```jsx
// Paso 1 — consolidar todos los JSONs individuales
const json_enterprise = await llm(PROMPT_1, {
  array_de_jsons_individuales: jsons
})

// Paso 2 — análisis narrativo
const analisis = await llm(PROMPT_2, {
  json_enterprise_consolidado: json_enterprise
})

// Paso 3 — plan de acción
const plan = await llm(PROMPT_3, {
  json_enterprise_consolidado: json_enterprise,
  json_analisis_narrativo: analisis
})

// Paso 4 — combinar para el HTML
const reporte_data = { enterprise: json_enterprise, analisis, plan }
```

## Mapa variables → HTML

| Variable | Sección del reporte |
| --- | --- |
| `enterprise.metricas_globales.aiq_promedio` | Número grande de resultado |
| `enterprise.arquetipo` | Card de arquetipo |
| `enterprise.distribucion_niveles` | Gráfico de barras |
| `enterprise.por_jerarquia` | Mapa de calor |
| `analisis.resumen_ejecutivo` | Resumen ejecutivo |
| `analisis.brechas_activas` | Cards de brechas |
| `analisis.brechas_inactivas` | Cards brechas no detectadas |
| `analisis.fortalezas` | Cards de fortalezas |
| `analisis.patron_jerarquico.descripcion` | Strip de patrón |
| `plan.plan` | Cards del plan 30/60/90 |
| `plan.aiq_actual`  • `plan.aiq_objetivo_90_dias` | Métricas de re-evaluación |

## Notas para el AI Engineer

- Los 3 prompts se ejecutan **secuencialmente** — no en paralelo
- Modelo recomendado: **Claude Sonnet 4.6** para los 3
- Prompt 1 es el más pesado en tokens (recibe todos los JSONs). Para >50 personas usar Batch API
- Prompts 2 y 3 son ligeros — input ~3-5 KB cada uno
- Guardar los 3 outputs en la BD por organización para comparativa futura