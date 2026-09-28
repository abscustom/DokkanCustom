/* Shared, timezone-aware parsing and formatting for official release times. */
(function attachReleaseTime(global) {
    'use strict';

    const MIN_RELEASE_TIME = Date.UTC(2015, 0, 30, 0, 0, 0);
    const ZONE_OFFSETS = { UTC: '+00:00', GMT: '+00:00', EST: '-05:00', EDT: '-04:00' };

    function validParts(year, month, day, hour, minute, second, millisecond) {
        const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day && date.getUTCHours() === hour &&
            date.getUTCMinutes() === minute && date.getUTCSeconds() === second;
    }

    function localTimestamp(year, month, day, hour, minute, second, millisecond) {
        if (!validParts(year, month, day, hour, minute, second, millisecond)) return 0;
        const date = new Date(year, month - 1, day, hour, minute, second, millisecond);
        return date.getTime();
    }

    function parseReleaseTimestamp(value, options = {}) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            const timestamp = value > 0 && value < 100000000000 ? value * 1000 : value;
            return timestamp >= MIN_RELEASE_TIME ? timestamp : 0;
        }
        if (value instanceof Date) {
            const timestamp = value.getTime();
            return Number.isFinite(timestamp) && timestamp >= MIN_RELEASE_TIME ? timestamp : 0;
        }

        const raw = String(value || '').replace(/\u00a0/g, ' ').trim();
        if (!raw || /^tbd$/i.test(raw)) return 0;
        const zoneLess = options.zoneLess === 'local' ? 'local' : 'utc';
        const iso = raw.match(/\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?\s*(Z|UTC|GMT|EST|EDT|[+-]\d{2}:?\d{2})?)?/i);

        if (iso) {
            const [, yearText, monthText, dayText, hourText, minuteText, secondText, millisText, zoneText] = iso;
            const year = Number(yearText), month = Number(monthText), day = Number(dayText);
            const hasTime = hourText !== undefined;
            const dateOnlyHour = hasTime ? Number(hourText) : 12;
            const minute = hasTime ? Number(minuteText) : 0;
            const second = hasTime ? Number(secondText || 0) : 0;
            const millisecond = Number(String(millisText || '').padEnd(3, '0')) || 0;
            if (dateOnlyHour > 23 || minute > 59 || second > 59 ||
                !validParts(year, month, day, dateOnlyHour, minute, second, millisecond)) return 0;

            if (zoneLess === 'local' && !zoneText) {
                const timestamp = localTimestamp(year, month, day, dateOnlyHour, minute, second, millisecond);
                return timestamp >= MIN_RELEASE_TIME ? timestamp : 0;
            }

            let normalizedZone = zoneText || '+00:00';
            if (/^(?:Z|UTC|GMT|EST|EDT)$/i.test(normalizedZone)) {
                normalizedZone = ZONE_OFFSETS[normalizedZone.toUpperCase()];
            } else if (/^[+-]\d{4}$/.test(normalizedZone)) {
                normalizedZone = `${normalizedZone.slice(0, 3)}:${normalizedZone.slice(3)}`;
            }
            const isoText = `${yearText.padStart(4, '0')}-${monthText.padStart(2, '0')}-${dayText.padStart(2, '0')}T${String(dateOnlyHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.${String(millisecond).padStart(3, '0')}${normalizedZone}`;
            const timestamp = Date.parse(isoText);
            return Number.isFinite(timestamp) && timestamp >= MIN_RELEASE_TIME ? timestamp : 0;
        }

        // Keep accepting custom-card dates entered as US-local text, including
        // common explicit EST/EDT suffixes that Date.parse handles unevenly.
        const usDate = raw.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM))?(?:\s*(EST|EDT|UTC|GMT))?\b/i);
        let timestamp = 0;
        if (usDate) {
            const [, monthText, dayText, yearText, hourText, minuteText, secondText, meridiem, zoneText] = usDate;
            const year = Number(yearText), month = Number(monthText), day = Number(dayText);
            let hour = hourText === undefined ? 12 : Number(hourText) % 12;
            if (hourText !== undefined && String(meridiem).toUpperCase() === 'PM') hour += 12;
            const minute = Number(minuteText || 0), second = Number(secondText || 0);
            if (validParts(year, month, day, hour, minute, second, 0)) {
                if (zoneText) {
                    const zone = ZONE_OFFSETS[zoneText.toUpperCase()];
                    const isoText = `${yearText}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}${zone}`;
                    timestamp = Date.parse(isoText);
                } else if (zoneLess === 'local') {
                    timestamp = localTimestamp(year, month, day, hour, minute, second, 0);
                } else {
                    timestamp = Date.UTC(year, month - 1, day, hour, minute, second, 0);
                }
            }
        } else {
            timestamp = Date.parse(raw);
        }
        return Number.isFinite(timestamp) && timestamp >= MIN_RELEASE_TIME ? timestamp : 0;
    }

    function formatReleaseDateTime(value) {
        const timestamp = typeof value === 'number' ? value : parseReleaseTimestamp(value);
        if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
        const date = new Date(timestamp);
        const datePart = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York', year: 'numeric', month: 'short', day: 'numeric'
        }).format(date);
        const timeParts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short'
        }).formatToParts(date);
        const hourMinute = timeParts.filter(part => part.type === 'hour' || part.type === 'minute')
            .map(part => part.value).join(':');
        const zone = timeParts.find(part => part.type === 'timeZoneName')?.value || 'ET';
        const timePart = `${hourMinute} ${zone}`;
        return { fullLabel: `${datePart} • ${timePart}`, dateOnly: datePart, timeOnly: timePart };
    }

    function formatReleaseDateLabel(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const dateOnly = raw.match(/\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b(?![ T]\d)/) ||
            raw.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b(?!\s+\d)/);
        if (dateOnly) {
            const parts = dateOnly[0].match(/\d+/g).map(Number);
            const [year, month, day] = parts.length === 3 && parts[0] > 31
                ? parts
                : [parts[2], parts[0], parts[1]];
            if (validParts(year, month, day, 12, 0, 0, 0)) {
                return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
                    .format(new Date(Date.UTC(year, month - 1, day, 12)));
            }
        }
        const timestamp = parseReleaseTimestamp(value);
        if (!timestamp) return raw;
        return new Intl.DateTimeFormat('en-US', {
            month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York'
        }).format(new Date(timestamp));
    }

    function formatEasternReleaseDateTime(value) {
        const timestamp = typeof value === 'number' ? value : parseReleaseTimestamp(value);
        if (!timestamp) return String(value || 'TBD');
        return new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZoneName: 'short'
        }).format(new Date(timestamp));
    }

    global.parseReleaseTimestamp = parseReleaseTimestamp;
    global.formatReleaseDateTime = formatReleaseDateTime;
    global.formatReleaseDateLabel = formatReleaseDateLabel;
    global.formatEasternReleaseDateTime = formatEasternReleaseDateTime;
})(window);
