const request = require('supertest');
const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');

// Set up minimal test app for Jest
const app = express();
app.use(express.json());
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: true
}));

// Set up an in-memory SQLite database for fast testing
const db = new Database(':memory:');
db.exec(`
  CREATE TABLE scan_history (
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

// Inject test database into request object
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Mock login route to set session user ID 1
app.get('/test-login', (req, res) => {
  req.session.userId = 1;
  res.json({ success: true });
});

// Mount your history router
app.use('/api', require('../history'));

describe('AuthGuard X - Audit History Security & IDOR Tests', () => {
  
  it('should reject unauthenticated requests to /api/history with 401', async () => {
    const res = await request(app).get('/api/history');
    expect(res.statusCode).toEqual(401);
    expect(res.body.success).toEqual(false);
    expect(res.body.error.code).toEqual('UNAUTHORIZED');
  });

  it('should return paginated history for the authenticated user', async () => {
    // 1. Simulate login
    const agent = request.agent(app);
    await agent.get('/test-login');

    // 2. Insert dummy test record for User 1
    db.prepare(`
      INSERT INTO scan_history (user_id, tool_type, input_summary, status, risk_level, result_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(1, 'fileintegrity', 'Test file scan', 'success', 'low', '{}');

    // 3. Fetch history
    const res = await agent.get('/api/history');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toEqual(true);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
  });

});