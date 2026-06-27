/**
 * Screen Share — capture your screen, a window, or a browser tab and view it
 * in a floating panel. Uses the browser's native getDisplayMedia() picker.
 *
 * The browser's own dialog handles all source selection:
 *   • Entire Screen   (choose from connected monitors)
 *   • A Window        (any open application window)
 *   • A Browser Tab   (specific tab, with optional audio)
 */
(function (global) {
    'use strict';

    var panel       = null;
    var videoEl     = null;
    var stream      = null;
    var sizeNames   = ['ss-sm', 'ss-md', 'ss-lg'];
    var sizeIdx     = 1;                   // start at medium

    // Drag state (pointer-capture based — never gets stuck)
    var _dragging   = false;
    var _dragOX     = 0;
    var _dragOY     = 0;

    // ── feature detection ────────────────────────────────────────────────────────
    function isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    }

    // ── safe initial position ────────────────────────────────────────────────────
    // Place the panel below the harmony-tools bar so nothing overlaps.
    function _safeInitPos() {
        var bar = document.querySelector('.harmony-tools-bar');
        var gap = 10;
        if (bar) {
            var r = bar.getBoundingClientRect();
            return { top: Math.round(r.bottom) + gap, right: gap };
        }
        return { top: 60, right: 10 };
    }

    // ── build the panel (once) ───────────────────────────────────────────────────
    function buildPanel() {
        if (panel) return;

        panel = document.createElement('div');
        panel.id = 'screen-share-panel';
        panel.className = 'screen-share-panel ' + sizeNames[sizeIdx];
        panel.setAttribute('hidden', '');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Screen share viewer');

        panel.innerHTML =
            '<div class="ss-head">' +
                '<div class="ss-head-left">' +
                    '<span class="ss-live-badge"><span class="ss-live-dot"></span>LIVE</span>' +
                    '<span class="ss-title">Screen Share</span>' +
                    '<span class="ss-source-chip"></span>' +
                '</div>' +
                '<div class="ss-head-right">' +
                    '<button type="button" class="ss-btn ss-btn-pip"  title="Picture in Picture (P)">⊡</button>' +
                    '<button type="button" class="ss-btn ss-btn-full" title="Fullscreen (F)">⛶</button>' +
                    '<button type="button" class="ss-btn ss-btn-size" title="Cycle size (S)">⤢</button>' +
                    '<button type="button" class="ss-btn ss-btn-stop" title="Stop sharing">✕</button>' +
                '</div>' +
            '</div>' +
            '<div class="ss-stage">' +
                '<video class="ss-video" autoplay playsinline muted></video>' +
                '<div class="ss-mask">' +
                    '<div class="ss-mask-inner">' +
                        '<span class="ss-mask-icon">🖥️</span>' +
                        '<span class="ss-mask-msg">Pick a screen, window, or tab…</span>' +
                        '<span class="ss-mask-sub">Your browser will open the picker</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="ss-foot">' +
                '<span class="ss-status"></span>' +
                '<div class="ss-foot-right">' +
                    '<button type="button" class="ss-foot-btn ss-btn-audio" title="Mute / unmute captured audio">🔇 Audio off</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(panel);
        videoEl = panel.querySelector('.ss-video');

        // Position: just below the harmony-tools bar, flush with right edge
        var pos = _safeInitPos();
        panel.style.top    = pos.top  + 'px';
        panel.style.right  = pos.right + 'px';
        panel.style.left   = 'auto';
        panel.style.bottom = 'auto';

        _initDrag();
        _initButtons();
        _initKeys();
    }

    // ── drag with pointer capture (never gets stuck) ──────────────────────────────
    function _initDrag() {
        var head = panel.querySelector('.ss-head');

        head.addEventListener('pointerdown', function (e) {
            // Don't start drag when clicking a button
            if (e.target.closest('button')) return;
            e.preventDefault();

            // Switch from right-anchoring to left-anchoring so we can move freely
            var rect = panel.getBoundingClientRect();
            panel.style.left   = rect.left + 'px';
            panel.style.top    = rect.top  + 'px';
            panel.style.right  = 'auto';
            panel.style.bottom = 'auto';

            _dragging = true;
            _dragOX   = e.clientX - rect.left;
            _dragOY   = e.clientY - rect.top;
            head.setPointerCapture(e.pointerId);
            panel.classList.add('ss-dragging');
        });

        head.addEventListener('pointermove', function (e) {
            if (!_dragging) return;
            var nx = Math.max(0, Math.min(window.innerWidth  - 80, e.clientX - _dragOX));
            var ny = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - _dragOY));
            panel.style.left = nx + 'px';
            panel.style.top  = ny + 'px';
        });

        function endDrag() {
            if (!_dragging) return;
            _dragging = false;
            panel.classList.remove('ss-dragging');
        }
        head.addEventListener('pointerup',     endDrag);
        head.addEventListener('pointercancel', endDrag);
    }

    // ── button wiring ────────────────────────────────────────────────────────────
    function _initButtons() {
        panel.querySelector('.ss-btn-stop').addEventListener('click', stop);
        panel.querySelector('.ss-btn-full').addEventListener('click', _fullscreen);
        panel.querySelector('.ss-btn-pip') .addEventListener('click', _togglePiP);
        panel.querySelector('.ss-btn-size').addEventListener('click', _cycleSize);
        panel.querySelector('.ss-btn-audio').addEventListener('click', function () {
            _toggleAudio(this);
        });
    }

    // ── keyboard shortcuts ────────────────────────────────────────────────────────
    function _initKeys() {
        document.addEventListener('keydown', function (e) {
            if (!stream || !panel || panel.hasAttribute('hidden')) return;
            var tag = (document.activeElement || {}).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (e.key === 'f' || e.key === 'F') { e.preventDefault(); _fullscreen(); }
            else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); _togglePiP(); }
            else if (e.key === 's' || e.key === 'S') { e.preventDefault(); _cycleSize(); }
        });
    }

    // ── helpers ──────────────────────────────────────────────────────────────────
    function _setStatus(msg) {
        var el = panel && panel.querySelector('.ss-status');
        if (el) el.textContent = msg || '';
    }

    function _setChip(label) {
        var el = panel && panel.querySelector('.ss-source-chip');
        if (!el) return;
        if (!label) { el.textContent = ''; el.hidden = true; return; }
        el.hidden = false;
        var icon = /window/i.test(label)                           ? '🪟' :
                   /tab|chrome|firefox|edge|brave|safari/i.test(label) ? '📑' : '🖥️';
        var short = label.replace(/^(entire\s+)?(screen|monitor|display)\s*/i, '').trim();
        el.textContent = icon + ' ' + (short || label).slice(0, 34);
    }

    function _setLive(on) {
        var dot   = panel && panel.querySelector('.ss-live-dot');
        var badge = panel && panel.querySelector('.ss-live-badge');
        if (dot)   dot.classList.toggle('ss-live-dot-on', on);
        if (badge) badge.classList.toggle('ss-live-badge-on', on);
    }

    function _showMask(show) {
        var mask = panel && panel.querySelector('.ss-mask');
        if (!mask) return;
        if (show) mask.removeAttribute('hidden');
        else       mask.setAttribute('hidden', '');
    }

    function _cycleSize() {
        panel.classList.remove(sizeNames[sizeIdx]);
        sizeIdx = (sizeIdx + 1) % sizeNames.length;
        panel.classList.add(sizeNames[sizeIdx]);
    }

    function _fullscreen() {
        if (!videoEl) return;
        var req = videoEl.requestFullscreen || videoEl.webkitRequestFullscreen ||
                  videoEl.mozRequestFullScreen || videoEl.msRequestFullscreen;
        if (req) req.call(videoEl).catch(function () {});
    }

    function _togglePiP() {
        if (!videoEl) return;
        if (!document.pictureInPictureEnabled) {
            _setStatus('Picture-in-Picture not supported in this browser.');
            return;
        }
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(function () {});
        } else {
            videoEl.requestPictureInPicture().catch(function (e) {
                _setStatus('PiP: ' + (e.message || 'unavailable'));
            });
        }
    }

    function _toggleAudio(btn) {
        if (!stream) return;
        var tracks = stream.getAudioTracks();
        if (!tracks.length) {
            _setStatus('No audio — share a browser tab and tick "Share tab audio".');
            return;
        }
        var nowEnabled = !tracks[0].enabled;
        tracks.forEach(function (t) { t.enabled = nowEnabled; });
        videoEl.muted = !nowEnabled;
        btn.textContent = nowEnabled ? '🔊 Audio on' : '🔇 Audio off';
        btn.classList.toggle('ss-audio-active', nowEnabled);
    }

    function _resetAudioBtn() {
        var btn = panel && panel.querySelector('.ss-btn-audio');
        if (!btn) return;
        btn.textContent = '🔇 Audio off';
        btn.disabled    = false;
        btn.classList.remove('ss-audio-active');
        if (videoEl) videoEl.muted = true;
    }

    function _updateToolbarBtn(sharing) {
        var btn = document.getElementById('screen-share-btn');
        if (!btn) return;
        btn.classList.toggle('ss-toolbar-active', sharing);
        btn.textContent = sharing ? '● Live' : '⊡ Share';
    }

    // ── core start / stop ────────────────────────────────────────────────────────
    function start() {
        if (!isSupported()) {
            alert('Screen sharing requires Chrome, Edge, or Firefox.\nYour browser does not support getDisplayMedia().');
            return;
        }

        buildPanel();

        // Stop any existing stream first
        if (stream) _teardown(true);

        // Recalculate safe position each time in case harmony-tools bar changed
        var pos = _safeInitPos();
        if (panel.style.left === 'auto' || !panel.style.left) {
            panel.style.top   = pos.top  + 'px';
            panel.style.right = pos.right + 'px';
        }

        panel.removeAttribute('hidden');
        _showMask(true);
        _setStatus('Waiting for permission…');
        _setChip('');
        _setLive(false);
        _resetAudioBtn();
        _updateToolbarBtn(true);

        // getDisplayMedia — the browser shows its own native picker:
        //   • Entire Screen (choose from connected monitors)
        //   • Window        (any open application window)
        //   • Browser Tab   (with optional tab audio)
        navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
            .then(function (s) {
                stream = s;
                videoEl.srcObject = stream;
                videoEl.muted = true;    // start muted; audio btn unmutes

                var vTracks = stream.getVideoTracks();
                _setChip((vTracks[0] && vTracks[0].label) || '');
                _showMask(false);
                _setStatus('Sharing');
                _setLive(true);

                // Update audio button based on whether audio was captured
                var hasAudio = stream.getAudioTracks().length > 0;
                var audioBtn = panel.querySelector('.ss-btn-audio');
                if (audioBtn) {
                    audioBtn.disabled = !hasAudio;
                    if (!hasAudio) audioBtn.title = 'No audio captured — share a browser tab and tick "Share tab audio"';
                }

                // Browser's native "Stop sharing" bar also fires track ended
                vTracks.forEach(function (t) {
                    t.addEventListener('ended', function () { stop(); });
                });
            })
            .catch(function (err) {
                _teardown(false);
                panel.setAttribute('hidden', '');
                _updateToolbarBtn(false);
                // NotAllowedError / AbortError = user cancelled picker — no alert needed
                if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
                    alert('Screen sharing failed: ' + (err.message || err.name));
                }
            });
    }

    function _teardown(keepPanel) {
        if (stream) {
            stream.getTracks().forEach(function (t) { t.stop(); });
            stream = null;
        }
        if (videoEl) videoEl.srcObject = null;
        _setLive(false);
        _setChip('');
        _resetAudioBtn();
        _updateToolbarBtn(false);
        if (!keepPanel && panel) panel.setAttribute('hidden', '');
    }

    function stop() {
        _teardown(false);
        _setStatus('Stopped');
    }

    function toggle() {
        if (stream) stop();
        else         start();
    }

    // ── wire the toolbar button ───────────────────────────────────────────────────
    function _init() {
        var btn = document.getElementById('screen-share-btn');
        if (!btn) return;
        if (!isSupported()) {
            btn.title         = 'Not supported in this browser (needs Chrome, Edge, or Firefox)';
            btn.style.opacity = '0.45';
            btn.style.cursor  = 'not-allowed';
            return;
        }
        btn.addEventListener('click', toggle);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

    global.ScreenShare = { start: start, stop: stop, toggle: toggle, isSupported: isSupported };

})(typeof window !== 'undefined' ? window : this);
