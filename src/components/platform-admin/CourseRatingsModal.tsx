import React, { useEffect, useState } from "react";
import { Loader2, MessageSquare, X } from "lucide-react";

import { StarRating } from "../StarRating";
import {
  THIN_SAMPLE_THRESHOLD, isThinSample,
  loadRatingComments,
  type CourseRatingComment, type CourseRatingSummary,
} from "../../lib/courseRatings";

const T = {
  bgCard: "#1a1e0e",
  white: "#ffffff",
  textBody: "#cbd5e1",
  textMuted: "#64748b",
  border: "rgba(255,255,255,0.09)",
  borderFaint: "rgba(255,255,255,0.05)",
  gold: "#fbbf24",
};

interface Props {
  courseId: string;
  courseTitle: string;
  summary: CourseRatingSummary | undefined;
  onClose: () => void;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });

/**
 * What employees thought of one course.
 *
 * The histogram is shown beside the average because the average alone hides the
 * shape that matters: 3.0 from everyone shrugging and 3.0 from half loving it
 * and half hating it are different problems with different fixes.
 */
export const CourseRatingsModal: React.FC<Props> = ({ courseId, courseTitle, summary, onClose }) => {
  const [comments, setComments] = useState<CourseRatingComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadRatingComments(courseId).then((rows) => {
      if (cancelled) return;
      setComments(rows);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [courseId]);

  const total = summary?.count ?? 0;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 60, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 24,
        background: "rgba(10,12,6,0.86)", backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto",
          background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 16,
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div style={{
          padding: "16px 22px", borderBottom: `1px solid ${T.borderFaint}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: T.bgCard, zIndex: 2,
        }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: T.white, margin: 0 }}>Course rating</h3>
            <p style={{ fontSize: 12, color: T.textMuted, margin: "3px 0 0" }}>{courseTitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", lineHeight: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 22 }}>
          {total === 0 ? (
            <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>
              No employee has rated this course yet.
            </p>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 20 }}>
                <div style={{ textAlign: "center", minWidth: 92 }}>
                  <div style={{ fontSize: 34, fontWeight: 900, color: T.gold, lineHeight: 1 }}>
                    {summary?.average.toFixed(1)}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <StarRating value={Math.round(summary?.average ?? 0)} size={13} />
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 5 }}>
                    {total} rating{total === 1 ? "" : "s"}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const n = summary?.histogram[star - 1] ?? 0;
                    const pct = total > 0 ? (n / total) * 100 : 0;
                    return (
                      <div key={star} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: T.textMuted, width: 26 }}>{star}★</span>
                        <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 9999, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: T.gold, borderRadius: 9999 }} />
                        </div>
                        <span style={{ fontSize: 11, color: T.textMuted, width: 22, textAlign: "right" }}>{n}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {isThinSample(total) && (
                /*
                  Stated rather than hidden. An average over four people is a real
                  number and a weak signal, and a reader who is not told that will
                  reorder a syllabus on the strength of one bad morning.
                */
                <p style={{
                  fontSize: 11, color: T.textMuted, margin: "0 0 18px", padding: "8px 10px",
                  border: `1px solid ${T.borderFaint}`, borderRadius: 8, lineHeight: 1.6,
                }}>
                  Fewer than {THIN_SAMPLE_THRESHOLD} ratings — treat this average as an early indication, not a verdict.
                </p>
              )}

              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                fontSize: 12, fontWeight: 700, color: T.textBody, marginBottom: 10,
              }}>
                <MessageSquare size={13} /> Written feedback ({summary?.commentCount ?? 0})
              </div>

              {loading ? (
                <div style={{ color: T.textMuted, padding: "12px 0" }}>
                  <Loader2 size={16} style={{ animation: "aw-spin 0.8s linear infinite" }} />
                </div>
              ) : comments.length === 0 ? (
                <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>
                  Ratings were left without a comment.
                </p>
              ) : (
                comments.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "11px 13px", marginBottom: 8,
                      border: `1px solid ${T.borderFaint}`, borderRadius: 10,
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                      <StarRating value={c.stars} size={12} />
                      <span style={{ fontSize: 10, color: T.textMuted }}>
                        {/*
                          Company and date, never the employee's name. This screen
                          exists to judge the course; attaching a name to every
                          complaint turns it into a list of individuals, and the
                          honest answers stop arriving.
                        */}
                        {c.companyName ?? "—"} · {fmtDate(c.ratedAt)}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: T.textBody, margin: 0, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                      {c.comment}
                    </p>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseRatingsModal;
