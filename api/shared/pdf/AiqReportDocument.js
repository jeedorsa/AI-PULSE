// Documento PDF "Perfil AIQ" — puerto a @react-pdf/renderer del dashboard
// de src/pages/CoachPage.tsx (líneas ~306-467), sin JSX (api/ es CommonJS
// plano). Se excluyen deliberadamente:
//  - el <aside> "Ir a mi banco de prompts" (pedido explícito del usuario)
//  - el navbar con "Cerrar sesión" (no aplica a un documento estático;
//    se reemplaza por un encabezado simple)
//  - el emoji 🚀 (sin soporte de glifos de color en fuentes TTF/WOFF
//    planas) — se aproxima con una forma simple.
// El patrón de puntos de fondo del header SÍ se replica (ver buildDotGrid),
// vía una grilla de círculos SVG — no hay equivalente a un CSS
// radial-gradient tileado, pero un grid de círculos produce el mismo efecto.
const React = require("react");
const { Document, Page, View, Text, Link, Svg, Circle } = require("@react-pdf/renderer");
const {
  LEVEL_NAMES,
  ESCALA_INFO,
  DIM_PROFILE_LABELS,
  DIM_LEVEL_DESC,
  INT_TO_LEVEL_CODE,
  DIM_BAR_PCT,
  DIM_BAR_COLOR,
} = require("./aiqPdfConstants");
const { normalizeLevel, dimLevelInt, fechaPerfil } = require("./aiqPdfDerive");

const h = React.createElement;

const COLOR_PRIMARY = "#FE3C1C";
const COLOR_DARK = "#111111";
const COLOR_TEXT_MUTED = "#808080"; // text-[#808080], usado en CoachPage.tsx para cuerpo secundario
const COLOR_G4 = "#AAAAAA";
const COLOR_B3 = "#B3B3B3"; // text-[#B3B3B3] (fecha, empresa en el header oscuro)
const COLOR_D3 = "#E5E5E5";
const PAGE_BG = "#F7F7F7"; // CoachPage.tsx: <div className="min-h-screen bg-[#F7F7F7]">

// Grilla de puntos que aproxima el CSS
// `radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1.6px)`
// `background-size: 15px 15px` del header oscuro (CoachPage.tsx líneas
// 347-350). react-pdf no tiene background tileado, así que se dibuja como
// círculos SVG absolutos detrás del contenido. La opacidad es más alta que
// el 0.10 del CSS original a propósito: un círculo vectorial de borde duro
// necesita más opacidad que un radial-gradient con borde difuminado
// (antialiased) del navegador para ser perceptible a esta escala.
function buildDotGrid({ width, height, spacing = 9, radius = 0.6, opacity = 0.18 }) {
  const dots = [];
  for (let y = spacing / 2; y < height; y += spacing) {
    for (let x = spacing / 2; x < width; x += spacing) {
      dots.push(h(Circle, { key: `${x}-${y}`, cx: x, cy: y, r: radius, fill: "#FFFFFF", fillOpacity: opacity }));
    }
  }
  return h(
    Svg,
    { width, height, style: { position: "absolute", top: 0, left: 0 } },
    ...dots
  );
}

