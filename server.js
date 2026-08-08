const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let tournaments = [];

// API-testi
app.get('/', (req, res) => {
    res.send('CompCustoms API pyörii!');
});

// Admin-kirjautumisen tarkistus
app.post('/api/admin/login', (req, res) => {
    const { secret } = req.body;
    if (secret === process.env.EPIC_CLIENT_SECRET) {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Väärä secret!' });
    }
});

// Hae kaikki turnaukset
app.get('/api/tournaments', (req, res) => {
    res.json(tournaments);
});

// Uuden matsin luonti
app.post('/api/tournaments', (req, res) => {
    const { secret, name, customCode, description, startTime, teamSize, mode, submode } = req.body;

    if (secret !== process.env.EPIC_CLIENT_SECRET) {
        return res.status(401).json({ success: false, message: 'Ei oikeuksia!' });
    }

    if (!name || !customCode || !startTime) {
        return res.status(400).json({ success: false, message: 'Nimi, koodi ja kellonaika vaaditaan!' });
    }

    const autoNotice = "\n\nℹ️ Custom-peli alkaa 10 minuuttia ilmoitetun ajankohdan jälkeen.";
    const fullDescription = (description || '') + autoNotice;

    const newMatch = {
        id: Date.now(),
        name,
        customCode,
        description: fullDescription,
        startTime,
        teamSize: teamSize || 'SOLO',
        mode: mode || 'BATTLE ROYALE',
        submode: submode || 'BUILDS',
        createdAt: new Date()
    };

    tournaments.unshift(newMatch);
    res.json({ success: true, match: newMatch });
});

// Matsin poistaminen
app.delete('/api/tournaments/:id', (req, res) => {
    const { secret } = req.body;
    const matchId = Number(req.params.id);

    if (secret !== process.env.EPIC_CLIENT_SECRET) {
        return res.status(401).json({ success: false, message: 'Ei oikeuksia!' });
    }

    tournaments = tournaments.filter(t => t.id !== matchId);
    res.json({ success: true, message: 'Matsi poistettu!' });
});

// 1. Epic Auth Login Redirect
app.get('/api/auth/login', (req, res) => {
    const authUrl = `https://www.epicgames.com/id/authorize?client_id=${process.env.EPIC_CLIENT_ID}&response_type=code&scope=basic_profile&redirect_uri=${encodeURIComponent(process.env.EPIC_REDIRECT_URI)}`;
    res.redirect(authUrl);
});

// 2. Epic Auth Callback - Vaihdetaan koodi käyttäjänimeen
app.post('/api/auth/callback', async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Koodi puuttuu' });

    try {
        // Haetaan access token Epiciltä
        const tokenParams = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: process.env.EPIC_REDIRECT_URI,
            client_id: process.env.EPIC_CLIENT_ID,
            client_secret: process.env.EPIC_CLIENT_SECRET
        });

        const tokenRes = await fetch('https://api.epicgames.dev/epic/oauth/v1/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams
        });

        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            return res.status(400).json({ error: 'Tokenin haku epäonnistui' });
        }

        // Haetaan käyttäjän profiilitiedot (oikea käyttäjänimi)
        const userRes = await fetch('https://api.epicgames.dev/epic/oauth/v1/userInfo', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });

        const userData = await userRes.json();
        const username = userData.preferred_username || userData.displayName || 'Epic User';

        res.json({ success: true, username: username });
    } catch (err) {
        res.status(500).json({ error: 'Virhe Epic-todennuksessa' });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server pyörii portissa ${PORT}`));
