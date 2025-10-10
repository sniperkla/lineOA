import mongoose from 'mongoose'

const lineUserSchema = new mongoose.Schema(
  {
    // Line User ID (unique identifier)
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    // User's display name
    displayName: {
      type: String,
      default: null
    },

    // User's profile picture URL
    pictureUrl: {
      type: String,
      default: null
    },

    // User's status message
    statusMessage: {
      type: String,
      default: null
    },

    // User's language
    language: {
      type: String,
      default: null
    },

    // When user became a friend (follow event)
    friendedAt: {
      type: Date,
      default: Date.now
    },

    // Is currently a friend?
    isFriend: {
      type: Boolean,
      default: true
    },

    // Last time user unfollowed (if applicable)
    unfollowedAt: {
      type: Date,
      default: null
    },

    // Last time user sent a message
    lastMessageAt: {
      type: Date,
      default: null
    },

    // Total message count
    messageCount: {
      type: Number,
      default: 0
    },

    // Additional custom fields (optional)
    customData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    // Tags for user categorization
    tags: [
      {
        type: String
      }
    ],

    // Notes about the user
    notes: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
)

// Method to increment message count
lineUserSchema.methods.incrementMessageCount = async function () {
  this.messageCount += 1
  this.lastMessageAt = new Date()
  return await this.save()
}

// Static method to find or create user
lineUserSchema.statics.findOrCreate = async function (
  userId,
  profileData = {}
) {
  let user = await this.findOne({ userId })

  if (!user) {
    user = await this.create({
      userId,
      displayName: profileData.displayName || null,
      pictureUrl: profileData.pictureUrl || null,
      statusMessage: profileData.statusMessage || null,
      language: profileData.language || null,
      friendedAt: new Date()
    })
  } else if (profileData.displayName) {
    // Update profile data if provided
    user.displayName = profileData.displayName
    user.pictureUrl = profileData.pictureUrl || user.pictureUrl
    user.statusMessage = profileData.statusMessage || user.statusMessage
    user.language = profileData.language || user.language
    await user.save()
  }

  return user
}

export default mongoose.model('LineUser', lineUserSchema)
