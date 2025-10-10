import mongoose from 'mongoose'

// Function to parse Thai date string (DD/MM/YYYY HH:MM) to Date
function parseThaiDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return dateString

  const parts = dateString.split(' ')
  const datePart = parts[0]
  const timePart = parts[1] || '00:00'

  const [day, month, thaiYear] = datePart.split('/').map(Number)
  if (!day || !month || !thaiYear) return dateString

  const gregorianYear = thaiYear - 543
  const [hour, minute] = timePart.split(':').map(Number)

  return new Date(gregorianYear, month - 1, day, hour || 0, minute || 0)
}

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
      required: true,
      set: function(value) {
        if (typeof value === 'string') {
          return parseThaiDate(value)
        }
        return value
      }
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

export default mongoose.model('CustomerAccount', customerAccountSchema)
