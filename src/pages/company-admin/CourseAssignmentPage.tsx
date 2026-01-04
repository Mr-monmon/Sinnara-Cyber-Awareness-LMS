import React, { useState, useEffect } from 'react';
import { BookOpen, Save, Plus, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Course {
  id: string;
  title: string;
  description: string;
  department_ids: string[] | null;
}

interface Department {
  id: string;
  name: string;
}

export const CourseAssignmentPage: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.company_id) return;

    try {
      const [coursesRes, deptsRes] = await Promise.all([
        supabase.from('courses').select('*').order('order_index'),
        supabase
          .from('departments')
          .select('id, name')
          .eq('company_id', user.company_id)
          .order('name')
      ]);

      if (coursesRes.data) setCourses(coursesRes.data);
      if (deptsRes.data) setDepartments(deptsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDepartment = async (courseId: string, deptId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    if (saving === courseId) return;

    setSaving(courseId);

    const isAssignedToAll = !course.department_ids || course.department_ids.length === 0;

    let newDepts: string[];

    if (isAssignedToAll) {
      newDepts = departments.map(d => d.id).filter(id => id !== deptId);
    } else {
      const currentDepts = course.department_ids || [];
      const isRemoving = currentDepts.includes(deptId);
      newDepts = isRemoving
        ? currentDepts.filter(id => id !== deptId)
        : [...currentDepts, deptId];
    }

    try {
      const { error } = await supabase
        .from('courses')
        .update({ department_ids: newDepts.length > 0 ? newDepts : null })
        .eq('id', courseId);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      setCourses(courses.map(c =>
        c.id === courseId ? { ...c, department_ids: newDepts.length > 0 ? newDepts : null } : c
      ));

      await loadData();
    } catch (error) {
      console.error('Error updating course departments:', error);
      alert(`Failed to update department assignment. Please try again.`);
    } finally {
      setSaving(null);
    }
  };

  const assignToAll = async (courseId: string) => {
    setSaving(courseId);

    try {
      const { error } = await supabase
        .from('courses')
        .update({ department_ids: null })
        .eq('id', courseId);

      if (error) throw error;

      setCourses(courses.map(c =>
        c.id === courseId ? { ...c, department_ids: null } : c
      ));
    } catch (error) {
      console.error('Error updating course:', error);
      alert('Failed to assign course to all departments');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Course Assignment by Department</h1>
        <p className="text-slate-600">
          Control which departments have access to each course. Leave empty to make available to all departments.
        </p>
      </div>

      {departments.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800 font-medium">No departments found</p>
          <p className="text-yellow-600 text-sm mt-2">
            Please create departments first before assigning courses.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => {
            const isAssignedToAll = !course.department_ids || course.department_ids.length === 0;
            const assignedDepts = course.department_ids || [];

            return (
              <div
                key={course.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 mb-1">{course.title}</h3>
                      <p className="text-sm text-slate-600 line-clamp-2">{course.description}</p>
                    </div>
                  </div>

                  {saving === course.id && (
                    <div className="text-sm text-blue-600 font-medium">Saving...</div>
                  )}
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-700">Assigned Departments:</span>
                    <button
                      onClick={() => assignToAll(course.id)}
                      disabled={saving === course.id}
                      className={`text-sm px-3 py-1 rounded-lg transition-colors ${
                        isAssignedToAll
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {isAssignedToAll ? '✓ All Departments' : 'Assign to All'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {departments.map((dept) => {
                      const isAssigned = isAssignedToAll || assignedDepts.includes(dept.id);

                      return (
                        <button
                          key={dept.id}
                          onClick={() => toggleDepartment(course.id, dept.id)}
                          disabled={saving === course.id}
                          className={`px-4 py-2 rounded-lg border-2 transition-all font-medium text-sm flex items-center gap-2 ${
                            isAssigned
                              ? 'border-blue-500 bg-blue-50 text-blue-700 hover:border-red-500 hover:bg-red-50 hover:text-red-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
                          } ${
                            saving === course.id ? 'opacity-50' : ''
                          }`}
                        >
                          {isAssigned ? (
                            <>
                              <X className="h-4 w-4" />
                              {dept.name}
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4" />
                              {dept.name}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {!isAssignedToAll && assignedDepts.length > 0 && (
                    <div className="mt-3 text-xs text-slate-500">
                      Course available to {assignedDepts.length} department{assignedDepts.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {courses.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-12 text-center">
          <BookOpen className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">No courses available</p>
          <p className="text-sm text-slate-500 mt-2">
            Courses will appear here once they are created by the platform admin.
          </p>
        </div>
      )}
    </div>
  );
};
