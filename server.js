const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
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
const pendingVerification = new Map();

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
    
    if (secret !== process.env.EPIC_CLIENT_SECRET) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const newMatch = {
        id: Date.now().toString(),
        name,
        customCode,
        startTime,
        teamSize,
        mode,
        submode,
        description
    };

    lobbies.push(newMatch);
    res.json({ success: true, match: newMatch });
});

// ==========================================
// 2. AUTHENTICATION & EMAIL VERIFICATION
// ==========================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Check email connectivity on startup
transporter.verify((error, success) => {
    if (error) {
        console.warn("⚠️  Email service not configured. Email verification will not work.");
    } else {
        console.log("✓ Email service ready");
    }
});

app.post('/api/auth/register', async (req, res) => {
    const { email, epicUsername, password } = req.body;

    if (!email || !epicUsername || !password) {
        return res.status(400).json({ success: false, message: "All fields are required!" });
    }

    const existing = usersDatabase.find(u => u.email === email || u.epicUsername === epicUsername);
    if (existing) {
        return res.status(400).json({ success: false, message: "Email or Epic username already in use." });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    pendingVerification.set(email, { email, epicUsername, password, verificationCode });

    try {
        await transporter.sendMail({
            from: '"CompCustoms" <no-reply@compcustoms.my.to>',
            to: email,
            subject: 'Your CompCustoms Verification Code',
            text: `Hi ${epicUsername}!\n\nYour verification code for CompCustoms account creation is: ${verificationCode}\n\nBest regards,\nCompCustoms Team`,
            html: `<h2>Welcome to CompCustoms!</h2><p>Your verification code is: <strong>${verificationCode}</strong></p>`
        });
        res.json({ success: true, requireVerification: true, message: "Verification code sent to your email!" });
    } catch (error) {
        console.error("Email sending failed:", error);
        res.status(500).json({ success: false, message: "Email sending failed. Please try again later." });
    }
});

app.post('/api/auth/verify', async (req, res) => {
    const { email, code } = req.body;

    const pending = pendingVerification.get(email);
    if (!pending || pending.verificationCode !== code) {
        return res.status(400).json({ success: false, message: "Invalid verification code." });
    }

    const newUser = {
        email: pending.email,
        epicUsername: pending.epicUsername,
        password: pending.password,
        createdAt: new Date().toISOString()
    };

    usersDatabase.push(newUser);
    saveUsers(usersDatabase);
    pendingVerification.delete(email);

    res.json({ success: true, username: pending.epicUsername, message: "Account verified and created successfully!" });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const user = usersDatabase.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(400).json({ success: false, message: "Invalid email or password." });
    }

    res.json({ success: true, username: user.epicUsername, message: "Logged in successfully!" });
});

// ==========================================
// 3. GEMINI AI CHATBOT API
// ==========================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: "Message is required." });

        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: "You are the official customer service bot for the CompCustoms platform. Assist players with custom codes and account issues."
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
    res.json({ status: 'ok', timestamp: new Date().toISOString(), usersCount: usersDatabase.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    ensureDataDir();
});
