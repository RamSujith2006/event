#!/usr/bin/env python3
import http.server
import socketserver
import os
import json
import urllib.parse
from pathlib import Path
import shutil
import uuid

PORT = 8000

class MediaGalleryHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.getcwd(), **kwargs)
    
    def do_GET(self):
        if self.path.startswith('/api/'):
            self.handle_api_get()
        else:
            # Serve static files
            if self.path == '/':
                self.path = '/index.html'
            elif self.path == '/photos.html':
                self.path = '/photos.html'
            elif self.path == '/videos.html':
                self.path = '/videos.html'
            elif self.path.startswith('/uploads/'):
                # Serve uploaded files
                pass
            
            return super().do_GET()
    
    def do_POST(self):
        if self.path.startswith('/api/'):
            self.handle_api_post()
        else:
            self.send_error(404)
    
    def do_DELETE(self):
        if self.path.startswith('/api/'):
            self.handle_api_delete()
        else:
            self.send_error(404)
    
    def handle_api_get(self):
        if self.path == '/api/media/photo':
            self.serve_media_list('photo')
        elif self.path == '/api/media/video':
            self.serve_media_list('video')
        else:
            self.send_error(404)
    
    def handle_api_post(self):
        if self.path == '/api/upload':
            self.handle_upload()
        else:
            self.send_error(404)
    
    def handle_api_delete(self):
        if self.path.startswith('/api/media/'):
            media_id = self.path.split('/')[-1]
            self.delete_media(media_id)
        else:
            self.send_error(404)
    
    def get_database(self):
        db_file = 'data/media.json'
        try:
            with open(db_file, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {'photos': [], 'videos': []}
        except json.JSONDecodeError:
            return {'photos': [], 'videos': []}
    
    def save_database(self, data):
        os.makedirs('data', exist_ok=True)
        with open('data/media.json', 'w') as f:
            json.dump(data, f, indent=2)
    
    def serve_media_list(self, media_type):
        db = self.get_database()
        media_key = f'{media_type}s'
        
        if media_key not in db:
            self.send_error(404)
            return
        
        media_list = []
        for item in db[media_key]:
            media_list.append({
                'id': item['id'],
                'filename': item['filename'],
                'originalName': item['originalName'],
                'uploadDate': item['uploadDate']
            })
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(media_list).encode())
    
    def handle_upload(self):
        content_type = self.headers.get('Content-Type', '')
        if not content_type.startswith('multipart/form-data'):
            self.send_error(400, "Expected multipart/form-data")
            return
        
        # Parse multipart form data
        boundary = content_type.split('boundary=')[1].encode()
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        # Simple multipart parsing (basic implementation)
        parts = post_data.split(b'--' + boundary)
        
        media_file = None
        media_type = 'photo'
        
        for part in parts[1:-1]:  # Skip first and last parts
            if b'Content-Disposition' in part:
                headers_end = part.find(b'\r\n\r\n')
                if headers_end == -1:
                    continue
                
                headers = part[:headers_end].decode('utf-8')
                data = part[headers_end + 4:]
                
                if 'name="media"' in headers:
                    filename_start = headers.find('filename="') + 10
                    filename_end = headers.find('"', filename_start)
                    filename = headers[filename_start:filename_end]
                    
                    if filename:
                        media_file = {
                            'filename': filename,
                            'data': data.rstrip(b'\r\n')
                        }
                
                elif 'name="type"' in headers:
                    media_type = data.decode('utf-8').strip()
        
        if not media_file:
            self.send_error(400, "No file uploaded")
            return
        
        # Save file
        upload_dir = f'uploads/{media_type}s'
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename
        file_ext = os.path.splitext(media_file['filename'])[1]
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(upload_dir, unique_filename)
        
        with open(file_path, 'wb') as f:
            f.write(media_file['data'])
        
        # Update database
        db = self.get_database()
        media_item = {
            'id': str(uuid.uuid4()),
            'filename': unique_filename,
            'originalName': media_file['filename'],
            'uploadDate': '2024-01-01T00:00:00.000Z',  # Simplified date
            'type': media_type
        }
        
        if media_type == 'photo':
            db['photos'].append(media_item)
        else:
            db['videos'].append(media_item)
        
        self.save_database(db)
        
        # Return success response
        response = {
            'message': 'File uploaded successfully',
            'media': media_item
        }
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())
    
    def delete_media(self, media_id):
        db = self.get_database()
        
        # Find and remove from photos
        for i, photo in enumerate(db['photos']):
            if photo['id'] == media_id:
                file_path = f'uploads/photos/{photo["filename"]}'
                if os.path.exists(file_path):
                    os.remove(file_path)
                db['photos'].pop(i)
                self.save_database(db)
                
                response = {'message': 'Photo deleted successfully'}
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode())
                return
        
        # Find and remove from videos
        for i, video in enumerate(db['videos']):
            if video['id'] == media_id:
                file_path = f'uploads/videos/{video["filename"]}'
                if os.path.exists(file_path):
                    os.remove(file_path)
                db['videos'].pop(i)
                self.save_database(db)
                
                response = {'message': 'Video deleted successfully'}
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode())
                return
        
        self.send_error(404, "Media not found")

def run_server():
    # Create necessary directories
    os.makedirs('uploads/photos', exist_ok=True)
    os.makedirs('uploads/videos', exist_ok=True)
    os.makedirs('data', exist_ok=True)
    
    # Initialize database if it doesn't exist
    if not os.path.exists('data/media.json'):
        with open('data/media.json', 'w') as f:
            json.dump({'photos': [], 'videos': []}, f, indent=2)
    
    with socketserver.TCPServer(("", PORT), MediaGalleryHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}")
        print(f"Photo gallery: http://localhost:{PORT}/photos.html")
        print(f"Video gallery: http://localhost:{PORT}/videos.html")
        print("Press Ctrl+C to stop the server")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")

if __name__ == "__main__":
    run_server()
