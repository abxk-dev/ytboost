import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import './Home.css';
import { Menu, X, Play, ChevronRight } from 'lucide-react';

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const services = [
    { icon: '👁️', name: 'YouTube Views', desc: 'Real views from social networks. Non-drop, 30 day guarantee.', price: 'From $0.25/1000' },
    { icon: '🔔', name: 'YouTube Subscribers', desc: 'High quality subscribers. Stable and non-drop with refill.', price: 'From $4.00/1000' },
    { icon: '👍', name: 'YouTube Likes', desc: 'Real likes from active accounts. Fast delivery, safe for channel.', price: 'From $0.30/1000' },
    { icon: '⏱️', name: 'Watch Hours', desc: 'Reach 4000 hour monetization threshold. Real retention.', price: 'From $4.00/pkg' },
    { icon: '💬', name: 'YouTube Comments', desc: 'Custom or random positive comments. Boost engagement.', price: 'From $2.50/1000' },
    { icon: '📤', name: 'YouTube Shares', desc: 'Real social shares across multiple platforms.', price: 'From $0.80/1000' },
  ];

  const features = [
    { icon: '⚡', title: 'Instant Delivery', desc: 'Most orders start within seconds of payment confirmation.' },
    { icon: '🔒', title: '100% Safe', desc: 'All services are safe for your YouTube channel. No password needed.' },
    { icon: '💰', title: 'Lowest Prices', desc: 'We offer the best rates in the market with no compromise on quality.' },
    { icon: '🔄', title: 'Non-Drop Guarantee', desc: 'Drop protection on all services. Free refill if numbers drop.' },
  ];

  const steps = [
    { num: '1', title: 'Create Account', desc: 'Sign up free in 30 seconds. No credit card required.' },
    { num: '2', title: 'Add Funds', desc: 'Top up your balance with USDT BEP20. Auto-detected instantly.' },
    { num: '3', title: 'Place Your Order', desc: 'Choose a service, enter your YouTube link, and watch your channel grow.' },
  ];

  return (
    <>
      <Helmet>
        <title>YTBoost.io — #1 YouTube SMM Panel | Buy YouTube Views, Subscribers & Likes</title>
        <meta name="description" content="YTBoost.io is the cheapest and most reliable YouTube SMM panel. Buy real YouTube views, subscribers, likes, watch hours and comments. Instant delivery, non-drop guarantee, automated USDT BEP20 payments. Starting from $0.002 per 1000." />
        <meta name="keywords" content="youtube smm panel, buy youtube views, buy youtube subscribers, buy youtube likes, youtube watch hours, cheapest youtube panel, youtube growth panel, smm panel youtube, buy youtube comments" />
        <meta property="og:title" content="YTBoost.io — #1 YouTube SMM Panel" />
        <meta property="og:description" content="Buy real YouTube views, subscribers, likes and watch hours. Cheapest prices. Instant delivery. Non-drop guarantee." />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://ytboost.io" />
      </Helmet>

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
              <a href="#services">Services</a>
              <a href="#pricing">Pricing</a>
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
              <a href="#services" onClick={() => setMobileMenuOpen(false)}>Services</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
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
              <Link to="/login" className="btn-secondary" data-testid="hero-cta-secondary">
                View All Services
              </Link>
            </div>
            
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-number">2M+</span>
                <span className="stat-label">Orders Completed</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat">
                <span className="stat-number">50K+</span>
                <span className="stat-label">Happy Creators</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat">
                <span className="stat-number">$0.002</span>
                <span className="stat-label">Starting Price</span>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="services-section" id="services">
          <div className="section-container">
            <h2 className="section-title">YouTube Growth Services</h2>
            <p className="section-subtitle">Everything you need to grow your YouTube channel</p>
            
            <div className="services-grid" id="pricing">
              {services.map((service, index) => (
                <div className="service-card" key={index} data-testid={`service-card-${index}`}>
                  <div className="service-icon">{service.icon}</div>
                  <h3 className="service-name">{service.name}</h3>
                  <p className="service-desc">{service.desc}</p>
                  <div className="service-price">{service.price}</div>
                  <Link to="/register" className="service-link">
                    Order Now <ChevronRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="features-section">
          <div className="section-container">
            <h2 className="section-title">Why Creators Choose YTBoost.io</h2>
            
            <div className="features-grid">
              {features.map((feature, index) => (
                <div className="feature-card" key={index}>
                  <div className="feature-icon">{feature.icon}</div>
                  <h3 className="feature-title">{feature.title}</h3>
                  <p className="feature-desc">{feature.desc}</p>
                </div>
              ))}
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
                  <a href="#services">YouTube Views</a>
                  <a href="#services">Subscribers</a>
                  <a href="#services">Likes</a>
                  <a href="#services">Watch Hours</a>
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
