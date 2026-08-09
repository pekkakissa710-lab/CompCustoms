const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

app.set('trust proxy', true);
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// DATABASE: Persistent file-based storage
// ==========================================
const dbDir = path.join(__dirname, 'data');
const usersFile = path.join(dbDir, 'users.json');

const ensureDataDir = () => {
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
};

const loadUsers = () => {
    try {
        if (fs.existsSync(usersFile)) {
            return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        }
    } catch (err) {
        console.error("Error loading users database:", err);
    }
    return [];
};

const saveUsers = (users) => {
    try {
        ensureDataDir();
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
    } catch (err) {
        console.error("Error saving users database:", err);
    }
};

let usersDatabase = loadUsers();

// ==========================================
// 0. IP BANNING MIDDLEWARE (BANNED_IPS.json)
// ==========================================
const getBannedIPs = () => {
    try {
        const filePath = '/etc/secrets/BANNED_IPS.json';
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(raw);
            if (Array.isArray(data)) {
                return new Set(data.map(ip => ip.trim()).filter(Boolean));
            }
        }
    } catch (err) {
        console.error("Error reading ban list:", err);
    }
    return new Set();
};

app.use((req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    const bannedIPs = getBannedIPs();

    if (bannedIPs.has(clientIp)) {
        return res.status(403).json({ error: "Access Denied: You are banned from this site." });
    }
    next();
});

// ==========================================
// 1. LOBBIES / TOURNAMENTS API
// ==========================================
let lobbies = [];

app.get('/api/tournaments', (req, res) => {
    res.json(lobbies);
});

app.post('/api/tournaments', (req, res) => {
    const { secret, name, customCode, startTime, teamSize, mode, submode, description } = req.body;

    if (secret !== process.env.EPIC_CLIENT_SECRET && secret !== "THESECRETHUB") {
        return res.status(403).json({ error: "Invalid secret" });
    }

    const newLobby = {
        id: Date.now().toString(),
        name,
        customCode,
        startTime,
        teamSize,
        mode,
        submode,
        description,
        createdAt: new Date().toISOString()
    };

    lobbies.push(newLobby);
    res.json({ success: true, lobby: newLobby });
});

app.delete('/api/tournaments/:id', (req, res) => {
    const { secret } = req.body;
    if (secret !== process.env.EPIC_CLIENT_SECRET && secret !== "THESECRETHUB") {
        return res.status(403).json({ error: "Invalid secret" });
    }

    const id = req.params.id;
    lobbies = lobbies.filter(l => l.id !== id);
    res.json({ success: true });
});

// ==========================================
// 2. AUTH API
// ==========================================
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Username and password are required!" });
    }

    const existing = usersDatabase.find(u => u.username === username);
    if (existing) {
        return res.status(400).json({ success: false, message: "Username already in use." });
    }

    const newUser = {
        username,
        password,
        createdAt: new Date().toISOString()
    };

    usersDatabase.push(newUser);
    saveUsers(usersDatabase);

    res.json({ success: true, username, message: "Account created successfully!" });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: "Username and password are required." });
    }

    const user = usersDatabase.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(400).json({ success: false, message: "Invalid username or password." });
    }

    res.json({ success: true, username: user.username, message: "Logged in successfully!" });
});

// ==========================================
// 3. GEMINI AI CHATBOT API
// ==========================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: "Message is required." });

        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.5-flash-lite",
            systemInstruction: `You are the official support AI for CompCustoms (compcustoms.my.to).

CompCustoms is a Fortnite competitive platform where players can:
- Join and view custom scrims / custom matches (lobbies)
- Get custom matchmaking keys (custom codes)
- Create accounts and log in to see lobby keys
- Practice competitive Fortnite in organized customs

Your ONLY job is to help users with CompCustoms-related topics:
- How to create an account / log in
- How to see and use custom keys
- Lobby status, rules, and how customs work
- Account problems related to the site
- Match rules and banned behavior
- Why the site shows "Offline" or "Unable to connect"

Strict rules:
- Stay strictly on-topic. Do NOT answer questions about other games, general Fortnite tips, homework, coding, or anything unrelated to CompCustoms.
- If the user goes off-topic, politely redirect them back to CompCustoms support.
- Be short, clear and helpful.
- Never pretend to be a human admin.
- Never make up features that don't exist.
- If you don't know something specific, say so and suggest checking the FAQ or trying again later.`
        });

        const result = await model.generateContent(message);
        res.json({ reply: result.response.text() });
    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ error: "Error generating AI response." });
    }
});

// ==========================================
// Health check endpoint
// ==========================================
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(), 
        usersCount: usersDatabase.length
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    ensureDataDir();
});
