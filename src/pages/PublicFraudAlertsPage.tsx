import React, { useEffect, useState } from 'react';
import { AlertCircle, Shield, ChevronRight, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface FraudAlert {
  id: string;
  title: string;
  fraud_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  public_summary: string;
  safety_tips: string[];
  video_url?: string;
}

interface PublicFraudAlertsPageProps {
  onNavigate: (page: string) => void;
}

export const PublicFraudAlertsPage: React.FC<PublicFraudAlertsPageProps> = ({ onNavigate }) => {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      const { data, error } = await supabase
        .from('fraud_alerts')
        .select('id, title, fraud_type, severity, public_summary, safety_tips, video_url')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAlerts(data);
      }
      setLoading(false);
    };

    fetchAlerts();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-red-50 border-red-200';
      case 'MEDIUM':
        return 'bg-yellow-50 border-yellow-200';
      case 'LOW':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-red-100 text-red-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOW':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (selectedAlert) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <button
            onClick={() => setSelectedAlert(null)}
            className="inline-flex items-center gap-2 text-white hover:text-gray-300 mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to All Alerts
          </button>

          <div className={`bg-white rounded-xl shadow-xl p-8 border-2 ${
            selectedAlert.severity === 'HIGH' ? 'border-red-300' :
            selectedAlert.severity === 'MEDIUM' ? 'border-yellow-300' :
            'border-blue-300'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-3xl font-bold text-gray-900 flex-1">
                {selectedAlert.title}
              </h1>
              <span
                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ml-4 ${getSeverityBadgeColor(
                  selectedAlert.severity
                )}`}
              >
                {selectedAlert.severity}
              </span>
            </div>

            <p className="text-lg font-medium text-gray-600 mb-6">
              Channel: {selectedAlert.fraud_type}
            </p>

            <div className="prose max-w-none mb-6">
              <p className="text-gray-800 text-lg leading-relaxed">
                {selectedAlert.public_summary}
              </p>
            </div>

            {selectedAlert.video_url && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Awareness Video</h3>
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <iframe
                    src={selectedAlert.video_url}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            )}

            {selectedAlert.safety_tips && selectedAlert.safety_tips.length > 0 && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Shield className="w-6 h-6 text-green-600" />
                  Safety Tips
                </h3>
                <ul className="space-y-3">
                  {selectedAlert.safety_tips.map((tip, idx) => (
                    <li key={idx} className="text-gray-800 flex gap-3">
                      <span className="text-green-600 font-bold text-xl">•</span>
                      <span className="flex-1">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => onNavigate('login')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Login to See Employee Guidelines
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <button
          onClick={() => onNavigate('landing')}
          className="inline-flex items-center gap-2 text-white hover:text-gray-300 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </button>

        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <h1 className="text-4xl font-bold text-white">Fraud Alerts</h1>
          </div>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Stay informed about active scams and fraud schemes in Saudi Arabia. Learn how to protect yourself and your business.
          </p>
        </div>

        {loading ? (
          <div className="text-center text-gray-400">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <Shield className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <p>No active fraud alerts at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`border rounded-lg p-6 transition-all hover:shadow-lg ${getSeverityColor(
                  alert.severity
                )}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 flex-1">
                    {alert.title}
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ml-2 ${getSeverityBadgeColor(
                      alert.severity
                    )}`}
                  >
                    {alert.severity}
                  </span>
                </div>

                <p className="text-sm font-medium text-gray-600 mb-3">
                  Channel: {alert.fraud_type}
                </p>

                <p className="text-gray-700 mb-4">{alert.public_summary}</p>

                {alert.safety_tips && alert.safety_tips.length > 0 && (
                  <div className="mb-4 bg-white bg-opacity-60 rounded p-3">
                    <p className="text-sm font-semibold text-gray-900 mb-2">
                      Safety Tips:
                    </p>
                    <ul className="space-y-1">
                      {alert.safety_tips.map((tip, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex gap-2">
                          <span className="text-green-600 font-bold">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => setSelectedAlert(alert)}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  View Full Alert
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
