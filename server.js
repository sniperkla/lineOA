import express from 'express'
import * as line from '@line/bot-sdk'
import dotenv from 'dotenv'
import cors from 'cors'
import { connectDB } from './config/database.js'
import LineMessage from './models/LineMessage.js'
import LineUser from './models/LineUser.js'
import CustomerAccount from './models/CustomerAccount.js'
import fetch from 'node-fetch'

// Load environment variables
dotenv.config()

// Validate required environment variables
if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
  console.error('❌ LINE_CHANNEL_ACCESS_TOKEN is required but not set')
  console.error('Plese check your .env file and set the correct value')
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
      config.channelSecretLength < 30 && 'LINE_CHANNEL_SECRET seems tooshort',
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
      }! 👋\n\nยินดีต้อนรับเข้าสู่ระบบ Q-Dragon\n\nกรุณาส่งหมายเลขบัญชีของคุณเพื่อเปิดใช้งานฟังก์ชันแจ้งเตือนอัตโนมัติ หากคีย์ใกล้จะถึงวันหมดอายุ 📝`
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

  console.log('🔢 Extracted numbers from message:', userId)

  // Extract numbers from user input and log if length > 4
  const matches = messageText.match(/\d+/g)
  if (matches) {
    for (const num of matches) {
      if (num.length > 4) {
        console.log(`Extracted number > 4 digits: ${num}`)
        // Check if number matches any accountNumber in CustomerAccount
        const account = await CustomerAccount.findOne({ accountNumber: num })
        if (account) {
          // Store userId in CustomerAccount
          account.userLineId = userId
          await account.save()
          console.log(
            `Stored userId ${userId} in CustomerAccount for accountNumber ${num}`
          )
          // Send confirmation message to customer
          await lineClient.replyMessage({
            replyToken: event.replyToken,
            messages: [
              {
                type: 'text',
                text: `✅ ข้อมูลของคุณถูกเชื่อมโยงกับบัญชีหมายเลข ${num} เรียบร้อยแล้วครับ`
              }
            ]
          })
        }
      }
    }
  }

  console.log(`💬 Message from ${userId}: "${messageText}"`)

  try {
    const botInfoMessage = {
      type: 'text',
      text: '🤖 ข้อความนี้ถูกตอบโดย LINE Bot อัตโนมัติ'
    }
    await lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [botInfoMessage]
    })
    console.log('✅ Reply and bot info sent to user')
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

// Interval job: notify users for expired customer accounts every 5 minutes
setInterval(async () => {
  try {
    // console.log(
    //   '🔄 Starting interval job to notify expired customer accounts...'
    // )
    const checkPreValid = await CustomerAccount.find({
      status: 'valid',
      userLineId: { $exists: true, $ne: '' },
      notified: true
    })
    if (checkPreValid) {
      for (const account of checkPreValid) {
        try {
          await CustomerAccount.updateOne(
            { _id: account._id, status: 'valid', notified: true },
            { $set: { notified: false } }
          )
          // console.log(
          //   `✅ Updated account ${account.accountNumber} status back to unnotified.`
          // )
        } catch (err) {
          console.error(
            `❌ Failed to update account ${account.accountNumber}:`,
            err
          )
        }
      }
    }
    const expiredOrSuspendedAccounts = await CustomerAccount.find({
      status: { $in: ['expired', 'suspended'] },
      userLineId: { $exists: true, $ne: '' },
      $or: [
        { lastNotifiedStatus: { $ne: 'expired' }, status: 'expired' },
        { lastNotifiedStatus: { $ne: 'suspended' }, status: 'suspended' }
      ],
      notified: false
    })
    // console.log(
    //   `📋 Found ${expiredOrSuspendedAccounts.length} expired or suspended accounts to notify.`
    // )

    for (const account of expiredOrSuspendedAccounts) {
      try {
        if (!account.userLineId || typeof account.userLineId !== 'string') {
          console.warn(
            `⚠️ Skipping account ${account.accountNumber}: userLineId is missing or invalid.`
          )
          continue
        }
        let messageContent = {}
        if (account.status === 'expired') {
          messageContent = {
            type: 'flex',
            altText: 'แจ้งเตือน: License หมดอายุ',
            contents: {
              type: 'bubble',
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '📅 แจ้งเตือนสถานะ License',
                    weight: 'bold',
                    size: 'lg',
                    color: '#FF0000'
                  },
                  {
                    type: 'text',
                    text: 'License ของคุณได้หมดอายุแล้ว',
                    margin: 'md',
                    wrap: true
                  },
                  {
                    type: 'separator',
                    margin: 'md'
                  },
                  {
                    type: 'text',
                    text: `🔑 License Key: ${account.license}`,
                    weight: 'bold',
                    size: 'md',
                    color: '#000000',
                    margin: 'md'
                  },
                  {
                    type: 'text',
                    text: 'กรุณาติดต่อทีมงานเพื่อต่ออายุโดยด่วน',
                    margin: 'md',
                    wrap: true
                  },
                  {
                    type: 'text',
                    text: 'ขอบคุณที่ใช้บริการครับ/ค่ะ',
                    margin: 'lg',
                    size: 'sm'
                  }
                ]
              }
            }
          }
        } else if (account.status === 'suspended') {
          messageContent = {
            type: 'flex',
            altText: 'แจ้งเตือน: License ถูกระงับ',
            contents: {
              type: 'bubble',
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '🚫 แจ้งเตือนสถานะ License',
                    weight: 'bold',
                    size: 'lg',
                    color: '#FF6600'
                  },
                  {
                    type: 'text',
                    text: 'License ของคุณถูกระงับชั่วคราว',
                    margin: 'md',
                    wrap: true
                  },
                  {
                    type: 'separator',
                    margin: 'md'
                  },
                  {
                    type: 'text',
                    text: `🔑 License Key: ${account.license}`,
                    weight: 'bold',
                    size: 'md',
                    color: '#000000',
                    margin: 'md'
                  },
                  {
                    type: 'text',
                    text: 'กรุณาติดต่อทีมงานเพื่อตรวจสอบและแก้ไข',
                    margin: 'md',
                    wrap: true
                  },
                  {
                    type: 'text',
                    text: 'ขอบคุณที่ใช้บริการครับ/ค่ะ',
                    margin: 'lg',
                    size: 'sm'
                  }
                ]
              }
            }
          }
        }
        console.log(
          `🔔 Notifying userLineId: ${account.userLineId} for account: ${account.accountNumber}`
        )
        const url = 'https://api.line.me/v2/bot/message/push'
        const body = {
          to: account.userLineId,
          messages: [messageContent]
        }
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
          },
          body: JSON.stringify(body)
        })
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`LINE API error: ${response.status} - ${errorText}`)
        }
        account.notified = true
        account.lastNotifiedStatus = account.status
        await account.save()
        console.log(
          `✅ Notified user ${account.userLineId} for ${account.status} license.`
        )
      } catch (err) {
        console.error(`❌ Failed to notify user ${account.userLineId}:`, err)
        console.error(
          `🔍 Debugging account data: ${JSON.stringify(account, null, 2)}`
        )
      }
    }

    const notifyStatuses = ['expired', 'suspended', 'nearly_expired']
    const accountsToNotify = await CustomerAccount.find({
      status: { $in: notifyStatuses },
      userLineId: { $exists: true, $ne: '' },
      $or: [
        { status: { $in: ['expired', 'suspended'] }, notified: { $ne: true } },
        {
          status: 'nearly_expired',
          $or: [
            { lastNearlyExpiredNotifiedAt: { $exists: false } },
            {
              lastNearlyExpiredNotifiedAt: {
                $lt: new Date(new Date().setHours(0, 0, 0, 0))
              }
            }
          ]
        }
      ]
    })
    // console.log(
    //   `📋 Found ${
    //     accountsToNotify.length
    //   } accounts to notify for statuses: ${notifyStatuses.join(', ')}.`
    // )

    for (const account of accountsToNotify) {
      try {
        if (!account.userLineId || typeof account.userLineId !== 'string') {
          console.warn(
            `⚠️ Skipping account ${account.accountNumber}: userLineId is missing or invalid.`
          )
          continue
        }
        let messageContent = {}
        if (account.status === 'expired') {
          messageContent = {
            type: 'flex',
            altText: 'แจ้งเตือน: License หมดอายุ',
            contents: {
              type: 'bubble',
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '📅 แจ้งเตือนสถานะ License',
                    weight: 'bold',
                    size: 'lg',
                    color: '#FF0000'
                  },
                  {
                    type: 'text',
                    text: 'License ของคุณได้หมดอายุแล้ว',
                    margin: 'md',
                    wrap: true
                  },
                  {
                    type: 'separator',
                    margin: 'md'
                  },
                  {
                    type: 'text',
                    text: `🔑 License Key: ${account.license}`,
                    weight: 'bold',
                    size: 'md',
                    color: '#000000',
                    margin: 'md'
                  },
                  {
                    type: 'text',
                    text: 'กรุณาติดต่อทีมงานเพื่อต่ออายุโดยด่วน',
                    margin: 'md',
                    wrap: true
                  },
                  {
                    type: 'text',
                    text: 'ขอบคุณที่ใช้บริการครับ/ค่ะ',
                    margin: 'lg',
                    size: 'sm'
                  }
                ]
              }
            }
          }
        } else if (account.status === 'suspended') {
          messageContent = {
            type: 'flex',
            altText: 'แจ้งเตือน: License ถูกระงับ',
            contents: {
              type: 'bubble',
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '🚫 แจ้งเตือนสถานะ License',
                    weight: 'bold',
                    size: 'lg',
                    color: '#FF6600'
                  },
                  {
                    type: 'text',
                    text: 'License ของคุณถูกระงับชั่วคราว',
                    margin: 'md',
                    wrap: true
                  },
                  {
                    type: 'separator',
                    margin: 'md'
                  },
                  {
                    type: 'text',
                    text: `🔑 License Key: ${account.license}`,
                    weight: 'bold',
                    size: 'md',
                    color: '#000000',
                    margin: 'md'
                  },
                  {
                    type: 'text',
                    text: 'กรุณาติดต่อทีมงานเพื่อตรวจสอบและแก้ไข',
                    margin: 'md',
                    wrap: true
                  },
                  {
                    type: 'text',
                    text: 'ขอบคุณที่ใช้บริการครับ/ค่ะ',
                    margin: 'lg',
                    size: 'sm'
                  }
                ]
              }
            }
          }
        } else if (account.status === 'nearly_expired') {
          await CustomerAccount.updateOne(
            { _id: account._id, status: 'nearly_expired' },
            {
              $set: {
                lastNearlyExpiredNotifiedAt: new Date(),
                notified: false
              }
            }
          )
          let daysLeft = 3
          if (account.expireDate) {
            const now = new Date()
            let expireDate = new Date(account.expireDate)
            console.log('law expireDate:', account.expireDate)
            // Adjust for Thai Buddhist calendar (subtract 543 years if year > 2500)
            if (expireDate.getFullYear() > 2500) {
              expireDate.setFullYear(expireDate.getFullYear() - 543)
              // Swap month and day for correct DD/MM interpretation
              const tempMonth = expireDate.getMonth()
              const tempDate = expireDate.getDate()
              expireDate.setMonth(tempDate - 1)
              expireDate.setDate(tempMonth + 1)
            }
            console.log('adjusted expireDate:', expireDate)
            daysLeft = Math.ceil((expireDate - now) / (1000 * 60 * 60 * 24))
            console.log('daysLeft:', daysLeft)
            if (daysLeft > 3) daysLeft = 3
            if (daysLeft < 1) daysLeft = 1
          }
          messageContent = {
            type: 'flex',
            altText: 'แจ้งเตือน: License ใกล้หมดอายุ',
            contents: {
              type: 'bubble',
              body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '⏰ แจ้งเตือนสถานะ License',
                    weight: 'bold',
                    size: 'lg',
                    color: '#FFA500'
                  },
                  {
                    type: 'text',
                    text: `License ของคุณจะหมดอายุในอีก ${daysLeft} วัน`,
                    margin: 'md',
                    wrap: true
                  },
                  {
                    type: 'separator',
                    margin: 'md'
                  },
                  {
                    type: 'text',
                    text: `🔑 License Key: ${account.license}`,
                    weight: 'bold',
                    size: 'md',
                    color: '#000000',
                    margin: 'md'
                  },
                  {
                    type: 'text',
                    text: 'กรุณาติดต่อทีมงานเพื่อต่ออายุก่อนถึงกำหนด',
                    margin: 'md',
                    wrap: true
                  },
                  {
                    type: 'text',
                    text: 'ขอบคุณที่ใช้บริการครับ/ค่ะ',
                    margin: 'lg',
                    size: 'sm'
                  }
                ]
              }
            }
          }
        }
        console.log(
          `🔔 Notifying userLineId: ${account.userLineId} for account: ${account.accountNumber}`
        )
        const url = 'https://api.line.me/v2/bot/message/push'
        const body = {
          to: account.userLineId,
          messages: [messageContent]
        }
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
          },
          body: JSON.stringify(body)
        })
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`LINE API error: ${response.status} - ${errorText}`)
        }

        console.log(
          `✅ Notified user ${account.userLineId} for ${account.status} license.`
        )
      } catch (err) {
        console.error(`❌ Failed to notify user ${account.userLineId}:`, err)
        console.error(
          `🔍 Debugging account data: ${JSON.stringify(account, null, 2)}`
        )
      }
    }
  } catch (error) {
    console.error('❌ Error in customer account notification interval:', error)
  }
  console.log('🔄 Interval job completed.')
}, 180000) // 3 minutes
