export function collapseWhitespace(input: string): string {
  return input.trim().split(/\s+/).join(' ');
}

function normalizeMalformedTag(tagBuffer: string): string {
  return tagBuffer.replace(/[<>]/g, ' ');
}

export function htmlToText(input: string): string {
  let output = '';
  let inTag = false;
  let tagBuffer = '';
  let previousWasWhitespace = false;
  const MAX_TAG_LENGTH = 512;

  for (const char of input) {
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
        // Treat suspiciously long pseudo-tags as plain text so content is not silently lost.
        output += normalizeMalformedTag(tagBuffer);
        inTag = false;
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
