# Photo & Video Gallery

A modern web application for managing and displaying photos and videos with admin functionality.

## Features

- **Main Page**: Landing page with photo and video navigation buttons
- **Photo Gallery**: Grid layout with uniform 4:3 aspect ratio photos
- **Video Gallery**: Grid layout with uniform 16:9 aspect ratio videos
- **Admin Panel**: Password-protected floating admin button for media management
- **Upload Functionality**: Add photos and videos to the gallery
- **Delete Functionality**: Remove unwanted media files
- **Responsive Design**: Works on desktop and mobile devices
- **Modal Views**: Full-size viewing for photos and videos

## Installation

1. Install Node.js dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

3. Open your browser and navigate to:
- Main page: http://localhost:3000
- Photo gallery: http://localhost:3000/photos.html
- Video gallery: http://localhost:3000/videos.html

## Usage

### Viewing Media
- Click on "Photos" or "Videos" buttons on the main page
- Click on any photo or video to view in full size
- Use the Escape key or click outside to close modal views

### Admin Access
1. Click the floating gear button (⚙️) in the bottom-right corner
2. Enter the admin password (default: `admin123`)
3. Choose from the admin options:
   - Add Photo: Upload new photo files
   - Add Video: Upload new video files
   - Remove Photo: Delete existing photos
   - Remove Video: Delete existing videos

### File Storage
- Photos are stored in `uploads/photos/` directory
- Videos are stored in `uploads/videos/` directory
- Media metadata is stored in `data/media.json`

## Configuration

### Changing Admin Password
Edit the `ADMIN_PASSWORD` constant in `script.js`:
```javascript
const ADMIN_PASSWORD = 'your-new-password';
```

### File Size Limits
The default upload limit is 100MB. To change this, modify the `fileSize` limit in `server.js`:
```javascript
limits: {
    fileSize: 100 * 1024 * 1024 // Change this value
}
```

### Supported File Types
- **Photos**: All image formats (JPG, PNG, GIF, WebP, etc.)
- **Videos**: All video formats (MP4, WebM, AVI, MOV, etc.)

## File Structure
```
event/
├── index.html          # Main landing page
├── photos.html         # Photo gallery page
├── videos.html         # Video gallery page
├── styles.css          # Global styles
├── script.js           # Frontend JavaScript
├── server.js           # Node.js backend server
├── package.json        # Node.js dependencies
├── uploads/            # Media files storage
│   ├── photos/         # Uploaded photos
│   └── videos/         # Uploaded videos
├── data/               # Database storage
│   └── media.json      # Media metadata
└── README.md           # This file
```

## Dependencies

- **express**: Web server framework
- **multer**: File upload handling
- **cors**: Cross-origin resource sharing
- **fs-extra**: Enhanced file system operations
- **uuid**: Unique identifier generation

## Security Notes

- Change the default admin password before deploying
- Consider implementing user authentication for production use
- File uploads are validated by type and size
- All files are stored in secure, non-public directories

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Server Won't Start
- Check if port 3000 is available
- Ensure all dependencies are installed with `npm install`

### Upload Issues
- Verify file size doesn't exceed 100MB limit
- Ensure file type is supported
- Check server console for error messages

### Media Not Displaying
- Verify files exist in the uploads directory
- Check browser console for JavaScript errors
- Ensure server is running and accessible

## License

ISC License - feel free to use and modify for your projects.
