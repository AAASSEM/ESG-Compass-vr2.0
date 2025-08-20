import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

const Home = () => {
  const { user, loginDemo, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleDemoRequest = async () => {
    try {
      // If user is already logged in, log them out first
      if (user) {
        await logout();
      }
      
      // Log in as demo user
      const result = await loginDemo();
      if (result && result.success) {
        toast.success('Demo mode activated!');
        navigate('/dashboard');
      } else {
        toast.error('Demo login failed');
      }
      
    } catch (error) {
      console.error('Demo request error:', error);
      toast.error('Demo login failed');
    }
  };

  const handleLoginClick = () => {
    if (user) {
      logout();
    }
    navigate('/login');
  };
  return (
    <div className="min-h-screen text-text-high font-inter bg-gradient-to-br from-[#131A2C] via-[#1C1330] to-[#131A2C]">
      {/* Header */}
      <header className="relative z-50 px-6 py-6">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-brand-green flex items-center justify-center">
              <i className="fa-solid fa-compass text-white text-lg"></i>
            </div>
            <span className="text-xl font-bold text-text-high">ESG Compass</span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-8">
            <span className="text-text-muted hover:text-text-high transition-colors cursor-pointer">Features</span>
            <span className="text-text-muted hover:text-text-high transition-colors cursor-pointer">Pricing</span>
            <span className="text-text-muted hover:text-text-high transition-colors cursor-pointer">Resources</span>
            <button onClick={handleLoginClick} className="px-4 py-2 text-text-muted hover:text-text-high transition-colors">Login</button>
            <button onClick={handleDemoRequest} className="px-6 py-2 bg-brand-green text-white rounded-lg hover:bg-opacity-90 transition-all">Request Demo</button>
          </div>
          
          <button 
            onClick={toggleMobileMenu}
            className="md:hidden text-text-high p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Toggle mobile menu"
          >
            <i className={`fa-solid ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`}></i>
          </button>
        </nav>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-[#131A2C]/95 backdrop-blur-md border-t border-white/10">
            <div className="px-6 py-4 space-y-2 max-w-7xl mx-auto">
              <button 
                onClick={closeMobileMenu}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg text-text-muted hover:text-text-high hover:bg-brand-green/10 transition-colors font-medium w-full text-left"
              >
                <i className="fa-solid fa-star"></i>
                <span>Features</span>
              </button>
              
              <button 
                onClick={closeMobileMenu}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg text-text-muted hover:text-text-high hover:bg-brand-green/10 transition-colors font-medium w-full text-left"
              >
                <i className="fa-solid fa-dollar-sign"></i>
                <span>Pricing</span>
              </button>
              
              <button 
                onClick={closeMobileMenu}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg text-text-muted hover:text-text-high hover:bg-brand-green/10 transition-colors font-medium w-full text-left"
              >
                <i className="fa-solid fa-book"></i>
                <span>Resources</span>
              </button>
              
              <button 
                onClick={() => { closeMobileMenu(); handleLoginClick(); }}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg text-text-muted hover:text-text-high hover:bg-brand-green/10 transition-colors font-medium w-full text-left"
              >
                <i className="fa-solid fa-sign-in-alt"></i>
                <span>Login</span>
              </button>
              
              <button 
                onClick={() => { closeMobileMenu(); handleDemoRequest(); }}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg bg-brand-green text-white hover:bg-opacity-90 transition-colors font-medium w-full text-left"
              >
                <i className="fa-solid fa-play"></i>
                <span>Request Demo</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="relative">
        {/* Hero Section */}
        <section className="px-6 py-16 lg:py-24">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              
              {/* Hero Content */}
              <div className="lg:col-span-5 space-y-8">
                <div className="space-y-6">
                  <h1 className="text-4xl lg:text-6xl font-bold leading-tight">
                    ESG Assessment
                    <span className="text-brand-green"> Made Simple</span>
                  </h1>
                  <p className="text-xl text-text-muted leading-relaxed">
                    Help your UAE SME understand, track, and report Environmental, Social & Governance metrics without the jargon. Comply with Dubai Sustainable Tourism, Green Key, and Net-Zero 2050 requirements.
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={handleDemoRequest}
                    className="px-8 py-4 bg-brand-green text-white font-semibold rounded-xl hover:bg-opacity-90 transition-all transform hover:scale-105"
                  >
                    <i className="fa-solid fa-play mr-2"></i>
                    Request Demo
                  </button>
                  <button className="px-8 py-4 border border-white/20 text-text-high font-semibold rounded-xl hover:bg-white/5 transition-all">
                    Learn More
                  </button>
                </div>
                
                <div className="flex items-center space-x-6 pt-4">
                  <div className="text-sm text-text-muted">Trusted by 500+ UAE SMEs</div>
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-brand-green rounded-full"></div>
                    <div className="w-2 h-2 bg-brand-blue rounded-full"></div>
                    <div className="w-2 h-2 bg-brand-teal rounded-full"></div>
                  </div>
                </div>
              </div>
              
              {/* Demo KPI Card */}
              <div className="lg:col-span-7">
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-[18px] p-8 space-y-8 transition-all hover:transform hover:-translate-y-2 hover:shadow-2xl">
                  
                  {/* Overall Score */}
                  <div className="text-center space-y-4">
                    <h3 className="text-lg font-semibold text-text-muted">Overall ESG Score</h3>
                    <div className="relative w-32 h-32 mx-auto">
                      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 84 84">
                        <circle cx="42" cy="42" r="40" stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none"></circle>
                        <circle cx="42" cy="42" r="40" stroke="#2EC57D" strokeWidth="4" fill="none" strokeDasharray="188.49 251.32" strokeLinecap="round"></circle>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold text-brand-green">75</span>
                      </div>
                    </div>
                    <p className="text-sm text-text-muted">Above Industry Average</p>
                  </div>
                  
                  {/* ESG Breakdown */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 bg-brand-green/20 rounded-lg flex items-center justify-center mx-auto">
                        <i className="fa-solid fa-leaf text-brand-green text-lg"></i>
                      </div>
                      <div className="text-2xl font-bold text-brand-green">72</div>
                      <div className="text-sm text-text-muted">Environmental</div>
                    </div>
                    
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 bg-brand-blue/20 rounded-lg flex items-center justify-center mx-auto">
                        <i className="fa-solid fa-users text-brand-blue text-lg"></i>
                      </div>
                      <div className="text-2xl font-bold text-brand-blue">78</div>
                      <div className="text-sm text-text-muted">Social</div>
                    </div>
                    
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 bg-brand-teal/20 rounded-lg flex items-center justify-center mx-auto">
                        <i className="fa-solid fa-shield-halved text-brand-teal text-lg"></i>
                      </div>
                      <div className="text-2xl font-bold text-brand-teal">75</div>
                      <div className="text-sm text-text-muted">Governance</div>
                    </div>
                  </div>
                  
                  {/* Emissions Trend */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-text-muted">Emissions Trend (12 months)</h4>
                    <div className="h-16 flex items-end space-x-1">
                      {[30, 40, 50, 36, 28, 24, 20, 16, 12, 8, 8, 4].map((height, index) => (
                        <div 
                          key={index}
                          className={`bg-brand-green w-3 rounded-t`}
                          style={{ 
                            height: `${height}px`,
                            opacity: 0.3 + (index * 0.05)
                          }}
                        ></div>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>Jan</span>
                      <span className="text-brand-green">-15% reduction</span>
                      <span>Dec</span>
                    </div>
                  </div>
                  
                  {/* Recommendations */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-text-muted">Top Recommendations</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg">
                        <div className="w-2 h-2 bg-brand-green rounded-full"></div>
                        <span className="text-sm">Switch to renewable energy sources</span>
                        <span className="text-xs text-brand-green ml-auto">High Impact</span>
                      </div>
                      <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg">
                        <div className="w-2 h-2 bg-brand-blue rounded-full"></div>
                        <span className="text-sm">Implement employee wellness program</span>
                        <span className="text-xs text-brand-blue ml-auto">Medium Impact</span>
                      </div>
                      <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg">
                        <div className="w-2 h-2 bg-brand-teal rounded-full"></div>
                        <span className="text-sm">Update board diversity policies</span>
                        <span className="text-xs text-brand-teal ml-auto">Low Impact</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Features Preview */}
        <section className="px-6 py-16 bg-white/5">
          <div className="max-w-7xl mx-auto text-center space-y-12">
            <div className="space-y-4">
              <h2 className="text-3xl lg:text-4xl font-bold">Everything you need for ESG compliance</h2>
              <p className="text-xl text-text-muted max-w-3xl mx-auto">
                From data collection to regulatory reporting, ESG Compass simplifies every step of your sustainability journey.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-[18px] p-6 space-y-4 transition-all hover:transform hover:-translate-y-2 hover:shadow-xl">
                <div className="w-12 h-12 bg-brand-green/20 rounded-lg flex items-center justify-center mx-auto">
                  <i className="fa-solid fa-chart-line text-brand-green text-xl"></i>
                </div>
                <h3 className="text-lg font-semibold">Smart Data Collection</h3>
                <p className="text-text-muted">Plain-English questions guide you through data entry without technical jargon.</p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-[18px] p-6 space-y-4 transition-all hover:transform hover:-translate-y-2 hover:shadow-xl">
                <div className="w-12 h-12 bg-brand-blue/20 rounded-lg flex items-center justify-center mx-auto">
                  <i className="fa-solid fa-file-contract text-brand-blue text-xl"></i>
                </div>
                <h3 className="text-lg font-semibold">Automated Reports</h3>
                <p className="text-text-muted">Generate DST, Green Key, and custom ESG reports with one click.</p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-[18px] p-6 space-y-4 transition-all hover:transform hover:-translate-y-2 hover:shadow-xl">
                <div className="w-12 h-12 bg-brand-teal/20 rounded-lg flex items-center justify-center mx-auto">
                  <i className="fa-solid fa-users-gear text-brand-teal text-xl"></i>
                </div>
                <h3 className="text-lg font-semibold">Team Collaboration</h3>
                <p className="text-text-muted">Role-based access for team members, collaborators, and auditors.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto text-center space-y-8">
          <div className="flex items-center justify-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-brand-green flex items-center justify-center">
              <i className="fa-solid fa-compass text-white"></i>
            </div>
            <span className="text-lg font-bold">ESG Compass</span>
          </div>
          
          <div className="flex flex-wrap justify-center gap-8 text-sm text-text-muted">
            <span className="hover:text-text-high transition-colors cursor-pointer">Privacy Policy</span>
            <span className="hover:text-text-high transition-colors cursor-pointer">Terms of Service</span>
            <span className="hover:text-text-high transition-colors cursor-pointer">Contact</span>
            <span className="hover:text-text-high transition-colors cursor-pointer">Support</span>
          </div>
          
          <p className="text-sm text-text-muted">
            © 2024 ESG Compass. Helping UAE SMEs achieve sustainability goals.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;