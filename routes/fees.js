const express = require('express');
const router = express.Router();
const Fee = require('../models/Fee');
const auth = require('../middleware/auth');
const multer = require('multer');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDF files are allowed!'), false);
    }
  }
});

// Get all fees
router.get('/', async (req, res) => {
  try {
    const { search, studentId } = req.query;
    let query = {};
    
    // Filter by studentId if provided (for student-specific fees)
    if (studentId) {
      query.studentId = studentId;
    }
    
    if (search) {
      const searchQuery = {
        $or: [
          { student: { $regex: search, $options: 'i' } },
          { term: { $regex: search, $options: 'i' } },
          { status: { $regex: search, $options: 'i' } },
        ],
      };
      
      // Combine with studentId filter if both exist
      if (studentId) {
        query = { $and: [{ studentId }, searchQuery] };
      } else {
        query = searchQuery;
      }
    }
    
    const fees = await Fee.find(query).sort({ date: -1, uploadedDate: -1 });
    res.json(fees);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Pay a fee (for students) - with file upload support
router.post('/:id/pay', auth, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('File upload error:', err.message);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { method, status = 'PENDING' } = req.body;
    const fee = await Fee.findById(req.params.id);
    
    if (!fee) {
      return res.status(404).json({ msg: 'Fee not found' });
    }
    
    // Update fee with payment information
    fee.paymentMethod = method;
    fee.uploadedDate = new Date();
    
    // Handle file upload for bank transfers
    if (method === 'BANK' && req.file) {
      // Convert file to base64 for storage
      const fileBase64 = req.file.buffer.toString('base64');
      const fileWithMimeType = `data:${req.file.mimetype};base64,${fileBase64}`;
      
      fee.paymentSlip = fileWithMimeType;
      fee.paymentSlipOriginalName = req.file.originalname;
      fee.status = 'PENDING';
    } else if (method === 'CARD') {
      fee.status = status; // Will be updated by Stripe webhook
    }
    
    await fee.save();
    res.json(fee);
  } catch (err) {
    console.error('Payment error:', err.message);
    res.status(500).json({ error: err.message || 'Server Error' });
  }
});

// Admin verify payment (mark as paid)
router.post('/:id/verify', auth, async (req, res) => {
  try {
    const { verifiedBy, notes } = req.body;
    const fee = await Fee.findById(req.params.id);
    
    if (!fee) {
      return res.status(404).json({ msg: 'Fee not found' });
    }
    
    fee.status = 'PAID';
    fee.verifiedBy = verifiedBy;
    fee.verificationDate = new Date();
    fee.paidDate = new Date();
    fee.notes = notes;
    
    await fee.save();
    res.json(fee);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Admin reject payment
router.post('/:id/reject', auth, async (req, res) => {
  try {
    const { verifiedBy, notes } = req.body;
    const fee = await Fee.findById(req.params.id);
    
    if (!fee) {
      return res.status(404).json({ msg: 'Fee not found' });
    }
    
    fee.status = 'DUE';
    fee.verifiedBy = verifiedBy;
    fee.verificationDate = new Date();
    fee.notes = notes;
    // Keep payment slip for reference
    
    await fee.save();
    res.json(fee);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Add a new fee
router.post('/', async (req, res) => {
  const { studentId, student, term, amount, status, date } = req.body;
  try {
    const newFee = new Fee({
      studentId,
      student,
      term,
      amount,
      status,
      date,
    });
    const fee = await newFee.save();
    res.json(fee);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Update a fee
router.put('/:id', async (req, res) => {
  try {
    let fee = await Fee.findById(req.params.id);
    if (!fee) return res.status(404).json({ msg: 'Fee not found' });
    // Only update fields provided in req.body
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) fee[key] = req.body[key];
    });
    await fee.save();
    res.json(fee);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Delete a fee
router.delete('/:id', async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id);
    if (!fee) return res.status(404).json({ msg: 'Fee not found' });

    await Fee.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Fee removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;