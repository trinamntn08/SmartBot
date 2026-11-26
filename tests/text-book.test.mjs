import assert from 'node:assert/strict';
import test from 'node:test';
import { readTextBook } from '../web/text-book.js';

test('imports UTF-8 text and keeps paragraph breaks and indentation', async () => {
  const file = new File(['  Première page\r\n\r\n続き'], 'My Book.TXT');
  assert.deepEqual(await readTextBook(file), {
    title: 'My Book',
    fileName: 'My Book.TXT',
    sections: ['  Première page\n\n続き'],
  });
});

test('accepts UTF-16 text with a byte order mark', async () => {
  const file = new File([new Uint8Array([0xFF, 0xFE, 0xE9, 0x00])], 'Accent.txt');
  assert.deepEqual((await readTextBook(file)).sections, ['é']);
});

test('splits long text without changing it or dividing a Unicode character', async () => {
  const text = '日'.repeat(4999) + '📖' + '文'.repeat(5000);
  const { sections } = await readTextBook(new File([text], 'Long.txt'));
  assert.equal(sections.join(''), text);
  assert.equal(sections[0].length, 4999);
  assert.ok(sections[1].startsWith('📖'));
});

test('rejects unsupported, empty, and undecodable files', async () => {
  await assert.rejects(readTextBook(new File(['hello'], 'Book.pdf')), /Choose a plain text/);
  await assert.rejects(readTextBook(new File(['  \r\n'], 'Empty.txt')), /file is empty/);
  await assert.rejects(readTextBook(new File([new Uint8Array([0x80])], 'Invalid.txt')), /UTF-8/);
});
