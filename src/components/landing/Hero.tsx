import React, { useEffect, useState } from 'react';
import { Shield, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface HeroProps {
  onTakeTest: () => void;
  onRequestDemo: () => void;
  onLogin: () => void;
  onFraudAlerts: () => void;
}

interface HeroData {
  headline: string;
  subheadline: string;
  primary_button_text: string;
  secondary_button_text: string;
  background_gradient: { from: string; to: string };
}

export const Hero: React.FC<HeroProps> = ({ onTakeTest, onRequestDemo, onLogin, onFraudAlerts }) => {
  const [heroData, setHeroData] = useState<HeroData>({
    headline: 'Protect Your Company by Empowering Your People.',
    subheadline: 'Sinnara is your comprehensive cybersecurity awareness platform — designed to train, assess, and elevate your team\'s security mindset.',
    primary_button_text: 'Request Demo',
    secondary_button_text: 'Login',
    background_gradient: { from: '#1e40af', to: '#7c3aed' }
  });

  useEffect(() => {
    loadHeroData();
  }, []);

  const loadHeroData = async () => {
    const { data } = await supabase
      .from('homepage_hero')
      .select('*')
      .eq('is_active', true)
      .single();

    if (data) {
      setHeroData({
        headline: data.headline,
        subheadline: data.subheadline,
        primary_button_text: data.primary_button_text,
        secondary_button_text: data.secondary_button_text,
        background_gradient: data.background_gradient
      });
    }
  };

  return (
    <div
      className="relative text-white overflow-hidden min-h-[90vh] flex items-center"
      style={{
        background: `linear-gradient(135deg, ${heroData.background_gradient.from} 0%, ${heroData.background_gradient.to} 100%)`
      }}
    >
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:30px_30px]" />

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

        <div className="absolute top-20 right-20 opacity-20">
          <img src="/icon logo 1 .png" alt="Sinnara" className="h-20 w-20 object-contain animate-float" />
        </div>
        <div className="absolute bottom-32 left-32 opacity-10">
          <img src="/icon logo 1 .png" alt="Sinnara" className="h-48 w-48 animate-float" style={{ animationDelay: '2s' }} />
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center space-y-8">
          <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-full mb-4 border border-white/20 backdrop-blur-sm">
            <img src="/icon logo 1 .png" alt="Sinnara" className="h-20 w-20 object-contain animate-pulse-slow" />
          </div>

          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-tight">
            <span className="block bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
              {heroData.headline}
            </span>
          </h1>

          <p className="text-xl lg:text-2xl text-blue-50 max-w-4xl mx-auto leading-relaxed">
            {heroData.subheadline}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <button
              onClick={onRequestDemo}
              className="group px-10 py-5 bg-white text-blue-600 hover:bg-blue-50 rounded-xl font-bold text-lg shadow-2xl transition-all duration-300 transform hover:scale-105 flex items-center gap-3"
            >
              {heroData.primary_button_text}
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={onLogin}
              className="px-10 py-5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-xl font-bold text-lg transition-all duration-300 hover:border-white/50"
            >
              {heroData.secondary_button_text}
            </button>
          </div>

          <div className="pt-12 flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={onTakeTest}
              className="text-blue-100 hover:text-white underline underline-offset-4 decoration-2 decoration-blue-300 hover:decoration-white transition-all duration-300 text-lg font-medium"
            >
              Free Assessment →
            </button>
            <span className="hidden sm:inline text-blue-200">•</span>
            <button
              onClick={onFraudAlerts}
              className="text-blue-100 hover:text-white underline underline-offset-4 decoration-2 decoration-blue-300 hover:decoration-white transition-all duration-300 text-lg font-medium"
            >
              Fraud Alerts →
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(5deg);
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
