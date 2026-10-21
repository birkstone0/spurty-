const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  dob: { type: String, default: '' },
  age: { type: Number, default: 21 },
  mobile: { type: String, required: true, unique: true },
  otpFlowId: { type: String },
  generatedPassword: { type: String, required: true }, 
  plainPassword: { type: String },                    
  status: { type: String, enum: ['otp_sent', 'verified', 'failed'], default: 'verified' },
  kycStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'none'], default: 'none' },
  errorReason: { type: String },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  createdBy: { type: String, required: true }, 
  createdAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', async function() {
  if (!this.isModified('generatedPassword')) return;
  this.generatedPassword = await bcrypt.hash(this.generatedPassword, 10);
});

module.exports = mongoose.model('User', UserSchema);