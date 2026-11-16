# Ahead Academy Backend API

A standalone Node.js Express + Python core backend for Ahead Academy.

## 🚀 Getting Started

### 1. Prerequisites
- Node.js v18+
- Python 3.10+

### 2. Installation & Running
From the repository root:
```bash
cd ahead-app
npm install
npm start
```
The API is available at `http://localhost:8080`.

## 🚂 Railway Deployment

1. **New Project**: Go to [Railway](https://railway.app/) and deploy from GitHub repo `ahead-academy`.
2. **Root Directory**: Set to `ahead-app` in the service settings.
3. **Persistent Volume**: Attach a volume mounted at `/data`.
4. **Environment Variables**:
   - `PORT`: `8080`
   - `ATTENDANCE_DB_PATH`: `/data/attendance.db`
   - `JWT_SECRET`: `<your_secret>`
   - `WEBAUTHN_RP_NAME`: `Ahead Academy`
5. **Deploy**: Railway uses the `Dockerfile` in `ahead-app` to build and run automatically.
