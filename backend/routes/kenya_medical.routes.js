const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { KENYA_LAB_TESTS, KENYA_PROCEDURES, KENYA_RADIOLOGY_TESTS } = require('../data/kenya_medical_data');

// Search Kenya lab tests
router.get('/labs/kenya/search', protect, async (req, res) => {
  try {
    const term = (req.query.term || '').toLowerCase().trim();
    if (!term || term.length < 1) return res.json([]);
    const results = KENYA_LAB_TESTS.filter(t =>
      t.name.toLowerCase().includes(term) ||
      t.code.toLowerCase().includes(term) ||
      t.category.toLowerCase().includes(term)
    ).slice(0, 20);
    res.json(results);
  } catch (e) { res.status(500).json([]); }
});

// Search Kenya radiology / imaging examinations
router.get('/radiology/kenya/search', protect, async (req, res) => {
  try {
    const term = (req.query.term || '').toLowerCase().trim();
    if (!term || term.length < 1) return res.json([]);
    const results = (KENYA_RADIOLOGY_TESTS || []).filter(r =>
      r.name.toLowerCase().includes(term) ||
      r.code.toLowerCase().includes(term) ||
      r.category.toLowerCase().includes(term)
    ).slice(0, 20);
    res.json(results);
  } catch (e) { res.status(500).json([]); }
});

// Search Kenya procedures
router.get('/procedures/kenya/search', protect, async (req, res) => {
  try {
    const term = (req.query.term || '').toLowerCase().trim();
    if (!term || term.length < 1) return res.json([]);
    const results = KENYA_PROCEDURES.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.code.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term)
    ).slice(0, 20);
    res.json(results);
  } catch (e) { res.status(500).json([]); }
});

// Get all Kenya lab categories
router.get('/labs/kenya/categories', protect, async (req, res) => {
  const cats = [...new Set(KENYA_LAB_TESTS.map(t => t.category))];
  res.json(cats);
});

// Get all Kenya procedure categories  
router.get('/procedures/kenya/categories', protect, async (req, res) => {
  const cats = [...new Set(KENYA_PROCEDURES.map(p => p.category))];
  res.json(cats);
});

module.exports = router;
