import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../js/release-time.js', import.meta.url), 'utf8');
const window = {};
vm.runInNewContext(source, { window, Date, Intl, Number, String, Array, RegExp, Math });

test('zone-less official database timestamps are UTC in winter and summer', () => {
    assert.equal(window.parseReleaseTimestamp('2026-01-09 06:00:00'), Date.parse('2026-01-09T06:00:00Z'));
    assert.equal(window.parseReleaseTimestamp('2026-06-17 05:00:00'), Date.parse('2026-06-17T05:00:00Z'));
    assert.equal(window.formatReleaseDateTime(window.parseReleaseTimestamp('2026-01-09 06:00:00')).timeOnly, '01:00 EST');
    assert.equal(window.formatReleaseDateTime(window.parseReleaseTimestamp('2026-06-17 05:00:00')).timeOnly, '01:00 EDT');
});

test('Eastern release formatting changes labels and clocks at the daylight-saving boundary', () => {
    const before = window.formatReleaseDateTime(Date.parse('2026-03-08T06:59:00Z'));
    const after = window.formatReleaseDateTime(Date.parse('2026-03-08T07:00:00Z'));
    assert.equal(before.timeOnly, '01:59 EST');
    assert.equal(after.timeOnly, '03:00 EDT');
});

test('custom-card local dates and explicit EST/EDT timestamps remain supported', () => {
    assert.equal(
        window.parseReleaseTimestamp('9/14/2026 1:00:00 AM EDT', { zoneLess: 'local' }),
        Date.parse('2026-09-14T05:00:00Z')
    );
    assert.equal(
        window.parseReleaseTimestamp('2026-09-14 01:00:00', { zoneLess: 'local' }),
        new Date(2026, 8, 14, 1, 0, 0).getTime()
    );
    assert.equal(window.formatReleaseDateLabel('2026-03-08'), 'March 8, 2026');
});
