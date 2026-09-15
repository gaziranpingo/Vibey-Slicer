import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as THREE from 'three';
import fs from 'fs';
import os from 'os';
import { sliceModel } from "./src/utils/slicerEngine.js";

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '500mb' }));

  // API routes FIRST
  const getDB = () => {
    try {
      const dataDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      if (!fs.existsSync(DB_PATH)) {
        const initial = { users: {}, settings: {} };
        fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
        return initial;
      }
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const data = JSON.parse(raw);
      if (!data.users) data.users = {};
      if (!data.settings) data.settings = {};
      return data;
    } catch (e) {
      console.error("DB Read Error:", e);
      return { users: {}, settings: {} };
    }
  };

  const saveDB = (data: any) => {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  };

  app.post("/api/report-error", (req, res) => {
    const { error, fileName, stack } = req.body;
    console.error(`[CLIENT-ERROR] File: ${fileName || 'unknown'}`);
    console.error(`Message: ${error}`);
    if (stack) console.error(`Stack: ${stack}`);
    res.json({ status: "ok" });
  });

  app.get("/api/data", (req, res) => {
    res.json(getDB());
  });

  app.post("/api/data", (req, res) => {
    try {
      const data = getDB();
      Object.assign(data.settings, req.body);
      saveDB(data);
      res.json({ status: "ok" });
    } catch (error) {
      res.status(500).json({ error: "Failed to save global settings" });
    }
  });

  app.post("/api/register", (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: "Missing fields" });
      
      const data = getDB();
      if (data.users[username]) return res.status(400).json({ error: "User already exists" });
      
      data.users[username] = { password, settings: {}, projects: {} };
      saveDB(data);
      console.log(`User registered: ${username}`);
      res.json({ status: "ok" });
    } catch (error) {
      console.error("Register Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/login", (req, res) => {
    try {
      const { username, password } = req.body;
      const data = getDB();
      const user = data.users[username];
      
      if (!user || user.password !== password) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      
      console.log(`User logged in: ${username}`);
      res.json({ status: "ok", user: { username, settings: user.settings } });
    } catch (error) {
      console.error("Login Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/projects/save", (req, res) => {
    try {
      const { username, projectName, projectData } = req.body;
      const data = getDB();
      if (!data.users[username]) return res.status(404).json({ error: "User not found" });
      
      if (!data.users[username].projects) data.users[username].projects = {};
      data.users[username].projects[projectName] = projectData;
      
      saveDB(data);
      res.json({ status: "ok" });
    } catch (error) {
      res.status(500).json({ error: "Failed to save project" });
    }
  });

  app.get("/api/projects/:username", (req, res) => {
    try {
      const { username } = req.params;
      const data = getDB();
      const user = data.users[username];
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user.projects || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to load projects" });
    }
  });

  app.post("/api/projects/delete", (req, res) => {
    try {
      const { username, projectName } = req.body;
      const data = getDB();
      if (!data.users[username]) return res.status(404).json({ error: "User not found" });
      if (data.users[username].projects && data.users[username].projects[projectName]) {
        delete data.users[username].projects[projectName];
        saveDB(data);
        res.json({ status: "ok" });
      } else {
        res.status(404).json({ error: "Project not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  app.post("/api/repair", async (req, res) => {
    try {
      const { geometry } = req.body;
      console.log("Repair request received (server-side)");
      // Mocking repair for now
      // Real repair would involve mesh processing libraries (like manifold-3d if it was available)
      res.json({ status: "ok", message: "Model repaired successfully (mocked)" });
    } catch (error) {
      res.status(500).json({ error: "Repair failed" });
    }
  });

  app.post("/api/slice", async (req, res) => {
    try {
      const { geometry, matrix, settings } = req.body;
      
      // Reconstruct geometry
      const loader = new THREE.BufferGeometryLoader();
      const bufferGeometry = loader.parse(geometry);
      
      // Reconstruct matrix
      const matrix4 = new THREE.Matrix4().fromArray(matrix);
      
      console.log("Slicing request received (server-side)");
      
      // Slicing might be slow, but this is a synchronous call in slicerEngine
      const result = sliceModel(bufferGeometry, matrix4, settings, () => {});
      
      res.json({ sliceResult: result });
    } catch (error) {
      console.error("Slicing error:", error);
      res.status(500).json({ error: "Slicing failed" });
    }
  });

  app.post("/api/transform", async (req, res) => {
    try {
      const { transform } = req.body;
      console.log("Transform update received (server-side):", transform);
      res.json({ status: "ok" });
    } catch (error) {
      console.error("Transform error:", error);
      res.status(500).json({ error: "Transform failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log("[INFO] Keeping terminal open. All background logs and activity will appear below:");
    console.log("=============================================");
    console.log(`[INFO] Open your browser at:`);
    console.log(` - Local: http://localhost:${PORT}`);

    // Local IPs
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]!) {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(` - LAN:   http://${iface.address}:${PORT}`);
        }
      }
    }

    // Public IP
    try {
      const response = await fetch('https://api.ipify.org');
      const publicIp = await response.text();
      console.log(` - WAN:   http://${publicIp}:${PORT}`);
    } catch (e) {
      // Ignore if public IP lookup fails
    }
  });
}

startServer();
