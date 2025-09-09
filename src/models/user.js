const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: false, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'manager', 'user'], default: 'user' },
    permissions: { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
// S'assure que les indexes sont construits (utile en dev)
mongoose.connection?.on?.('open', () => {
    UserSchema.index({ email: 1 }, { unique: true });
    UserSchema.index({ username: 1 }, { unique: true });
});
