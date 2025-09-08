const express = require('express');
require('dotenv').config();

const AuthService = require('./src/services/authService');
const UserService = require('./src/services/userService');
const { authenticateToken, authorizeRoles } = require('./src/middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json()); // Pour parser le JSON

// Route test serveur
app.get('/', (req, res) => {
    res.send('Devosphere-Core API fonctionne !');
});

// Route register
app.post('/register', async (req, res) => {
    try {
        const user = await AuthService.register(req.body);
        res.status(201).json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Route login
app.post('/login', async (req, res) => {
    try {
        const data = await AuthService.login(req.body);
        res.json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Route protégée exemple
app.get('/admin', authenticateToken, authorizeRoles('admin'), (req, res) => {
    res.send('Bienvenue admin !');
});

app.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const user = await AuthService.register({ name, email, password, role });
        res.status(201).json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Route pour récupérer tous les utilisateurs (admin only)
app.get('/users', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    const users = await UserService.getAllUsers();
    res.json(users);
});

// Route pour le profil utilisateur
app.get('/profile', authenticateToken, authorizeRoles('user', 'admin'), (req, res) => {
    res.json({ message: `Bienvenue ${req.user.name}`, user: req.user });
});

app.get('/users/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    const user = await UserService.getUserById(parseInt(req.params.id));
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.json(user);
});

// Route pour le Dashboard
app.get('/dashboard', authenticateToken, authorizeRoles('user'), (req, res) => {
    res.send(`Bienvenue sur ton dashboard, ${req.user.name} !`);
});

// Démarrage serveur
app.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
