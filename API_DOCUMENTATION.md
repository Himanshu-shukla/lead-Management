# Lead Manager API Documentation

## Base URL
```
https://api.leads.edtechinformative.uk/api
```

## Authentication
All API endpoints except login require a JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Response Format
All API responses follow this standard format:
```json
{
  "success": boolean,
  "message": string,
  "data": any, // Present on successful requests
  "errors": string[], // Present on failed requests
  "pagination": { // Present on paginated responses
    "page": number,
    "limit": number,
    "total": number,
    "totalPages": number
  }
}
```

---

## 🔐 Authentication Endpoints

### POST /api/auth/login
**Description**: User login  
**Access**: Public  
**Request Body**:
```json
{
  "email": "admin@leadmanager.com",
  "password": "admin123456"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Admin User",
      "email": "admin@leadmanager.com",
      "role": "admin",
      "isActive": true,
      "createdAt": "2023-01-01T00:00:00.000Z",
      "lastLogin": "2023-12-01T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### POST /api/auth/logout
**Description**: User logout  
**Access**: Public  
**Request Body**: Empty
**Response**:
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### POST /api/auth/register
**Description**: Register new user (Admin only)  
**Access**: Admin only  
**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "user"
}
```
**Response**:
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "isActive": true,
    "createdAt": "2023-12-01T10:30:00.000Z"
  }
}
```

### GET /api/auth/me
**Description**: Get current user profile  
**Access**: Authenticated users  
**Response**:
```json
{
  "success": true,
  "message": "User profile retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Admin User",
    "email": "admin@leadmanager.com",
    "role": "admin",
    "isActive": true,
    "createdAt": "2023-01-01T00:00:00.000Z",
    "lastLogin": "2023-12-01T10:30:00.000Z"
  }
}
```

### PUT /api/auth/profile
**Description**: Update user profile  
**Access**: Authenticated users  
**Request Body**:
```json
{
  "name": "Updated Name",
  "email": "newemail@example.com"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Updated Name",
    "email": "newemail@example.com",
    "role": "admin",
    "isActive": true,
    "createdAt": "2023-01-01T00:00:00.000Z"
  }
}
```

### PUT /api/auth/change-password
**Description**: Change user password  
**Access**: Authenticated users  
**Request Body**:
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword456"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## 👥 User Management Endpoints

### GET /api/users
**Description**: Get all users  
**Access**: Admin only  
**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response**:
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Admin User",
      "email": "admin@leadmanager.com",
      "role": "admin",
      "isActive": true,
      "createdAt": "2023-01-01T00:00:00.000Z",
      "lastLogin": "2023-12-01T10:30:00.000Z"
    },
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "isActive": true,
      "createdAt": "2023-11-01T00:00:00.000Z",
      "lastLogin": "2023-12-01T09:15:00.000Z"
    }
  ]
}
```

### GET /api/users/:id
**Description**: Get user by ID  
**Access**: Admin only  
**Response**:
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "isActive": true,
    "createdAt": "2023-11-01T00:00:00.000Z",
    "lastLogin": "2023-12-01T09:15:00.000Z"
  }
}
```

### POST /api/users
**Description**: Create new user  
**Access**: Admin only  
**Request Body**:
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "password123",
  "role": "user"
}
```
**Response**:
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "role": "user",
    "isActive": true,
    "createdAt": "2023-12-01T10:30:00.000Z"
  }
}
```

### PUT /api/users/:id
**Description**: Update user  
**Access**: Admin only  
**Request Body**:
```json
{
  "name": "Jane Smith Updated",
  "role": "admin",
  "isActive": false
}
```
**Response**:
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "name": "Jane Smith Updated",
    "email": "jane@example.com",
    "role": "admin",
    "isActive": false,
    "createdAt": "2023-12-01T10:30:00.000Z"
  }
}
```

### DELETE /api/users/:id
**Description**: Delete user  
**Access**: Admin only  
**Response**:
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

### GET /api/users/stats
**Description**: Get user statistics  
**Access**: Admin only  
**Response**:
```json
{
  "success": true,
  "message": "User statistics retrieved successfully",
  "data": {
    "totalUsers": 15,
    "activeUsers": 12,
    "adminUsers": 3,
    "userUsers": 12
  }
}
```

---

## 📋 Lead Management Endpoints

