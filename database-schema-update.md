# Database Schema Update for Multi-Meter Task Management

## 1. Task Table Updates
```sql
-- Add document_requirements JSON field to existing tasks table
ALTER TABLE tasks ADD COLUMN document_requirements JSON;
ALTER TABLE tasks ADD COLUMN assigned_meters JSON;
ALTER TABLE tasks ADD COLUMN meter_locations JSON;
```

## 2. Meters Table (New)
```sql
CREATE TABLE meters (
    id VARCHAR(50) PRIMARY KEY,
    meter_id VARCHAR(50) UNIQUE NOT NULL,
    type ENUM('electricity', 'water', 'gas', 'steam') NOT NULL,
    location VARCHAR(255) NOT NULL,
    provider VARCHAR(100),
    unit VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    installation_date DATE,
    last_reading_date DATETIME,
    company_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_company_meters (company_id),
    INDEX idx_meter_type (type),
    INDEX idx_location (location)
);
```

## 3. Task Document Requirements Structure
```json
{
  "requirements": [
    {
      "key": "utility_bills",
      "title": "Utility Bills",
      "description": "Upload monthly utility bills for assigned meters",
      "file_types": [".pdf", ".jpg", ".jpeg", ".png"],
      "required": true,
      "months_required": 3,
      "per_meter": true,
      "meter_specific": true
    },
    {
      "key": "meter_photos",
      "title": "Meter Photos", 
      "description": "Take photos of all assigned meters",
      "file_types": [".jpg", ".jpeg", ".png"],
      "required": true,
      "per_meter": true
    }
  ]
}
```

## 4. Assigned Meters Structure
```json
{
  "meters": [
    {
      "meter_id": "ELC1234",
      "type": "electricity",
      "location": "Main Office - Floor 1",
      "provider": "DEWA",
      "unit": "kWh",
      "reading_required": true,
      "bills_required": true
    },
    {
      "meter_id": "WAT5678", 
      "type": "water",
      "location": "Main Office - Basement",
      "provider": "DEWA",
      "unit": "m³",
      "reading_required": true,
      "bills_required": false
    }
  ]
}
```

## 5. Task Example with Multi-Meter Assignment
```json
{
  "id": "task_456",
  "title": "Monthly Utility Tracking - Main Office",
  "action_required": "Read meters and collect utility bills for main office facilities",
  "assigned_meters": {
    "meters": [
      {
        "meter_id": "ELC1234",
        "type": "electricity", 
        "location": "Main Office - Floor 1",
        "provider": "DEWA",
        "reading_required": true,
        "bills_required": true
      },
      {
        "meter_id": "ELC1235",
        "type": "electricity",
        "location": "Main Office - Floor 2", 
        "provider": "DEWA",
        "reading_required": true,
        "bills_required": false
      },
      {
        "meter_id": "WAT5678",
        "type": "water",
        "location": "Main Office - Basement",
        "provider": "DEWA", 
        "reading_required": true,
        "bills_required": true
      }
    ]
  },
  "document_requirements": {
    "requirements": [
      {
        "key": "utility_bills",
        "title": "Utility Bills",
        "description": "Upload 3 months of utility bills",
        "file_types": [".pdf", ".jpg", ".jpeg", ".png"],
        "required": true,
        "months_required": 3,
        "per_meter": true,
        "applies_to_meters": ["ELC1234", "WAT5678"]
      },
      {
        "key": "meter_readings",
        "title": "Meter Readings",
        "description": "Enter current readings for all meters",
        "required": true,
        "data_entry": true,
        "per_meter": true,
        "applies_to_meters": ["ELC1234", "ELC1235", "WAT5678"]
      }
    ]
  }
}
```

## 6. Benefits of This Approach

### Multi-Meter Support:
- ✅ Task can be assigned multiple meters
- ✅ Each meter can have different requirements
- ✅ Selective meter assignment per task
- ✅ Meter-specific document tracking

### Flexible Requirements:
- ✅ Database-stored, consistent requirements
- ✅ Per-meter document requirements
- ✅ Configurable file types and validation
- ✅ Support for both data entry and file upload

### Scalability:
- ✅ Easy to add new meter types
- ✅ Company-specific meter management
- ✅ Historical tracking of meter assignments
- ✅ Bulk meter operations