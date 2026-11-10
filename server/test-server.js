const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 4001;

// 1. Configure CORS to explicitly allow localhost:5173 with credentials
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// Ensure database directory exists and connect
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'authguard.sqlite');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS scan_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tool_type TEXT NOT NULL,
    input_summary TEXT NOT NULL,
    status TEXT NOT NULL,
    risk_level TEXT,
    result_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use((req, res, next) => {
  req.db = db;
  next();
});

app.use(express.json());

// 2. Configure Session Cookie to work across ports (sameSite: 'lax')
app.use(session({
  name: 'authguard.sid',
  secret: 'test-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // http on localhost
    sameSite: 'lax', // allows cross-port localhost cookie sharing
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Route to simulate login
app.get('/test-login/:id', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  req.session.userId = userId;
  
  // Explicitly save session before responding
  req.session.save((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Session save failed' });
    }
    res.json({ 
      success: true, 
      message: `Successfully logged in as User ID ${userId}`,
      userId: userId 
    });
  });
});

app.get('/test-me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: 'Not logged in' });
  }
  res.json({ success: true, userId: req.session.userId });
});

app.use('/api/fileintegrity', require('./fileintegrity'));
app.use('/api', require('./history'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    data: null,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AuthGuard X Test Server running at http://localhost:${PORT}`);
});