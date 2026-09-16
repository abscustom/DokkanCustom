import { readU16BE, readU32BE } from './bytes.js';

export const ADX_KEYS = Object.freeze([
  { start: 0x49e1, mult: 0x4a57, add: 0x553d, type9: false, name: 'Clover Studio' },
  { start: 0x5f5d, mult: 0x58bd, add: 0x55ed, type9: false, name: 'Grasshopper Manufacture 0' },
  { start: 0x50fb, mult: 0x5803, add: 0x5701, type9: false, name: 'Grasshopper Manufacture 1' },
  { start: 0x4f3f, mult: 0x472f, add: 0x562f, type9: false, name: 'Grasshopper Manufacture 2' },
  { start: 0x66f5, mult: 0x58bd, add: 0x4459, type9: false, name: 'Moss Ltd' },
  { start: 0x5deb, mult: 0x5f27, add: 0x673f, type9: false, name: 'Sonic Team 0' },
  { start: 0x46d3, mult: 0x5ced, add: 0x474d, type9: false, name: 'G.dev' },
  { start: 0x440b, mult: 0x6539, add: 0x5723, type9: false, name: 'Sonic Team 1' },
  { start: 0x07d2, mult: 0x1ec5, add: 0x0c7f, type9: true, name: 'Phantasy Star Online 2' },
  { start: 0x0003, mult: 0x0d19, add: 0x043b, type9: true, name: 'Dragon Ball Z: Dokkan Battle' },
]);

export const DEFAULT_ADX_KEY_ID = 9;

export function isEncryptedAdxFlag(flag) {
  return flag === 8 || flag === 9;
}

export function findAdxHeader(data, startOffset = 0) {
  const limit = Math.min(data.length - 5, startOffset + 2048);
  for (let i = startOffset; i < limit; i++) {
    if (data[i] !== 0x80 || data[i + 1] !== 0x00) continue;
    const copyOff = (data[i + 2] << 8) | data[i + 3];
    const cPos = i + copyOff;
    if (cPos + 4 <= data.length && data[cPos] === 0x28 && data[cPos + 1] === 0x63) {
      return i;
    }
    if (data.length >= i + 16) {
      const channels = data[i + 7];
      const rate = (data[i + 8] << 24) | (data[i + 9] << 16) | (data[i + 10] << 8) | data[i + 11];
      if (channels >= 1 && channels <= 8 && rate >= 8000 && rate <= 96000) {
        return i;
      }
    }
  }
  return -1;
}

