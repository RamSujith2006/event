const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Media = require('../models/Media');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Check if running on Vercel
const isVercel = process.env.VERCEL;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Connect to MongoDB with caching for serverless
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/media-gallery';
console.log('Connecting to MongoDB...');

let cachedConnection = null;

async function connectToMongo() {
    if (cachedConnection && mongoose.connection.readyState === 1) {
        return cachedConnection;
    }
    
    cachedConnection = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
    });
    console.log('Connected to MongoDB successfully');
    return cachedConnection;
}

// Start connection immediately
connectToMongo().catch(err => console.error('MongoDB connection error:', err.message));

// Middleware to ensure MongoDB is connected before handling API requests
app.use('/api', async (req, res, next) => {
    if (req.path === '/health') return next(); // skip for health check
    try {
        await connectToMongo();
        next();
    } catch (err) {
        console.error('MongoDB middleware error:', err.message);
        res.status(500).json({ error: 'Database connection failed', details: err.message });
    }
});

// Health check endpoint for debugging
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mongoState: mongoose.connection.readyState,
        mongoStates: { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' },
        currentState: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState],
        env: {
            hasMongoUri: !!process.env.MONGODB_URI,
            isVercel: !!process.env.VERCEL,
            nodeEnv: process.env.NODE_ENV
        }
    });
});

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: function (req, file, cb) {
        const type = req.body.type || 'photo';
        
        if (type === 'photo') {
            if (!file.mimetype.startsWith('image/')) {
                return cb(new Error('Only image files are allowed for photos.'));
            }
        } else if (type === 'video') {
            if (!file.mimetype.startsWith('video/')) {
                return cb(new Error('Only video files are allowed for videos.'));
            }
        }
        
        cb(null, true);
    }
});

// API Routes

// Get media list
app.get('/api/media/:type', async (req, res) => {
    try {
        const { type } = req.params;
        
        if (type !== 'photo' && type !== 'video') {
            return res.status(400).json({ error: 'Invalid media type' });
        }
        
        const mediaList = await Media.find({ type }).sort({ uploadDate: -1 });
        
        const response = mediaList.map(item => ({
            id: item._id,
            filename: item.filename,
            originalName: item.originalName,
            uploadDate: item.uploadDate,
            url: item.url
        }));
        
        res.json(response);
    } catch (error) {
        console.error('Error getting media list:', error);
        res.status(500).json({ error: 'Failed to get media list' });
    }
});

// Upload media
app.post('/api/upload', upload.single('media'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const type = req.body.type || 'photo';
        
        // For Vercel, we'll use a base64 URL or external storage
        // For now, we'll create a data URL
        const base64Data = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;
        const url = `data:${mimeType};base64,${base64Data}`;
        
        const media = new Media({
            filename: req.file.originalname,
            originalName: req.file.originalname,
            type: type,
            url: url
        });
        
        await media.save();
        
        res.json({ 
            message: 'File uploaded successfully',
            media: {
                id: media._id,
                filename: media.filename,
                originalName: media.originalName,
                uploadDate: media.uploadDate,
                url: media.url
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Delete media
app.delete('/api/media/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const media = await Media.findByIdAndDelete(id);
        
        if (!media) {
            return res.status(404).json({ error: 'Media not found' });
        }
        
        res.json({ message: 'Media deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete media' });
    }
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/photos.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'photos.html'));
});

app.get('/videos.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'videos.html'));
});

// Always export for Vercel serverless
module.exports = app;

// Start server for local development
if (!isVercel) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Photo gallery: http://localhost:${PORT}/photos.html`);
        console.log(`Video gallery: http://localhost:${PORT}/videos.html`);
    });
}
