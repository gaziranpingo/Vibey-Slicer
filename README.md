# Vibey Slicer 🖨️✨

Vibey Slicer is a high-performance, full-stack web-based 3D printing slicer. It combines a powerful client-side geometry engine with server-side persistence, allowing users to manage complex printing projects securely in the cloud.

---

## 🌟 Key Features

- **Multi-Format Support**: Interactive loading and processing of STL, OBJ, and 3MF files.
- **Server-Side Project Library**: Save your complete workspace—including 3D models, transformations, and slicing settings—directly to your private account.
- **User Authentication**: Secure local user accounts with persistent sessions and private project storage.
- **Intelligent Geometry Analysis**:
  - **Auto-Repair**: Server-side mesh repair for non-manifold models.
  - **AI Auto-Orient**: Automated orientation optimization to minimize support structures.
  - **Lay-Flat**: Optical analysis to align the largest flat surface to the build plate.
- **Advanced Slicing Engine**: High-speed slicing with customizable layer heights, infill patterns, and support generation.
- **Interactive Preview**: Layer-by-layer toolpath inspection with a built-in G-code terminal and toolpath player.
- **Comprehensive Profiles**: Pre-configured profiles for Creality, Prusa, Bambu Lab, and Voron printers.

---

## 🚀 Initial Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) (installed with Node.js)

### 1. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 2. Running in Development
Start the full-stack development environment (Vite + Express):
```bash
npm run dev
```
The application will be available at **`http://localhost:3000`**.
*Note: The server uses `tsx watch` and ignores the `data/` directory to prevent unnecessary reloads during project saving.*

### 3. Production Build & Deployment
To create a production-ready bundle and start the server:
```bash
# Build both frontend and backend
npm run build

# Start the production server
npm start
```
The production server serves the static assets and the API from a single bundled CommonJS file in `dist/server.cjs`.

---

## 🗄️ Persistence & Data
Vibey Slicer uses a file-based JSON database located in the `data/` directory.
- **`data/db.json`**: Stores user credentials, global settings, and serialized 3D project data.
- **Project Isolation**: All projects are stored under user-specific namespaces to ensure privacy.

---

## 🖨️ Supported Printer Profiles

Built-in pre-configured profiles categorized by manufacturer:

### 1. Creality
- Ender 3 / Pro / V2 / V3 Series
- K1 / K1C / K1 Max (High-Speed)
- CR-10 Series
- HALOT-MAGE PRO (Resin)

### 2. Prusa Research
- Original Prusa i3 MK3S+ / MK4 / MK4S
- Original Prusa MINI+
- Original Prusa XL (Multi-Tool)
- Original Prusa SL1S SPEED (Resin)

### 3. Bambu Lab
- X1-Carbon / X1E
- P1P / P1S Series
- A1 / A1 mini

### 4. Voron Design
- Voron V0.2 / 2.4 R2 / Trident

---

## 🐳 Self-Hosting with Docker
1. Build and run using Docker Compose:
   ```bash
   docker compose up --build -d
   ```
2. Access the app at **`http://localhost:3000`**.
