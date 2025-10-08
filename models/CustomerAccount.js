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
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['valid', 'expired', 'invalid', 'suspended'],
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
    }
  },
  {
    timestamps: true // Adds createdAt and updatedAt
  }
)

export default mongoose.model('CustomerAccount', customerAccountSchema)