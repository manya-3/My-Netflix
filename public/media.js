'use strict';

// ── STATE ─────────────────────────────────────────────────
let items = [];
let currentView = 'home';
let photoList = [];
let photoIndex = 0;
let heroMuted = true;
let isSeeking = false;
let ctrlHideTimer = null;
let currentVideoItem = null;

// ── AUTH ──────────────────────────────────────────────────
const profile = JSON.parse(sessionStorage.getItem('netflix_profile') || 'null');
if (sessionStorage.getItem('netflix_auth') !== '1' || !profile || !profile.id) {
  window.location.href = '/';
}

// ── DOM ───────────────────────────────────────────────────
const mainNav       = document.getElementById('mainNav');
const homeView      = document.getElementById('homeView');
const libraryView   = document.getElementById('libraryView');
const photoViewer   = document.getElementById('photoViewer');
const videoPlayer   = document.getElementById('videoPlayer');
const uploadModal   = document.getElementById('uploadModal');
const backBtn       = document.getElementById('backBtn');
const heroVideo     = document.getElementById('heroVideo');
const heroImage     = document.getElementById('heroImage');
const heroTitleEl   = document.getElementById('heroTitle');
const heroMetaEl    = document.getElementById('heroMeta');
const heroPlayBtn   = document.getElementById('heroPlayBtn');
const heroUploadBtn = document.getElementById('heroUploadBtn');
const heroMuteBtn   = document.getElementById('heroMuteBtn');
const heroMuteIcon  = document.getElementById('heroMuteIcon');
const recentSection = document.getElementById('recentSection');
const videosSection = document.getElementById('videosSection');
const photosSection = document.getElementById('photosSection');
const favsSection   = document.getElementById('favsSection');
const recentRow     = document.getElementById('recentRow');
const videosRow     = document.getElementById('videosRow');
const photosRow     = document.getElementById('photosRow');
const favsRow       = document.getElementById('favsRow');
const emptyHome     = document.getElementById('emptyHome');
const libraryTitle  = document.getElementById('libraryTitle');
const libraryGrid   = document.getElementById('libraryGrid');
const emptyLibrary  = document.getElementById('emptyLibrary');
const emptyLibMsg   = document.getElementById('emptyLibMsg');
const photoDisplay  = document.getElementById('photoDisplay');
const photoTitleLbl = document.getElementById('photoTitleLbl');
const photoFavBtn   = document.getElementById('photoFavBtn');
const photoDeleteBtn= document.getElementById('photoDeleteBtn');
const playerVid     = document.getElementById('playerVid');
const ctrlWrap      = document.getElementById('ctrlWrap');
const playerTitleLbl= document.getElementById('playerTitleLbl');
const timeCur       = document.getElementById('timeCur');
const timeDur       = document.getElementById('timeDur');
const progBar       = document.getElementById('progBar');
const progFill      = document.getElementById('progFill');
const progHandle    = document.getElementById('progHandle');
const ctrlPlay      = document.getElementById('ctrlPlay');
const ctrlRew       = document.getElementById('ctrlRew');
const ctrlFwd       = document.getElementById('ctrlFwd');
const ctrlMute      = document.getElementById('ctrlMute');
const volSlider     = document.getElementById('volSlider');
const ctrlSpeed     = document.getElementById('ctrlSpeed');
const ctrlVidFav    = document.getElementById('ctrlVidFav');
const ctrlVidDelete = document.getElementById('ctrlVidDelete');
const ctrlFullscreen= document.getElementById('ctrlFullscreen');
const uploadForm    = document.getElementById('uploadForm');
const fileInput     = document.getElementById('fileInput');
const titleInput    = document.getElementById('titleInput');
const uploadMsg     = document.getElementById('uploadMsg');
const submitUpload  = document.getElementById('submitUpload');

// ── INIT ─────────────────────────────────────────────────
document.getElementById('profileName').textContent = profile.name;
loadMedia();

// ── NAV SCROLL ───────────────────────────────────────────
window.addEventListener('scroll', () => {
  mainNav.classList.toggle('solid', window.scrollY > 50);
});

// ── TABS ─────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const v = tab.dataset.view;
    if (v === 'home') showHome();
    else showLibrary(v);
  });
});

backBtn.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-view="home"]').classList.add('active');
  showHome();
});

// ── VIEWS ─────────────────────────────────────────────────
function showHome() {
  currentView = 'home';
  homeView.classList.remove('nf-hidden');
  libraryView.classList.add('nf-hidden');
  photoViewer.classList.add('nf-hidden');
  videoPlayer.classList.add('nf-hidden');
  backBtn.classList.add('nf-hidden');
  document.body.style.overflow = '';
  renderHero(items);
  renderRows(items);
}

