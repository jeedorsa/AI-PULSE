/**
 * tableClient.js — Wrapper de TableClient.fromConnectionString que habilita
 * `allowInsecureConnection` automáticamente cuando la connection string es
 * HTTP (Azurite/desarrollo local), sin afectar el uso normal en producción
 * (HTTPS), donde ese flag no se activa.
 */
const { TableClient } = require("@azure/data-tables");

function createTableClient(connectionString, tableName) {
  const isHttp = /^DefaultEndpointsProtocol=http;/i.test(connectionString || "");
  return TableClient.fromConnectionString(
    connectionString,
    tableName,
    isHttp ? { allowInsecureConnection: true } : undefined
  );
}

module.exports = { createTableClient };
