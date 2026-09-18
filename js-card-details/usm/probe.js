export function probeVideoPayload(data) {
  if (!data || data.length < 4) {
    return { kind: 'empty', detail: 'no data' };
  }

  const hex = [...data.subarray(0, Math.min(32, data.length))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');

  if (data[0] === 0x44 && data[1] === 0x4b && data[2] === 0x49 && data[3] === 0x46) {
    const fourcc = String.fromCharCode(data[8], data[9], data[10], data[11]);
    const kind = fourcc === 'VP90' ? 'vp9-ivf' : (fourcc === 'AV01' ? 'av1-ivf' : 'ivf');
    return { kind, fourcc, hex };
  }

  const sc3 = data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01;
  const sc4 = data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x00 && data[3] === 0x01;
  if (sc3 || sc4) {
    const nalu = sc4 ? data[4] : data[3];
    if (nalu === 0xba) return { kind: 'mpeg-ps', hex };
    if (nalu === 0xb3) return { kind: 'mpeg2-video', hex };
    if (nalu === 0xb0) return { kind: 'mpeg2-video', hex };
    if ((nalu & 0x1f) >= 1 && (nalu & 0x1f) <= 12) {
      return { kind: sc4 ? 'h264-annexb' : 'mpeg-startcode', nalu, hex };
    }
    if ((nalu & 0x7e) >> 1 >= 0 && sc4 && (nalu & 0x7e) !== 0) {
      return { kind: 'hevc-annexb?', nalu, hex };
    }
    return { kind: 'mpeg-startcode', nalu, hex };
  }

  if (data.length >= 8) {
    const brand = String.fromCharCode(data[4], data[5], data[6], data[7]);
    if (brand === 'ftyp' || brand === 'moov' || brand === 'mdat') {
      return { kind: 'mp4', brand, hex };
    }
  }

  return { kind: 'unknown', hex };
}
