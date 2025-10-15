import mongoose from 'mongoose'

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
      type: String
    },
    status: {
      type: String,
      enum: ['valid', 'expired', 'invalid', 'suspended', 'nearly_expired'],
      default: 'valid'
    },
    platform: {
      type: String
    },
    accountNumber: {
      type: String,
      required: true
    },
    plan: {
      type: Number
    },
    activatedAt: {
      type: Date,
      required: true
    },
    createdBy: {
      type: String
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

// Pre-save hook to convert expireDate string to Date

export default mongoose.model('CustomerAccount', customerAccountSchema)
