import { decompressZstd, parquetMetadataAsync, parquetReadObjects } from './vendor/market-parquet/parquet.js';
import { hasCandle } from './market-provider.js';

const maxRange = 2 * 1024 * 1024;
const maxTransfer = 6 * 1024 * 1024;
const dayLength = 86400000;

async function openArchive(signal) {
  let version;
  let byteLength;
  let transferred = 0;

  async function readRange(start, end) {
    const length = end - start;
    transferred += length;
    if (transferred > maxTransfer) throw new Error('The market archive needs too much data to refresh.');
    const query = new URLSearchParams({ start, end: end - 1 });
    const result = await fetch(`./api/markets/archive?${query}`, {
      signal, cache: 'no-store', headers: { 'X-SmartBot-Market': 'daily' },
    });
    const match = /^bytes ([0-9]+)-([0-9]+)\/([0-9]{1,9})$/.exec(result.headers.get('Content-Range') ?? '');
    const etag = result.headers.get('ETag');
    if (result.status !== 206 || !match || !etag || Number(match[1]) !== start || Number(match[2]) !== end - 1) {
      await result.body?.cancel();
      throw new Error('The market archive did not return the requested range.');
    }
    const reportedLength = Number(match[3]);
    if (version && (version !== etag || byteLength !== reportedLength)) {
      await result.body?.cancel();
      throw new Error('The market archive changed during refresh.');
    }
    version = etag;
    byteLength = reportedLength;
    const bytes = await result.arrayBuffer();
    if (bytes.byteLength !== length) throw new Error('Incomplete market archive range.');
    return bytes;
  }

  // Read the file size and revision without downloading the full archive.
  await readRange(0, 1);
  return {
    byteLength,
    async slice(start, end) {
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end > byteLength || start >= end
        || end - start > maxTransfer - transferred) {
        throw new Error('Invalid market archive range.');
      }
      if (end - start <= maxRange) return readRange(start, end);
      const bytes = new Uint8Array(end - start);
      for (let offset = start; offset < end; offset += maxRange) {
        const chunk = await readRange(offset, Math.min(offset + maxRange, end));
        bytes.set(new Uint8Array(chunk), offset - start);
      }
      return bytes.buffer;
    },
  };
}

export async function archivePrices(symbol, signal) {
  const file = await openArchive(signal);
  const metadata = await parquetMetadataAsync(file, { initialFetchSize: 256 * 1024 });
  // The archive is sorted by ticker. The reader skips unrelated row groups.
  const rows = await parquetReadObjects({
    file, metadata, columns: ['date', 'open', 'high', 'low', 'close'], filter: { ticker: { $eq: symbol } },
    compressors: { ZSTD: input => decompressZstd(input) },
  });
  const valid = rows.filter(({ date, close }) => date instanceof Date && Number.isFinite(date.getTime())
    && typeof close === 'number' && close > 0 && close <= 1e9);
  valid.sort((a, b) => a.date - b.date);
  const latest = valid.at(-1)?.date.getTime();
  return valid.filter(({ date }) => date.getTime() >= latest - 400 * dayLength).slice(-280)
    .map(({ date, open, high, low, close }) => {
      const price = { date: date.toISOString().slice(0, 10), close: Math.round(close * 100) / 100 };
      if (hasCandle({ open, high, low, close })) {
        price.open = Math.round(open * 100) / 100;
        price.high = Math.round(high * 100) / 100;
        price.low = Math.round(low * 100) / 100;
      }
      return price;
    });
}
