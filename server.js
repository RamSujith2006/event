const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Check if running on Vercel
const isVercel = process.env.VERCEL;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Create directories if they don't exist (only for local development)
if (!isVercel) {
    const photosDir = path.join(__dirname, 'uploads', 'photos');
    const videosDir = path.join(__dirname, 'uploads', 'videos');
    const dataDir = path.join(__dirname, 'data');

    fs.ensureDirSync(photosDir);
    fs.ensureDirSync(videosDir);
    fs.ensureDirSync(dataDir);
}

// For Vercel, use /tmp directory
const photosDir = isVercel ? '/tmp/uploads/photos' : path.join(__dirname, 'uploads', 'photos');
const videosDir = isVercel ? '/tmp/uploads/videos' : path.join(__dirname, 'uploads', 'videos');
const dataDir = isVercel ? '/tmp/data' : path.join(__dirname, 'data');

// Database file paths
const dbPath = path.join(dataDir, 'media.json');

// Initialize database if it doesn't exist
if (!fs.existsSync(dbPath)) {
    fs.writeJsonSync(dbPath, { photos: [], videos: [] });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const type = req.body.type || 'photo';
        const uploadPath = type === 'video' ? videosDir : photosDir;
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

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

// Helper functions to read/write database
function readDatabase() {
    try {
        return fs.readJsonSync(dbPath);
    } catch (error) {
        console.error('Error reading database:', error);
        return { photos: [], videos: [] };
    }
}

function writeDatabase(data) {
    try {
        fs.writeJsonSync(dbPath, data);
    } catch (error) {
        console.error('Error writing database:', error);
    }
}

// API Routes

// Get media list
app.get('/api/media/:type', (req, res) => {
    try {
        const { type } = req.params;
        const db = readDatabase();
        
        if (type !== 'photo' && type !== 'video') {
            return res.status(400).json({ error: 'Invalid media type' });
        }
        
        const mediaKey = type === 'photo' ? 'photos' : 'videos';
        const mediaList = db[mediaKey].map(item => ({
            id: item.id,
            filename: item.filename,
            originalName: item.originalName,
            uploadDate: item.uploadDate
        }));
        
        res.json(mediaList);
    } catch (error) {
        console.error('Error getting media list:', error);
        res.status(500).json({ error: 'Failed to get media list' });
    }
});

// Upload media
app.post('/api/upload', upload.single('media'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const type = req.body.type || 'photo';
        const db = readDatabase();
        
        const mediaItem = {
            id: uuidv4(),
            filename: req.file.filename,
            originalName: req.file.originalname,
            uploadDate: new Date().toISOString(),
            type: type
        };
        
        if (type === 'photo') {
            db.photos.push(mediaItem);
        } else if (type === 'video') {
            db.videos.push(mediaItem);
        }
        
        writeDatabase(db);
        
        res.json({ 
            message: 'File uploaded successfully',
            media: mediaItem
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Delete media
app.delete('/api/media/:id', (req, res) => {
    try {
        const { id } = req.params;
        const db = readDatabase();
        
        // Find and remove from photos
        const photoIndex = db.photos.findIndex(item => item.id === id);
        if (photoIndex !== -1) {
            const photo = db.photos[photoIndex];
            const filePath = path.join(photosDir, photo.filename);
            
            // Delete file
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
            // Remove from database
            db.photos.splice(photoIndex, 1);
            writeDatabase(db);
            
            return res.json({ message: 'Photo deleted successfully' });
        }
        
        // Find and remove from videos
        const videoIndex = db.videos.findIndex(item => item.id === id);
        if (videoIndex !== -1) {
            const video = db.videos[videoIndex];
            const filePath = path.join(videosDir, video.filename);
            
            // Delete file
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
            // Remove from database
            db.videos.splice(videoIndex, 1);
            writeDatabase(db);
            
            return res.json({ message: 'Video deleted successfully' });
        }
        
        res.status(404).json({ error: 'Media not found' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete media' });
    }
});

// Serve uploaded files
app.use('/uploads/photos', express.static(photosDir));
app.use('/uploads/videos', express.static(videosDir));

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/photos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'photos.html'));
});

app.get('/videos.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'videos.html'));
});

// Start server
if (isVercel) {
    // Export for Vercel
    module.exports = app;
} else {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Photo gallery: http://localhost:${PORT}/photos.html`);
        console.log(`Video gallery: http://localhost:${PORT}/videos.html`);
    });
}
