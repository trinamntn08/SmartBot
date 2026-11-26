const graphemes = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

export function pageStarts(text, fits) {
  const starts = [0];
  if (!text || fits(text)) return starts;

  const boundaries = [0];
  for (const part of graphemes?.segment(text) ?? text) {
    boundaries.push(boundaries.at(-1) + (part.segment ?? part).length);
  }

  let first = 0;
  while (first < boundaries.length - 1) {
    const start = boundaries[first];
    let low = first + 1;
    let high = boundaries.length - 1;
    // A single grapheme must make progress, even in a viewport shorter than a line.
    let last = low;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (fits(text.slice(start, boundaries[middle]))) {
        last = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    if (last === boundaries.length - 1) break;

    // Move a partial word to the next page when there is a usable break before it.
    if (/\S/.test(text[boundaries[last]])) {
      let wordStart = last;
      while (wordStart > first && /\S/.test(text[boundaries[wordStart] - 1])) wordStart -= 1;
      if (wordStart > first && /\S/.test(text.slice(start, boundaries[wordStart]))) last = wordStart;
    }
    first = last;
    starts.push(boundaries[first]);
  }
  return starts;
}
