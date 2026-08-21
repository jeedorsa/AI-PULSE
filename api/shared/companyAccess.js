const { createTableClient } = require("./tableClient");

function normalizeCompanyKey(empresa) {
  return (empresa || "default").trim().toLowerCase();
}

async function isCompanyEnabled(connectionString, empresa) {
  const client = createTableClient(connectionString, "companies");
  try {
    const entity = await client.getEntity("company", normalizeCompanyKey(empresa));
    return entity.enabled !== false;
  } catch (err) {
    if (err.statusCode === 404) return true;
    throw err;
  }
}

module.exports = { normalizeCompanyKey, isCompanyEnabled };
