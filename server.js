const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Tähän tallennetaan turnaukset muistiin (voit myöhemmin yhdistää tietokantaan)
let tournaments = [];

// Kotisivu / API-tarkistus
app.get('/', (req, res) => {
  res.send('CompCustoms API pyörii!');
});

// 1. TARKISTA SECRET / ADMIN-KIRJAUTUMINEN
app.post('/api/admin/login', (req, res) => {
  const { secret } = req.body;
  
  // Vertaa syötettyä secretiä Renderin EPIC_CLIENT_SECRET -ympäristömuuttujaan
  if (secret === process.env.EPIC_CLIENT_SECRET) {
    return res.json({ success: true, message: 'Autentikointi onnistui!' });
  } else {
    return res.status(401).json({ success: false, message: 'Väärä secret!' });
  }
});

// 2. HAE TURNAUKSET
app.get('/api/tournaments', (req, res) => {
  res.json(tournaments);
});

// 3. LISÄÄ UUSI TURNAUS (Vaatii secretin)
app.post('/api/tournaments', (req, res) => {
  const { secret, name, game, date } = req.body;

  if (secret !== process.env.EPIC_CLIENT_SECRET) {
    return res.status(401).json({ success: false, message: 'Ei käyttöoikeutta!' });
  }

  if (!name || !game || !date) {
    return res.status(400).json({ success: false, message: 'Täytä kaikki kentät!' });
  }

  const newTournament = { id: Date.now(), name, game, date };
  tournaments.push(newTournament);

  res.json({ success: true, tournament: newTournament });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Palvelin käynnissä portissa ${PORT}`);
});
