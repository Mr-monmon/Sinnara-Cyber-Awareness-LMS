import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Step {
  id: string;
  title: string;
  description: string;
  icon: string;
  order_index: number;
}

interface Settings {
  title: string;
  subtitle?: string;
}

export const HowItWorks: React.FC = () => {
  const [steps, setSteps] = useState<Step[]>([]);
  const [settings, setSettings] = useState<Settings>({
    title: 'How Sinnara Works',
    subtitle: ''
  });

  useEffect(() => {
    loadSteps();
    loadSettings();
  }, []);

  const loadSteps = async () => {
    const { data } = await supabase
      .from('homepage_steps')
      .select('*')
      .eq('is_active', true)
      .order('order_index');

    if (data) setSteps(data);
  };

  const loadSettings = async () => {
    const { data } = await supabase
      .from('homepage_settings')
      .select('setting_value')
      .eq('setting_key', 'steps_section')
      .maybeSingle();

    if (data?.setting_value) {
      setSettings(data.setting_value as any);
    }
  };

  const getIcon = (iconName: string) => {
    const Icon = (Icons as any)[iconName];
    return Icon ? <Icon className="h-10 w-10" /> : <Icons.CheckCircle className="h-10 w-10" />;
  };

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            {settings.title}
          </h2>
          {settings.subtitle && (
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              {settings.subtitle}
            </p>
          )}
        </div>

        <div className="relative">
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-blue-200 via-cyan-200 to-blue-200 transform -translate-y-1/2" style={{ zIndex: 0 }} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative" style={{ zIndex: 1 }}>
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="relative"
              >
                <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-slate-100 hover:border-blue-300 transform hover:-translate-y-2">
                  <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-2xl mb-6 mx-auto shadow-lg">
                    <div className="text-white">
                      {getIcon(step.icon)}
                    </div>
                  </div>

                  <div className="absolute top-6 left-6 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                    {index + 1}
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-3 text-center">
                    {step.title}
                  </h3>

                  <p className="text-slate-600 text-center leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <Icons.ArrowRight className="h-8 w-8 text-blue-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
