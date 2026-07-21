# Learning Platform Backend

Backend API for the Learning Platform application built with Node.js, Express, and MongoDB.

## Features

- User authentication with JWT
- Role-based access control (Admin/User)
- Language tabs management
- Topics and subtopics management with content blocks
- User notes functionality
- RESTful API design

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the values in `.env` file

3. Start MongoDB service

4. Run the server:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Language Tabs
- `GET /api/language-tabs` - Get all language tabs
- `GET /api/language-tabs/active` - Get active language tabs
- `POST /api/language-tabs` - Create language tab (admin)
- `PUT /api/language-tabs/:id` - Update language tab (admin)
- `DELETE /api/language-tabs/:id` - Delete language tab (admin)

### Topics
- `GET /api/topics` - Get all topics (with optional filters)
- `GET /api/topics/:id` - Get single topic
- `GET /api/topics/:topicId/subtopics/:subtopicId` - Get subtopic content
- `POST /api/topics` - Create topic (admin)
- `PUT /api/topics/:id` - Update topic (admin)
- `DELETE /api/topics/:id` - Delete topic (admin)
- `POST /api/topics/:topicId/subtopics` - Add subtopic (admin)
- `PUT /api/topics/:topicId/subtopics/:subtopicId` - Update subtopic (admin)
- `DELETE /api/topics/:topicId/subtopics/:subtopicId` - Delete subtopic (admin)

### User Notes
- `GET /api/notes` - Get all user notes (protected)
- `GET /api/notes/:id` - Get single note (protected)
- `POST /api/notes` - Create note (protected)
- `PUT /api/notes/:id` - Update note (protected)
- `DELETE /api/notes/:id` - Delete note (protected)

## Environment Variables

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/learning-platform
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRE=7d
NODE_ENV=development
```

## Database Schema

### User
- username (String, unique, required)
- email (String, unique, required)
- password (String, hashed, required)
- role (String: 'user' | 'admin')
- timestamps

### LanguageTab
- name (String)
- code (String: 'html' | 'scss' | 'css' | 'typescript' | 'javascript')
- order (Number)
- isActive (Boolean)
- timestamps

### Topic
- title (String)
- description (String)
- difficultyLevel (String: 'beginner' | 'intermediate' | 'advance' | 'expert')
- languagePlatform (String)
- order (Number)
- subtopics (Array of Subtopic)
- timestamps

### Subtopic
- title (String)
- order (Number)
- content (Array of ContentBlock)
- subSubtopics (Array of SubSubtopic)

### ContentBlock
- type (String: 'description' | 'code' | 'image' | 'youtube')
- order (Number)
- data (Mixed)

### UserNote
- userId (ObjectId, ref: User)
- content (String)
- isPinned (Boolean)
- timestamps

## License

ISC
