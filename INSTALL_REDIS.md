# Installing Redis on Windows

## Method 1: Using Windows Subsystem for Linux (WSL) - Recommended

### Step 1: Install WSL
```powershell
# Run in PowerShell as Administrator
wsl --install
```

### Step 2: Install Redis in WSL
```bash
# In WSL terminal
sudo apt update
sudo apt install redis-server
```

### Step 3: Start Redis
```bash
sudo service redis-server start

# Test Redis
redis-cli ping
# Should return: PONG
```

### Step 4: Make Redis accessible from Windows
```bash
# Edit Redis config to allow external connections
sudo nano /etc/redis/redis.conf

# Find and change:
bind 127.0.0.1 ::1
# to:
bind 0.0.0.0

# Restart Redis
sudo service redis-server restart
```

---

## Method 2: Using Memurai (Native Windows Redis) - Easier

### Step 1: Download Memurai
- Go to: https://www.memurai.com/get-memurai
- Download Memurai Developer Edition (Free)

### Step 2: Install
- Run installer
- Default settings are fine
- Service starts automatically

### Step 3: Verify
```powershell
# In PowerShell
redis-cli ping
# Should return: PONG
```

---

## Method 3: Using Docker (Cross-platform)

### Step 1: Install Docker Desktop
- Download from: https://www.docker.com/products/docker-desktop

### Step 2: Run Redis Container
```powershell
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### Step 3: Verify
```powershell
docker exec -it redis redis-cli ping
# Should return: PONG
```

---

## Quick Installation (Choose ONE method above, then continue)

After Redis is running, verify from Python:

```python
# Test Redis connection
python -c "import redis; r=redis.Redis(host='localhost', port=6379); print(r.ping())"
# Should print: True
```

---

## Recommended: Method 3 (Docker)
- Easiest to manage
- Consistent across environments
- Easy to start/stop/reset

**For this tutorial, I'll assume Docker method.**

Run this NOW:
```powershell
docker run -d -p 6379:6379 --name redis redis:7-alpine
```
