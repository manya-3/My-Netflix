// ===== AUTH & PROFILES =====
const loginScreen   = document.getElementById('loginScreen');
const profileScreen = document.getElementById('profileScreen');
const loginForm     = document.getElementById('loginForm');
const passwordInput = document.getElementById('passwordInput');
const loginError    = document.getElementById('loginError');
const profilesGrid  = document.getElementById('profilesGrid');
const navProfileName = document.getElementById('navProfileName');
const signOutBtn    = document.getElementById('signOutBtn');

let selectedProfile = null;

function isApiOriginLikelyCorrect() {
  return window.location.protocol.startsWith('http') && window.location.port === '3000';
}

// Check session on load - runs before loadMedia
async function initApp() {
  const authed = sessionStorage.getItem('mflix_auth');
  if (!authed) {
    showLoginScreen();
    return;
  }
  const savedProfile = sessionStorage.getItem('mflix_profile');
  if (!savedProfile) {
    await showProfileScreen();
    return;
  }
  selectedProfile = JSON.parse(savedProfile);
  enterApp();
}

function showLoginScreen() {
  loginScreen.style.display = 'flex';
  profileScreen.style.display = 'none';
  passwordInput.value = '';
  if (isApiOriginLikelyCorrect()) {
    loginError.textContent = '';
  } else {
    loginError.textContent = 'Open this app from http://localhost:3000 (or your-PC-IP:3000).';
  }
  setTimeout(() => passwordInput.focus(), 100);
}

async function showProfileScreen() {
  loginScreen.style.display = 'none';
  profileScreen.style.display = 'flex';
  await renderProfileGrid();
}

function enterApp() {
  loginScreen.style.display = 'none';
  profileScreen.style.display = 'none';
  if (selectedProfile) {
    navProfileName.textContent = selectedProfile.name;
  }
  loadMedia();
}

// Login form submit
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const pw = String(passwordInput.value || '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .trim();
  loginError.textContent = '';
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    if (res.ok) {
      sessionStorage.setItem('mflix_auth', '1');
      await showProfileScreen();
    } else {
      if (res.status === 404) {
        loginError.textContent = 'Login API not found. Open the app from http://localhost:3000.';
        return;
      }
      let msg = 'Incorrect password. Try again.';
      try {
        const data = await res.json();
        if (data && data.error) msg = data.error;
      } catch {}
      loginError.textContent = msg;
      passwordInput.value = '';
      passwordInput.focus();
    }
  } catch {
    loginError.textContent = 'Connection error. Is the server running?';
  }
});

// Render profile grid
async function renderProfileGrid() {
  profilesGrid.innerHTML = '';
  try {
    const res = await fetch('/api/profiles');
    const data = await res.json();
    const profiles = data.profiles || [];

    profiles.forEach(profile => {
      const card = document.createElement('div');
      card.className = 'profile-card';

      const avatar = document.createElement('div');
      avatar.className = 'profile-avatar';
      avatar.style.background = profile.color;
      avatar.textContent = profile.emoji;

      const nameEl = document.createElement('div');
      nameEl.className = 'profile-name-label';
      nameEl.textContent = profile.name;

      const delBtn = document.createElement('button');
      delBtn.className = 'profile-delete-btn';
      delBtn.innerHTML = '&times;';
      delBtn.title = 'Delete profile';
      delBtn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm(`Delete profile "${profile.name}"?`)) return;
        await fetch(`/api/profiles/${profile.id}`, { method: 'DELETE' });
        await renderProfileGrid();
      });

      card.appendChild(avatar);
      card.appendChild(nameEl);
      card.appendChild(delBtn);
      card.addEventListener('click', () => {
        selectedProfile = profile;
        sessionStorage.setItem('mflix_profile', JSON.stringify(profile));
        enterApp();
      });

      profilesGrid.appendChild(card);
    });

    // Add profile card (if < 5)
    if (profiles.length < 5) {
      const addCard = document.createElement('div');
      addCard.className = 'profile-card profile-add-card';
      addCard.innerHTML = `
        <div class="profile-avatar">+</div>
        <div class="profile-name-label">Add Profile</div>
      `;
      addCard.addEventListener('click', openAddProfile);
      profilesGrid.appendChild(addCard);
    }
  } catch (e) {
    console.error('Failed to load profiles', e);
  }
}

