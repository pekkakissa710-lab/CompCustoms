const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '6mb' })); // screenshot base64

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// DATABASE
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
// IP BANNING
// ==========================================
const normalizeIp = (ip) => {
    if (!ip) return '';

    ip = ip.replace(/^\[|\]$/g, '').trim();

    // IPv4-mapped IPv6 → IPv4
    if (ip.startsWith('::ffff:')) {
        ip = ip.replace('::ffff:', '');
    }

    // Poista zone index (fe80::1%eth0)
    ip = ip.split('%')[0];

    return ip.toLowerCase();
};

const getBannedIPs = () => {
    try {
        const filePath = '/etc/secrets/BANNED_IPS.json';

        if (!fs.existsSync(filePath)) {
            return null; // → redirect
        }

        const raw = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(raw);

        if (Array.isArray(data)) {
            return new Set(
                data
                    .map(ip => normalizeIp(ip))
                    .filter(Boolean)
            );
        }
    } catch (err) {
        console.error("Error reading ban list:", err);
    }

    return new Set();
};

app.use((req, res, next) => {
    const rawIp = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '';
    const clientIp = normalizeIp(rawIp);
    const bannedIPs = getBannedIPs();

    // Tiedostoa ei löydy → ohjaa pääsivulle
    if (bannedIPs === null) {
        return res.redirect(302, 'https://compcustoms.my.to');
    }

    // IP banattu
    if (bannedIPs.has(clientIp)) {
        return res.status(403).json({ error: "Access Denied: You are banned from this site." });
    }

    next();
});

// ==========================================
// LOBBIES
// ==========================================
let lobbies = [];

app.get('/api/tournaments', (req, res) => {
    res.json(lobbies);
});

app.post('/api/tournaments', (req, res) => {
    const { secret, name, customCode, startTime, teamSize, mode, submode, description } = req.body;

    if (secret !== process.env.EPIC_CLIENT_SECRET) {
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
    if (secret !== process.env.EPIC_CLIENT_SECRET) {
        return res.status(403).json({ error: "Invalid secret" });
    }

    const id = req.params.id;
    lobbies = lobbies.filter(l => l.id !== id);
    res.json({ success: true });
});

// ==========================================
// ADMIN LOGIN
// ==========================================
app.post('/api/admin/login', (req, res) => {
    const { secret } = req.body;

    if (secret === process.env.EPIC_CLIENT_SECRET) {
        return res.json({ success: true });
    }

    return res.status(403).json({ error: "Invalid secret" });
});

// ==========================================
// AUTH
// ==========================================
app.post('/api/auth/register', (req, res) => {
    return res.status(400).json({
        success: false,
        message: "Please use the registration form with Fortnite profile verification."
    });
});

app.post('/api/auth/register-with-proof', async (req, res) => {
    try {
        const { username, password, imageBase64, mimeType } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Username and password are required." });
        }

        if (!imageBase64) {
            return res.status(400).json({ success: false, message: "Screenshot is required." });
        }

        const existing = usersDatabase.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (existing) {
            return res.status(400).json({ success: false, message: "Username already in use." });
        }

        // AI review (Gemini Vision)
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `You are verifying a Fortnite profile screenshot for account registration.

Username the user claims: "${username}"

Look at the image and answer ONLY with valid JSON in this exact format:
{"valid": true or false, "reason": "short reason"}

Rules:
- valid=true ONLY if the image clearly looks like a Fortnite in-game profile / career / locker / menu screen that shows a display name.
- The display name in the image should reasonably match "${username}" (ignore case, small differences ok).
- valid=false if: not Fortnite, no name visible, edited/fake, wrong person, too blurry, or meme/stock image.
- Be strict against fakes.
- reason must be short (max 15 words).

JSON only, no markdown.`;

        const result = await model.generateContent({
            contents: [{
                role: "user",
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: mimeType || "image/jpeg",
                            data: imageBase64
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 150
            }
        });

        let raw = result.response.text().trim();
        raw = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

        let verdict;
        try {
            verdict = JSON.parse(raw);
        } catch {
            console.error("AI raw response:", raw);
            return res.status(500).json({ success: false, message: "AI review failed. Try again." });
        }

        if (!verdict.valid) {
            return res.status(400).json({
                success: false,
                message: verdict.reason || "Screenshot rejected. Use a clear photo of your Fortnite profile."
            });
        }

        const newUser = {
            username,
            password,
            createdAt: new Date().toISOString(),
            verified: true
        };

        usersDatabase.push(newUser);
        saveUsers(usersDatabase);

        res.json({
            success: true,
            username,
            message: "Account verified and created successfully!"
        });
    } catch (error) {
        console.error("register-with-proof error:", error);
        res.status(500).json({ success: false, message: "Server error during verification." });
    }
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
// AI CHAT
// ==========================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: "Message is required." });

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash"
        });

        const fullPrompt = `You are the official CompCustoms support bot on compcustoms.my.to.

CompCustoms is a Fortnite competitive customs website. Players create accounts, join custom scrims and get custom matchmaking keys.

You ONLY answer questions about CompCustoms. Nothing else.

Allowed topics:
- How to create an account or log in
- How to see the custom key (must be logged in first, then open a lobby)
- Why lobbies show Offline or Unable to connect
- Match rules
- Account problems on CompCustoms

Strict rules:
- Never use * or ** or any markdown
- Never ask which website or platform the user means
- If the question is not about CompCustoms, reply only with: I can only help with CompCustoms related questions.
- Keep answers short and clear
- Do not start your reply with empty lines or spaces
- Do not invent features

User question: ${message}

Your reply:`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
            generationConfig: {
                temperature: 0.15,
                maxOutputTokens: 300
            }
        });

        let reply = result.response.text()
            .replace(/^\s+/, '')
            .replace(/\*+/g, '')
            .trim();

        res.json({ reply });
    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ error: "Error generating AI response." });
    }
});

// ==========================================
// HEALTH
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
