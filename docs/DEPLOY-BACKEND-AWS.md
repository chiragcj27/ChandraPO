# Deploy Backend to AWS EC2 (using instance IP, no domain)

This guide walks through deploying the ChandraPO backend to an EC2 instance and accessing it via the instance’s public IP.

---

## 1. Create and launch an EC2 instance

1. In **AWS Console** → **EC2** → **Launch instance**.
2. **Name:** e.g. `chandrapo-backend`.
3. **AMI:** Amazon Linux 2023 or Ubuntu 22.04 LTS.
4. **Instance type:** e.g. `t3.small` (or `t3.micro` for minimal cost).
5. **Key pair:** Create or select a key pair and download the `.pem` file. You’ll use it to SSH.
6. **Network settings:**
   - Create or use a security group.
   - **Inbound rules:** add:
     - **SSH (22)** – your IP (or `0.0.0.0/0` only if you accept the risk).
     - **Custom TCP (4000)** – source `0.0.0.0/0` so the API is reachable on the backend port (or restrict to your frontend/origin IP later).
7. **Storage:** 8–20 GB is usually enough.
8. Launch the instance and note the **public IP**.

---

## 2. Connect to the instance

```bash
# Fix key permissions (required)
chmod 400 /Users/cj/Freelance/ChandraPO/chandra-po.pem

# SSH (Amazon Linux 2023)
ssh -i /path/to/your-key.pem ec2-user@<PUBLIC_IP>

# Or Ubuntu
ssh -i /path/to/your-key.pem ubuntu@<PUBLIC_IP>
```

Replace `<PUBLIC_IP>` with your instance’s public IP.

---

## 3. Install Node.js and Git on the instance

The monorepo needs **Node.js 20+** (Next.js and some deps require it). Install Node 20 as below.

**Amazon Linux 2023:**

```bash
sudo dnf update -y
sudo dnf install -y git

# Install Node 20 via NodeSource
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

node -v   # should be v20.x
npm -v
```

**Ubuntu 22.04:**

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20 or higher
```

---

## 4. Install PM2 (process manager)

```bash
sudo npm install -g pm2
```

---

## 5. Deploy the backend (clone and build)

**Option A: Deploy from Git (recommended)**

```bash
# Clone the repo (use your actual repo URL; use token if private)
git clone https://github.com/YOUR_ORG/ChandraPO.git
cd ChandraPO
```

**Option B: Copy built app from your machine**

On your **local** machine, from the repo root:

```bash
npm install
npm run build
# Then rsync or scp the whole repo (or at least apps/backend, packages/db, node_modules, package.json, etc.)
rsync -avz --exclude node_modules --exclude .git -e "ssh -i /path/to/your-key.pem" . ec2-user@<PUBLIC_IP>:~/ChandraPO
```

Then on the **EC2** instance:

```bash
cd ~/ChandraPO
npm install
# Backend-only: build just backend and @repo/db (skips website; works with Node 18+)
npx turbo run build --filter=backend
# Or build everything (requires Node 20+):
# npm run build
```

For a **backend-only** deploy you only need the backend and its dependency `@repo/db`. Use `npx turbo run build --filter=backend` so the website (Next.js) is not built. If you already have Node 20+ installed, `npm run build` will build the whole monorepo.

---

## 6. Environment variables on EC2

Create a production env file **on the EC2 instance** (do not commit it):

```bash
cd ~/ChandraPO/apps/backend
nano .env
```

Set at least:

```env
NODE_ENV=production
PORT=4000

# MongoDB (use a cloud DB like MongoDB Atlas, or another EC2 with Mongo)
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/chandrapo?retryWrites=true&w=majority

# JWT (use a long random string in production)
JWT_SECRET=your-very-long-random-secret-key

# CORS: allow your frontend. For IP-only, use http://<EC2_IP>:3000 or the URL you use to open the site
CORS_ORIGIN=http://<FRONTEND_IP_OR_URL>:3000,http://<BACKEND_EC2_IP>:4000

