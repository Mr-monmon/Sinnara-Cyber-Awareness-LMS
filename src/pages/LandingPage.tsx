import React, { useState, useEffect } from 'react';
import { Hero } from '../components/landing/Hero';
import { Features } from '../components/landing/Features';
import { PartnersCarousel } from '../components/landing/PartnersCarousel';
import { HowItWorks } from '../components/landing/HowItWorks';
import { RequestDemoModal } from '../components/landing/RequestDemoModal';
import { supabase } from '../lib/supabase';
import { ArrowRight, Mail, Phone } from 'lucide-react';

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
    headline: 'Start Building a Culture of Cybersecurity Awareness',
    subheadline: 'Protect your organization by empowering your team today.',
    primary_button: 'Request Demo',
    secondary_button: 'Free Assessment'
  });
  const [footerSettings, setFooterSettings] = useState<FooterSettings>({
    tagline: 'a smarter way to build, measure, and manage cybersecurity awareness.',
    email: 'info@sinnara.com',
    phone: '+966 XX XXX XXXX',
    copyright: '© 2025 Sinnara. All rights reserved.'
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data: ctaData } = await supabase
      .from('homepage_settings')
      .select('setting_value')
      .eq('setting_key', 'cta_section')
      .maybeSingle();

    const { data: footerData } = await supabase
      .from('homepage_settings')
      .select('setting_value')
      .eq('setting_key', 'footer')
      .maybeSingle();

    if (ctaData?.setting_value) {
      setCTASettings(ctaData.setting_value as any);
    }

    if (footerData?.setting_value) {
      setFooterSettings(footerData.setting_value as any);
    }
  };

  return (
    <div className="min-h-screen">
      <Hero
        onTakeTest={() => onNavigate('public-assessment')}
        onRequestDemo={() => setShowDemoModal(true)}
        onLogin={() => onNavigate('login')}
        onFraudAlerts={() => onNavigate('fraud-alerts')}
      />

      <Features />

      <PartnersCarousel />

      <HowItWorks />

      <div className="relative bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 py-20 overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:30px_30px]" />

        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            {ctaSettings.headline}
          </h2>
          <p className="text-xl text-blue-50 mb-10 max-w-2xl mx-auto">
            {ctaSettings.subheadline}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setShowDemoModal(true)}
              className="group px-10 py-5 bg-white text-blue-600 hover:bg-blue-50 rounded-xl font-bold text-lg shadow-2xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-3"
            >
              {ctaSettings.primary_button}
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => onNavigate('public-assessment')}
              className="px-10 py-5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white rounded-xl font-bold text-lg transition-all duration-300 hover:border-white/50"
            >
              {ctaSettings.secondary_button}
            </button>
          </div>
        </div>
      </div>

      <footer className="bg-slate-900 text-slate-300 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            <div>
              <h3 className="text-2xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Sinnara
              </h3>
              <p className="text-slate-400 leading-relaxed">
                {footerSettings.tagline}
              </p>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Quick Links</h4>
              <ul className="space-y-3">
                <li>
                  <button
                    onClick={() => onNavigate('public-assessment')}
                    className="text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    Free Assessment
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate('fraud-alerts')}
                    className="text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    Fraud Alerts
                  </button>
                </li>

                <li>
                  <button
                    onClick={() => setShowDemoModal(true)}
                    className="text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    Request Demo
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate('login')}
                    className="text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    Login
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Contact Us</h4>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                    <Mail className="h-4 w-4 text-blue-400" />
                  </div>
                  <a
                    href={`mailto:${footerSettings.email}`}
                    className="text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    {footerSettings.email}
                  </a>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                    <Phone className="h-4 w-4 text-blue-400" />
                  </div>
                  <a
                    href={`tel:${footerSettings.phone.replace(/\s/g, '')}`}
                    className="text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    {footerSettings.phone}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 text-center">
            <p className="text-slate-500">
              {footerSettings.copyright}
            </p>
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
