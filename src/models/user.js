const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'manager', 'user'], default: 'user' },
}, { timestamps: true });

// Méthode pour vérifier le mot de passe
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Avant de sauvegarder, hash le mot de passe si modifié
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

module.exports = mongoose.model('User', UserSchema);
// S'assure que les indexes sont construits (utile en dev)
mongoose.connection?.on?.('open', () => {
    UserSchema.index({ email: 1 }, { unique: true });
});