export function parseAdxHeader(data) {
  if (data.length < 20 || data[0] !== 0x80 || data[1] !== 0x00) {
    throw new Error('Not ADX');
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const copyrightOffset = readU16BE(view, 2);
  const encoding = data[4];
  const blockSize = data[5];
  const sampleBits = data[6];
  const channels = data[7];
  const sampleRate = readU32BE(view, 8);
  const sampleCount = readU32BE(view, 12);
  const highpass = readU16BE(view, 16);
  const version = data[0x12];
  const encFlag = data[0x13];

  let coef1 = 0;
  let coef2 = 0;
  if (highpass > 0 && sampleRate > 0) {
    const a = Math.SQRT2 - Math.cos((2 * Math.PI * highpass) / sampleRate);
    const b = Math.SQRT2 - 1;
    const c = (a - Math.sqrt((a + b) * (a - b))) / b;
    coef1 = 2 * c;
    coef2 = -c * c;
  }

  return {
    copyrightOffset,
    encoding,
    blockSize: blockSize || 18,
    sampleBits: sampleBits || 4,
    channels,
    sampleRate,
    sampleCount,
    highpass,
    version,
    encFlag,
    encrypted: isEncryptedAdxFlag(encFlag),
    dataOffset: copyrightOffset + 4,
    coef1,
    coef2,
  };
}

export function applyAdxCipher(buf, keyId = DEFAULT_ADX_KEY_ID, opts = {}) {
  if (keyId < 0 || keyId >= ADX_KEYS.length) {
    throw new Error(`Invalid ADX key ID ${keyId}`);
  }
  if (buf.length < 24) throw new Error('ADX buffer too small');

  const key = ADX_KEYS[keyId];
  const encrypt = Boolean(opts.encrypt);
  const encFlag = buf[0x13];

  if (!opts.force) {
    if (encrypt && isEncryptedAdxFlag(encFlag)) {
      return { changed: false, keyId, keyName: key.name, reason: 'already encrypted' };
    }
    if (!encrypt && !isEncryptedAdxFlag(encFlag)) {
      return { changed: false, keyId, keyName: key.name, reason: 'not encrypted' };
    }
  }

  const startOff = ((buf[2] << 8) | buf[3]) + 4;
  const channels = buf[7];
  const totalSamples = (buf[12] << 24) | (buf[13] << 16) | (buf[14] << 8) | buf[15];
  const blocks = Math.ceil(totalSamples / 32);
  let endOff = blocks * 18 * channels + startOff;
  if (endOff > buf.length) endOff = buf.length;

  const mask = key.type9 ? 0x1fff : 0x7fff;
  let xorVal = key.start;

  for (let off = startOff; off <= endOff - 18; off += 18) {
    let val = (buf[off] << 8) | buf[off + 1];
    val = (val ^ xorVal) & mask;
    buf[off] = (val >> 8) & 0xff;
    buf[off + 1] = val & 0xff;
    xorVal = (xorVal * key.mult + key.add) & 0x7fff;
  }

  buf[0x13] = encrypt ? 8 : 0;
  return { changed: true, keyId, keyName: key.name };
}

export function decryptAdx(adxData, keyId = DEFAULT_ADX_KEY_ID, opts = {}) {
  const offset = findAdxHeader(adxData, 0);
  if (offset < 0) throw new Error('ADX header not found');
  const out = adxData.slice(offset);
  const result = applyAdxCipher(out, keyId, { encrypt: false, force: opts.force });
  return { data: out, ...result };
}

function decodeFrame(frame, hist, coef1, coef2, samplesOut, channelStride, channelIndex) {
  const scale = (frame[0] << 8) | frame[1];
  let hist1 = hist[0];
  let hist2 = hist[1];
  const samples = (frame.length - 2) * 2;

  for (let s = 0; s < samples; s++) {
    const byte = frame[2 + (s >> 1)];
    let nibble = s & 1 ? byte & 0x0f : byte >> 4;
    if (nibble >= 8) nibble -= 16;

    let sample = Math.round(nibble * scale + coef1 * hist1 + coef2 * hist2);
    if (sample > 32767) sample = 32767;
    if (sample < -32768) sample = -32768;

    samplesOut[s * channelStride + channelIndex] = sample;
    hist2 = hist1;
    hist1 = sample;
  }
  hist[0] = hist1;
  hist[1] = hist2;
  return samples;
}

export function decodeAdx(adxData, opts = {}) {
  const keyId = opts.keyId ?? DEFAULT_ADX_KEY_ID;
  const { data, changed, keyName, reason } = decryptAdx(adxData, keyId, {
    force: opts.forceDecrypt,
  });
  const header = parseAdxHeader(data);

  if (header.channels < 1 || header.channels > 8) {
    throw new Error(`Bad ADX channel count: ${header.channels}`);
  }
  if (header.sampleBits !== 4) {
    throw new Error(`Unsupported ADX sample bits: ${header.sampleBits}`);
  }

  const blockSize = header.blockSize;
  const frameBytes = blockSize;
  const samplesPerChannel = (blockSize - 2) * 2;
  const pcm = new Int16Array(Math.max(header.sampleCount, 1) * header.channels);
  const hist = Array.from({ length: header.channels }, () => [0, 0]);

  let src = header.dataOffset;
  let written = 0;

  while (src + frameBytes * header.channels <= data.length && written < header.sampleCount) {
    for (let ch = 0; ch < header.channels; ch++) {
      const frame = data.subarray(src + ch * frameBytes, src + (ch + 1) * frameBytes);
      decodeFrame(
        frame,
        hist[ch],
        header.coef1,
        header.coef2,
        pcm.subarray(written * header.channels),
        header.channels,
        ch,
      );
    }
    written += samplesPerChannel;
    src += frameBytes * header.channels;
  }

  return {
    pcm: pcm.subarray(0, Math.min(written, header.sampleCount) * header.channels),
    sampleRate: header.sampleRate,
    channels: header.channels,
    header,
    decrypt: { changed, keyId, keyName, reason },
  };
}
