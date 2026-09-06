# 🚀 Quick Start Scripts

Scripts untuk memudahkan development dan deployment.

## 📋 Available Scripts

### 1. **rebuild.sh** - Auto Rebuild &amp; Start
Rebuild semua Docker images dan start containers.

```bash
./rebuild.sh              # Normal rebuild
./rebuild.sh --clean      # Clean rebuild (hapus images &amp; volumes)
./rebuild.sh --dev        # Auto start dev services (macOS only)
```

**Fitur:**
- ✅ Stop containers lama
- ✅ Build ulang Docker images
- ✅ Start semua containers
- ✅ Health check otomatis
- ✅ Optional: Auto-start dev services di terminal tabs baru

**Kapan digunakan:**
- Setelah edit Dockerfile
- Setelah edit kode backend/frontend (untuk production build)
- Setelah pull code baru dari Git

---

### 2. **shutdown.sh** - Stop Services
Stop semua Docker containers dengan aman.

```bash
./shutdown.sh             # Stop containers
./shutdown.sh --clean     # Stop + hapus volumes &amp; images
```

**Kapan digunakan:**
- Sebelum rebuild
- Sebelum shutdown komputer
- Untuk free up resources

---

### 3. **status.sh** - Check Status
Cek status semua services.

```bash
./status.sh
```

**Menampilkan:**
- Docker container status
- Port availability check
- Service URLs
- Quick links untuk logs

---

## 🛠️ Development Workflow

### **Skenario 1: Normal Development (tanpa Docker)**
```bash
# Terminal 1
cd apps/operator-web
npm run dev

# Terminal 2
cd services/api-gateway
npm run dev

# Terminal 3
cd services/rules-engine
npm run dev
```

### **Skenario 2: Development + Docker (Recommended)**
```bash
# 1. Start Docker services (DB, Redis, dll)
./rebuild.sh

# 2. Run dev services manual OR auto
./rebuild.sh --dev  # Auto open terminal tabs (macOS)
```

### **Skenario 3: Production Build Test**
```bash
# Full rebuild dan test production build
./rebuild.sh --clean

# Check hasilnya
./status.sh
```

---

## 📁 Project Structure

```
monitoring-angkot/
├── rebuild.sh          # 🔄 Auto rebuild script
├── shutdown.sh         # 🛑 Stop services script
├── status.sh           # 📊 Status check script
├── apps/
│   └── operator-web/   # Next.js frontend
├── services/
│   ├── api-gateway/    # REST API
│   ├── rules-engine/   # Business rules
│   └── notification-service/
├── db/                 # Database migrations
└── infra/
    └── docker-compose/ # Docker configs
```

---

## 🔍 Troubleshooting

### **Port already in use**
```bash
# Cek port yang dipakai
lsof -i :3000
lsof -i :4000
lsof -i :5433

# Kill process
kill -9 [PID]
```

### **Docker rebuild stuck**
```bash
# Clean everything
./shutdown.sh --clean

# Atau manual
docker system prune -a --volumes
```

### **Database migration needed**
```bash
# Apply migrations
docker exec -i monitoring-angkot-postgres-1 psql -U monitoring -d Sentra &lt; db/migrations/xxx.sql
```

---

## 📚 More Info

- [Docker Compose README](./infra/docker-compose/README.md)
- [API Documentation](./docs/)
- [Database Schema](./db/)
