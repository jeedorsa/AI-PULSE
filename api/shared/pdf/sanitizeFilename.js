// nombre/email de participantes son datos semi-controlados (auto-ingresados
// en el registro) — se sanitizan antes de usarlos como nombre de entrada
// dentro del .zip para evitar path traversal o caracteres inválidos.
function sanitizeFilename(raw, fallback = "reporte") {
  const cleaned = String(raw || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[/\\:*?"<>|\x00-\x1f]/g, "") // caracteres inválidos / traversal
    .replace(/^\.+/, "") // sin puntos al inicio (oculto / "..")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return cleaned || fallback;
}

module.exports = { sanitizeFilename };
