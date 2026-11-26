import assert from 'node:assert/strict';
import test from 'node:test';
import { pageStarts } from '../web/book-pagination.js';

function pages(text, fits) {
  const starts = pageStarts(text, fits);
  return starts.map((start, index) => text.slice(start, starts[index + 1]));
}

test('keeps a short section on one page', () => {
  assert.deepEqual(pageStarts('Short section', () => true), [0]);
  assert.deepEqual(pageStarts('', () => false), [0]);
});

test('moves a partial word to the next page and retains all whitespace', () => {
  const text = 'Alpha beta\n\ngamma';
  const result = pages(text, (part) => part.length <= 8);
  assert.deepEqual(result, ['Alpha ', 'beta\n\n', 'gamma']);
  assert.equal(result.join(''), text);
});

test('breaks long unspaced text without splitting graphemes', () => {
  const text = '👩🏽‍💻日本語e\u0301';
  const result = pages(text, (part) => part.length <= 2);
  assert.deepEqual(result, ['👩🏽‍💻', '日本', '語', 'e\u0301']);
  assert.equal(result.join(''), text);
});
