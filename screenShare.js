/**
 * Screen Share — share your screen/window/tab with everyone in the room.
 * Sharer: getDisplayMedia → WebRTC peer connections (one per viewer).
 * Viewers: receive WebRTC stream, display in a floating viewer panel.
 * Signaling travels over the MPP room-chat channel with the "SS|" prefix.
 */
(function (global) {
    'use strict';

    // ── constants ─────────────────────────────────────────────────────────────────
    var SYNC_PREFIX = 'SS|';
    var ICE_SERVERS = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
    ];
    var REANNOUNCE_MS = 10000; // re-announce while sharing so late-joiners see the notification
    var SIZE_NAMES    = ['ss-sm', 'ss-md', 'ss-lg'];

    // ── sharer state ──────────────────────────────────────────────────────────────
    var panel      = null;     // local preview panel (sharer only)
    var videoEl    = null;
    var stream     = null;
    var sizeIdx    = 1;
    var _peerConns = {};       // viewerId → RTCPeerConnection  (sharer sends stream)
    var _reannTimer = null;

    // ── viewer state ──────────────────────────────────────────────────────────────
    var viewPanel     = null;  // remote viewer panel
    var viewVideoEl   = null;
    var _viewConn     = null;  // RTCPeerConnection  (viewer receives stream)
    var _sharerId     = null;  // participant ID of the person we're watching

    // ── drag state (shared) ───────────────────────────────────────────────────────
    var _dragTarget = null;   // which panel is being dragged
    var _dragOX = 0, _dragOY = 0;

    // ──────────────────────────────────────────────────────────────────────────────
    // IDENTITY
    // ──────────────────────────────────────────────────────────────────────────────
    function _myId() {
        try {
            if (typeof gClient !== 'undefined' && gClient) {
                if (gClient.participantId) return gClient.participantId;
                var p = gClient.getOwnParticipant && gClient.getOwnParticipant();
                return (p && (p._id || p.id)) || null;
            }
        } catch (e) {}
        return null;
    }
    function _myName() {
        try {
            var p = gClient && gClient.getOwnParticipant && gClient.getOwnParticipant();
            return (p && p.name) || 'Someone';
        } catch (e) { return 'Someone'; }
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // SIGNALING — messages go over MPP chat with "SS|" prefix
    // ──────────────────────────────────────────────────────────────────────────────
    function _sig(obj) {
        try {
            var txt = SYNC_PREFIX + JSON.stringify(obj);
            if (typeof gClient !== 'undefined' && gClient && gClient.sendArray) {
                gClient.sendArray([{ m: 'a', message: txt }]);
            }
        } catch (e) {}
    }

    // Called by routeRoomSync in script.js
    function isSyncText(line) {
        return typeof line === 'string' && line.indexOf(SYNC_PREFIX) === 0;
    }
    function tryHandleChat(msg) {
        var line = msg.a != null ? msg.a : (msg.message || '');
        if (!isSyncText(line)) return;
        try { _onSignal(JSON.parse(line.slice(SYNC_PREFIX.length))); } catch (e) {}
    }

    function _onSignal(d) {
        if (!d || !d.t) return;
        var me = _myId();
        switch (d.t) {

            // ── someone is sharing ─────────────────────────────────────────────
            case 'ann':
                if (d.from && d.from !== me) {
                    _showWatchBar(d.from, d.name || 'Someone');
                }
                break;

            // ── sharer stopped ────────────────────────────────────────────────
            case 'bye':
                if (d.from === _sharerId) _closeViewer();
                if (_peerConns[d.from]) {
                    try { _peerConns[d.from].close(); } catch (e) {}
                    delete _peerConns[d.from];
                }
                break;

            // ── viewer wants to watch us ──────────────────────────────────────
            case 'watch':
                if (stream && d.to === me && d.from && d.from !== me) {
                    _createOffer(d.from);
                }
                break;

            // ── sharer sent us a WebRTC offer ─────────────────────────────────
            case 'offer':
                if (d.to === me && d.from && d.sdp) _recvOffer(d.from, d.sdp);
                break;

            // ── viewer answered our offer ─────────────────────────────────────
            case 'answer':
                if (d.to === me && stream && d.from && d.sdp) _recvAnswer(d.from, d.sdp);
                break;

            // ── ICE candidate ─────────────────────────────────────────────────
            case 'ice':
                if (d.to === me && d.from && d.c) _recvIce(d.from, d.c);
                break;
        }
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // WEBRTC — SHARER SIDE
    // ──────────────────────────────────────────────────────────────────────────────
    function _createOffer(viewerId) {
        if (_peerConns[viewerId]) {
            try { _peerConns[viewerId].close(); } catch (e) {}
        }
        var pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        _peerConns[viewerId] = pc;
        var me = _myId();

        // add all tracks from current stream
        stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });

        pc.onicecandidate = function (e) {
            if (e.candidate) {
                _sig({ t: 'ice', to: viewerId, from: me, c: JSON.stringify(e.candidate.toJSON()) });
            }
        };
        pc.onconnectionstatechange = function () {
            if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                delete _peerConns[viewerId];
            }
        };

        pc.createOffer()
            .then(function (o) { return pc.setLocalDescription(o); })
            .then(function () {
                _sig({ t: 'offer', to: viewerId, from: me, sdp: pc.localDescription.sdp });
            })
            .catch(function () {});
    }

    function _recvAnswer(viewerId, sdp) {
        var pc = _peerConns[viewerId];
        if (pc) pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: sdp })).catch(function () {});
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // WEBRTC — VIEWER SIDE
    // ──────────────────────────────────────────────────────────────────────────────
    function _recvOffer(sharerId, sdp) {
        if (_viewConn) { try { _viewConn.close(); } catch (e) {} _viewConn = null; }
        _sharerId = sharerId;
        var me = _myId();

        var pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        _viewConn = pc;

        pc.onicecandidate = function (e) {
            if (e.candidate) {
                _sig({ t: 'ice', to: sharerId, from: me, c: JSON.stringify(e.candidate.toJSON()) });
            }
        };
        pc.ontrack = function (e) {
            var s = e.streams && e.streams[0];
            if (s) _showViewStream(s);
        };
        pc.onconnectionstatechange = function () {
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                _closeViewer();
            }
        };

        pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdp }))
            .then(function () { return pc.createAnswer(); })
            .then(function (a) { return pc.setLocalDescription(a); })
            .then(function () {
                _sig({ t: 'answer', to: sharerId, from: me, sdp: pc.localDescription.sdp });
            })
            .catch(function () {});
    }

    function _recvIce(fromId, candidateJson) {
        var pc = (_peerConns[fromId]) || (_viewConn && _sharerId === fromId ? _viewConn : null);
        if (!pc) return;
        try {
            pc.addIceCandidate(new RTCIceCandidate(JSON.parse(candidateJson))).catch(function () {});
        } catch (e) {}
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // WATCH NOTIFICATION BAR  (shown to non-sharers when someone is sharing)
    // ──────────────────────────────────────────────────────────────────────────────
    function _showWatchBar(sharerId, sharerName) {
        var bar = document.getElementById('ss-watch-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'ss-watch-bar';
            document.body.appendChild(bar);
        }
        bar.innerHTML = '';

        var icon = document.createElement('span');
        icon.textContent = '🖥️';

        var lbl = document.createElement('span');
        lbl.className = 'ss-watch-lbl';
        lbl.textContent = ' ' + sharerName + ' is sharing their screen';

        var watchBtn = document.createElement('button');
        watchBtn.type = 'button';
        watchBtn.className = 'ss-watch-btn';
        watchBtn.textContent = 'Watch';

        var xBtn = document.createElement('button');
        xBtn.type = 'button';
        xBtn.className = 'ss-watch-x';
        xBtn.textContent = '✕';

        bar.appendChild(icon);
        bar.appendChild(lbl);
        bar.appendChild(watchBtn);
        bar.appendChild(xBtn);
        bar.removeAttribute('hidden');

        watchBtn.addEventListener('click', function () {
            bar.setAttribute('hidden', '');
            var me = _myId();
            if (me) _sig({ t: 'watch', to: sharerId, from: me });
        });
        xBtn.addEventListener('click', function () {
            bar.setAttribute('hidden', '');
        });
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // VIEWER PANEL
    // ──────────────────────────────────────────────────────────────────────────────
    function _buildViewPanel() {
        if (viewPanel) return;
        viewPanel = document.createElement('div');
        viewPanel.id = 'ss-viewer-panel';
        viewPanel.className = 'screen-share-panel ss-md';
        viewPanel.setAttribute('hidden', '');

        viewPanel.innerHTML =
            '<div class="ss-head">' +
                '<div class="ss-head-left">' +
                    '<span class="ss-live-badge ss-live-badge-on">' +
                        '<span class="ss-live-dot ss-live-dot-on"></span>LIVE' +
                    '</span>' +
                    '<span class="ss-title">Screen Share</span>' +
                '</div>' +
                '<div class="ss-head-right">' +
                    '<button type="button" class="ss-btn ss-btn-vpip" title="Picture in Picture">&#x229F;</button>' +
                    '<button type="button" class="ss-btn ss-btn-vfull" title="Fullscreen (F)">&#x26F6;</button>' +
                    '<button type="button" class="ss-btn ss-btn-vsize" title="Cycle size (S)">&#x2922;</button>' +
                    '<button type="button" class="ss-btn ss-btn-stop" title="Stop watching">&#x2715;</button>' +
                '</div>' +
            '</div>' +
            '<div class="ss-stage">' +
                '<video class="ss-video" autoplay playsinline></video>' +
            '</div>';

        document.body.appendChild(viewPanel);
        viewVideoEl = viewPanel.querySelector('.ss-video');

        var pos = _safePos();
        viewPanel.style.top   = (pos.top + 10) + 'px'; // slight offset from sharer panel
        viewPanel.style.right = pos.right + 'px';
        viewPanel.style.left  = 'auto';

        _bindDrag(viewPanel);

        viewPanel.querySelector('.ss-btn-vfull').addEventListener('click', function () {
            _reqFullscreen(viewVideoEl);
        });
        viewPanel.querySelector('.ss-btn-vpip').addEventListener('click', function () {
            _reqPiP(viewVideoEl);
        });
        var vSizeIdx = 1;
        viewPanel.querySelector('.ss-btn-vsize').addEventListener('click', function () {
            viewPanel.classList.remove(SIZE_NAMES[vSizeIdx]);
            vSizeIdx = (vSizeIdx + 1) % SIZE_NAMES.length;
            viewPanel.classList.add(SIZE_NAMES[vSizeIdx]);
        });
        viewPanel.querySelector('.ss-btn-stop').addEventListener('click', _closeViewer);
    }

    function _showViewStream(s) {
        _buildViewPanel();
        viewVideoEl.srcObject = s;
        viewPanel.removeAttribute('hidden');
    }

    function _closeViewer() {
        if (_viewConn) { try { _viewConn.close(); } catch (e) {} _viewConn = null; }
        _sharerId = null;
        if (viewVideoEl) viewVideoEl.srcObject = null;
        if (viewPanel) viewPanel.setAttribute('hidden', '');
        var bar = document.getElementById('ss-watch-bar');
        if (bar) bar.setAttribute('hidden', '');
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // POSITION HELPER
    // ──────────────────────────────────────────────────────────────────────────────
    function _safePos() {
        var bar = document.querySelector('.harmony-tools-bar');
        var gap = 10;
        if (bar) {
            var r = bar.getBoundingClientRect();
            return { top: Math.round(r.bottom) + gap, right: gap };
        }
        return { top: 60, right: 10 };
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // SHARER PANEL  (local preview)
    // ──────────────────────────────────────────────────────────────────────────────
    function _buildPanel() {
        if (panel) return;
        panel = document.createElement('div');
        panel.id = 'screen-share-panel';
        panel.className = 'screen-share-panel ' + SIZE_NAMES[sizeIdx];
        panel.setAttribute('hidden', '');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Screen share viewer');

        panel.innerHTML =
            '<div class="ss-head">' +
                '<div class="ss-head-left">' +
                    '<span class="ss-live-badge"><span class="ss-live-dot"></span>LIVE</span>' +
                    '<span class="ss-title">Sharing</span>' +
                    '<span class="ss-source-chip" hidden></span>' +
                '</div>' +
                '<div class="ss-head-right">' +
                    '<button type="button" class="ss-btn ss-btn-pip"  title="Picture in Picture (P)">&#x229F;</button>' +
                    '<button type="button" class="ss-btn ss-btn-full" title="Fullscreen (F)">&#x26F6;</button>' +
                    '<button type="button" class="ss-btn ss-btn-size" title="Cycle size (S)">&#x2922;</button>' +
                    '<button type="button" class="ss-btn ss-btn-stop" title="Stop sharing">&#x2715;</button>' +
                '</div>' +
            '</div>' +
            '<div class="ss-stage">' +
                '<video class="ss-video" autoplay playsinline muted></video>' +
                '<div class="ss-mask">' +
                    '<div class="ss-mask-inner">' +
                        '<span class="ss-mask-icon">&#x1F5A5;&#xFE0F;</span>' +
                        '<span class="ss-mask-msg">Pick a screen, window, or tab…</span>' +
                        '<span class="ss-mask-sub">Your browser will open the picker</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="ss-foot">' +
                '<span class="ss-status"></span>' +
                '<div class="ss-foot-right">' +
                    '<span class="ss-viewer-count"></span>' +
                    '<button type="button" class="ss-foot-btn ss-btn-audio" title="Toggle captured audio">&#x1F507; Audio off</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(panel);
        videoEl = panel.querySelector('.ss-video');

        var pos = _safePos();
        panel.style.top   = pos.top  + 'px';
        panel.style.right = pos.right + 'px';
        panel.style.left  = 'auto';
        panel.style.bottom = 'auto';

        _bindDrag(panel);

        panel.querySelector('.ss-btn-stop').addEventListener('click', stop);
        panel.querySelector('.ss-btn-full').addEventListener('click', function () { _reqFullscreen(videoEl); });
        panel.querySelector('.ss-btn-pip') .addEventListener('click', function () { _reqPiP(videoEl); });
        panel.querySelector('.ss-btn-size').addEventListener('click', _cycleSize);
        panel.querySelector('.ss-btn-audio').addEventListener('click', function () { _toggleAudio(this); });
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // DRAG  — pointer-capture, applied to both panels
    // ──────────────────────────────────────────────────────────────────────────────
    function _bindDrag(p) {
        var head = p.querySelector('.ss-head');

        head.addEventListener('pointerdown', function (e) {
            if (e.target.closest && e.target.closest('button')) return;
            if (e.target.tagName === 'BUTTON') return;
            e.preventDefault();

            // Convert to left/top anchoring so we can move freely
            var r = p.getBoundingClientRect();
            p.style.left   = r.left + 'px';
            p.style.top    = r.top  + 'px';
            p.style.right  = 'auto';
            p.style.bottom = 'auto';

            _dragTarget = p;
            _dragOX = e.clientX - r.left;
            _dragOY = e.clientY - r.top;

            try { head.setPointerCapture(e.pointerId); } catch (err) {}
            p.classList.add('ss-dragging');
        });

        head.addEventListener('pointermove', function (e) {
            if (_dragTarget !== p) return;
            var nx = Math.max(0, Math.min(window.innerWidth  - 80, e.clientX - _dragOX));
            var ny = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - _dragOY));
            p.style.left = nx + 'px';
            p.style.top  = ny + 'px';
        });

        function endDrag(e) {
            if (_dragTarget !== p) return;
            _dragTarget = null;
            p.classList.remove('ss-dragging');
        }
        head.addEventListener('pointerup',     endDrag);
        head.addEventListener('pointercancel', endDrag);
        head.addEventListener('lostpointercapture', endDrag);
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ──────────────────────────────────────────────────────────────────────────────
    function _safeInit() {
        // Re-position sharer panel if it hasn't been manually dragged yet
        if (panel && panel.style.left === 'auto') {
            var pos = _safePos();
            panel.style.top   = pos.top  + 'px';
            panel.style.right = pos.right + 'px';
        }
    }

    function _reqFullscreen(el) {
        if (!el) return;
        var fn = el.requestFullscreen || el.webkitRequestFullscreen ||
                 el.mozRequestFullScreen || el.msRequestFullscreen;
        if (fn) fn.call(el).catch(function () {});
    }
    function _reqPiP(el) {
        if (!el) return;
        if (!document.pictureInPictureEnabled) { _setStatus('PiP not supported.'); return; }
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(function () {});
        } else {
            el.requestPictureInPicture().catch(function (e) { _setStatus('PiP: ' + (e.message || 'unavailable')); });
        }
    }

    function _setStatus(msg) {
        var el = panel && panel.querySelector('.ss-status');
        if (el) el.textContent = msg || '';
    }
    function _setViewerCount(n) {
        var el = panel && panel.querySelector('.ss-viewer-count');
        if (!el) return;
        el.textContent = n > 0 ? n + ' watching' : '';
    }
    function _setChip(label) {
        var el = panel && panel.querySelector('.ss-source-chip');
        if (!el) return;
        if (!label) { el.hidden = true; return; }
        el.hidden = false;
        var icon = /window/i.test(label) ? '🪟' :
                   /tab|chrome|firefox|edge|brave|safari/i.test(label) ? '📑' : '🖥️';
        var short = label.replace(/^(entire\s+)?(screen|monitor|display)\s*/i, '').trim();
        el.textContent = icon + ' ' + (short || label).slice(0, 34);
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
        if (show) mask.removeAttribute('hidden'); else mask.setAttribute('hidden', '');
    }
    function _cycleSize() {
        panel.classList.remove(SIZE_NAMES[sizeIdx]);
        sizeIdx = (sizeIdx + 1) % SIZE_NAMES.length;
        panel.classList.add(SIZE_NAMES[sizeIdx]);
    }
    function _toggleAudio(btn) {
        if (!stream) return;
        var tracks = stream.getAudioTracks();
        if (!tracks.length) { _setStatus('No audio — share a browser tab with "Share tab audio" ticked.'); return; }
        var on = !tracks[0].enabled;
        tracks.forEach(function (t) { t.enabled = on; });
        videoEl.muted = !on;
        btn.textContent = on ? '🔊 Audio on' : '🔇 Audio off';
        btn.classList.toggle('ss-audio-active', on);
    }
    function _resetAudioBtn() {
        var btn = panel && panel.querySelector('.ss-btn-audio');
        if (!btn) return;
        btn.textContent = '🔇 Audio off';
        btn.disabled = false;
        btn.classList.remove('ss-audio-active');
        if (videoEl) videoEl.muted = true;
    }
    function _updateToolbarBtn(sharing) {
        var btn = document.getElementById('screen-share-btn');
        if (!btn) return;
        btn.classList.toggle('ss-toolbar-active', sharing);
        btn.textContent = sharing ? '● Live' : '⊟ Share';
    }
    function _closeAllPeers() {
        Object.keys(_peerConns).forEach(function (id) {
            try { _peerConns[id].close(); } catch (e) {}
        });
        _peerConns = {};
        _setViewerCount(0);
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // KEYBOARD SHORTCUTS
    // ──────────────────────────────────────────────────────────────────────────────
    document.addEventListener('keydown', function (e) {
        var tag = (document.activeElement || {}).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        // Sharer panel shortcuts
        if (stream && panel && !panel.hasAttribute('hidden')) {
            if (e.key === 'f' || e.key === 'F') { e.preventDefault(); _reqFullscreen(videoEl); }
            else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); _reqPiP(videoEl); }
            else if (e.key === 's' || e.key === 'S') { e.preventDefault(); _cycleSize(); }
        }
        // Viewer panel shortcuts
        if (viewPanel && !viewPanel.hasAttribute('hidden')) {
            if (e.key === 'f' || e.key === 'F') { e.preventDefault(); _reqFullscreen(viewVideoEl); }
        }
    });

    // ──────────────────────────────────────────────────────────────────────────────
    // CORE START / STOP
    // ──────────────────────────────────────────────────────────────────────────────
    function isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    }

    function start() {
        if (!isSupported()) {
            alert('Screen sharing needs Chrome, Edge, or Firefox.\nYour browser does not support getDisplayMedia().');
            return;
        }
        _buildPanel();
        if (stream) _teardown(true);

        _safeInit();
        panel.removeAttribute('hidden');
        _showMask(true);
        _setStatus('Waiting for permission…');
        _setChip('');
        _setLive(false);
        _resetAudioBtn();
        _setViewerCount(0);
        _updateToolbarBtn(true);

        navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
            .then(function (s) {
                stream = s;
                videoEl.srcObject = stream;
                videoEl.muted = true;

                var vt = stream.getVideoTracks();
                _setChip((vt[0] && vt[0].label) || '');
                _showMask(false);
                _setStatus('Sharing — viewers will see a "Watch" button');
                _setLive(true);

                // Disable audio button if no audio was captured
                var hasAudio = stream.getAudioTracks().length > 0;
                var ab = panel.querySelector('.ss-btn-audio');
                if (ab) { ab.disabled = !hasAudio; }

                // Browser's native "Stop sharing" bar kills the track
                vt.forEach(function (t) {
                    t.addEventListener('ended', function () { stop(); });
                });

                // Announce to room so viewers get the Watch notification
                _announce();
                _reannTimer = setInterval(_announce, REANNOUNCE_MS);
            })
            .catch(function (err) {
                _teardown(false);
                _updateToolbarBtn(false);
                if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
                    alert('Screen sharing failed: ' + (err.message || err.name));
                }
            });
    }

    function _announce() {
        _sig({ t: 'ann', from: _myId(), name: _myName() });
    }

    function _teardown(keepPanel) {
        // Reset drag state so it can never be stuck
        _dragTarget = null;

        clearInterval(_reannTimer);
        _reannTimer = null;

        if (stream) {
            stream.getTracks().forEach(function (t) { t.stop(); });
            stream = null;
        }
        if (videoEl) videoEl.srcObject = null;

        _closeAllPeers();
        _setLive(false);
        _setChip('');
        _resetAudioBtn();
        _updateToolbarBtn(false);

        if (!keepPanel && panel) panel.setAttribute('hidden', '');
    }

    function stop() {
        _sig({ t: 'bye', from: _myId() });
        _teardown(false);
        _setStatus('Stopped.');
    }

    function toggle() {
        if (stream) stop(); else start();
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // INIT — wire toolbar button
    // ──────────────────────────────────────────────────────────────────────────────
    function _init() {
        var btn = document.getElementById('screen-share-btn');
        if (!btn) return;
        if (!isSupported()) {
            btn.title         = 'Screen sharing needs Chrome, Edge, or Firefox';
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

    // Public API — also exposes static helpers for script.js routing
    global.ScreenShare = {
        start: start, stop: stop, toggle: toggle, isSupported: isSupported,
        isSyncText: isSyncText, tryHandleChat: tryHandleChat
    };

})(typeof window !== 'undefined' ? window : this);
