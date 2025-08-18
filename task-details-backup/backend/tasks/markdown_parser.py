"""
ESG content parser for dynamic task generation from markdown files.
Adapted from v1 system for v3 Django implementation.
"""
import re
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from pathlib import Path
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


@dataclass
class ESGQuestion:
    """Data class for ESG questions parsed from markdown."""
    id: str
    wizard_question: str
    rationale: str
    frameworks: str
    data_source: str
    sector: str
    category: Optional[str] = None
    required: bool = False


class ESGContentParser:
    """Parser for ESG content from UAE SME markdown file."""
    
    def __init__(self, content_file_path: Optional[str] = None):
        """Initialize parser with content file path."""
        if content_file_path is None:
            # Default to the UAE SME document
            base_path = Path(__file__).parent.parent.parent / "data"
            content_file_path = base_path / "2jul-Sector-Specific ESG Scoping for UAE SMEs.md"
        
        self.content_file_path = Path(content_file_path)
        self._content_cache = None
    
    def load_content_file(self) -> str:
        """Load markdown content from file with caching."""
        if self._content_cache is None:
            try:
                with open(self.content_file_path, 'r', encoding='utf-8') as file:
                    self._content_cache = file.read()
                logger.info(f"Loaded ESG content from {self.content_file_path}")
            except FileNotFoundError:
                logger.error(f"ESG content file not found: {self.content_file_path}")
                raise ValueError(f"ESG content file not found: {self.content_file_path}")
            except Exception as e:
                logger.error(f"Error loading ESG content file: {e}")
                raise ValueError(f"Error loading ESG content file: {e}")
        
        return self._content_cache
    
    def parse_sector_content(self, sector: str) -> List[ESGQuestion]:
        """
        Parse sector-specific ESG content from markdown file.
        
        Args:
            sector: Business sector to parse questions for (e.g., 'hospitality', 'construction')
            
        Returns:
            List of ESGQuestion objects with framework mappings
        """
        try:
            markdown_content = self.load_content_file()
            
            # Map sector keys to section names in the markdown
            sector_mapping = {
                'hospitality': 'Hospitality Sector',
                'construction': 'Construction & Real Estate Sector',
                'manufacturing': 'Manufacturing Sector',
                'logistics': 'Logistics & Transportation Sector',
                'education': 'Education Sector',
                'health': 'Health Sector',
                'healthcare': 'Health Sector',  # Alternative name
                'retail': 'Retail Sector',
                'technology': 'Technology Sector'
            }
            
            sector_name = sector_mapping.get(sector.lower())
            if not sector_name:
                logger.warning(f"No mapping found for sector: {sector}")
                return []
            
            # Find sector section
            questions = self._find_and_parse_sector_questions(markdown_content, sector_name, sector)
            logger.info(f"Parsed {len(questions)} questions for sector: {sector}")
            
            return questions
            
        except Exception as e:
            logger.error(f"Error parsing sector content for {sector}: {e}")
            raise ValueError(f"Error parsing sector content: {e}")
    
    def _find_and_parse_sector_questions(self, content: str, sector_name: str, sector_key: str) -> List[ESGQuestion]:
        """Find and parse questions for a specific sector."""
        questions = []
        
        # Find the sector section using various patterns
        patterns = [
            rf"#### \*\*{re.escape(sector_name)}\*\*",
            rf"###.*{re.escape(sector_name)}",
            rf"##.*{re.escape(sector_name)}"
        ]
        
        sector_start = None
        for pattern in patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                sector_start = match.end()
                break
        
        if sector_start is None:
            logger.warning(f"Could not find section for {sector_name}")
            return []
        
        # Find the next major section (end of current sector)
        next_section_match = re.search(r'\n#{1,4}\s', content[sector_start:])
        sector_end = sector_start + next_section_match.start() if next_section_match else len(content)
        
        sector_content = content[sector_start:sector_end]
        
        # Look for table with questions
        table_match = re.search(r'\|.*Wizard Question.*\|.*\n(\|.*\n)*', sector_content, re.MULTILINE | re.IGNORECASE)
        if not table_match:
            logger.warning(f"No questions table found for {sector_name}")
            return []
        
        table_content = table_match.group(0)
        
        # Parse table rows
        questions = self._parse_table_rows(table_content, sector_key)
        
        return questions
    
    def _parse_table_rows(self, table_content: str, sector: str) -> List[ESGQuestion]:
        """Parse table rows to extract questions."""
        questions = []
        lines = table_content.split('\n')
        
        # Skip header rows (usually first 2-3 lines)
        data_rows = [line for line in lines if line.startswith('|') and not line.startswith('| :')]
        
        # Skip the header row
        if data_rows and ('Wizard Question' in data_rows[0] or 'Question' in data_rows[0]):
            data_rows = data_rows[1:]
        
        current_category = None
        question_counter = 1
        
        for i, row in enumerate(data_rows):
            if not row.strip() or row.count('|') < 3:
                continue
            
            try:
                # Split by | and clean up
                cells = [cell.strip() for cell in row.split('|')[1:-1]]  # Remove empty first/last
                
                if len(cells) < 4:
                    continue
                
                question_text = cells[0].strip()
                rationale = cells[1].strip() if len(cells) > 1 else ""
                frameworks = cells[2].strip() if len(cells) > 2 else ""
                data_source = cells[3].strip() if len(cells) > 3 else ""
                
                # Skip empty rows or category headers
                if not question_text or question_text.startswith('**') and question_text.endswith('**'):
                    # This might be a category header
                    if question_text.startswith('**') and question_text.endswith('**'):
                        current_category = question_text.strip('*')
                    continue
                
                # Skip non-questions
                if not question_text or question_text in ['Wizard Question (Plain-English)', 'Question']:
                    continue
                
                # Clean markdown formatting
                question_text = self._clean_markdown(question_text)
                rationale = self._clean_markdown(rationale)
                frameworks = self._clean_markdown(frameworks)
                data_source = self._clean_markdown(data_source)
                
                # Skip if essential fields are empty
                if not question_text or len(question_text) < 10:
                    continue
                
                # Create question ID
                question_id = f"{sector}_{question_counter:03d}"
                question_counter += 1
                
                # Determine if question is required (based on frameworks containing "mandatory")
                required = 'mandatory' in frameworks.lower() or 'mandates' in frameworks.lower()
                
                question = ESGQuestion(
                    id=question_id,
                    wizard_question=question_text,
                    rationale=rationale,
                    frameworks=frameworks,
                    data_source=data_source,
                    sector=sector,
                    category=current_category,
                    required=required
                )
                
                questions.append(question)
                
            except Exception as e:
                logger.warning(f"Error parsing table row {i}: {e}")
                continue
        
        return questions
    
    def _clean_markdown(self, text: str) -> str:
        """Clean markdown formatting from text."""
        if not text:
            return ""
        
        # Remove bold/italic markers
        text = re.sub(r'\*\*(.*?)\*\*', r'\\1', text)
        text = re.sub(r'\*(.*?)\*', r'\\1', text)
        
        # Remove extra whitespace
        text = ' '.join(text.split())
        
        return text.strip()
    
    def get_available_sectors(self) -> List[str]:
        """Get list of available sectors in the markdown file."""
        try:
            content = self.load_content_file()
            
            # Look for sector headers
            patterns = [
                r'#### \*\*(\d+)\.\s*([^*]+)\s*Sector',
                r'###.*?(\w+)\s*Sector',
                r'##.*?(\w+)\s*Sector'
            ]
            
            sectors = []
            for pattern in patterns:
                matches = re.findall(pattern, content, re.IGNORECASE)
                for match in matches:
                    if isinstance(match, tuple):
                        sector_name = match[-1].strip()
                    else:
                        sector_name = match.strip()
                    
                    if sector_name and sector_name not in sectors:
                        sectors.append(sector_name)
            
            return sectors
            
        except Exception as e:
            logger.error(f"Error getting available sectors: {e}")
            return []
    
    def get_sector_frameworks(self, sector: str) -> List[str]:
        """Get frameworks applicable to a sector."""
        try:
            content = self.load_content_file()
            questions = self.parse_sector_content(sector)
            
            frameworks = set()
            for question in questions:
                if question.frameworks:
                    # Extract framework names
                    fw_text = question.frameworks.lower()
                    
                    # Common framework patterns
                    framework_patterns = {
                        'dst': 'Dubai Sustainable Tourism',
                        'green key': 'Green Key Global',
                        'al sa\'fat': 'Al Sa\'fat Dubai',
                        'estidama': 'Estidama Pearl',
                        'leed': 'LEED',
                        'breeam': 'BREEAM',
                        'iso 14001': 'ISO 14001',
                        'climate law': 'UAE Climate Law',
                        'waste management': 'UAE Waste Management Law',
                        'federal law': 'UAE Federal Law'
                    }
                    
                    for pattern, full_name in framework_patterns.items():
                        if pattern in fw_text:
                            frameworks.add(full_name)
            
            return list(frameworks)
            
        except Exception as e:
            logger.error(f"Error getting frameworks for sector {sector}: {e}")
            return []


# Convenience functions for Django integration
def parse_sector_questions(sector: str) -> List[ESGQuestion]:
    """Parse questions for a sector (convenience function)."""
    parser = ESGContentParser()
    return parser.parse_sector_content(sector)


def get_sector_frameworks(sector: str) -> List[str]:
    """Get frameworks for a sector (convenience function)."""
    parser = ESGContentParser()
    return parser.get_sector_frameworks(sector)


def get_available_sectors() -> List[str]:
    """Get available sectors (convenience function)."""
    parser = ESGContentParser()
    return parser.get_available_sectors()