export function readU16BE(view, offset) {
  return view.getUint16(offset, false);
}

export function readU16LE(view, offset) {
  return view.getUint16(offset, true);
}

export function readU32BE(view, offset) {
  return view.getUint32(offset, false);
}

export function readU32LE(view, offset) {
  return view.getUint32(offset, true);
}

export function readU64LE(view, offset) {
  const lo = view.getUint32(offset, true);
  const hi = view.getUint32(offset + 4, true);
  return hi * 0x100000000 + lo;
}

export function writeU16BE(buf, offset, value) {
  buf[offset] = (value >>> 8) & 0xff;
  buf[offset + 1] = value & 0xff;
}

export function writeU32BE(buf, offset, value) {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

export function concatUint8(...parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function findPattern(data, pattern, from = 0) {
  const end = data.length - pattern.length;
  outer: for (let i = from; i <= end; i++) {
    for (let j = 0; j < pattern.length; j++) {
      if (data[i + j] !== pattern[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export function tagEquals(data, offset, ascii) {
  if (offset + 4 > data.length) return false;
  return (
    data[offset] === ascii.charCodeAt(0) &&
    data[offset + 1] === ascii.charCodeAt(1) &&
    data[offset + 2] === ascii.charCodeAt(2) &&
    data[offset + 3] === ascii.charCodeAt(3)
  );
}
