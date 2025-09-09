const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');


// GET /users → Liste tous les utilisateurs (admin only)
router.get('/', authenticateToken, adminMiddleware, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json({ data: users, message: 'Liste des utilisateurs', code: 'USERS_LIST_OK' });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', code: 'SERVER_ERROR' });
    }
});

// GET /users/:id → Voir un utilisateur précis (admin only)
router.get('/:id', authenticateToken, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
        res.json({ data: user, message: 'Utilisateur récupéré', code: 'USER_GET_OK' });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', code: 'SERVER_ERROR' });
    }
});

// PUT /users/:id → Modifier un utilisateur (admin only)
router.put('/:id',
    authenticateToken,
    authorizeRoles('admin', 'manager'),
    body('email').optional().isEmail().withMessage('Email invalide'),
    body('password').optional().isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 }).withMessage('Mot de passe trop faible'),
    async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation error', code: 'VALIDATION_ERROR', errors: errors.array() });
    try {
        const updates = req.body;

        // Si on change le mot de passe, on le hash
        if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, 10);
        }

        const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
        if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });

        res.json({ data: user, message: 'Utilisateur mis à jour', code: 'USER_UPDATE_OK' });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', code: 'SERVER_ERROR' });
    }
});

// DELETE /users/:id → Supprimer un utilisateur (admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
        res.json({ deleted: true, message: 'Utilisateur supprimé', code: 'USER_DELETE_OK' });
    } catch (err) {
        res.status(500).json({ message: 'Erreur serveur', code: 'SERVER_ERROR' });
    }
});

module.exports = router;
