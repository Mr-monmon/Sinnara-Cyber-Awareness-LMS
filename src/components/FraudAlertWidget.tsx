import React, { useEffect, useState } from 'react';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface FraudAlert {
  id: string;
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  is_published: boolean;
  acknowledged?: boolean;
}

interface FraudAlertWidgetProps {
  onNavigate: (page: string) => void;
}

export const FraudAlertWidget: React.FC<FraudAlertWidgetProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchAlerts();
  }, [user]);

  const fetchAlerts = async () => {
    const { data: alertData } = await supabase
      .from('fraud_alerts')
      .select('id, title, severity, is_published')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(3);

    if (alertData && user) {
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
      setUnacknowledgedCount(enrichedAlerts.filter((a) => !a.acknowledged).length);
    }
    setLoading(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'text-red-600';
      case 'MEDIUM':
        return 'text-yellow-600';
      case 'LOW':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-500">Loading alerts...</p>
      </div>
    );
  }

  if (unacknowledgedCount === 0 && alerts.length === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-blue-900">
            {unacknowledgedCount > 0
              ? `${unacknowledgedCount} Alert${unacknowledgedCount > 1 ? 's' : ''} Requiring Action`
              : 'Fraud Alerts'}
          </h3>
          <p className="text-sm text-blue-800 mt-1">
            {unacknowledgedCount > 0
              ? 'Please review and acknowledge all security alerts.'
              : `${alerts.length} alert${alerts.length > 1 ? 's' : ''} available`}
          </p>

          {alerts.length > 0 && (
            <ul className="mt-3 space-y-1">
              {alerts.slice(0, 2).map((alert) => (
                <li
                  key={alert.id}
                  className={`text-sm flex items-center gap-2 ${
                    alert.acknowledged ? 'text-blue-700 opacity-60' : 'text-blue-900'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${getSeverityColor(
                      alert.severity
                    ).replace('text-', 'bg-')}`}
                  ></span>
                  {alert.title}
                  {alert.acknowledged && (
                    <span className="text-xs text-green-700 font-medium">✓ Acknowledged</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => onNavigate('fraud-alerts')}
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 mt-3 transition-colors"
          >
            View All Alerts
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
