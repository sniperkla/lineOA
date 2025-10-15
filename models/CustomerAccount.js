import mongoose from 'mongoose'

// Function to parse Thai date string (DD/MM/YYYY HH:MM) to Date
function parseThaiDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;

  const parts = dateString.split(' ');
  const datePart = parts[0];
  const timePart = parts[1] || '00:00';

  const [day, month, thaiYear] = datePart.split('/').map(Number);
  if (!day || !month || !thaiYear) return null;

  const gregorianYear = thaiYear - 543;
  const [hour, minute] = timePart.split(':').map(Number);

  const date = new Date(gregorianYear, month - 1, day, hour || 0, minute || 0);
  if (isNaN(date.getTime())) return null; // Invalid date

  return date;
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

// Pre-save hook to convert expireDate string to Date
customerAccountSchema.pre('save', function(next) {
  console.log('Pre-save hook triggered for account:', this._id);
  if (this.expireDate && typeof this.expireDate === 'string') {
    console.log('Converting expireDate string:', this.expireDate);
    this.expireDate = parseThaiDate(this.expireDate);
    console.log('Converted expireDate:', this.expireDate);
  }
  next();
});

export default mongoose.model('CustomerAccount', customerAccountSchema);
