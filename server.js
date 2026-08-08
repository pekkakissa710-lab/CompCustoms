const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('CompCustoms API pyörii!');
});

// Epic Auth Login
app.get('/api/auth/login', (req, res) => {
  const authUrl = `https://www.epicgames.com/id/authorize?client_id=${process.env.EPIC_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.EPIC_REDIRECT_URI)}`;
  res.redirect(authUrl);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Palvelin käynnissä portissa ${PORT}`);
});

