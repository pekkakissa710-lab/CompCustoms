const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Tallennetaan turnaukset palvelimen muistiin
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

// Uuden matsin luonti adminsecret.html-sivulta
app.post('/api/tournaments', (req, res) => {
    const { secret, name, customCode, description } = req.body;

    if (secret !== process.env.EPIC_CLIENT_SECRET) {
        return res.status(401).json({ success: false, message: 'Ei oikeuksia!' });
    }

    if (!name || !customCode) {
        return res.status(400).json({ success: false, message: 'Nimi ja koodi vaaditaan!' });
    }

    const newMatch = {
        id: Date.now(),
        name,
        customCode,
        description: description || '',
        createdAt: new Date()
    };

    tournaments.unshift(newMatch); // Lisää uusimman listan alkuun
    res.json({ success: true, match: newMatch });
});

// Epic Auth Login
app.get('/api/auth/login', (req, res) => {
    const authUrl = `https://www.epicgames.com/id/authorize?client_id=${process.env.EPIC_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.EPIC_REDIRECT_URI)}`;
    res.redirect(authUrl);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server pyörii portissa ${PORT}`));

