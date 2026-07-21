# Learning Platform - Complete Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (Community Edition)
- npm or yarn

### Step 1: Install MongoDB
1. Download MongoDB from https://www.mongodb.com/try/download/community
2. Install MongoDB Community Edition
3. Start MongoDB (it should start automatically as a service)

### Step 2: Setup Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Seed the database with sample data (optional but recommended)
npm run seed

# Start the backend server
npm run dev
```

The backend will be running at **http://localhost:3000**

### Step 3: Setup Frontend

```bash
# Navigate to frontend directory
cd learning-platform

# Install dependencies (if not already done)
npm install

# Start the development server
ionic serve
```

The frontend will be running at **http://localhost:4200**

### Step 4: Login

Use these test credentials (created by seed script):

**Admin Account:**
- Username: `admin`
- Password: `admin123`

**User Account:**
- Username: `testuser`
- Password: `user123`

---

## 📁 Project Structure

```
learning platform/
├── backend/                      # Node.js/Express backend
│   ├── src/
│   │   ├── models/              # MongoDB models
│   │   ├── controllers/         # Business logic
│   │   ├── routes/              # API routes
│   │   ├── middleware/          # Auth middleware
│   │   ├── config/              # Database config
│   │   └── server.js            # Main server file
│   ├── .env                     # Environment variables
│   ├── seed.js                  # Database seeder
│   ├── package.json
│   ├── README.md
│   └── API_DOCUMENTATION.md     # Complete API docs
│
├── learning-platform/           # Angular/Ionic frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/     # Reusable components
│   │   │   ├── pages/          # Page components
│   │   │   ├── services/       # API services
│   │   │   ├── models/         # TypeScript interfaces
│   │   │   ├── guards/         # Route guards
│   │   │   └── interceptors/   # HTTP interceptors
│   │   └── environments/        # Environment configs
│   └── package.json
│
├── setup-backend.bat            # Windows setup script
├── start-backend.bat            # Windows start script
├── BACKEND_SETUP.md            # Detailed backend setup
├── BACKEND_SUMMARY.md          # Implementation summary
└── README.md                   # This file
```

---

## 🎯 Features

### User Features
✅ User registration and authentication
✅ Browse topics by difficulty level and language
✅ View detailed topic content with:
   - Text descriptions
   - Code examples with syntax highlighting
   - Images
   - YouTube video embeds
✅ Personal notes with pin functionality
✅ Code playground for practice

### Admin Features
✅ Manage language tabs
✅ Create, edit, and delete topics
✅ Add subtopics with rich content
✅ Organize content by difficulty levels:
   - Beginner
   - Intermediate
   - Advance
   - Expert

---

## 🔧 Technologies Used

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **CORS** - Cross-origin resource sharing
- **Morgan** - HTTP request logger
- **dotenv** - Environment variables

### Frontend
- **Angular 18** - Frontend framework
- **Ionic 8** - Mobile UI components
- **TypeScript** - Type-safe JavaScript
- **RxJS** - Reactive programming
- **HttpClient** - API communication

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Language Tabs
- `GET /api/language-tabs` - Get all tabs
- `GET /api/language-tabs/active` - Get active tabs
- `POST /api/language-tabs` - Create tab (admin)
- `PUT /api/language-tabs/:id` - Update tab (admin)
- `DELETE /api/language-tabs/:id` - Delete tab (admin)

### Topics
- `GET /api/topics` - Get all topics
- `GET /api/topics/:id` - Get single topic
- `GET /api/topics/:topicId/subtopics/:subtopicId` - Get subtopic content
- `POST /api/topics` - Create topic (admin)
- `PUT /api/topics/:id` - Update topic (admin)
- `DELETE /api/topics/:id` - Delete topic (admin)
- `POST /api/topics/:topicId/subtopics` - Add subtopic (admin)
- `PUT /api/topics/:topicId/subtopics/:subtopicId` - Update subtopic (admin)
- `DELETE /api/topics/:topicId/subtopics/:subtopicId` - Delete subtopic (admin)

### User Notes
- `GET /api/notes` - Get user notes
- `POST /api/notes` - Create note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note

**For complete API documentation, see [backend/API_DOCUMENTATION.md](backend/API_DOCUMENTATION.md)**

---

## 🔐 Environment Variables

Backend `.env` file (already configured):

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/learning-platform
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRE=7d
NODE_ENV=development
```

