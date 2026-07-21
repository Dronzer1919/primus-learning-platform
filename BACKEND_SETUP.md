# Learning Platform - Backend Setup Guide

## Prerequisites

Before running the backend, ensure you have:
1. Node.js (v14 or higher) installed
2. MongoDB installed and running

## Installation Steps

### 1. Install MongoDB

**Windows:**
- Download MongoDB from https://www.mongodb.com/try/download/community
- Install MongoDB Community Edition
- MongoDB will run as a Windows service

**To start MongoDB manually (if not running as service):**
```bash
mongod
```

### 2. Install Backend Dependencies

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

### 3. Configure Environment Variables

The `.env` file is already created with default values. You can modify them if needed:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/learning-platform
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRE=7d
NODE_ENV=development
```

**Important:** Change `JWT_SECRET` to a strong secret key in production!

### 4. Start the Backend Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on http://localhost:3000

### 5. Verify Backend is Running

Visit http://localhost:3000/api/health in your browser. You should see:
```json
{
  "success": true,
  "message": "Learning Platform API is running",
  "timestamp": "2026-01-26T..."
}
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user  
- `GET /api/auth/me` - Get current user (requires auth)

### Language Tabs
- `GET /api/language-tabs` - Get all language tabs
- `GET /api/language-tabs/active` - Get active tabs
- `POST /api/language-tabs` - Create tab (admin only)
- `PUT /api/language-tabs/:id` - Update tab (admin only)
- `DELETE /api/language-tabs/:id` - Delete tab (admin only)

### Topics
- `GET /api/topics` - Get all topics
- `GET /api/topics/:id` - Get single topic
- `GET /api/topics/:topicId/subtopics/:subtopicId` - Get subtopic content
- `POST /api/topics` - Create topic (admin only)
- `PUT /api/topics/:id` - Update topic (admin only)
- `DELETE /api/topics/:id` - Delete topic (admin only)

### User Notes
- `GET /api/notes` - Get user notes (requires auth)
- `POST /api/notes` - Create note (requires auth)
- `PUT /api/notes/:id` - Update note (requires auth)
- `DELETE /api/notes/:id` - Delete note (requires auth)

## Frontend Configuration

The Angular frontend is already configured to connect to the backend. The API URL is set in:
- `learning-platform/src/environments/environment.ts` (development)
- `learning-platform/src/environments/environment.prod.ts` (production)

Default API URL: `http://localhost:3000/api`

## Troubleshooting

### MongoDB Connection Issues

If you get "MongoDB connection failed":
1. Make sure MongoDB is running: `mongod` or check Windows Services
2. Verify the connection string in `.env` is correct
3. Check if port 27017 is available

### Port Already in Use

If port 3000 is already in use:
1. Change the `PORT` in `.env` file
2. Update the `apiUrl` in Angular environment files to match

### CORS Issues

If you get CORS errors:
- The backend is already configured with CORS enabled
- Ensure the Angular app is running on a different port (like 4200)
- Check browser console for specific CORS error messages

## Testing the APIs

You can use tools like:
- Postman
- Thunder Client (VS Code extension)
- curl commands

Example curl command to test:
```bash
curl http://localhost:3000/api/health
```

## Creating an Admin User

To create an admin user, register with the API and set role to 'admin':

```json
POST /api/auth/register
{
  "username": "admin",
  "email": "admin@example.com",
  "password": "admin123",
  "role": "admin"
}
```

## Next Steps

1. Start MongoDB
2. Run `npm install` in backend directory
3. Run `npm run dev` to start backend
4. Start Angular frontend: `ionic serve` in learning-platform directory
5. Access the app at http://localhost:4200