# Optional: same as local if you use them
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# AWS_REGION=eu-north-1
# AWS_S3_BUCKET=...
# GMAIL_USER=...
# GMAIL_APP_PASSWORD=...
# OPENAI_API_KEY=...
# etc.
```

Replace `<FRONTEND_IP_OR_URL>` and `<BACKEND_EC2_IP>` with the actual IPs/URLs (e.g. the same EC2 IP if the frontend is also on that machine, or another server).

If your frontend is on the same EC2 on port 3000:

```env
CORS_ORIGIN=http://<EC2_PUBLIC_IP>:3000,http://<EC2_PUBLIC_IP>:4000
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## 7. Bind to all interfaces (0.0.0.0)

The app must listen on `0.0.0.0` so it’s reachable via the public IP. The repo is set up so that `app.listen(PORT)` listens on all interfaces; if you ever pass a host, use `0.0.0.0`.

---

## 8. Run with PM2

From the **repo root** on EC2:

```bash
cd ~/ChandraPO
pm2 start apps/backend/ecosystem.config.cjs
```

Or from `apps/backend`:

```bash
cd ~/ChandraPO/apps/backend
pm2 start ecosystem.config.cjs
```

Useful PM2 commands:

```bash
pm2 status
pm2 logs backend
pm2 restart backend
pm2 stop backend
```

Optional: start on boot:

```bash
pm2 startup
pm2 save
```

---

## 9. Test the API

From your **local** machine:

```bash
curl http://<EC2_PUBLIC_IP>:4000/
```

Expected: `{"status":"ok","message":"Backend up and running (express)"}`.

---

## 10. Frontend configuration

Point the frontend to the backend using the EC2 IP:

- **Build-time / env:** set the API base URL to `http://<EC2_PUBLIC_IP>:4000`.
- **Runtime:** if your frontend reads from something like `NEXT_PUBLIC_API_URL`, set it to `http://<EC2_PUBLIC_IP>:4000` when building or in env on the server.

Use `http://` (not `https://`) when you have no domain and no TLS.

---

## 11. Security group reminder

- **Port 22:** restrict to your IP if possible.
- **Port 4000:** open only if you want the API public; otherwise restrict to the IP of the server that hosts the frontend or to a VPN.

---

## 12. Optional: Run behind Nginx (same EC2, no domain)

If you want a single port (e.g. 80) or later add HTTPS with a domain:

```bash
sudo dnf install -y nginx   # Amazon Linux
# or: sudo apt install -y nginx   # Ubuntu
```

Example Nginx config (`/etc/nginx/conf.d/backend.conf`):

```nginx
server {
    listen 80;
    server_name _;   # or use the public IP as server_name
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then open port **80** in the security group and use `http://<EC2_PUBLIC_IP>/` to hit the backend.

---

## Troubleshooting

| Issue | Check |
|------|--------|
| Connection refused | Security group allows TCP 4000 (and 80 if using Nginx); app listens on `0.0.0.0`. |
| CORS errors | Set `CORS_ORIGIN` to the exact origin the browser uses (e.g. `http://<IP>:3000`). |
| 502 Bad Gateway | Backend not running: `pm2 status`, `pm2 logs backend`. |
| MongoDB connection failed | `MONGO_URI` correct; if Atlas, EC2 IP allowed in Network Access. |

---

## Summary

1. Launch EC2, open SSH (22) and API port (4000).
2. Install Node 18+, Git, PM2.
3. Clone repo (or rsync), run `npm install` and `npm run build` from repo root.
4. Create `apps/backend/.env` with `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGIN`, etc.
5. Start with: `pm2 start apps/backend/ecosystem.config.cjs`.
6. Use the API at `http://<EC2_PUBLIC_IP>:4000` and set that as the backend URL in the frontend.
