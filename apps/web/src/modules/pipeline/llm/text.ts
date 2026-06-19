export function collapseWhitespace(input: string): string {
  return input.trim().split(/\s+/).join(' ');
}

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  ndash: '-',
  mdash: '-',
  quot: '"',
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();

    if (normalized.startsWith('#x')) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    if (normalized.startsWith('#')) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return HTML_ENTITY_MAP[normalized] ?? match;
  });
}

function normalizeMalformedTag(tagBuffer: string): string {
  return tagBuffer.replace(/[<>]/g, ' ');
}

function looksLikeOversizedHtmlTag(tagBuffer: string): boolean {
  return /^<\/?[a-z][a-z0-9:-]*/i.test(tagBuffer);
}

export function htmlToText(input: string): string {
  let output = '';
  let inTag = false;
  let discardingOversizedTag = false;
  let tagBuffer = '';
  let previousWasWhitespace = false;
  const MAX_TAG_LENGTH = 512;

  for (const char of input) {
    if (discardingOversizedTag) {
      if (char === '>') {
        discardingOversizedTag = false;
      }
      continue;
    }

    if (!inTag && char === '<') {
      inTag = true;
      tagBuffer = '<';
      if (!previousWasWhitespace) {
        output += ' ';
        previousWasWhitespace = true;
      }
      continue;
    }
    if (inTag) {
      tagBuffer += char;

      if (char === '>') {
        inTag = false;
        tagBuffer = '';
        continue;
      }

      if (tagBuffer.length > MAX_TAG_LENGTH) {
        // Real-world pages can have huge valid tags (for example long img/srcset blobs).
        // Dropping those keeps extraction text focused on human-readable content.
        const oversizedHtmlTag = looksLikeOversizedHtmlTag(tagBuffer);
        if (!oversizedHtmlTag) {
          output += normalizeMalformedTag(tagBuffer);
        }
        inTag = false;
        discardingOversizedTag = oversizedHtmlTag;
        tagBuffer = '';
        previousWasWhitespace = false;
      }
      continue;
    }

    const isWhitespace = /\s/.test(char);
    if (isWhitespace) {
      if (!previousWasWhitespace) {
        output += ' ';
        previousWasWhitespace = true;
      }
      continue;
    }

    output += char;
    previousWasWhitespace = false;
  }

  if (inTag && tagBuffer.length > 0) {
    output += normalizeMalformedTag(tagBuffer);
  }

  return output.trim();
}
