const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class FaceServiceManager {
    constructor() {
        this.pythonScript = path.join(__dirname, '..', 'face_service.py');
        this.port = 5001;
        this.baseUrl = `http://127.0.0.1:${this.port}`;
        this.childProcess = null;
        this.isStarting = false;
        this.lastStartAttempt = 0;
        this.heartbeatTimer = null;
    }

    /**
     * Fast health check
     */
    async isHealthy() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        try {
            const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                return res.status === 200 || data.status === 'healthy' || data.status === 'ok';
            }
            return false;
        } catch (e) {
            clearTimeout(timeoutId);
            return false;
        }
    }

    /**
     * Kill any orphan process on port 5001
     */
    killPortConflict() {
        try {
            if (process.platform === 'win32') {
                execSync(`powershell "Get-NetTCPConnection -LocalPort ${this.port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`, { stdio: 'ignore' });
            } else {
                execSync(`fuser -k ${this.port}/tcp || true`, { stdio: 'ignore' });
            }
        } catch (e) {
            // Ignore error
        }
    }

    /**
     * Ensure the face service is running and healthy
     */
    async ensureRunning() {
        const healthy = await this.isHealthy();
        if (healthy) {
            return true;
        }

        const now = Date.now();
        if (this.isStarting && (now - this.lastStartAttempt) < 8000) {
            // Wait for existing boot attempt
            return await this.waitForHealth(6000);
        }

        this.isStarting = true;
        this.lastStartAttempt = now;

        console.log(`[Face Service Manager] Port ${this.port} offline. Starting daemon: ${this.pythonScript}`);

        // Clean up port conflicts
        this.killPortConflict();

        // Ensure log directory exists
        const logDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        const logStream = fs.openSync(path.join(logDir, 'face_service.log'), 'a');

        try {
            this.childProcess = spawn('python', [this.pythonScript], {
                detached: true,
                stdio: ['ignore', logStream, logStream],
                cwd: path.dirname(this.pythonScript)
            });

            this.childProcess.on('error', (err) => {
                console.error('[Face Service Manager Spawn Error]:', err.message);
                this.isStarting = false;
            });

            this.childProcess.on('exit', (code, signal) => {
                console.warn(`[Face Service Manager] Daemon exited with code ${code}, signal: ${signal}`);
                this.isStarting = false;
                this.childProcess = null;
            });

            this.childProcess.unref();

            const isReady = await this.waitForHealth(8000);
            this.isStarting = false;
            if (isReady) {
                console.log(`[Face Service Manager] Daemon started successfully on port ${this.port}`);
                return true;
            } else {
                console.error(`[Face Service Manager] Daemon failed to become healthy within timeout.`);
                return false;
            }
        } catch (spawnErr) {
            console.error('[Face Service Manager Error]:', spawnErr.message);
            this.isStarting = false;
            return false;
        }
    }

    /**
     * Poll /health until ready or timeout
     */
    async waitForHealth(timeoutMs = 8000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            if (await this.isHealthy()) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return false;
    }

    /**
     * Synchronize all registered employee profile photos into Python microservice in-memory cache
     */
    async syncEmployeeFaceCache() {
        try {
            const Employee = require('../models/Employee');
            const employees = await Employee.find({
                profilePhoto: { $exists: true, $ne: null, $ne: '' }
            }).select('employeeId firstName lastName profilePhoto');

            if (!employees || employees.length === 0) {
                console.log('[Face Service Manager] No employees with profile photos to sync.');
                return { success: true, count: 0 };
            }

            const payload = {
                employees: employees.map(e => ({
                    employeeId: e.employeeId,
                    firstName: e.firstName,
                    lastName: e.lastName,
                    profilePhoto: e.profilePhoto
                }))
            };

            const res = await fetch(`${this.baseUrl}/sync-cache`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                console.log(`[Face Service Manager] Synchronized employee face cache: ${data.cached_total || 0} employees loaded in memory.`);
                return data;
            } else {
                console.warn(`[Face Service Manager] Face cache sync failed with status ${res.status}`);
            }
        } catch (err) {
            console.warn('[Face Service Manager Face Sync Warning]:', err.message);
        }
    }

    /**
     * Restore all active IP camera recognition streams
     */
    async syncActiveIpCameras() {
        try {
            const Device = require('../models/Device');
            const activeCameras = await Device.find({
                deviceType: 'IPCamera',
                isStreamingActive: true,
                isActive: true
            });

            for (const dev of activeCameras) {
                if (dev.streamUrl) {
                    try {
                        await fetch(`${this.baseUrl}/ip-camera/start-stream`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                deviceId: dev._id,
                                streamUrl: dev.streamUrl,
                                locationId: dev.location,
                                zoneGroup: dev.zoneGroup || 'Main Area',
                                direction: dev.direction || 'auto',
                                cooldownMinutes: dev.cooldownMinutes || 5,
                                nodeWebhookUrl: 'http://127.0.0.1:5000/api/devices/ip-camera-punch',
                                unregisteredWebhookUrl: 'http://127.0.0.1:5000/api/devices/unregistered-face-log'
                            })
                        });
                        console.log(`[Face Service Manager] Restored IP Camera stream: ${dev.description} [${dev.zoneGroup}]`);
                    } catch (streamErr) {
                        console.warn(`[Face Service Manager Stream Error for ${dev._id}]:`, streamErr.message);
                    }
                }
            }
        } catch (e) {
            console.warn('[Face Service Manager IP Cameras Sync Warning]:', e.message);
        }
    }

    /**
     * Self-healing supervisor background loop
     */
    startSupervisor() {
        console.log('[Face Service Manager] Initializing supervisor...');
        // Boot on startup
        this.ensureRunning()
            .then(async ready => {
                if (ready) {
                    await this.syncEmployeeFaceCache();
                    await this.syncActiveIpCameras();
                }
            })
            .catch(err => console.error('[Face Service Supervisor Boot Error]:', err.message));

        // Heartbeat monitor every 15 seconds
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(async () => {
            const healthy = await this.isHealthy();
            if (!healthy) {
                console.warn('[Face Service Supervisor] Heartbeat failed. Resurrecting daemon...');
                const resurrected = await this.ensureRunning();
                if (resurrected) {
                    await this.syncEmployeeFaceCache();
                    await this.syncActiveIpCameras();
                }
            }
        }, 15000);
    }

    /**
     * Match face with seamless automatic retry on boot/reconnection
     */
    async matchFaceWithAutoRetry(payload, maxRetries = 2) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 25000);

            try {
                const response = await fetch(`${this.baseUrl}/match-face`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const data = await response.json();
                return { ok: response.ok, status: response.status, data };
            } catch (err) {
                clearTimeout(timeoutId);
                console.warn(`[Face Service Match Warning] Attempt ${attempt}/${maxRetries} failed:`, err.message);

                if (attempt < maxRetries) {
                    console.log('[Face Service Match Recovery] Auto-healing service before retry...');
                    await this.ensureRunning();
                    await new Promise(res => setTimeout(res, 1000));
                } else {
                    throw err;
                }
            }
        }
    }
}

module.exports = new FaceServiceManager();
