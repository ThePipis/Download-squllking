import { SkoolVideo } from '../types.ts';

/**
 * Parses Skool's TipTap / ProseMirror rich text format [v2][{...}] into clean Markdown.
 */
export function parseTipTapToMarkdown(raw?: string): string {
  if (!raw) return '';

  let jsonStr = raw.trim();
  if (jsonStr.startsWith('[v2]')) {
    jsonStr = jsonStr.substring(4);
  }

  let nodes: any[];
  try {
    nodes = JSON.parse(jsonStr);
  } catch {
    // If not JSON, return as plain text with line breaks preserved
    return raw;
  }

  function parseNode(node: any): string {
    if (!node) return '';

    if (node.type === 'text') {
      let text = node.text || '';
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type === 'bold') text = `**${text}**`;
          else if (mark.type === 'italic') text = `*${text}*`;
          else if (mark.type === 'code') text = `\`${text}\``;
          else if (mark.type === 'strike') text = `~~${text}~~`;
          else if (mark.type === 'link') {
            const href = mark.attrs?.href || '';
            text = href ? `[${text}](${href})` : text;
          }
        }
      }
      return text;
    }

    const inner = (node.content || []).map(parseNode).join('');

    switch (node.type) {
      case 'paragraph':
        return inner ? `${inner}\n\n` : '\n';
      case 'heading': {
        const level = Math.min(6, Math.max(1, node.attrs?.level || 2));
        const prefix = '#'.repeat(level);
        return `${prefix} ${inner.trim()}\n\n`;
      }
      case 'unorderedList':
        return `${inner}\n`;
      case 'orderedList':
        return `${inner}\n`;
      case 'listItem':
        return `- ${inner.trim()}\n`;
      case 'blockquote':
        return `> ${inner.trim()}\n\n`;
      case 'codeBlock': {
        const lang = node.attrs?.language || '';
        return `\`\`\`${lang}\n${inner.trim()}\n\`\`\`\n\n`;
      }
      case 'horizontalRule':
        return `\n---\n\n`;
      case 'hardBreak':
        return `\n`;
      default:
        return inner;
    }
  }

  const result = (Array.isArray(nodes) ? nodes : [nodes]).map(parseNode).join('');
  // Clean up excessive trailing blank lines
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Generates a structured Markdown document from a SkoolVideo lesson
 */
export function buildLessonMarkdown(
  video: SkoolVideo,
  courseTitle?: string,
  communityName?: string
): string {
  const title = video.title || 'Lección sin título';
  const cleanBody = parseTipTapToMarkdown(video.desc);

  const lines: string[] = [
    `# ${title}`,
    '',
  ];

  const metaParts: string[] = [];
  if (communityName) metaParts.push(`**Comunidad:** ${communityName}`);
  if (courseTitle) metaParts.push(`**Curso:** ${courseTitle}`);
  if (video.section) metaParts.push(`**Módulo/Sección:** ${video.section}`);

  if (metaParts.length > 0) {
    lines.push(metaParts.join(' | '));
  }

  if (video.videoLink) {
    lines.push(`**Enlace del Video (${video.provider}):** [Ver en ${video.provider}](${video.videoLink})`);
  }

  lines.push('', '---', '');

  if (cleanBody) {
    lines.push(cleanBody);
  } else {
    lines.push('*Esta lección no contiene descripción de texto adicional.*');
  }

  if (video.resources && video.resources.length > 0) {
    lines.push('', '---', '', '### 📎 Recursos y Enlaces Adjuntos', '');
    for (const res of video.resources) {
      lines.push(`- [${res.title || 'Recurso'}](${res.url})`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Triggers a local browser download for a .md Markdown text file
 */
export function downloadMarkdownFile(filename: string, content: string): void {
  const safeBase = filename.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim();
  const finalFilename = safeBase.endsWith('.md') ? safeBase : `${safeBase}.md`;

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
    URL.revokeObjectURL(blobUrl);
  }, 3000);
}
