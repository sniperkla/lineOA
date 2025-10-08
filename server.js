import express from 'express'
import * as line from '@line/bot-sdk'
import dotenv from 'dotenv'
import cors from 'cors'
import { connectDB } from './config/database.js'
import LineMessage from './models/LineMessage.js'
import LineUser from './models/LineUser.js'
import CustomerAccount from './models/CustomerAccount.js'
import CodeRequest from './models/CodeRequest.js'
import CodeRequest from './models/CodeRequest.js'

// Load environment variables
dotenv.config()

// Validate required environment variables
if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
  console.error('❌ LINE_CHANNEL_ACCESS_TOKEN is required but not set')
  console.error('Please check your .env file and set the correct value')
  process.exit(1)
}

if (!process.env.LINE_CHANNEL_SECRET) {
  console.error('❌ LINE_CHANNEL_SECRET is required but not set')
  console.error('Please check your .env file and set the correct value')
  process.exit(1)
}

// Line Bot SDK configuration
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
}

// Create Line client
const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: lineConfig.channelAccessToken
})

console.log('✅ Line Bot SDK configured successfully')
console.log(
  `📋 Channel Secret: ${process.env.LINE_CHANNEL_SECRET.substring(0, 8)}...`
)
console.log(
  `📋 Access Token: ${process.env.LINE_CHANNEL_ACCESS_TOKEN.substring(
    0,
    20
  )}...`
)

// Create Express app
const app = express()
const PORT = process.env.PORT || 4000

// Middleware
app.use(cors())

// Apply express.json() to all routes except webhook
app.use((req, res, next) => {
  if (req.path === '/webhook') {
    next()
  } else {
    express.json()(req, res, next)
  }
})

app.use(express.urlencoded({ extended: true }))

// Connect to MongoDB
connectDB()

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Line OA Backend',
    timestamp: new Date().toISOString(),
    mongodb: 'connected'
  })
})

// Configuration check endpoint
app.get('/config-check', (req, res) => {
  const config = {
    hasChannelSecret: !!process.env.LINE_CHANNEL_SECRET,
    hasAccessToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
    hasMongoUri: !!process.env.MONGODB_URI,
    port: process.env.PORT || 4000,
    nodeEnv: process.env.NODE_ENV || 'development',
    channelSecretLength: process.env.LINE_CHANNEL_SECRET?.length || 0,
    accessTokenLength: process.env.LINE_CHANNEL_ACCESS_TOKEN?.length || 0
  }

  res.json({
    status: 'Configuration Check',
    config,
    warnings: [
      !config.hasChannelSecret && 'LINE_CHANNEL_SECRET is missing',
      !config.hasAccessToken && 'LINE_CHANNEL_ACCESS_TOKEN is missing',
      !config.hasMongoUri && 'MONGODB_URI is missing',
      config.channelSecretLength < 30 && 'LINE_CHANNEL_SECRET seems too short',
      config.accessTokenLength < 100 &&
        'LINE_CHANNEL_ACCESS_TOKEN seems too short'
    ].filter(Boolean)
  })
})

