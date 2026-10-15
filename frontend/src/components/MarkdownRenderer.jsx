import React from 'react';

/**
 * Parses inline markdown formatted text (bold, italic, inline code, links, escaped chars)
 * and returns safe React elements without dangerouslySetInnerHTML.
 */
function renderInline(text) {
  if (!text) return null;

  // Unescape backslash-escaped characters (e.g. \* -> *, \_ -> _)
  const unescaped = text.replace(/\\([*_`[\]()#+\-.!])/g, '$1');

  // Tokenize string for code, bold, italic, links
  // Regex matches:
  // 1. Inline code: `code`
  // 2. Bold-italic: ***text*** or ___text___
  // 3. Bold: **text** or __text__
  // 4. Italic: *text* or _text_
  // 5. Links: [text](url)
  const pattern = /(`[^`]+`|\*\*\*[^*]+\*\*\*|___[^_]+___|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;

  const parts = unescaped.split(pattern);

  return parts.map((part, i) => {
    if (!part) return null;

    // Inline code
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={i}
          style={{
            fontFamily: 'monospace',
            backgroundColor: 'var(--bg-elevated)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '0.85em',
            color: 'var(--accent-blue)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold + Italic (***text*** or ___text___)
    if ((part.startsWith('***') && part.endsWith('***') && part.length >= 6) ||
        (part.startsWith('___') && part.endsWith('___') && part.length >= 6)) {
      return (
        <strong key={i} style={{ fontWeight: 800, fontStyle: 'italic', color: 'var(--text-primary)' }}>
          {renderInline(part.slice(3, -3))}
        </strong>
      );
    }

    // Bold (**text** or __text__)
    if ((part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
        (part.startsWith('__') && part.endsWith('__') && part.length >= 4)) {
      return (
        <strong key={i} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          {renderInline(part.slice(2, -2))}
        </strong>
      );
    }

    // Italic (*text* or _text_)
    if ((part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
        (part.startsWith('_') && part.endsWith('_') && part.length >= 2)) {
      return (
        <em key={i} style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
          {renderInline(part.slice(1, -1))}
        </em>
      );
    }

    // Links [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isExternal = href.startsWith('http://') || href.startsWith('https://');
      return (
        <a
          key={i}
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          style={{
            color: 'var(--accent-blue, #3b82f6)',
            textDecoration: 'underline',
            textUnderlineOffset: '2px'
          }}
        >
          {label}
        </a>
      );
    }

    // Handle any stray unclosed markdown markers gracefully
    const cleaned = part.replace(/\*\*/g, '').replace(/###/g, '');
    return <React.Fragment key={i}>{cleaned}</React.Fragment>;
  });
}

/**
 * Checks if a line is a markdown table separator line (e.g. |---|:---|---:|)
 */
function isTableSeparator(line) {
  const trimmed = line.trim();
  return /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(trimmed);
}

/**
 * Checks if a line is a markdown table row (contains | )
 */
function isTableRow(line) {
  const trimmed = line.trim();
  return trimmed.includes('|') && trimmed.startsWith('|') && trimmed.endsWith('|');
}

/**
 * Splits a markdown table row into trimmed cell contents
 */
function parseCells(line) {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((c) => c.trim());
}

/**
 * Full Markdown Renderer Component
 */
export default function MarkdownRenderer({ content = '', className = '' }) {
  if (!content) return null;

  const lines = content.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 1. Code Block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'code',
        language: lang,
        content: codeLines.join('\n')
      });
      i++;
      continue;
    }

    // 2. Table
    if (line.includes('|') && isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerRow = parseCells(line);
      i += 2; // skip header and separator
      const bodyRows = [];
      while (i < lines.length && isTableRow(lines[i])) {
        bodyRows.push(parseCells(lines[i]));
        i++;
      }
      blocks.push({
        type: 'table',
        headers: headerRow,
        rows: bodyRows
      });
      continue;
    }

    // 3. Headings
    if (line.startsWith('#### ')) {
      blocks.push({ type: 'h4', text: line.replace(/^####\s+/, '') });
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.replace(/^###\s+/, '') });
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.replace(/^##\s+/, '') });
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.replace(/^#\s+/, '') });
      i++;
      continue;
    }

    // 4. Blockquotes
    if (line.startsWith('> ')) {
      const quoteLines = [line.replace(/^>\s+/, '')];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().replace(/^>\s+/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join(' ') });
      continue;
    }

    // 5. Unordered List (*, -, +)
    if (/^[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // 6. Ordered List (1., 2., etc.)
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // 7. Horizontal Rule (---, ***, ___)
    if (/^([-*_]){3,}$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 8. Empty Line
    if (!line) {
      i++;
      continue;
    }

    // 9. Standard Paragraph (gather consecutive non-empty lines)
    const paraLines = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('> ') &&
      !/^[-*+]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !(lines[i].trim().includes('|') && isTableRow(lines[i].trim()))
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: 'p', text: paraLines.join(' ') });
  }

  return (
    <div className={`markdown-body ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'h1':
            return (
              <h3 key={idx} style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0 2px' }}>
                {renderInline(block.text)}
              </h3>
            );
          case 'h2':
            return (
              <h4 key={idx} style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-blue, #60a5fa)', margin: '5px 0 2px' }}>
                {renderInline(block.text)}
              </h4>
            );
          case 'h3':
            return (
              <h5 key={idx} style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 1px' }}>
                {renderInline(block.text)}
              </h5>
            );
          case 'h4':
            return (
              <h6 key={idx} style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-secondary)', margin: '3px 0 1px' }}>
                {renderInline(block.text)}
              </h6>
            );
          case 'p':
            return (
              <p key={idx} style={{ fontSize: '0.86rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.6, margin: 0 }}>
                {renderInline(block.text)}
              </p>
            );
          case 'ul':
            return (
              <ul key={idx} style={{ margin: '2px 0 4px 18px', padding: 0, listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.55 }}>
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={idx} style={{ margin: '2px 0 4px 18px', padding: 0, listStyleType: 'decimal', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.55 }}>
                    {renderInline(item)}
                  </li>
                ))}
              </ol>
            );
          case 'blockquote':
            return (
              <blockquote
                key={idx}
                style={{
                  margin: '4px 0',
                  padding: '8px 12px',
                  borderLeft: '3px solid var(--accent-blue, #3b82f6)',
                  background: 'rgba(59, 130, 246, 0.08)',
                  borderRadius: '0 6px 6px 0',
                  fontSize: '0.84rem',
                  fontStyle: 'italic',
                  color: 'var(--text-secondary)'
                }}
              >
                {renderInline(block.text)}
              </blockquote>
            );
          case 'table':
            return (
              <div key={idx} style={{ overflowX: 'auto', margin: '6px 0', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {block.headers.map((h, hIdx) => (
                        <th key={hIdx} style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {renderInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        style={{
                          background: rIdx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-elevated)',
                          borderBottom: rIdx < block.rows.length - 1 ? '1px solid var(--border-subtle)' : 'none'
                        }}
                      >
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'code':
            return (
              <pre
                key={idx}
                style={{
                  margin: '6px 0',
                  padding: '10px 14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  overflowX: 'auto',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  lineHeight: 1.5
                }}
              >
                <code>{block.content}</code>
              </pre>
            );
          case 'hr':
            return (
              <hr
                key={idx}
                style={{
                  border: 'none',
                  borderTop: '1px solid var(--border-subtle)',
                  margin: '8px 0'
                }}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
