import React, { useState, useEffect } from 'react';
import { Hero } from '../components/landing/Hero';
import { Features } from '../components/landing/Features';
import { PartnersCarousel } from '../components/landing/PartnersCarousel';
import { HowItWorks } from '../components/landing/HowItWorks';
import { RequestDemoModal } from '../components/landing/RequestDemoModal';
import { supabase } from '../lib/supabase';
import { ArrowRight, Mail, Phone, MapPin, Twitter, Linkedin, Youtube } from 'lucide-react';
import { BlogSection } from '../components/landing/BlogSection';

interface LandingPageProps {
  onNavigate: (page: string) => void;
}

interface CTASettings {
  headline: string;
  subheadline: string;
  primary_button: string;
  secondary_button: string;
}

interface FooterSettings {
  tagline: string;
  email: string;
  phone: string;
  copyright: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [ctaSettings, setCTASettings] = useState<CTASettings>({
    headline: 'Ready to Build a Security-Aware Culture?',
    subheadline:
      'Join 25+ enterprises across the region who trust AwareOne to protect their people and meet compliance requirements with confidence.',
    primary_button: 'Request a Demo',
    secondary_button: 'Free Assessment',
  });
  const [footerSettings, setFooterSettings] = useState<FooterSettings>({
    tagline:
      'Empowering organizations to build a resilient security culture through localized, data-driven training and simulation.',
    email: 'hello@awareone.sa',
    phone: '+966 11 234 5678',
    copyright: '© 2025 AwareOne. All rights reserved.',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: ctaData } = await supabase
        .from('homepage_settings')
        .select('setting_value')
        .eq('setting_key', 'cta_section')
        .maybeSingle();

      if (ctaData?.setting_value) {
        setCTASettings(ctaData.setting_value as CTASettings);
      }

      const { data: footerData } = await supabase
        .from('homepage_settings')
        .select('setting_value')
        .eq('setting_key', 'footer')
        .maybeSingle();

      if (footerData?.setting_value) {
        setFooterSettings(footerData.setting_value as FooterSettings);
      }
    } catch (err) {
      console.error('Failed to load homepage settings', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#12140a]">
      <Hero
        onTakeTest={() => onNavigate('public-assessment')}
        onRequestDemo={() => setShowDemoModal(true)}
        onLogin={() => onNavigate('login')}
        onFraudAlerts={() => onNavigate('fraud-alerts')}
      />

      <Features />

      <PartnersCarousel />

      <HowItWorks />

      <BlogSection />

      {/* ── CTA Section ──────────────────────────────────── */}
      <section className="relative py-24 overflow-hidden bg-[#12140a]">
        {/* Subtle lime glow overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[rgba(200,255,0,0.02)]" />
        </div>

        <div className="relative max-w-[832px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Card */}
          <div
            className="rounded-2xl p-12 text-center"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
            }}
          >
            <h2 className="text-4xl lg:text-5xl font-black text-white mb-6 leading-tight tracking-tight">
              {ctaSettings.headline.split('Security-Aware').length > 1 ? (
                <>
                  {ctaSettings.headline.split('Security-Aware')[0]}
                  <span className="text-[#c8ff00]">Security-Aware</span>
                  {ctaSettings.headline.split('Security-Aware')[1]}
                </>
              ) : (
                <>
                  {ctaSettings.headline.split('AwareOne').length > 1 ? (
                    <>
                      {ctaSettings.headline.split('AwareOne')[0]}
                      <span className="text-[#c8ff00]">AwareOne</span>
                      {ctaSettings.headline.split('AwareOne')[1]}
                    </>
                  ) : (
                    ctaSettings.headline
                  )}
                </>
              )}
            </h2>

