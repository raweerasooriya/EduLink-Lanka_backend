/**
 * IT23168190 - R A WEERASOORIYA
 * This file defines the Mongoose schema for an 'Admission' application.
 * This schema acts as a blueprint for how admission form submissions
 * are stored and managed in the MongoDB database.
 *
 * It stores:
 * 1.  The applicant's contact and grade information.
 * 2.  The status of the application (e.g., Pending, Accepted, Rejected).
 * 3.  Tracking information, such as when the application was submitted and
 * who reviewed it.
 *
 * This schema is exported as an 'Admission' model, which allows the application
 * to interact with the admissions data.
 */

const mongoose = require('mongoose');

const AdmissionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  grade: { type: String, required: true },
  message: { type: String },
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['Pending', 'Accepted', 'Rejected'], default: 'Pending' },
  reviewedBy: { type: String },
  reviewedAt: { type: Date }
});

module.exports = mongoose.model('Admission', AdmissionSchema);
