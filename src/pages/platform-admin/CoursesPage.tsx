import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  Settings,
  Download,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { CertificateTemplate, Course, EmployeeCourse } from "../../lib/types";
import { CourseContentManager } from "./CourseContentManager";

export const CoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [managingCourse, setManagingCourse] = useState<Course | null>(null);
  const [employeeCourses, setEmployeeCourses] = useState<EmployeeCourse[]>([]);
  const [certificateTemplates, setCertificateTemplates] = useState<CertificateTemplate[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    title_ar: "",
    description_ar: "",
    content_type: "TEXT" as "VIDEO" | "SLIDES" | "TEXT",
    duration_minutes: 30,
    order_index: 0,
    certificate_id: "",
  });

  useEffect(() => {
    loadCourses();
    loadEmployeeCourses();
    loadCertificateTemplates();
  }, []);

  const loadCourses = async () => {
    const { data } = await supabase
      .from("courses")
      .select("*, certificate_templates(id,name)")
      .order("order_index");

    if (data) setCourses(data);
  };

  const loadEmployeeCourses = async () => {
    const { data } = await supabase
    .from("employee_courses")
    .select(`
      *,
      employee:users!employee_courses_employee_id_fkey(
        id,
        full_name,
        email,
        department:departments!users_department_id_fkey(
          id,
          name
        )
      )
    `)
    .order("assigned_at");

    if (data) setEmployeeCourses(data as unknown as EmployeeCourse[]);
  };

  const loadCertificateTemplates = async () => {
    const { data } = await supabase
      .from("certificate_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setCertificateTemplates(data as unknown as CertificateTemplate[]);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const coursePayload = {
        ...formData,
        title_ar: formData.title_ar.trim() || formData.title.trim(),
        description_ar:
          formData.description_ar.trim() || formData.description.trim(),
        certificate_id: formData.certificate_id || null,
      };

      if (editingCourse) {
        const { error } = await supabase
          .from("courses")
          .update(coursePayload)
          .eq("id", editingCourse.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("courses").insert([coursePayload]);

        if (error) throw error;
      }

      setShowModal(false);
      setEditingCourse(null);
      setFormData({
        title: "",
        description: "",
        title_ar: "",
        description_ar: "",
        content_type: "TEXT",
        duration_minutes: 30,
        order_index: 0,
        certificate_id: "",
      });
      await loadCourses();
    } catch (error) {
      console.error("Error saving course:", error);
      alert("Failed to save course");
    }
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      description: course.description,
      title_ar: course.title_ar || "",
      description_ar: course.description_ar || "",
      content_type: course.content_type,
      duration_minutes: course.duration_minutes,
      order_index: course.order_index,
      certificate_id: course.certificate_id || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this course?")) return;

    try {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
      await loadCourses();
    } catch (error) {
      console.error("Error deleting course:", error);
      alert("Failed to delete course");
    }
  };

  if (managingCourse) {
    return (
      <CourseContentManager
        course={managingCourse}
        onBack={() => setManagingCourse(null)}
      />
    );
  }

  const handleDownloadEmployeeCourses = async (courseId: string) => {
    const rows = employeeCourses.filter(
      (employeeCourse) => employeeCourse.course_id === courseId
    );

    if (rows.length === 0) {
      alert("No employee course records found for this course");
      return;
    }

    const escapeCsvValue = (value: string | number | null | undefined) => {
      const normalized = value == null ? "" : String(value);
      return `"${normalized.replace(/"/g, '""')}"`;
    };

    const headers = [
      "user name",
      "user email",
      "department",
      "progress_percentage",
      "completed_at",
    ];

    const csvLines = rows.map((row) => {
      const employee = (
        row as EmployeeCourse & {
          employee?: { full_name?: string | null; email?: string | null; department?: { name?: string | null } };
        }
      ).employee;

      return [
        escapeCsvValue(employee?.full_name ?? ""),
        escapeCsvValue(employee?.email ?? ""),
        escapeCsvValue(employee?.department?.name ?? ""),
        escapeCsvValue(row.progress_percentage),
        escapeCsvValue(row.completed_at),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...csvLines].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const course = courses.find((item) => item.id === courseId);
    const safeCourseTitle = (course?.title ?? "course")
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "_");
    const fileName = `${safeCourseTitle}_employee_courses.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Training Courses
          </h1>
          <p className="text-slate-600">Training Content Management</p>
        </div>
        <button
          onClick={() => {
            setEditingCourse(null);
            setFormData({
              title: "",
              description: "",
              title_ar: "",
              description_ar: "",
              content_type: "TEXT",
              duration_minutes: 30,
              order_index: courses.length,
              certificate_id: "",
            });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Course
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div
            key={course.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-purple-50 rounded-lg">
                <BookOpen className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownloadEmployeeCourses(course.id)}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="View Employee Courses"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setManagingCourse(course)}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  title="Content Management"
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

            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {course.title}
            </h3>
            <p className="text-slate-600 text-sm mb-4 line-clamp-2">
              {course.description}
            </p>

            <div className="flex items-center justify-between text-sm">
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full">
                {course.content_type === "VIDEO"
                  ? "Video"
                  : course.content_type === "SLIDES"
                  ? "Slides"
                  : "Text"}
              </span>
              <span className="text-slate-600">
                {course.duration_minutes} minutes
              </span>
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
              {editingCourse ? "Edit Course" : "Add New Course"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Course Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description *
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Arabic Course Title
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={formData.title_ar}
                  onChange={(e) =>
                    setFormData({ ...formData, title_ar: e.target.value })
                  }
                  placeholder="Uses Course Title when left blank"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Arabic Description
                </label>
                <textarea
                  dir="rtl"
                  rows={3}
                  value={formData.description_ar}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      description_ar: e.target.value,
                    })
                  }
                  placeholder="Uses Description when left blank"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Content Type *
                </label>
                <select
                  value={formData.content_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      content_type: e.target.value as
                        | "VIDEO"
                        | "SLIDES"
                        | "TEXT",
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="TEXT">Text</option>
                  <option value="VIDEO">Video</option>
                  <option value="SLIDES">Slides</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.duration_minutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      duration_minutes: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Certificate Template
                </label>
                <select
                  value={formData.certificate_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      certificate_id: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No certificate template</option>
                  {certificateTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <strong>Note:</strong> After creating the course, use the
                "Content Management" button to add sections (videos, articles,
                quizzes).
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingCourse ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