function showLibrary(type) {
  currentView = type;
  homeView.classList.add('nf-hidden');
  libraryView.classList.remove('nf-hidden');
  photoViewer.classList.add('nf-hidden');
  videoPlayer.classList.add('nf-hidden');
  backBtn.classList.remove('nf-hidden');
  document.body.style.overflow = '';

  let filtered;
  if (type === 'photos') {
    filtered = items.filter(i => i.type === 'photo');
    libraryTitle.textContent = 'Photos';
  } else if (type === 'videos') {
    filtered = items.filter(i => i.type === 'video');
    libraryTitle.textContent = 'Videos';
  } else {
    filtered = items.filter(i => i.isFavorite);
    libraryTitle.textContent = "My Fav's";
  }

  renderGrid(filtered, filtered);
  emptyLibrary.classList.toggle('nf-hidden', filtered.length > 0);
  if (filtered.length === 0) {
    emptyLibMsg.textContent =
      type === 'favs' ? 'No favorites yet. Click the heart on any photo or video.' :
      'No ' + type + ' uploaded yet.';
  }
}

// ── LOAD MEDIA ───────────────────────────────────────────
async function loadMedia() {
  try {
    const res = await fetch('/api/media');
    const data = await res.json();
    items = (data.items || []).map(item => ({
      ...item,
      isFavorite: !!item.isFavorite
    }));
  } catch (e) {
    items = [];
  }
  showHome();
}

// ── HERO ─────────────────────────────────────────────────
function renderHero(all) {
  const featured = all.find(i => i.type === 'video') || all[0] || null;
  if (!featured) {
    heroTitleEl.textContent = profile.name + "'s Collection";
    heroMetaEl.textContent  = 'Upload your first photo or video to get started.';
    heroVideo.src = ''; heroImage.src = '';
    heroImage.classList.add('nf-hidden');
    heroMuteBtn.classList.add('nf-hidden');
    heroPlayBtn.onclick = null;
    return;
  }
  heroTitleEl.textContent = featured.title || featured.originalname || profile.name + "'s Collection";
  heroMetaEl.textContent  = featured.type === 'video' ? '▶ Video' : '📷 Photo';

  if (featured.type === 'video') {
    heroVideo.src = featured.url;
    heroVideo.muted = true; heroVideo.loop = true;
    heroVideo.play().catch(() => {});
    heroImage.classList.add('nf-hidden');
    heroMuteBtn.classList.remove('nf-hidden');
    heroMuteIcon.textContent = '🔇';
    heroMuted = true;
  } else {
    heroVideo.pause(); heroVideo.src = '';
    heroImage.src = featured.url;
    heroImage.classList.remove('nf-hidden');
    heroMuteBtn.classList.add('nf-hidden');
  }

  heroPlayBtn.onclick = () => {
    if (featured.type === 'video') {
      openVideoPlayer(featured);
    } else {
      const photos = all.filter(i => i.type === 'photo');
      openPhotoViewer(photos, 0);
    }
  };
}

heroMuteBtn.addEventListener('click', () => {
  heroMuted = !heroMuted;
  heroVideo.muted = heroMuted;
  heroMuteIcon.textContent = heroMuted ? '🔇' : '🔊';
});

// ── ROWS ─────────────────────────────────────────────────
function renderRows(all) {
  const videos = all.filter(i => i.type === 'video');
  const photos = all.filter(i => i.type === 'photo');
  const recent = all.slice(0, 12);
  const favs   = all.filter(i => i.isFavorite);

  emptyHome.classList.toggle('nf-hidden', all.length > 0);
  fillRow(recentRow, recent, all); recentSection.classList.toggle('nf-hidden', recent.length === 0);
  fillRow(videosRow, videos, all); videosSection.classList.toggle('nf-hidden', videos.length === 0);
  fillRow(photosRow, photos, all); photosSection.classList.toggle('nf-hidden', photos.length === 0);
  fillRow(favsRow,   favs,   all); favsSection.classList.toggle('nf-hidden', favs.length === 0);
}

function fillRow(container, arr, ctx) {
  container.innerHTML = '';
  arr.forEach(item => container.appendChild(createCard(item, ctx)));
}

function renderGrid(arr, ctx) {
  libraryGrid.innerHTML = '';
  arr.forEach(item => libraryGrid.appendChild(createCard(item, ctx)));
}

