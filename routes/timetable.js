//IT23621374 - Brundhaban.J

const express = require('express');
const router = express.Router();
const Timetable = require('../models/Timetable');

// Get all timetable entries
router.get('/', async (req, res) => {
  try {
    const { search, class: classFilter } = req.query;
    let query = {};
    
    // Filter by class if provided (for student-specific timetable)
    if (classFilter) {
      query.class = classFilter;
    }
    
    if (search) {
      const searchQuery = {
        $or: [
          { day: { $regex: search, $options: 'i' } },
          { period: { $regex: search, $options: 'i' } },
          { class: { $regex: search, $options: 'i' } },
          { subject: { $regex: search, $options: 'i' } },
          { teacher: { $regex: search, $options: 'i' } },
          { room: { $regex: search, $options: 'i' } },
        ],
      };
      
      // Combine with class filter if both exist
      if (classFilter) {
        query = { $and: [{ class: classFilter }, searchQuery] };
      } else {
        query = searchQuery;
      }
    }
    
    const timetable = await Timetable.find(query);
    res.json(timetable);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Add a new timetable entry
router.post('/', async (req, res) => {
  const { day, period, class: className, subject, teacher, room } = req.body;
  try {
    const newTimetableEntry = new Timetable({
      day,
      period,
      class: className,
      subject,
      teacher,
      room,
    });
    const timetableEntry = await newTimetableEntry.save();
    res.json(timetableEntry);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Update a timetable entry
router.put('/:id', async (req, res) => {
  const { day, period, class: className, subject, teacher, room } = req.body;
  try {
    let timetableEntry = await Timetable.findById(req.params.id);
    if (!timetableEntry) return res.status(404).json({ msg: 'Timetable entry not found' });

    timetableEntry.day = day;
    timetableEntry.period = period;
    timetableEntry.class = className;
    timetableEntry.subject = subject;
    timetableEntry.teacher = teacher;
    timetableEntry.room = room;

    await timetableEntry.save();
    res.json(timetableEntry);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Delete a timetable entry
router.delete('/:id', async (req, res) => {
  try {
    const timetableEntry = await Timetable.findById(req.params.id);
    if (!timetableEntry) return res.status(404).json({ msg: 'Timetable entry not found' });

    await Timetable.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Timetable entry removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;