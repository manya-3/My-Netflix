const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { MongoClient } = require('mongodb');
const { v2: cloudinary } = require('cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || '030505';

const MONGO_URI = (process.env.MONGO_URI || '').trim();
const MONGO_DB_NAME = (process.env.MONGO_DB_NAME || 'my_netflix').trim();
const CLOUDINARY_CLOUD_NAME = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
const CLOUDINARY_API_KEY = (process.env.CLOUDINARY_API_KEY || '').trim();
const CLOUDINARY_API_SECRET = (process.env.CLOUDINARY_API_SECRET || '').trim();

const hasMongo = !!MONGO_URI;
const hasCloudinary = !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
const useCloudStorage = hasMongo && hasCloudinary;

// Allow persistent storage root on cloud hosts (for example, a mounted disk).
const storageRoot = process.env.DATA_ROOT
  ? path.resolve(process.env.DATA_ROOT)
  : __dirname;
const uploadsDir = path.join(storageRoot, 'uploads');
const dataDir = path.join(storageRoot, 'data');
const dataFile = path.join(dataDir, 'media.json');
const profilesFile = path.join(dataDir, 'profiles.json');

if (!useCloudStorage) {
  [path.join(uploadsDir, 'videos'), path.join(uploadsDir, 'photos')].forEach(fullPath => {
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
  });
}

if (!hasMongo) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ items: [] }, null, 2));
  }
  if (!fs.existsSync(profilesFile)) {
    fs.writeFileSync(profilesFile, JSON.stringify({ profiles: [] }, null, 2));
  }
}

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
  });
}

let mongoClient = null;
let profilesCol = null;
let mediaCol = null;

function normalizePassword(value) {
  // Handles pasted values that may include non-standard spaces or unicode variants.
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .trim();
}

// Multer storage config
const storage = useCloudStorage
  ? multer.memoryStorage()
  : multer.diskStorage({
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

function normalizeMedia(item) {
  return {
    ...item,
    isFavorite: !!item.isFavorite
  };
}

async function initDataLayer() {
  if (hasMongo) {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();

    const db = mongoClient.db(MONGO_DB_NAME);
    profilesCol = db.collection('profiles');
    mediaCol = db.collection('media');

    await profilesCol.createIndex({ id: 1 }, { unique: true });
    await mediaCol.createIndex({ id: 1 }, { unique: true });
    await mediaCol.createIndex({ profileId: 1, uploadedAt: -1 });
  }
}

async function getProfilesData() {
  if (!hasMongo) {
    return readProfiles().profiles || [];
  }
  const docs = await profilesCol.find({}, { projection: { _id: 0 } }).sort({ createdAt: 1 }).toArray();
  return docs;
}

async function createProfileData(profile) {
  if (!hasMongo) {
    const data = readProfiles();
    if ((data.profiles || []).length >= 5) return { error: 'Maximum 5 profiles allowed.' };
    data.profiles.push(profile);
    writeProfiles(data);
    return { profile };
  }

  const count = await profilesCol.countDocuments({});
  if (count >= 5) return { error: 'Maximum 5 profiles allowed.' };
  await profilesCol.insertOne(profile);
  return { profile };
}

async function getMediaData(profileId) {
  if (!hasMongo) {
    const data = readData();
    const source = data.items || [];
    const filtered = profileId ? source.filter(item => item.profileId === profileId) : source;
    return filtered.map(normalizeMedia);
  }

  const query = profileId ? { profileId } : {};
  const docs = await mediaCol.find(query, { projection: { _id: 0 } }).sort({ uploadedAt: -1 }).toArray();
  return docs.map(normalizeMedia);
}

function deleteLocalFile(item) {
  if (!item || !item.filename) return;
  const subDir = item.type === 'video' ? 'videos' : 'photos';
  const filePath = path.join(uploadsDir, subDir, item.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

async function deleteCloudAsset(item) {
  if (!item || !item.cloudinaryPublicId) return;
  const resourceType = item.cloudinaryResourceType || (item.type === 'video' ? 'video' : 'image');
  try {
    await cloudinary.uploader.destroy(item.cloudinaryPublicId, { resource_type: resourceType });
  } catch {
    // ignore cloud deletion failures to keep metadata delete flow resilient
  }
}

async function deleteProfileData(profileId) {
  if (!hasMongo) {
    const profileData = readProfiles();
    const profileIdx = profileData.profiles.findIndex(p => p.id === profileId);
    if (profileIdx === -1) return { notFound: true };
    profileData.profiles.splice(profileIdx, 1);
    writeProfiles(profileData);

    const mediaData = readData();
    const keepItems = [];
    for (const item of mediaData.items || []) {
      if (item.profileId === profileId) deleteLocalFile(item);
      else keepItems.push(item);
    }
    mediaData.items = keepItems;
    writeData(mediaData);

    return { success: true };
  }

  const profile = await profilesCol.findOne({ id: profileId }, { projection: { _id: 0 } });
  if (!profile) return { notFound: true };

  const profileMedia = await mediaCol.find({ profileId }, { projection: { _id: 0 } }).toArray();
  if (useCloudStorage) {
    for (const item of profileMedia) await deleteCloudAsset(item);
  } else {
    for (const item of profileMedia) deleteLocalFile(item);
  }

  await mediaCol.deleteMany({ profileId });
  await profilesCol.deleteOne({ id: profileId });
  return { success: true };
}

async function uploadToCloudinary(file, type) {
  const folder = type === 'video' ? 'my-netflix/videos' : 'my-netflix/photos';

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        public_id: uuidv4(),
        overwrite: false
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(file.buffer);
  });
}

async function saveMediaItem(item) {
  if (!hasMongo) {
    const data = readData();
    data.items.unshift(item);
    writeData(data);
    return;
  }
  await mediaCol.insertOne(item);
}

async function setFavorite(itemId, profileId, isFavorite) {
  if (!hasMongo) {
    const data = readData();
    const item = (data.items || []).find(i => i.id === itemId);
    if (!item) return { notFound: true };
    if (profileId && item.profileId !== profileId) return { forbidden: true };
    item.isFavorite = !!isFavorite;
    writeData(data);
    return { item: normalizeMedia(item) };
  }

  const item = await mediaCol.findOne({ id: itemId }, { projection: { _id: 0 } });
  if (!item) return { notFound: true };
  if (profileId && item.profileId !== profileId) return { forbidden: true };

  await mediaCol.updateOne({ id: itemId }, { $set: { isFavorite: !!isFavorite } });
  return { item: normalizeMedia({ ...item, isFavorite: !!isFavorite }) };
}

async function deleteMediaItem(itemId, profileId) {
  if (!hasMongo) {
    const data = readData();
    const idx = (data.items || []).findIndex(i => i.id === itemId);
    if (idx === -1) return { notFound: true };

    const item = data.items[idx];
    if (profileId && item.profileId !== profileId) return { forbidden: true };

    deleteLocalFile(item);
    data.items.splice(idx, 1);
    writeData(data);
    return { success: true };
  }

  const item = await mediaCol.findOne({ id: itemId }, { projection: { _id: 0 } });
  if (!item) return { notFound: true };
  if (profileId && item.profileId !== profileId) return { forbidden: true };

  if (useCloudStorage) await deleteCloudAsset(item);
  else deleteLocalFile(item);

  await mediaCol.deleteOne({ id: itemId });
  return { success: true };
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
  getProfilesData().then((profiles) => {
    res.json({ profiles });
  }).catch(() => {
    res.status(500).json({ error: 'Failed to read profiles.' });
  });
});

// POST create profile
app.post('/api/profiles', async (req, res) => {
  const { name, color, emoji } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });

  const profile = {
    id: uuidv4(),
    name: name.trim().slice(0, 30),
    color: color || '#e50914',
    emoji: emoji || '😊',
    createdAt: new Date().toISOString()
  };

  try {
    const result = await createProfileData(profile);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ success: true, profile });
  } catch {
    res.status(500).json({ error: 'Failed to create profile.' });
  }
});

