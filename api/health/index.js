module.exports = async function (context, req) {
  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "Function OK",
      azure_openai_key_exists: !!process.env.AZURE_OPENAI_API_KEY,
      node_version: process.version,
      timestamp: new Date().toISOString()
    })
  };
};
