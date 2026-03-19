const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true
    },
    originalName: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['photo', 'video'],
        required: true
    },
    uploadDate: {
        type: Date,
        default: Date.now
    },
    url: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('Media', mediaSchema);
