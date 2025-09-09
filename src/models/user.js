const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'manager', 'user'], default: 'user' },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
// S'assure que les indexes sont construits (utile en dev)
mongoose.connection?.on?.('open', () => {
    UserSchema.index({ email: 1 }, { unique: true });
});
