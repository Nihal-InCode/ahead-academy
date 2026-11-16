# Ahead Academy Web App

The Next.js 16 frontend for Ahead Academy.

## Features
- 🔐 Secure Login (Admin, Faculty, Guest Portal)
- 📊 Teacher Attendance Management
- 📝 Student List (Class & Subject-specific Roster)
- 📱 PWA Ready (Mobile-first Ahead Academy theme)
- ⚡ Fast Performance (Next.js 16 App Router)

## Getting Started

### 1. Prerequisites
- Node.js v18+

### 2. Setup Environment
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Update `NEXT_PUBLIC_API_URL` with your Railway backend URL:
```env
NEXT_PUBLIC_API_URL=https://your-railway-backend.up.railway.app
```

### 3. Run Development Server
```bash
npm install
npm run dev
```

## Deployment to Vercel

1. **Connect to Vercel**: 
   - Go to [Vercel](https://vercel.com) and import `ahead-academy`.
2. **Configure Settings**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `ahead-app/frontend`
   - **Environment Variables**: Add `NEXT_PUBLIC_API_URL` (your Railway backend URL).
3. **Deploy**: Click "Deploy".
