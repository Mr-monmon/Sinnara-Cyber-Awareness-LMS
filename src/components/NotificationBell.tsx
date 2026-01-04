import React, { useState, useEffect } from 'react';
import { Bell, X, BookOpen, ClipboardCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Notification {
  id: string;
  type: 'course' | 'exam' | 'fraud-alert';
  title: string;
  message: string;
  created_at: string;
  item_id: string;
  item_title: string;
}

interface NotificationBellProps {
  onNavigate: (page: string, itemId?: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user?.role === 'EMPLOYEE') {
      loadNotifications();
    }
  }, [user]);

  const loadNotifications = async () => {
    if (!user?.id) return;

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [coursesRes, examsRes, fraudAlertsRes] = await Promise.all([
        supabase
          .from('employee_courses')
          .select('*, courses(id, title)')
          .eq('employee_id', user.id)
          .gte('assigned_at', sevenDaysAgo.toISOString())
          .order('assigned_at', { ascending: false }),
        supabase
          .from('assigned_exams')
          .select('*, exams(id, title)')
          .eq('assigned_to_employee', user.id)
          .eq('status', 'active')
          .gte('assigned_at', sevenDaysAgo.toISOString())
          .order('assigned_at', { ascending: false }),
        supabase
          .from('fraud_alerts')
          .select('id, title, created_at')
          .eq('is_published', true)
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: false })
      ]);

      const notifs: Notification[] = [];

      if (coursesRes.data) {
        coursesRes.data.forEach(course => {
          if (course.courses) {
            notifs.push({
              id: `course-${course.id}`,
              type: 'course',
              title: 'New Course Assigned',
              message: course.courses.title,
              created_at: course.assigned_at,
              item_id: course.courses.id,
              item_title: course.courses.title
            });
          }
        });
      }

      if (examsRes.data) {
        examsRes.data.forEach(exam => {
          if (exam.exams) {
            notifs.push({
              id: `exam-${exam.id}`,
              type: 'exam',
              title: 'New Exam Assigned',
              message: `${exam.exams.title}${exam.due_date ? ` - Due: ${new Date(exam.due_date).toLocaleDateString()}` : ''}`,
              created_at: exam.assigned_at,
              item_id: exam.exams.id,
              item_title: exam.exams.title
            });
          }
        });
      }

      if (fraudAlertsRes.data) {
        const { data: ackData } = await supabase
          .from('fraud_alert_acknowledgments')
          .select('alert_id')
          .eq('user_id', user.id);

        const acknowledgedIds = new Set(ackData?.map((a) => a.alert_id) || []);

        fraudAlertsRes.data.forEach(alert => {
          if (!acknowledgedIds.has(alert.id)) {
            notifs.push({
              id: `fraud-alert-${alert.id}`,
              type: 'fraud-alert',
              title: 'New Fraud Alert',
              message: alert.title,
              created_at: alert.created_at,
              item_id: alert.id,
              item_title: alert.title
            });
          }
        });
      }

      notifs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifications(notifs);
      setUnreadCount(notifs.length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.type === 'course') {
      onNavigate('my-courses', notification.item_id);
    } else if (notification.type === 'exam') {
      onNavigate('my-exams', notification.item_id);
    } else if (notification.type === 'fraud-alert') {
      onNavigate('fraud-alerts', notification.item_id);
    }
    setShowDropdown(false);
  };

  if (user?.role !== 'EMPLOYEE' || notifications.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-[500px] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-cyan-50">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowDropdown(false)}
                className="p-1 hover:bg-white/50 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Bell className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-medium">No new notifications</p>
                  <p className="text-sm">You're all caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map(notif => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className="w-full p-4 hover:bg-slate-50 transition-colors text-left group"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${
                          notif.type === 'course'
                            ? 'bg-blue-100 text-blue-600 group-hover:bg-blue-200'
                            : notif.type === 'exam'
                            ? 'bg-orange-100 text-orange-600 group-hover:bg-orange-200'
                            : 'bg-red-100 text-red-600 group-hover:bg-red-200'
                        }`}>
                          {notif.type === 'course' ? (
                            <BookOpen className="h-5 w-5" />
                          ) : notif.type === 'exam' ? (
                            <ClipboardCheck className="h-5 w-5" />
                          ) : (
                            <AlertCircle className="h-5 w-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 mb-1">{notif.title}</div>
                          <div className="text-sm text-slate-700 mb-1 line-clamp-2">{notif.message}</div>
                          <div className="text-xs text-slate-500">
                            {new Date(notif.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 border-t border-slate-200 bg-slate-50">
                <button
                  onClick={() => {
                    setUnreadCount(0);
                    setShowDropdown(false);
                  }}
                  className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Mark all as read
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
