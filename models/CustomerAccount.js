const mongoose = require('mongoose')

const customerAccountSchema = new mongoose.Schema(
  {
    user: {
      type: String,
      required: true
    },
    license: {
      type: String,
      required: true
    },
    expireDate: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['valid', 'expired', 'invalid', 'suspended', 'nearly_expired'],
      default: 'valid'
    },
    platform: {
      type: String,
      required: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    plan: {
      type: Number,
      required: true
    },
    activatedAt: {
      type: Date,
      required: true
    },
    createdBy: {
      type: String,
      required: true
    },
    adminGenerated: {
      type: Boolean,
      default: false
    },
    notified: {
      type: Boolean,
      default: false
    },
    userLineId: {
      type: String,
      default: false
    },
    lastNearlyExpiredNotifiedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true // Adds createdAt and updatedAt
  }
)

module.exports = mongoose.model('CustomerAccount', customerAccountSchema)