// ── CREATE CARD ───────────────────────────────────────────
function createCard(item, ctx) {
  const card  = document.createElement('div');
  card.className = 'card';

  const thumb = document.createElement('div');
  thumb.className = 'card-thumb';

  if (item.type === 'photo') {
    const img = document.createElement('img');
    img.src = item.url; img.alt = item.title || 'Photo'; img.loading = 'lazy';
    thumb.appendChild(img);
  } else {
    const vid = document.createElement('video');
    vid.src = item.url; vid.muted = true; vid.preload = 'metadata';
    thumb.appendChild(vid);
    card.addEventListener('mouseenter', () => vid.play().catch(() => {}));
    card.addEventListener('mouseleave', () => { vid.pause(); vid.currentTime = 0; });
  }

  const info = document.createElement('div'); info.className = 'card-info';
  const t    = document.createElement('div'); t.className = 'card-title';
  t.textContent = item.title || item.originalname || 'Untitled';
  const ty   = document.createElement('div'); ty.className = 'card-type';
  ty.textContent = item.type === 'video' ? 'Video' : 'Photo';
  info.appendChild(t); info.appendChild(ty);

  const fav = document.createElement('button');
  fav.className = 'fav-btn' + (item.isFavorite ? ' fav-active' : '');
  fav.innerHTML = '&#10084;'; fav.title = 'Toggle Favorite';
  fav.addEventListener('click', async e => {
    e.stopPropagation();
    await toggleFavorite(item.id);
    const updated = items.find(i => i.id === item.id);
    fav.classList.toggle('fav-active', !!(updated && updated.isFavorite));
  });

  const del = document.createElement('button');
  del.className = 'card-delete-btn';
  del.type = 'button';
  del.textContent = 'Delete';
  del.title = 'Delete this media';
  del.addEventListener('click', async e => {
    e.stopPropagation();
    const ok = window.confirm('Delete this media? This cannot be undone.');
    if (!ok) return;
    await deleteMedia(item.id);
  });

  card.appendChild(thumb); card.appendChild(info); card.appendChild(fav); card.appendChild(del);

  card.addEventListener('click', () => {
    if (item.type === 'photo') {
      const photoCtx = (ctx || items).filter(i => i.type === 'photo');
      const idx = photoCtx.findIndex(i => i.id === item.id);
      openPhotoViewer(photoCtx, idx >= 0 ? idx : 0);
    } else {
      openVideoPlayer(item);
    }
  });

  return card;
}

// ── FAVORITES ────────────────────────────────────────────
async function toggleFavorite(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  const nextValue = !item.isFavorite;

  try {
    const res = await fetch('/api/media/' + encodeURIComponent(id) + '/favorite', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite: nextValue })
    });

    if (!res.ok) {
      alert('Could not update favorite. Try again.');
      return;
    }

    items = items.map(i => (i.id === id ? { ...i, isFavorite: nextValue } : i));
    photoList = photoList.map(i => (i.id === id ? { ...i, isFavorite: nextValue } : i));
    if (currentVideoItem && currentVideoItem.id === id) {
      currentVideoItem = { ...currentVideoItem, isFavorite: nextValue };
    }
  } catch {
    alert('Could not update favorite. Try again.');
    return;
  }

  if (currentView === 'home') {
    const favs = items.filter(i => i.isFavorite);
    fillRow(favsRow, favs, items);
    favsSection.classList.toggle('nf-hidden', favs.length === 0);
  }
  if (currentView === 'favs') showLibrary('favs');
}

async function deleteMedia(id) {
  try {
    const res = await fetch('/api/media/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!res.ok) {
      alert('Delete failed. Try again.');
      return;
    }

    if (currentVideoItem && currentVideoItem.id === id) {
      playerVid.pause();
      playerVid.src = '';
      videoPlayer.classList.add('nf-hidden');
      document.body.style.overflow = '';
      currentVideoItem = null;
    }

    const currentPhoto = photoList[photoIndex];
    if (currentPhoto && currentPhoto.id === id) {
      photoViewer.classList.add('nf-hidden');
      document.body.style.overflow = '';
    }

    await loadMedia();
    if (currentView !== 'home') showLibrary(currentView);
  } catch {
    alert('Delete failed. Try again.');
  }
}

// ── PHOTO VIEWER ─────────────────────────────────────────
function openPhotoViewer(list, index) {
  photoList = list; photoIndex = index;
  photoViewer.classList.remove('nf-hidden');
  document.body.style.overflow = 'hidden';
  renderPhoto();
}

