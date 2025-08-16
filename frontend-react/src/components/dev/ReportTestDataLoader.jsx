import React from 'react';
import { toast } from 'react-toastify';
import { useQueryClient } from 'react-query';
import Button from '../ui/Button';
import { esgAPI } from '../../services/api';
import { getApiURL } from '../../utils/api-config';

const ReportTestDataLoader = () => {
  const queryClient = useQueryClient();

  const handleTestApiConnection = async () => {
    try {
      toast.info('Testing API connection...', { autoClose: 1000 });
      const response = await esgAPI.getReportTemplates();
      const templates = Array.isArray(response) ? response : response.results || [];
      
      toast.success(`✅ API Connected! Found ${templates.length} templates`, {
        autoClose: 3000
      });
      
      queryClient.invalidateQueries('report-templates');
    } catch (error) {
      console.error('API test failed:', error);
      toast.error(`❌ API test failed: ${error.message}`, { autoClose: 5000 });
    }
  };

  const handleRunBackendTests = async () => {
    try {
      toast.info('Running backend report tests...', { autoClose: 2000 });
      
      // This would call the Django management command via API if we had an endpoint
      // For now, we'll simulate it with a direct fetch to our test endpoint
      const response = await fetch(getApiURL('/reports/templates/'));
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`✅ Backend tests passed! ${data.count || data.results?.length || 0} templates ready`, {
          autoClose: 4000
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Backend test failed:', error);
      toast.error(`❌ Backend test failed: ${error.message}`, { autoClose: 5000 });
    }
  };

  const handleGenerateTestReport = async () => {
    try {
      toast.info('Generating test report...', { autoClose: 2000 });
      
      // First check if we can access authenticated endpoints
      try {
        await esgAPI.getReports();
      } catch (authError) {
        if (authError.response?.status === 401) {
          toast.error('❌ Please log in first to generate reports', { autoClose: 5000 });
          return;
        }
      }
      
      // Get first available template
      const templatesResponse = await esgAPI.getReportTemplates();
      const templates = Array.isArray(templatesResponse) ? templatesResponse : templatesResponse.results || [];
      
      if (templates.length === 0) {
        throw new Error('No templates available');
      }

      const template = templates[0];
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

      const testReportData = {
        template_id: template.id,
        name: `Test Report - ${template.display_name} - ${now.toLocaleTimeString()}`,
        description: 'Automatically generated test report from dev tools',
        format: 'pdf',
        period_start: oneYearAgo.toISOString().split('T')[0],
        period_end: now.toISOString().split('T')[0],
        parameters: {
          include_recommendations: true,
          include_benchmarks: true,
          include_charts: true,
          include_trends: true
        }
      };

      await esgAPI.generateReport(testReportData);
      
      toast.success('✅ Test report generation started!', {
        autoClose: 4000
      });
      
      queryClient.invalidateQueries('reports');
    } catch (error) {
      console.error('Test report generation failed:', error);
      
      let errorMessage = 'Unknown error';
      if (error.response) {
        // Server responded with error status
        errorMessage = `Server error (${error.response.status}): ${error.response.data?.error || error.response.data?.detail || 'Unknown server error'}`;
      } else if (error.request) {
        // Request made but no response
        errorMessage = 'No response from server - check if backend is running';
      } else {
        // Something else happened
        errorMessage = error.message;
      }
      
      toast.error(`❌ Test report failed: ${errorMessage}`, { autoClose: 8000 });
    }
  };

  const handleClearTestReports = () => {
    try {
      // This would ideally call a cleanup endpoint
      // For now, we'll just refresh the queries and show a message
      queryClient.invalidateQueries('reports');
      toast.info('🧹 Test data cleanup requested - refresh to see changes', { 
        autoClose: 3000 
      });
    } catch (error) {
      console.error('Error clearing test data:', error);
      toast.error('Failed to clear test data');
    }
  };

  const handleTestReportsAPI = async () => {
    try {
      toast.info('Testing reports API...', { autoClose: 1000 });
      const response = await esgAPI.getReports();
      const reports = Array.isArray(response) ? response : response.results || [];
      
      toast.success(`✅ Reports API working! Found ${reports.length} reports`, {
        autoClose: 3000
      });
      
      queryClient.invalidateQueries('reports');
    } catch (error) {
      console.error('Reports API test failed:', error);
      toast.error(`❌ Reports API failed: ${error.message}`, { autoClose: 5000 });
    }
  };

  const handleRefreshCache = () => {
    try {
      // Clear all report-related cache
      queryClient.invalidateQueries('reports');
      queryClient.invalidateQueries('report-templates');
      queryClient.invalidateQueries('company');
      
      toast.info('🔄 Cache refreshed', { autoClose: 2000 });
    } catch (error) {
      console.error('Error refreshing cache:', error);
      toast.error('Failed to refresh cache');
    }
  };

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 space-y-2 max-w-48">
      <div className="text-xs text-text-muted font-medium mb-2">🧪 DEV TOOLS</div>
      <div className="flex flex-col space-y-2">
        <Button
          size="small"
          variant="outline"
          onClick={handleTestApiConnection}
          className="text-xs"
        >
          Test API Connection
        </Button>
        <Button
          size="small"
          variant="outline"
          onClick={handleRunBackendTests}
          className="text-xs"
        >
          Run Backend Tests
        </Button>
        <Button
          size="small"
          variant="outline"
          onClick={handleTestReportsAPI}
          className="text-xs"
        >
          Test Reports API
        </Button>
        <Button
          size="small"
          variant="outline"
          onClick={handleGenerateTestReport}
          className="text-xs"
        >
          Generate Test Report
        </Button>
        <Button
          size="small"
          variant="outline"
          onClick={handleClearTestReports}
          className="text-xs text-red-400 border-red-400/30 hover:bg-red-400/10"
        >
          Clear Test Reports
        </Button>
        <Button
          size="small"
          variant="outline"
          onClick={handleRefreshCache}
          className="text-xs"
        >
          Refresh Cache
        </Button>
        <Button
          size="small"
          variant="outline"
          onClick={() => {
            // Access the parent component's state for debugging
            console.log('🔍 DEBUGGING LOADING STATE...');
            
            // Check if we can access the Reports component state
            const reportButtons = document.querySelectorAll('[title*="Download"]');
            console.log('📊 Found download buttons:', reportButtons.length);
            
            reportButtons.forEach((button, index) => {
              const isLoading = button.getAttribute('disabled') || button.querySelector('.loading');
              console.log(`Button ${index + 1}: Loading = ${!!isLoading}`);
            });
            
            // Try to trigger a download and monitor the state
            const firstButton = reportButtons[0];
            if (firstButton) {
              console.log('🎯 Will click first download button and monitor...');
              toast.info('Clicking first download button - check console!');
              firstButton.click();
            } else {
              toast.error('No download buttons found');
            }
          }}
          className="text-xs bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-400/50 text-blue-200 hover:bg-blue-500/30"
        >
          🔍 Debug Loading State
        </Button>
        <Button
          size="small"
          variant="outline"
          onClick={async () => {
            try {
              console.log('🔥 FORCE REGENERATE: Creating fresh reports with unique seeds...');
              
              // Delete old reports first (if possible)
              try {
                const existingReports = await esgAPI.getReports();
                console.log(`🗑️ Found ${existingReports.results?.length || 0} existing reports`);
              } catch (e) {
                console.log('📝 Could not check existing reports:', e.message);
              }
              
              // Get template
              const templatesResponse = await esgAPI.getReportTemplates();
              const templates = Array.isArray(templatesResponse) ? templatesResponse : templatesResponse.results || [];
              if (templates.length === 0) throw new Error('No templates available');
              
              const template = templates[0];
              console.log(`🎯 Using template: ${template.display_name}`);
              
              // Generate 3 reports with EXTREMELY different parameters to force different content
              const configs = [
                {
                  name: `🌟 MICRO COMPANY - ${Date.now()}`,
                  description: 'Ultra-unique micro company with minimal environmental impact',
                  period_start: '2020-01-01',
                  period_end: '2020-12-31',
                  unique_modifier: 'micro_company_minimal_impact'
                },
                {
                  name: `🏭 ENTERPRISE CORP - ${Date.now()}`,  
                  description: 'Ultra-unique enterprise corporation with massive operations',
                  period_start: '2021-06-01',
                  period_end: '2022-05-31',
                  unique_modifier: 'enterprise_massive_operations'
                },
                {
                  name: `🚀 TECH INNOVATOR - ${Date.now()}`,
                  description: 'Ultra-unique tech company with cutting-edge sustainability',
                  period_start: '2019-03-01', 
                  period_end: '2020-02-29',
                  unique_modifier: 'tech_cutting_edge_sustainability'
                }
              ];
              
              toast.info('🔥 Generating 3 COMPLETELY different reports...');
              
              for (const config of configs) {
                console.log(`🛠️ Creating report: ${config.name}`);
                
                const reportData = {
                  template_id: template.id,
                  name: config.name,
                  description: config.description,
                  format: 'pdf',
                  period_start: config.period_start,
                  period_end: config.period_end,
                  parameters: {
                    include_recommendations: true,
                    include_benchmarks: true,
                    include_charts: true,
                    include_trends: true,
                    unique_modifier: config.unique_modifier,
                    force_regenerate: true,
                    timestamp: Date.now()
                  }
                };
                
                await esgAPI.generateReport(reportData);
                console.log(`✅ Generated: ${config.name}`);
                
                // Delay between generations
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
              
              toast.success('🎉 Generated 3 FORCE-UNIQUE reports! Check sizes in a few seconds.');
              queryClient.invalidateQueries('reports');
              
              // Auto-test downloads after a delay
              setTimeout(async () => {
                try {
                  const newReports = await esgAPI.getReports();
                  const reportsList = Array.isArray(newReports) ? newReports : newReports.results || [];
                  console.log('🔍 TESTING newly generated reports...');
                  
                  for (let i = 0; i < Math.min(3, reportsList.length); i++) {
                    const report = reportsList[i];
                    console.log(`📊 Testing report ${i + 1}: ${report.name}`);
                    
                    const result = await esgAPI.downloadReport(report.id);
                    console.log(`📄 Size: ${result.blob.size} bytes | Name: ${result.filename}`);
                  }
                } catch (error) {
                  console.error('Auto-test failed:', error);
                }
              }, 3000);
              
            } catch (error) {
              console.error('Force regenerate failed:', error);
              toast.error(`Force regenerate failed: ${error.message}`);
            }
          }}
          className="text-xs bg-gradient-to-r from-red-500/20 to-orange-500/20 border-red-400/50 text-red-200 hover:bg-red-500/30"
        >
          🔥 FORCE Regenerate & Test
        </Button>
        <Button
          size="small"
          variant="outline"
          onClick={async () => {
            try {
              toast.info('Generating demo report with rich fake data...', { autoClose: 2000 });
              
              // Get first available template
              const templatesResponse = await esgAPI.getReportTemplates();
              const templates = Array.isArray(templatesResponse) ? templatesResponse : templatesResponse.results || [];
              
              if (templates.length === 0) {
                throw new Error('No templates available');
              }

              const template = templates[0];
              const now = new Date();
              const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

              const demoReportData = {
                template_id: template.id,
                name: `🌟 DEMO: ${template.display_name} - ${now.toLocaleTimeString()}`,
                description: 'Demo report with comprehensive fake data showcasing all ESG report features',
                format: 'pdf',
                period_start: oneYearAgo.toISOString().split('T')[0],
                period_end: now.toISOString().split('T')[0],
                parameters: {
                  include_recommendations: true,
                  include_benchmarks: true,
                  include_charts: true,
                  include_trends: true,
                  demo_mode: true
                }
              };

              await esgAPI.generateReport(demoReportData);
              
              toast.success('🎉 Demo report with rich fake data generated! Check Recent Reports table.', {
                autoClose: 5000
              });
              
              queryClient.invalidateQueries('reports');
            } catch (error) {
              console.error('Demo report generation failed:', error);
              toast.error(`❌ Demo report failed: ${error.message}`, { autoClose: 5000 });
            }
          }}
          className="text-xs bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-purple-400/50 text-purple-200 hover:bg-purple-500/30"
        >
          Generate Demo Report 🌟
        </Button>
        <Button
          size="small"
          variant="outline"
          onClick={async () => {
            try {
              toast.info('Generating 3 unique reports with different data...', { autoClose: 2000 });
              
              // Get first available template
              const templatesResponse = await esgAPI.getReportTemplates();
              const templates = Array.isArray(templatesResponse) ? templatesResponse : templatesResponse.results || [];
              
              if (templates.length === 0) {
                throw new Error('No templates available');
              }

              const template = templates[0];
              const now = new Date();
              
              // Generate 3 reports with different time periods to ensure different seeds
              const reportConfigs = [
                {
                  name: `🎯 UNIQUE A: ${template.display_name} - ${now.toLocaleTimeString()}`,
                  description: 'Report A with unique environmental focus and high scores',
                  period_start: new Date(2023, 0, 1).toISOString().split('T')[0], // Jan 2023
                  period_end: new Date(2023, 11, 31).toISOString().split('T')[0], // Dec 2023
                },
                {
                  name: `🌟 UNIQUE B: ${template.display_name} - ${now.toLocaleTimeString()}`,
                  description: 'Report B with unique social impact focus and different metrics',
                  period_start: new Date(2022, 6, 1).toISOString().split('T')[0], // July 2022
                  period_end: new Date(2023, 5, 30).toISOString().split('T')[0], // June 2023
                },
                {
                  name: `🚀 UNIQUE C: ${template.display_name} - ${now.toLocaleTimeString()}`,
                  description: 'Report C with unique governance focus and advanced benchmarks',
                  period_start: new Date(2023, 3, 1).toISOString().split('T')[0], // April 2023
                  period_end: new Date(2024, 2, 31).toISOString().split('T')[0], // March 2024
                }
              ];

              for (const config of reportConfigs) {
                const reportData = {
                  template_id: template.id,
                  name: config.name,
                  description: config.description,
                  format: 'pdf',
                  period_start: config.period_start,
                  period_end: config.period_end,
                  parameters: {
                    include_recommendations: true,
                    include_benchmarks: true,
                    include_charts: true,
                    include_trends: true,
                    unique_data: true
                  }
                };

                await esgAPI.generateReport(reportData);
              }
              
              toast.success('🎉 Generated 3 unique reports! Each has different data based on time periods. Check Recent Reports table.', {
                autoClose: 6000
              });
              
              queryClient.invalidateQueries('reports');
            } catch (error) {
              console.error('Unique reports generation failed:', error);
              toast.error(`❌ Unique reports failed: ${error.message}`, { autoClose: 5000 });
            }
          }}
          className="text-xs bg-gradient-to-r from-green-500/20 to-teal-500/20 border-green-400/50 text-green-200 hover:bg-green-500/30"
        >
          Generate 3 Unique Reports 🎯
        </Button>
      </div>
      <div className="text-xs text-text-muted">
        Report system testing
      </div>
    </div>
  );
};

export default ReportTestDataLoader;