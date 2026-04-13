import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';
import { Menu, X, Play } from 'lucide-react';
import api from '../services/api';

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [liveStats, setLiveStats] = useState({ totalOrders: 0, totalUsers: 0, startingPrice: 0.002 });

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/stats/public');
        setLiveStats(data);
      } catch (err) {
        // silently fail - show defaults
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const steps = [
    { num: '1', title: 'Create Account', desc: 'Sign up free in 30 seconds. No credit card required.' },
    { num: '2', title: 'Add Funds', desc: 'Top up your balance with USDT BEP20. Auto-detected instantly.' },
    { num: '3', title: 'Place Your Order', desc: 'Choose a service, enter your YouTube link, and watch your channel grow.' },
  ];

  return (
    <>
      <div className="home-page">
        {/* Navbar */}
        <nav className={`home-navbar ${scrolled ? 'scrolled' : ''}`}>
          <div className="navbar-container">
            <Link to="/" className="navbar-logo" data-testid="home-logo">
              <div className="logo-icon">
                <Play className="play-icon" fill="#fff" />
              </div>
              <span className="logo-text">YTBoost</span>
              <span className="logo-suffix">.io</span>
            </Link>

            <div className="navbar-links">
              <Link to="/services">Services</Link>
              <Link to="/dashboard/api-access">API</Link>
              <a href="#support">Support</a>
            </div>

            <div className="navbar-actions">
              <Link to="/login" className="btn-signin" data-testid="signin-btn">Sign In</Link>
              <Link to="/register" className="btn-getstarted" data-testid="getstarted-btn">Get Started</Link>
            </div>

            <button 
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-toggle"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="mobile-menu">
              <Link to="/services" onClick={() => setMobileMenuOpen(false)}>Services</Link>
              <Link to="/dashboard/api-access" onClick={() => setMobileMenuOpen(false)}>API</Link>
              <a href="#support" onClick={() => setMobileMenuOpen(false)}>Support</a>
              <div className="mobile-menu-actions">
                <Link to="/login" className="btn-signin">Sign In</Link>
                <Link to="/register" className="btn-getstarted">Get Started</Link>
              </div>
            </div>
          )}
        </nav>

        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-container">
            <div className="hero-badge">
              <span>🎯 Trusted by 50,000+ YouTube Creators</span>
            </div>
            
            <h1 className="hero-title">
              Grow Your YouTube Channel
              <span className="hero-title-accent">Faster Than Ever</span>
            </h1>
            
            <p className="hero-subtitle">
              The cheapest and most reliable YouTube SMM panel.
              Real views, subscribers, likes and watch hours.
              Instant delivery. Non-drop guarantee.
            </p>
            
            <div className="hero-buttons">
              <Link to="/register" className="btn-primary" data-testid="hero-cta-primary">
                Start Growing Now
              </Link>
              <Link to="/services" className="btn-secondary" data-testid="hero-cta-secondary">
                View All Services
              </Link>
            </div>
            
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-number" data-testid="stat-orders">{liveStats.totalOrders > 0 ? liveStats.totalOrders.toLocaleString() : '0'}</span>
                <span className="stat-label">Orders Completed</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat">
                <span className="stat-number" data-testid="stat-users">{liveStats.totalUsers > 0 ? liveStats.totalUsers.toLocaleString() : '0'}</span>
                <span className="stat-label">Active Users</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat">
                <span className="stat-number">${(() => {
                  const p = Number(liveStats.startingPrice ?? 0.002);
                  if (!Number.isFinite(p)) return '0.002';
                  return p < 1 ? p.toFixed(3) : p.toFixed(2);
                })()}</span>
                <span className="stat-label">Starting Price</span>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="steps-section">
          <div className="section-container">
            <h2 className="section-title">How It Works</h2>
            
            <div className="steps-container">
              {steps.map((step, index) => (
                <React.Fragment key={index}>
                  <div className="step-card">
                    <div className="step-number">{step.num}</div>
                    <h3 className="step-title">{step.title}</h3>
                    <p className="step-desc">{step.desc}</p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="step-arrow">→</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Banner Section */}
        <section className="cta-section">
          <div className="cta-container">
            <h2 className="cta-title">Start Growing Your Channel Today</h2>
            <p className="cta-subtitle">Join 50,000+ creators who trust YTBoost.io</p>
            <Link to="/register" className="cta-button" data-testid="cta-register-btn">
              Create Free Account
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="home-footer" id="support">
          <div className="footer-container">
            <div className="footer-top">
              <div className="footer-brand">
                <div className="footer-logo">
                  <div className="logo-icon light">
                    <Play className="play-icon" fill="#fff" />
                  </div>
                  <span className="logo-text">YTBoost</span>
                  <span className="logo-suffix">.io</span>
                </div>
                <p className="footer-tagline">The #1 YouTube Growth Panel</p>
              </div>
              
              <div className="footer-links">
                <div className="footer-column">
                  <h4>Company</h4>
                  <a href="#">About</a>
                  <a href="#">Blog</a>
                  <a href="#">Careers</a>
                </div>
                <div className="footer-column">
                  <h4>Services</h4>
                  <Link to="/services">YouTube Views</Link>
                  <Link to="/services">Subscribers</Link>
                  <Link to="/services">Likes</Link>
                  <Link to="/services">Watch Hours</Link>
                </div>
                <div className="footer-column">
                  <h4>Support</h4>
                  <a href="#">Help Center</a>
                  <Link to="/dashboard/api-access">API Docs</Link>
                  <a href="#">Contact</a>
                </div>
                <div className="footer-column">
                  <h4>Legal</h4>
                  <a href="#">Terms of Service</a>
                  <a href="#">Privacy Policy</a>
                  <a href="#">Refund Policy</a>
                </div>
              </div>
            </div>
            
            <div className="footer-bottom">
              <p className="footer-copyright">© 2026 YTBoost.io. All rights reserved.</p>
              <p className="footer-payment">
                <span className="crypto-icon">₿</span>
                USDT BEP20 payments accepted
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