            <p className="text-lg text-[#94a3b8] mb-12 max-w-2xl mx-auto leading-relaxed">
              {ctaSettings.subheadline}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {/* Primary */}
              <button
                onClick={() => setShowDemoModal(true)}
                className="group inline-flex items-center justify-center gap-3 px-10 py-5 font-bold text-lg rounded-xl transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5"
                style={{
                  background: '#c8ff00',
                  color: '#12140a',
                  boxShadow: '0 0 30px 0 rgba(200,255,0,0.30)',
                }}
              >
                {ctaSettings.primary_button}
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Secondary */}
              <button
                onClick={() => onNavigate('public-assessment')}
                className="inline-flex items-center justify-center px-10 py-5 font-bold text-lg rounded-xl text-white transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')
                }
              >
                {ctaSettings.secondary_button}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer
        className="pt-20 pb-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="max-w-[1280px] mx-auto px-8">

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-14">

            {/* Brand */}
            <div>
              {/* Logo text mark */}
              <div className="mb-14">
                <span
                  className="text-2xl font-black tracking-tight"
                  style={{ color: '#c8ff00' }}
                >
                  AWARE
                  <span className="text-white">ONE</span>
                </span>
              </div>

              <p className="text-sm text-[#94a3b8] leading-[22.75px] mb-10">
                {footerSettings.tagline}
              </p>

              {/* Social Links */}
              <div className="flex items-center gap-3">
                {[
                  { icon: Linkedin, label: 'LinkedIn' },
                  { icon: Twitter, label: 'X (Twitter)' },
                  { icon: Youtube, label: 'YouTube' },
                ].map(({ icon: Icon, label }) => (
                  <a
                    key={label}
                    href="#"
                    aria-label={label}
                    className="w-10 h-10 flex items-center justify-center rounded-lg text-[#64748b] transition-all duration-200 hover:text-[#c8ff00]"
                    style={{ border: '1px solid rgba(255,255,255,0.10)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(200,255,0,0.30)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                    }}
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-base font-bold text-white mb-12">Company</h3>
              <ul className="space-y-4">
                {[
                  { label: 'Free Assessment', page: 'public-assessment' },
                  { label: 'Fraud Alerts', page: 'fraud-alerts' },
                  { label: 'Security Resources', page: 'resources' },
                  { label: 'Login', page: 'login' },
                ].map(({ label, page }) => (
                  <li key={page}>
                    <button
                      onClick={() => onNavigate(page)}
                      className="text-sm text-[#94a3b8] hover:text-white transition-colors duration-200"
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-base font-bold text-white mb-12">Resources</h3>
              <ul className="space-y-4">
                {[
                  { label: 'Security Blog', page: 'resources' },
                  { label: 'Case Studies', page: 'resources' },
                  { label: 'Compliance Guide', page: 'resources' },
                  { label: 'Support Center', page: 'resources' },
                ].map(({ label, page }, i) => (
                  <li key={i}>
                    <button
                      onClick={() => onNavigate(page)}
                      className="text-sm text-[#94a3b8] hover:text-white transition-colors duration-200"
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-base font-bold text-white mb-12">Contact</h3>
              <ul className="space-y-4">
                <li>
                  <a
                    href={`mailto:${footerSettings.email}`}
                    className="flex items-center gap-3 text-sm text-[#94a3b8] hover:text-white transition-colors duration-200"
                  >
                    <Mail size={14} className="text-[#64748b] shrink-0" />
                    {footerSettings.email}
                  </a>
                </li>
                <li>
                  <a
                    href={`tel:${footerSettings.phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-3 text-sm text-[#94a3b8] hover:text-white transition-colors duration-200"
                  >
                    <Phone size={14} className="text-[#64748b] shrink-0" />
                    {footerSettings.phone}
                  </a>
                </li>
                <li>
                  <span className="flex items-center gap-3 text-sm text-[#94a3b8]">
                    <MapPin size={14} className="text-[#64748b] shrink-0" />
                    Riyadh, Saudi Arabia
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-4 py-8"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
          >
            <p className="text-[13px] text-[#64748b]">{footerSettings.copyright}</p>
            <div className="flex items-center gap-6">
              {['Privacy Policy', 'Terms of Service', 'Cookies'].map((label) => (
                <a
                  key={label}
                  href="#"
                  className="text-[13px] text-[#64748b] hover:text-[#94a3b8] transition-colors duration-200"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <RequestDemoModal
        isOpen={showDemoModal}
        onClose={() => setShowDemoModal(false)}
      />
    </div>
  );
};