function renderPhoto() {
  const item = photoList[photoIndex]; if (!item) return;
  photoDisplay.innerHTML = '';
  const img = document.createElement('img');
  img.src = item.url; img.alt = item.title || 'Photo';
  photoDisplay.appendChild(img);
  photoTitleLbl.textContent = item.title || item.originalname || 'Untitled';
  document.getElementById('photoCounter').textContent =
    (photoIndex + 1) + ' / ' + photoList.length;
  photoFavBtn.className = 'fav-circle' + (item.isFavorite ? ' fav-active' : '');
  document.getElementById('photoPrev').classList.toggle('nf-hidden', photoIndex === 0);
  document.getElementById('photoNext').classList.toggle('nf-hidden', photoIndex === photoList.length - 1);
}

document.getElementById('photoBack').addEventListener('click', () => {
  photoViewer.classList.add('nf-hidden'); document.body.style.overflow = '';
});
document.getElementById('photoPrev').addEventListener('click', () => {
  if (photoIndex > 0) { photoIndex--; renderPhoto(); }
});
document.getElementById('photoNext').addEventListener('click', () => {
  if (photoIndex < photoList.length - 1) { photoIndex++; renderPhoto(); }
});
photoFavBtn.addEventListener('click', async () => {
  const item = photoList[photoIndex]; if (!item) return;
  await toggleFavorite(item.id);
  const updated = items.find(i => i.id === item.id);
  photoFavBtn.className = 'fav-circle' + ((updated && updated.isFavorite) ? ' fav-active' : '');
});

photoDeleteBtn.addEventListener('click', async () => {
  const item = photoList[photoIndex];
  if (!item) return;
  const ok = window.confirm('Delete this photo? This cannot be undone.');
  if (!ok) return;
  await deleteMedia(item.id);
});

// ── VIDEO PLAYER ─────────────────────────────────────────
function openVideoPlayer(item) {
  currentVideoItem = item;
  playerVid.src = item.url;
  playerTitleLbl.textContent = item.title || item.originalname || 'Video';
  videoPlayer.classList.remove('nf-hidden');
  document.body.style.overflow = 'hidden';
  playerVid.play().catch(() => {});
  ctrlPlay.textContent = '⏸';
  syncVidFavBtn();
  showCtrls();
}

function syncVidFavBtn() {
  if (!currentVideoItem) return;
  ctrlVidFav.classList.toggle('fav-active', !!currentVideoItem.isFavorite);
}

document.getElementById('playerBack').addEventListener('click', () => {
  playerVid.pause(); playerVid.src = '';
  videoPlayer.classList.add('nf-hidden'); document.body.style.overflow = '';
});

ctrlPlay.addEventListener('click', () => {
  if (playerVid.paused) { playerVid.play(); ctrlPlay.textContent = '⏸'; }
  else { playerVid.pause(); ctrlPlay.textContent = '▶'; }
});
document.getElementById('ctrlClickZone').addEventListener('click', () => ctrlPlay.click());

ctrlRew.addEventListener('click', () => { playerVid.currentTime = Math.max(0, playerVid.currentTime - 10); });
ctrlFwd.addEventListener('click', () => { playerVid.currentTime = Math.min(playerVid.duration || 0, playerVid.currentTime + 10); });

ctrlMute.addEventListener('click', () => {
  playerVid.muted = !playerVid.muted;
  ctrlMute.textContent = playerVid.muted ? '🔇' : '🔊';
  if (!playerVid.muted) volSlider.value = playerVid.volume;
});
volSlider.addEventListener('input', () => {
  playerVid.volume = parseFloat(volSlider.value);
  playerVid.muted  = playerVid.volume === 0;
  ctrlMute.textContent = playerVid.muted ? '🔇' : '🔊';
});

ctrlSpeed.addEventListener('change', () => { playerVid.playbackRate = parseFloat(ctrlSpeed.value); });

ctrlFullscreen.addEventListener('click', () => {
  if (!document.fullscreenElement) videoPlayer.requestFullscreen().catch(() => {});
  else document.exitFullscreen();
});

ctrlVidFav.addEventListener('click', async () => {
  if (!currentVideoItem) return;
  await toggleFavorite(currentVideoItem.id);
  syncVidFavBtn();
});

ctrlVidDelete.addEventListener('click', async () => {
  if (!currentVideoItem) return;
  const ok = window.confirm('Delete this video? This cannot be undone.');
  if (!ok) return;
  await deleteMedia(currentVideoItem.id);
});

