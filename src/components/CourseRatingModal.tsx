import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, X } from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import { loadMyRating, saveRating } from "../lib/courseRatings";
import { StarRating } from "./StarRating";

const T = {
  bgCard: "#1a1e0e",
  accent: "#c8ff00",
  accentDark: "#12140a",
  white: "#ffffff",
  textBody: "#cbd5e1",
  textMuted: "#64748b",
  border: "rgba(255,255,255,0.09)",
  red: "#f87171",
};

interface Props {
  courseId: string;
  courseTitle: string;
  /** Called when the dialog closes, whether or not a rating was saved. */
  onClose: () => void;
}

/**
 * Ask an employee what they thought of a course they just finished.
 *
 * Dismissible on purpose. This is the one screen in the onboarding sequence
 * that exists for the platform's benefit rather than the employee's, and a
 * mandatory five-star prompt collects compliance, not opinions. "Not now"
 * leaves the course rateable later from My Courses.
 */
export const CourseRatingModal: React.FC<Props> = ({ courseId, courseTitle, onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) { setLoading(false); return; }
      const existing = await loadMyRating(courseId, user.id);
      if (cancelled) return;
      if (existing) {
        setStars(existing.stars);
        setComment(existing.comment ?? "");
        setIsEdit(true);
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [courseId, user?.id]);

  const handleSubmit = async () => {
    if (!user?.id || stars < 1) return;
    setSaving(true);
    setError(null);
    // The author and their company are taken from the caller's JWT inside the
    // RPC, not sent from here — a rating cannot be filed against someone else.
    const result = await saveRating({ courseId, stars, comment });
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "rgba(0,0,0,0.78)", backdropFilter: "blur(5px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        style={{
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16,
          padding: 32, width: "100%", maxWidth: 460, position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("courseRating.later", { ns: "employee" })}
          style={{
            position: "absolute", top: 14, insetInlineEnd: 14, background: "none",
            border: "none", color: T.textMuted, cursor: "pointer", lineHeight: 0, padding: 4,
          }}
        >
          <X size={18} />
        </button>

        <h2 style={{ fontSize: 19, fontWeight: 800, color: T.white, margin: "0 0 6px" }}>
          {isEdit
            ? t("courseRating.editTitle", { ns: "employee" })
            : t("courseRating.title", { ns: "employee" })}
        </h2>
        <p style={{ fontSize: 13, color: T.textMuted, margin: "0 0 4px" }}>{courseTitle}</p>
        {/*
          Said plainly and up front. An employee who suspects their manager will
          read this writes what is safe rather than what is true, and the whole
          exercise measures nothing.
        */}
        <p style={{ fontSize: 12, color: T.textMuted, margin: "0 0 22px", lineHeight: 1.6 }}>
          {t("courseRating.privacyNote", { ns: "employee" })}
        </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: "28px 0", color: T.textMuted, fontSize: 13 }}>
            <Loader2 size={18} style={{ animation: "aw-spin 0.8s linear infinite" }} />
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <StarRating
                value={stars}
                onChange={setStars}
                size={30}
                label={t("courseRating.starsLabel", { ns: "employee" })}
              />
            </div>

            <label style={{ display: "block", fontSize: 12, color: T.textBody, marginBottom: 8 }}>
              {t("courseRating.commentLabel", { ns: "employee" })}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder={t("courseRating.commentPlaceholder", { ns: "employee" })}
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 12px",
                background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`,
                borderRadius: 10, color: T.white, fontSize: 13, resize: "vertical",
                fontFamily: "inherit", outline: "none",
              }}
            />

            {error && (
              <p style={{ color: T.red, fontSize: 12, margin: "10px 0 0" }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={stars < 1 || saving}
                style={{
                  flex: 1, padding: "11px 20px", borderRadius: 10, border: "none",
                  background: stars < 1 || saving ? T.border : T.accent,
                  color: stars < 1 || saving ? T.textMuted : T.accentDark,
                  fontSize: 14, fontWeight: 700,
                  cursor: stars < 1 || saving ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {saving && <Loader2 size={14} style={{ animation: "aw-spin 0.8s linear infinite" }} />}
                {isEdit
                  ? t("courseRating.update", { ns: "employee" })
                  : t("courseRating.submit", { ns: "employee" })}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "11px 20px", borderRadius: 10, fontSize: 14,
                  background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`,
                  color: T.textBody, cursor: "pointer",
                }}
              >
                {t("courseRating.later", { ns: "employee" })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CourseRatingModal;