// Sign out → back to profile picker
signOutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('mflix_profile');
  selectedProfile = null;
  showProfileScreen();
});

// Add profile modal
const addProfileModal = document.getElementById('addProfileModal');
const addProfileForm  = document.getElementById('addProfileForm');
const profileNameInput = document.getElementById('profileNameInput');
const addProfileMsg   = document.getElementById('addProfileMsg');
const avatarPreview   = document.getElementById('avatarPreview');
const emojiPicker     = document.getElementById('emojiPicker');
const colorPicker     = document.getElementById('colorPicker');

let selectedEmoji = '😊';
let selectedColor = '#e50914';

function openAddProfile() {
  addProfileModal.classList.add('active');
  profileNameInput.value = '';
  addProfileMsg.textContent = '';
  selectedEmoji = '😊';
  selectedColor = '#e50914';
  avatarPreview.textContent = selectedEmoji;
  avatarPreview.style.background = selectedColor;
  // Reset selections
  document.querySelectorAll('.emoji-picker span').forEach(s => s.classList.remove('selected'));
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  const firstEmoji = document.querySelector('.emoji-picker span');
  if (firstEmoji) firstEmoji.classList.add('selected');
  const firstColor = document.querySelector('.color-swatch');
  if (firstColor) firstColor.classList.add('selected');
  setTimeout(() => profileNameInput.focus(), 100);
}

document.getElementById('addProfileBtn').addEventListener('click', openAddProfile);
document.getElementById('closeAddProfile').addEventListener('click', () => {
  addProfileModal.classList.remove('active');
});
addProfileModal.addEventListener('click', e => {
  if (e.target === addProfileModal) addProfileModal.classList.remove('active');
});
document.getElementById('manageProfilesBtn').addEventListener('click', () => {
  // Just toggle showing the delete buttons — hovering does it already
  // Provide a tip message instead
  alert('Hover over a profile and click the × button to delete it.');
});

// Emoji picker
emojiPicker.querySelectorAll('span').forEach(span => {
  span.addEventListener('click', () => {
    emojiPicker.querySelectorAll('span').forEach(s => s.classList.remove('selected'));
    span.classList.add('selected');
    selectedEmoji = span.textContent;
    avatarPreview.textContent = selectedEmoji;
  });
});

// Color picker
colorPicker.querySelectorAll('.color-swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    colorPicker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    swatch.classList.add('selected');
    selectedColor = swatch.dataset.color;
    avatarPreview.style.background = selectedColor;
  });
});

// Create profile submit
addProfileForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = profileNameInput.value.trim();
  if (!name) return;
  try {
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color: selectedColor, emoji: selectedEmoji })
    });
    const data = await res.json();
    if (data.success) {
      addProfileModal.classList.remove('active');
      await renderProfileGrid();
    } else {
      addProfileMsg.textContent = data.error || 'Failed to create profile.';
      addProfileMsg.className = 'upload-msg error';
    }
  } catch {
    addProfileMsg.textContent = 'Network error. Try again.';
    addProfileMsg.className = 'upload-msg error';
  }
});

// ===== STATE =====
let allMedia = [];
let activeFilter = 'all';
let currentViewerId = null;

// ===== DOM REFS =====
const uploadModal    = document.getElementById('uploadModal');
const viewerModal    = document.getElementById('viewerModal');
const uploadForm     = document.getElementById('uploadForm');
const fileInput      = document.getElementById('fileInput');
const dropZone       = document.getElementById('dropZone');
const filePreview    = document.getElementById('filePreview');
const titleInput     = document.getElementById('titleInput');
const submitBtn      = document.getElementById('submitBtn');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill   = document.getElementById('progressFill');
const progressText   = document.getElementById('progressText');
const uploadMsg      = document.getElementById('uploadMsg');
const recentRow      = document.getElementById('recentRow');
const videosRow      = document.getElementById('videosRow');
const photosRow      = document.getElementById('photosRow');
const emptyState     = document.getElementById('emptyState');
const recentSection  = document.getElementById('recentSection');
const videosSection  = document.getElementById('videosSection');
const photosSection  = document.getElementById('photosSection');
const viewerContent  = document.getElementById('viewerContent');
const viewerTitle    = document.getElementById('viewerTitle');
const viewerDelete   = document.getElementById('viewerDelete');
const navbar         = document.querySelector('.navbar');

