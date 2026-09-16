import { readU16LE, readU32LE, readU64LE } from './bytes.js';

export const IVF_HEADER_SIZE = 32;
export const IVF_FRAME_HEADER_SIZE = 12;

export function isIvf(data) {
  return data.length >= 4 && data[0] === 0x44 && data[1] === 0x4b && data[2] === 0x49 && data[3] === 0x46;
}

export function parseIvfHeader(data) {
  if (!isIvf(data) || data.length < IVF_HEADER_SIZE) {
    throw new Error('Not an IVF stream (expected DKIF after demux)');
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const headerLength = readU16LE(view, 6);
  const fourcc = String.fromCharCode(data[8], data[9], data[10], data[11]);
  return {
    version: readU16LE(view, 4),
    headerLength: headerLength || IVF_HEADER_SIZE,
    fourcc,
    width: readU16LE(view, 12),
    height: readU16LE(view, 14),
    framerateN: readU32LE(view, 16),
    framerateD: readU32LE(view, 20) || 1,
    frameCount: readU32LE(view, 24),
    unused: readU32LE(view, 28),
  };
}

export function isVp9(header) {
  return header.fourcc === 'VP90';
}

export function getFramerate(header) {
  return header.framerateN / header.framerateD;
}

export function inspectVp9Frame(frame) {
  if (frame.length < 2) {
    return { isKeyframe: false, profile: 0, bitDepth: 8 };
  }

  let bit = 0;
  const getBits = (n) => {
    let value = 0;
    for (let i = 0; i < n; i++) {
      const byteIndex = (bit / 8) | 0;
      const bitIndex = 7 - (bit % 8);
      const b = byteIndex < frame.length ? frame[byteIndex] : 0;
      value = (value << 1) | ((b >> bitIndex) & 1);
      bit++;
    }
    return value;
  };

  const marker = getBits(2);
  if (marker !== 0b10) {
    const heuristic = frame[0] === 0x49 && frame[1] === 0x83 && frame[2] === 0x42;
    return { isKeyframe: heuristic, profile: 0, bitDepth: 8 };
  }

  let profile = getBits(1);
  profile |= getBits(1) << 1;
  if (profile === 3) getBits(1);

  const showExisting = getBits(1);
  if (showExisting) {
    return { isKeyframe: false, profile, bitDepth: 8 };
  }

  const frameType = getBits(1);
  getBits(1);
  getBits(1);

  let bitDepth = 8;
  if (frameType === 0) {
    getBits(8);
    getBits(8);
    getBits(8);
    if (profile >= 2) {
      const tenOrTwelve = getBits(1);
      bitDepth = tenOrTwelve ? 12 : 10;
    }
  }

  return { isKeyframe: frameType === 0, profile, bitDepth };
}

export function extractIvfFrames(ivfData) {
  const header = parseIvfHeader(ivfData);
  if (!isVp9(header)) {
    throw new Error(`Unsupported IVF FourCC "${header.fourcc}" (need VP90)`);
  }

  let offset = header.headerLength;
  const view = new DataView(ivfData.buffer, ivfData.byteOffset, ivfData.byteLength);
  const frames = [];
  const declared = header.frameCount || 0xffffffff;

  while (offset + IVF_FRAME_HEADER_SIZE <= ivfData.length && frames.length < declared) {
    const frameSize = readU32LE(view, offset);
    const timestamp = readU64LE(view, offset + 4);
    offset += IVF_FRAME_HEADER_SIZE;
    if (frameSize <= 0 || offset + frameSize > ivfData.length) break;

    const data = ivfData.subarray(offset, offset + frameSize);
    offset += frameSize;

    const info = inspectVp9Frame(data);
    frames.push({
      data,
      timestamp,
      isKeyframe: frames.length === 0 ? true : info.isKeyframe,
      profile: info.profile,
      bitDepth: info.bitDepth,
    });
  }

  return { header, frames };
}
