import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { LwfPackPlayer } from '../js-graphics/lwf-pack.js';

const source = readFileSync(new URL('../js-card-details/viewer-motion.js', import.meta.url), 'utf8');
function extract(name) {
    const start = source.indexOf(`    function ${name}(`);
    const end = source.indexOf('\n    }', start) + 6;
    assert.ok(start >= 0 && end > start);
    return source.slice(start, end);
}

const entry = 'c21_rich_entry_back_p';
const powerUp = 'c16_heapup_back_p';
const idle = 'c22_rich_idl_back_p';
function harness() {
    const calls = [];
    const player = Object.create(LwfPackPlayer.prototype);
    const context = vm.createContext({
        activePlayer: player, sequenceRunId: 0,
        updateMotionClipDisplay() {}, setStatus() {},
        startIdleMovie(p, clip, options) {
            calls.push(clip);
            p.movie = { totalFrames: 10, currentFrame: 10, playing: true,
                gotoAndPlay(frame) { this.currentFrame = frame; } };
            p.loopMovie = options.loop;
            p.loopEndFrame = options.loop ? 0 : 10;
            p._logicalFrame = 10;
            p.onEnded = options.onEnded;
            p.getRecordFrameCount = () => 10;
            p.playing = true;
            return true;
        },
    });
    vm.runInContext(['isPlayableMotionMovie', 'idleSequence', 'firstMotionMovie', 'startIdleSequence'].map(extract).join('\n'), context);
    return { context, player, calls };
}

test('rich linkages play entry and power-up once, then keep looping final idle', () => {
    const { context, player, calls } = harness();
    const sequence = context.idleSequence([idle, '_empty', powerUp, entry, idle, 'c02_idl_back_p']);
    assert.deepEqual(Array.from(sequence), [entry, powerUp, idle]);
    assert.equal(context.startIdleSequence(player, sequence), true);
    player._checkEnd();
    player._checkEnd();
    assert.deepEqual(calls, [entry, powerUp, idle]);
    for (let i = 0; i < 3; i++) {
        player.movie.currentFrame = 10;
        player._checkEnd();
        assert.equal(player.movie.currentFrame, 1);
        assert.equal(player.playing, true);
    }
    assert.deepEqual(calls, [entry, powerUp, idle]);
});

test('basic packs keep single-clip fallback; two-part rich packs still transition', () => {
    const { context } = harness();
    assert.deepEqual(Array.from(context.idleSequence(['c02_idl_back_p'])), []);
    assert.deepEqual(Array.from(context.idleSequence([idle, entry])), [entry, idle]);
    assert.deepEqual(Array.from(context.idleSequence([powerUp, idle])), []);
});

test('characters without an idle clip fall back to the first movie (movie 0)', () => {
    const { context } = harness();
    assert.equal(context.firstMotionMovie([], []), null);
    assert.equal(context.firstMotionMovie(['_empty', 'c01_atk_back_p'], []), '_empty');
    assert.equal(context.firstMotionMovie([], ['c03_sup_back_p']), 'c03_sup_back_p');
    assert.equal(context.firstMotionMovie(['c01_atk_back_p', 'c01_atk_back_p'], ['c01_atk_back_p']), 'c01_atk_back_p');
});

test('switching cards invalidates an old sequence completion callback', () => {
    const { context, player, calls } = harness();
    context.startIdleSequence(player, [entry, powerUp, idle]);
    context.activePlayer = {};
    player._checkEnd();
    assert.deepEqual(calls, [entry]);
});
