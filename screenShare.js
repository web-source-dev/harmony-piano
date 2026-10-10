/**
 * Screen Share — share with everyone in the room from any device.
 * Desktop: getDisplayMedia (screen, window, or tab) → WebRTC.
 * Phones and tablets: the same when the browser allows it; otherwise a live
 * capture of this page, or the front/back camera. Viewers get a floating panel.
 * Signaling travels over the room relay with the "SS|" prefix.
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
    var _shareGen   = 0;    // bumps on stop so a late camera/mic grant can't restart sharing
    var _pageRaf    = 0;
    var _pageOn     = false;
    var _pageCanvas = null;
    var _sourceSheet = null;

    // ── viewer state ──────────────────────────────────────────────────────────────
    var viewPanel     = null;  // remote viewer panel
    var viewVideoEl   = null;
    var _viewConn     = null;  // RTCPeerConnection  (viewer receives stream)
    var _sharerId     = null;  // participant ID of the person we're watching

    // ── drag state (shared) ───────────────────────────────────────────────────────
    var _dragTarget = null;   // which panel is being dragged
    var _dragOX = 0, _dragOY = 0;

    // ── stable per-session identity (never null) ──────────────────────────────────
    // Generated once per page load. Used when the MPP participant ID is unavailable
    // (e.g. MPP server unreachable). All signaling checks use d.from && …, so a
    // null _myId() silently breaks every signal — this fallback prevents that.
    var _localId = 'ss_' + Math.random().toString(36).slice(2) + Date.now().toString(36);

    // ──────────────────────────────────────────────────────────────────────────────
    // IDENTITY
    // ──────────────────────────────────────────────────────────────────────────────
    function _myId() {
        try {
            if (typeof gClient !== 'undefined' && gClient) {
                if (gClient.participantId) return gClient.participantId;
                var p = gClient.getOwnParticipant && gClient.getOwnParticipant();
                var id = p && (p._id || p.id);
                if (id) return id;
            }
        } catch (e) {}
        return _localId;  // always a non-null string — unique per page load
    }
    function _myName() {
        try {
            var p = gClient && gClient.getOwnParticipant && gClient.getOwnParticipant();
            return (p && p.name) || 'Someone';
        } catch (e) { return 'Someone'; }
    }

    // ──────────────────────────────────────────────────────────────────────────────
    // SIGNALING — primary: relay (/relay WebSocket); fallback: MPP chat
    //
    // The relay is the custom server everyone is already connected to, so it works
    // without any MPP access and handles large SDP payloads without truncation.
    // MPP chat (backup) was truncating at 512 chars, silently breaking SDP offers.
    // ──────────────────────────────────────────────────────────────────────────────
    function _sig(obj) {
        try {
            var txt = SYNC_PREFIX + JSON.stringify(obj);
            // Relay only — never dump SDP/signaling into public MPP chat.
            if (typeof gRoomSync !== 'undefined' && gRoomSync &&
                    typeof gRoomSync.broadcast === 'function') {
                gRoomSync.broadcast(txt);
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
                '<button type="button" class="ss-unmute" hidden>Tap for sound</button>' +
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
        var unmute = viewPanel.querySelector('.ss-unmute');
        unmute.addEventListener('click', function () {
            viewVideoEl.muted = false;
            var p = viewVideoEl.play && viewVideoEl.play();
            if (p && p.catch) p.catch(function () {});
            unmute.setAttribute('hidden', '');
        });
    }

    function _showViewStream(s) {
        _buildViewPanel();
        viewVideoEl.srcObject = s;
        viewVideoEl.muted = false;
        var unmute = viewPanel.querySelector('.ss-unmute');
        if (unmute) unmute.setAttribute('hidden', '');
        viewPanel.removeAttribute('hidden');
        _playRemote(viewVideoEl);
    }

    // Phones block unmuted autoplay once the Watch tap is over. Play muted, then
    // unmute on the next tap so the picture still shows.
    function _playRemote(el) {
        if (!el) return;
        el.playsInline = true;
        el.setAttribute('playsinline', '');
        el.setAttribute('webkit-playsinline', '');
        var pending = el.play && el.play();
        if (!pending || !pending.catch) return;
        pending.catch(function () {
            el.muted = true;
            var again = el.play && el.play();
            if (again && again.catch) again.catch(function () {});
            var btn = viewPanel && viewPanel.querySelector('.ss-unmute');
            if (btn) btn.removeAttribute('hidden');
        });
    }

    function _closeViewer() {
        if (_viewConn) { try { _viewConn.close(); } catch (e) {} _viewConn = null; }
        _sharerId = null;
        if (viewVideoEl) {
            viewVideoEl.srcObject = null;
            viewVideoEl.muted = false;
        }
        if (viewPanel) {
            viewPanel.setAttribute('hidden', '');
            var unmute = viewPanel.querySelector('.ss-unmute');
            if (unmute) unmute.setAttribute('hidden', '');
        }
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
        var icon = /camera/i.test(label) ? '📷' :
                   /page|this screen/i.test(label) ? '📱' :
                   /window/i.test(label) ? '🪟' :
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
        if (!tracks.length) {
            _setStatus('Asking for the microphone…');
            _requestMic().then(function (mic) {
                if (!mic || !stream) {
                    if (mic) _stopTracks(mic);
                    _setStatus('Microphone blocked — video is still sharing.');
                    return;
                }
                mic.getAudioTracks().forEach(function (t) { _addAudioTrack(t); });
                btn.textContent = '🔊 Audio on';
                btn.classList.add('ss-audio-active');
                _setStatus('Microphone is on for viewers.');
            });
            return;
        }
        var on = !tracks[0].enabled;
        tracks.forEach(function (t) { t.enabled = on; });
        if (videoEl) videoEl.muted = true; // local preview stays quiet so the mic doesn't howl
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
        if (e.key === 'Escape' && _sourceSheet && !_sourceSheet.hasAttribute('hidden')) {
            _closeSourceSheet();
            return;
        }
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
        try {
            var md = navigator.mediaDevices;
            if (md && (typeof md.getDisplayMedia === 'function' || typeof md.getUserMedia === 'function')) return true;
            return typeof document.createElement('canvas').captureStream === 'function';
        } catch (e) { return false; }
    }

    // Phones, tablets, and iPadOS (which pretends to be a desktop Mac).
    function _isHandheld() {
        var ua = navigator.userAgent || '';
        if (/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)) return true;
        if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1) return true;
        var touch = (navigator.maxTouchPoints || 0) > 0;
        var shortSide = Math.min(screen.width || 0, screen.height || 9999);
        return touch && shortSide <= 1024;
    }

    function _alive(gen) { return gen === _shareGen; }

    function _stopTracks(media) {
        if (!media) return;
        try {
            media.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
        } catch (e) {}
    }

    function _requestMic() {
        try {
            if (!window.isSecureContext) return Promise.resolve(null);
            if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') return Promise.resolve(null);
            return navigator.mediaDevices.getUserMedia({ audio: true, video: false }).catch(function () { return null; });
        } catch (e) { return Promise.resolve(null); }
    }

    // A mic granted after viewers already connected needs a fresh offer.
    function _addAudioTrack(track) {
        if (!stream || !track) return;
        try { stream.addTrack(track); } catch (e) { return; }
        var me = _myId();
        Object.keys(_peerConns).forEach(function (id) {
            var pc = _peerConns[id];
            if (!pc) return;
            try { pc.addTrack(track, stream); } catch (e) { return; }
            pc.createOffer()
                .then(function (o) { return pc.setLocalDescription(o); })
                .then(function () {
                    _sig({ t: 'offer', to: id, from: me, sdp: pc.localDescription.sdp });
                })
                .catch(function () {});
        });
    }

    function _prepare(maskMsg) {
        var gen = ++_shareGen;
        _closeSourceSheet();
        _buildPanel();
        if (stream) _teardown(true);
        _safeInit();
        panel.removeAttribute('hidden');
        _showMask(true);
        var msg = panel.querySelector('.ss-mask-msg');
        var sub = panel.querySelector('.ss-mask-sub');
        if (msg) msg.textContent = maskMsg || 'Starting…';
        if (sub) sub.textContent = 'Everyone in the room can watch';
        _setStatus('Starting…');
        _setChip('');
        _setLive(false);
        _resetAudioBtn();
        _setViewerCount(0);
        _updateToolbarBtn(true);
        return gen;
    }

    function _cancel(gen) {
        if (!_alive(gen)) return;
        _shareGen++;
        _teardown(false);
    }

    function _fail(gen, msg) {
        if (!_alive(gen)) return;
        _shareGen++;
        _teardown(false);
        if (msg) alert(msg);
    }

    function _goLive(gen, s, statusMsg, chip) {
        if (!_alive(gen)) {
            _stopTracks(s);
            _stopPageLoop();
            return;
        }
        stream = s;
        videoEl.srcObject = stream;
        videoEl.muted = true;
        videoEl.playsInline = true;
        var playP = videoEl.play && videoEl.play();
        if (playP && playP.catch) playP.catch(function () {});

        var vt = stream.getVideoTracks();
        _setChip(chip || (vt[0] && vt[0].label) || '');
        _showMask(false);
        _setStatus(statusMsg || 'Sharing — viewers will see a Watch button');
        _setLive(true);

        var hasAudio = stream.getAudioTracks().length > 0;
        var ab = panel.querySelector('.ss-btn-audio');
        if (ab) {
            ab.disabled = false;
            ab.textContent = hasAudio ? '🔊 Audio on' : '🎤 Add mic';
            ab.classList.toggle('ss-audio-active', hasAudio);
        }

        vt.forEach(function (t) {
            t.addEventListener('ended', function () { if (stream === s) stop(); });
        });

        _announce();
        clearInterval(_reannTimer);
        _reannTimer = setInterval(_announce, REANNOUNCE_MS);
    }

    // ── real screen / window / tab, with a video-only retry ─────────────────────
    function _requestDisplay(gen, withAudio, canRetry) {
        var t0 = Date.now();
        var pending;
        try {
            pending = navigator.mediaDevices.getDisplayMedia({ video: true, audio: !!withAudio });
        } catch (err) {
            if (canRetry && withAudio) { _requestDisplay(gen, false, false); return; }
            _startPage(gen);
            return;
        }
        pending.then(function (s) {
            if (!_alive(gen)) { _stopTracks(s); return; }
            var label = (s.getVideoTracks()[0] && s.getVideoTracks()[0].label) || 'Screen';
            _goLive(gen, s, 'Sharing — viewers will see a Watch button', label);
        }).catch(function (err) {
            if (!_alive(gen)) return;
            var name = (err && err.name) || '';
            var cancel = name === 'NotAllowedError' || name === 'AbortError';
            var fast = (Date.now() - t0) < 450;
            // audio:true rejects on some browsers and would otherwise cancel the whole share
            if (canRetry && withAudio && !cancel) { _requestDisplay(gen, false, false); return; }
            // A real picker was closed. Don't silently switch sources.
            if (cancel && !fast) { _cancel(gen); return; }
            _startPage(gen);
        });
    }

    function _startScreen() {
        var gen = _prepare('Starting screen share…');
        var md = navigator.mediaDevices;
        if (!md || typeof md.getDisplayMedia !== 'function') { _startPage(gen); return; }
        _requestDisplay(gen, true, true);
    }

    // ── camera (every phone and tablet) ─────────────────────────────────────────
    function _startCamera(facing) {
        _closeSourceSheet();
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function' || !window.isSecureContext) {
            alert('The camera needs a secure page (HTTPS). Sharing the screen still works.');
            return;
        }
        var gen = _prepare(facing === 'user' ? 'Starting front camera…' : 'Starting back camera…');
        var videoP;
        try {
            videoP = navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
        } catch (err) {
            _fail(gen, 'The camera is not available in this browser.');
            return;
        }
        var micP = _requestMic();
        videoP.then(function (cam) {
            return micP.then(function (mic) {
                if (!_alive(gen)) {
                    _stopTracks(cam);
                    if (mic) _stopTracks(mic);
                    return;
                }
                if (mic) mic.getAudioTracks().forEach(function (t) { cam.addTrack(t); });
                var label = facing === 'user' ? 'Front camera' : 'Back camera';
                _goLive(gen, cam, 'Sharing your camera — viewers can tap Watch', label);
            });
        }).catch(function (err) {
            micP.then(function (mic) { if (mic) _stopTracks(mic); });
            var name = (err && err.name) || '';
            if (name === 'NotAllowedError' || name === 'AbortError') { _cancel(gen); return; }
            _fail(gen, 'Camera failed: ' + ((err && (err.message || name)) || 'unavailable'));
        });
    }

    // ── live capture of this page (phones and tablets have no system picker) ───
    function _stopPageLoop() {
        _pageOn = false;
        if (_pageRaf) { cancelAnimationFrame(_pageRaf); _pageRaf = 0; }
    }

    function _startPage(gen) {
        if (!_alive(gen)) return;
        _stopPageLoop();
        var canvas = _pageCanvas;
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'ss-capture-canvas';
            canvas.setAttribute('aria-hidden', 'true');
            canvas.style.cssText = 'position:fixed;left:-12000px;top:0;width:2px;height:2px;pointer-events:none';
            document.body.appendChild(canvas);
            _pageCanvas = canvas;
        }
        if (typeof canvas.captureStream !== 'function') {
            _fail(gen, 'This browser cannot share the screen.');
            return;
        }
        var ctx = canvas.getContext('2d', { alpha: false });
        var pageStream;
        try { pageStream = canvas.captureStream(8); }
        catch (err) { _fail(gen, 'This browser cannot share the screen.'); return; }

        var track = pageStream.getVideoTracks()[0];
        _pageOn = true;
        var last = 0;
        function frame(ts) {
            if (!_pageOn || !_alive(gen)) return;
            _pageRaf = requestAnimationFrame(frame);
            if (ts - last < 110) return;
            last = ts;
            try { _paintPage(canvas, ctx); } catch (e) {}
            if (track && track.requestFrame) { try { track.requestFrame(); } catch (e2) {} }
        }
        try { _paintPage(canvas, ctx); } catch (e) {}
        if (track && track.requestFrame) { try { track.requestFrame(); } catch (e) {} }
        _pageRaf = requestAnimationFrame(frame);

        var maskMsg = panel && panel.querySelector('.ss-mask-msg');
        if (maskMsg) maskMsg.textContent = 'Sharing this page…';
        _setStatus('Allow the microphone to add sound, or block it to share video only.');

        _requestMic().then(function (mic) {
            if (!_alive(gen)) {
                _stopPageLoop();
                _stopTracks(pageStream);
                if (mic) _stopTracks(mic);
                return;
            }
            if (mic) mic.getAudioTracks().forEach(function (t) { pageStream.addTrack(t); });
            _goLive(gen, pageStream, 'Sharing your screen — viewers can tap Watch', 'This page');
        });
    }

    function _paintPage(canvas, ctx) {
        var w = Math.max(1, window.innerWidth);
        var h = Math.max(1, window.innerHeight);
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (w * dpr > 1280) dpr = 1280 / w;
        if (h * dpr > 1280) dpr = Math.min(dpr, 1280 / h);
        if (dpr < 0.25) dpr = 0.25;
        var pw = Math.max(1, Math.round(w * dpr));
        var ph = Math.max(1, Math.round(h * dpr));
        if (canvas.width !== pw || canvas.height !== ph) {
            canvas.width = pw;
            canvas.height = ph;
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#14201f';
        ctx.fillRect(0, 0, pw, ph);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.textBaseline = 'top';
        var bodyBg = getComputedStyle(document.body).backgroundColor;
        if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent') {
            ctx.fillStyle = bodyBg;
            ctx.fillRect(0, 0, w, h);
        }
        _paintEl(ctx, document.body);
    }

    var _SKIP_TAGS = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, NOSCRIPT: 1, TEMPLATE: 1, HEAD: 1, BR: 1, WBR: 1 };
    var _SKIP_IDS = {
        'ss-capture-canvas': 1, 'ss-source-sheet': 1, 'screen-share-panel': 1,
        'ss-viewer-panel': 1, 'ss-watch-bar': 1, 'harmony-gate': 1
    };

    function _paintEl(ctx, el) {
        if (!el || el.nodeType !== 1) return;
        var tag = (el.tagName || '').toUpperCase();
        if (_SKIP_TAGS[tag] || _SKIP_IDS[el.id]) return;
        var style;
        try { style = getComputedStyle(el); } catch (e) { return; }
        if (!style || style.display === 'none' || style.visibility === 'hidden') return;
        var op = parseFloat(style.opacity);
        if (op === 0) return;
        var r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        if (r.bottom < -20 || r.top > window.innerHeight + 20 || r.right < -20 || r.left > window.innerWidth + 20) return;

        ctx.save();
        if (op < 1) ctx.globalAlpha *= op;

        var bg = style.backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            ctx.fillStyle = bg;
            ctx.fillRect(r.left, r.top, r.width, r.height);
        }

        var clip = style.overflowX !== 'visible' || style.overflowY !== 'visible';
        if (clip) {
            ctx.beginPath();
            ctx.rect(r.left, r.top, r.width, r.height);
            ctx.clip();
        }

        if (tag === 'IMG' && el.complete && el.naturalWidth) {
            try { ctx.drawImage(el, r.left, r.top, r.width, r.height); } catch (e) {}
        } else if (tag === 'CANVAS' && el.width && el.height) {
            try { ctx.drawImage(el, r.left, r.top, r.width, r.height); } catch (e) {}
        } else if (tag === 'VIDEO' && el.readyState >= 2 && !el.classList.contains('ss-video')) {
            try { ctx.drawImage(el, r.left, r.top, r.width, r.height); } catch (e) {}
        } else if ((tag === 'INPUT' || tag === 'TEXTAREA') && el.type !== 'range' && el.type !== 'password') {
            var val = el.value || el.getAttribute('placeholder') || '';
            if (val) {
                ctx.fillStyle = el.value ? style.color : 'rgba(255,255,255,0.45)';
                ctx.font = (style.fontStyle || 'normal') + ' ' + (style.fontWeight || '400') + ' ' + (style.fontSize || '14px') + ' ' + (style.fontFamily || 'sans-serif');
                ctx.fillText(String(val).slice(0, 200), r.left + 10, r.top + Math.max(4, (r.height - (parseFloat(style.fontSize) || 14)) / 2), Math.max(8, r.width - 20));
            }
        } else {
            _paintTexts(ctx, el, style, r);
        }

        if (tag !== 'IMG' && tag !== 'CANVAS' && tag !== 'VIDEO' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'IFRAME') {
            var kids = el.children;
            for (var i = 0; i < kids.length; i++) _paintEl(ctx, kids[i]);
        }
        ctx.restore();
    }

    function _paintTexts(ctx, el, style, r) {
        var nodes = el.childNodes;
        var hasText = false;
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].nodeType === 3 && nodes[i].textContent && nodes[i].textContent.trim()) { hasText = true; break; }
        }
        if (!hasText) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(r.left, r.top, r.width, r.height);
        ctx.clip();
        var text = '';
        for (var j = 0; j < nodes.length; j++) {
            if (nodes[j].nodeType === 3) text += nodes[j].textContent;
        }
        text = text.replace(/\s+/g, ' ').trim();
        if (!text) { ctx.restore(); return; }
        ctx.fillStyle = style.color || '#fff';
        ctx.font = (style.fontStyle || 'normal') + ' ' + (style.fontWeight || '400') + ' ' + (style.fontSize || '14px') + ' ' + (style.fontFamily || 'sans-serif');
        var padL = parseFloat(style.paddingLeft) || 0;
        var padT = parseFloat(style.paddingTop) || 0;
        var x = r.left + padL;
        var y = r.top + padT;
        var maxW = Math.max(8, r.width - padL - (parseFloat(style.paddingRight) || 0));
        var maxH = Math.max(8, r.height - padT - (parseFloat(style.paddingBottom) || 0));
        var fs = parseFloat(style.fontSize) || 14;
        var lineH = parseFloat(style.lineHeight);
        if (!isFinite(lineH) || lineH < fs) lineH = fs * 1.35;
        if (maxH < lineH * 1.7) {
            ctx.fillText(text.slice(0, 400), x, y, maxW);
            ctx.restore();
            return;
        }
        var words = text.split(' ');
        var line = '';
        var yy = y;
        var limit = y + maxH;
        for (var w = 0; w < words.length; w++) {
            var test = line ? line + ' ' + words[w] : words[w];
            if (line && ctx.measureText(test).width > maxW) {
                ctx.fillText(line, x, yy);
                yy += lineH;
                if (yy > limit) { ctx.restore(); return; }
                line = words[w];
            } else {
                line = test;
            }
        }
        if (line && yy <= limit) ctx.fillText(line, x, yy, maxW);
        ctx.restore();
    }

    // ── source picker (phones and tablets) ──────────────────────────────────────
    function _buildSourceSheet() {
        var sheet = document.createElement('div');
        sheet.id = 'ss-source-sheet';
        sheet.setAttribute('hidden', '');
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-label', 'Choose what to share');
        sheet.innerHTML =
            '<div class="ss-source-card">' +
                '<div class="ss-source-title">Share</div>' +
                '<p class="ss-source-sub">Share your screen, or a camera. Everyone in the room can watch.</p>' +
                '<button type="button" class="ss-source-opt" data-src="screen">Share screen</button>' +
                '<button type="button" class="ss-source-opt" data-src="user">Front camera</button>' +
                '<button type="button" class="ss-source-opt" data-src="environment">Back camera</button>' +
                '<button type="button" class="ss-source-cancel">Cancel</button>' +
            '</div>';
        document.body.appendChild(sheet);
        _sourceSheet = sheet;
        sheet.addEventListener('click', function (e) {
            if (e.target === sheet) { _closeSourceSheet(); return; }
            var opt = e.target.closest && e.target.closest('[data-src]');
            if (opt) {
                var src = opt.getAttribute('data-src');
                if (src === 'screen') _startScreen();
                else _startCamera(src === 'user' ? 'user' : 'environment');
                return;
            }
            if (e.target.classList && e.target.classList.contains('ss-source-cancel')) _closeSourceSheet();
        });
    }
    function _openSourceSheet() {
        if (!_sourceSheet) _buildSourceSheet();
        _sourceSheet.removeAttribute('hidden');
    }
    function _closeSourceSheet() {
        if (_sourceSheet) _sourceSheet.setAttribute('hidden', '');
    }

    function start() {
        if (!isSupported()) {
            alert('Sharing is not available in this browser.');
            return;
        }
        if (_sourceSheet && !_sourceSheet.hasAttribute('hidden')) {
            _closeSourceSheet();
            return;
        }
        if (_isHandheld()) { _openSourceSheet(); return; }
        _startScreen();
    }

    function _announce() {
        _sig({ t: 'ann', from: _myId(), name: _myName() });
    }

    function _teardown(keepPanel) {
        // Reset drag state so it can never be stuck
        _dragTarget = null;

        clearInterval(_reannTimer);
        _reannTimer = null;
        _stopPageLoop();

        if (stream) {
            var dying = stream;
            stream = null; // before stop(), so the track's "ended" handler doesn't call stop()
            _stopTracks(dying);
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
        _shareGen++;
        _closeSourceSheet();
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
            btn.title         = 'Sharing is not available in this browser';
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
