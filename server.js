const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

app.set('trust proxy', true);

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// 0. IP BANNING MIDDLEWARE (Render Secret File)
// ==========================================
const getBannedIPs = () => {
    try {
        // Luetaan tiedosto suoraan Renderin secret files -polusta
        const filePath = '/etc/secrets/BANNED_IPS';
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            return new Set(raw.split(/[\r\n,]+/).map(ip => ip.trim()).filter(Boolean));
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
