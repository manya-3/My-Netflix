const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Allow persistent storage root on cloud hosts (for example, a mounted disk).
const storageRoot = process.env.DATA_ROOT
  ? path.resolve(process.env.DATA_ROOT)
  : __dirname;
const uploadsDir = path.join(storageRoot, 'uploads');
const dataDir = path.join(storageRoot, 'data');
const dataFile = path.join(dataDir, 'media.json');
const profilesFile = path.join(dataDir, 'profiles.json');

[path.join(uploadsDir, 'videos'), path.join(uploadsDir, 'photos'), dataDir].forEach(fullPath => {
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify({ items: [] }, null, 2));
}
if (!fs.existsSync(profilesFile)) {
  fs.writeFileSync(profilesFile, JSON.stringify({ profiles: [] }, null, 2));
}

// Password (stored server-side)
const APP_PASSWORD = process.env.APP_PASSWORD || '030505';

function normalizePassword(value) {
  // Handles pasted values that may include non-standard spaces or unicode variants.
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .trim();
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isVideo = file.mimetype.startsWith('video/');
    cb(null, isVideo ? path.join(uploadsDir, 'videos') : path.join(uploadsDir, 'photos'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp',
                   'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (jpg, png, gif, webp) and videos (mp4, webm, ogg, mov, avi) are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB max
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));
app.use(express.json());

// Helper: read/write media data
function readData() {
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}
function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

// Helper: read/write profiles
function readProfiles() {
  return JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
}
function writeProfiles(data) {
  fs.writeFileSync(profilesFile, JSON.stringify(data, null, 2));
}

// POST verify password
app.post('/api/auth', (req, res) => {
  const providedPassword = normalizePassword(req.body && req.body.password);
  const expectedPassword = normalizePassword(APP_PASSWORD);

  if (providedPassword === expectedPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Incorrect password.' });
  }
});

// GET all profiles
app.get('/api/profiles', (req, res) => {
  try {
    res.json(readProfiles());
  } catch (e) {
    res.status(500).json({ error: 'Failed to read profiles.' });
  }
});

// POST create profile
app.post('/api/profiles', (req, res) => {
  try {
    const { name, color, emoji } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
    const profile = {
      id: uuidv4(),
      name: name.trim().slice(0, 30),
      color: color || '#e50914',
      emoji: emoji || '😊',
      createdAt: new Date().toISOString()
    };
    const data = readProfiles();
    if (data.profiles.length >= 5) return res.status(400).json({ error: 'Maximum 5 profiles allowed.' });
    data.profiles.push(profile);
    writeProfiles(data);
    res.json({ success: true, profile });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create profile.' });
  }
});

// DELETE profile
app.delete('/api/profiles/:id', (req, res) => {
  try {
    const data = readProfiles();
    const idx = data.profiles.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Profile not found.' });
    data.profiles.splice(idx, 1);
    writeProfiles(data);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete profile.' });
  }
});
app.get('/api/media', (req, res) => {
  try {
    const profileId = String(req.query.profileId || '').trim();
    const data = readData();

    if (!profileId) {
      return res.json(data);
    }

    const filtered = data.items.filter(item => item.profileId === profileId);
    res.json({ items: filtered });
  } catch (e) {
    res.status(500).json({ error: 'Failed to read media data.' });
  }
});

// POST upload media
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const profileId = String(req.body.profileId || '').trim();
    if (!profileId) return res.status(400).json({ error: 'Profile is required for upload.' });

    const isVideo = req.file.mimetype.startsWith('video/');
    const type = isVideo ? 'video' : 'photo';
    const subDir = isVideo ? 'videos' : 'photos';

    const item = {
      id: uuidv4(),
      title: req.body.title || path.basename(req.file.originalname, path.extname(req.file.originalname)),
      type,
      isFavorite: false,
      profileId,
      filename: req.file.filename,
      originalname: req.file.originalname,
      url: `/uploads/${subDir}/${req.file.filename}`,
      size: req.file.size,
      uploadedAt: new Date().toISOString()
    };

    const data = readData();
    data.items.unshift(item);
    writeData(data);

    res.json({ success: true, item });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed: ' + e.message });
  }
});

// PATCH toggle favorite (server-side, shared across devices)
app.patch('/api/media/:id/favorite', (req, res) => {
  try {
    const data = readData();
    const item = data.items.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found.' });

    item.isFavorite = !!(req.body && req.body.isFavorite);
    writeData(data);

    res.json({ success: true, item });
  } catch (e) {
    res.status(500).json({ error: 'Favorite update failed: ' + e.message });
  }
});

// DELETE media
app.delete('/api/media/:id', (req, res) => {
  try {
    const data = readData();
    const idx = data.items.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found.' });

    const item = data.items[idx];
    const subDir = item.type === 'video' ? 'videos' : 'photos';
    const filePath = path.join(uploadsDir, subDir, item.filename);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    data.items.splice(idx, 1);
    writeData(data);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Delete failed: ' + e.message });
  }
});

// Error handler for multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`My Netflix is running at http://localhost:${PORT}`);
});
