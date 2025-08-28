const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// Generate shorter, readable IDs (8 characters)
function generateShortId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
const toml = require('toml');
const db = require('./database');

// Load configuration
let config;
try {
  const configFile = fs.readFileSync(path.join(__dirname, 'config.toml'), 'utf8');
  config = toml.parse(configFile);
} catch (err) {
  console.error('Error loading config.toml:', err.message);
  config = {
    expiry: { max_hours: 162 },
    upload: { max_size_mb: 100 },
    server: { port: 3000, url: "https://your-domain.com" }
  };
}

const app = express();
const PORT = process.env.PORT || config.server.port;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure multer for file uploads (100MB max)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const id = generateShortId();
    const ext = path.extname(file.originalname);
    cb(null, id + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.upload.max_size_mb * 1024 * 1024
  }
});

// Set view engine and static files
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Helper function to check if file is text
function isTextFile(mimetype, filename) {
  const textTypes = [
    'text/',
    'application/json',
    'application/xml',
    'application/javascript',
    'application/typescript'
  ];
  
  const textExtensions = [
    '.txt', '.md', '.js', '.ts', '.json', '.xml', '.html', '.css', 
    '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.rb', '.php', '.go',
    '.rs', '.sh', '.bat', '.yml', '.yaml', '.toml', '.ini', '.cfg',
    '.log', '.sql', '.r', '.m', '.swift', '.kt', '.scala', '.clj'
  ];
  
  if (textTypes.some(type => mimetype.startsWith(type))) {
    return true;
  }
  
  const ext = path.extname(filename).toLowerCase();
  return textExtensions.includes(ext);
}



// Helper function to parse expiration
function parseExpiration(expiresIn) {
  if (!expiresIn) return null;
  
  const now = new Date();
  const match = expiresIn.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2})$/);
  
  if (match) {
    const [, dateStr, hourStr] = match;
    const date = new Date(dateStr);
    date.setHours(parseInt(hourStr), 0, 0, 0);
    
    if (date > now) {
      // Check if expiration exceeds max allowed time
      if (config.expiry.max_hours !== -1) {
        const maxDate = new Date(now.getTime() + (config.expiry.max_hours * 60 * 60 * 1000));
        if (date > maxDate) {
          return maxDate.toISOString();
        }
      }
      return date.toISOString();
    }
  }
  
  return null;
}

// Helper function to parse expiration hours from input
function parseExpirationHours(hoursInput) {
  if (!hoursInput) return null;
  
  const hours = parseInt(hoursInput);
  if (isNaN(hours) || hours <= 0) return null;
  
  // Respect max hours config
  const actualHours = config.expiry.max_hours === -1 ? hours : Math.min(hours, config.expiry.max_hours);
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (actualHours * 60 * 60 * 1000));
  return expiresAt.toISOString();
}

// Helper function to check if file is expired
function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt) <= new Date();
}

// Routes
app.get('/', (req, res) => {
  res.render('index', { config });
});

