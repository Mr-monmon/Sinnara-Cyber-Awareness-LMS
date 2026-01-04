import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Partner {
  id: string;
  name: string;
  logo_url: string;
  website?: string | null;
  order_index: number;
}

export const PartnersCarousel: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const settings = {
    title: 'Trusted by Leading Organizations',
    subtitle: 'Our partners rely on Sinnara to strengthen their cybersecurity culture.'
  };

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    const { data } = await supabase
      .from('partners')
      .select('*')
      .eq('is_active', true)
      .order('order_index');

    if (data) setPartners(data);
  };

  if (partners.length === 0) return null;

  const duplicatedPartners = [...partners, ...partners, ...partners];

  return (
    <section className="py-20 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-slate-100 bg-[size:30px_30px] opacity-30" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            {settings.title}
          </h2>
          <p className="text-xl text-slate-600">
            {settings.subtitle}
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10" />

          <div className="overflow-hidden py-4">
            <div className="flex gap-12 animate-scroll">
              {duplicatedPartners.map((partner, index) => (
                <div
                  key={`${partner.id}-${index}`}
                  className="flex-shrink-0"
                >
                  {partner.website ? (
                    <a
                      href={partner.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <div className="h-48 w-72 flex items-center justify-center bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 p-8 border border-slate-200 hover:border-blue-300 transform hover:-translate-y-1">
                        <div className="text-center w-full">
                          <div className="h-32 flex items-center justify-center mb-2">
                            <img
                              src={partner.logo_url}
                              alt={partner.name}
                              className="max-h-full max-w-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-300 opacity-70 group-hover:opacity-100"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement?.parentElement;
                                if (parent) {
                                  const fallback = document.createElement('div');
                                  fallback.className = 'text-2xl font-bold text-slate-400 group-hover:text-blue-600 transition-colors';
                                  fallback.textContent = partner.name;
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          </div>
                          <div className="text-sm font-medium text-slate-600 group-hover:text-blue-600 transition-colors">
                            {partner.name}
                          </div>
                        </div>
                      </div>
                    </a>
                  ) : (
                    <div className="h-48 w-72 flex items-center justify-center bg-white rounded-xl shadow-sm p-8 border border-slate-200">
                      <div className="text-center w-full">
                        <div className="h-32 flex items-center justify-center mb-2">
                          <img
                            src={partner.logo_url}
                            alt={partner.name}
                            className="max-h-full max-w-full object-contain filter grayscale opacity-70"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement?.parentElement;
                              if (parent) {
                                const fallback = document.createElement('div');
                                fallback.className = 'text-2xl font-bold text-slate-400';
                                fallback.textContent = partner.name;
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        </div>
                        <div className="text-sm font-medium text-slate-600">
                          {partner.name}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <p className="text-sm text-slate-500 italic">
            Hover to pause • Trusted by leading organizations
          </p>
        </div>
      </div>

      <style>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(-336px * ${partners.length}));
          }
        }

        .animate-scroll {
          animation: scroll 40s linear infinite;
          will-change: transform;
        }

        .animate-scroll:hover {
          animation-play-state: paused;
        }

        @media (max-width: 768px) {
          .animate-scroll {
            animation-duration: 25s;
          }
        }
      `}</style>
    </section>
  );
};
