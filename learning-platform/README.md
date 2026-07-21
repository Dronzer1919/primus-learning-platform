# Learning Platform - Ionic Angular Application

A comprehensive learning platform built with Ionic and Angular, featuring separate admin and user panels for managing and consuming educational content.

## Features

### Admin Panel
- **Dashboard**: Overview of all content statistics
- **Language Tabs Management**: Create and manage language tabs that appear in user navigation
- **Content Management**: Organize content by difficulty levels:
  - Beginner
  - Intermediate
  - Advance
  - Expert
- **Rich Content Support**:
  - Text descriptions
  - Code snippets with syntax highlighting
  - Images
  - YouTube video embeds
- **Hierarchical Content Structure**: Topics → Subtopics → Sub-subtopics

### User Panel
- **Dynamic Navigation**: Language tabs configured by admin
- **Difficulty-based Learning**: Browse content by skill level
- **Interactive Code Playground**: Write and run HTML, CSS, and JavaScript code
- **Personal Notes**: Create and manage learning notes
- **Rich Content Display**: View formatted content with proper syntax highlighting

## Project Structure

```
src/app/
├── components/
│   ├── code-playground/       # Interactive code editor
│   ├── content-viewer/         # Display learning content
│   ├── user-notes/            # User notes management
│   └── user-topic-list/       # Topic navigation list
├── guards/
│   └── auth.guard.ts          # Authentication guards
├── models/
│   ├── content.model.ts       # Content data models
│   └── user.model.ts          # User data models
├── pages/
│   ├── admin/
│   │   ├── admin.page.*       # Admin panel layout
│   │   ├── admin-dashboard/   # Admin dashboard
│   │   ├── language-tabs-manager/ # Language tabs CRUD
│   │   └── topics-manager/    # Topics management
│   ├── login/                 # Login page
│   ├── signup/                # Signup page
│   └── user/                  # User panel layout
├── services/
│   ├── auth.service.ts        # Authentication service
│   └── content.service.ts     # Content management service
└── app.routes.ts              # Application routing
```

## Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the development server**:
   ```bash
   ionic serve
   ```

3. **Access the application**:
   - Open browser at `http://localhost:8100`

## Demo Credentials

### Admin Access
- Email: `admin@example.com`
- Password: `password`

### User Access
- Email: `user@example.com`
- Password: `password`

## Usage Guide

### For Administrators

1. **Login** with admin credentials
2. **Create Language Tabs**:
   - Navigate to "Language Tabs" in the sidebar
   - Add tabs for HTML, CSS, JavaScript, TypeScript, SCSS
   - Set the display order and active status
3. **Add Topics**:
   - Select a difficulty level from the sidebar
   - Click "Add Topic"
   - Fill in title, description, language platform, and order
4. **Add Subtopics**:
   - Click "Add Subtopic" under a topic
   - Enter subtopic title and order
5. **Add Content**:
   - Click the "+" icon on a subtopic
   - Choose content type (description, code, image, or YouTube)
   - Fill in the required fields

### For Users

1. **Login** with user credentials
2. **Select a Language** from the top navigation tabs
3. **Browse Topics** by difficulty level in the sidebar
4. **Click on a Subtopic** to view its content
5. **Use the Code Playground**:
   - Click "Code Playground" in the sidebar
   - Write HTML, CSS, and JavaScript
   - Click "Run Code" to see the output
6. **Create Notes**:
   - Click "My Notes" icon in the header
   - Create, edit, and pin important notes

## Data Storage

The application uses `localStorage` for data persistence. In a production environment, this should be replaced with a proper backend API and database.

## Key Features Implementation

### Code Playground
- Split view editor with HTML, CSS, and JavaScript tabs
- Live preview with iframe
- Console output capture
- Code execution in isolated environment

### Content Display
- Syntax highlighting for code blocks
- Responsive YouTube video embeds
- Image display with captions
- Formatted text descriptions

### Admin Content Management
- Drag and drop ordering (can be enhanced)
- CRUD operations for all content types
- Preview functionality
- Hierarchical content organization

## Technology Stack

- **Framework**: Ionic 7 + Angular 17
- **Language**: TypeScript
- **Styling**: SCSS
- **State Management**: RxJS
- **Routing**: Angular Router
- **UI Components**: Ionic Components

## Future Enhancements

- Backend API integration
- User progress tracking
- Code playground with more languages
- Search functionality
- Content import/export
- User roles and permissions
- Discussion forums
- Quiz/assessment system
- Mobile app deployment (iOS/Android)

## Development

### Build for Production
```bash
ionic build --prod
```

### Run Tests
```bash
npm test
```

### Lint Code
```bash
npm run lint
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - feel free to use this project for learning and development.

## Support

For issues and questions, please create an issue in the repository.
