import React from "react";
import { Star } from "lucide-react";

import { MAX_STARS } from "../lib/courseRatings";

interface Props {
  value: number;
  /** Omit to render read-only. */
  onChange?: (stars: number) => void;
  size?: number;
  /** Accessible name — required when interactive, so the control is not just "5 buttons". */
  label?: string;
}

const GOLD = "#fbbf24";
const EMPTY = "rgba(255,255,255,0.18)";

/**
 * Five stars, as an input or as a read-only display.
 *
 * Interactive stars are real `<button>`s inside a radiogroup rather than styled
 * spans, so the control can be reached and set from the keyboard. An employee
 * being asked to rate a mandatory course should not need a mouse to answer.
 */
export const StarRating: React.FC<Props> = ({ value, onChange, size = 20, label }) => {
  const interactive = typeof onChange === "function";

  return (
    <div
      role={interactive ? "radiogroup" : undefined}
      aria-label={interactive ? label : undefined}
      style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
    >
      {Array.from({ length: MAX_STARS }, (_, i) => {
        const star = i + 1;
        const filled = star <= value;
        const icon = (
          <Star
            size={size}
            style={{ color: filled ? GOLD : EMPTY }}
            fill={filled ? GOLD : "none"}
          />
        );

        if (!interactive) {
          return <span key={star} style={{ display: "inline-flex" }}>{icon}</span>;
        }
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star}`}
            onClick={() => onChange?.(star)}
            style={{
              background: "none", border: "none", padding: 2, cursor: "pointer",
              display: "inline-flex", lineHeight: 0,
            }}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
};

export default StarRating;