### GET /api/leads
**Description**: Get leads (filtered by user role)  
**Access**: Authenticated users  
**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `status` (optional): Filter by status (can be multiple)
- `source` (optional): Filter by source (can be multiple)
- `priority` (optional): Filter by priority (can be multiple)
- `assignedTo` (optional): Filter by assigned user (Admin only)
- `folder` (optional): Filter by folder (can be multiple)
- `search` (optional): Text search in name, email, company

**Example**: `/api/leads?page=1&limit=10&status=New&status=Contacted&search=john`

**Response**:
```json
{
  "success": true,
  "message": "Leads retrieved successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439021",
      "name": "John Smith",
      "email": "john.smith@company.com",
      "phone": "+1-555-0123",
      "company": "Tech Corp",
      "position": "Marketing Manager",
      "folder": "Enterprise",
      "source": "Website",
      "status": "New",
      "priority": "High",
      "leadScore": 75,
      "assignedTo": "507f1f77bcf86cd799439012",
      "assignedToUser": {
        "_id": "507f1f77bcf86cd799439012",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "assignedBy": "507f1f77bcf86cd799439011",
      "assignedByUser": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Admin User",
        "email": "admin@leadmanager.com"
      },
      "notes": [
        {
          "id": "note1",
          "content": "Initial contact made",
          "createdBy": "507f1f77bcf86cd799439012",
          "createdAt": "2023-12-01T10:30:00.000Z"
        }
      ],
      "createdAt": "2023-11-30T15:20:00.000Z",
      "updatedAt": "2023-12-01T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

### GET /api/leads/my-leads
**Description**: Get leads assigned to current user  
**Access**: Authenticated users  
**Query Parameters**: Same as GET /api/leads
**Response**: Same format as GET /api/leads

### GET /api/leads/my-leads/stats
**Description**: Get stats for user's assigned leads  
**Access**: Authenticated users  
**Response**:
```json
{
  "success": true,
  "message": "My leads stats retrieved successfully",
  "data": {
    "total": 25,
    "newLeads": 8,
    "inProgress": 12,
    "closed": 5
  }
}
```

### GET /api/leads/:id
**Description**: Get single lead by ID  
**Access**: Authenticated users (own leads) / Admin (all leads)  
**Response**:
```json
{
  "success": true,
  "message": "Lead retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439021",
    "name": "John Smith",
    "email": "john.smith@company.com",
    "phone": "+1-555-0123",
    "company": "Tech Corp",
    "position": "Marketing Manager",
    "folder": "Enterprise",
    "source": "Website",
    "status": "New",
    "priority": "High",
    "leadScore": 75,
    "assignedTo": "507f1f77bcf86cd799439012",
    "assignedToUser": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "notes": [
      {
        "id": "note1",
        "content": "Initial contact made",
        "createdBy": {
          "_id": "507f1f77bcf86cd799439012",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "createdAt": "2023-12-01T10:30:00.000Z"
      }
    ],
    "createdAt": "2023-11-30T15:20:00.000Z",
    "updatedAt": "2023-12-01T10:30:00.000Z"
  }
}
```

### POST /api/leads
**Description**: Create new lead  
**Access**: Authenticated users  
**Request Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane.doe@newcompany.com",
  "phone": "+1-555-0124",
  "company": "New Tech Inc",
  "position": "CTO",
  "folder": "Enterprise",
  "source": "Referral",
  "status": "New",
  "priority": "Medium",
  "notes": "Referred by existing client"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Lead created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439022",
    "name": "Jane Doe",
    "email": "jane.doe@newcompany.com",
    "phone": "+1-555-0124",
    "company": "New Tech Inc",
    "position": "CTO",
    "folder": "Enterprise",
    "source": "Referral",
    "status": "New",
    "priority": "Medium",
    "leadScore": 50,
    "assignedBy": "507f1f77bcf86cd799439012",
    "notes": [
      {
        "id": "note1",
        "content": "Referred by existing client",
        "createdBy": "507f1f77bcf86cd799439012",
        "createdAt": "2023-12-01T11:00:00.000Z"
      }
    ],
    "createdAt": "2023-12-01T11:00:00.000Z",
    "updatedAt": "2023-12-01T11:00:00.000Z"
  }
}
```

