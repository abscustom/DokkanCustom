import { findPattern, readU16BE, readU32BE, tagEquals } from './bytes.js';

const TAGS = {
  ALP: '@ALP',
  CRID: 'CRID',
  SFV: '@SFV',
  SFA: '@SFA',
  SBT: '@SBT',
  CUE: '@CUE',
};

const HEADER_END = new TextEncoder().encode('#HEADER END     ===============\0');
const METADATA_END = new TextEncoder().encode('#METADATA END   ===============\0');
const CONTENTS_END = new TextEncoder().encode('#CONTENTS END   ===============\0');

const KNOWN = new Set(Object.values(TAGS));

function stripMarkers(raw) {
  const headerEnd = findPattern(raw, HEADER_END);
  const metadataEnd = findPattern(raw, METADATA_END);
  const contentsEnd = findPattern(raw, CONTENTS_END);

  let headerSize = 0;
  if (metadataEnd !== -1 && (headerEnd === -1 || metadataEnd > headerEnd)) {
    headerSize = metadataEnd + 32;
  } else if (headerEnd !== -1) {
    headerSize = headerEnd + 32;
  }

  let end = raw.length;
  if (contentsEnd !== -1) {
    end = contentsEnd;
  }

  if (headerSize >= end) return raw.slice(0);
  return raw.slice(headerSize, end);
}

function detectAudioKind(data) {
  if (data.length >= 4) {
    if (tagEquals(data, 0, 'AIXF')) return 'aix';
    if (tagEquals(data, 0, 'HCA\0')) return 'hca';
    if (data[0] === 0x80 && data[1] === 0x00) return 'adx';
  }
  return 'bin';
}

export function demuxUsm(input) {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const cridOffset = findPattern(data, new TextEncoder().encode('CRID'));
  if (cridOffset < 0) {
    throw new Error('Not a USM file (missing CRID)');
  }

  const chunks = new Map();
  const kinds = new Map();

  let offset = cridOffset;
  while (offset + 8 <= data.length) {
    const tag =
      String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);

    if (!KNOWN.has(tag)) {
      break;
    }

    const blockSize = readU32BE(view, offset + 4);
    if (blockSize <= 0 || offset + 8 + blockSize > data.length) {
      throw new Error(`Invalid USM block size at 0x${offset.toString(16)}`);
    }

    const isVideo = tag === TAGS.SFV;
    const isAudio = tag === TAGS.SFA;

    if (isVideo || isAudio) {
      const headerSize = readU16BE(view, offset + 0x8);
      const footerSize = readU16BE(view, offset + 0xa);
      const cutSize = blockSize - headerSize - footerSize;

      let streamKey =
        (data[offset] |
          (data[offset + 1] << 8) |
          (data[offset + 2] << 16) |
          (data[offset + 3] << 24)) >>>
        0;
      if (isAudio) {
        const streamId = data[offset + 0xc];
        streamKey = (streamId | streamKey) >>> 0;
      }

      if (cutSize > 0) {
        const payloadStart = offset + 8 + headerSize;
        const payload = data.subarray(payloadStart, payloadStart + cutSize);
        if (!chunks.has(streamKey)) {
          chunks.set(streamKey, []);
          kinds.set(streamKey, isAudio ? 'audio' : 'video');
        }
        chunks.get(streamKey).push(payload);
      }
    }

    offset += 8 + blockSize;
  }

  let video = null;
  let audio = null;
  let audioKind = null;
  const streams = {};

  for (const [key, parts] of chunks) {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const merged = new Uint8Array(total);
    let o = 0;
    for (const p of parts) {
      merged.set(p, o);
      o += p.length;
    }
    const cleaned = stripMarkers(merged);
    const kind = kinds.get(key);
    streams[`0x${(key >>> 0).toString(16)}`] = {
      kind,
      rawBytes: merged.length,
      cleanedBytes: cleaned.length,
    };

    if (kind === 'video' && !video) {
      video = cleaned;
    } else if (kind === 'audio' && !audio) {
      audio = cleaned;
      audioKind = detectAudioKind(cleaned);
    }
  }

  return { video, audio, audioKind, streams };
}
