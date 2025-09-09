const mongoose = require('mongoose');

const PermissionSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, required: false, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('Permission', PermissionSchema);


