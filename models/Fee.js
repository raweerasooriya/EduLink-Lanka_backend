//IT23337558 - Oshada W G D

const mongoose = require('mongoose');

const FeeSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
  },
  student: {
    type: String,
    required: true,
  },
  term: {
    type: String,
    required: false, // Changed to false
    default: null,   // Add default value
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['PAID', 'DUE', 'PENDING'],
    default: 'DUE',
  },
  date: {
    type: String,
    required: true,
  },
  feeType: {  // Add this new field
    type: String,
    enum: ['Term Fee', 'Registration Fee', 'Other Fee'],
    required: true,
    default: 'Term Fee'
  },
  paymentMethod: {
    type: String,
    enum: ['CARD', 'BANK', 'CASH'],
    required: false,
  },
  paymentSlip: {
    type: String,
    required: false,
  },
  paymentSlipOriginalName: {
    type: String,
    required: false,
  },
  paidDate: {
    type: Date,
    required: false,
  },
  uploadedDate: {
    type: Date,
    required: false,
  },
  verifiedBy: {
    type: String,
    required: false,
  },
  verificationDate: {
    type: Date,
    required: false,
  },
  notes: {
    type: String,
    required: false,
  }
});

module.exports = mongoose.model('Fee', FeeSchema);