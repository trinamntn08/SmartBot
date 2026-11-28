import { BookImportError, readingSections } from './text-book.js';

const pdfAssets = new URL('./vendor/pdfjs/', import.meta.url);

async function openPdf(file) {
  const { getDocument, GlobalWorkerOptions, PasswordResponses } = await import('./vendor/pdfjs/pdf.min.js');
  GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.js', pdfAssets).href;
  const task = getDocument({
    data: await file.arrayBuffer(),
    cMapUrl: new URL('cmaps/', pdfAssets).href,
    standardFontDataUrl: new URL('standard_fonts/', pdfAssets).href,
    useWasm: false,
    useSystemFonts: false,
    isEvalSupported: false,
  });
  return { task, PasswordResponses };
}

async function readPdfTitle(pdf) {
  const { metadata, info } = await pdf.getMetadata();
  for (const value of [metadata?.get('dc:title'), info.Title]) {
    const title = typeof value === 'string' && value.trim().replace(/\s+/g, ' ');
    if (title && !/^(?:untitled(?: book)?|unknown)$/i.test(title) && !/\.pdf$/i.test(title)) return title;
  }
}

export async function importPdf(file) {
  const header = await file.slice(0, 1024).text();
  if (!header.includes('%PDF-')) throw new BookImportError('This file is not a valid PDF.');

  let metadataTitle;
  try {
    const { task } = await openPdf(file);
    try { metadataTitle = await readPdfTitle(await task.promise); }
    finally { await task.destroy(); }
  } catch { /* Use the filename when the PDF title cannot be read. */ }

  return {
    title: file.name.slice(0, -4).trim() || 'Untitled book',
    metadataTitle,
    sections: [],
    original: file,
  };
}

function pageText(items) {
  const text = [];
  let previous;
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    if (item.str) {
      const lineHeight = Math.max(previous?.height || 0, item.height);
      const verticalGap = previous && Math.abs(previous.transform[5] - item.transform[5]);
      if (verticalGap > lineHeight * 1.5) {
        text.push('\n\n');
      } else if (previous?.hasEOL || verticalGap > lineHeight * 0.5) {
        text.push(' ');
      }
      text.push(item.str);
    }
    if (item.str || item.hasEOL) previous = item;
  }
  return text.join('').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

async function recognizePage(page, bridge) {
  // Bound the rendered page so memory use stays independent of the PDF's length.
  const original = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 2300 / Math.max(original.width, original.height) });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  try {
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const image = canvas.toDataURL('image/jpeg', 0.85).split(',', 2)[1];
    return await new Promise((resolve, reject) => {
      bridge.onmessage = ({ data }) => {
        bridge.onmessage = null;
        try {
          const text = JSON.parse(data);
          if (typeof text !== 'string') throw new Error('Text recognition failed');
          resolve(text.trim());
        } catch (error) {
          reject(error);
        }
      };
      try {
        bridge.postMessage(image);
      } catch (error) {
        bridge.onmessage = null;
        reject(error);
      }
    });
  } finally {
    canvas.width = canvas.height = 0;
  }
}

export async function convertPdf(file, onProgress = () => {}) {
  const { task, PasswordResponses } = await openPdf(file);

  try {
    const pdf = await task.promise;
    const sections = [];
    const pageEnds = {};
    let readablePages = 0;
    const ocr = globalThis.SmartBotBookOcr;
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      let text = pageText((await page.getTextContent()).items);
      if (!text && ocr) {
        onProgress(number, pdf.numPages);
        try {
          text = await recognizePage(page, ocr);
        } catch {
          throw new BookImportError(`Could not recognize text on page ${number}. Try converting the PDF again.`);
        }
      }
      if (text) {
        sections.push(...readingSections(text));
        pageEnds[sections.length - 1] = number;
        readablePages += 1;
      }
      page.cleanup();
    }
    if (!readablePages) {
      if (ocr) {
        throw new BookImportError('No readable text was found in this PDF.');
      }
      throw new BookImportError('This PDF has no selectable text. Run OCR on it, then import the resulting PDF.');
    }
    const metadataTitle = await readPdfTitle(pdf).catch(() => undefined);
    return { sections, pageEnds, skippedPages: pdf.numPages - readablePages, metadataTitle };
  } catch (error) {
    if (error.code === PasswordResponses.NEED_PASSWORD) {
      throw new BookImportError('Unlock this PDF before converting it.');
    }
    throw error;
  } finally {
    await task.destroy();
  }
}
