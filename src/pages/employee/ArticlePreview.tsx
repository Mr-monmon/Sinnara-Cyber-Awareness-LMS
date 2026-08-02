import DOMPurify from "dompurify";
import { useTheme } from "../../contexts/ThemeContext";

/**
 * ArticlePreview — renders sanitized Quill HTML for a course ARTICLE section.
 *
 * The body text used to be hardcoded to Tailwind's `text-slate-700`, a dark
 * grey that is fine on a light background but nearly invisible on the dark
 * theme. Colour now follows the active theme, and the rules below make Quill's
 * own `.ql-editor` styles (plus headings, lists, quotes and tables authored in
 * the editor) inherit it instead of falling back to their own dark defaults.
 */
const STYLES = `
  .aw-article-body .ql-container,
  .aw-article-body .ql-editor {
    color: inherit;
    font-family: 'Inter', sans-serif;
    padding: 0;
    border: none;
    background: transparent;
    line-height: 1.75;
    font-size: 15px;
  }
  /* Quill's snow theme colours these explicitly — force them to follow the theme. */
  .aw-article-body .ql-editor h1,
  .aw-article-body .ql-editor h2,
  .aw-article-body .ql-editor h3,
  .aw-article-body .ql-editor h4,
  .aw-article-body .ql-editor h5,
  .aw-article-body .ql-editor h6,
  .aw-article-body .ql-editor p,
  .aw-article-body .ql-editor span,
  .aw-article-body .ql-editor li,
  .aw-article-body .ql-editor ol,
  .aw-article-body .ql-editor ul,
  .aw-article-body .ql-editor strong,
  .aw-article-body .ql-editor em,
  .aw-article-body .ql-editor u,
  .aw-article-body .ql-editor td,
  .aw-article-body .ql-editor th {
    color: inherit;
  }
  .aw-article-body .ql-editor h1,
  .aw-article-body .ql-editor h2,
  .aw-article-body .ql-editor h3 {
    font-weight: 800;
    letter-spacing: -0.2px;
    margin: 1.2em 0 0.5em;
  }
  .aw-article-body .ql-editor h1 { font-size: 24px; }
  .aw-article-body .ql-editor h2 { font-size: 20px; }
  .aw-article-body .ql-editor h3 { font-size: 17px; }
  .aw-article-body .ql-editor p  { margin: 0 0 0.9em; }
  .aw-article-body .ql-editor ol,
  .aw-article-body .ql-editor ul { margin: 0 0 0.9em; }
  .aw-article-body .ql-editor blockquote {
    border-left: 3px solid var(--aw-article-accent);
    padding-left: 14px;
    margin: 1em 0;
    opacity: 0.92;
  }
  .aw-article-body .ql-editor a {
    color: var(--aw-article-accent);
    text-decoration: underline;
  }
  .aw-article-body .ql-editor img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
  }
  /* RTL articles keep their alignment. */
  [dir="rtl"] .aw-article-body .ql-editor { text-align: right; }
`;

if (typeof document !== "undefined" && !document.getElementById("aw-article-styles")) {
  const tag = document.createElement("style");
  tag.id = "aw-article-styles";
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

const ArticlePreview = ({ html }: { html: string }) => {
  const { tokens: T, isDark } = useTheme();
  const clean = DOMPurify.sanitize(html);

  return (
    <div
      className="aw-article-body"
      style={{
        // Light theme keeps the original slate body colour; dark theme uses the
        // high-contrast text colour so the article is actually readable.
        color: isDark ? T.white : "#334155",
        ["--aw-article-accent" as string]: T.accent,
      }}
    >
      <div className="ql-snow">
        <div className="ql-editor" dangerouslySetInnerHTML={{ __html: clean }} />
      </div>
    </div>
  );
};

export default ArticlePreview;