// ===== NAVBAR SCROLL =====
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

// ===== OPEN/CLOSE UPLOAD MODAL =====
function openUpload() {
  uploadModal.classList.add('active');
  resetUploadForm();
}
function closeUpload() {
  uploadModal.classList.remove('active');
}

document.getElementById('openUploadModal').addEventListener('click', openUpload);
document.getElementById('openUploadModal2').addEventListener('click', openUpload);
document.getElementById('openUploadModalEmpty')?.addEventListener('click', openUpload);
document.getElementById('closeUploadModal').addEventListener('click', closeUpload);
uploadModal.addEventListener('click', e => { if (e.target === uploadModal) closeUpload(); });

// ===== NAV FILTER =====
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    link.classList.add('active');
    activeFilter = link.dataset.filter;
    renderRows();
  });
});

// ===== DRAG & DROP =====
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });

function setFile(file) {
  filePreview.style.display = 'block';
  filePreview.innerHTML = '';

  if (file.type.startsWith('image/')) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    filePreview.appendChild(img);
  } else if (file.type.startsWith('video/')) {
    const vid = document.createElement('video');
    vid.src = URL.createObjectURL(file);
    vid.controls = true;
    vid.muted = true;
    filePreview.appendChild(vid);
  }

  const nameEl = document.createElement('div');
  nameEl.className = 'preview-name';
  nameEl.textContent = file.name;
  filePreview.appendChild(nameEl);

  // Pre-fill title from filename (without extension)
  if (!titleInput.value) {
    titleInput.value = file.name.replace(/\.[^.]+$/, '');
  }

  // Put file back into input (for submit)
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;
}

function resetUploadForm() {
  uploadForm.reset();
  filePreview.style.display = 'none';
  filePreview.innerHTML = '';
  uploadProgress.style.display = 'none';
  progressFill.style.width = '0%';
  uploadMsg.textContent = '';
  uploadMsg.className = 'upload-msg';
  submitBtn.disabled = false;
}

// ===== UPLOAD SUBMIT =====
uploadForm.addEventListener('submit', async e => {
  e.preventDefault();

  const file = fileInput.files[0];
  if (!file) {
    showMsg('Please select a file.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', titleInput.value.trim());

  submitBtn.disabled = true;
  uploadProgress.style.display = 'block';
  uploadMsg.textContent = '';

  // XHR for progress tracking
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/upload');

  xhr.upload.addEventListener('progress', e => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      progressFill.style.width = pct + '%';
      progressText.textContent = `Uploading... ${pct}%`;
    }
  });

  xhr.addEventListener('load', () => {
    if (xhr.status === 200) {
      const result = JSON.parse(xhr.responseText);
      allMedia.unshift(result.item);
      renderRows();
      showMsg('Uploaded successfully!', 'success');
      setTimeout(() => closeUpload(), 1200);
    } else {
      let msg = 'Upload failed.';
      try { msg = JSON.parse(xhr.responseText).error || msg; } catch {}
      showMsg(msg, 'error');
      submitBtn.disabled = false;
    }
  });

  xhr.addEventListener('error', () => {
    showMsg('Network error. Please try again.', 'error');
    submitBtn.disabled = false;
  });

  xhr.send(formData);
});

function showMsg(text, type) {
  uploadMsg.textContent = text;
  uploadMsg.className = 'upload-msg ' + type;
}

// ===== LOAD MEDIA =====
async function loadMedia() {
  try {
    const res = await fetch('/api/media');
    const data = await res.json();
    allMedia = data.items || [];
    renderRows();
  } catch (e) {
    console.error('Failed to load media:', e);
  }
}

