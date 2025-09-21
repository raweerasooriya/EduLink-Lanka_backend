const mongoose = require('mongoose');

const ResultSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
  },
  student: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  exam: {
    type: String,
    required: true,
  },
  score: {
    type: Number,
    required: true,
  },
  grade: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model('Result', ResultSchema);