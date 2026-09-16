/* ==========================================================================
   Stars Background — Hardware-Accelerated Seamless Ping-Pong Playback
   The video stream contains an authored seamless forward-and-reverse loop.
   Native hardware decoding plays forward continuously without CPU seek stalls.
   ========================================================================== */
(function () {
    'use strict';

    function initStarsVideo() {
        const video = document.getElementById('stars-bg-video');
        if (!video) return;

        video.loop = true;
        video.muted = true;
        video.playsInline = true;

        /* Ensure playback starts reliably even under aggressive browser power policies */
        function ensurePlaying() {
            if (video.paused) {
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(function () {
                        const retry = function () {
                            video.play().catch(function () {});
                            window.removeEventListener('pointerdown', retry);
                            window.removeEventListener('keydown', retry);
                        };
                        window.addEventListener('pointerdown', retry, { once: true });
                        window.addEventListener('keydown', retry, { once: true });
                    });
                }
            }
        }

        ensurePlaying();

        /* If video somehow stalls or ends, smoothly restart */
        video.addEventListener('ended', function () {
            video.currentTime = 0;
            video.play().catch(function () {});
        });

        /* Pause video when tab is hidden to save GPU/CPU, resume when active */
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                video.pause();
            } else {
                ensurePlaying();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStarsVideo, { once: true });
    } else {
        initStarsVideo();
    }
})();

