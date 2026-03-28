# SVR PWA - Local Testing Procedure

## Quick Start: Test Locally Before Deploying

Use this procedure to test changes on your **Windows PC** and **Android Smartphone** before pushing to GitHub.

---

## 1. Desktop Testing (Windows PC)

### Start Local HTTP Server

Open **PowerShell** or **Command Prompt** in the project root:

```powershell
cd C:\Users\emanu\AndroidStudioProjects\SVRpwa
python -m http.server 8000
```

**Expected output:**
```
Serving HTTP on :: port 8000 (http://[::]:8000/) ...
```

### Open in Browser

Navigate to: **`http://localhost:8000/`**

**Recommended:** Use **Chrome** or **Edge** for DevTools access.

### Useful DevTools Checks

| Tool | Open With | Purpose |
|------|-----------|---------|
| **Console** | `F12` → Console tab | View debug logs (`[v0.2.37]` prefixed) |
| **Application** | `F12` → Application tab | Inspect Service Worker, Cache, Manifest |
| **Network** | `F12` → Network tab | Monitor requests, offline behavior |
| **Device Toolbar** | `Ctrl+Shift+M` | Simulate mobile/tablet viewports |

### Stop Server

Press `Ctrl+C` in the terminal when done.

---

## 2. Mobile Testing (Android Smartphone)

### Prerequisites

- PC and Android phone on the **same Wi-Fi network**
- Python installed on PC
- Chrome browser on Android phone

### Step 1: Find Your PC's Local IP Address

**PowerShell:**
```powershell
ipconfig
```

**Command Prompt:**
```cmd
ipconfig
```

Look for **IPv4 Address** under your active network adapter (e.g., `192.168.1.100`).

### Step 2: Allow Firewall Access (if needed)

When starting the server, Windows may block the connection. Click **"Allow access"** in the firewall dialog.

### Step 3: Start HTTP Server (Same as Desktop)

```powershell
cd C:\Users\emanu\AndroidStudioProjects\SVRpwa
python -m http.server 8000
```

### Step 4: Open on Android Phone

On your Android phone, open Chrome and navigate to:

```
http://<YOUR-PC-IP>:8000/
```

**Example:** `http://192.168.1.100:8000/`

### Optional: Port Forwarding via USB (More Reliable)

If Wi-Fi testing is unstable, use **USB debugging**:

1. **Enable USB Debugging** on Android:
   - Settings → About Phone → Tap "Build Number" 7 times
   - Settings → Developer Options → Enable "USB Debugging"

2. **Connect phone via USB** to PC

3. **Open Chrome on PC** and navigate to: `chrome://inspect/#devices`

4. **Enable Port Forwarding:**
   - Click "Port forwarding..."
   - Add rule: `8000` → `localhost:8000`
   - Check "Enable port forwarding"

5. **On phone**, open Chrome and visit: `http://localhost:8000/`

---

## 3. Testing Checklist

### Mobile (<768px)
- [ ] Map renders with camping markers
- [ ] Clustering works at zoomed-out levels
- [ ] Search suggests Dutch municipalities
- [ ] Filters apply correctly (fullscreen overlay)
- [ ] Toggle between map/list view works
- [ ] Detail view opens as fullscreen overlay
- [ ] Offline mode shows cached content
- [ ] Install banner appears (first visit)

### Desktop (≥768px)
- [ ] Split-screen layout: 60% map left, 40% list right
- [ ] Toggle cycles: split → map-only → list-only → split
- [ ] INFO knop in lijst opent detail panel rechts
- [ ] INFO knop in map popup opent detail panel links
- [ ] Filter panel opent links (lijst zijde)
- [ ] Leaflet map resizes on window resize
- [ ] Detail panel sluit met terug knop

---

## 4. Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| **Phone can't connect** | Check firewall, ensure same Wi-Fi network |
| **Service Worker not loading** | Use `http://` not `file://` protocol |
| **Cache not updating** | Unregister SW in DevTools → Application tab |
| **Port 8000 already in use** | Use different port: `python -m http.server 8080` |
| **CORS errors** | Not expected for static files; check server logs |

---

## 5. Quick Reference Commands

```powershell
# Start server (PowerShell/CMD)
python -m http.server 8000

# Start server on different port
python -m http.server 8080

# Find local IP (PowerShell)
ipconfig | Select-String "IPv4"

# Find local IP (CMD)
ipconfig | findstr "IPv4"
```

---

**Last Updated:** 2026-03-28  
**Version:** v0.2.37
