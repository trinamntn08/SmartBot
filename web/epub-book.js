const xhtmlNamespace = 'http://www.w3.org/1999/xhtml';
const epubNamespace = 'http://www.idpf.org/2007/ops';

function escapeXml(text) {
  return text.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]);
}

function page(title, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="${xhtmlNamespace}" xmlns:epub="${epubNamespace}">
<head><title>${title}</title></head><body>${body}</body></html>`;
}

export async function makeEpub({ title, sections }) {
  await import('./vendor/jszip/jszip.min.js');
  const zip = new globalThis.JSZip();
  const safeTitle = escapeXml(title);
  const navigation = [];
  const manifest = [];
  const spine = [];
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
<rootfiles><rootfile full-path="EPUB/book.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`);

  for (const [index, section] of sections.entries()) {
    const number = index + 1;
    const id = `section-${number}`;
    const href = `${id}.xhtml`;
    const label = `Section ${number}`;
    const paragraphs = section.trim().split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeXml(paragraph).replace(/\n/g, '<br/>')}</p>`);
    zip.file(`EPUB/${href}`, page(`${safeTitle} — ${label}`, paragraphs.join('\n')));
    navigation.push(`<li><a href="${href}">${label}</a></li>`);
    manifest.push(`<item id="${id}" href="${href}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="${id}"/>`);
  }

  zip.file('EPUB/nav.xhtml', page(safeTitle,
    `<nav epub:type="toc"><h1>${safeTitle}</h1><ol>${navigation.join('\n')}</ol></nav>`));
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  zip.file('EPUB/book.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">urn:uuid:${crypto.randomUUID()}</dc:identifier>
<dc:title>${safeTitle}</dc:title><dc:language>und</dc:language>
<meta property="dcterms:modified">${modified}</meta></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${manifest.join('\n')}</manifest>
<spine>${spine.join('\n')}</spine></package>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
}

export async function saveBookFile(file, name, type) {
  if (globalThis.SmartBotFiles) {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',', 2)[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return new Promise((resolve, reject) => {
      const bridge = globalThis.SmartBotFiles;
      bridge.onmessage = ({ data: result }) => {
        bridge.onmessage = null;
        if (result === 'saved' || result === 'cancelled') resolve(result === 'saved');
        else reject(new Error('Could not save the file.'));
      };
      bridge.postMessage(JSON.stringify({ name, type, data }));
    });
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
