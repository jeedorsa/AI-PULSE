#!/usr/bin/env bash
# Provisiona la infra de AI Pulse en la cuenta AWS de Vinka (715472012963).
# Idempotente: se puede volver a correr sin duplicar recursos.
set -euo pipefail

PROFILE=vinka-oneimpact
REGION=us-east-1
ACCOUNT_ESPERADA=715472012963
PROYECTO=ai-pulse
NOMBRE=ai-pulse-prod
TIPO=t3.micro

# --- Guardarraíl: abortar si el perfil no es la cuenta de Vinka -------------
CUENTA=$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)
if [ "$CUENTA" != "$ACCOUNT_ESPERADA" ]; then
  echo "ABORTA: el perfil $PROFILE apunta a la cuenta $CUENTA, se esperaba $ACCOUNT_ESPERADA" >&2
  exit 1
fi
echo "[ok] cuenta AWS verificada: $CUENTA"

TAGS="ResourceType=instance,Tags=[{Key=Name,Value=$NOMBRE},{Key=proyecto,Value=$PROYECTO}]"

# --- Key pair ---------------------------------------------------------------
KEY=~/.ssh/ai-pulse-aws.pem
if ! aws ec2 describe-key-pairs --profile "$PROFILE" --region "$REGION" --key-names ai-pulse-aws >/dev/null 2>&1; then
  aws ec2 create-key-pair --profile "$PROFILE" --region "$REGION" \
    --key-name ai-pulse-aws --key-type ed25519 \
    --query KeyMaterial --output text > "$KEY"
  chmod 600 "$KEY"
  echo "[ok] key pair creado en $KEY"
else
  echo "[skip] key pair ai-pulse-aws ya existe"
fi

# --- Security group ---------------------------------------------------------
VPC=$(aws ec2 describe-vpcs --profile "$PROFILE" --region "$REGION" \
  --filters Name=isDefault,Values=true --query "Vpcs[0].VpcId" --output text)
SG=$(aws ec2 describe-security-groups --profile "$PROFILE" --region "$REGION" \
  --filters Name=group-name,Values=ai-pulse-sg Name=vpc-id,Values="$VPC" \
  --query "SecurityGroups[0].GroupId" --output text 2>/dev/null || echo "None")
if [ "$SG" = "None" ] || [ -z "$SG" ]; then
  SG=$(aws ec2 create-security-group --profile "$PROFILE" --region "$REGION" \
    --group-name ai-pulse-sg --description "AI Pulse web + ssh" --vpc-id "$VPC" \
    --query GroupId --output text)
  # Solo SSH, y restringido: el HTTP entra por el ALB (ver README §8).
  aws ec2 authorize-security-group-ingress --profile "$PROFILE" --region "$REGION" \
    --group-id "$SG" --protocol tcp --port 22 --cidr "${AI_PULSE_SSH_CIDR:?exporta AI_PULSE_SSH_CIDR=<tu-ip>/32}" >/dev/null
  aws ec2 create-tags --profile "$PROFILE" --region "$REGION" --resources "$SG" \
    --tags Key=proyecto,Value=$PROYECTO >/dev/null
  echo "[ok] security group creado: $SG"
else
  echo "[skip] security group ya existe: $SG"
fi

# --- Subnet en una AZ que sí ofrezca t3.micro (us-east-1e no lo tiene) ------
AZ=$(aws ec2 describe-instance-type-offerings --profile "$PROFILE" --region "$REGION" \
  --location-type availability-zone \
  --filters Name=instance-type,Values=$TIPO \
  --query "InstanceTypeOfferings[0].Location" --output text)
SUBNET=$(aws ec2 describe-subnets --profile "$PROFILE" --region "$REGION" \
  --filters Name=vpc-id,Values="$VPC" Name=availability-zone,Values="$AZ" \
  --query "Subnets[0].SubnetId" --output text)
echo "[ok] AZ=$AZ subnet=$SUBNET"

# --- AMI Ubuntu 24.04 LTS (canonical, vía SSM) ------------------------------
AMI=$(aws ssm get-parameter --profile "$PROFILE" --region "$REGION" \
  --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id \
  --query "Parameter.Value" --output text)
echo "[ok] AMI=$AMI"

# --- Instancia --------------------------------------------------------------
ID=$(aws ec2 describe-instances --profile "$PROFILE" --region "$REGION" \
  --filters Name=tag:Name,Values=$NOMBRE Name=instance-state-name,Values=pending,running,stopped \
  --query "Reservations[0].Instances[0].InstanceId" --output text 2>/dev/null || echo "None")

if [ "$ID" = "None" ] || [ -z "$ID" ]; then
  ID=$(aws ec2 run-instances --profile "$PROFILE" --region "$REGION" \
    --image-id "$AMI" --instance-type "$TIPO" --key-name ai-pulse-aws \
    --security-group-ids "$SG" --subnet-id "$SUBNET" \
    --metadata-options "HttpTokens=required,HttpEndpoint=enabled" \
    --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=30,VolumeType=gp3,DeleteOnTermination=true}' \
    --tag-specifications "$TAGS" \
    --user-data file://"$(dirname "$0")"/user-data.sh \
    --query "Instances[0].InstanceId" --output text)
  echo "[ok] instancia lanzada: $ID"
else
  echo "[skip] instancia ya existe: $ID"
fi

aws ec2 wait instance-running --profile "$PROFILE" --region "$REGION" --instance-ids "$ID"

# --- Elastic IP -------------------------------------------------------------
EIP=$(aws ec2 describe-addresses --profile "$PROFILE" --region "$REGION" \
  --filters Name=tag:proyecto,Values=$PROYECTO --query "Addresses[0].PublicIp" --output text 2>/dev/null || echo "None")
if [ "$EIP" = "None" ] || [ -z "$EIP" ]; then
  ALLOC=$(aws ec2 allocate-address --profile "$PROFILE" --region "$REGION" --domain vpc \
    --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=proyecto,Value=$PROYECTO}]" \
    --query AllocationId --output text)
  aws ec2 associate-address --profile "$PROFILE" --region "$REGION" \
    --instance-id "$ID" --allocation-id "$ALLOC" >/dev/null
  EIP=$(aws ec2 describe-addresses --profile "$PROFILE" --region "$REGION" \
    --allocation-ids "$ALLOC" --query "Addresses[0].PublicIp" --output text)
  echo "[ok] Elastic IP asociada: $EIP"
else
  echo "[skip] Elastic IP ya existe: $EIP"
fi

echo
echo "=========================================="
echo "  instancia : $ID"
echo "  IP        : $EIP"
echo "  ssh       : ssh -i $KEY ubuntu@$EIP"
echo "=========================================="
