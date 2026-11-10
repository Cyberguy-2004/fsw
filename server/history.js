const express = require('express');
const router = express.Router();

const ok = (res, data) => res.json({ success: true, data, error: null });
const fail = (res, code, message, status = 400) => 
  res.status(status).json({ success: false, data: null, error: { code, message } });

// GET /api/dashboard/summary
router.get('/dashboard/summary', (req, res) => {
  // Security: User must be authenticated
  if (!req.session || !req.session.userId) {
    return fail(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const db = req.db;
  const userId = req.session.userId;

  try {
    // Security: Parameterised queries strictly scoped to current user ID
    const countStmt = db.prepare(`
      SELECT tool_type, COUNT(*) as count 
      FROM scan_history 
      WHERE user_id = ? 
      GROUP BY tool_type
    `);
    const counts = countStmt.all(userId);

    const recentStmt = db.prepare(`
      SELECT id, tool_type, input_summary, status, risk_level, created_at 
      FROM scan_history 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    const recentActivity = recentStmt.all(userId);

    // Format counts into easy dictionary
    const totals = { headershield: 0, phishcheck: 0, fileintegrity: 0, total: 0 };
    counts.forEach(row => {
      totals[row.tool_type] = row.count;
      totals.total += row.count;
    });

    ok(res, { totals, recentActivity });
  } catch (err) {
    fail(res, 'DB_ERROR', 'Failed to retrieve dashboard summary', 500);
  }
});

// GET /api/history?page=&limit=&toolType=
router.get('/history', (req, res) => {
  if (!req.session || !req.session.userId) {
    return fail(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const db = req.db;
  const userId = req.session.userId;

  let page = parseInt(req.query.page, 10) || 1;
  let limit = parseInt(req.query.limit, 10) || 10;
  if (page < 1) page = 1;
  if (limit > 50) limit = 50; // Max limit 50 per spec[cite: 2]
  const offset = (page - 1) * limit;

  const toolType = req.query.toolType;

  try {
    let rows, countRow;
    if (toolType) {
      // Security: Parameterised query filtering by tool type and user ID
      const stmt = db.prepare(`
        SELECT id, tool_type, input_summary, status, risk_level, created_at 
        FROM scan_history 
        WHERE user_id = ? AND tool_type = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `);
      rows = stmt.all(userId, toolType, limit, offset);

      const countStmt = db.prepare(`SELECT COUNT(*) as total FROM scan_history WHERE user_id = ? AND tool_type = ?`);
      countRow = countStmt.get(userId, toolType);
    } else {
      const stmt = db.prepare(`
        SELECT id, tool_type, input_summary, status, risk_level, created_at 
        FROM scan_history 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `);
      rows = stmt.all(userId, limit, offset);

      const countStmt = db.prepare(`SELECT COUNT(*) as total FROM scan_history WHERE user_id = ?`);
      countRow = countStmt.get(userId);
    }

    ok(res, {
      page,
      limit,
      total: countRow.total,
      items: rows
    });
  } catch (err) {
    fail(res, 'DB_ERROR', 'Failed to retrieve history', 500);
  }
});

// GET /api/history/:id
router.get('/history/:id', (req, res) => {
  if (!req.session || !req.session.userId) {
    return fail(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const db = req.db;
  const userId = req.session.userId;
  const recordId = req.params.id;

  try {
    // Security (IDOR Defense): Scope query by both record ID AND session user ID[cite: 2]. 
    // If another user's ID is requested, it returns undefined -> triggers 404.
    const stmt = db.prepare(`
      SELECT id, tool_type, input_summary, status, risk_level, result_json, created_at 
      FROM scan_history 
      WHERE id = ? AND user_id = ?
    `);
    const record = stmt.get(recordId, userId);

    if (!record) {
      return fail(res, 'NOT_FOUND', 'Record not found', 404); // Returns 404 for unauthorized/non-existent IDs[cite: 2]
    }

    // Parse stored JSON result safely
    try {
      record.result_json = JSON.parse(record.result_json);
    } catch (e) {
      record.result_json = {};
    }

    ok(res, record);
  } catch (err) {
    fail(res, 'DB_ERROR', 'Failed to retrieve record details', 500);
  }
});

module.exports = router;