### PUT /api/leads/:id
**Description**: Update lead  
**Access**: Authenticated users (own leads) / Admin (all leads)  
**Request Body**:
```json
{
  "status": "Contacted",
  "priority": "High",
  "folder": "Hot Prospects"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Lead updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439022",
    "name": "Jane Doe",
    "email": "jane.doe@newcompany.com",
    "status": "Contacted",
    "priority": "High",
    "folder": "Hot Prospects",
    "leadScore": 70,
    "updatedAt": "2023-12-01T11:30:00.000Z"
  }
}
```

### DELETE /api/leads/:id
**Description**: Delete lead  
**Access**: Admin only  
**Response**:
```json
{
  "success": true,
  "message": "Lead deleted successfully"
}
```

### POST /api/leads/assign
**Description**: Assign leads to user  
**Access**: Admin only  
**Request Body**:
```json
{
  "leadIds": ["507f1f77bcf86cd799439021", "507f1f77bcf86cd799439022"],
  "assignToUserId": "507f1f77bcf86cd799439012"
}
```
**Response**:
```json
{
  "success": true,
  "message": "2 leads assigned successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439021",
      "name": "John Smith",
      "assignedTo": "507f1f77bcf86cd799439012",
      "assignedToUser": {
        "_id": "507f1f77bcf86cd799439012",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ]
}
```

### POST /api/leads/notes
**Description**: Add note to lead  
**Access**: Authenticated users (own leads) / Admin (all leads)  
**Request Body**:
```json
{
  "leadId": "507f1f77bcf86cd799439021",
  "content": "Follow up scheduled for next week"
}
```
**Response**:
```json
{
  "success": true,
  "message": "Note added successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439021",
    "notes": [
      {
        "id": "note2",
        "content": "Follow up scheduled for next week",
        "createdBy": {
          "_id": "507f1f77bcf86cd799439012",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "createdAt": "2023-12-01T12:00:00.000Z"
      }
    ]
  }
}
```

### GET /api/leads/folders
**Description**: Get distinct folders for filtering  
**Access**: Authenticated users  
**Response**:
```json
{
  "success": true,
  "message": "Distinct folders retrieved successfully",
  "data": ["Enterprise", "SMB", "Startups", "Hot Prospects"]
}
```

### GET /api/leads/folder-counts
**Description**: Get lead counts by folder  
**Access**: Authenticated users  
**Response**:
```json
{
  "success": true,
  "message": "Folder counts retrieved successfully",
  "data": {
    "Enterprise": 15,
    "SMB": 28,
    "Startups": 12,
    "Hot Prospects": 8,
    "Uncategorized": 5
  }
}
```

---

## 📤 Excel Import Endpoints

### GET /api/leads/import/fields
**Description**: Get available lead fields for mapping  
**Access**: Admin only  
**Response**:
```json
{
  "success": true,
  "message": "Lead fields retrieved successfully",
  "data": [
    {
      "key": "name",
      "label": "Name",
      "required": true,
      "type": "string"
    },
    {
      "key": "email",
      "label": "Email",
      "required": true,
      "type": "email"
    },
    {
      "key": "phone",
      "label": "Phone",
      "required": true,
      "type": "string"
    },
    {
      "key": "company",
      "label": "Company",
      "required": false,
      "type": "string"
    }
  ]
}
```

### POST /api/leads/import/analyze
**Description**: Analyze Excel file structure  
**Access**: Admin only  
**Request**: Multipart form data with 'file' field
**Response**:
```json
{
  "success": true,
  "message": "File analyzed successfully",
  "data": {
    "fileName": "leads.xlsx",
    "sheets": [
      {
        "name": "Sheet1",
        "rowCount": 100,
        "columns": ["Name", "Email", "Phone", "Company", "Position"]
      }
    ],
    "recommendedMappings": {
      "Name": "name",
      "Email": "email",
      "Phone": "phone",
      "Company": "company"
    }
  }
}
```

### POST /api/leads/import/preview
**Description**: Preview Excel sheet data  
**Access**: Admin only  
**Request**: Multipart form data with 'file', 'sheetName', 'previewRows'
**Response**:
```json
{
  "success": true,
  "message": "Sheet preview retrieved successfully",
  "data": {
    "headers": ["Name", "Email", "Phone", "Company"],
    "rows": [
      ["John Smith", "john@company.com", "555-0123", "Tech Corp"],
      ["Jane Doe", "jane@company.com", "555-0124", "New Tech"]
    ],
    "totalRows": 100
  }
}
```

