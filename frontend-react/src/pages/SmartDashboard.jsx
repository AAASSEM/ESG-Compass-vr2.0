import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, Legend } from 'recharts';
import Layout from '../components/layout/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { esgAPI } from '../services/api';

const SmartDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMetric, setSelectedMetric] = useState('energy_consumption');
  const [dataSource, setDataSource] = useState('all'); // 'all', 'environmental', 'social', 'governance'

  // Clear cached data when user changes (login/logout)
  useEffect(() => {
    console.log('👤 SMARTDASHBOARD: User effect - user:', user?.id);
    if (user?.id) {
      console.log('👤 SMARTDASHBOARD: User logged in, clearing all cache for fresh data');
      queryClient.clear(); // Clear everything
      queryClient.removeQueries(); // Remove all queries
    } else {
      console.log('👤 SMARTDASHBOARD: No user (logged out), clearing cache');
      queryClient.clear();
    }
  }, [user?.id, queryClient]);

  // Also clear cache when component mounts
  useEffect(() => {
    console.log('👤 SMARTDASHBOARD: Component mounted, ensuring fresh data');
    queryClient.invalidateQueries();
  }, []);

  // Load real data from API (like Reports does)
  const { data: dashboardOverview, isLoading: overviewLoading } = useQuery(
    ['dashboard-overview', user?.id],
    () => {
      console.log('🔍 API CALL: getDashboardOverview for user:', user?.id, user?.full_name);
      return esgAPI.getDashboardOverview();
    },
    {
      enabled: !!user?.id,
      retry: 1,
      staleTime: 30000, // 30 seconds
      cacheTime: 300000, // 5 minutes
      onSuccess: (data) => {
        console.log('🔍 API RESPONSE: getDashboardOverview returned:', data);
      },
      onError: (error) => {
        console.error('Dashboard overview error:', error);
      }
    }
  );

  const { data: dashboardMetrics, isLoading: metricsLoading } = useQuery(
    ['dashboard-metrics', user?.id],
    () => {
      console.log('🔍 API CALL: getDashboardMetrics for user:', user?.id, user?.full_name);
      return esgAPI.getDashboardMetrics();
    },
    {
      enabled: !!user?.id,
      retry: 1,
      staleTime: 30000, // 30 seconds
      cacheTime: 300000, // 5 minutes
      onSuccess: (data) => {
        console.log('🔍 API RESPONSE: getDashboardMetrics returned:', data);
      },
      onError: (error) => {
        console.error('Dashboard metrics error:', error);
      }
    }
  );

  const { data: socialFileData } = useQuery(
    ['social-file-data', user?.id],
    () => {
      console.log('🔍 API CALL: getSocialFileData for user:', user?.id);
      return esgAPI.getSocialFileData();
    },
    { 
      enabled: !!user?.id, 
      retry: 1, 
      staleTime: 30000, 
      cacheTime: 300000,
      onSuccess: (data) => console.log('🔍 API RESPONSE: getSocialFileData:', data)
    }
  );

  const { data: environmentalFileData } = useQuery(
    ['environmental-file-data', user?.id], 
    () => {
      console.log('🔍 API CALL: getEnvironmentalFileData for user:', user?.id);
      return esgAPI.getEnvironmentalFileData();
    },
    { 
      enabled: !!user?.id, 
      retry: 1, 
      staleTime: 30000, 
      cacheTime: 300000,
      onSuccess: (data) => console.log('🔍 API RESPONSE: getEnvironmentalFileData:', data)
    }
  );

  const { data: governanceFileData } = useQuery(
    ['governance-file-data', user?.id],
    () => {
      console.log('🔍 API CALL: getGovernanceFileData for user:', user?.id);
      return esgAPI.getGovernanceFileData();
    },
    { 
      enabled: !!user?.id, 
      retry: 1, 
      staleTime: 30000, 
      cacheTime: 300000,
      onSuccess: (data) => console.log('🔍 API RESPONSE: getGovernanceFileData:', data)
    }
  );

  // Refresh API data
  const { refetch: refreshData, isLoading: isRefreshing } = useQuery(
    ['dashboard-refresh', user?.id],
    () => Promise.all([
      esgAPI.getDashboardOverview(),
      esgAPI.getDashboardMetrics(),
      esgAPI.getSocialFileData(),
      esgAPI.getEnvironmentalFileData(),
      esgAPI.getGovernanceFileData()
    ]),
    {
      enabled: false, // Only run when manually triggered
      onSuccess: () => {
        console.log('✅ Dashboard data refreshed successfully');
      },
      onError: (error) => {
        console.error('❌ Failed to refresh dashboard data:', error);
      }
    }
  );

  // Convert API data to unified metrics format
  const getMetricsFromAPI = () => {
    const metrics = {};
    
    // Process dashboard overview data (main ESG metrics)
    if (dashboardOverview) {
      const overviewData = [
        { key: 'overall_esg_score', value: dashboardOverview.overall_esg_score, unit: 'score', category: 'general' },
        { key: 'environmental_score', value: dashboardOverview.environmental_score, unit: 'score', category: 'environmental' },
        { key: 'social_score', value: dashboardOverview.social_score, unit: 'score', category: 'social' },
        { key: 'governance_score', value: dashboardOverview.governance_score, unit: 'score', category: 'governance' },
        { key: 'data_completion_percentage', value: dashboardOverview.data_completion_percentage, unit: '%', category: 'general' },
        { key: 'evidence_completion_percentage', value: dashboardOverview.evidence_completion_percentage, unit: '%', category: 'general' }
      ];
      
      overviewData.forEach(item => {
        if (item.value !== null && item.value !== undefined) {
          metrics[item.key] = {
            metric: item.key,
            values: [item.value],
            latest: item.value,
            average: item.value,
            total: item.value,
            unit: item.unit,
            category: item.category,
            trend: [{
              date: new Date().toISOString(),
              value: item.value,
              source: 'dashboard_overview'
            }],
            change: dashboardOverview[item.key.replace('_score', '_change')] || 0
          };
        }
      });
      
      // Process environmental metrics from overview
      if (dashboardOverview.environmental_metrics) {
        const envMetrics = dashboardOverview.environmental_metrics;
        if (envMetrics.energy_consumption) {
          metrics['energy_consumption'] = {
            metric: 'energy_consumption',
            values: [envMetrics.energy_consumption.current_kwh],
            latest: envMetrics.energy_consumption.current_kwh,
            average: envMetrics.energy_consumption.current_kwh,
            total: envMetrics.energy_consumption.current_kwh,
            unit: 'kWh',
            category: 'environmental',
            trend: [{
              date: new Date().toISOString(),
              value: envMetrics.energy_consumption.current_kwh,
              source: 'overview_environmental'
            }],
            change: envMetrics.energy_consumption.reduction_percentage || 0
          };
        }
        if (envMetrics.water_usage) {
          metrics['water_usage'] = {
            metric: 'water_usage',
            values: [envMetrics.water_usage.current_liters],
            latest: envMetrics.water_usage.current_liters,
            average: envMetrics.water_usage.current_liters,
            total: envMetrics.water_usage.current_liters,
            unit: 'L',
            category: 'environmental',
            trend: [{
              date: new Date().toISOString(),
              value: envMetrics.water_usage.current_liters,
              source: 'overview_environmental'
            }],
            change: 0
          };
        }
        if (envMetrics.carbon_emissions) {
          metrics['carbon_emissions'] = {
            metric: 'carbon_emissions',
            values: [envMetrics.carbon_emissions.total_tco2],
            latest: envMetrics.carbon_emissions.total_tco2,
            average: envMetrics.carbon_emissions.total_tco2,
            total: envMetrics.carbon_emissions.total_tco2,
            unit: 'tCO2',
            category: 'environmental',
            trend: [{
              date: new Date().toISOString(),
              value: envMetrics.carbon_emissions.total_tco2,
              source: 'overview_environmental'
            }],
            change: 0
          };
        }
      }
    }
    
    // Process dashboard metrics
    if (dashboardMetrics?.results) {
      dashboardMetrics.results.forEach(metric => {
        const key = metric.metric_type || metric.name?.toLowerCase().replace(/\s+/g, '_');
        if (key) {
          metrics[key] = {
            metric: key,
            values: [metric.value],
            latest: metric.value,
            average: metric.value,
            total: metric.value,
            unit: metric.unit || 'units',
            category: 'general',
            trend: [{
              date: metric.date || metric.created_at || new Date().toISOString(),
              value: metric.value,
              source: 'api'
            }],
            change: metric.change_percentage || 0
          };
        }
      });
    }

    // Process environmental data
    if (environmentalFileData) {
      // Handle direct object format from the file data API
      const envData = [
        { key: 'energy_consumption', value: environmentalFileData.energy_consumption, unit: 'kWh' },
        { key: 'water_usage', value: environmentalFileData.water_usage, unit: 'L' },
        { key: 'waste_generated', value: environmentalFileData.waste_generated, unit: 'kg' },
        { key: 'carbon_emissions', value: environmentalFileData.carbon_emissions, unit: 'tCO2' },
        { key: 'renewable_energy', value: environmentalFileData.renewable_energy, unit: '%' }
      ];
      
      envData.forEach(item => {
        if (item.value !== null && item.value !== undefined) {
          metrics[item.key] = {
            metric: item.key,
            values: [item.value],
            latest: item.value,
            average: item.value,
            total: item.value,
            unit: item.unit,
            category: 'environmental',
            trend: [{
              date: new Date().toISOString(),
              value: item.value,
              source: 'environmental_file'
            }],
            change: 0 // No historical data for change calculation yet
          };
        }
      });
    }

    // Process social data
    if (socialFileData) {
      // Handle direct object format from the file data API
      const socialData = [
        { key: 'training_hours', value: socialFileData.training_hours, unit: 'hours' },
        { key: 'safety_incidents', value: socialFileData.safety_incidents, unit: 'incidents' },
        { key: 'satisfaction_score', value: socialFileData.satisfaction_score, unit: '%' },
        { key: 'diversity_ratio', value: socialFileData.diversity_ratio, unit: '%' },
        { key: 'total_employees', value: socialFileData.total_employees, unit: 'employees' }
      ];
      
      socialData.forEach(item => {
        if (item.value !== null && item.value !== undefined) {
          metrics[item.key] = {
            metric: item.key,
            values: [item.value],
            latest: item.value,
            average: item.value,
            total: item.value,
            unit: item.unit,
            category: 'social',
            trend: [{
              date: new Date().toISOString(),
              value: item.value,
              source: 'social_file'
            }],
            change: 0 // No historical data for change calculation yet
          };
        }
      });
    }

    // Process governance data
    if (governanceFileData) {
      // Handle direct object format from the file data API
      const govData = [
        { key: 'board_meetings', value: governanceFileData.board_meetings, unit: 'meetings' },
        { key: 'compliance_score', value: governanceFileData.compliance_score, unit: '%' },
        { key: 'audit_findings', value: governanceFileData.audit_findings, unit: 'findings' },
        { key: 'policy_updates', value: governanceFileData.policy_updates, unit: 'updates' },
        { key: 'stakeholder_engagement', value: governanceFileData.stakeholder_engagement, unit: '%' }
      ];
      
      govData.forEach(item => {
        if (item.value !== null && item.value !== undefined) {
          metrics[item.key] = {
            metric: item.key,
            values: [item.value],
            latest: item.value,
            average: item.value,
            total: item.value,
            unit: item.unit,
            category: 'governance',
            trend: [{
              date: new Date().toISOString(),
              value: item.value,
              source: 'governance_file'
            }],
            change: 0 // No historical data for change calculation yet
          };
        }
      });
    }

    console.log('📊 API Metrics processed:', metrics);
    return metrics;
  };

  // Get filtered metrics based on data source selection
  const getFilteredMetrics = () => {
    const allMetrics = getMetricsFromAPI();
    
    // Filter out metrics with zero or null values to ensure we only count real data
    const validMetrics = {};
    Object.keys(allMetrics).forEach(key => {
      const metric = allMetrics[key];
      // Only include metrics that have meaningful data (non-zero, non-null)
      if (metric && metric.latest !== null && metric.latest !== undefined && metric.latest !== 0) {
        validMetrics[key] = metric;
      }
    });
    
    if (dataSource === 'all') {
      return validMetrics;
    }
    
    // Filter by category
    const filtered = {};
    Object.keys(validMetrics).forEach(key => {
      const metric = validMetrics[key];
      if (dataSource === 'environmental' && metric.category === 'environmental') {
        filtered[key] = metric;
      } else if (dataSource === 'social' && metric.category === 'social') {
        filtered[key] = metric;
      } else if (dataSource === 'governance' && metric.category === 'governance') {
        filtered[key] = metric;
      }
    });
    
    return filtered;
  };

  // Get time series data for a specific metric
  const getTimeSeriesData = (metricName) => {
    const filteredMetrics = getFilteredMetrics();
    const metric = filteredMetrics[metricName];
    if (!metric || !metric.trend) return [];
    
    // Group by month for cleaner visualization
    const monthlyData = {};
    
    metric.trend.forEach(point => {
      const date = new Date(point.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: new Date(date.getFullYear(), date.getMonth()).toLocaleDateString('en', { month: 'short' }),
          values: [],
          year: date.getFullYear()
        };
      }
      monthlyData[monthKey].values.push(point.value);
    });
    
    // Calculate averages and format for chart
    return Object.values(monthlyData).map(month => ({
      name: month.month,
      value: month.values.reduce((a, b) => a + b, 0) / month.values.length,
      min: Math.min(...month.values),
      max: Math.max(...month.values),
      count: month.values.length
    }));
  };

  // Get ESG scores from real extracted data
  const calculateESGScores = () => {
    console.log('🔍 CALCULATE ESG: === START CALCULATION FOR', user?.full_name || user?.email, '===');
    
    const filteredMetrics = getFilteredMetrics();
    console.log('🔍 CALCULATE ESG: Filtered metrics:', filteredMetrics);
    
    const scores = {
      environmental: 0,
      social: 0,
      governance: 0,
      overall: 0
    };
    
    console.log('🔍 CALCULATE ESG: Initial scores:', scores);
    
    // Always calculate scores from available data (removed validation that was forcing 0%)
    
    // First, try to use real scores from API data
    if (filteredMetrics.environmental_score) {
      scores.environmental = filteredMetrics.environmental_score.latest || 0;
      console.log('🔍 CALCULATE ESG: Set environmental from API:', scores.environmental);
    }
    if (filteredMetrics.social_score) {
      scores.social = filteredMetrics.social_score.latest || 0;
      console.log('🔍 CALCULATE ESG: Set social from API:', scores.social);
    }
    if (filteredMetrics.governance_score) {
      scores.governance = filteredMetrics.governance_score.latest || 0;
      console.log('🔍 CALCULATE ESG: Set governance from API:', scores.governance);
    }
    if (filteredMetrics.overall_esg_score) {
      scores.overall = filteredMetrics.overall_esg_score.latest || 0;
      console.log('🔍 CALCULATE ESG: Set overall from API:', scores.overall);
      
      if (scores.overall === 76.67 || Math.round(scores.overall * 100) === 7667) {
        console.log('✅ FOUND 76.67% SOURCE: overall_esg_score.latest =', filteredMetrics.overall_esg_score.latest);
        console.log('✅ This is the CORRECT data path!');
      }
      
      if (scores.overall === 58.33 || Math.round(scores.overall * 100) === 5833) {
        console.error('🚨 FOUND 58.33% SOURCE: overall_esg_score.latest =', filteredMetrics.overall_esg_score.latest);
        console.error('🚨 Full overall_esg_score object:', filteredMetrics.overall_esg_score);
      }
    }
    
    // If no real scores available, fall back to calculating from metrics
    if (scores.environmental === 0) {
      console.log('🔍 CALCULATE ESG: Calculating environmental score from metrics...');
      const envMetrics = ['energy_consumption', 'water_usage', 'waste_generated', 'carbon_emissions', 'renewable_energy'];
      const envData = envMetrics.map(m => filteredMetrics[m]).filter(metric => {
        // Only count metrics with meaningful, non-zero values
        return metric && metric.latest !== null && metric.latest !== undefined && metric.latest !== 0;
      });
      console.log('🔍 CALCULATE ESG: Environmental data count:', envData.length);
      
      if (envData.length > 0) {
        // Base score for having environmental data
        scores.environmental = 50 + (envData.length * 10);
        console.log('🔍 CALCULATE ESG: Environmental base score:', scores.environmental);
        // Simple scoring: if metrics are decreasing, score goes up
        envData.forEach(metric => {
          if (metric.change && metric.change < 0) {
            scores.environmental += 5; // Improvement
          } else if (metric.change && metric.change === 0) {
            scores.environmental += 2; // Stable
          } else {
            scores.environmental += 1; // Needs improvement
          }
        });
        scores.environmental = Math.min(100, scores.environmental);
        console.log('🔍 CALCULATE ESG: Final environmental score:', scores.environmental);
      }
      // If no meaningful data, score stays 0
    }
    
    if (scores.social === 0) {
      console.log('🔍 CALCULATE ESG: Calculating social score from metrics...');
      const socialMetrics = ['satisfaction_score', 'training_hours', 'diversity_ratio', 'safety_incidents', 'total_employees', 'employee_satisfaction_score'];
      console.log('🔍 CALCULATE ESG: Checking social metrics:', socialMetrics);
      
      const socialData = socialMetrics.map(m => {
        const metric = filteredMetrics[m];
        console.log('🔍 CALCULATE ESG: Social metric', m, ':', metric);
        return metric;
      }).filter(metric => {
        // Only count metrics with meaningful, non-zero values
        const isValid = metric && metric.latest !== null && metric.latest !== undefined && metric.latest !== 0;
        console.log('🔍 CALCULATE ESG: Metric valid?', isValid, 'Latest value:', metric?.latest);
        return isValid;
      });
      
      console.log('🔍 CALCULATE ESG: Valid social data count:', socialData.length);
      console.log('🔍 CALCULATE ESG: Valid social data:', socialData);
      
      if (socialData.length > 0) {
        // Base score for having social data
        scores.social = 40 + (socialData.length * 10);
        console.log('🔍 CALCULATE ESG: Social base score:', scores.social);
        socialData.forEach(metric => {
          if (metric.metric === 'safety_incidents') {
            // Lower is better for incidents
            scores.social += metric.change < 0 ? 5 : 2;
          } else {
            // Higher is better for other social metrics
            scores.social += metric.change > 0 ? 5 : 3;
          }
        });
        scores.social = Math.min(100, scores.social);
        console.log('🔍 CALCULATE ESG: Final social score:', scores.social);
      } else {
        console.log('🔍 CALCULATE ESG: ⚠️ No valid social data found - score stays 0');
      }
      // If no meaningful data, score stays 0
    }
    
    if (scores.governance === 0) {
      const govMetrics = ['compliance_score', 'board_meetings', 'audit_findings', 'policy_updates', 'policy_compliance'];
      const govData = govMetrics.map(m => filteredMetrics[m]).filter(metric => {
        // Only count metrics with meaningful, non-zero values
        return metric && metric.latest !== null && metric.latest !== undefined && metric.latest !== 0;
      });
      
      if (govData.length > 0) {
        scores.governance = 75; // Base score if data exists
      }
      // If no meaningful data, score stays 0
    }
    
    // Calculate overall if not provided
    if (scores.overall === 0) {
      console.log('🔍 CALCULATE ESG: Calculating overall from individual scores...');
      console.log('🔍 CALCULATE ESG: Individual scores for overall calc:', {
        environmental: scores.environmental,
        social: scores.social, 
        governance: scores.governance
      });
      scores.overall = Math.round(((scores.environmental + scores.social + scores.governance) / 3) * 100) / 100;
      console.log('🔍 CALCULATE ESG: Calculated overall score:', scores.overall);
      
      if (scores.overall === 58.33 || Math.round(scores.overall * 100) === 5833) {
        console.error('🚨 FOUND 58.33% SOURCE: Calculated from individual scores!');
        console.error('🚨 Calculation: (', scores.environmental, '+', scores.social, '+', scores.governance, ') / 3 =', scores.overall);
      }
    }
    
    // If score is 50 or less, show 0
    const adjustedScores = {
      environmental: scores.environmental <= 50 ? 0 : scores.environmental,
      social: scores.social <= 50 ? 0 : scores.social,
      governance: scores.governance <= 50 ? 0 : scores.governance,
      overall: scores.overall <= 50 ? 0 : scores.overall
    };
    
    console.log('🔍 SCORE ADJUSTMENT: Original vs Adjusted:', {
      original: scores,
      adjusted: adjustedScores
    });
    console.log('🔍 CALCULATE ESG: === FINAL SCORES ===', adjustedScores);
    return adjustedScores;
  };

  const esgScores = React.useMemo(() => {
    console.log('🎯 SMARTDASHBOARD: === ESG SCORES CALCULATION START ===');
    console.log('🎯 SMARTDASHBOARD: User:', user?.full_name || user?.email);
    console.log('🎯 SMARTDASHBOARD: Available data:', {
      socialFileData: !!socialFileData,
      environmentalFileData: !!environmentalFileData,
      governanceFileData: !!governanceFileData,
      dashboardMetrics: !!dashboardMetrics,
      dashboardOverview: !!dashboardOverview
    });
    
    const scores = calculateESGScores();
    
    console.log('🎯 SMARTDASHBOARD: === FINAL ESG SCORES ===');
    console.log('🎯 SMARTDASHBOARD: Environmental:', scores.environmental);
    console.log('🎯 SMARTDASHBOARD: Social:', scores.social);
    console.log('🎯 SMARTDASHBOARD: Governance:', scores.governance);
    console.log('🎯 SMARTDASHBOARD: Overall:', scores.overall);
    
    if (scores.overall === 76.67) {
      console.log('✅ SHOWING CORRECT DATA: 76.67%');
    } else if (scores.overall === 58.33) {
      console.log('🚨 SHOWING WRONG DATA: 58.33%');
    } else {
      console.log('🎯 SHOWING OTHER DATA:', scores.overall + '%');
    }
    
    return scores;
  }, [socialFileData, environmentalFileData, governanceFileData, user, dashboardMetrics, dashboardOverview]);

  // Get comparison data for different API sources
  const getSourceComparison = () => {
    const filteredMetrics = getFilteredMetrics();
    const sources = {
      api: 0,
      environmental_file: 0,
      social_file: 0,
      governance_file: 0
    };
    
    Object.values(filteredMetrics).forEach(metric => {
      if (metric.trend) {
        metric.trend.forEach(point => {
          const source = point.source || 'api';
          sources[source] = (sources[source] || 0) + 1;
        });
      }
    });
    
    return Object.entries(sources)
      .filter(([_, count]) => count > 0)
      .map(([source, count]) => ({
        name: source.replace('_', ' ').toUpperCase(),
        value: count,
        fill: source === 'api' ? '#3DAEFF' : 
              source === 'environmental_file' ? '#2EC57D' :
              source === 'social_file' ? '#20C5C5' : 
              source === 'governance_file' ? '#F59E0B' : '#9CA3AF'
      }));
  };

  // Get metric cards data based on filtered metrics
  const getMetricCards = () => {
    const filteredMetrics = getFilteredMetrics();
    const cards = [];
    
    // Exclude score cards that are already shown in the ESG overview section
    const excludedKeys = ['overall_esg_score', 'environmental_score', 'social_score', 'governance_score'];
    const availableKeys = Object.keys(filteredMetrics).filter(key => !excludedKeys.includes(key));
    
    // Show all available metrics
    const metricKeys = availableKeys;
    
    metricKeys.forEach((key, index) => {
      const metric = filteredMetrics[key];
      if (metric && metric.latest !== undefined && metric.latest !== 0) {
        // Define card styling based on metric type or index
        const cardConfigs = {
          energy_consumption: { title: 'Energy Consumption', icon: 'fa-bolt', color: '#F59E0B', unit: 'kWh' },
          water_usage: { title: 'Water Usage', icon: 'fa-droplet', color: '#3DAEFF', unit: 'L' },
          waste_generated: { title: 'Waste Generated', icon: 'fa-trash-can', color: '#EF4444', unit: 'kg' },
          employee_satisfaction: { title: 'Employee Satisfaction', icon: 'fa-face-smile', color: '#2EC57D', unit: '%' },
          satisfaction_score: { title: 'Satisfaction Score', icon: 'fa-thumbs-up', color: '#2EC57D', unit: 'points' },
          carbon_emissions: { title: 'Carbon Emissions', icon: 'fa-smog', color: '#6B7280', unit: 'kg CO2' },
          compliance_score: { title: 'Compliance Score', icon: 'fa-shield-check', color: '#10B981', unit: 'points' },
          safety_incidents: { title: 'Safety Incidents', icon: 'fa-triangle-exclamation', color: '#EF4444', unit: 'incidents' },
          training_hours: { title: 'Training Hours', icon: 'fa-graduation-cap', color: '#8B5CF6', unit: 'hours' },
          total_employees: { title: 'Total Employees', icon: 'fa-users', color: '#06B6D4', unit: 'people' },
          diversity_ratio: { title: 'Diversity Ratio', icon: 'fa-people-group', color: '#F97316', unit: '%' },
          board_meetings: { title: 'Board Meetings', icon: 'fa-handshake', color: '#10B981', unit: 'meetings' },
          audit_findings: { title: 'Audit Findings', icon: 'fa-magnifying-glass', color: '#EF4444', unit: 'findings' },
          policy_updates: { title: 'Policy Updates', icon: 'fa-file-pen', color: '#8B5CF6', unit: 'updates' },
          policy_compliance: { title: 'Policy Compliance', icon: 'fa-check-circle', color: '#10B981', unit: '%' },
          renewable_energy: { title: 'Renewable Energy', icon: 'fa-solar-panel', color: '#22C55E', unit: '%' }
        };
        
        const config = cardConfigs[key] || {
          title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          icon: ['fa-chart-line', 'fa-chart-bar', 'fa-chart-pie', 'fa-chart-area', 'fa-thermometer-half', 'fa-cog', 'fa-star'][index % 7],
          color: ['#F59E0B', '#3DAEFF', '#EF4444', '#2EC57D', '#8B5CF6', '#06B6D4', '#F97316'][index % 7],
          unit: metric.unit || 'units'
        };
        
        cards.push({
          title: config.title,
          value: `${metric.latest?.toFixed(0) || '–'} ${config.unit}`,
          change: metric.change || 0,
          icon: config.icon,
          color: config.color
        });
      }
    });
    
    return cards;
  };

  const metricCards = getMetricCards();

  // Radar chart data for ESG performance using filtered metrics
  const radarData = (() => {
    const filteredMetrics = getFilteredMetrics();
    return [
      { category: 'Energy', value: filteredMetrics.energy_consumption ? 100 - (filteredMetrics.energy_consumption.latest / 1000 * 10) : 0 },
      { category: 'Water', value: filteredMetrics.water_usage ? 100 - (filteredMetrics.water_usage.latest / 1000 * 10) : 0 },
      { category: 'Waste', value: filteredMetrics.waste_generated ? 100 - (filteredMetrics.waste_generated.latest / 100 * 10) : 0 },
      { category: 'Social', value: filteredMetrics.employee_satisfaction?.latest || 0 },
      { category: 'Safety', value: filteredMetrics.safety_incidents ? 100 - (filteredMetrics.safety_incidents.latest * 10) : 0 },
      { category: 'Governance', value: filteredMetrics.policy_compliance?.latest || 75 }
    ];
  })();

  // Show loading spinner when API data is being fetched
  if (overviewLoading || metricsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-high mb-2">Smart ESG Dashboard</h1>
            <p className="text-text-muted">
              Smart dashboard with real-time ESG metrics and analytics
            </p>
            {(() => {
              const filteredMetrics = getFilteredMetrics();
              return Object.keys(filteredMetrics).length === 0;
            })() && (
              <div className="mt-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-center text-yellow-400 text-sm">
                  <i className="fa-solid fa-exclamation-triangle mr-2"></i>
                  No data found from API. Check backend data sources.
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-text-muted">Data Source:</span>
              <select 
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                className="bg-white/10 border border-white/20 rounded px-3 py-1 text-text-high"
              >
                <option value="all" className="bg-[#131A2C] text-text-high">All Categories</option>
                <option value="environmental" className="bg-[#131A2C] text-text-high">Environmental</option>
                <option value="social" className="bg-[#131A2C] text-text-high">Social</option>
                <option value="governance" className="bg-[#131A2C] text-text-high">Governance</option>
              </select>
            </div>
          </div>
        </div>

        {/* ESG Score Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-muted">Overall ESG Score</h3>
              <i className="fa-solid fa-chart-pie text-brand-green"></i>
            </div>
            <div className="text-3xl font-bold mb-2 text-brand-green">
              {esgScores.overall > 0 ? `${Math.round(esgScores.overall)}%` : '–'}
            </div>
            <div className="text-xs text-text-muted">
              {esgScores.overall > 0 ? 'Calculated from extracted data' : 'No data extracted yet'}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-muted">Environmental</h3>
              <i className="fa-solid fa-leaf text-green-500"></i>
            </div>
            <div className="text-3xl font-bold mb-2 text-green-500">
              {esgScores.environmental > 0 ? `${Math.round(esgScores.environmental)}%` : '–'}
            </div>
            <div className="text-xs text-green-400">
              {Object.keys(getFilteredMetrics()).filter(m => ['energy_consumption', 'water_usage', 'waste_generated', 'carbon_emissions', 'renewable_energy'].includes(m)).length} metrics tracked
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-muted">Social</h3>
              <i className="fa-solid fa-users text-blue-500"></i>
            </div>
            <div className="text-3xl font-bold mb-2 text-blue-500">
              {esgScores.social > 0 ? `${Math.round(esgScores.social)}%` : '–'}
            </div>
            <div className="text-xs text-blue-400">
              {Object.keys(getFilteredMetrics()).filter(m => ['satisfaction_score', 'training_hours', 'safety_incidents', 'total_employees', 'diversity_ratio', 'employee_satisfaction_score'].includes(m)).length} metrics tracked
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-muted">Governance</h3>
              <i className="fa-solid fa-shield-halved text-teal-500"></i>
            </div>
            <div className="text-3xl font-bold mb-2 text-teal-500">
              {esgScores.governance > 0 ? `${Math.round(esgScores.governance)}%` : '–'}
            </div>
            <div className="text-xs text-teal-400">
              {Object.keys(getFilteredMetrics()).filter(m => ['compliance_score', 'board_meetings', 'audit_findings', 'policy_updates', 'policy_compliance'].includes(m)).length} metrics tracked
            </div>
          </Card>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metricCards.length > 0 ? (
            metricCards.map((card, index) => (
              <Card key={index}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-text-muted">{card.title}</h3>
                  <i className={`fa-solid ${card.icon}`} style={{ color: card.color }}></i>
                </div>
                <div className="text-2xl font-bold mb-2 text-text-high">
                  {card.value}
                </div>
                {card.change !== undefined && (
                  <div className={`text-xs flex items-center ${
                    card.change > 0 ? 'text-green-400' : card.change < 0 ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {card.change > 0 ? '↑' : card.change < 0 ? '↓' : '→'} {Math.abs(card.change).toFixed(1)}%
                    <span className="text-text-muted ml-2">vs last period</span>
                  </div>
                )}
              </Card>
            ))
          ) : (
            // Debug: Show what's available
            (() => {
              const filteredMetrics = getFilteredMetrics();
              console.log('🔍 Debug - Available metrics:', filteredMetrics);
              console.log('🔍 Debug - Metric keys:', Object.keys(filteredMetrics));
              console.log('🔍 Debug - Dashboard metrics:', dashboardMetrics);
              console.log('🔍 Debug - Social file data:', socialFileData);
              console.log('🔍 Debug - Environmental file data:', environmentalFileData);
              console.log('🔍 Debug - Governance file data:', governanceFileData);
              
              return (
                <Card>
                  <div className="text-center py-8">
                    <i className="fa-solid fa-exclamation-circle text-4xl text-yellow-500 mb-4"></i>
                    <h3 className="text-text-high font-semibold text-lg mb-2">No Metrics Available</h3>
                    <p className="text-text-muted text-sm mb-4">
                      No metric data found from API. Check console for debug info.
                    </p>
                    <p className="text-xs text-text-muted">
                      Available keys: {Object.keys(filteredMetrics).join(', ') || 'None'}
                    </p>
                  </div>
                </Card>
              );
            })()
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Time Series Chart */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text-high">Metrics Trend</h3>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="bg-white/10 border border-white/20 rounded px-3 py-1 text-sm text-text-high"
              >
                {Object.keys(getFilteredMetrics()).map(metric => (
                  <option key={metric} value={metric} className="bg-[#131A2C] text-text-high">
                    {metric.replace(/_/g, ' ').charAt(0).toUpperCase() + metric.replace(/_/g, ' ').slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="h-64">
              {getTimeSeriesData(selectedMetric).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={getTimeSeriesData(selectedMetric)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'rgba(248,249,250,0.72)', fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'rgba(248,249,250,0.72)', fontSize: 12 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#3DAEFF" 
                      fill="#3DAEFF"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <i className="fa-solid fa-chart-area text-4xl text-text-muted mb-4"></i>
                    <p className="text-text-muted">No data available for this metric</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Data Sources Pie Chart */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text-high">Data Sources</h3>
              <span className="text-xs text-text-muted">Evidence breakdown</span>
            </div>
            <div className="h-64">
              {getSourceComparison().length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getSourceComparison()}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {getSourceComparison().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name) => [`${value} metrics`, name]}
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#F9FAFB'
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value) => <span style={{ color: '#9CA3AF', fontSize: '12px' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <i className="fa-solid fa-database text-4xl text-text-muted mb-4"></i>
                    <p className="text-text-muted">No data sources found</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ESG Performance Radar */}
        <Card>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-text-high">ESG Performance Overview</h3>
            <span className="text-xs text-text-muted">Multi-dimensional analysis</span>
          </div>
          <div className="h-80">
            {radarData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis 
                    dataKey="category" 
                    tick={{ fill: 'rgba(248,249,250,0.72)', fontSize: 12 }}
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 100]}
                    tick={{ fill: 'rgba(248,249,250,0.72)', fontSize: 10 }}
                  />
                  <Radar 
                    name="Performance" 
                    dataKey="value" 
                    stroke="#3DAEFF" 
                    fill="#3DAEFF" 
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <i className="fa-solid fa-radar text-4xl text-text-muted mb-4"></i>
                  <p className="text-text-muted">Upload evidence files to see performance analysis</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default SmartDashboard;