// API endpoint for curl uploads
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const id = path.parse(req.file.filename).name;
  const isText = isTextFile(req.file.mimetype, req.file.originalname);

  
  // Handle custom filename
  const customName = req.body.custom_name?.trim();
  const originalName = customName || req.file.originalname;
  
  // Parse expiration from form data or query params (supports both formats)
  let expiresAt = null;
  const expiresIn = req.body.expires || req.query.expires;
  const expiresHours = req.body.expires_hours || req.query.expires_hours;
  
  if (expiresHours) {
    expiresAt = parseExpirationHours(expiresHours);
  } else if (expiresIn) {
    expiresAt = parseExpiration(expiresIn);
  }

  // Store file metadata in database
  const stmt = db.prepare(`INSERT INTO uploads 
    (id, filename, original_name, file_type, file_size, content_type, is_text, expires_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  
  stmt.run([
    id,
    req.file.filename,
    originalName,
    path.extname(originalName),
    req.file.size,
    req.file.mimetype,
    isText ? 1 : 0,

    expiresAt
  ], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.json({
      id: id,
      url: `${baseUrl}/f/${id}`,
      raw_url: `${baseUrl}/raw/${id}`,
      expires_at: expiresAt
    });
  });
  
  stmt.finalize();
});

// Web form upload
app.post('/upload', upload.single('file'), (req, res) => {
  const textContent = req.body.text_content?.trim();
  const customName = req.body.custom_name?.trim();
  
  // Handle expiration
  let expiresAt = null;
  if (req.body.expires_hours) {
    expiresAt = parseExpirationHours(req.body.expires_hours);
  }
  
  // Handle text content uploads (if text is provided)
  if (textContent) {
    const filename = customName || 'paste.txt';
    const id = generateShortId();
    const ext = path.extname(filename) || '.txt';
    const diskFilename = id + ext;
    const filePath = path.join(uploadsDir, diskFilename);
    
    // Write text content to file
    fs.writeFileSync(filePath, textContent);
    
    // Store file metadata in database
    const stmt = db.prepare(`INSERT INTO uploads 
      (id, filename, original_name, file_type, file_size, content_type, is_text, expires_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    
    stmt.run([
      id,
      diskFilename,
      filename,
      ext,
      Buffer.byteLength(textContent, 'utf8'),
      'text/plain',
      1, // is_text
      0, // is_previewable
      expiresAt
    ], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).render('error', { message: 'Database error' });
      }
      
      res.redirect(`/f/${id}`);
    });
    
    stmt.finalize();
    return;
  }
  
  // Handle file uploads (if file is provided)
  if (!req.file) {
    return res.status(400).render('error', { message: 'Please provide either text content or upload a file' });
  }

  const id = path.parse(req.file.filename).name;
  const isText = isTextFile(req.file.mimetype, req.file.originalname);

  
  // Handle custom filename
  const originalName = customName || req.file.originalname;

  // Store file metadata in database
  const stmt = db.prepare(`INSERT INTO uploads 
    (id, filename, original_name, file_type, file_size, content_type, is_text, expires_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  
  stmt.run([
    id,
    req.file.filename,
    originalName,
    path.extname(originalName),
    req.file.size,
    req.file.mimetype,
    isText ? 1 : 0,

    expiresAt
  ], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).render('error', { message: 'Database error' });
    }
    
    res.redirect(`/f/${id}`);
  });
  
  stmt.finalize();
});

app.get('/f/:id', (req, res) => {
  const id = req.params.id;
  
  db.get('SELECT * FROM uploads WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).render('error', { message: 'Database error' });
    }
    
    if (!row) {
      return res.status(404).render('error', { message: 'File not found' });
    }
    
    // Check if file is expired
    if (isExpired(row.expires_at)) {
      return res.status(410).render('error', { message: 'File has expired' });
    }
    
    const filePath = path.join(uploadsDir, row.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).render('error', { message: 'File not found on disk' });
    }
    
    if (row.is_text) {
      // Read and display text content
      fs.readFile(filePath, 'utf8', (err, content) => {
        if (err) {
          console.error('File read error:', err);
          return res.status(500).render('error', { message: 'Error reading file' });
        }
        
        res.render('text', { 
          file: row, 
          content: content,
          id: id,
          req: req
        });
      });
    } else {
      // For binary files, show download page with preview if available
      res.render('file', { 
        file: row,
        id: id,
        req: req
      });
    }
  });
});

app.get('/raw/:id', (req, res) => {
  const id = req.params.id;
  
  db.get('SELECT * FROM uploads WHERE id = ?', [id], (err, row) => {
    if (err || !row) {
      return res.status(404).send('File not found');
    }
    
    // Check if file is expired
    if (isExpired(row.expires_at)) {
      return res.status(410).send('File has expired');
    }
    
    const filePath = path.join(uploadsDir, row.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }
    
    if (row.is_text) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    } else {
      res.setHeader('Content-Type', row.content_type || 'application/octet-stream');
    }
    
    res.setHeader('Content-Disposition', `inline; filename="${row.original_name}"`);
    res.sendFile(filePath);
  });
});



app.get('/download/:id', (req, res) => {
  const id = req.params.id;
  
  db.get('SELECT * FROM uploads WHERE id = ?', [id], (err, row) => {
    if (err || !row) {
      return res.status(404).send('File not found');
    }
    
    // Check if file is expired
    if (isExpired(row.expires_at)) {
      return res.status(410).send('File has expired');
    }
    
    const filePath = path.join(uploadsDir, row.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }
    
    res.setHeader('Content-Disposition', `attachment; filename="${row.original_name}"`);
    res.sendFile(filePath);
  });
});

// Error handling
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).render('error', { message: 'File too large (max 100MB)' });
    }
  }
  res.status(500).render('error', { message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`SplatBin running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});
