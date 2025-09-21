const express = require('express');
const router = express.Router();
const Result = require('../models/Result');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get all results
router.get('/', async (req, res) => {
  try {
    const { search, studentId, class: classFilter } = req.query;
    
    let query = {};
    
    // Filter by studentId if provided (for student-specific results)
    if (studentId) {
      query.studentId = studentId;
    }
    
    if (search) {
      const searchQuery = {
        $or: [
          { student: { $regex: search, $options: 'i' } },
          { subject: { $regex: search, $options: 'i' } },
          { exam: { $regex: search, $options: 'i' } },
          { grade: { $regex: search, $options: 'i' } },
        ],
      };
      
      // Combine with studentId filter if both exist
      if (studentId) {
        query = { $and: [{ studentId }, searchQuery] };
      } else {
        query = searchQuery;
      }
    }
    
    const results = await Result.find(query);
    
    // Enhance results with student class information
    const enhancedResults = [];
    for (const result of results) {
      const student = await User.findOne({ _id: result.studentId, role: 'Student' });
      const enhancedResult = {
        ...result.toObject(),
        class: student ? `${student.grade}${student.section}` : null,
        studentGrade: student ? student.grade : null,
        studentSection: student ? student.section : null
      };
      enhancedResults.push(enhancedResult);
    }
    
    // Apply class filter if specified
    let finalResults = enhancedResults;
    if (classFilter) {
      finalResults = enhancedResults.filter(result => result.class === classFilter);
    }
    
    res.json(finalResults);
  } catch (err) {
    console.error("Results fetch error:", err.message);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// Add a new result
router.post('/', auth, async (req, res) => {
  const { studentId, student, subject, exam, score, grade } = req.body;
  
  // Validation
  if (!studentId || !student || !subject || !exam || score === undefined || !grade) {
    return res.status(400).json({ msg: 'All fields are required' });
  }
  
  try {
    const newResult = new Result({
      studentId,
      student,
      subject,
      exam,
      score: Number(score),
      grade,
    });
    const result = await newResult.save();
    res.json(result);
  } catch (err) {
    console.error('Error saving result:', err.message);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// Update a result
router.put('/:id', auth, async (req, res) => {
  const { studentId, student, subject, exam, score, grade } = req.body;
  
  // Validation
  if (!studentId || !student || !subject || !exam || score === undefined || !grade) {
    return res.status(400).json({ msg: 'All fields are required' });
  }
  
  try {
    let result = await Result.findById(req.params.id);
    if (!result) return res.status(404).json({ msg: 'Result not found' });

    result.studentId = studentId;
    result.student = student;
    result.subject = subject;
    result.exam = exam;
    result.score = Number(score);
    result.grade = grade;

    await result.save();
    res.json(result);
  } catch (err) {
    console.error('Error updating result:', err.message);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// Delete a result
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await Result.findById(req.params.id);
    if (!result) return res.status(404).json({ msg: 'Result not found' });

    await Result.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Result removed' });
  } catch (err) {
    console.error('Error deleting result:', err.message);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

module.exports = router;