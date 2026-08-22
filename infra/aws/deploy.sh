#!/usr/bin/env bash
# Despliega AI Pulse en la EC2 de AWS. Construye el frontend localmente
# (la t3.micro no aguanta bien `vite build`) y sincroniza el código por rsync.
set -euo pipefail

IP=${AI_PULSE_IP:-54.243.108.143}
KEY=${AI_PULSE_KEY:-~/.ssh/ai-pulse-aws.pem}
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SSH="ssh -i $KEY -o StrictHostKeyChecking=no ubuntu@$IP"

echo "[1/6] build del frontend"
cd "$ROOT" && npm run build

echo "[2/6] sincronizando código"
rsync -az --delete -e "ssh -i $KEY -o StrictHostKeyChecking=no" \
  --exclude node_modules --exclude .git --exclude .azurite \
  --exclude 'local.settings.json*' --exclude .DS_Store \
  "$ROOT"/api "$ROOT"/worker "$ROOT"/server ubuntu@"$IP":/opt/ai-pulse/
rsync -az --delete -e "ssh -i $KEY -o StrictHostKeyChecking=no" \
  "$ROOT"/dist/ ubuntu@"$IP":/opt/ai-pulse/dist/
echo "[3/6] instalando dependencias en el servidor"
# Cada carpeta resuelve sus propias deps: server/ (express+dotenv), api/ y worker/.
# El package.json raíz es solo del frontend y no se sube.
$SSH 'set -e; cd /opt/ai-pulse/server && npm install --omit=dev --no-audit --no-fund \
      && cd ../api && npm install --omit=dev --no-audit --no-fund \
      && cd ../worker && npm install --omit=dev --no-audit --no-fund'

echo "[4/6] configurando nginx"
scp -i "$KEY" -o StrictHostKeyChecking=no "$ROOT"/infra/aws/nginx.conf ubuntu@"$IP":/tmp/ai-pulse.nginx
$SSH 'sudo mv /tmp/ai-pulse.nginx /etc/nginx/sites-available/ai-pulse \
      && sudo ln -sf /etc/nginx/sites-available/ai-pulse /etc/nginx/sites-enabled/ai-pulse \
      && sudo rm -f /etc/nginx/sites-enabled/default \
      && sudo nginx -t && sudo systemctl reload nginx'

echo "[5/6] arrancando el host de functions"
$SSH 'cd /opt/ai-pulse/server && pm2 delete ai-pulse-api 2>/dev/null || true; \
      pm2 start index.js --name ai-pulse-api --time && pm2 save'

echo "[6/6] verificando"
sleep 5
$SSH 'curl -s localhost:8080/_healthz' ; echo
curl -s --max-time 20 "http://$IP/api/health" | head -c 500 ; echo
echo "listo -> http://$IP"