const styles = {
  page: {
    padding: 24,
    fontFamily: "DM Sans",
    fontSize: 9.5,
    color: COLOR_DARK,
    backgroundColor: PAGE_BG,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 10,
  },
  headerWordmark: { fontFamily: "Bebas Neue", fontSize: 20, color: COLOR_PRIMARY },
  headerTagline: { fontFamily: "DM Mono", fontSize: 6.5, color: COLOR_G4, letterSpacing: 1.2 },

  darkCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: COLOR_DARK,
    borderRadius: 10,
    paddingTop: 17,
    paddingHorizontal: 20,
    paddingBottom: 16,
    marginBottom: 10,
  },
  badgeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(254,60,28,0.25)",
    backgroundColor: "rgba(254,60,28,0.1)",
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  badgeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLOR_PRIMARY },
  badgeText: { fontFamily: "DM Mono", fontWeight: 500, fontSize: 6.5, color: COLOR_PRIMARY, letterSpacing: 0.8 },
  dateText: { fontFamily: "DM Sans", fontWeight: 300, fontSize: 8, color: COLOR_B3 },

  identityRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 },
  nombre: { fontFamily: "Bebas Neue", fontSize: 24, color: "#FFFFFF" },
  empresa: { fontFamily: "DM Sans", fontWeight: 300, fontSize: 8.5, color: COLOR_B3, marginTop: 3 },
  levelBadge: {
    backgroundColor: COLOR_PRIMARY,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginBottom: 4,
  },
  levelBadgeText: { fontFamily: "Bebas Neue", fontSize: 28, color: "#FFFFFF" },
  levelName: { fontFamily: "Bebas Neue", fontSize: 12, color: "#FFFFFF", textAlign: "right" },

  escalaGrid: { flexDirection: "row", gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  escalaCell: { flex: 1, borderRadius: 6, borderWidth: 1, padding: 7 },
  escalaCode: { fontFamily: "Bebas Neue", fontSize: 13, marginBottom: 2 },
  escalaName: { fontFamily: "DM Mono", fontWeight: 500, fontSize: 6, letterSpacing: 0.4, marginBottom: 3 },
  escalaDesc: { fontFamily: "DM Sans", fontSize: 6.5, lineHeight: 1.35 },

  encuadreCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLOR_D3,
    borderLeftWidth: 4,
    borderLeftColor: COLOR_PRIMARY,
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  encuadreText: { fontFamily: "DM Sans", fontStyle: "italic", fontSize: 9.5, color: COLOR_TEXT_MUTED, lineHeight: 1.6 },
  encuadreSignRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  encuadreRule: { width: 20, height: 2, backgroundColor: COLOR_PRIMARY },
  encuadreSign: { fontFamily: "Bebas Neue", fontSize: 10, color: COLOR_DARK },

  sectionLabel: {
    fontFamily: "DM Mono",
    fontWeight: 500,
    fontSize: 7,
    color: COLOR_TEXT_MUTED,
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 2,
  },

  dimRow: {
    flexDirection: "row",
    borderRadius: 10,
    marginBottom: 9,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLOR_D3,
  },
  dimLabelPanel: { width: 118, backgroundColor: COLOR_DARK, padding: 11, justifyContent: "space-between" },
  dimLabelText: { fontFamily: "Bebas Neue", fontSize: 11, color: "#FFFFFF", lineHeight: 1.25 },
  dimBarTrack: { width: "100%", height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)", marginTop: 10, marginBottom: 4 },
  dimBarFill: { height: 3, borderRadius: 2, backgroundColor: COLOR_PRIMARY },
  dimLevelText: { fontFamily: "Bebas Neue", fontSize: 9, color: COLOR_PRIMARY, letterSpacing: 0.4 },
  dimDescPanel: { flex: 1, backgroundColor: "#FFFFFF", padding: 11, justifyContent: "center" },
  dimDescText: { fontFamily: "DM Sans", fontSize: 8.5, color: COLOR_TEXT_MUTED, lineHeight: 1.55 },

  nextCard: {
    backgroundColor: "#0A0A0A",
    borderRadius: 10,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    marginTop: 2,
  },
  nextBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "rgba(254,60,28,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  nextBadgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR_PRIMARY },
  nextLabel: { fontFamily: "DM Mono", fontWeight: 500, fontSize: 7, color: COLOR_PRIMARY, letterSpacing: 1, marginBottom: 4 },
  nextBody: { fontFamily: "DM Sans", fontWeight: 300, fontSize: 8.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 },
  nextBrand: { fontFamily: "DM Sans", fontWeight: 500, color: COLOR_PRIMARY },

  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
    paddingTop: 12,
    marginTop: 6,
  },
  footerBrand: { fontFamily: "Big Shoulders Display", fontWeight: 900, fontSize: 15, color: COLOR_DARK, letterSpacing: 0.5, textTransform: "uppercase" },
  footerMeta: { fontFamily: "DM Sans", fontSize: 8.5, color: COLOR_TEXT_MUTED },
  footerLink: { fontFamily: "DM Sans", fontWeight: 500, fontSize: 8.5, color: "#000000", textDecoration: "underline" },
};