// Progress
playerVid.addEventListener('timeupdate', () => {
  if (isSeeking || isNaN(playerVid.duration)) return;
  const pct = playerVid.currentTime / playerVid.duration;
  progFill.style.width = (pct * 100) + '%';
  progHandle.style.left = (pct * 100) + '%';
  timeCur.textContent = fmtTime(playerVid.currentTime);
});
playerVid.addEventListener('loadedmetadata', () => { timeDur.textContent = fmtTime(playerVid.duration); });
playerVid.addEventListener('ended', () => { ctrlPlay.textContent = '▶'; });

function fmtTime(s) {
  if (isNaN(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

function seekTo(e) {
  const rect = progBar.getBoundingClientRect();
  const pct  = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  playerVid.currentTime = pct * (playerVid.duration || 0);
  progFill.style.width  = (pct * 100) + '%';
  progHandle.style.left = (pct * 100) + '%';
  timeCur.textContent   = fmtTime(playerVid.currentTime);
}
progBar.addEventListener('mousedown', e => { isSeeking = true; seekTo(e); });
document.addEventListener('mousemove', e => { if (isSeeking) seekTo(e); });
document.addEventListener('mouseup',   () => { isSeeking = false; });
progBar.addEventListener('touchstart', e => {
  const touch = e.touches[0];
  const rect  = progBar.getBoundingClientRect();
  const pct   = Math.min(1, Math.max(0, (touch.clientX - rect.left) / rect.width));
  playerVid.currentTime = pct * (playerVid.duration || 0);
}, { passive: true });

// Auto-hide controls
function showCtrls() {
  ctrlWrap.classList.add('show');
  clearTimeout(ctrlHideTimer);
  ctrlHideTimer = setTimeout(() => { if (!playerVid.paused) ctrlWrap.classList.remove('show'); }, 3000);
}
videoPlayer.addEventListener('mousemove', showCtrls);
videoPlayer.addEventListener('touchstart', showCtrls, { passive: true });

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (!videoPlayer.classList.contains('nf-hidden')) {
    if (e.key === ' ') { e.preventDefault(); ctrlPlay.click(); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); ctrlRew.click(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); ctrlFwd.click(); }
    if (e.key === 'm' || e.key === 'M') ctrlMute.click();
    if (e.key === 'f' || e.key === 'F') ctrlFullscreen.click();
    if (e.key === 'Escape') document.getElementById('playerBack').click();
    showCtrls();
  }
  if (!photoViewer.classList.contains('nf-hidden')) {
    if (e.key === 'ArrowLeft')  document.getElementById('photoPrev').click();
    if (e.key === 'ArrowRight') document.getElementById('photoNext').click();
    if (e.key === 'Escape')     document.getElementById('photoBack').click();
  }
});

// ── ROW SCROLL ARROWS ────────────────────────────────────
document.querySelectorAll('.row-arrow').forEach(btn => {
  btn.addEventListener('click', () => {
    const row = document.getElementById(btn.dataset.row);
    if (row) row.scrollBy({ left: (btn.classList.contains('arr-left') ? -1 : 1) * 450, behavior: 'smooth' });
  });
});

// ── UPLOAD ───────────────────────────────────────────────
function openUpload()  { uploadModal.classList.remove('nf-hidden'); uploadForm.reset(); uploadMsg.textContent = ''; submitUpload.disabled = false; }
function closeUpload() { uploadModal.classList.add('nf-hidden'); }

document.getElementById('uploadBtn').addEventListener('click', openUpload);
heroUploadBtn.addEventListener('click', openUpload);
document.getElementById('emptyHomeUpload').addEventListener('click', openUpload);
document.getElementById('cancelUpload').addEventListener('click', closeUpload);
uploadModal.addEventListener('click', e => { if (e.target === uploadModal) closeUpload(); });

uploadForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!fileInput.files[0]) { uploadMsg.textContent = 'Choose a file first.'; return; }
  const fd = new FormData();
  fd.append('file', fileInput.files[0]);
  fd.append('title', titleInput.value.trim());
  fd.append('profileId', profile.id);
  submitUpload.disabled = true;
  uploadMsg.textContent = 'Uploading...';
  try {
    const res  = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) uploadMsg.textContent = data.error || 'Upload failed.';
    else { closeUpload(); await loadMedia(); }
  } catch { uploadMsg.textContent = 'Upload failed. Try again.'; }
  finally { submitUpload.disabled = false; }
});

// ── SIGN OUT / SWITCH ────────────────────────────────────
document.getElementById('switchProfileBtn').addEventListener('click', () => {
  sessionStorage.removeItem('netflix_profile'); window.location.href = '/home.html';
});
document.getElementById('signoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem('netflix_auth'); sessionStorage.removeItem('netflix_profile'); window.location.href = '/';
});