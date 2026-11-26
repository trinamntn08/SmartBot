const maxBookBytes = 8 * 1024 * 1024;
const maxSectionLength = 5000;

export class BookImportError extends Error {}

export function readingSections(text) {
  const sections = [];
  let remaining = text;
  while (remaining.length > maxSectionLength) {
    const paragraph = remaining.lastIndexOf('\n\n', maxSectionLength - 2);
    const word = remaining.lastIndexOf(' ', maxSectionLength - 1);
    let end = paragraph > maxSectionLength / 2 ? paragraph + 2 : word + 1;
    if (end <= maxSectionLength / 2) end = maxSectionLength;
    if (/[\uD800-\uDBFF]/.test(remaining[end - 1])) end -= 1;
    sections.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  if (remaining) sections.push(remaining);
  return sections;
}

export async function readTextBook(file) {
  if (!/\.txt$/i.test(file.name)) throw new BookImportError('Choose a plain text (.txt) file.');
  if (file.size > maxBookBytes) throw new BookImportError('Choose a text file under 8 MB.');

  const bytes = new Uint8Array(await file.arrayBuffer());
  let encoding = 'utf-8';
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) encoding = 'utf-16le';
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) encoding = 'utf-16be';

  let text;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new BookImportError('Save this file as UTF-8 text and try again.');
  }

  text = text.replace(/\r\n?/g, '\n');
  if (!text.trim()) throw new BookImportError('This text file is empty.');
  if (text.includes('\0')) throw new BookImportError('This file does not contain readable text.');

  const title = file.name.slice(0, -4).trim() || 'Untitled book';
  return { title, fileName: file.name, sections: readingSections(text) };
}
