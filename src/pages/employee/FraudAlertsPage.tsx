import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface FraudAlert {
  id: string;
  title: string;
  fraud_type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  internal_content: string;
  video_url?: string;
  internal_steps: string[];
  is_published: boolean;
  acknowledged?: boolean;
}

export const FraudAlertsPage: React.FC = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchAlerts();
  }, [user]);

  const fetchAlerts = async () => {
    const { data: alertData, error: alertError } = await supabase
      .from('fraud_alerts')
      .select('id, title, fraud_type, severity, internal_content, video_url, internal_steps, is_published')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (!alertError && alertData && user) {
      const { data: ackData } = await supabase
        .from('fraud_alert_acknowledgments')
        .select('alert_id')
        .eq('user_id', user.id);

      const acknowledgedIds = new Set(ackData?.map((a) => a.alert_id) || []);

      const enrichedAlerts = alertData.map((alert) => ({
        ...alert,
        acknowledged: acknowledgedIds.has(alert.id),
      }));

      setAlerts(enrichedAlerts);
    }
    setLoading(false);
  };

  const handleAcknowledge = async (alertId: string) => {
    if (!user) return;
    setAcknowledging(alertId);

    try {
      await supabase.from('fraud_alert_acknowledgments').insert({
        alert_id: alertId,
        user_id: user.id,
      });

      setAlerts((prev) =>
        prev.map((alert) =>
          alert.id === alertId ? { ...alert, acknowledged: true } : alert
        )
      );
    } catch {
      // Error handling
    } finally {
      setAcknowledging(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'border-red-300 bg-red-50';
      case 'MEDIUM':
        return 'border-yellow-300 bg-yellow-50';
      case 'LOW':
        return 'border-blue-300 bg-blue-50';
      default:
        return 'border-gray-300 bg-gray-50';
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Fraud Alerts</h1>
        <p className="text-gray-600 mt-2">
          Stay informed about active scams and learn how to protect yourself.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <p className="text-green-800 font-medium">No active fraud alerts</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`border-l-4 rounded-lg p-6 transition-all ${getSeverityColor(
                alert.severity
              )} ${alert.acknowledged ? 'opacity-75' : ''}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertCircle className="w-5 h-5 text-gray-700" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      {alert.title}
                    </h3>
                    {alert.acknowledged && (
                      <span className="flex items-center gap-1 text-xs text-green-700 font-medium bg-green-200 px-2 py-1 rounded">
                        <CheckCircle className="w-3 h-3" />
                        Acknowledged
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Channel: <span className="font-medium">{alert.fraud_type}</span>
                    {' • '}
                    Severity:{' '}
                    <span
                      className={`font-medium px-2 py-0.5 rounded text-xs ${getSeverityBadgeColor(
                        alert.severity
                      )}`}
                    >
                      {alert.severity}
                    </span>
                  </p>
                </div>
              </div>

              <div className="text-gray-700 mb-4 leading-relaxed">
                {alert.internal_content}
              </div>

              {alert.video_url && (
                <div className="mb-4 bg-white rounded-lg p-4 border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Awareness Video:
                  </p>
                  {alert.video_url.includes('youtube') ||
                  alert.video_url.includes('youtu.be') ? (
                    <iframe
                      width="100%"
                      height="300"
                      src={alert.video_url}
                      title={alert.title}
                      className="rounded"
                      allowFullScreen
                    ></iframe>
                  ) : (
                    <video width="100%" height="300" controls className="rounded">
                      <source src={alert.video_url} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  )}
                </div>
              )}

              {alert.internal_steps && alert.internal_steps.length > 0 && (
                <div className="mb-4 bg-white bg-opacity-70 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-900 mb-3">
                    Action Steps:
                  </p>
                  <ol className="space-y-2">
                    {alert.internal_steps.map((step, idx) => (
                      <li key={idx} className="text-sm text-gray-700 flex gap-3">
                        <span className="font-bold text-gray-600 flex-shrink-0">
                          {idx + 1}.
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {!alert.acknowledged && (
                <button
                  onClick={() => handleAcknowledge(alert.id)}
                  disabled={acknowledging === alert.id}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {acknowledging === alert.id ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Acknowledging...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      I Understand This Alert
                    </>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
