import mongoose from 'mongoose'

let isConnected = false

export const connectDB = async () => {
  if (isConnected) {
    console.log('✅ Using existing MongoDB connection')
    return
  }

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/line-oa'
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })

    isConnected = true
    console.log('✅ MongoDB connected successfully')
    console.log('📊 Database:', mongoose.connection.name)
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err)
      isConnected = false
    })

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected')
      isConnected = false
    })

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected')
      isConnected = true
    })

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message)
    process.exit(1)
  }
}

export const disconnectDB = async () => {
  if (!isConnected) {
    return
  }

  try {
    await mongoose.disconnect()
    isConnected = false
    console.log('✅ MongoDB disconnected')
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error)
  }
}
