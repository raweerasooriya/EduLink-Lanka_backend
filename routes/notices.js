const express = require('express');
const router = express.Router();
const Notice = require('../models/Notice');

// Get all notices
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      query = {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { message: { $regex: search, $options: 'i' } },
          { postedBy: { $regex: search, $options: 'i' } },
        ],
      };
    }
    const notices = await Notice.find(query);
    res.json(notices);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Add a new notice
router.post('/', async (req, res) => {
  const { title, message, postedBy, date } = req.body;
  try {
    const newNotice = new Notice({
      title,
      message,
      postedBy,
      date,
    });
    const notice = await newNotice.save();
    res.json(notice);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Update a notice
router.put('/:id', async (req, res) => {
  const { title, message, postedBy, date } = req.body;
  try {
    let notice = await Notice.findById(req.params.id);
    if (!notice) return res.status(404).json({ msg: 'Notice not found' });

    notice.title = title;
    notice.message = message;
    notice.postedBy = postedBy;
    notice.date = date;

    await notice.save();
    res.json(notice);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Delete a notice
router.delete('/:id', async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) return res.status(404).json({ msg: 'Notice not found' });

    await Notice.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Notice removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;