function buildAiqReportDocument(profile) {
  const nivelActual = normalizeLevel(profile.aiqLevel);
  const dimLevels = {
    A: dimLevelInt(profile.sectionA || 0, profile.rubricVersion),
    B: dimLevelInt(profile.sectionB || 0, profile.rubricVersion),
    C: dimLevelInt(profile.sectionC || 0, profile.rubricVersion),
  };
  const dimLevelCodes = {
    A: INT_TO_LEVEL_CODE[dimLevels.A],
    B: INT_TO_LEVEL_CODE[dimLevels.B],
    C: INT_TO_LEVEL_CODE[dimLevels.C],
  };
  const fecha = fechaPerfil(profile.completedAt);

  const escalaCells = ESCALA_INFO.map((item) => {
    const active = item.code === nivelActual;
    return h(
      View,
      {
        key: item.code,
        style: [
          styles.escalaCell,
          {
            backgroundColor: active ? "#2A1712" : "#1A1A1A",
            borderColor: active ? COLOR_PRIMARY : "#2A2A2A",
          },
        ],
      },
      h(Text, { style: [styles.escalaCode, { color: active ? COLOR_PRIMARY : "rgba(255,255,255,0.25)" }] }, item.code),
      h(Text, { style: [styles.escalaName, { color: active ? "rgba(254,60,28,0.7)" : "rgba(255,255,255,0.2)" }] }, LEVEL_NAMES[item.code]),
      h(Text, { style: [styles.escalaDesc, { color: active ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)" }] }, item.desc)
    );
  });

  const dimRows = ["A", "B", "C"].map((dim) => {
    const lvl = dimLevelCodes[dim];
    return h(
      View,
      { key: dim, style: styles.dimRow },
      h(
        View,
        { style: styles.dimLabelPanel },
        h(Text, { style: styles.dimLabelText }, DIM_PROFILE_LABELS[dim]),
        h(
          View,
          null,
          h(View, { style: styles.dimBarTrack }, h(View, { style: [styles.dimBarFill, { width: `${DIM_BAR_PCT[lvl]}%` }] })),
          h(Text, { style: styles.dimLevelText }, `${lvl} · ${LEVEL_NAMES[lvl]}`)
        )
      ),
      h(View, { style: styles.dimDescPanel }, h(Text, { style: styles.dimDescText }, DIM_LEVEL_DESC[dim][lvl]))
    );
  });

  return h(
    Document,
    { title: `Perfil AIQ - ${profile.nombre || ""}` },
    h(
      Page,
      { size: "A4", style: styles.page },

      // Encabezado (reemplaza el navbar — sin botón de "Cerrar sesión")
      h(
        View,
        { style: styles.header },
        h(Text, { style: styles.headerWordmark }, "AIQ"),
        h(Text, { style: styles.headerTagline }, "AI PULSE · DIAGNÓSTICO DE MADUREZ DE USO DE IA PERSONAL")
      ),

      // Tarjeta de perfil
      h(
        View,
        { style: styles.darkCard },
        buildDotGrid({ width: 548, height: 280 }),
        h(
          View,
          { style: styles.badgeRow },
          h(
            View,
            { style: styles.badgePill },
            h(View, { style: styles.badgeDot }),
            h(Text, { style: styles.badgeText }, "DIAGNÓSTICO AIQ · AI PULSE")
          ),
          h(Text, { style: styles.dateText }, fecha)
        ),
        h(
          View,
          { style: styles.identityRow },
          h(
            View,
            null,
            h(Text, { style: styles.nombre }, profile.nombre || ""),
            h(Text, { style: styles.empresa }, profile.empresa || "")
          ),
          h(
            View,
            { style: { alignItems: "flex-end" } },
            h(View, { style: styles.levelBadge }, h(Text, { style: styles.levelBadgeText }, nivelActual)),
            h(Text, { style: styles.levelName }, LEVEL_NAMES[nivelActual])
          )
        ),
        h(View, { style: styles.escalaGrid }, ...escalaCells)
      ),

      // Encuadre
      h(
        View,
        { style: styles.encuadreCard },
        h(
          Text,
          { style: styles.encuadreText },
          "Este diagnóstico es el punto de partida en AI Pulse. No mide tu desempeño ni tu potencial como profesional: mide dónde estás hoy con la IA para diseñar el camino que tiene más sentido para ti. No hay respuestas correctas ni incorrectas: hay puntos de partida distintos, y todos son válidos."
        ),
        h(
          View,
          { style: styles.encuadreSignRow },
          h(View, { style: styles.encuadreRule }),
          h(Text, { style: styles.encuadreSign }, "Equipo VINKA")
        )
      ),

      // Dimensiones
      h(Text, { style: styles.sectionLabel }, "TU PERFIL POR DIMENSIÓN"),
      ...dimRows,

      // Lo que viene
      h(
        View,
        { style: styles.nextCard },
        h(View, { style: styles.nextBadge }, h(View, { style: styles.nextBadgeDot })),
        h(
          View,
          { style: { flex: 1 } },
          h(Text, { style: styles.nextLabel }, "LO QUE VIENE"),
          h(
            Text,
            { style: styles.nextBody },
            "Basado en este diagnóstico, el programa ",
            h(Text, { style: styles.nextBrand }, "AI Pulse"),
            " te acompaña con sesiones diseñadas para tu perfil y el de tu equipo. Más información pronto."
          )
        )
      ),

      // Footer
      h(
        View,
        { style: styles.footer },
        h(Text, { style: styles.footerBrand }, "VINKA"),
        h(Text, { style: styles.footerMeta }, "© 2026 Vinka SAS · vinka.one"),
        h(Link, { src: "https://www.linkedin.com/company/vinkalab/", style: styles.footerLink }, "LinkedIn")
      )
    )
  );
}

module.exports = { buildAiqReportDocument };
