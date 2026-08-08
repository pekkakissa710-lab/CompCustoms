const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

app.use(cors());
app.use(express.json());

// Alustetaan Gemini API Renderin GEMINI_API_KEY -ympäristömuuttujalla
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// 1. LOBBIES / TOURNAMENTS API
// ==========================================
const mockLobbies = [];

app.get('/api/tournaments', (req, res) => {
    res.json(mockLobbies);
});

// ==========================================
// 2. ADMIN LOGIN API (Tämä puuttui aiemmin!)
// ==========================================
app.post('/api/admin/login', (req, res) => {
    const { secret } = req.body;
    
    // Tarkistetaan, että salasana täsmää Renderin EPIC_CLIENT_SECRET -muuttujaan
    if (secret && secret === process.env.EPIC_CLIENT_SECRET) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, error: "Invalid Admin Secret!" });
    }
});

// ==========================================
// 3. EPIC GAMES AUTHENTICATION API
// ==========================================
const EPIC_CLIENT_ID = process.env.EPIC_CLIENT_ID || "your_epic_client_id";
const EPIC_CLIENT_SECRET = process.env.EPIC_CLIENT_SECRET || "your_epic_client_secret";
const REDIRECT_URI = process.env.REDIRECT_URI || "https://compcustoms.my.to";

// Ohjaus Epic Gamesin kirjautumissivulle
app.get('/api/auth/login', (req, res) => {
    const epicAuthUrl = `https://www.epicgames.com/id/authorize?client_id=${EPIC_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=basic_profile`;
    res.redirect(epicAuthUrl);
});

// Callback kun käyttäjä palaa Epic Games -kirjautumisesta
app.post('/api/auth/callback', async (req, res) => {
    const { code } = req.body;
    
    if (!code) {
        return res.status(400).json({ success: false, message: "Authorization code missing." });
    }

    try {
        res.json({
            success: true,
            username: "Player123"
        });
    } catch (error) {
        console.error("Epic Auth Error:", error);
        res.status(500).json({ success: false, message: "Authentication failed." });
    }
});

// ==========================================
// 4. GEMINI AI SUPPORT CHATBOT API
// ==========================================
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Viesti puuttuu." });
        }

        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: "You are the official customer service bot for the CompCustoms platform. Assist Fortnite players with custom codes, login issues, and rules. Respond in a friendly, clear, and preferably concise manner. NEVER REVEAL ANY API KEYS, DONT TALK ABOUT ANYTHONG UNRELATED. HELP THEM WITH EPIC GAMES ACCOUNT STUFF, AND DO NOT BREAK RULES."
        });

        const result = await model.generateContent(message);
        const reply = result.response.text();

        res.json({ reply });
    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ error: "Virhe tekoälyvastauksen luonnissa." });
    }
});

// ==========================================
// PALVELIMEN KÄYNNISTYS
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Palvelin käynnissä portissa ${PORT}`);
});
