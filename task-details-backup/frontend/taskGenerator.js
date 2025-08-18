/**
 * Dynamic task generator for ESG compliance based on business sectors.
 * Adapted from v1 Python implementation for JavaScript/React use.
 */

import { esgSectorData } from './esgSectorData';

export class TaskGenerator {
  constructor() {
    this.sectorData = esgSectorData;
  }

  /**
   * Generate ESG tasks for a company based on their business sector and assessment answers.
   */
  generateTasksFromScoping(sectorKey, answers, preferences, companyId, locationData = []) {
    try {
      console.log('🚀 [TaskGenerator] Starting task generation');
      console.log(`📋 Sector: ${sectorKey}`);
      console.log(`📝 Answers provided: ${Object.keys(answers).length}`);
      
      const sectorQuestions = this.getSectorQuestions(sectorKey);
      const frameworks = this.getSectorFrameworks(sectorKey);
      
      if (!sectorQuestions || sectorQuestions.length === 0) {
        console.warn(`⚠️ No questions found for sector: ${sectorKey}`);
        return [];
      }

      const tasks = [];
      const priorityMap = { high: 1, medium: 2, low: 3 };

      // Generate tasks based on question answers
      for (const question of sectorQuestions) {
        const questionId = question.id;
        const answer = answers[questionId];

        // Skip if no answer provided
        if (answer === undefined || answer === null) {
          continue;
        }

        // Generate task based on question type and answer
        const taskData = this._generateTaskFromQuestion(
          question,
          answer,
          sectorKey,
          frameworks,
          companyId
        );

        if (taskData) {
          tasks.push(taskData);
        }
      }

      // Add framework-specific mandatory tasks
      const frameworkTasks = this._generateFrameworkTasks(
        sectorKey,
        frameworks,
        companyId
      );
      tasks.push(...frameworkTasks);

      // Sort tasks by priority and due date
      tasks.sort((a, b) => {
        const priorityA = priorityMap[a.priority] || 2;
        const priorityB = priorityMap[b.priority] || 2;
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        return new Date(a.due_date) - new Date(b.due_date);
      });

      console.log(`✅ Generated ${tasks.length} tasks for sector ${sectorKey}`);
      
      // Log task summary
      const taskSummary = this._getTaskSummary(tasks);
      console.log('📊 Task Summary:', taskSummary);
      
      return tasks;

    } catch (error) {
      console.error('❌ Error generating tasks from scoping:', error);
      return [];
    }
  }

  /**
   * Get sector-specific questions
   */
  getSectorQuestions(sectorKey) {
    const sector = this.sectorData[sectorKey];
    return sector ? sector.questions : [];
  }

  /**
   * Get frameworks applicable to a sector
   */
  getSectorFrameworks(sectorKey) {
    const sector = this.sectorData[sectorKey];
    return sector ? sector.frameworks : [];
  }

  /**
   * Generate a task from a scoping question and answer
   */
  _generateTaskFromQuestion(question, answer, sectorKey, frameworks, companyId) {
    const questionText = question.question || '';
    const questionType = question.type || 'text';
    const category = question.category || 'General';

    // Map categories to task categories
    const categoryMapping = {
      'Governance & Management': 'governance',
      'Energy': 'environmental',
      'Water': 'environmental',
      'Waste': 'environmental',
      'Supply Chain': 'governance',
      'Social': 'social',
      'General': 'environmental'
    };

    const taskCategory = categoryMapping[category] || 'environmental';

    // Determine if task is needed based on answer
    const taskNeeded = this._determineTaskNecessity(questionType, answer, question);

    if (!taskNeeded) {
      return null;
    }

    // Generate task title and description
    const taskTitle = this._generateTaskTitle(questionText, answer);
    const taskDescription = question.rationale || questionText;

    // Determine priority based on frameworks and question importance
    const priority = this._determineTaskPriority(question, frameworks);

    // Calculate due date based on priority
    const dueDate = this._calculateDueDate(priority);

    // Extract framework tags
    const frameworkTags = this._extractFrameworkTags(question.frameworks || '');

    return {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: taskTitle,
      description: taskDescription,
      compliance_context: question.frameworks || '',
      action_required: question.data_source || '',
      category: taskCategory,
      priority: priority,
      due_date: dueDate,
      framework_tags: frameworkTags,
      required_evidence_count: this._determineEvidenceCount(question),
      company_id: companyId,
      sector: sectorKey,
      status: 'todo',
      created_at: new Date().toISOString()
    };
  }

