import DOMPurify from "dompurify";

const ArticlePreview = ({ html }: { html: string }) => {
  const clean = DOMPurify.sanitize(html);
  return (
    <div className="prose max-w-none mb-6">
      <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
        <div className="ql-snow">
          <div
            className="ql-editor"
            dangerouslySetInnerHTML={{ __html: clean }}
          />
        </div>
      </div>
    </div>
  );
};

export default ArticlePreview;
