const users = []; // Pour l'instant, stockage en mémoire
const User = require('../models/user');

class UserService {
    static async createUser({ name, email, password, role }) {
        const id = users.length + 1;
        const userRole = role ? role : 'user'; // utilise le rôle passé si défini
        const user = new User(id, name, email, password, userRole);
        users.push(user);
        return user;
    }

    static async getUserByEmail(email) {
        return users.find(u => u.email === email);
    }

    static async getUserById(id) {
        return users.find(u => u.id === id);
    }
    
    static async getAllUsers() {
        return users;
    }
}

module.exports = UserService;
