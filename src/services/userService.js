const bcrypt = require('bcryptjs');
const userRepo = require('../repositories/userRepository');

class UserService {
    static async createUser({ name, email, password, role }) {
        const user = await userRepo.create({ name, email, password, role: role || 'user' });
        return user;
    }

    static async getAllUsers() {
        const users = await userRepo.list();
        return users;
    }

    static async getUserByEmail(email) {
        const user = await userRepo.findByEmail(email);
        return user;
    }

    static async getUserById(id) {
        const user = await userRepo.findById(id);
        return user;
    }

    static async updateUser(id, { name, email, password, role }) {
        const updates = {};
        if (name) updates.name = name;
        if (email) updates.email = email;
        if (typeof role !== 'undefined') updates.role = role;
        if (password) {
            const strongPwd = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
            if (!strongPwd.test(password)) throw new Error('Mot de passe trop faible');
            updates.password = await bcrypt.hash(password, 12);
        }
        const user = await userRepo.updateById(id, updates);
        return user;
    }

    static async deleteUser(id) {
        const deleted = await userRepo.deleteById(id);
        return deleted;
    }
}

module.exports = UserService;
