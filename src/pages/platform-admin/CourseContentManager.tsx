import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Video,
  FileText,
  ClipboardCheck,
  GripVertical,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Course } from "../../lib/types";
import { CourseContentForm, CourseSection } from "./CourseContentForm";

interface CourseContentManagerProps {
  course: Course;
  onBack: () => void;
}

export const CourseContentManager: React.FC<CourseContentManagerProps> = ({
  course,
  onBack,
}) => {
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState<CourseSection | null>(
    null
  );
  const [savedOrderIds, setSavedOrderIds] = useState<string[]>([]);
  const [hasOrderChanged, setHasOrderChanged] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);

  useEffect(() => {
    loadSections();
  }, [course.id]);

  const loadSections = async () => {
    const { data } = await supabase
      .from("course_sections")
      .select("*")
      .eq("course_id", course.id)
      .order("order_index");

    if (data) {
      setSections(data);
      setSavedOrderIds(data.map((section) => section.id));
      setHasOrderChanged(false);
    }
  };

  const handleEdit = (section: CourseSection) => {
    setEditingSection(section);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this section?")) return;

    try {
      const { error } = await supabase
        .from("course_sections")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await loadSections();
    } catch (error) {
      console.error("Error deleting section:", error);
      alert("Failed to delete section");
    }
  };

  const getSectionIcon = (type: string) => {
    switch (type) {
      case "VIDEO":
        return Video;
      case "ARTICLE":
        return FileText;
      case "QUIZ":
        return ClipboardCheck;
      default:
        return FileText;
    }
  };

  const getSectionTypeLabel = (type: string) => {
    switch (type) {
      case "VIDEO":
        return "Video";
      case "ARTICLE":
        return "Article";
      case "QUIZ":
        return "Quiz";
      default:
        return type;
    }
  };

  const hasSameOrder = (nextSections: CourseSection[]) => {
    if (savedOrderIds.length !== nextSections.length) return false;
    return nextSections.every(
      (section, index) => section.id === savedOrderIds[index]
    );
  };

  const handleDragStart = (event: React.DragEvent, sectionId: string) => {
    event.dataTransfer.setData("text/plain", sectionId);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(sectionId);
    setDragOverId(null);
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (!draggingId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (event: React.DragEvent, targetId: string) => {
    if (!draggingId) return;
    event.preventDefault();
    setDragOverId(targetId);
  };

  const handleDrop = (event: React.DragEvent, targetId: string) => {
    event.preventDefault();
    const sourceId = draggingId || event.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const sourceIndex = sections.findIndex(
      (section) => section.id === sourceId
    );
    const targetIndex = sections.findIndex(
      (section) => section.id === targetId
    );
    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggingId(null);
      return;
    }

    const nextSections = [...sections];
    const [movedSection] = nextSections.splice(sourceIndex, 1);
    nextSections.splice(targetIndex, 0, movedSection);
    setSections(nextSections);
    setHasOrderChanged(!hasSameOrder(nextSections));
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleUpdateOrder = async () => {
    if (!hasOrderChanged || sections.length <= 1) return;

    setIsUpdatingOrder(true);
    try {
      const updates = sections.map((section, index) => ({
        id: section.id,
        order_index: index,
      }));

      const results = await Promise.all(
        updates.map((update) =>
          supabase
            .from("course_sections")
            .update({ order_index: update.order_index })
            .eq("id", update.id)
        )
      );

      const error = results.find((result) => result.error)?.error;
      if (error) throw error;

      const nextSections = sections.map((section, index) => ({
        ...section,
        order_index: index,
      }));

      setSections(nextSections);
      setSavedOrderIds(nextSections.map((section) => section.id));
      setHasOrderChanged(false);
    } catch (error) {
      console.error("Error updating section order:", error);
      alert("Failed to update section order");
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        Return to Courses
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Course Content Management
          </h1>
          <p className="text-slate-600">{course.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleUpdateOrder}
            disabled={!hasOrderChanged || sections.length <= 1 || isUpdatingOrder}
            className={`px-4 py-2 rounded-lg transition-colors ${
              !hasOrderChanged || sections.length <= 1 || isUpdatingOrder
                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 text-white"
            }`}
          >
            {isUpdatingOrder ? "Updating..." : "Update course order"}
          </button>
          <button
            onClick={() => {
              setEditingSection(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Section
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {sections.map((section, index) => {
          const Icon = getSectionIcon(section.section_type);
          return (
            <div
              key={section.id}
              onDragOver={handleDragOver}
              onDragEnter={(event) => handleDragEnter(event, section.id)}
              onDrop={(event) => handleDrop(event, section.id)}
              className={`bg-white rounded-xl shadow-sm border p-6 transition-shadow ${
                draggingId === section.id ? "opacity-60" : "hover:shadow-md"
              } ${
                dragOverId === section.id && draggingId !== section.id
                  ? "border-blue-400 ring-2 ring-blue-200"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  {sections.length > 1 ? (
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => handleDragStart(event, section.id)}
                      onDragEnd={() => setDraggingId(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-move"
                      aria-label="Reorder section"
                    >
                      <GripVertical className="h-5 w-5" />
                    </button>
                  ) : (
                    <GripVertical className="h-5 w-5 text-slate-300" />
                  )}
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-slate-900">
                        {index + 1}. {section.title}
                      </span>
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
                        {getSectionTypeLabel(section.section_type)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600">
                      {section.duration_minutes} minutes
                      {section.section_type === "QUIZ" &&
                        section.content_data?.questions && (
                          <span className="mr-3">
                            • {section.content_data.questions.length} question
                          </span>
                        )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(section)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(section.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {section.section_type === "VIDEO" && section.content && (
                <div className="mt-4 text-sm text-slate-600">
                  <span className="font-medium">Video Link:</span>{" "}
                  {section.content}
                </div>
              )}

              {section.section_type === "ARTICLE" && section.content && (
                <div className="mt-4 text-sm text-slate-600 line-clamp-2">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}

        {sections.length === 0 && (
          <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
            No sections yet. Click "Add Section" to create content.
          </div>
        )}
      </div>

      {showModal && (
        <CourseContentForm
          course={course}
          sectionsCount={sections.length}
          editingSection={editingSection}
          open={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingSection(null);
          }}
          onSaved={loadSections}
        />
      )}
    </div>
  );
};
