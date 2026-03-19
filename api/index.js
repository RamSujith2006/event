const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cloudinary = require('cloudinary').v2;
const Media = require('../models/Media');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Check if running on Vercel
const isVercel = process.env.VERCEL;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
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
            hasCloudinary: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
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

// Helper: Upload buffer to Cloudinary
function uploadToCloudinary(buffer, options) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            options,
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        uploadStream.end(buffer);
    });
}

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

// Save media metadata after client-side Cloudinary upload
app.post('/api/save-media', async (req, res) => {
    try {
        const { url, publicId, originalName, type } = req.body;
        
        if (!url || !type) {
            return res.status(400).json({ error: 'Missing required fields: url, type' });
        }
        
        const media = new Media({
            filename: originalName || 'unknown',
            originalName: originalName || 'unknown',
            type: type,
            url: url,
            cloudinaryPublicId: publicId || null
        });
        
        await media.save();
        
        res.json({ 
            message: 'Media saved successfully',
            media: {
                id: media._id,
                filename: media.filename,
                originalName: media.originalName,
                uploadDate: media.uploadDate,
                url: media.url
            }
        });
    } catch (error) {
        console.error('Save media error:', error);
        res.status(500).json({ error: 'Failed to save media', details: error.message });
    }
});

// Upload media via Cloudinary (server-side fallback for small files)
app.post('/api/upload', upload.single('media'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const type = req.body.type || 'photo';
        
        // Upload to Cloudinary
        const resourceType = type === 'video' ? 'video' : 'image';
        const cloudinaryResult = await uploadToCloudinary(req.file.buffer, {
            resource_type: resourceType,
            folder: `event-gallery/${type}s`,
            public_id: `${Date.now()}-${req.file.originalname.replace(/\.[^/.]+$/, '')}`,
        });
        
        const url = cloudinaryResult.secure_url;
        
        const media = new Media({
            filename: req.file.originalname,
            originalName: req.file.originalname,
            type: type,
            url: url,
            cloudinaryPublicId: cloudinaryResult.public_id
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
        res.status(500).json({ error: 'Failed to upload file', details: error.message });
    }
});

// Delete media (also removes from Cloudinary)
app.delete('/api/media/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const media = await Media.findByIdAndDelete(id);
        
        if (!media) {
            return res.status(404).json({ error: 'Media not found' });
        }
        
        // Also delete from Cloudinary if we have the public_id
        if (media.cloudinaryPublicId) {
            const resourceType = media.type === 'video' ? 'video' : 'image';
            await cloudinary.uploader.destroy(media.cloudinaryPublicId, { resource_type: resourceType })
                .catch(err => console.error('Cloudinary delete error (non-fatal):', err.message));
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
