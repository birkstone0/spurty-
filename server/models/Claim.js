const mongoose = require('mongoose');

const ClaimSchema = new mongoose.Schema({
  promoCode: { type: String, required: true, uppercase: true, trim: true },
  mobile: { type: String, required: true },
  success: { type: Boolean, default: false },
  balance: { type: Number, default: 0 },
  reason: { type: String },
  claimedBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

ClaimSchema.index({ promoCode: 1, mobile: 1, success: 1 });

module.exports = mongoose.model('Claim', ClaimSchema);