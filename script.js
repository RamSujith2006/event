// Admin password - change this to your desired password
const ADMIN_PASSWORD = 'vilbinvilbinv';

let currentMediaType = '';

function navigateTo(page) {
    window.location.href = `${page}.html`;
}

function showPasswordModal() {
    document.getElementById('passwordModal').style.display = 'block';
    document.getElementById('passwordInput').value = '';
    document.getElementById('passwordInput').focus();
}

function closePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
}

function checkPassword() {
    const password = document.getElementById('passwordInput').value;
    if (password === ADMIN_PASSWORD) {
        closePasswordModal();
        showAdminPanel();
    } else {
        alert('Incorrect password!');
        document.getElementById('passwordInput').value = '';
        document.getElementById('passwordInput').focus();
    }
}

function showAdminPanel() {
    document.getElementById('adminPanel').style.display = 'block';
}

function closeAdminPanel() {
    document.getElementById('adminPanel').style.display = 'none';
}

function showAddOption(mediaType) {
    currentMediaType = mediaType;
    const modal = document.getElementById('addMediaModal');
    const title = document.getElementById('addMediaTitle');
    const fileInput = document.getElementById('mediaFileInput');
    
    title.textContent = `Add ${mediaType === 'photo' ? 'Photo' : 'Video'}`;
    
    if (mediaType === 'photo') {
        fileInput.accept = 'image/*';
    } else {
        fileInput.accept = 'video/*';
    }
    
    closeAdminPanel();
    modal.style.display = 'block';
}

function showRemoveOption(mediaType) {
    currentMediaType = mediaType;
    const modal = document.getElementById('removeMediaModal');
    const title = document.getElementById('removeMediaTitle');
    const mediaList = document.getElementById('mediaList');
    
    title.textContent = `Remove ${mediaType === 'photo' ? 'Photo' : 'Video'}`;
    
    // Load media list from server
    loadMediaList(mediaType);
    
    closeAdminPanel();
    modal.style.display = 'block';
}

function closeAddMediaModal() {
    document.getElementById('addMediaModal').style.display = 'none';
    document.getElementById('mediaFileInput').value = '';
}

function closeRemoveMediaModal() {
    document.getElementById('removeMediaModal').style.display = 'none';
    document.getElementById('mediaList').innerHTML = '';
}

async function uploadMedia() {
    const fileInput = document.getElementById('mediaFileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a file to upload.');
        return;
    }
    
    // Show uploading state
    const uploadBtn = document.querySelector('#addMediaModal button[onclick="uploadMedia()"]');
    const originalText = uploadBtn.textContent;
    uploadBtn.textContent = 'Uploading...';
    uploadBtn.disabled = true;
    
    try {
        // Step 1: Upload directly to Cloudinary from client
        const cloudName = 'dxeuesnn2';
        const uploadPreset = 'event_gallery'; // Unsigned upload preset name
        
        const cloudinaryFormData = new FormData();
        cloudinaryFormData.append('file', file);
        cloudinaryFormData.append('upload_preset', uploadPreset);
        cloudinaryFormData.append('folder', `event-gallery/${currentMediaType}s`);
        
        const resourceType = currentMediaType === 'video' ? 'video' : 'image';
        const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
        
        const cloudinaryResponse = await fetch(cloudinaryUrl, {
            method: 'POST',
            body: cloudinaryFormData
        });
        
        if (!cloudinaryResponse.ok) {
            const errorData = await cloudinaryResponse.json();
            throw new Error(errorData.error?.message || 'Cloudinary upload failed');
        }
        
        const cloudinaryResult = await cloudinaryResponse.json();
        
        // Step 2: Save metadata to our server
        const saveResponse = await fetch('/api/save-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: cloudinaryResult.secure_url,
                publicId: cloudinaryResult.public_id,
                originalName: file.name,
                type: currentMediaType
            })
        });
        
        const result = await saveResponse.json();
        
        if (saveResponse.ok) {
            alert(`${currentMediaType === 'photo' ? 'Photo' : 'Video'} uploaded successfully!`);
            closeAddMediaModal();
        } else {
            alert(`Error saving media: ${result.error}`);
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert(`Failed to upload media: ${error.message}. Please try again.`);
    } finally {
        uploadBtn.textContent = originalText;
        uploadBtn.disabled = false;
    }
}

async function loadMediaList(mediaType) {
    try {
        const response = await fetch(`/api/media/${mediaType}`);
        const mediaList = await response.json();
        
        const listContainer = document.getElementById('mediaList');
        listContainer.innerHTML = '';
        
        if (mediaList.length === 0) {
            listContainer.innerHTML = '<p>No media found.</p>';
            return;
        }
        
        mediaList.forEach(item => {
            const mediaItem = document.createElement('div');
            mediaItem.className = 'media-item';
            
            const mediaInfo = document.createElement('span');
            mediaInfo.textContent = item.filename;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.textContent = 'Remove';
            removeBtn.onclick = () => removeMedia(item.id, item.filename);
            
            mediaItem.appendChild(mediaInfo);
            mediaItem.appendChild(removeBtn);
            listContainer.appendChild(mediaItem);
        });
    } catch (error) {
        console.error('Error loading media list:', error);
        document.getElementById('mediaList').innerHTML = '<p>Error loading media list.</p>';
    }
}

async function removeMedia(id, filename) {
    if (!confirm(`Are you sure you want to remove "${filename}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/media/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Media removed successfully!');
            loadMediaList(currentMediaType); // Refresh the list
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        console.error('Remove error:', error);
        alert('Failed to remove media. Please try again.');
    }
}

// Event listeners
document.getElementById('passwordInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        checkPassword();
    }
});

// Close modals when clicking outside
window.onclick = function(event) {
    const passwordModal = document.getElementById('passwordModal');
    const adminPanel = document.getElementById('adminPanel');
    const addMediaModal = document.getElementById('addMediaModal');
    const removeMediaModal = document.getElementById('removeMediaModal');
    
    if (event.target === passwordModal) {
        closePasswordModal();
    } else if (event.target === adminPanel) {
        closeAdminPanel();
    } else if (event.target === addMediaModal) {
        closeAddMediaModal();
    } else if (event.target === removeMediaModal) {
        closeRemoveMediaModal();
    }
}
