import React, { useState, useEffect } from 'react';
import { BookOpen, PlayCircle, CheckCircle, Clock, Award } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Course } from '../../types';
import { CourseViewerPage } from './CourseViewerPage';

interface CourseProgress {
  course_id: string;
  employee_id: string;
  progress_percentage: number;
  status: string;
  completed_at: string | null;
  assigned_at: string;
}

export const MyCoursesPage: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseProgress, setCourseProgress] = useState<Record<string, CourseProgress>>({});
  const [loading, setLoading] = useState(true);
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null);

  useEffect(() => {
    loadCourses();
  }, [user]);

  const loadCourses = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('employee_courses')
        .select(`
          *,
          courses:course_id (*)
        `)
        .eq('employee_id', user.id);

      if (error) throw error;

      if (data) {
        const coursesData = data.map((ec: any) => ec.courses).filter(Boolean);
        setCourses(coursesData);

        const progressMap: Record<string, CourseProgress> = {};
        data.forEach((ec: any) => {
          if (ec.course_id) {
            progressMap[ec.course_id] = {
              course_id: ec.course_id,
              employee_id: ec.employee_id,
              progress_percentage: parseFloat(ec.progress_percentage) || 0,
              status: ec.status,
              completed_at: ec.completed_at,
              assigned_at: ec.assigned_at
            };
          }
        });
        setCourseProgress(progressMap);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleStartCourse = async (course: Course) => {
    if (!user) return;

    const existingProgress = courseProgress[course.id];

    if (existingProgress && existingProgress.status === 'ASSIGNED') {
      await supabase
        .from('employee_courses')
        .update({
          status: 'IN_PROGRESS',
          started_at: new Date().toISOString()
        })
        .eq('employee_id', user.id)
        .eq('course_id', course.id);
    }

    setViewingCourse(course);
  };

  const getCourseProgress = (courseId: string) => {
    return courseProgress[courseId]?.progress_percentage || 0;
  };

  const getCourseStatus = (courseId: string) => {
    const prog = courseProgress[courseId];
    if (!prog) return 'ASSIGNED';
    const progress = prog.progress_percentage || 0;
    if (progress >= 100) return 'COMPLETED';
    if (progress > 0) return 'IN_PROGRESS';
    return 'ASSIGNED';
  };

  if (viewingCourse) {
    return (
      <CourseViewerPage
        courseId={viewingCourse.id}
        courseTitle={viewingCourse.title}
        onBack={() => {
          setViewingCourse(null);
          loadCourses();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const completedCount = Object.values(courseProgress).filter(p => p.progress_percentage >= 100).length;
  const inProgressCount = Object.values(courseProgress).filter(p => p.progress_percentage > 0 && p.progress_percentage < 100).length;
  const notStartedCount = courses.length - completedCount - inProgressCount;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">My Training Courses</h1>
        <p className="text-slate-600">Continue your cybersecurity awareness training</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-blue-50 rounded-lg">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{courses.length}</span>
          </div>
          <div className="text-sm font-medium text-slate-600">Total Courses</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{completedCount}</span>
          </div>
          <div className="text-sm font-medium text-slate-600">Completed</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-amber-50 rounded-lg">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{inProgressCount}</span>
          </div>
          <div className="text-sm font-medium text-slate-600">In Progress</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-3 bg-slate-50 rounded-lg">
              <PlayCircle className="h-6 w-6 text-slate-600" />
            </div>
            <span className="text-3xl font-bold text-slate-900">{notStartedCount}</span>
          </div>
          <div className="text-sm font-medium text-slate-600">Not Started</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => {
          const progress = getCourseProgress(course.id);
          const status = getCourseStatus(course.id);
          const isCompleted = status === 'COMPLETED';
          const isInProgress = status === 'IN_PROGRESS';
          const isAssigned = status === 'ASSIGNED';

          return (
            <div
              key={course.id}
              className={`bg-white rounded-xl shadow-sm border-2 hover:shadow-md transition-all cursor-pointer ${
                isCompleted ? 'border-green-200' : isInProgress ? 'border-blue-200' : 'border-slate-200'
              }`}
              onClick={() => handleStartCourse(course)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${
                    isCompleted ? 'bg-green-50' : isInProgress ? 'bg-blue-50' : 'bg-slate-50'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : isInProgress ? (
                      <PlayCircle className="h-6 w-6 text-blue-600" />
                    ) : (
                      <BookOpen className="h-6 w-6 text-slate-600" />
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    isCompleted
                      ? 'bg-green-100 text-green-800'
                      : isInProgress
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}>
                    {isCompleted ? 'Completed' : isInProgress ? 'In Progress' : 'Not Started'}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-2">{course.title}</h3>
                <p className="text-slate-600 text-sm mb-4 line-clamp-2">{course.description}</p>

                <div className="flex items-center gap-2 mb-4 text-sm text-slate-600">
                  <Clock className="h-4 w-4" />
                  <span>{course.duration_minutes} minutes</span>
                </div>

                {!isCompleted && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Progress</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isInProgress ? 'bg-blue-600' : 'bg-slate-400'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {isCompleted && courseProgress[course.id]?.completed_at && (
                  <div className="flex items-center gap-2 mb-4 text-sm text-green-600">
                    <Award className="h-4 w-4" />
                    <span>
                      Completed {new Date(courseProgress[course.id].completed_at!).toLocaleDateString()}
                    </span>
                  </div>
                )}

                <button
                  className={`w-full py-2 rounded-lg font-medium transition-all ${
                    isCompleted
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : isInProgress
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700'
                  }`}
                >
                  {isCompleted ? 'Review Course' : isInProgress ? 'Continue' : 'Start Course'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {courses.length === 0 && (
        <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-lg font-medium">No courses assigned yet</p>
          <p className="text-sm">Your company admin will assign courses to you soon.</p>
        </div>
      )}
    </div>
  );
};
