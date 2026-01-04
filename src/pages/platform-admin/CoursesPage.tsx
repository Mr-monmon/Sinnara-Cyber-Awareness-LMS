import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, BookOpen, Settings } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Course } from '../../types';
import { CourseContentManager } from './CourseContentManager';

export const CoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [managingCourse, setManagingCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content_type: 'TEXT' as 'VIDEO' | 'SLIDES' | 'TEXT',
    duration_minutes: 30,
    order_index: 0
  });

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    const { data } = await supabase
      .from('courses')
      .select('*')
      .order('order_index');

    if (data) setCourses(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingCourse) {
        const { error } = await supabase
          .from('courses')
          .update(formData)
          .eq('id', editingCourse.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('courses')
          .insert([formData]);

        if (error) throw error;
      }

      setShowModal(false);
      setEditingCourse(null);
      setFormData({ title: '', description: '', content_type: 'TEXT', duration_minutes: 30, order_index: 0 });
      await loadCourses();
    } catch (error) {
      console.error('Error saving course:', error);
      alert('فشل حفظ الدورة');
    }
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      description: course.description,
      content_type: course.content_type,
      duration_minutes: course.duration_minutes,
      order_index: course.order_index
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الدورة؟')) return;

    try {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) throw error;
      await loadCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
      alert('فشل حذف الدورة');
    }
  };

  if (managingCourse) {
    return <CourseContentManager course={managingCourse} onBack={() => setManagingCourse(null)} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">الدورات التدريبية</h1>
          <p className="text-slate-600">إدارة مكتبة المحتوى التدريبي</p>
        </div>
        <button
          onClick={() => {
            setEditingCourse(null);
            setFormData({ title: '', description: '', content_type: 'TEXT', duration_minutes: 30, order_index: courses.length });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          إضافة دورة
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div key={course.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-purple-50 rounded-lg">
                <BookOpen className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setManagingCourse(course)}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="إدارة المحتوى"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleEdit(course)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(course.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-slate-900 mb-2">{course.title}</h3>
            <p className="text-slate-600 text-sm mb-4 line-clamp-2">{course.description}</p>

            <div className="flex items-center justify-between text-sm">
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full">
                {course.content_type === 'VIDEO' ? 'فيديو' : course.content_type === 'SLIDES' ? 'عرض تقديمي' : 'نص'}
              </span>
              <span className="text-slate-600">{course.duration_minutes} دقيقة</span>
            </div>
          </div>
        ))}
      </div>

      {courses.length === 0 && (
        <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
          No courses yet. Click "Add Course" to create one.
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              {editingCourse ? 'تعديل الدورة' : 'إضافة دورة جديدة'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  عنوان الدورة *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  الوصف *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  نوع المحتوى *
                </label>
                <select
                  value={formData.content_type}
                  onChange={(e) => setFormData({ ...formData, content_type: e.target.value as 'VIDEO' | 'SLIDES' | 'TEXT' })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="TEXT">نصي</option>
                  <option value="VIDEO">فيديو</option>
                  <option value="SLIDES">عرض تقديمي</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  المدة (دقائق) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <strong>ملاحظة:</strong> بعد إنشاء الدورة، استخدم زر "إدارة المحتوى" لإضافة الأقسام (فيديوهات، مقالات، اختبارات).
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCourse(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingCourse ? 'تحديث' : 'إنشاء'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
