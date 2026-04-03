module.exports = async function (context, req) {
  const endpoint   = process.env.AZURE_OPENAI_ENDPOINT   || "";
  const key        = process.env.AZURE_OPENAI_API_KEY     || "";
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT  || "";
  const version    = process.env.AZURE_OPENAI_API_VERSION || "";
  const storage    = process.env.AZURE_STORAGE_CONNECTION_STRING || "";

  // Intentar una llamada real a Azure OpenAI con 1 token para verificar conectividad
  let openai_status = "not_tested";
  let openai_error  = null;

  if (endpoint && key && deployment) {
    try {
      const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${version || "2024-12-01-preview"}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-key": key },
        body: JSON.stringify({
          messages: [{ role: "user", content: "di ok" }],
          max_completion_tokens: 5
        })
      });
      if (res.ok) {
        openai_status = "ok";
      } else {
        const err = await res.text();
        openai_status = `error_${res.status}`;
        openai_error  = err.slice(0, 300);
      }
    } catch (e) {
      openai_status = "connection_error";
      openai_error  = e.message;
    }
  }

  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({
      status:           "Function OK",
      node_version:     process.version,
      timestamp:        new Date().toISOString(),
      env: {
        azure_openai_key_exists:      !!key,
        azure_openai_endpoint:        endpoint ? endpoint.slice(0, 50) + "..." : "MISSING",
        azure_openai_deployment:      deployment || "MISSING",
        azure_openai_api_version:     version    || "MISSING",
        azure_storage_conn_exists:    !!storage,
        admin_password_exists:        !!process.env.ADMIN_PASSWORD,
      },
      openai_test: {
        status: openai_status,
        error:  openai_error
      }
    })
  };
};