// ===== RENDER =====
function renderRows() {
  const videos = allMedia.filter(i => i.type === 'video');
  const photos = allMedia.filter(i => i.type === 'photo');
  const recent = allMedia.slice(0, 10);

  const filter = activeFilter;

  // Empty state
  if (allMedia.length === 0) {
    emptyState.style.display = 'block';
    recentSection.classList.add('hidden');
    videosSection.classList.add('hidden');
    photosSection.classList.add('hidden');
    return;
  }
  emptyState.style.display = 'none';

  if (filter === 'all') {
    recentSection.classList.toggle('hidden', recent.length === 0);
    videosSection.classList.toggle('hidden', videos.length === 0);
    photosSection.classList.toggle('hidden', photos.length === 0);
    renderRow(recentRow, recent);
    renderRow(videosRow, videos);
    renderRow(photosRow, photos);
  } else if (filter === 'video') {
    recentSection.classList.add('hidden');
    videosSection.classList.toggle('hidden', videos.length === 0);
    photosSection.classList.add('hidden');
    renderRow(videosRow, videos);
  } else if (filter === 'photo') {
    recentSection.classList.add('hidden');
    videosSection.classList.add('hidden');
    photosSection.classList.toggle('hidden', photos.length === 0);
    renderRow(photosRow, photos);
  }

  // Update hero with latest item
  updateHero(allMedia[0]);
}

function renderRow(container, items) {
  container.innerHTML = '';
  items.forEach(item => {
    const card = createCard(item);
    container.appendChild(card);
  });
}

function createCard(item) {
  const card = document.createElement('div');
  card.className = 'media-card';
  card.dataset.id = item.id;

  const badge = document.createElement('span');
  badge.className = 'card-type-badge';
  badge.textContent = item.type === 'video' ? 'VIDEO' : 'PHOTO';
  card.appendChild(badge);

  if (item.type === 'photo') {
    const img = document.createElement('img');
    img.src = item.url;
    img.alt = item.title;
    img.loading = 'lazy';
    card.appendChild(img);

    const playIcon = document.createElement('div');
    playIcon.className = 'card-play-icon';
    playIcon.textContent = '🔍';
    card.appendChild(playIcon);
  } else {
    const vid = document.createElement('video');
    vid.src = item.url;
    vid.muted = true;
    vid.preload = 'metadata';
    card.appendChild(vid);

    // Hover: play preview
    card.addEventListener('mouseenter', () => { vid.play().catch(() => {}); });
    card.addEventListener('mouseleave', () => { vid.pause(); vid.currentTime = 0; });

    const playIcon = document.createElement('div');
    playIcon.className = 'card-play-icon';
    playIcon.textContent = '▶';
    card.appendChild(playIcon);
  }

  const overlay = document.createElement('div');
  overlay.className = 'card-overlay';
  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = item.title;
  overlay.appendChild(title);
  card.appendChild(overlay);

  card.addEventListener('click', () => openViewer(item));
  return card;
}

// ===== HERO UPDATE =====
function updateHero(item) {
  const hero = document.getElementById('hero');
  if (!item) return;

  if (item.type === 'photo') {
    hero.style.backgroundImage = `url(${item.url})`;
    hero.style.backgroundSize = 'cover';
    hero.style.backgroundPosition = 'center';
  }

  document.getElementById('heroPlay').onclick = () => openViewer(item);
}

// ===== VIEWER =====
function openViewer(item) {
  currentViewerId = item.id;
  viewerTitle.textContent = item.title;
  viewerContent.innerHTML = '';

  if (item.type === 'photo') {
    const img = document.createElement('img');
    img.src = item.url;
    img.alt = item.title;
    viewerContent.appendChild(img);
  } else {
    const vid = document.createElement('video');
    vid.src = item.url;
    vid.controls = true;
    vid.autoplay = true;
    viewerContent.appendChild(vid);
  }

  viewerModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeViewer() {
  // Stop any playing video
  const vid = viewerContent.querySelector('video');
  if (vid) { vid.pause(); vid.src = ''; }
  viewerModal.classList.remove('active');
  document.body.style.overflow = '';
  currentViewerId = null;
}

document.getElementById('viewerClose').addEventListener('click', closeViewer);
viewerModal.addEventListener('click', e => {
  if (e.target === viewerModal) closeViewer();
});

// ESC key closes modals
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeViewer();
    closeUpload();
  }
});

// ===== DELETE =====
viewerDelete.addEventListener('click', async () => {
  if (!currentViewerId) return;
  if (!confirm('Delete this media permanently?')) return;

  try {
    const res = await fetch(`/api/media/${currentViewerId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      allMedia = allMedia.filter(i => i.id !== currentViewerId);
      closeViewer();
      renderRows();
    }
  } catch (e) {
    alert('Delete failed. Please try again.');
  }
});

// ===== INIT =====
initApp();