  /**
   * Determine if a task is needed based on the answer
   * ESG logic: Generate tasks for improvement opportunities and compliance gaps
   */
  _determineTaskNecessity(questionType, answer, question) {
    if (questionType === 'yes_no') {
      const answerLower = String(answer).toLowerCase();
      
      // Always generate tasks for "No" and "Partial" answers
      if (['no', 'partial'].includes(answerLower)) {
        return true;
      }
      
      // For "Yes" answers, generate verification/maintenance tasks for:
      // - Required questions (mandatory compliance)
      // - Questions with mandatory frameworks
      if (answerLower === 'yes') {
        const frameworksText = (question?.frameworks || '').toLowerCase();
        const isMandatory = question?.required || 
          frameworksText.includes('mandatory') || 
          frameworksText.includes('dst carbon calculator') ||
          frameworksText.includes('al sa\'fat') ||
          frameworksText.includes('estidama') ||
          frameworksText.includes('adek') ||
          frameworksText.includes('federal law');
        
        return isMandatory; // Generate verification tasks for mandatory items
      }
      
      return false;
    } else if (questionType === 'number') {
      // Create task if number is 0 or missing
      try {
        const value = parseFloat(answer) || 0;
        return value === 0;
      } catch {
        return true;
      }
    } else {
      // For text/other types, create task if answer is provided (needs follow-up)
      return Boolean(answer && String(answer).trim());
    }
  }

  /**
   * Generate an appropriate task title from question and answer
   */
  _generateTaskTitle(questionText, answer) {
    const questionLower = questionText.toLowerCase();
    const answerLower = String(answer).toLowerCase();

    if (questionLower.startsWith('do you')) {
      // Convert question to action based on answer
      let actionText = questionText.replace(/^do you/i, '');
      actionText = actionText.replace(/\?$/, '').trim();
      
      if (['no', 'partial'].includes(answerLower)) {
        return `Implement ${actionText}`;
      } else if (answerLower === 'yes') {
        return `Verify and maintain ${actionText}`;
      } else {
        return `Establish ${actionText}`;
      }
    } else if (questionLower.startsWith('have you')) {
      let actionText = questionText.replace(/^have you/i, '');
      actionText = actionText.replace(/\?$/, '').trim();
      
      if (['no', 'partial'].includes(answerLower)) {
        return `Complete ${actionText}`;
      } else {
        return `Document and verify ${actionText}`;
      }
    } else if (questionLower.startsWith('does your') || questionLower.startsWith('are you')) {
      let actionText = questionText.replace(/^(does your|are you)/i, '');
      actionText = actionText.replace(/\?$/, '').trim();
      
      if (['no', 'partial'].includes(answerLower)) {
        return `Establish ${actionText}`;
      } else {
        return `Verify ${actionText}`;
      }
    } else {
      // Default handling
      if (['no', 'partial'].includes(answerLower)) {
        return `Implement: ${questionText.replace(/\?$/, '')}`;
      } else {
        return `Verify: ${questionText.replace(/\?$/, '')}`;
      }
    }
  }

