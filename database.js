const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'splatbin.db');

// Initialize database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Create tables if they don't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    content_type TEXT,
    is_text BOOLEAN DEFAULT 0,
    expires_at DATETIME
  )`);
  
  // Add expires_at column if it doesn't exist (for existing databases)
  
  db.run(`ALTER TABLE uploads ADD COLUMN expires_at DATETIME`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding expires_at column:', err.message);
    }
  });
});

module.exports = db;
