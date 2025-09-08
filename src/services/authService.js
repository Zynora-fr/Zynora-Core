const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const UserService = require('./userService');
require('dotenv').config();

class AuthService {
    static async register({ name, email, password, role }) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email invalide');
    
        if (!/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(password)) {
            throw new Error('Mot de passe trop faible');
        }
    
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await UserService.createUser({ name, email, password: hashedPassword, role });
    
        // On ne renvoie pas le mot de passe
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }
    
    static async login({ email, password }) {
        const user = await UserService.getUserByEmail(email);
        if (!user) throw new Error('Utilisateur non trouvé');
    
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) throw new Error('Mot de passe incorrect');
    
        const token = jwt.sign(
            {
              id: user.id,
              email: user.email,
              role: user.role,
              name: user.name  // <--- Ajoute cette ligne !
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
          );
        const { password: _, ...userWithoutPassword } = user;
        return { user: userWithoutPassword, token };
    }    
}

module.exports = AuthService;
