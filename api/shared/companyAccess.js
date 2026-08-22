const { createTableClient } = require("./tableClient");

function normalizeCompanyKey(empresa) {
  return (empresa || "default").trim().toLowerCase();
}

/**
 * ¿La empresa tiene el acceso habilitado para iniciar evaluaciones nuevas?
 *
 * Es un interruptor administrativo, no un control de seguridad: el
 * participante ya viene autenticado por token o por su registro en
 * `participants` cuando se llega hasta acá. Por eso, ante la duda, deja pasar:
 *
 *  - empresa sin fila en `companies` (404)  -> habilitada. Es el estado normal
 *    de toda empresa anterior a esta funcionalidad; lo contrario dejaría fuera
 *    a todos los clientes existentes.
 *  - fallo al consultar Table Storage       -> habilitada, y se registra un
 *    aviso. Bloquear a participantes legítimos por un problema transitorio de
 *    infraestructura es peor que dejar entrar a una empresa recién desactivada.
 *
 * `log` es opcional (el `context.log` de la Function) para dejar rastro del
 * segundo caso, que si se vuelve frecuente indica un problema de storage.
 */
async function isCompanyEnabled(connectionString, empresa, log) {
  const client = createTableClient(connectionString, "companies");
  try {
    const entity = await client.getEntity("company", normalizeCompanyKey(empresa));
    return entity.enabled !== false;
  } catch (err) {
    if (err.statusCode === 404) return true;
    if (log && log.warn) {
      log.warn(`isCompanyEnabled: no se pudo verificar "${empresa}", se permite el acceso:`, err.message);
    }
    return true;
  }
}

module.exports = { normalizeCompanyKey, isCompanyEnabled };
