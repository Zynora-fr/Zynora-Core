// Logique d'authentification
const User = require('../models/user');

function login(email, password) {
    // Logique d'authentification fictive
    console.log(`Connexion de l'utilisateur : ${email}`);
}

module.exports = { login };
