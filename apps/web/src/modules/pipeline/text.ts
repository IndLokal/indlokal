export function collapseWhitespace(input: string): string {
  return input.trim().split(/\s+/).join(' ');
}

export function htmlToText(input: string): string {
  let output = '';
  let inTag = false;
  let previousWasWhitespace = false;

  for (const char of input) {
    if (char === '<') {
      inTag = true;
      if (!previousWasWhitespace) {
        output += ' ';
        previousWasWhitespace = true;
      }
      continue;
    }
    if (char === '>') {
      inTag = false;
      continue;
    }
    if (inTag) continue;

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

  return output.trim();
}
