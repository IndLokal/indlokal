import { describe, expect, it } from 'vitest';
import { htmlToText } from '../llm/text';

describe('htmlToText', () => {
  it('drops oversized real html tags instead of leaking srcset noise into text', () => {
    const srcset = 'a '.repeat(600);
    const html = `<h1>Event Registration</h1><img src="hero.jpg" srcset="${srcset}" /><p>JITO Stuttgart Tech Summit - 22nd June 2026</p>`;

    const text = htmlToText(html);

    expect(text).toContain('Event Registration');
    expect(text).toContain('JITO Stuttgart Tech Summit - 22nd June 2026');
    expect(text).not.toContain('srcset');
    expect(text).not.toContain('hero.jpg');
  });
});
