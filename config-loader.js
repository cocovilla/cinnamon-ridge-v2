/**
 * config-loader.js — Cinnamon Ridge Website Configuration Engine
 *
 * Reads all the text files from the config/ folder and applies
 * their content to the website automatically.
 *
 * Non-technical users only ever edit the .txt files in config/.
 * They never need to touch this file.
 */

(function () {

    // ── SECTION FILES ──────────────────────────────────────────────────────
    // Each entry has:
    //   url    → which file to load
    //   prefix → added to the front of every key in that file
    //            (matches the data-cfg attributes in index.html)

    var SECTION_FILES = [
        { url: 'config/01-general.txt', prefix: 'site.' },
        { url: 'config/02-navigation.txt', prefix: 'nav.' },
        { url: 'config/03-hero.txt', prefix: 'hero.' },
        { url: 'config/04-about.txt', prefix: 'about.' },
        { url: 'config/05-rooms-heading.txt', prefix: 'rooms.' },
        { url: 'config/06-pool.txt', prefix: 'pool.' },
        { url: 'config/07-location.txt', prefix: 'location.' },
        { url: 'config/08-contact.txt', prefix: 'contact.' },
        { url: 'config/09-booking-bar.txt', prefix: 'booking.bar.' },
        { url: 'config/10-footer.txt', prefix: 'footer.' }
    ];

    // ── ROOM FILES ─────────────────────────────────────────────────────────
    // Each room file is loaded and its keys prefixed with room.N.
    // To add more rooms, add more entries here.

    var ROOM_FILES = [
        { url: 'config/rooms/room-01.txt', num: 1 },
        { url: 'config/rooms/room-02.txt', num: 2 },
        { url: 'config/rooms/room-03.txt', num: 3 },
        { url: 'config/rooms/room-04.txt', num: 4 }
    ];

    // ── PARSER ─────────────────────────────────────────────────────────────
    // Reads a text file and returns a plain { key: value } object.
    // Lines starting with # are ignored (they are comments for the user).

    function parseConfig(text) {
        var cfg = {};
        var lines = text.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line || line.charAt(0) === '#') continue;
            var eq = line.indexOf('=');
            if (eq === -1) continue;
            var key = line.substring(0, eq).trim();
            var val = line.substring(eq + 1).trim();
            if (key && key.indexOf('═') === -1 && key.indexOf('║') === -1) {
                cfg[key] = val;   // skip box-drawing border lines
            }
        }
        return cfg;
    }

    // ── FETCH HELPER ───────────────────────────────────────────────────────
    // Fetches a file; returns empty string if the file is missing or errors.

    function fetchFile(url) {
        return fetch(url)
            .then(function (r) { return r.ok ? r.text() : ''; })
            .catch(function () { return ''; });
    }

    // ── LOAD ALL CONFIG FILES ──────────────────────────────────────────────
    // Fetches all section files and room files in parallel, then merges
    // everything into one big { key: value } object.

    function loadAll() {
        var all = [];

        // Section files → add their prefix to every key
        SECTION_FILES.forEach(function (sf) {
            all.push(
                fetchFile(sf.url).then(function (text) {
                    var raw = parseConfig(text);
                    var out = {};
                    Object.keys(raw).forEach(function (k) {
                        out[sf.prefix + k] = raw[k];
                    });
                    return out;
                })
            );
        });

        // Room files → prefix every key with  room.N.
        ROOM_FILES.forEach(function (rf) {
            all.push(
                fetchFile(rf.url).then(function (text) {
                    var raw = parseConfig(text);
                    var out = {};
                    var p = 'room.' + rf.num + '.';
                    Object.keys(raw).forEach(function (k) {
                        out[p + k] = raw[k];
                    });
                    return out;
                })
            );
        });

        return Promise.all(all).then(function (results) {
            var merged = {};
            results.forEach(function (obj) {
                Object.keys(obj).forEach(function (k) { merged[k] = obj[k]; });
            });
            return merged;
        });
    }

    // ── ROOM BUILDER ───────────────────────────────────────────────────────
    // Turns the merged config into the structured rooms array Alpine.js needs.

    function buildRooms(cfg) {
        var rooms = [];
        for (var i = 1; i <= 20; i++) {
            var p = 'room.' + i + '.';
            if (!cfg[p + 'name']) break;

            // Amenities
            var amenities = [];
            for (var a = 1; a <= 12; a++) {
                var am = cfg[p + 'amenity.' + a];
                if (!am) break;
                var sp = am.indexOf(' ');
                if (sp > 0) {
                    amenities.push({ icon: am.substring(0, sp), label: am.substring(sp + 1) });
                } else {
                    amenities.push({ icon: '·', label: am });
                }
            }

            // Images  →  images/rooms/room-01/1.JPG, 2.JPG, ...
            var count = parseInt(cfg[p + 'image.count']) || 0;
            var folder = 'images/rooms/room-' + i;
            var images = [];
            for (var j = 1; j <= count; j++) {
                images.push(folder + '/' + j + '.JPG');
            }

            rooms.push({
                id: 'room-0' + i,
                label: cfg[p + 'label'] || ('Room 0' + i),
                name: cfg[p + 'name'],
                subtitle: cfg[p + 'subtitle'] || '',
                guests: parseInt(cfg[p + 'guests']) || 2,
                beds: cfg[p + 'bed.type'] || '1 Bed',
                bedType: cfg[p + 'bed.type'] || '1 Bed',
                view: cfg[p + 'view'] || '',
                description: cfg[p + 'description'] || '',
                amenities: amenities,
                images: images
            });
        }
        return rooms;
    }

    // ── LOCATION POINTS ────────────────────────────────────────────────────

    function buildLocationPoints(cfg) {
        var pts = [];
        for (var i = 1; i <= 10; i++) {
            var v = cfg['location.point.' + i];
            if (!v) break;
            pts.push(v);
        }
        return pts;
    }

    // ── APPLY TO DOM ───────────────────────────────────────────────────────
    // Fills every element with a  data-cfg="key"  attribute.

    function applyText(cfg) {

        // Generic text replacement
        var els = document.querySelectorAll('[data-cfg]');
        for (var i = 0; i < els.length; i++) {
            var key = els[i].getAttribute('data-cfg');
            if (cfg[key] !== undefined && cfg[key] !== '') {
                els[i].textContent = cfg[key];
            }
        }

        // Page <title>
        if (cfg['site.name']) {
            document.title = cfg['site.name'] + ' | Luxury Boutique Villa Unawatuna';
        }

        // <meta name="description">
        if (cfg['site.description']) {
            var meta = document.querySelector('meta[name="description"]');
            if (meta) meta.setAttribute('content', cfg['site.description']);
        }

        // href attributes  (data-cfg-href="key")
        els = document.querySelectorAll('[data-cfg-href]');
        for (var i = 0; i < els.length; i++) {
            var key = els[i].getAttribute('data-cfg-href');
            if (cfg[key]) els[i].href = cfg[key];
        }

        // iframe src  (data-cfg-iframe="key")
        els = document.querySelectorAll('[data-cfg-iframe]');
        for (var i = 0; i < els.length; i++) {
            var key = els[i].getAttribute('data-cfg-iframe');
            if (cfg[key]) els[i].src = cfg[key];
        }

        // WhatsApp link  (built from contact.whatsapp.number)
        if (cfg['contact.whatsapp.number']) {
            var wa = document.querySelector('[data-cfg-whatsapp]');
            if (wa) wa.href = 'https://wa.me/' + cfg['contact.whatsapp.number'].replace(/\D/g, '');
        }

        // Phone link
        if (cfg['contact.phone.number']) {
            var tel = document.querySelector('[data-cfg-tel]');
            if (tel) tel.href = 'tel:' + cfg['contact.phone.number'];
        }

        // Email link
        if (cfg['contact.email.address']) {
            var mail = document.querySelector('[data-cfg-email]');
            if (mail) mail.href = 'mailto:' + cfg['contact.email.address'];
        }

        // Location bullet points  →  <ul data-cfg-location-points>
        var locList = document.querySelector('[data-cfg-location-points]');
        if (locList) {
            var pts = buildLocationPoints(cfg);
            locList.innerHTML = pts.map(function (pt) {
                return '<li class="flex items-center gap-2.5">' +
                    '<span class="w-1.5 h-1.5 bg-[#CBA35C] rounded-full flex-shrink-0"></span>' +
                    pt + '</li>';
            }).join('');
        }

        // Facebook href  (data-cfg-href="contact.facebook.url" )
        // Already handled by the generic data-cfg-href loop above.

        // Footer contact lines
        if (cfg['contact.phone.display'] || cfg['contact.whatsapp.number']) {
            var fwa = document.querySelector('[data-cfg-footer-whatsapp]');
            if (fwa) fwa.textContent = 'WhatsApp: ' + (cfg['contact.phone.display'] || cfg['contact.whatsapp.number']);
        }
        if (cfg['contact.email.address']) {
            var fem = document.querySelector('[data-cfg-footer-email]');
            if (fem) fem.textContent = 'Email: ' + cfg['contact.email.address'];
        }
    }

    // ── PATCH ALPINE ROOMS ─────────────────────────────────────────────────
    // Replaces Alpine.js room data reactively after init.
    // Retries every 150 ms for up to 3 s in case Alpine isn't fully ready.

    function patchAlpineRooms(cfg) {
        var newRooms = buildRooms(cfg);
        if (!newRooms.length) {
            console.warn('[CR] buildRooms returned 0 rooms — check room config files.');
            return;
        }

        var attempts = 0;

        function tryPatch() {
            attempts++;
            var section = document.querySelector('#rooms');
            if (!section) { console.warn('[CR] #rooms element not found.'); return; }

            var stack = section._x_dataStack;
            var data = stack && stack[0];

            if (!data || !Array.isArray(data.rooms)) {
                if (attempts < 20) { setTimeout(tryPatch, 150); }
                else { console.error('[CR] Alpine rooms data not accessible after 3 s.'); }
                return;
            }

            // Splice in new rooms reactively
            data.rooms.splice(0, data.rooms.length);
            for (var i = 0; i < newRooms.length; i++) { data.rooms.push(newRooms[i]); }
            data.selectedRoom = 0;
            data.activeImg = 0;
            console.log('[CR] ' + newRooms.length + ' rooms patched. First image: ' + (newRooms[0].images[0] || 'none'));
        }

        tryPatch();
    }


    // ── BOOT ───────────────────────────────────────────────────────────────

    var configPromise = loadAll()
        .then(function (cfg) {
            window.SITE_CONFIG = cfg;
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function () { applyText(cfg); });
            } else {
                applyText(cfg);
            }
            return cfg;
        })
        .catch(function (err) {
            console.warn('[Cinnamon Ridge] Config load error — using built-in defaults.', err);
            return null;
        });

    // Chain onto Alpine after it finishes initialising
    document.addEventListener('alpine:initialized', function () {
        configPromise.then(function (cfg) {
            if (!cfg) return;
            applyText(cfg);
            patchAlpineRooms(cfg);
        });
    });

})();
