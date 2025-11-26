const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('node:child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for dev, restrict in prod if needed
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const ROOT_DIR = path.resolve(__dirname, '../../..');
const SETUP_SCRIPT = path.join(ROOT_DIR, 'scripts', 'setup-wizard.mjs');
const ENV_FILE = path.join(ROOT_DIR, '.env');

let setupProcess = null;

// Helper to read .env
const readEnv = () => {
    try {
        if (!fs.existsSync(ENV_FILE)) return {};
        const content = fs.readFileSync(ENV_FILE, 'utf-8');
        return content.split('\n').reduce((acc, line) => {
            const [key, ...val] = line.split('=');
            if (key && val) acc[key.trim()] = val.join('=').trim();
            return acc;
        }, {});
    } catch (e) {
        console.error("Error reading .env", e);
        return {};
    }
};

// Helper to write .env
const writeEnv = (newEnv) => {
    const currentEnv = readEnv();
    const merged = { ...currentEnv, ...newEnv };
    const content = Object.entries(merged)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
    fs.writeFileSync(ENV_FILE, content);
};

app.get('/api/config', (req, res) => {
    res.json(readEnv());
});

app.post('/api/config', (req, res) => {
    try {
        writeEnv(req.body);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/start', (req, res) => {
    if (setupProcess) {
        return res.status(400).json({ error: 'Setup already running' });
    }

    const { flags = [] } = req.body;
    // Always run non-interactive from the web app's perspective
    // We might need to adjust this if we want to support interactive prompts via websocket
    // But for now, let's assume we configure everything via API first, then run non-interactive
    // or we handle prompts via specific websocket events if the script supports it.
    // The plan said "Spawn scripts/setup-wizard.mjs --noninteractive".

    // However, to see the output properly and maybe interact, we might want to use node-pty if we need true TTY.
    // For now, simple spawn with pipe is enough for logs.

    // Note: The original script uses `enquirer` which might behave differently if not TTY.
    // We'll pass --noninteractive to skip prompts and rely on pre-configuration.

    const args = [SETUP_SCRIPT, '--noninteractive', ...flags];

    console.log(`Spawning: node ${args.join(' ')}`);

    setupProcess = spawn('node', args, {
        cwd: ROOT_DIR,
        env: { ...process.env, FORCE_COLOR: '1' } // Force color for pretty logs
    });

    setupProcess.stdout.on('data', (data) => {
        const str = data.toString();
        io.emit('log', str);

        // Parse for specific events
        if (str.includes('Phone Number Pairing Code')) {
            // We might need to buffer lines to capture the code accurately if it's split
            // But usually it comes in a block.
            // Let's just emit the raw log and let frontend parse, or parse here.
        }
    });

    setupProcess.stderr.on('data', (data) => {
        io.emit('log', data.toString());
    });

    setupProcess.on('close', (code) => {
        io.emit('status', { state: 'finished', code });
        setupProcess = null;
    });

    setupProcess.on('error', (err) => {
        console.error('Failed to start setup process:', err);
        io.emit('log', `\r\nError: Failed to start setup process: ${err.message}\r\n`);
        setupProcess = null;
    });

    res.json({ success: true });
});

app.post('/api/stop', (req, res) => {
    if (setupProcess) {
        setupProcess.kill();
        setupProcess = null;
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'No process running' });
    }
});

io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});
