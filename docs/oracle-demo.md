# Oracle Cloud demo deploy

Free-tier VM that hosts the full stack. Share **`http://<public-ip>:3000`** — no clone required for viewers.

## 1. Create the VM

1. [cloud.oracle.com](https://cloud.oracle.com) → **Compute** → **Instances** → **Create instance**
2. **Name:** `ptw-demo`
3. **Image:** Ubuntu 22.04 or 24.04
4. **Shape:** **Ampere** `VM.Standard.A1.Flex` — **2 OCPU, 12 GB RAM** (Always Free)
5. **Networking:** assign a **public IPv4**
6. **SSH keys:** paste your public key

## 2. Open firewall (required)

**Networking** → **Virtual cloud networks** → your VCN → **Security lists** → **Default security list**

Add **Ingress rules** (source `0.0.0.0/0`):

| Protocol | Port | Description |
|----------|------|-------------|
| TCP | 22 | SSH |
| TCP | 3000 | Web app |
| TCP | 4000 | API |
| TCP | 8080 | Keycloak login |

Save. If the instance uses a **Network Security Group**, add the same rules there.

## 3. Deploy

SSH into the VM:

```bash
ssh ubuntu@<PUBLIC_IP>
```

### Option A — from GitHub `main` (after scripts are pushed)

```bash
curl -fsSL https://raw.githubusercontent.com/ramgandhe/great-ptw-loto-ai-app/main/scripts/oracle-demo-bootstrap.sh | sudo bash
```

### Option B — feature branch (before merge to main)

```bash
curl -fsSL https://raw.githubusercontent.com/ramgandhe/great-ptw-loto-ai-app/mundadariddhii/ms-09-remediation/scripts/oracle-demo-bootstrap.sh | sudo BRANCH=mundadariddhii/ms-09-remediation bash
```

### Option C — clone manually

```bash
git clone -b mundadariddhii/ms-09-remediation https://github.com/ramgandhe/great-ptw-loto-ai-app.git
cd great-ptw-loto-ai-app
sudo ./scripts/oracle-demo-bootstrap.sh
```

Deploy takes **10–20 minutes** (Docker pulls + Keycloak first start).

## 4. Share the link

```
http://<PUBLIC_IP>:3000
```

**Login:** `admin@ptw.local` / `admin`

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Page won’t load | Confirm security list ports 3000, 4000, 8080 |
| Login fails | Re-run `sudo ./scripts/demo-keycloak-redirect.sh http://<IP>:3000` from `/opt/ptw-demo` |
| API unhealthy | `cd /opt/ptw-demo && docker compose logs api` |
| Out of memory | Use 12 GB ARM shape or let script add swap |

## Costs

**$0** on Oracle Always Free (Ampere A1 within free limits). Do not create paid shapes or extra block storage beyond free allowance.
