import { writeU16BE, writeU32BE } from './bytes.js';

function box(type, ...parts) {
  let payloadLen = 0;
  for (const p of parts) payloadLen += p.length;
  const out = new Uint8Array(8 + payloadLen);
  writeU32BE(out, 0, out.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  let o = 8;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function fullBox(type, version, flags, ...parts) {
  const header = new Uint8Array(4);
  header[0] = version;
  header[1] = (flags >>> 16) & 0xff;
  header[2] = (flags >>> 8) & 0xff;
  header[3] = flags & 0xff;
  return box(type, header, ...parts);
}

function u32(v) {
  const b = new Uint8Array(4);
  writeU32BE(b, 0, v >>> 0);
  return b;
}

function u16(v) {
  const b = new Uint8Array(2);
  writeU16BE(b, 0, v & 0xffff);
  return b;
}

function zeros(n) {
  return new Uint8Array(n);
}

function ascii(s) {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

function identityMatrix() {
  const m = new Uint8Array(36);
  writeU32BE(m, 0, 0x00010000);
  writeU32BE(m, 16, 0x00010000);
  writeU32BE(m, 32, 0x40000000);
  return m;
}

export function muxVp9ToMp4(opts) {
  const timescale = opts.timescale || 1000;
  const framerateN = opts.framerateN || 30;
  const framerateD = opts.framerateD || 1;
  const frameDuration = Math.max(1, Math.round((timescale * framerateD) / framerateN));
  const frames = opts.frames;
  if (!frames.length) throw new Error('No frames to mux');

  const profile = opts.profile ?? 0;
  const level = opts.level ?? 10;
  const bitDepth = opts.bitDepth ?? 8;
  const chroma = opts.chromaSubsampling ?? 1;
  const fullRange = opts.fullRange ?? 0;

  const sampleSizes = frames.map((f) => f.data.length);
  const videoBytes = sampleSizes.reduce((a, b) => a + b, 0);
  const duration = frames.length * frameDuration;

  const ftyp = box(
    'ftyp',
    ascii('isom'),
    u32(0),
    ascii('isom'),
    ascii('iso2'),
    ascii('mp41'),
    ascii('vp09'),
  );

  const mdatPayload = new Uint8Array(videoBytes);
  let mdatOffset = 0;
  for (const f of frames) {
    mdatPayload.set(f.data, mdatOffset);
    mdatOffset += f.data.length;
  }
  const mdat = box('mdat', mdatPayload);
  const mdatDataStart = ftyp.length + 8;

  const vpcC = fullBox(
    'vpcC',
    1,
    0,
    Uint8Array.of(
      profile & 0xff,
      level & 0xff,
      ((bitDepth & 0x0f) << 4) | ((chroma & 0x07) << 1) | (fullRange & 0x01),
      1,
      1,
      1,
    ),
    u16(0),
  );

  const vp09 = box(
    'vp09',
    zeros(6),
    u16(1),
    zeros(16),
    u16(opts.width),
    u16(opts.height),
    u32(0x00480000),
    u32(0x00480000),
    u32(0),
    u16(1),
    zeros(32),
    u16(0x0018),
    u16(0xffff),
    vpcC,
  );

  const stsd = fullBox('stsd', 0, 0, u32(1), vp09);
  const stts = fullBox('stts', 0, 0, u32(1), u32(frames.length), u32(frameDuration));
  const stsc = fullBox('stsc', 0, 0, u32(1), u32(1), u32(frames.length), u32(1));

  const stszEntries = new Uint8Array(frames.length * 4);
  for (let i = 0; i < frames.length; i++) writeU32BE(stszEntries, i * 4, sampleSizes[i]);
  const stsz = fullBox('stsz', 0, 0, u32(0), u32(frames.length), stszEntries);

  const stco = fullBox('stco', 0, 0, u32(1), u32(mdatDataStart));

  const keyIndices = [];
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].isKeyframe) keyIndices.push(i + 1);
  }
  if (!keyIndices.length) keyIndices.push(1);
  const stssEntries = new Uint8Array(keyIndices.length * 4);
  for (let i = 0; i < keyIndices.length; i++) writeU32BE(stssEntries, i * 4, keyIndices[i]);
  const stss = fullBox('stss', 0, 0, u32(keyIndices.length), stssEntries);

  const stbl = box('stbl', stsd, stts, stsc, stsz, stco, stss);

  const url = fullBox('url ', 0, 1);
  const dref = fullBox('dref', 0, 0, u32(1), url);
  const dinf = box('dinf', dref);
  const vmhd = fullBox('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0));
  const minf = box('minf', vmhd, dinf, stbl);

  const mdhd = fullBox('mdhd', 0, 0, u32(0), u32(0), u32(timescale), u32(duration), u16(0x55c4), u16(0));
  const hdlr = fullBox(
    'hdlr',
    0,
    0,
    u32(0),
    ascii('vide'),
    zeros(12),
    ascii('VideoHandler\0'),
  );
  const mdia = box('mdia', mdhd, hdlr, minf);

  const tkhd = fullBox(
    'tkhd',
    0,
    3,
    u32(0),
    u32(0),
    u32(1),
    u32(0),
    u32(duration),
    zeros(8),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    identityMatrix(),
    u32(opts.width << 16),
    u32(opts.height << 16),
  );
  const trak = box('trak', tkhd, mdia);

  const mvhd = fullBox(
    'mvhd',
    0,
    0,
    u32(0),
    u32(0),
    u32(timescale),
    u32(duration),
    u32(0x00010000),
    u16(0x0100),
    u16(0),
    zeros(8),
    identityMatrix(),
    zeros(24),
    u32(2),
  );

  const moov = box('moov', mvhd, trak);

  const out = new Uint8Array(ftyp.length + mdat.length + moov.length);
  out.set(ftyp, 0);
  out.set(mdat, ftyp.length);
  out.set(moov, ftyp.length + mdat.length);
  return out;
}

function extractSequenceHeaderOBU(frameData) {
  let p = 0;
  while (p < frameData.length) {
    const start = p;
    const b = frameData[p++];
    const obuType = (b >> 3) & 0x0f;
    const hasExt = (b >> 2) & 0x01;
    const hasSize = (b >> 1) & 0x01;
    if (hasExt) p++;
    let size = 0;
    if (hasSize) {
      let s = 0;
      for (let i = 0; i < 8; i++) {
        const lb = frameData[p++];
        size |= (lb & 0x7f) << s;
        if ((lb & 0x80) === 0) break;
        s += 7;
      }
    } else {
      size = frameData.length - p;
    }
    if (obuType === 1) { // OBU_SEQUENCE_HEADER
      return frameData.subarray(start, p + size);
    }
    p += size;
  }
  return null;
}

export function muxAv1ToMp4(opts) {
  const timescale = opts.timescale || 1000;
  const framerateN = opts.framerateN || 30;
  const framerateD = opts.framerateD || 1;
  const frameDuration = Math.max(1, Math.round((timescale * framerateD) / framerateN));
  const frames = opts.frames;
  if (!frames.length) throw new Error('No frames to mux');

  const sampleSizes = frames.map((f) => f.data.length);
  const videoBytes = sampleSizes.reduce((a, b) => a + b, 0);
  const duration = frames.length * frameDuration;

  const ftyp = box(
    'ftyp',
    ascii('isom'),
    u32(0),
    ascii('isom'),
    ascii('iso2'),
    ascii('mp41'),
    ascii('av01'),
  );

  const mdatPayload = new Uint8Array(videoBytes);
  let mdatOffset = 0;
  for (const f of frames) {
    mdatPayload.set(f.data, mdatOffset);
    mdatOffset += f.data.length;
  }
  const mdat = box('mdat', mdatPayload);
  const mdatDataStart = ftyp.length + 8;

  let seqHeaderOBU = null;
  for (const f of frames) {
    seqHeaderOBU = extractSequenceHeaderOBU(f.data);
    if (seqHeaderOBU) break;
  }

  const av1CRecord = new Uint8Array(4 + (seqHeaderOBU ? seqHeaderOBU.length : 0));
  av1CRecord[0] = 0x81;
  av1CRecord[1] = (0 << 5) | (10 & 0x1f);
  av1CRecord[2] = (0 << 7) | (0 << 6) | (0 << 5) | (0 << 4) | (1 << 3) | (1 << 2) | 0;
  av1CRecord[3] = 0x00;
  if (seqHeaderOBU) av1CRecord.set(seqHeaderOBU, 4);

  const av1C = box('av1C', av1CRecord);

  const av01 = box(
    'av01',
    zeros(6),
    u16(1),
    zeros(16),
    u16(opts.width),
    u16(opts.height),
    u32(0x00480000),
    u32(0x00480000),
    u32(0),
    u16(1),
    zeros(32),
    u16(0x0018),
    u16(0xffff),
    av1C,
  );

  const stsd = fullBox('stsd', 0, 0, u32(1), av01);
  const stts = fullBox('stts', 0, 0, u32(1), u32(frames.length), u32(frameDuration));
  const stsc = fullBox('stsc', 0, 0, u32(1), u32(1), u32(frames.length), u32(1));

  const stszEntries = new Uint8Array(frames.length * 4);
  for (let i = 0; i < frames.length; i++) writeU32BE(stszEntries, i * 4, sampleSizes[i]);
  const stsz = fullBox('stsz', 0, 0, u32(0), u32(frames.length), stszEntries);

  const stco = fullBox('stco', 0, 0, u32(1), u32(mdatDataStart));

  const keyIndices = [];
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].isKeyframe) keyIndices.push(i + 1);
  }
  if (!keyIndices.length) keyIndices.push(1);
  const stssEntries = new Uint8Array(keyIndices.length * 4);
  for (let i = 0; i < keyIndices.length; i++) writeU32BE(stssEntries, i * 4, keyIndices[i]);
  const stss = fullBox('stss', 0, 0, u32(keyIndices.length), stssEntries);

  const stbl = box('stbl', stsd, stts, stsc, stsz, stco, stss);

  const url = fullBox('url ', 0, 1);
  const dref = fullBox('dref', 0, 0, u32(1), url);
  const dinf = box('dinf', dref);
  const vmhd = fullBox('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0));
  const minf = box('minf', vmhd, dinf, stbl);

  const mdhd = fullBox('mdhd', 0, 0, u32(0), u32(0), u32(timescale), u32(duration), u16(0x55c4), u16(0));
  const hdlr = fullBox(
    'hdlr',
    0,
    0,
    u32(0),
    ascii('vide'),
    zeros(12),
    ascii('VideoHandler\0'),
  );
  const mdia = box('mdia', mdhd, hdlr, minf);

  const tkhd = fullBox(
    'tkhd',
    0,
    3,
    u32(0),
    u32(0),
    u32(1),
    u32(0),
    u32(duration),
    zeros(8),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    identityMatrix(),
    u32(opts.width << 16),
    u32(opts.height << 16),
  );
  const trak = box('trak', tkhd, mdia);

  const mvhd = fullBox(
    'mvhd',
    0,
    0,
    u32(0),
    u32(0),
    u32(timescale),
    u32(duration),
    u32(0x00010000),
    u16(0x0100),
    u16(0),
    zeros(8),
    identityMatrix(),
    zeros(24),
    u32(2),
  );

  const moov = box('moov', mvhd, trak);

  const out = new Uint8Array(ftyp.length + mdat.length + moov.length);
  out.set(ftyp, 0);
  out.set(mdat, ftyp.length);
  out.set(moov, ftyp.length + mdat.length);
  return out;
}
