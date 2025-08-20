import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { esgAPI } from '../../services/api';
import { esgSectorData } from '../../services/esgSectorData';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import LoadingSpinner from '../ui/LoadingSpinner';

const ESGScopingWizard = ({ companyId, businessSector, onComplete, onBack, isViewMode = false, onNextStep }) => {
  const [currentCategory, setCurrentCategory] = useState(0);
  const [answers, setAnswers] = useState({});
  const [preferences, setPreferences] = useState({
    priority_level: 'medium',
    completion_timeframe: '6_months'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [scopingData, setScopingData] = useState(null);

  // Framework color mapping
  const getFrameworkColor = (frameworkName) => {
    const colorMap = {
      // Dubai/Local Frameworks
      'DST': 'bg-blue-100 text-blue-800 border-blue-200',
      'Dubai Sustainable Tourism': 'bg-blue-100 text-blue-800 border-blue-200',
      'Al Sa\'fat': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'Estidama': 'bg-purple-100 text-purple-800 border-purple-200',
      
      // International Green Standards
      'Green Key': 'bg-green-100 text-green-800 border-green-200',
      'LEED': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'BREEAM': 'bg-teal-100 text-teal-800 border-teal-200',
      'ISO 14001': 'bg-cyan-100 text-cyan-800 border-cyan-200',
      
      // UAE Federal/Government
      'Climate Law': 'bg-red-100 text-red-800 border-red-200',
      'Federal': 'bg-red-100 text-red-800 border-red-200',
      'UAE': 'bg-red-100 text-red-800 border-red-200',
      'ADEK': 'bg-orange-100 text-orange-800 border-orange-200',
      'DoH': 'bg-pink-100 text-pink-800 border-pink-200',
      'MOHAP': 'bg-rose-100 text-rose-800 border-rose-200',
      
      // Industry Specific
      'SSI': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Sustainable Schools': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      
      // Default
      'default': 'bg-gray-100 text-gray-800 border-gray-200'
    };

    // Check for partial matches
    for (const [key, color] of Object.entries(colorMap)) {
      if (frameworkName.includes(key)) {
        return color;
      }
    }
    
    return colorMap.default;
  };

  // ESG categorization based on sector-specific categories from the MD document
  const getESGCategory = (sectorCategory) => {
    const environmentalCategories = [
      'Energy', 'Water', 'Waste', 'Air Quality', 'Resource Management', 
      'Energy & Emissions', 'Packaging & Waste', 'Construction Phase',
      'Operational Phase', 'Waste & Materials', 'Fleet & Transportation',
      'Warehousing & Operations'
    ];
    
    const socialCategories = [
      'Supply Chain', 'Health & Environment', 'Student Engagement'
    ];
    
    const governanceCategories = [
      'Governance & Management', 'Policy & Management', 'Governance & Systems',
      'Governance & Infrastructure', 'Project Planning & Design'
    ];
    
    if (environmentalCategories.some(cat => sectorCategory?.includes(cat))) {
      return { 
        name: 'Environmental', 
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: '🌱'
      };
    }
    
    if (socialCategories.some(cat => sectorCategory?.includes(cat))) {
      return { 
        name: 'Social', 
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: '👥'
      };
    }
    
    if (governanceCategories.some(cat => sectorCategory?.includes(cat))) {
      return { 
        name: 'Governance', 
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        icon: '🏛️'
      };
    }
    
    // Default to Environmental for unmatched categories
    return { 
      name: 'Environmental', 
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: '🌱'
    };
  };

  // Display frameworks as colored badges without cleaning
  const renderFrameworkBadges = (text) => {
    if (!text) return null;
    
    // Split frameworks by comma and create colored badges
    const frameworks = text.split(',').map(f => f.trim()).filter(f => f);
    
    return (
      <div className="flex flex-wrap gap-1">
        {frameworks.map((framework, index) => (
          <span
            key={index}
            className={`inline-block px-2 py-1 text-xs font-medium rounded-md border ${getFrameworkColor(framework)}`}
          >
            {framework}
          </span>
        ))}
      </div>
    );
  };

  // Get sector-specific ESG questions from imported data
  const getSectorQuestions = (sector) => {
    // Map business sector to our data keys - all sectors now have proper ESG coverage
    const sectorMapping = {
      'hospitality': 'hospitality',
      'construction': 'construction', 
      'manufacturing': 'manufacturing',
      'logistics': 'logistics',
      'education': 'education',
      'healthcare': 'health', // Note: frontend uses 'healthcare', ESG data uses 'health'
      'retail': 'retail',
      'technology': 'technology'
    };

    const sectorKey = sectorMapping[sector?.toLowerCase()];
    
    // Since we only allow supported sectors, this should always find a match
    if (!sectorKey) {
      console.warn(`Unsupported sector: ${sector}. This should not happen with the current signup restrictions.`);
      return {};
    }
    const sectorData = esgSectorData[sectorKey];
    
    if (!sectorData) {
      console.warn(`No ESG data found for sector: ${sector}`);
      return {};
    }

    // Group questions by ESG categories instead of sector-specific categories
    const groupedQuestions = {
      'Environmental': [],
      'Social': [],
      'Governance': []
    };

    // Group questions by their ESG category using our mapping function
    sectorData.questions.forEach(question => {
      const esgCategory = getESGCategory(question.category);
      const categoryName = esgCategory.name;
      
      if (groupedQuestions[categoryName]) {
        groupedQuestions[categoryName].push(question);
      }
    });

    return groupedQuestions;
  };

  const questions = getSectorQuestions(businessSector);
  const categories = Object.keys(questions);
  const currentQuestions = questions[categories[currentCategory]] || [];

  // Get appropriate icon for ESG category
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Environmental':
        return 'fa-leaf text-brand-green';
      case 'Social':
        return 'fa-users text-brand-blue';
      case 'Governance':
        return 'fa-shield text-brand-teal';
      default:
        return 'fa-clipboard-check text-brand-green';
    }
  };

  // Load existing answers
  useEffect(() => {
    const loadExistingAnswers = () => {
      try {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const companyIdKey = companyId || currentUser.company_id || 'temp';
        const savedAnswers = localStorage.getItem(`esg_scoping_answers_${companyIdKey}`);
        
        if (savedAnswers) {
          const parsedAnswers = JSON.parse(savedAnswers);
          console.log('Loading saved ESG answers:', parsedAnswers);
          setAnswers(parsedAnswers);
        }
      } catch (error) {
        console.error('Error loading ESG answers:', error);
      }
    };

    loadExistingAnswers();
  }, [companyId]);

  // Save answers to localStorage
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const companyIdKey = companyId || currentUser.company_id || 'temp';
      localStorage.setItem(`esg_scoping_answers_${companyIdKey}`, JSON.stringify(answers));
    }
  }, [answers, companyId]);

  const updateAnswer = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleNext = () => {
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (currentCategory < categories.length - 1) {
      setCurrentCategory(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (currentCategory > 0) {
      setCurrentCategory(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    
    try {
      // Calculate completion stats
      const totalQuestions = Object.values(questions).flat().length;
      const answeredQuestions = Object.keys(answers).length;
      const completionRate = (answeredQuestions / totalQuestions) * 100;

      // Map business sector to our data keys for task generation
      const sectorMapping = {
        'hospitality': 'hospitality',
        'construction': 'construction', 
        'manufacturing': 'manufacturing',
        'logistics': 'logistics',
        'education': 'education',
        'healthcare': 'health',
        'retail': 'retail',
        'technology': 'technology'
      };

      const sectorKey = sectorMapping[businessSector?.toLowerCase()] || 'retail';

      // NOTE: Task generation moved to backend (v1-style markdown-driven approach)
      // Tasks will be generated automatically when onboarding is completed via backend API
      console.log('🔄 ESG tasks will be generated by backend when onboarding completes...');
      const generatedTasks = []; // Empty - backend will generate tasks

      // Prepare scoping results
      const scopingResults = {
        companyId,
        businessSector,
        sectorKey,
        answers,
        preferences,
        totalQuestions,
        answeredQuestions,
        completionRate,
        generatedTasks,
        categories: categories.map(cat => ({
          name: cat,
          questions: questions[cat] ? questions[cat].length : 0,
          answered: questions[cat] ? questions[cat].filter(q => answers[q.id] !== undefined).length : 0
        })),
        timestamp: new Date().toISOString()
      };

      // Save results to localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const companyIdKey = companyId || currentUser.company_id || 'temp';
      
      // Save assessment results
      localStorage.setItem(`assessmentResults_${companyIdKey}`, JSON.stringify(scopingResults));
      
      // Save generated tasks separately for task management
      localStorage.setItem(`generatedTasks_${companyIdKey}`, JSON.stringify(generatedTasks));

      console.log('✅ ESG Scoping completed:', scopingResults);
      console.log(`📋 Tasks will be generated by backend system`);
      
      toast.success(`ESG Assessment completed! Compliance tasks will be generated based on your sector and answers.`);
      
      onComplete(scopingResults);
    } catch (error) {
      console.error('❌ Error completing ESG scoping:', error);
      toast.error('Error saving assessment results');
    } finally {
      setIsLoading(false);
    }
  };

  const getProgressPercentage = () => {
    const totalCategories = categories.length;
    return ((currentCategory + 1) / totalCategories) * 100;
  };

  const getCategoryStats = (categoryName) => {
    const categoryQuestions = questions[categoryName] || [];
    const answered = categoryQuestions.filter(q => answers[q.id] !== undefined).length;
    return {
      total: categoryQuestions.length,
      answered,
      percentage: categoryQuestions.length > 0 ? (answered / categoryQuestions.length) * 100 : 0
    };
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <LoadingSpinner />
        <span className="ml-3 text-text-muted">Processing your ESG assessment...</span>
      </div>
    );
  }

  return (
    <Card className="max-w-6xl mx-auto">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-text-high font-bold text-2xl flex items-center justify-center">
            <i className="fa-solid fa-clipboard-check mr-3 text-brand-green"></i>
            ESG Assessment
          </h2>
          <p className="text-text-muted">
            Comprehensive sustainability assessment for {businessSector} sector
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            {categories.map((category, index) => {
              const stats = getCategoryStats(category);
              const isActive = index === currentCategory;
              const isCompleted = index < currentCategory;
              
              return (
                <div key={category} className="flex-1 text-center">
                  <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                    isActive ? 'bg-brand-green text-white' :
                    isCompleted ? 'bg-brand-green text-white' :
                    'bg-white/20 text-text-muted'
                  }`}>
                    {isCompleted ? '✓' : index + 1}
                  </div>
                  <div className={`font-medium text-sm capitalize ${
                    isActive || isCompleted ? 'text-brand-green' : 'text-text-muted'
                  }`}>
                    {category}
                  </div>
                  <div className="text-xs text-text-muted">
                    {stats.answered}/{stats.total} answered
                  </div>
                </div>
              );
            })}
          </div>

          <div className="w-full bg-white/20 rounded-full h-2">
            <div 
              className="bg-brand-green h-2 rounded-full transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}
            />
          </div>
          
          <div className="text-center text-sm text-text-muted">
            Category {currentCategory + 1} of {categories.length} ({Math.round(getProgressPercentage())}% complete)
          </div>
        </div>

        {/* Current Category Questions */}
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-text-high mb-2 flex items-center justify-center">
              <i className={`fa-solid mr-2 ${getCategoryIcon(categories[currentCategory])}`}></i>
              {categories[currentCategory]} Questions
            </h3>
            <p className="text-text-muted text-sm">
              Answer these questions to assess your {categories[currentCategory]} practices
            </p>
          </div>

          {currentQuestions.map((question, index) => (
            <div key={question.id} className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="bg-brand-green/20 text-brand-green rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-1">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-text-high font-medium mb-2">
                      {question.question}
                      {question.required && <span className="text-red-400 ml-1">*</span>}
                    </h4>
                    
                    <div className="space-y-2 text-sm text-text-muted">
                      <p><strong>Why this matters:</strong> {question.rationale}</p>
                      <div className="mb-2">
                        <p className="font-semibold text-text-muted mb-1">Frameworks:</p>
                        {renderFrameworkBadges(question.frameworks)}
                      </div>
                      <p><strong>Data source:</strong> {question.data_source}</p>
                    </div>
                  </div>
                </div>

                <div className="ml-11">
                  {question.type === 'yes_no' && (
                    <div className="flex space-x-4">
                      <Button
                        variant={answers[question.id] === 'yes' ? 'primary' : 'outline'}
                        onClick={() => !isViewMode && updateAnswer(question.id, 'yes')}
                        className="px-6"
                        disabled={isViewMode}
                      >
                        ✓ Yes
                      </Button>
                      <Button
                        variant={answers[question.id] === 'no' ? 'danger' : 'outline'}
                        onClick={() => !isViewMode && updateAnswer(question.id, 'no')}
                        className="px-6"
                        disabled={isViewMode}
                      >
                        ✗ No
                      </Button>
                      <Button
                        variant={answers[question.id] === 'partial' ? 'warning' : 'outline'}
                        onClick={() => !isViewMode && updateAnswer(question.id, 'partial')}
                        className="px-6"
                        disabled={isViewMode}
                      >
                        ~ Partially
                      </Button>
                    </div>
                  )}

                  {question.type === 'text' && (
                    <Input
                      placeholder="Enter your answer..."
                      value={answers[question.id] || ''}
                      onChange={(e) => !isViewMode && updateAnswer(question.id, e.target.value)}
                      disabled={isViewMode}
                    />
                  )}

                  {question.type === 'number' && (
                    <Input
                      type="number"
                      placeholder="Enter numeric value"
                      value={answers[question.id] || ''}
                      onChange={(e) => !isViewMode && updateAnswer(question.id, e.target.value)}
                      disabled={isViewMode}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>


        {/* Navigation */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/10">
          <Button
            variant="outline"
            size="large"
            onClick={currentCategory === 0 ? onBack : handlePrevious}
          >
            <i className="fas fa-arrow-left mr-2"></i>
            {currentCategory === 0 ? (isViewMode ? 'View Locations' : 'Back to Locations') : 'Previous Category'}
          </Button>
          
          <Button
            variant="primary"
            size="large"
            onClick={isViewMode ? (currentCategory === categories.length - 1 ? onNextStep : handleNext) : handleNext}
            className="flex-1"
          >
            {isViewMode ? 
              (currentCategory === categories.length - 1 ? 'View Completion' : 'Next Category') :
              (currentCategory === categories.length - 1 ? 'Complete Assessment' : 'Next Category')
            }
            <i className="fas fa-arrow-right ml-2"></i>
          </Button>
        </div>

        {/* Help Section */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-start space-x-3">
            <i className="fas fa-lightbulb text-brand-blue mt-1"></i>
            <div className="space-y-1">
              <h4 className="text-text-high font-medium text-sm">Assessment Tips</h4>
              <p className="text-text-muted text-xs">
                Answer honestly to get the most accurate ESG roadmap. "Partially" answers help us 
                identify improvement opportunities. You can always update answers later as your 
                practices evolve.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ESGScopingWizard;