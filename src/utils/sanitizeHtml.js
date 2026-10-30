const allowedTags = new Set([
  "p", "br", "div", "span", "strong", "b", "em", "i", "u", "s", "del",
  "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote",
  "hr", "a", "img", "table", "thead", "tbody", "tr", "th", "td",
]);
const voidTags = new Set(["br", "hr", "img"]);
const allowedAttributes = new Set(["href", "src", "alt", "title", "target", "width", "height"]);

const safeUrl = (value, isImage = false) => {
  const normalized = value
    .replace(/&(?:#\d+|#x[\da-f]+|colon|tab|newline);?/gi, "")
    .replace(/[\u0000-\u0020\u007f]/g, "")
    .trim();
  let decoded = normalized;
  try {
    decoded = decodeURIComponent(normalized);
  } catch {
    // Keep the original when it contains a literal percent sign.
  }
  const lower = decoded.toLowerCase();
  if (isImage) return lower.startsWith("https://") || lower.startsWith("/uploads/");
  return (
    lower.startsWith("https://") ||
    lower.startsWith("http://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    (lower.startsWith("/") && !lower.startsWith("//")) ||
    lower.startsWith("#")
  );
};

const escapeAttribute = (value) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export default function sanitizeHtml(input) {
  const source = String(input || "")
    .replace(/<(script|style|iframe|object|embed|svg|math|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|svg|math|form)\b[^>]*\/?>/gi, "");

  return source.replace(/<[^>]*>|[^<]+/g, (token) => {
    if (!token.startsWith("<")) return token;
    const match = token.match(/^<\s*(\/?)\s*([a-z\d-]+)([\s\S]*?)\s*\/?>$/i);
    if (!match) return "";
    const [, closing, rawTag, rawAttributes] = match;
    const tag = rawTag.toLowerCase();
    if (!allowedTags.has(tag)) return "";
    if (closing) return voidTags.has(tag) ? "" : `</${tag}>`;

    const attributes = [];
    const attributePattern = /([a-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
    let attributeMatch;
    while ((attributeMatch = attributePattern.exec(rawAttributes))) {
      const name = attributeMatch[1].toLowerCase();
      if (!allowedAttributes.has(name)) continue;
      const value = attributeMatch[2] ?? attributeMatch[3] ?? attributeMatch[4] ?? "";
      if ((name === "href" || name === "src") && !safeUrl(value, name === "src")) continue;
      if (name === "target" && !["_blank", "_self"].includes(value)) continue;
      if (["width", "height"].includes(name) && !/^\d{1,4}$/.test(value)) continue;
      attributes.push(`${name}="${escapeAttribute(value)}"`);
    }
    if (tag === "a" && attributes.some((attribute) => attribute.startsWith('target="_blank"')))
      attributes.push('rel="noopener noreferrer"');
    return `<${tag}${attributes.length ? ` ${attributes.join(" ")}` : ""}>`;
  });
}
