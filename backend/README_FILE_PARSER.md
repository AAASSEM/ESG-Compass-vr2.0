# Universal File Parser System for ESG Data Extraction

## Overview

The Universal File Parser System is a comprehensive solution that automatically extracts ESG (Environmental, Social, and Governance) data from uploaded files. It converts any supported file format into structured JSON data that can be used by the dashboard and reporting systems.

## Features

- **Multi-format Support**: Handles PDF, Excel, CSV, Word documents, images (OCR), and more
- **Automatic ESG Extraction**: Identifies and extracts ESG metrics using intelligent pattern matching
- **Confidence Scoring**: Provides confidence scores for extracted data quality
- **Real-time Processing**: Automatically processes files when uploaded via Django signals
- **Dashboard Integration**: Seamlessly integrates with the ESG dashboard to show real data
- **Extensible Architecture**: Easy to add new file formats and extraction patterns

## Supported File Formats

| Format | Extension | Parser Method | Features |
|--------|-----------|---------------|----------|
| PDF | `.pdf` | PDF extraction + OCR | Text, tables, images |
| Excel | `.xlsx`, `.xls` | Excel parser | Multiple sheets, formulas |
| CSV | `.csv` | CSV parser | Structured data, encoding detection |
| Word | `.docx`, `.doc` | Word parser | Text, tables, formatting |
| Images | `.png`, `.jpg`, `.jpeg` | OCR extraction | Text recognition |
| Text | `.txt` | Text parser | Plain text processing |
| JSON | `.json` | JSON parser | Structured data |
| XML | `.xml` | XML parser | Hierarchical data |

## ESG Metrics Extracted

### Environmental Metrics
- **Energy Consumption** (kWh, MWh, GWh)
- **Water Usage** (liters, gallons, cubic meters)
- **Waste Generated** (kg, tons, metric tons)
- **Carbon Emissions** (tCO2, kg CO2)
- **Renewable Energy** (percentage)

### Social Metrics
- **Total Employees** (headcount)
- **Training Hours** (per employee, total)
- **Safety Incidents** (count, frequency)
- **Employee Satisfaction** (score, percentage)
- **Diversity Ratio** (percentage)

### Governance Metrics
- **Board Meetings** (frequency, count)
- **Compliance Score** (percentage, rating)
- **Audit Findings** (count, severity)
- **Policy Updates** (frequency, count)
- **Stakeholder Engagement** (percentage)

## Installation

### Prerequisites

```bash
# Install required Python packages
pip install PyPDF2 pdfplumber openpyxl pandas Pillow pytesseract python-docx

# For OCR support (Ubuntu/Debian)
sudo apt-get install tesseract-ocr

# For OCR support (macOS)
brew install tesseract

# For OCR support (Windows)
# Download from: https://github.com/tesseract-ocr/tesseract
```

### Django Integration

The file parser is already integrated into the Django project. The system automatically:

1. **Monitors file uploads** via Django signals
2. **Triggers extraction** when new files are uploaded
3. **Stores results** in the `ExtractedFileData` model
4. **Updates dashboard** with real extracted data

## Usage

### Automatic Processing

Files are automatically processed when uploaded to tasks:

```python
# When a user uploads a file to a task, the system automatically:
# 1. Detects the file type
# 2. Applies the appropriate parser
# 3. Extracts ESG metrics
# 4. Stores the results
# 5. Updates the dashboard

# No additional code needed - it's all automatic!
```

### Manual Processing

You can also manually process files:

```python
from apps.files.file_parser import UniversalFileParser

# Initialize parser
parser = UniversalFileParser()

# Parse a file
with open('energy_report.pdf', 'rb') as f:
    result = parser.parse_file('energy_report.pdf', f)

# Access extracted data
print(f"Energy: {result.energy_consumption_kwh} kWh")
print(f"Water: {result.water_usage_liters} liters")
print(f"Confidence: {result.confidence_score:.1f}%")

# Convert to JSON
json_data = result.to_json()
```

### Dashboard Integration

The dashboard automatically uses extracted data:

```python
# Dashboard views now use real data instead of mock data
# The following endpoints return real extracted metrics:

# Environmental data
GET /api/dashboard/environmental/file-data/
# Returns: energy, water, waste, carbon emissions from uploaded files

# Social data  
GET /api/dashboard/social/file-data/
# Returns: employees, training, safety, satisfaction from uploaded files

# Governance data
GET /api/dashboard/governance/file-data/
# Returns: compliance, board meetings, audits from uploaded files

# Main dashboard overview
GET /api/dashboard/overview/
# Returns: aggregated ESG metrics from all uploaded files
```

## Configuration

### File Parser Settings

The parser can be configured in `apps/files/file_parser.py`:

```python
class UniversalFileParser:
    def __init__(self):
        # Add new file format support
        self.supported_formats['.new_format'] = self._parse_new_format
        
        # Customize ESG patterns
        self.esg_patterns['custom_metric'] = {
            'keywords': ['custom', 'metric'],
            'pattern': r'(\d+(?:\.\d+)?)\s*custom_units',
        }
```

### Django Settings

Ensure the files app is included in `INSTALLED_APPS`:

```python
INSTALLED_APPS = [
    # ... other apps
    'apps.files',
]
```

## Testing

### Run Tests

```bash
# Run Django tests
python manage.py test apps.files.tests

# Run specific test file
python manage.py test apps.files.tests.UniversalFileParserTestCase

# Run with coverage
coverage run --source='.' manage.py test apps.files.tests
coverage report
```

