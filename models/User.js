
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
    required: true,
  },
  profileImage: {
    type: String, // Base64 encoded string
  },
  role: {
    type: String,
    enum: ['Admin', 'Teacher', 'Student', 'Parent'],
    default: 'Student',
  },
  // Additional fields for Students
  grade: {
    type: String,
    required: false, // Only required for students
  },
  section: {
    type: String,
    required: false, // Only required for students
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Reference to parent user
  },
  // Additional field for Teachers
  subject: {
    type: String,
    required: false, // Only required for teachers
  },
});

module.exports = mongoose.model('User', UserSchema);
