# Task Details & Evidence Backup

This backup contains all files related to the Task Details & Evidence functionality.

## Backup Date
Created: $(date)

## Frontend Files
- `/frontend/tasks/` - TaskDetail component and related components
- `/frontend/Tasks.jsx` - Main Tasks page component  
- `/frontend/taskGenerator.js` - Task generation service
- `/frontend/api-task-functions.txt` - Task-related API functions from api.js

## Backend Files
- `/backend/tasks/` - Complete Django tasks app
  - `models.py` - Task and TaskAttachment models
  - `views.py` - Task API endpoints
  - `serializers.py` - Task serializers
  - `urls.py` - Task URL patterns
  - `admin.py` - Django admin configuration
  - `utils.py` - Task utilities
  - `signals.py` - Task signals
  - `management/commands/` - Task management commands
  - `migrations/` - Database migrations
- `/backend/task_attachments/` - Evidence/attachment files

## Key Components
1. **TaskDetail.jsx** - Main task details modal with evidence upload
2. **Task Models** - Backend data models for tasks and attachments
3. **Task API Endpoints** - REST API for task CRUD operations
4. **File Upload System** - Evidence/attachment upload functionality

## Restoration
To restore this functionality:
1. Copy frontend files back to their original locations
2. Copy backend files back to their original locations  
3. Run database migrations if needed
4. Ensure media/task_attachments directory permissions are correct

## Related Features
- Task assignment to users
- Priority levels (High, Medium, Low)
- Task status tracking
- Evidence file uploads
- Task filtering and search
- ESG category organization