### POST /api/leads/import
**Description**: Import leads from Excel with field mapping  
**Access**: Admin only  
**Request**: Multipart form data with 'file', 'sheetName', 'fieldMappings', 'skipEmptyRows', 'startFromRow'
**Response**:
```json
{
  "success": true,
  "message": "Import completed successfully",
  "data": {
    "totalRows": 100,
    "successfulImports": 95,
    "failedImports": 5,
    "errors": [
      "Row 15: Invalid email format",
      "Row 32: Missing required field 'name'"
    ],
    "leads": [
      {
        "_id": "507f1f77bcf86cd799439023",
        "name": "John Smith",
        "email": "john@company.com"
      }
    ]
  }
}
```

---

## 📊 Dashboard & Analytics Endpoints

### GET /api/dashboard/stats
**Description**: Get user dashboard statistics  
**Access**: Authenticated users  
**Response**:
```json
{
  "success": true,
  "message": "Dashboard stats retrieved successfully",
  "data": {
    "totalLeads": 25,
    "newLeads": 8,
    "contactedLeads": 12,
    "qualifiedLeads": 3,
    "closedWon": 2,
    "conversionRate": 8.0,
    "leadsThisMonth": 15
  }
}
```

### GET /api/dashboard/admin-stats
**Description**: Get admin dashboard statistics  
**Access**: Admin only  
**Response**:
```json
{
  "success": true,
  "message": "Admin dashboard stats retrieved successfully",
  "data": {
    "totalLeads": 500,
    "totalUsers": 15,
    "newLeads": 85,
    "contactedLeads": 200,
    "qualifiedLeads": 150,
    "closedWon": 45,
    "conversionRate": 9.0,
    "leadsThisMonth": 120,
    "topPerformers": [
      {
        "userId": "507f1f77bcf86cd799439012",
        "userName": "John Doe",
        "leadsAssigned": 25,
        "leadsConverted": 3,
        "conversionRate": 12.0
      }
    ]
  }
}
```

### GET /api/dashboard/leads/by-status
**Description**: Get lead distribution by status  
**Access**: Authenticated users  
**Response**:
```json
{
  "success": true,
  "message": "Leads by status retrieved successfully",
  "data": [
    {
      "status": "New",
      "count": 85,
      "percentage": 17.0
    },
    {
      "status": "Contacted",
      "count": 200,
      "percentage": 40.0
    },
    {
      "status": "Qualified",
      "count": 150,
      "percentage": 30.0
    }
  ]
}
```

### GET /api/dashboard/leads/by-source
**Description**: Get lead distribution by source  
**Access**: Authenticated users  
**Response**:
```json
{
  "success": true,
  "message": "Leads by source retrieved successfully",
  "data": [
    {
      "source": "Website",
      "count": 200,
      "percentage": 40.0
    },
    {
      "source": "Referral",
      "count": 150,
      "percentage": 30.0
    },
    {
      "source": "Social Media",
      "count": 100,
      "percentage": 20.0
    }
  ]
}
```

### GET /api/dashboard/recent-activity
**Description**: Get recent activity feed  
**Access**: Authenticated users  
**Response**:
```json
{
  "success": true,
  "message": "Recent activity retrieved successfully",
  "data": [
    {
      "type": "lead_created",
      "description": "New lead 'John Smith' created",
      "timestamp": "2023-12-01T11:00:00.000Z",
      "user": "Admin User"
    },
    {
      "type": "lead_assigned",
      "description": "Lead 'Jane Doe' assigned to John Doe",
      "timestamp": "2023-12-01T10:30:00.000Z",
      "user": "Admin User"
    }
  ]
}
```

### GET /api/dashboard/metrics
**Description**: Get lead metrics and KPIs  
**Access**: Authenticated users  
**Response**:
```json
{
  "success": true,
  "message": "Lead metrics retrieved successfully",
  "data": {
    "conversionRate": 9.5,
    "leadWon": 45,
    "leadsThisWeek": 25,
    "leadsThisMonth": 120
  }
}
```

---

## 🏥 Health Check