### Test File Parser Directly

```bash
# Test the parser system
cd backend
python test_file_parser.py

# Run demonstration
python demo_file_parser.py
```

### Test Dashboard Integration

```bash
# Start Django server
python manage.py runserver

# Test dashboard endpoints
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/dashboard/environmental/file-data/
```

## API Endpoints

### File Data Endpoints

| Endpoint | Method | Description | Returns |
|----------|--------|-------------|---------|
| `/api/dashboard/environmental/file-data/` | GET | Environmental metrics from files | Energy, water, waste, carbon data |
| `/api/dashboard/social/file-data/` | GET | Social metrics from files | Employee, training, safety data |
| `/api/dashboard/governance/file-data/` | GET | Governance metrics from files | Compliance, board, audit data |

### Response Format

```json
{
  "energy_consumption": 15234.0,
  "water_usage": 5000.0,
  "waste_generated": 250.0,
  "carbon_emissions": 12.5,
  "files_analyzed": 5,
  "extraction_confidence": 87.5,
  "environmental_tasks": [
    {
      "title": "Energy Audit Q1 2024",
      "attachments": [
        {
          "title": "Electricity Bill",
          "extracted_values": ["Energy: 15234 kWh"],
          "confidence_score": 92.5,
          "extraction_method": "pdf_extraction"
        }
      ]
    }
  ]
}
```

## Data Models

### ExtractedFileData Model

```python
class ExtractedFileData(models.Model):
    task_attachment = models.OneToOneField('tasks.TaskAttachment')
    extraction_date = models.DateTimeField(auto_now_add=True)
    extraction_method = models.CharField(max_length=50)
    confidence_score = models.FloatField(default=0.0)
    extracted_json = models.JSONField(default=dict)
    
    # Quick access fields
    energy_consumption_kwh = models.FloatField(null=True, blank=True)
    water_usage_liters = models.FloatField(null=True, blank=True)
    waste_generated_kg = models.FloatField(null=True, blank=True)
    carbon_emissions_tco2 = models.FloatField(null=True, blank=True)
    # ... more fields
    
    processing_status = models.CharField(max_length=20, choices=...)
    error_message = models.TextField(blank=True)
```

## Performance & Scalability

### Optimization Features

- **Lazy Loading**: Files are only processed when needed
- **Caching**: Extracted data is cached for dashboard queries
- **Batch Processing**: Multiple files can be processed efficiently
- **Memory Management**: Large files are processed in chunks

### Monitoring

```python
# Check processing status
from apps.files.models import ExtractedFileData

# Files being processed
pending = ExtractedFileData.objects.filter(processing_status='processing')

# Failed extractions
failed = ExtractedFileData.objects.filter(processing_status='failed')

# Success rate
total = ExtractedFileData.objects.count()
successful = ExtractedFileData.objects.filter(processing_status='completed').count()
success_rate = (successful / total) * 100 if total > 0 else 0
```

## Troubleshooting

### Common Issues

1. **OCR Not Working**
   - Ensure Tesseract is installed
   - Check image quality and format
   - Verify file permissions

2. **PDF Parsing Fails**
   - Check if PDF is password protected
   - Verify PDF is not corrupted
   - Try different PDF libraries

3. **Memory Issues**
   - Process large files in chunks
   - Use streaming for very large files
   - Monitor system memory usage

### Debug Mode

Enable debug logging in Django settings:

```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'level': 'DEBUG',
        },
    },
    'loggers': {
        'apps.files': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': True,
        },
    },
}
```

## Extending the System

### Adding New File Formats

```python
def _parse_new_format(self, file_obj, file_name: str) -> ExtractedData:
    """Parse new file format"""
    extracted_data = ExtractedData(
        file_name=file_name,
        file_type='new_format',
        extraction_date=datetime.now().isoformat(),
        extraction_method='new_format_extraction',
        confidence_score=0.0
    )
    
    # Add your parsing logic here
    # Extract ESG metrics
    # Calculate confidence score
    
    return extracted_data

# Register the new parser
self.supported_formats['.new_format'] = self._parse_new_format
```

### Adding New ESG Metrics

```python
# In ExtractedData class
class ExtractedData:
    # Add new field
    new_metric = Optional[float] = None

# In UniversalFileParser class
def _extract_esg_metrics(self, data: ExtractedData, text: str) -> None:
    # Add extraction pattern
    new_pattern = r'new_metric[:\s]+(\d+(?:\.\d+)?)'
    for match in re.finditer(new_pattern, text.lower()):
        value = self._parse_number(match.group(1))
        if value and not data.new_metric:
            data.new_metric = value
```

## Security Considerations

- **File Validation**: All uploaded files are validated for type and size
- **Path Traversal**: File paths are sanitized to prevent directory traversal attacks
- **Memory Limits**: Large files are processed with memory limits
- **Error Handling**: Sensitive information is not exposed in error messages

## Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Add tests** for new functionality
4. **Ensure all tests pass**
5. **Submit a pull request**

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions and support:

- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs and feature requests via GitHub issues
- **Community**: Join the project discussion forum

---

**Note**: The Universal File Parser System is designed to work seamlessly with the existing ESG platform. It automatically enhances the dashboard with real data extracted from uploaded files, making the entire system more valuable and functional for ESG tracking and reporting.




