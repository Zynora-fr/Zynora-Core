const mongoose = require('mongoose');

const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error('MONGO_URI manquant dans les variables d\'environnement');
    }
    await mongoose.connect(mongoUri, {
        autoIndex: true,
    });
    console.log('MongoDB connecté');
};

module.exports = connectDB;
