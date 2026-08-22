#!/bin/bash
set -eux
exec > >(tee /var/log/ai-pulse-init.log) 2>&1

# t3.micro trae ~950 MB de RAM; sin swap `npm install` y `vite build` se caen.
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10
echo 'vm.swappiness=10' >> /etc/sysctl.conf

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git nginx unzip

# Node 22 — misma major que la Function App de Azure (Node|22)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pm2

mkdir -p /opt/ai-pulse
chown -R ubuntu:ubuntu /opt/ai-pulse

systemctl enable nginx
systemctl start nginx
touch /var/log/ai-pulse-init.done