// DELETE profile
app.delete('/api/profiles/:id', async (req, res) => {
  try {
    const result = await deleteProfileData(req.params.id);
    if (result.notFound) return res.status(404).json({ error: 'Profile not found.' });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete profile.' });
  }
});
app.get('/api/media', (req, res) => {
  const profileId = String(req.query.profileId || '').trim();
  getMediaData(profileId).then((items) => {
    res.json({ items });
  }).catch(() => {
    res.status(500).json({ error: 'Failed to read media data.' });
  });
});

// POST upload media
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const profileId = String(req.body.profileId || '').trim();
    if (!profileId) return res.status(400).json({ error: 'Profile is required for upload.' });

    const isVideo = req.file.mimetype.startsWith('video/');
    const type = isVideo ? 'video' : 'photo';
    let url = '';
    let filename = '';
    let cloudinaryPublicId = '';
    let cloudinaryResourceType = '';

    if (useCloudStorage) {
      const uploaded = await uploadToCloudinary(req.file, type);
      url = uploaded.secure_url;
      filename = uploaded.public_id;
      cloudinaryPublicId = uploaded.public_id;
      cloudinaryResourceType = uploaded.resource_type;
    } else {
      const subDir = isVideo ? 'videos' : 'photos';
      url = `/uploads/${subDir}/${req.file.filename}`;
      filename = req.file.filename;
    }

    const item = {
      id: uuidv4(),
      title: req.body.title || path.basename(req.file.originalname, path.extname(req.file.originalname)),
      type,
      isFavorite: false,
      profileId,
      filename,
      originalname: req.file.originalname,
      url,
      cloudinaryPublicId,
      cloudinaryResourceType,
      size: req.file.size,
      uploadedAt: new Date().toISOString()
    };

    await saveMediaItem(item);

    res.json({ success: true, item });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed: ' + e.message });
  }
});

// PATCH toggle favorite (server-side, shared across devices)
app.patch('/api/media/:id/favorite', (req, res) => {
  const profileId = String((req.body && req.body.profileId) || '').trim();
  const isFavorite = !!(req.body && req.body.isFavorite);

  setFavorite(req.params.id, profileId, isFavorite).then((result) => {
    if (result.notFound) return res.status(404).json({ error: 'Not found.' });
    if (result.forbidden) return res.status(403).json({ error: 'Forbidden for this profile.' });
    res.json({ success: true, item: result.item });
  }).catch((e) => {
    res.status(500).json({ error: 'Favorite update failed: ' + e.message });
  });
});

// DELETE media
app.delete('/api/media/:id', (req, res) => {
  const profileId = String(req.query.profileId || '').trim();

  deleteMediaItem(req.params.id, profileId).then((result) => {
    if (result.notFound) return res.status(404).json({ error: 'Not found.' });
    if (result.forbidden) return res.status(403).json({ error: 'Forbidden for this profile.' });
    res.json({ success: true });
  }).catch((e) => {
    res.status(500).json({ error: 'Delete failed: ' + e.message });
  });
});

// Error handler for multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

initDataLayer()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`My Netflix is running at http://localhost:${PORT}`);
      console.log(hasMongo ? 'Data layer: MongoDB' : 'Data layer: JSON files');
      console.log(useCloudStorage ? 'File storage: Cloudinary' : 'File storage: Local uploads directory');
    });
  })
  .catch((error) => {
    console.error('Failed to initialize server:', error.message);
    process.exit(1);
  });
