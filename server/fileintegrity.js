const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Ensure temp upload directory exists
const uploadDir = path.join(__dirname, '../data/temp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer: 10 MiB limit, random temp filenames
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MiB limit[cite: 2]
});

const ok = (res, data) => res.json({ success: true, data, error: null });
const fail = (res, code, message, status = 400) => 
  res.status(status).json({ success: false, data: null, error: { code, message } });

// POST /api/fileintegrity/hash
router.post('/hash', upload.single('file'), (req, res) => {
  if (!req.session || !req.session.userId) {
    cleanupFile(req.file ? req.file.path : null);
    return fail(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  if (!req.file) {
    return fail(res, 'INVALID_INPUT', 'No file uploaded or file exceeds size limit');
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const fileSize = req.file.size;

  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);

  let digested = false;
  let digestResult = '';

  stream.on('error', (err) => {
    cleanupFile(filePath);
    if (!res.headersSent) {
      return fail(res, 'STREAM_ERROR', 'Failed to read file for hashing', 500);
    }
  });

  stream.on('data', (chunk) => {
    hash.update(chunk);
  });

  stream.on('end', () => {
    digestResult = hash.digest('hex'); // 64-character SHA-256 hex string[cite: 2]
    digested = true;
    
    // Explicitly destroy stream to release file handle on Windows
    stream.destroy();
  });

  // Stream 'close' guarantees the file handle is fully released by OS
  stream.on('close', () => {
    try {
      if (digested) {
        const db = req.db;
        const stmt = db.prepare(`
          INSERT INTO scan_history (user_id, tool_type, input_summary, status, risk_level, result_json)
          VALUES (?, 'fileintegrity', ?, 'success', 'low', ?)
        `);
        
        const summary = `Hashed file: ${originalName} (${fileSize} bytes)`;
        const resultJson = JSON.stringify({ fileName: originalName, size: fileSize, sha256: digestResult });
        
        stmt.run(req.session.userId, summary, resultJson);

        if (!res.headersSent) {
          ok(res, { fileName: originalName, size: fileSize, sha256: digestResult });
        }
      }
    } catch (err) {
      if (!res.headersSent) {
        fail(res, 'DB_ERROR', 'Failed to save history', 500);
      }
    } finally {
      // Guaranteed file deletion once the stream is fully closed
      cleanupFile(filePath);
    }
  });
});

// POST /api/fileintegrity/compare
router.post('/compare', express.json(), (req, res) => {
  if (!req.session || !req.session.userId) {
    return fail(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }

  const { computedDigest, referenceDigest } = req.body;

  if (!computedDigest || !referenceDigest) {
    return fail(res, 'INVALID_INPUT', 'Both computedDigest and referenceDigest are required');
  }

  const hexRegex = /^[a-f0-9]{64}$/i;
  if (!hexRegex.test(computedDigest) || !hexRegex.test(referenceDigest)) {
    return fail(res, 'INVALID_INPUT', 'Invalid SHA-256 digest format');
  }

  const match = computedDigest.toLowerCase() === referenceDigest.toLowerCase();

  ok(res, { match, computedDigest: computedDigest.toLowerCase(), referenceDigest: referenceDigest.toLowerCase() });
});

function cleanupFile(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // Delete temp file[cite: 2, 17]
    }
  } catch (e) {
    // If locked briefly, retry after a short delay for Windows stability
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (err) {}
    }, 100);
  }
}

module.exports = router;