import { demuxUsm } from './usm-demux.js';
import { extractIvfFrames, getFramerate, isIvf } from './ivf.js';
import { muxVp9ToMp4, muxAv1ToMp4 } from './mp4-muxer.js';
import { decodeAdx, DEFAULT_ADX_KEY_ID } from './adx-decoder.js';
import { probeVideoPayload } from './probe.js';

export async function openUsm(bufferOrFile, log = () => {}, opts = {}) {
  const adxKey = opts.adxKey ?? DEFAULT_ADX_KEY_ID;
  const forceAdx = Boolean(opts.forceAdx);
  
  let buffer;
  if (bufferOrFile instanceof ArrayBuffer) {
    buffer = bufferOrFile;
  } else if (bufferOrFile instanceof Uint8Array) {
    buffer = bufferOrFile.buffer;
  } else if (bufferOrFile && typeof bufferOrFile.arrayBuffer === 'function') {
    buffer = await bufferOrFile.arrayBuffer();
  } else {
    throw new Error('Unsupported buffer input for USM');
  }

  log('Demuxing USM…');
  const demuxed = demuxUsm(buffer);
  log(`Streams: ${JSON.stringify(demuxed.streams)}`);

  if (!demuxed.video) {
    throw new Error('No video stream (@SFV) found in USM');
  }

  const probe = probeVideoPayload(demuxed.video);
  log(`Video probe: ${probe.kind}`);

  const isAv1Codec = probe.kind === 'av1-ivf';
  if (!isIvf(demuxed.video) || (!isAv1Codec && probe.kind !== 'vp9-ivf')) {
    throw new Error(`Video stream is not IVF/VP9/AV1 (${probe.kind})`);
  }

  log(`Parsing IVF / ${isAv1Codec ? 'AV1' : 'VP9'} frames…`);
  const { header, frames } = extractIvfFrames(demuxed.video);
  const fps = getFramerate(header) || 30;
  log(`${isAv1Codec ? 'AV1' : 'VP9'} ${header.width}x${header.height} @ ${fps.toFixed(3)} fps, ${frames.length} frames`);

  const key0 = frames[0];
  log(`Remuxing ${isAv1Codec ? 'AV1' : 'VP9'} → MP4 (in memory)…`);
  const mp4 = isAv1Codec ? muxAv1ToMp4({
    width: header.width,
    height: header.height,
    framerateN: header.framerateN || Math.round(fps),
    framerateD: header.framerateD || 1,
    frames,
  }) : muxVp9ToMp4({
    width: header.width,
    height: header.height,
    framerateN: header.framerateN || Math.round(fps),
    framerateD: header.framerateD || 1,
    profile: key0?.profile ?? 0,
    level: 10,
    bitDepth: key0?.bitDepth ?? 8,
    frames,
  });

  let audio = null;
  if (demuxed.audio && demuxed.audioKind === 'adx') {
    try {
      log(`Decoding ADX audio (key ${adxKey})…`);
      const decoded = decodeAdx(demuxed.audio, { keyId: adxKey, forceDecrypt: forceAdx });
      audio = {
        kind: 'adx',
        pcm: decoded.pcm,
        sampleRate: decoded.sampleRate,
        channels: decoded.channels,
      };
    } catch (err) {
      log(`Audio decode failed (${err.message}); continuing video-only`);
    }
  }

  const blob = new Blob([mp4], { type: 'video/mp4' });
  const videoUrl = URL.createObjectURL(blob);

  return {
    mp4,
    blob,
    videoUrl,
    audio,
    meta: {
      width: header.width,
      height: header.height,
      fps,
      frames: frames.length,
      audioKind: demuxed.audioKind,
      durationSec: frames.length / fps,
      path: isAv1Codec ? 'av1-native' : 'vp9-native',
      probe: probe.kind,
      adxKey,
    },
  };
}