  /**
   * Determine task priority based on question and frameworks
   * HIGH priority: Mandatory frameworks (identified by bold text in document)
   * MEDIUM priority: Training, monitoring, voluntary standards
   * LOW priority: Optional improvements
   */
  _determineTaskPriority(question, frameworks) {
    const questionText = (question.question || '').toLowerCase();
    const frameworksText = (question.frameworks || '').toLowerCase();

    // HIGH PRIORITY: Mandatory frameworks and requirements
    const mandatoryFrameworks = [
      'dst carbon calculator',
      'al sa\'fat',
      'estidama',
      'adek sustainability policy',
      'federal energy management regulation',
      'climate law',
      'federal law',
      'mohap hospital regulation',
      'dubai municipality',
      'mandatory'
    ];

    // HIGH PRIORITY: Critical business functions
    const highPriorityKeywords = [
      'required', 'mandates', 'compliance', 'legal', 'regulation',
      'policy', 'management', 'committee', 'carbon calculator',
      'eia', 'environmental impact assessment', 'waste management plan'
    ];

    // MEDIUM PRIORITY: Implementation and monitoring
    const mediumPriorityKeywords = [
      'training', 'monitoring', 'tracking', 'reporting', 'certification',
      'efficiency', 'conservation', 'audit', 'assessment'
    ];

    // Check for mandatory frameworks first
    if (mandatoryFrameworks.some(framework => 
      frameworksText.includes(framework) || questionText.includes(framework)
    )) {
      return 'high';
    }

    // Check for high priority keywords
    if (highPriorityKeywords.some(keyword => 
      frameworksText.includes(keyword) || questionText.includes(keyword)
    )) {
      return 'high';
    } 
    
    // Check for medium priority keywords
    if (mediumPriorityKeywords.some(keyword => 
      frameworksText.includes(keyword) || questionText.includes(keyword)
    )) {
      return 'medium';
    } 
    
    // Check if it's a required question (default to medium)
    if (question.required) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Calculate due date based on task priority
   */
  _calculateDueDate(priority) {
    const now = new Date();
    
    if (priority === 'high') {
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    } else if (priority === 'medium') {
      return new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days
    } else {
      return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days
    }
  }

  /**
   * Clean framework text by removing criterion numbers and references
   * Example: "ADEK Sustainability Policy: 2.1 Curriculum Integration (Mandatory)" → "ADEK Sustainability Policy"
   */
  _cleanFrameworkText(text) {
    if (!text) return '';
    
    // Clean up framework text by removing numbers and technical references
    let cleaned = text
      // Remove criterion numbers and descriptions
      .replace(/:\s*\d+\.\d+\s+[^,()]+/g, '') // ": 2.1 Curriculum Integration"
      .replace(/imperative\s+criterion\s+\d+\.\d+/gi, '') // "imperative criterion 1.1"
      .replace(/criterion\s+\d+\.\d+/gi, '') // "criterion 7.1"
      .replace(/guideline\s+\d+\.\d+/gi, '') // "guideline 1.1"
      .replace(/\d+\.\d+\s*&?\s*\d*\.\d*/g, '') // "1.1 & 1.2" or "2.5"
      
      // Remove status markers and descriptions
      .replace(/\([IGC]\)/g, '') // Remove (I), (G), (C) markers
      .replace(/\(Imperative\)/gi, '') // Remove (Imperative)
      .replace(/\(Guideline\)/gi, '') // Remove (Guideline)
      .replace(/\(Mandatory\)/gi, '') // Remove (Mandatory)
      
      // Remove common descriptive suffixes
      .replace(/:\s*Environmental Manager required/gi, '')
      .replace(/:\s*Monthly resource tracking/gi, '')
      .replace(/:\s*Recommends\s+[^,]+/gi, '') // ": Recommends integration"
      
      // Clean up formatting
      .replace(/\s*[:,]\s*$/, '') // Remove trailing colons/commas
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    return cleaned;
  }

  /**
   * Extract framework tags from frameworks text
   */
  _extractFrameworkTags(frameworksText) {
    if (!frameworksText) return [];

    // Clean the text first to remove criterion numbers and descriptions
    const cleanedText = this._cleanFrameworkText(frameworksText);

    const frameworkMapping = {
      'dst': 'Dubai Sustainable Tourism',
      'green key': 'Green Key Global',
      'al sa\'fat': 'Al Sa\'fat Dubai',
      'estidama': 'Estidama Pearl',
      'leed': 'LEED',
      'breeam': 'BREEAM',
      'iso 14001': 'ISO 14001',
      'climate law': 'UAE Climate Law',
      'waste management': 'UAE Waste Management Law',
      'federal law': 'UAE Federal Law',
      'ssi': 'Sustainable Schools Initiative',
      'adek': 'ADEK Sustainability Policy',
      'emirates coalition': 'Emirates Coalition for Green Schools',
      'doh': 'DoH Sustainability Goals',
      'mohap': 'MOHAP Hospital Regulation'
    };

    const tags = [];
    const textLower = cleanedText.toLowerCase();

    for (const [key, fullName] of Object.entries(frameworkMapping)) {
      if (textLower.includes(key)) {
        tags.push(fullName);
      }
    }

    // If no specific frameworks found, categorize by content
    if (tags.length === 0) {
      if (textLower.includes('mandatory')) {
        tags.push('Mandatory Compliance');
      }
      if (textLower.includes('voluntary')) {
        tags.push('Voluntary Standard');
      }
      if (textLower.includes('dubai')) {
        tags.push('Dubai Regulation');
      }
      if (textLower.includes('abu dhabi')) {
        tags.push('Abu Dhabi Regulation');
      }
      if (textLower.includes('federal')) {
        tags.push('Federal Regulation');
      }
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Determine required evidence count based on question complexity
   */
  _determineEvidenceCount(question) {
    const dataSource = (question.data_source || '').toLowerCase();

    if (dataSource.includes('bills') || dataSource.includes('invoices')) {
      return 3; // Multiple months of bills
    } else if (dataSource.includes('policy') || dataSource.includes('document')) {
      return 1; // Single policy document
    } else if (dataSource.includes('records') || dataSource.includes('logs')) {
      return 2; // Multiple records
    } else {
      return 1; // Default
    }
  }

  /**
   * Generate additional tasks based on sector frameworks
   */
  _generateFrameworkTasks(sectorKey, frameworks, companyId) {
    const frameworkTasks = [];

    // Enhanced framework-specific mandatory tasks for each sector
    const frameworkRequirements = {
      // Hospitality sector frameworks
      'Dubai Sustainable Tourism (DST)': [{
        title: 'Register for DST Carbon Calculator',
        description: 'Complete mandatory registration for Dubai Sustainable Tourism Carbon Calculator with monthly reporting on 9 key metrics',
        category: 'governance',
        priority: 'high',
        compliance_context: 'Dubai Sustainable Tourism mandatory requirement for all hotels'
      }, {
        title: 'DST Sustainability Committee Setup',
        description: 'Establish sustainability committee as required by DST framework',
        category: 'governance',
        priority: 'high',
        compliance_context: 'DST mandatory organizational requirement'
      }],
      
      // Construction sector frameworks
      'Al Sa\'fat Dubai': [{
        title: 'Al Sa\'fat Certification Registration',
        description: 'Register project for mandatory Al Sa\'fat green building certification (minimum Silver rating required)',
        category: 'governance',
        priority: 'high',
        compliance_context: 'Al Sa\'fat mandatory for all new Dubai buildings'
      }],
      
      'Estidama Pearl Rating System': [{
        title: 'Estidama Pearl Registration',
        description: 'Register for mandatory Estidama Pearl rating (minimum 1-Pearl for private, 2-Pearl for government buildings)',
        category: 'governance',
        priority: 'high',
        compliance_context: 'Estidama mandatory for all new Abu Dhabi buildings'
      }],
      
      // Manufacturing sector frameworks
      'Federal Energy Management Regulation in Industrial Facilities': [{
        title: 'Energy Management System Implementation',
        description: 'Implement energy management system to achieve 33% energy reduction target',
        category: 'environmental',
        priority: 'high',
        compliance_context: 'Federal Energy Management Regulation mandatory requirement'
      }],
      
      // Education sector frameworks
      'ADEK Sustainability Policy': [{
        title: 'ADEK Sustainability Strategy Development',
        description: 'Develop formal sustainability strategy as mandated by ADEK for Abu Dhabi schools',
        category: 'governance',
        priority: 'high',
        compliance_context: 'ADEK Sustainability Policy mandatory requirement'
      }],
      
      // Health sector frameworks
      'DoH Sustainability Goals': [{
        title: 'Healthcare Sustainability Roadmap',
        description: 'Develop facility sustainability roadmap targeting 20% emissions reduction by 2030',
        category: 'governance',
        priority: 'high',
        compliance_context: 'DoH Sustainability Goals mandatory for healthcare facilities'
      }],
      
      // General UAE frameworks (apply to all sectors)
      'UAE Climate Law': [{
        title: 'GHG Emissions Tracking Setup',
        description: 'Establish greenhouse gas emissions tracking system as required by UAE Climate Law',
        category: 'environmental',
        priority: 'high',
        compliance_context: 'Federal Decree-Law No. 11 of 2024 mandatory requirement'
      }],
      
      'UAE Waste Management Law': [{
        title: 'Waste Management Plan Development',
        description: 'Develop comprehensive waste management plan compliant with Federal Law No. 12 of 2018',
        category: 'environmental',
        priority: 'high',
        compliance_context: 'UAE Waste Management Law mandatory requirement'
      }]
    };

    // Always add general UAE compliance tasks
    const generalFrameworks = ['UAE Climate Law', 'UAE Waste Management Law'];
    
    for (const framework of [...frameworks, ...generalFrameworks]) {
      if (frameworkRequirements[framework]) {
        for (const taskTemplate of frameworkRequirements[framework]) {
          const taskData = {
            id: `framework_task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...taskTemplate,
            action_required: `Complete ${framework} requirements - Review documentation and obtain necessary certifications`,
            due_date: this._calculateDueDate(taskTemplate.priority),
            framework_tags: [framework.replace(/\s*\([^)]*\)/, '')], // Clean framework name
            required_evidence_count: taskTemplate.priority === 'high' ? 3 : 1,
            company_id: companyId,
            sector: sectorKey,
            status: 'todo',
            created_at: new Date().toISOString()
          };
          frameworkTasks.push(taskData);
        }
      }
    }

    return frameworkTasks;
  }

  /**
   * Get task summary statistics
   */
  _getTaskSummary(tasks) {
    const summary = {
      total: tasks.length,
      byCategory: {},
      byPriority: {},
      byFramework: {}
    };

    for (const task of tasks) {
      // Count by category
      summary.byCategory[task.category] = (summary.byCategory[task.category] || 0) + 1;
      
      // Count by priority
      summary.byPriority[task.priority] = (summary.byPriority[task.priority] || 0) + 1;
      
      // Count by framework tags
      for (const framework of task.framework_tags) {
        summary.byFramework[framework] = (summary.byFramework[framework] || 0) + 1;
      }
    }

    return summary;
  }
}