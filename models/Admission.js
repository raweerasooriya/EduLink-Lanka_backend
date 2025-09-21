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
