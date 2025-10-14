/**
 * IT23168190 - R A WEERASOORIYA
 * This file defines the Mongoose schema, which is the blueprint for how
 * a 'User' is structured in the MongoDB database.
 *
 * It handles:
 * 1.  Basic user information (name, email, password).
 * 2.  Different user types using a 'role' field (Admin, Teacher, Student, Parent).
 * 3.  Role-specific fields, like 'grade' for a student or 'subject' for a teacher.
 * 4.  A relationship that links a 'Student' user to their 'Parent' user.
 *
 * This schema is then exported as a 'User' model, which is used to
 * create, read, update, and delete users in the database.
 */

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

  // Add teacher reference field to link students with their assigned teacher
  teacher: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  required: false, // Reference to teacher user
},
});

module.exports = mongoose.model('User', UserSchema);
