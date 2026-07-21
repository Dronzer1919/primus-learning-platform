# Learning Platform API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## Authentication Endpoints

### Register User
Create a new user account.

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "user"  // Optional: "user" or "admin", defaults to "user"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

### Login User
Authenticate and receive a JWT token.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "username": "john_doe",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

### Get Current User
Get the currently authenticated user's information.

**Endpoint:** `GET /api/auth/me`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

---

## Language Tabs Endpoints

### Get All Language Tabs
Retrieve all language tabs.

**Endpoint:** `GET /api/language-tabs`

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "HTML",
      "code": "html",
      "order": 1,
      "isActive": true,
      "createdAt": "2026-01-26T10:00:00.000Z",
      "updatedAt": "2026-01-26T10:00:00.000Z"
    }
  ]
}
```

### Get Active Language Tabs
Retrieve only active language tabs.

**Endpoint:** `GET /api/language-tabs/active`

**Response:** `200 OK` (same structure as above, filtered by isActive: true)

### Create Language Tab (Admin Only)
Create a new language tab.

**Endpoint:** `POST /api/language-tabs`

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:**
```json
{
  "name": "Python",
  "code": "python",
  "order": 6,
  "isActive": true
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Language tab created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Python",
    "code": "python",
    "order": 6,
    "isActive": true
  }
}
```

### Update Language Tab (Admin Only)
Update an existing language tab.

**Endpoint:** `PUT /api/language-tabs/:id`

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:**
```json
{
  "name": "Python 3",
  "order": 7,
  "isActive": false
}
```

**Response:** `200 OK`

### Delete Language Tab (Admin Only)
Delete a language tab.

**Endpoint:** `DELETE /api/language-tabs/:id`

**Headers:** `Authorization: Bearer <admin_token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Language tab deleted successfully"
}
```

---

## Topics Endpoints

### Get All Topics
Retrieve all topics with optional filters.

**Endpoint:** `GET /api/topics`

**Query Parameters:**
- `difficultyLevel` (optional): Filter by difficulty (beginner, intermediate, advance, expert)
- `languagePlatform` (optional): Filter by language (html, scss, css, typescript, javascript)

**Example:** `GET /api/topics?difficultyLevel=beginner&languagePlatform=html`

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "title": "HTML Basics",
      "description": "Learn the fundamentals of HTML",
      "difficultyLevel": "beginner",
      "languagePlatform": "html",
      "order": 1,
      "subtopics": [
        {
          "_id": "507f1f77bcf86cd799439012",
          "title": "HTML Structure",
          "order": 1,
          "content": [
            {
              "type": "description",
              "order": 1,
              "data": {
                "text": "HTML documents have a basic structure..."
              }
            }
          ],
          "subSubtopics": []
        }
      ],
      "createdAt": "2026-01-26T10:00:00.000Z",
      "updatedAt": "2026-01-26T10:00:00.000Z"
    }
  ]
}
```

### Get Single Topic
Retrieve a specific topic by ID.

**Endpoint:** `GET /api/topics/:id`

**Response:** `200 OK` (same structure as single item from Get All Topics)

### Get Subtopic Content
Retrieve content for a specific subtopic.