// Get user statistics
app.get('/api/users/stats', async (req, res) => {
  try {
    const totalUsers = await LineUser.countDocuments()
    const activeUsers = await LineUser.countDocuments({ isFriend: true })
    const totalMessages = await LineMessage.countDocuments()

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        totalMessages
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const { limit = 50, skip = 0, isFriend } = req.query

    const filter = {}
    if (isFriend !== undefined) {
      filter.isFriend = isFriend === 'true'
    }

    const users = await LineUser.find(filter)
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))

    const total = await LineUser.countDocuments(filter)

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: parseInt(skip) + users.length < total
        }
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Get specific user's messages
app.get('/api/users/:userId/messages', async (req, res) => {
  try {
    const { userId } = req.params
    const { limit = 50 } = req.query

    const messages = await LineMessage.find({ userId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))

    res.json({
      success: true,
      data: {
        userId,
        messages,
        total: messages.length
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Get all messages
app.get('/api/messages', async (req, res) => {
  try {
    const { limit = 100, skip = 0 } = req.query

    const messages = await LineMessage.find()
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))

    const total = await LineMessage.countDocuments()

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: parseInt(skip) + messages.length < total
        }
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Check for expired code requests and notify users
app.get('/api/code-requests/check-expiry', async (req, res) => {
  try {
    const now = new Date()
    // Find all active code requests that have expired
    const expiredRequests = await CodeRequest.find({
      status: 'active',
      expireDate: { $lt: now }
    })

    let notified = 0
    for (const request of expiredRequests) {
      // Send notification to user via LINE
      try {
        await lineClient.pushMessage({
          to: request.userId,
          messages: [
            {
              type: 'text',
              text: `Your code request (${request.code}) has expired.`
            }
          ]
        })
        // Update status to notified
        request.status = 'notified'
        await request.save()
        notified++
      } catch (err) {
        console.error(`Failed to notify user ${request.userId}:`, err)
      }
    }

    res.json({
      success: true,
      expiredCount: expiredRequests.length,
      notified
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// Line webhook endpoint with enhanced error handling
app.post(
  '/webhook',
  (req, res, next) => {
    console.log('📨 Webhook request received')
    console.log('Headers:', JSON.stringify(req.headers, null, 2))
    console.log('Body type:', typeof req.body)
    console.log('Content-Type:', req.headers['content-type'])

    // Validate environment variables
    if (!process.env.LINE_CHANNEL_SECRET) {
      console.error('❌ LINE_CHANNEL_SECRET is not set')
      return res
        .status(500)
        .json({ error: 'LINE_CHANNEL_SECRET not configured' })
    }

    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      console.error('❌ LINE_CHANNEL_ACCESS_TOKEN is not set')
      return res
        .status(500)
        .json({ error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' })
    }

    next()
  },
  line.middleware(lineConfig),
  async (req, res) => {
    try {
      console.log('✅ Signature validation passed')
      console.log('📨 Webhook body:', JSON.stringify(req.body, null, 2))

      const events = req.body.events || []

      if (events.length === 0) {
        console.log('ℹ️ No events to process')
        return res.status(200).json({ success: true, message: 'No events' })
      }

      // Process each event
      await Promise.all(events.map(handleEvent))

      res.status(200).json({ success: true })
    } catch (error) {
      console.error('❌ Webhook processing error:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
)

// Handle Line events
async function handleEvent(event) {
  console.log('🔔 Processing event:', event.type)

  try {
    // Get user profile
    let profile = null
    try {
      profile = await lineClient.getProfile(event.source.userId)
      console.log('👤 User profile:', profile)
    } catch (profileError) {
      console.warn('⚠️ Could not get profile:', profileError.message)
    }

    // Handle follow event (user adds bot as friend)
    if (event.type === 'follow') {
      await handleFollowEvent(event, profile)
    }

    // Handle unfollow event (user removes bot)
    if (event.type === 'unfollow') {
      await handleUnfollowEvent(event)
    }

    // Handle message event
    if (event.type === 'message' && event.message.type === 'text') {
      await handleMessageEvent(event, profile)
    }
  } catch (error) {
    console.error('❌ Error handling event:', error)
    throw error
  }
}

// Handle follow event
async function handleFollowEvent(event, profile) {
  console.log('➕ User followed:', event.source.userId)

  try {
    // Create or update user
    const user = await LineUser.findOrCreate(event.source.userId, {
      displayName: profile?.displayName,
      pictureUrl: profile?.pictureUrl,
      statusMessage: profile?.statusMessage,
      language: profile?.language
    })

    user.isFriend = true
    user.friendedAt = new Date(event.timestamp)
    await user.save()

    // Send welcome message
    const welcomeMessage = {
      type: 'text',
      text: `สวัสดีครับ ${
        profile?.displayName || 'คุณ'
      }! 👋\n\nยินดีต้อนรับเข้าสู่ระบบ Q-Dragon\n\nส่งข้อความอะไรมาก็ได้ เราจะบันทึกข้อความของคุณลงในฐานข้อมูลครับ 📝`
    }

    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [welcomeMessage]
    })

    console.log('✅ Follow event processed successfully')
  } catch (error) {
    console.error('❌ Error handling follow event:', error)
    throw error
  }
}

// Handle unfollow event
async function handleUnfollowEvent(event) {
  console.log('➖ User unfollowed:', event.source.userId)

  try {
    const user = await LineUser.findOne({ userId: event.source.userId })

    if (user) {
      user.isFriend = false
      user.unfollowedAt = new Date(event.timestamp)
      await user.save()
      console.log('✅ Unfollow event processed successfully')
    }
  } catch (error) {
    console.error('❌ Error handling unfollow event:', error)
    throw error
  }
}

// Handle message event
async function handleMessageEvent(event, profile) {
  const userId = event.source.userId
  const messageText = event.message.text
  const messageId = event.message.id
  const timestamp = new Date(event.timestamp)

  console.log(`💬 Message from ${userId}: "${messageText}"`)

  try {
    // Find or create user
    const user = await LineUser.findOrCreate(userId, {
      displayName: profile?.displayName,
      pictureUrl: profile?.pictureUrl,
      statusMessage: profile?.statusMessage,
      language: profile?.language
    })

    // Increment message count
    await user.incrementMessageCount()

    // Check if this is the first message
    const messageCount = await LineMessage.countDocuments({ userId })
    const isFirstMessage = messageCount === 0

    // Save message to database
    const responseText = `ได้รับข้อความแล้วครับ: "${messageText}"\n\nข้อความของคุณถูกบันทึกในระบบเรียบร้อยแล้ว ✅`

    const lineMessage = new LineMessage({
      userId,
      displayName: profile?.displayName,
      pictureUrl: profile?.pictureUrl,
      statusMessage: profile?.statusMessage,
      messageText,
      messageId,
      messageType: 'text',
      timestamp,
      metadata: {
        replyToken: event.replyToken,
        source: {
          type: event.source.type,
          userId: event.source.userId,
          groupId: event.source.groupId,
          roomId: event.source.roomId
        }
      },
      isFirstMessage,
      responseText,
      respondedAt: new Date()
    })

    await lineMessage.save()
    console.log('✅ Message saved to database')

    // Reply to user
    const replyMessage = {
      type: 'text',
      text: responseText
    }

    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [replyMessage]
    })

    console.log('✅ Reply sent to user')
  } catch (error) {
    console.error('❌ Error handling message event:', error)

    // Try to send error message to user
    try {
      await lineClient.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: 'text',
            text: 'ขออภัยครับ เกิดข้อผิดพลาดในการบันทึกข้อความ กรุณาลองใหม่อีกครั้ง'
          }
        ]
      })
    } catch (replyError) {
      console.error('❌ Could not send error message:', replyError)
    }

    throw error
  }
}

// Start server
app.listen(PORT, () => {
  console.log('🚀 Line OA Backend Server Started')
  console.log(`📡 Server running on port ${PORT}`)
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`)
  console.log(`💚 Health check: http://localhost:${PORT}/health`)
  console.log(`📊 API Stats: http://localhost:${PORT}/api/users/stats`)
  console.log('\n⚡ Ready to receive Line webhooks!')
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️ SIGTERM received, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('⚠️ SIGINT received, shutting down gracefully...')
  process.exit(0)
})

// Interval job: check for expired customer accounts every 5 minutes
setInterval(async () => {
  try {
    const now = new Date()
    // Find all valid accounts that have expired
    const expiredAccounts = await CustomerAccount.find({
      status: 'valid',
      expireDate: { $exists: true }
    })

    for (const account of expiredAccounts) {
      try {
        // Parse Thai date format
        const thaiDateParts = account.expireDate.split(' ')
        const [day, month, year] = thaiDateParts[0].split('/')
        const time = thaiDateParts[1]
        const gregorianYear = parseInt(year) - 543
        const parsedExpireDate = new Date(
          `${gregorianYear}-${month}-${day}T${time}:00`
        )

        if (parsedExpireDate < now) {
          // Notify user via LINE
          await lineClient.pushMessage({
            to: account.userLineId,
            messages: [
              {
                type: 'text',
                text: `แจ้งเตือน: License ของคุณ (${account.license}) หมดอายุแล้ว กรุณาติดต่อเจ้าหน้าที่เพื่อขยายเวลาใช้งาน`
              }
            ]
          })
          account.status = 'expired'
          await account.save()
          console.log(`Notified user ${account.userLineId} for expired license.`)
        }
      } catch (err) {
        console.error(`Failed to notify user ${account.userLineId}:`, err)
      }
    }
  } catch (error) {
    console.error('Error in customer account expiry interval:', error)
  }
}, 5 * 60 * 1000) // 5 minutes

// Interval job: check for expired code requests every 5 minutes // 5 minutes
