const express = require('express');
const router = express.Router();
const Admission = require('../models/Admission');


// POST /admissions - create new admission application
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, grade, message } = req.body;
    const admission = new Admission({ name, email, phone, grade, message });
    await admission.save();
    res.status(201).json({ success: true, admission });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /admissions - list all applications
router.get('/', async (req, res) => {
  try {
    const admissions = await Admission.find();
    res.json(admissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /admissions/:id/status - update application status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, reviewedBy } = req.body;
    if (!['Accepted', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const admission = await Admission.findByIdAndUpdate(
      req.params.id,
      { status, reviewedBy, reviewedAt: new Date() },
      { new: true }
    );
    if (!admission) return res.status(404).json({ error: 'Application not found' });
    res.json(admission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