### GET /api/health
**Description**: API health check  
**Access**: Public  
**Response**:
```json
{
  "success": true,
  "message": "API is healthy",
  "timestamp": "2023-12-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

---

## 🚫 Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid request data",
  "errors": ["Email is required", "Password must be at least 6 characters"]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access token is required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Admin access required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Lead not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error",
  "errors": ["Database connection failed"]
}
```

---

## 📋 Data Models

### User Model
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string (unique)",
  "password": "string (hashed)",
  "role": "admin | user",
  "isActive": "boolean",
  "createdAt": "Date",
  "updatedAt": "Date",
  "lastLogin": "Date"
}
```

### Lead Model
```json
{
  "_id": "ObjectId",
  "name": "string (required)",
  "email": "string (required, unique)",
  "phone": "string (required, unique)",
  "company": "string",
  "position": "string",
  "folder": "string",
  "source": "Website | Social Media | Referral | Import | Manual | Cold Call | Email Campaign",
  "status": "New | Contacted | Interested | Not Interested | Follow-up | Qualified | Proposal Sent | Negotiating | Closed-Won | Closed-Lost",
  "priority": "High | Medium | Low",
  "assignedTo": "ObjectId (User)",
  "assignedBy": "ObjectId (User)",
  "leadScore": "number (0-100)",
  "notes": [
    {
      "id": "string",
      "content": "string",
      "createdBy": "ObjectId (User)",
      "createdAt": "Date"
    }
  ],
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

---

## 🔧 Status Codes Summary

| Code | Description |
|------|-------------|
| 200  | OK - Successful GET, PUT |
| 201  | Created - Successful POST |
| 400  | Bad Request - Invalid data |
| 401  | Unauthorized - Missing/invalid token |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Resource doesn't exist |
| 500  | Internal Server Error - Server error |

---

## 📝 Notes

1. All timestamps are in ISO 8601 format (UTC)
2. ObjectIds are MongoDB ObjectId strings
3. Pagination starts from page 1
4. Text search is case-insensitive and searches across multiple fields
5. Array filters (status, source, etc.) support multiple values
6. File uploads use multipart/form-data encoding
7. JWT tokens expire in 7 days by default
8. Users can only access their own assigned leads (except admins)
9. Lead scores are automatically calculated based on status changes
10. Email and phone fields have uniqueness constraints

---

**Generated on**: December 1, 2023  
**API Version**: 1.0.0  
**Last Updated**: December 1, 2023






// 1. Set the date to exactly start of today
const today = new Date();
today.setHours(0, 0, 0, 0);

// 2. These are the ONLY statuses that will stay in their current folder
const protectedStatuses = [
  "New", 
  "Contacted", 
  "Follow-up", 
  "Interested", 
  "Qualified", 
  "Proposal Sent", 
  "Negotiating", 
  "Sales Done"
];

// 3. The Update
const result = db.leads.updateMany(
  {
    $and: [
      { "createdAt": { "$lt": today } }, // Older than today
      { "status": { "$nin": protectedStatuses } }, // NOT one of the protected names
      { "folder": { "$ne": "oldLeads" } } // Don't update if already moved
    ]
  },
  {
    $set: { "folder": "oldLeads" }
  }
);

print(`Successfully matched ${result.matchedCount} leads.`);
print(`Successfully updated ${result.modifiedCount} leads to oldLeads folder.`);




// 1. Set the cutoff to the start of today
const today = new Date();
today.setHours(0, 0, 0, 0);

// 2. Define the protected statuses
const protectedStatuses = [
  "New", 
  "Contacted", 
  "Follow-up", 
  "Interested", 
  "Qualified", 
  "Proposal Sent", 
  "Negotiating", 
  "Sales Done"
];

// 3. Execute the update using an aggregation pipeline
db.leads.updateMany(
  {
    $and: [
      { "createdAt": { "$lt": today } },               // Older than today
      { "status": { "$nin": protectedStatuses } },     // Not in the protected list
      { "status": { "$not": /^old_/ } }                // Avoid updating if already prefixed with 'old_'
    ]
  },
  [
    {
      $set: {
        // Keeps the current folder if it was already something else, 
        // but your requirement specifies folder should be 'oldLeads'
        "folder": "oldLeads",
        
        // Updates status to "old_" + current status (e.g., "Wrong Number" becomes "old_Wrong Number")
        "status": { $concat: ["old_", "$status"] }
      }
    }
  ]
);