**Endpoint:** `GET /api/topics/:topicId/subtopics/:subtopicId`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "topic": {
      "id": "507f1f77bcf86cd799439011",
      "title": "HTML Basics",
      "description": "Learn the fundamentals of HTML"
    },
    "subtopic": {
      "_id": "507f1f77bcf86cd799439012",
      "title": "HTML Structure",
      "order": 1,
      "content": [
        {
          "type": "description",
          "order": 1,
          "data": {
            "text": "HTML documents have a basic structure..."
          }
        },
        {
          "type": "code",
          "order": 2,
          "data": {
            "language": "html",
            "code": "<!DOCTYPE html>\n<html>\n  <head>...</head>\n  <body>...</body>\n</html>",
            "title": "Basic HTML Template"
          }
        }
      ]
    }
  }
}
```

### Create Topic (Admin Only)
Create a new topic.

**Endpoint:** `POST /api/topics`

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:**
```json
{
  "title": "CSS Flexbox",
  "description": "Master CSS Flexbox layout",
  "difficultyLevel": "intermediate",
  "languagePlatform": "css",
  "order": 5,
  "subtopics": []
}
```

**Response:** `201 Created`

### Update Topic (Admin Only)
Update an existing topic.

**Endpoint:** `PUT /api/topics/:id`

**Headers:** `Authorization: Bearer <admin_token>`

**Response:** `200 OK`

### Delete Topic (Admin Only)
Delete a topic.

**Endpoint:** `DELETE /api/topics/:id`

**Headers:** `Authorization: Bearer <admin_token>`

**Response:** `200 OK`

### Add Subtopic (Admin Only)
Add a subtopic to a topic.

**Endpoint:** `POST /api/topics/:topicId/subtopics`

**Headers:** `Authorization: Bearer <admin_token>`

**Request Body:**
```json
{
  "title": "Flexbox Properties",
  "order": 1,
  "content": [
    {
      "type": "description",
      "order": 1,
      "data": {
        "text": "Learn about flex container properties..."
      }
    }
  ]
}
```

**Response:** `201 Created`

### Update Subtopic (Admin Only)
Update a subtopic.

**Endpoint:** `PUT /api/topics/:topicId/subtopics/:subtopicId`

**Headers:** `Authorization: Bearer <admin_token>`

**Response:** `200 OK`

### Delete Subtopic (Admin Only)
Delete a subtopic.

**Endpoint:** `DELETE /api/topics/:topicId/subtopics/:subtopicId`

**Headers:** `Authorization: Bearer <admin_token>`

**Response:** `200 OK`

---

## User Notes Endpoints

### Get All User Notes
Retrieve all notes for the authenticated user.

**Endpoint:** `GET /api/notes`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "userId": "507f1f77bcf86cd799439010",
      "content": "Remember to review CSS Grid tomorrow",
      "isPinned": true,
      "createdAt": "2026-01-26T10:00:00.000Z",
      "updatedAt": "2026-01-26T10:00:00.000Z"
    }
  ]
}
```

### Get Single Note
Retrieve a specific note.

**Endpoint:** `GET /api/notes/:id`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`

### Create Note
Create a new note.

**Endpoint:** `POST /api/notes`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "content": "Important: Study flexbox alignment",
  "isPinned": false
}
```

**Response:** `201 Created`

### Update Note
Update an existing note.

**Endpoint:** `PUT /api/notes/:id`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "content": "Updated note content",
  "isPinned": true
}
```

**Response:** `200 OK`

### Delete Note
Delete a note.

**Endpoint:** `DELETE /api/notes/:id`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Note deleted successfully"
}
```

---

## Content Block Types

### Description Block
```json
{
  "type": "description",
  "order": 1,
  "data": {
    "text": "Your description text here (supports HTML)"
  }
}
```

### Code Block
```json
{
  "type": "code",
  "order": 2,
  "data": {
    "language": "javascript",
    "code": "const x = 10;\nconsole.log(x);",
    "title": "Optional code title"
  }
}
```

### Image Block
```json
{
  "type": "image",
  "order": 3,
  "data": {
    "url": "https://example.com/image.jpg",
    "alt": "Image description",
    "caption": "Optional caption"
  }
}
```

### YouTube Block
```json
{
  "type": "youtube",
  "order": 4,
  "data": {
    "videoId": "dQw4w9WgXcQ",
    "title": "Optional video title"
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error message"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "No token, authorization denied"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied. Admin privileges required."
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Server error"
}
```

---

## Rate Limiting

Currently, there is no rate limiting implemented. This should be added in production.

## CORS

CORS is enabled for all origins in development. In production, configure specific allowed origins in the server.js file.
