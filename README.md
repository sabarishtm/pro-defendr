# Defendr Content Moderation Platform

Defendr is an advanced content moderation platform that enables intelligent and efficient digital media review through sophisticated AI-powered analysis and real-time processing. It provides a comprehensive solution for managing and moderating digital content across various media types including images, videos, and text.

## Key Features

- 🤖 AI-Powered Content Analysis
  - Automated content screening using TheHive AI
  - Real-time content classification
  - Multi-modal support (images, videos, text)
  - Confidence scoring and risk assessment

- 📊 Dynamic Content Management
  - Intuitive content review interface
  - Real-time content status updates
  - Priority-based content queue
  - Multi-state workflow management
  - Timeline analysis for video content

- 👥 User Management
  - Role-based access control
  - Customizable user permissions
  - Secure authentication system
  - Team collaboration features

- 📈 Analytics & Reporting
  - Detailed moderation metrics
  - Content analysis statistics
  - Performance monitoring
  - Custom report generation

## Technical Stack

- **Frontend**: TypeScript, React, TailwindCSS
- **Backend**: Node.js, Express
- **Database**: PostgreSQL (with Neon)
- **ORM**: Drizzle
- **AI Integration**: TheHive AI
- **Authentication**: Passport.js
- **State Management**: TanStack Query

## Prerequisites

Before installing Defendr, ensure you have the following installed:

- Node.js (v20.x or later)
- PostgreSQL (v15.x or later)
- Git

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/defendr.git
cd defendr
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following variables:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/defendr
THEHIVE_API_KEY=your_thehive_api_key
SESSION_SECRET=your_session_secret
```

4. Initialize the database:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Configuration

### Database Configuration

The application uses Drizzle ORM for database management. Database configuration can be found in `server/db.ts`. Modify the connection settings in your `.env` file if needed.

### AI Service Configuration

TheHive AI service configuration is located in `server/services/ai.ts`. You'll need to obtain an API key from TheHive and set it in your environment variables.

### User Roles and Permissions

User roles and permissions can be configured in `server/utils/permissions.ts`. The default roles are:
- Admin: Full system access
- Moderator: Content review and moderation
- Viewer: Read-only access

## Usage Guide

### Content Upload

1. Navigate to the content upload page
2. Select or drag-and-drop content (images, videos, or text)
3. The system will automatically process and analyze the content
4. Content will be queued for moderation based on priority

### Content Moderation

1. Access the moderation dashboard
2. View content items in the moderation queue
3. Review AI analysis and confidence scores
4. Make moderation decisions (approve/reject/escalate)
5. Add notes or tags as needed

### Video Timeline Analysis

1. Upload video content
2. System generates frame-by-frame analysis
3. Review timeline markers for potential issues
4. Navigate through flagged timestamps
5. Make moderation decisions based on comprehensive analysis

### Analytics Dashboard

1. Access the analytics section
2. View moderation statistics and metrics
3. Generate custom reports
4. Monitor team performance
5. Track content trends and patterns

## API Documentation

### Content Endpoints

```typescript
POST /api/content
- Upload new content for moderation
- Supports multipart/form-data for file uploads

GET /api/content
- Retrieve content list with filtering options
- Query parameters: status, type, priority, assignedTo

PATCH /api/content/:id
- Update content status or assignment
- Requires moderator or admin role

GET /api/content/:id
- Retrieve detailed content information including AI analysis
```

### User Endpoints

```typescript
POST /api/auth/login
- User authentication
- Returns session token

GET /api/users
- List users (admin only)
- Includes role and permission data

PATCH /api/users/:id
- Update user roles/permissions
- Requires admin role
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository or contact the development team.
