# Ahead Academy — Attendance & Academic Management System

> "Join Ahead and Stay Ahead"

A modern, full-stack attendance and academic management platform built for **Ahead Academy**.

---

## 🌟 Key Features

- **Class & Subject-Specific Attendance**: Select Class &rarr; Select Subject &rarr; Mark attendance strictly for students enrolled in that specific class and subject.
- **Admin Settings Console (`/settings`)**:
  - Teacher Management: Add, edit, delete teachers, and view generated login credentials with password reveal.
  - Password Management: Change administrator password.
  - Guest Portal Control: Enable/disable the Student Guest Portal on demand.
- **Student Guest Portal**:
  - Dedicated read-only access for parents and students (`guest` account).
  - Securely sandboxed to `/reports` with access to Class Batch Registers, Daily Reports, and Student Attendance History.
- **Automated Roster & Roll Numbering**:
  - Class rosters for Class 9, Class 10, Class 11, and Class 12.
  - Automated next-sequential roll number suggestion on student enrollment.
- **PWA & Mobile-First**:
  - Installable progressive web app with responsive design and Ahead Academy branding.

---

## 🏗️ Architecture & Tech Stack

- **Frontend**: Next.js 16 (App Router, Tailwind CSS, Radix UI)
- **Backend API**: Node.js Express server (`server.js`)
- **Core Automation Engine**: Python (`attendance.py`)
- **Database**: SQLite (`attendance.db`)

---

## 🚀 Quick Start (Development)

### 1. Prerequisites
- **Node.js** v18+
- **Python** v3.10+

### 2. Backend Setup
```bash
cd ahead-app
npm install
npm start
```
The backend server runs on `http://localhost:8080`.

### 3. Frontend Setup
```bash
cd ahead-app/frontend
npm install
npm run dev
```
The frontend web application runs on `http://localhost:3000`.

---

## 🔐 Default Accounts

| Role | Username | Default Password | Scope |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `859295` | Full administrative control & `/settings` |
| **Guest** | `guest` | `560008` | Read-only `/reports` portal |

*Additional teachers can be created and managed via the Admin Settings Console.*

---

## ☁️ Deployment Configuration

### Railway (Backend)
- **Root Directory**: `ahead-app`
- **Persistent Volume Mount**: `/data`
- **Environment Variables**:
  - `PORT`: `8080`
  - `ATTENDANCE_DB_PATH`: `/data/attendance.db`
  - `JWT_SECRET`: `<your_secret>`
  - `WEBAUTHN_RP_NAME`: `Ahead Academy`

### Vercel (Frontend)
- **Root Directory**: `ahead-app/frontend`
- **Framework Preset**: `Next.js`
- **Environment Variables**:
  - `NEXT_PUBLIC_API_URL`: `https://<your-railway-url>.up.railway.app`

---

## 📦 Production Build

```bash
cd ahead-app/frontend
npm run build
npm start
```
