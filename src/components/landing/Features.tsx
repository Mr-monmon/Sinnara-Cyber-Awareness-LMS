import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: string;
  order_index: number;
}

interface Settings {
  title: string;
  subtitle: string;
}

export const Features: React.FC = () => {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [settings, setSettings] = useState<Settings>({
    title: 'Empower Cyber Awareness Across Your Organization',
    subtitle: 'Sinnara provides everything you need to create and sustain a security-aware workforce.'
  });

  useEffect(() => {
    loadFeatures();
    loadSettings();
  }, []);

  const loadFeatures = async () => {
    const { data } = await supabase
      .from('homepage_features')
      .select('*')
      .eq('is_active', true)
      .order('order_index');

    if (data) setFeatures(data);
  };

  const loadSettings = async () => {
    const { data } = await supabase
      .from('homepage_settings')
      .select('setting_value')
      .eq('setting_key', 'features_section')
      .maybeSingle();

    if (data?.setting_value) {
      setSettings(data.setting_value as any);
    }
  };

  const getIcon = (iconName: string) => {
    const Icon = (Icons as any)[iconName];
    return Icon ? <Icon className="h-8 w-8" /> : <Icons.Shield className="h-8 w-8" />;
  };

  return (
    <section className="py-24 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            {settings.title}
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            {settings.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.id}
              className="group relative bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200 hover:border-blue-300 transform hover:-translate-y-2"
              style={{
                animationDelay: `${index * 100}ms`
              }}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-t-2xl transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />

              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl mb-6 group-hover:scale-110 transition-transform duration-300">
                <div className="text-blue-600">
                  {getIcon(feature.icon)}
                </div>
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-600 transition-colors">
                {feature.title}
              </h3>

              <p className="text-slate-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
