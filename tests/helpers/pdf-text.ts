/** PDFKit embeds Noto Sans with a custom encoding. Read it back through the ToUnicode map. */
export function readPdfText(pdf: string): string {
  const range = pdf.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]\s*endbfrange/);
  if (!range) throw new Error('The PDF has no Unicode character map.');
  const glyphs = new Map<number, string>();
  let code = Number.parseInt(range[1], 16);
  for (const entry of range[3].matchAll(/<([0-9A-Fa-f ]+)>/g)) {
    glyphs.set(
      code,
      entry[1]
        .trim()
        .split(/\s+/)
        .map((hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
        .join(''),
    );
    code += 1;
  }
  let text = '';
  for (const run of pdf.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) {
    for (const glyph of run[1].matchAll(/<([0-9A-Fa-f]+)>/g)) {
      for (let index = 0; index < glyph[1].length; index += 4) {
        text += glyphs.get(Number.parseInt(glyph[1].slice(index, index + 4), 16)) ?? '';
      }
    }
    text += '\n';
  }
  return text;
}
