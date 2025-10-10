import mongoose from 'mongoose'

const lineMessageSchema = new mongoose.Schema({
  // Line User ID (unique identifier from Line)
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  // User's display name from Line profile (optional)
  displayName: {
    type: String,
    default: null
  },
  
  // User's profile picture URL (optional)
  pictureUrl: {
    type: String,
    default: null
  },
  
  // User's status message (optional)
  statusMessage: {
    type: String,
    default: null
  },
  
  // Message text content
  messageText: {
    type: String,
    required: true
  },
  
  // Line message ID
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Message type (text, image, video, audio, file, location, sticker)
  messageType: {
    type: String,
    default: 'text'
  },
  
  // Timestamp from Line event
  timestamp: {
    type: Date,
    required: true
  },
  
  // Additional metadata
  metadata: {
    replyToken: String,
    source: {
      type: {
        type: String, // user, group, room
        default: 'user'
      },
      userId: String,
      groupId: String,
      roomId: String
    }
  },
  
  // Is this the first message from this user? (friend added event)
  isFirstMessage: {
    type: Boolean,
    default: false
  },
  
  // Response sent back to user (optional)
  responseText: {
    type: String,
    default: null
  },
  
  // Response sent at
  respondedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
})

// Create compound index for efficient queries
lineMessageSchema.index({ userId: 1, timestamp: -1 })
lineMessageSchema.index({ createdAt: -1 })

// Virtual for counting messages per user
lineMessageSchema.statics.getUserMessageCount = async function(userId) {
  return await this.countDocuments({ userId })
}

// Virtual for getting user's message history
lineMessageSchema.statics.getUserHistory = async function(userId, limit = 50) {
  return await this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
}

export default mongoose.model('LineMessage', lineMessageSchema)
