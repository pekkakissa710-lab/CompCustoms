<!DOCTYPE html>
<html lang="fi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CompCustoms | Hallinta</title>
    <link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            background-color: #0a0a0a;
            color: #f5f5f5;
            font-family: 'Urbanist', sans-serif;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .container { width: 100%; max-width: 500px; }
        
        h1 { color: #deff9a; text-align: center; font-size: 32px; }
        h2 { color: #deff9a; font-size: 20px; margin-top: 0; }

        .card {
            background: #111;
            border: 1px solid #333;
            padding: 25px;
            border-radius: 16px;
            margin-bottom: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }

        input, textarea {
            width: 100%;
            background: #1a1a1a;
            border: 1px solid #333;
            color: white;
            padding: 12px;
            margin: 10px 0;
            border-radius: 8px;
            box-sizing: border-box;
            font-family: inherit;
        }

        button {
            width: 100%;
            background: #deff9a;
            color: black;
            border: none;
            padding: 15px;
            border-radius: 8px;
            font-weight: 700;
            cursor: pointer;
            text-transform: uppercase;
            margin-top: 10px;
        }

        .hidden { display: none; }

        .match-card {
            background: #111;
            border-left: 4px solid #deff9a;
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 8px;
        }

        .match-code {
            background: #deff9a;
            color: black;
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: bold;
            margin-top: 10px;
        }
    </style>
</head>
<body>

<div class="container">
    <h1>Comp<span>Customs</span></h1>

    <div id="auth-box" class="card">
        <h2>Admin Kirjautuminen</h2>
        <input type="password" id="admin-secret" placeholder="Syötä Admin Secret...">
        <button onclick="login()">Kirjaudu sisään</button>
    </div>

    <div id="admin-panel" class="card hidden">
        <h2>Luo uusi matsi</h2>
        <input type="text" id="m-name" placeholder="Matsin nimi (esim. Friday Night)">
        <input type="text" id="m-code" placeholder="Custom Code (esim. COMP1)">
        <textarea id="m-desc" placeholder="Kuvaus / Säännöt" rows="3"></textarea>
        <button onclick="createMatch()">🚀 Julkaise matsi</button>
    </div>

    <div id="match-list-container">
        <h2>Aktiiviset matsit</h2>
        <div id="matches">Ladataan matseja...</div>
    </div>
</div>

<script>
    // VAIHDA TÄHÄN OMA RENDER-OSOITTEESI
    const API_BASE = 'https://compcustoms-api.onrender.com'; 
    let currentSecret = '';

    async function login() {
        const secret = document.getElementById('admin-secret').value;
        const res = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret })
        });

        if (res.ok) {
            currentSecret = secret;
            document.getElementById('auth-box').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            alert('Kirjautuminen onnistui!');
        } else {
            alert('Väärä koodi!');
        }
    }

    async function createMatch() {
        const name = document.getElementById('m-name').value;
        const customCode = document.getElementById('m-code').value;
        const description = document.getElementById('m-desc').value;

        const res = await fetch(`${API_BASE}/api/tournaments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret: currentSecret, name, customCode, description })
        });

        if (res.ok) {
            alert('Matsi luotu!');
            loadMatches();
        } else {
            alert('Virhe luonnissa.');
        }
    }

    async function loadMatches() {
        const res = await fetch(`${API_BASE}/api/tournaments`);
        const data = await res.json();
        const container = document.getElementById('matches');
        container.innerHTML = '';

        data.forEach(m => {
            container.innerHTML += `
                <div class="match-card">
                    <strong>${m.name}</strong><br>
                    <small>${m.description}</small><br>
                    <div class="match-code">Koodi: ${m.customCode}</div>
                </div>
            `;
        });
    }

    loadMatches(); // Lataa matsit heti
</script>

</body>
</html>
