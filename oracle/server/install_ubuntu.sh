#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "شغّل السكربت بصلاحيات root: sudo bash install_ubuntu.sh"
  exit 1
fi

if ! grep -qi 'ubuntu' /etc/os-release; then
  echo "هذا السكربت مخصص لـ Ubuntu فقط."
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi

. /etc/os-release
cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

TARGET_DIR="${TARGET_DIR:-/opt/onyx-server}"
mkdir -p "${TARGET_DIR}/imports" "${TARGET_DIR}/backups"
cp docker-compose.yml .env.example README.md "${TARGET_DIR}/"
cp -r init "${TARGET_DIR}/"
cp -r ../../oracle/import "${TARGET_DIR}/../" 2>/dev/null || true

if [[ ! -f "${TARGET_DIR}/.env" ]]; then
  cp "${TARGET_DIR}/.env.example" "${TARGET_DIR}/.env"
  chmod 600 "${TARGET_DIR}/.env"
  echo "تم إنشاء ${TARGET_DIR}/.env. عدّل كلمات المرور ثم شغّل docker compose up -d."
fi

if id "${SUDO_USER:-}" >/dev/null 2>&1; then
  usermod -aG docker "${SUDO_USER}"
  echo "تمت إضافة المستخدم ${SUDO_USER} إلى مجموعة docker؛ سجّل الخروج ثم الدخول لتفعيلها."
fi

echo "اكتمل تثبيت Docker وتجهيز ${TARGET_DIR}."
echo "الخطوة التالية: cd ${TARGET_DIR} && nano .env && docker compose up -d"
