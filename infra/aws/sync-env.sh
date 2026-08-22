#!/usr/bin/env bash
# Copia las app settings de la Static Web App de Azure al /etc/ai-pulse/env de la EC2.
#
# Los secretos NUNCA se imprimen ni tocan el disco local: se leen de Azure y se
# escriben por SSH directo al servidor, en un archivo root:root 600.
#
# Sustituciones deliberadas para el ambiente AWS:
#   AZURE_STORAGE_CONNECTION_STRING -> storage aislado (no producción)
#   APP_BASE_URL                    -> la IP pública de la EC2
#   WORKER_BASE_URL                 -> el propio host (el worker corre en el mismo proceso)
#   EMAIL_SENDER_ADDRESS            -> vacío, para que el ambiente no envíe correos reales
#                                      (AI_PULSE_ENVIAR_EMAILS=1 para habilitarlos)
#   AIQ_LLM_PROVIDER                -> bedrock (Claude Haiku). AI_PULSE_LLM=azure vuelve a gpt-5-mini.
#
# Las credenciales de Bedrock NO van en el archivo: la EC2 tiene el instance
# profile `ai-pulse-ec2`, y el SDK de AWS toma el rol automáticamente.
set -euo pipefail

export SUB=6e19750c-5558-47d1-8189-5d6ca2eec58f
export RG=ai-pulse-javier_group
export SWA=ai-pulse-app
export STORAGE_AWS=${AI_PULSE_STORAGE:-aipulsedataws}
export IP=${AI_PULSE_IP:-54.243.108.143}
KEY=${AI_PULSE_KEY:-$HOME/.ssh/ai-pulse-aws.pem}
export ENVIAR_EMAILS=${AI_PULSE_ENVIAR_EMAILS:-0}
export LLM=${AI_PULSE_LLM:-bedrock}
export MODELO_BEDROCK=${AI_PULSE_BEDROCK_MODEL:-us.anthropic.claude-haiku-4-5-20251001-v1:0}
# Misma región que la EC2. El acceso a los modelos de Anthropic se habilitó el
# 22-ago-2026 enviando el formulario de caso de uso desde el playground de Bedrock
# (la antigua página "Model access" fue retirada por AWS).
export REGION_BEDROCK=${AI_PULSE_BEDROCK_REGION:-us-east-1}

echo "[1/3] leyendo app settings de la SWA"
export SETTINGS=$(az staticwebapp appsettings list --subscription "$SUB" -n "$SWA" -g "$RG" --query properties -o json)

echo "[2/3] leyendo connection string del storage aislado"
export CONN=$(az storage account show-connection-string --subscription "$SUB" -n "$STORAGE_AWS" -g "$RG" --query connectionString -o tsv)

echo "[3/3] escribiendo /etc/ai-pulse/env en la EC2"
python3 -c '
import json, os
s = json.loads(os.environ["SETTINGS"])
s["AZURE_STORAGE_CONNECTION_STRING"] = os.environ["CONN"]
s["APP_BASE_URL"]    = "http://" + os.environ["IP"]
s["WORKER_BASE_URL"] = "http://127.0.0.1:8080/api"
if os.environ.get("ENVIAR_EMAILS") != "1":
    s["EMAIL_SENDER_ADDRESS"] = ""
s["PORT"] = "8080"
s["AI_PULSE_ENTORNO"] = "aws-staging"
s["AIQ_LLM_PROVIDER"] = os.environ["LLM"]
s["BEDROCK_MODEL_ID"] = os.environ["MODELO_BEDROCK"]
s["BEDROCK_REGION"] = os.environ["REGION_BEDROCK"]
s["BEDROCK_TEMPERATURE"] = "0"
for k in sorted(s):
    print(f"{k}=" + str(s[k]).replace("\n", " "))
' | ssh -i "$KEY" -o StrictHostKeyChecking=no ubuntu@"$IP" \
    'sudo mkdir -p /etc/ai-pulse && sudo tee /etc/ai-pulse/env >/dev/null \
     && sudo chmod 644 /etc/ai-pulse/env && sudo chown root:root /etc/ai-pulse/env \
     && echo "[ok] $(sudo grep -c = /etc/ai-pulse/env) variables escritas en /etc/ai-pulse/env"'
