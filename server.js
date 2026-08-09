// ==========================================
// 2. OMA AUTH & NODEMAILER SÄHKÖPOSTI (Koodivahvistuksella)
// ==========================================
const usersDatabase = [];
const pendingVerification = new Map(); // Tallentaa sähköpostin perusteella luodun koodin ja tiedot

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

    // Luodaan satunnainen 6-numeroinen koodi
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Tallennetaan väliaikaisesti muistiin
    pendingVerification.set(email, { email, epicUsername, password, verificationCode });

    try {
        await transporter.sendMail({
            from: '"CompCustoms" <no-reply@compcustoms.my.to>',
            to: email,
            subject: 'Vahvistuskoodisi CompCustomsiin',
            text: `Hei ${epicUsername}!\n\nVahvistuskoodisi CompCustoms-tilin luomiseen on: ${verificationCode}\n\nTerveisin,\nCompCustoms Team`
        });
        res.json({ success: true, requireVerification: true, message: "Vahvistuskoodi lähetetty sähköpostiisi!" });
    } catch (error) {
        console.error("Sähköpostin lähetys epäonnistui:", error);
        res.status(500).json({ success: false, message: "Sähköpostin lähetys epäonnistui." });
    }
});

// Uusi endpoint koodin tarkistukselle
app.post('/api/auth/verify', async (req, res) => {
    const { email, code } = req.body;

    const pending = pendingVerification.get(email);
    if (!pending || pending.verificationCode !== code) {
        return res.status(400).json({ success: false, message: "Virheellinen vahvistuskoodi." });
    }

    // Siirretään käyttäjä oikeaan tietokantaan
    usersDatabase.push({
        email: pending.email,
        epicUsername: pending.epicUsername,
        password: pending.password
    });

    pendingVerification.delete(email);

    res.json({ success: true, username: pending.epicUsername, message: "Tili vahvistettu ja luotu onnistuneesti!" });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    const user = usersDatabase.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(400).json({ success: false, message: "Virheellinen sähköposti tai salasana." });
    }

    res.json({ success: true, username: user.epicUsername, message: "Kirjauduttu sisään!" });
});
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
