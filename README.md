# Line Official Account Backend

Backend service for Line Official Account (Line OA) that collects user messages and stores them in MongoDB.

## Features

- ✅ Automatically collects Line User ID when users add bot as friend
- ✅ Stores all messages with user profile information
- ✅ MongoDB database integration
- ✅ RESTful API for querying users and messages
- ✅ Webhook verification and security
- ✅ User profile management (follow/unfollow tracking)
- ✅ Message history and statistics

## Prerequisites

1. **Line Developers Account**
   - Create a Line Official Account at [Line Developers Console](https://developers.line.biz/console/)
   - Get your Channel Secret and Channel Access Token

2. **MongoDB**
   - Local MongoDB installation, OR
   - MongoDB Atlas account (free tier available)

3. **Node.js**
   - Version 18.x or higher

## Installation

### 1. Clone and Install Dependencies

```bash
cd line-oa-backend
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/line-oa
# Or MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/line-oa

# Line OA Credentials (from Line Developers Console)
LINE_CHANNEL_SECRET=your_channel_secret_here
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here

# Server
PORT=4000
```

### 3. Get Line Credentials

1. Go to [Line Developers Console](https://developers.line.biz/console/)
2. Create or select your Messaging API channel
3. Get credentials:
   - **Channel Secret**: Basic settings → Channel secret
   - **Channel Access Token**: Messaging API → Channel access token (issue if not exists)

## Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

Server will start on `http://localhost:4000`

## Setting Up Line Webhook

### Option 1: Local Development with ngrok

1. **Install ngrok**:
   ```bash
   # macOS
   brew install ngrok
   
   # Or download from https://ngrok.com/download
   ```

2. **Start your server**:
   ```bash
   npm run dev
   ```

3. **Create ngrok tunnel** (in another terminal):
   ```bash
   ngrok http 4000
   ```

4. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

5. **Configure Line webhook**:
   - Go to Line Developers Console
   - Select your channel
   - Go to "Messaging API" tab
   - Set Webhook URL: `https://abc123.ngrok.io/webhook`
   - Enable "Use webhook"
   - Click "Verify" to test

### Option 2: Deploy to Production Server

Deploy to your server and use your domain:

```
https://your-domain.com/webhook
```

Set this as the webhook URL in Line Developers Console.

## API Endpoints

### Health Check
```bash
GET /health
```
Returns server status

### Get Statistics
```bash
GET /api/users/stats
```
Returns:
```json
{
  "success": true,
  "data": {
    "totalUsers": 10,
    "activeUsers": 8,
    "inactiveUsers": 2,
    "totalMessages": 150
  }
}
```

### Get All Users
```bash
GET /api/users?limit=50&skip=0&isFriend=true
```
Query parameters:
- `limit`: Number of users to return (default: 50)
- `skip`: Number to skip for pagination (default: 0)
- `isFriend`: Filter by friend status (true/false, optional)

### Get User's Messages
```bash
GET /api/users/:userId/messages?limit=50
```
Returns all messages from a specific user.

### Get All Messages
```bash
GET /api/messages?limit=100&skip=0
```
Returns all messages with pagination.

## Testing

### Test the Webhook

Send a test message from Line app:

1. Add your Line OA as a friend (scan QR code from Line Developers Console)
2. Send a message: "hello my name is kla"
3. Check server logs - you should see:
   ```
   📨 Webhook received
   💬 Message from U1234567890: "hello my name is kla"
   ✅ Message saved to database
   ```

### Query the Database

Get user statistics:
```bash
curl http://localhost:4000/api/users/stats
```

Get all users:
```bash
curl http://localhost:4000/api/users
```

Get all messages:
```bash
curl http://localhost:4000/api/messages
```

## Database Schema

### LineUser Collection
```javascript
{
  userId: String,           // Line User ID (unique)
  displayName: String,      // User's name
  pictureUrl: String,       // Profile picture URL
  statusMessage: String,    // User's status
  friendedAt: Date,         // When user added bot
  isFriend: Boolean,        // Currently friend?
  messageCount: Number,     // Total messages sent
  lastMessageAt: Date       // Last message time
}
```

### LineMessage Collection
```javascript
{
  userId: String,           // Line User ID
  displayName: String,      // User's name
  messageText: String,      // Message content
  messageId: String,        // Line message ID
  timestamp: Date,          // When message was sent
  isFirstMessage: Boolean,  // First message from user?
  responseText: String,     // Bot's response
  respondedAt: Date        // When bot responded
}
```

## Project Structure

```
line-oa-backend/
├── server.js              # Main Express server
├── package.json           # Dependencies
├── .env                   # Environment variables (create from .env.example)
├── .env.example          # Environment template
├── config/
│   └── database.js       # MongoDB connection
├── models/
│   ├── LineUser.js       # User schema
│   └── LineMessage.js    # Message schema
└── README.md             # This file
```

## Deployment with PM2

### Install PM2
```bash
npm install -g pm2
```

### Start the app
```bash
pm2 start server.js --name line-oa-backend
```

### Monitor
```bash
pm2 logs line-oa-backend
pm2 monit
```

### Auto-restart on server reboot
```bash
pm2 startup
pm2 save
```

## Deployment with Docker (Optional)

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 4000
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t line-oa-backend .
docker run -p 4000:4000 --env-file .env line-oa-backend
```

## Troubleshooting

### Webhook not receiving events

1. **Check webhook URL is HTTPS** (ngrok provides HTTPS)
2. **Verify webhook in Line Console** (should show green checkmark)
3. **Enable "Use webhook"** in Messaging API settings
4. **Check server logs** for incoming requests
5. **Verify Channel Secret and Access Token** are correct

### MongoDB connection failed

1. **Check MONGODB_URI** is correct
2. **MongoDB is running** (if local): `mongod --version`
3. **Network access allowed** (if MongoDB Atlas)
4. **Check firewall** settings

### Bot not responding

1. **Check LINE_CHANNEL_ACCESS_TOKEN** is valid
2. **Look at server logs** for error messages
3. **Verify message handling** in code
4. **Check replyToken** is being used within 1 minute

## Example Usage Flow

1. User adds your Line OA as friend
   - `follow` event received
   - User profile fetched
   - User saved to `LineUser` collection
   - Welcome message sent

2. User sends: "hello my name is kla"
   - `message` event received
   - Message saved to `LineMessage` collection
   - User's `messageCount` incremented
   - Confirmation reply sent back

3. Admin queries API
   - `GET /api/users/stats` → See total users and messages
   - `GET /api/users` → List all users
   - `GET /api/messages` → See all messages

## Security Notes

- ✅ Line SDK validates webhook signatures automatically
- ✅ Keep `.env` file secure (never commit to git)
- ✅ Use environment variables for all secrets
- ✅ Add `.env` to `.gitignore`

## Next Steps

- [ ] Add authentication for API endpoints
- [ ] Add rich message templates (buttons, carousels)
- [ ] Add broadcast messaging feature
- [ ] Add admin dashboard UI
- [ ] Add message analytics
- [ ] Add user tagging system
- [ ] Add automated responses based on keywords

## Resources

- [Line Messaging API Documentation](https://developers.line.biz/en/docs/messaging-api/)
- [Line Bot SDK Node.js](https://github.com/line/line-bot-sdk-nodejs)
- [MongoDB Node Driver](https://www.mongodb.com/docs/drivers/node/)

## License

MIT

## Support

For issues or questions, check:
- Line API documentation
- Server logs: `pm2 logs line-oa-backend`
- MongoDB logs: `journalctl -u mongodb`
# lineOA