Frontend environment files (already configured):
- `learning-platform/src/environments/environment.ts` (development)
- `learning-platform/src/environments/environment.prod.ts` (production)

---

## 🗄️ Database Schema

### User
```javascript
{
  username: String (unique),
  email: String (unique),
  password: String (hashed),
  role: String (user/admin),
  timestamps
}
```

### LanguageTab
```javascript
{
  name: String,
  code: String (html/css/javascript/typescript/scss),
  order: Number,
  isActive: Boolean,
  timestamps
}
```

### Topic
```javascript
{
  title: String,
  description: String,
  difficultyLevel: String (beginner/intermediate/advance/expert),
  languagePlatform: String,
  order: Number,
  subtopics: [{
    title: String,
    order: Number,
    content: [{
      type: String (description/code/image/youtube),
      order: Number,
      data: Object
    }]
  }],
  timestamps
}
```

### UserNote
```javascript
{
  userId: ObjectId (ref: User),
  content: String,
  isPinned: Boolean,
  timestamps
}
```

---

## 🧪 Testing the Application

### 1. Test Backend API

```bash
# Health check
curl http://localhost:3000/api/health

# Get topics
curl http://localhost:3000/api/topics

# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser2","email":"test@example.com","password":"test123"}'
```

### 2. Test Frontend

1. Open http://localhost:4200
2. Login with test credentials
3. Navigate through topics
4. Click on a topic to view content
5. Try the admin panel (admin account only)

---

## 🛠️ Development

### Backend Development

```bash
cd backend
npm run dev  # Starts with nodemon (auto-reload)
```

### Frontend Development

```bash
cd learning-platform
ionic serve  # Starts dev server with live reload
```

### Database Management

```bash
# Seed database with sample data
cd backend
npm run seed

# Reset and reseed
# Stop the server, delete the database, then run seed again
```

---

## 📝 Common Issues & Solutions

### Issue: MongoDB connection failed

**Solution:**
1. Make sure MongoDB is installed
2. Start MongoDB service:
   - Windows: Check "Services" app for "MongoDB Server"
   - Or run `mongod` manually
3. Verify connection string in `.env`

### Issue: Port 3000 already in use

**Solution:**
1. Change PORT in backend `.env` file
2. Update `apiUrl` in frontend environment files

### Issue: CORS errors

**Solution:**
- CORS is already enabled in backend
- Make sure backend is running before starting frontend
- Check browser console for specific error

### Issue: Token expired

**Solution:**
- Login again to get a new token
- Token expires after 7 days (configurable in `.env`)

### Issue: Content not showing when clicking topics

**Solution:**
- This is fixed! The backend API now serves content
- Make sure backend is running
- Check browser console for API errors
- Verify topics have content in database

---

## 🚀 Deployment

### Backend Deployment

1. Set production environment variables
2. Change `JWT_SECRET` to a strong secret
3. Update MongoDB URI for production
4. Deploy to services like:
   - Heroku
   - Railway
   - AWS EC2
   - DigitalOcean

### Frontend Deployment

1. Update `environment.prod.ts` with production API URL
2. Build for production:
   ```bash
   ionic build --prod
   ```
3. Deploy to:
   - Netlify
   - Vercel
   - Firebase Hosting
   - AWS S3 + CloudFront

---

## 📚 Additional Documentation

- [Backend Setup Guide](BACKEND_SETUP.md) - Detailed backend setup
- [Backend Summary](BACKEND_SUMMARY.md) - Implementation overview
- [API Documentation](backend/API_DOCUMENTATION.md) - Complete API reference
- [Backend README](backend/README.md) - Backend-specific docs

---

## 🤝 Support

If you encounter any issues:

1. Check if MongoDB is running
2. Verify backend is running on port 3000
3. Check browser console for errors
4. Check backend terminal for errors
5. Review the documentation files

---

## ✅ What's Working

✅ Complete backend API with 24 endpoints
✅ User authentication with JWT
✅ Role-based access control
✅ Topic content management
✅ Subtopic content retrieval **← This fixes your issue!**
✅ User notes functionality
✅ Frontend integration with backend
✅ Sample data seeder
✅ Setup scripts for Windows

---

## 📄 License

ISC

---

**Status: ✅ Ready to Use**

Your issue of "nothing visible when clicking topics" is now fully resolved with a complete backend implementation!
