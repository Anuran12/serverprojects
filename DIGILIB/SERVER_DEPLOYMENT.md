# DIGILIB Linux Server Deployment (docker-compose.yml only)

This guide deploys DIGILIB on one Linux server with host Nginx and Docker Compose.

## 1) Server prerequisites

```bash
sudo apt update
sudo apt install -y git nginx ufw ca-certificates curl
```

Install Docker Engine + Compose plugin:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"
newgrp docker
```

## 2) Clone project

```bash
sudo mkdir -p /opt
cd /opt
sudo git clone <YOUR_GITHUB_REPO_URL> serverprojects
sudo chown -R "$USER":"$USER" /opt/serverprojects
cd /opt/serverprojects/DIGILIB
```

## 3) Configure DIGILIB secrets/environment

Create/update `.env`:

```bash
cp .env.example .env
nano .env
```

Set at least:
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `PGBOUNCER_PASSWORD`

Keep these Linux/container paths:
- `AUDIT_ROOT=/data/audit_reports`
- `EMBEDDING_MODEL_PATH=/models/bge-base-en-v1.5`
- `RERANKER_MODEL_PATH=/models/ms-marco-MiniLM-L-6-v2`

## 4) Ensure PgBouncer user hash matches DB password

Generate md5 for PgBouncer (`md5` + md5(password + username)):

```bash
export PGUSER_NAME="audit"
export PGPASS="<same_as_POSTGRES_PASSWORD>"
printf "%s" "${PGPASS}${PGUSER_NAME}" | md5sum
```

Take the 32-char hash output and write:

```txt
"audit" "md5<hash>"
```

into:

`db/pgbouncer/userlist.txt`

## 5) Required data folders check

Verify these exist in project root:
- `Audit Report/` (PDFs)
- `models/bge-base-en-v1.5/`
- `models/ms-marco-MiniLM-L-6-v2/`

## 6) Start containers (using docker-compose.yml)

```bash
cd /opt/serverprojects/DIGILIB
docker compose up -d --build
docker compose ps
```

Check logs if needed:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f worker
```

## 7) Configure host Nginx for /projects/digilib

Use provided file:

`deploy/nginx/digilib.conf`

Install it:

```bash
sudo cp /opt/serverprojects/DIGILIB/deploy/nginx/digilib.conf /etc/nginx/sites-available/digilib
sudo ln -sf /etc/nginx/sites-available/digilib /etc/nginx/sites-enabled/digilib
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 8) Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

## 9) Open application

Frontend URL:

`http://<SERVER_IP>/projects/digilib/`

Login defaults:
- Admin: `admin@gmail.com` / `Admin@123`
- User: `user@gmail.com` / `User@123`

Change these users/passwords after first login.

## 10) Update deployment later

```bash
cd /opt/serverprojects
git pull
cd /opt/serverprojects/DIGILIB
docker compose up -d --build
```

## Quick health checks

From server shell:

```bash
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/api/health/startup
curl -I http://<SERVER_IP>/projects/digilib/
```
