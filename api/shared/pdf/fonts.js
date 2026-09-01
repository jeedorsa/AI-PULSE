const path = require("path");
const { Font } = require("@react-pdf/renderer");

const FONTS_DIR = path.join(__dirname, "fonts");

let registered = false;

/**
 * Registra las fuentes vendorizadas (ver fonts/OFL.txt) usadas por
 * AiqReportDocument.js. Idempotente — @react-pdf/renderer no soporta
 * fuentes del sistema/CSS, requiere Font.register() con bytes reales.
 *
 * DM Sans y Big Shoulders Display se distribuyen en Google Fonts solo como
 * variable fonts; @react-pdf/renderer (via fontkit) no instancia variable
 * fonts por peso declarado, así que se vendorizan instancias estáticas ya
 * resueltas (formato .woff, que fontkit sí decodifica nativamente) tomadas
 * del proyecto Fontsource, que las construye a partir de las mismas fuentes
 * de Google Fonts.
 */
function registerFonts() {
  if (registered) return;

  // El diseño original (CoachPage.tsx) hace word-wrap simple sin guiones;
  // react-pdf guioniza automáticamente por defecto, lo que corta palabras
  // como "trabajo" en "tra-bajo" dentro de los paneles angostos.
  Font.registerHyphenationCallback((word) => [word]);

  Font.register({
    family: "Bebas Neue",
    src: path.join(FONTS_DIR, "BebasNeue-Regular.ttf"),
  });

  Font.register({
    family: "DM Mono",
    fonts: [
      { src: path.join(FONTS_DIR, "DMMono-Regular.ttf"), fontWeight: 400 },
      // Google Fonts no publica un peso ≥600 estático para DM Mono (el sitio
      // web tampoco lo tiene — usa faux-bold del navegador); todo peso mono
      // ≥500 se resuelve a esta instancia Medium.
      { src: path.join(FONTS_DIR, "DMMono-Medium.ttf"), fontWeight: 500 },
    ],
  });

  Font.register({
    family: "DM Sans",
    fonts: [
      { src: path.join(FONTS_DIR, "DMSans-Light.woff"), fontWeight: 300, fontStyle: "normal" },
      { src: path.join(FONTS_DIR, "DMSans-Regular.woff"), fontWeight: 400, fontStyle: "normal" },
      { src: path.join(FONTS_DIR, "DMSans-Medium.woff"), fontWeight: 500, fontStyle: "normal" },
      { src: path.join(FONTS_DIR, "DMSans-Italic.woff"), fontWeight: 400, fontStyle: "italic" },
    ],
  });

  Font.register({
    family: "Big Shoulders Display",
    src: path.join(FONTS_DIR, "BigShouldersDisplay-Black.woff"),
    fontWeight: 900,
  });

  registered = true;
}

module.exports = { registerFonts };
