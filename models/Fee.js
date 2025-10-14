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
    required: true,
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
  paymentMethod: {
    type: String,
    enum: ['CARD', 'BANK', 'CASH'],
    required: false,
  },
  paymentSlip: {
    type: String, // Base64 encoded image or file path
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
    type: String, // Admin who verified the payment
    required: false,
  },
  verificationDate: {
    type: Date,
    required: false,
  },
  notes: {
    type: String, // Admin notes about the payment
    required: false,
  }
});

module.exports = mongoose.model('Fee', FeeSchema);