const express = require('express');
const cors = require('cors');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

app.set('trust proxy', true);
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
        console.error("Virhe bannilistan lukemisessa:", err);
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
// 2. OMA AUTH & NODEMAILER SÄHKÖPOSTI
// ==========================================
const usersDatabase = [];

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

app.post('/api/auth/register', async (req, res) => {
    const { email, epicUsername, password } = req.body;

    if (!email || !epicUsername || !password) {
        return res.status(400).json({ success: false, message: "Kaikki kentät vaaditaan!" });
    }

    const existing = usersDatabase.find(u => u.email === email || u.epicUsername === epicUsername);
    if (existing) {
        return res.status(400).json({ success: false, message: "Sähköposti tai Epic-käyttäjätunnus on jo käytössä." });
    }

    usersDatabase.push({ email, epicUsername, password });

    try {
        await transporter.sendMail({
            from: '"CompCustoms" <no-reply@compcustoms.my.to>',
            to: email,
            subject: 'Tervetuloa CompCustomsiin!',
            text: `Hei ${epicUsername}!\n\nTunnuksesi on luotu onnistuneesti CompCustoms-alustalle.\n\nTerveisin,\nCompCustoms Team`
        });
    } catch (error) {
        console.error("Sähköpostin lähetys epäonnistui:", error);
    }

    res.json({ success: true, username: epicUsername, message: "Tili luotu onnistuneesti!" });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    const user = usersDatabase.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(400).json({ success: false, message: "Virheellinen sähköposti tai salasana." });
    }

    res.json({ success: true, username: user.epicUsername, message: "Kirjauduttu sisään!" });
});

// ==========================================
// 3. GEMINI AI CHATBOT API
// ==========================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: "Viesti puuttuu." });

        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: "You are the official customer service bot for the CompCustoms platform. Assist players with custom codes and account issues."
        });

        const result = await model.generateContent(message);
        res.json({ reply: result.response.text() });
    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ error: "Virhe tekoälyvastauksen luonnissa." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Palvelin käynnissä portissa ${PORT}`);
});
