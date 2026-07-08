#!/usr/bin/env node

/**
 * Levanta el Function App de worker/ en local sin necesitar un
 * local.settings.json propio: carga las variables desde el único archivo
 * real, api/local.settings.json, las inyecta al entorno del proceso hijo y
 * arranca `func start --port 7072`.
 */

const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const settingsPath = path.join(__dirname, "..", "..", "api", "local.settings.json");

if (!fs.existsSync(settingsPath)) {
  console.error(`No se encontró ${settingsPath}. Copiá api/local.settings.json.example o creá el archivo antes de correr el worker en local.`);
  process.exit(1);
}

const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
const env = { ...process.env, ...settings.Values };

const result = spawnSync("func", ["start", "--port", "7072"], {
  stdio: "inherit",
  env,
  cwd: path.join(__dirname, ".."),
});

process.exit(result.status ?? 1);
