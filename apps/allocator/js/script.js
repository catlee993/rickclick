function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function generateUrl(theme) {
    let noun, verb, adverb, baseUrl, templates;

    switch (theme) {
        case 'tech':
            baseUrl = 'https://techweekly.xyz';
            noun = getRandomItem(techNouns);
            verb = getRandomItem(techVerbs);
            adverb = getRandomItem(techAdverbs);
            templates = techTemplates;
            break;
        case 'business':
            baseUrl = 'https://bizwiz.lol';
            noun = getRandomItem(businessNouns);
            verb = getRandomItem(businessVerbs);
            adverb = getRandomItem(businessAdverbs);
            templates = businessTemplates;
            break;
        case 'news':
            baseUrl = 'https://wirenow.info';
            noun = getRandomItem(newsNouns);
            verb = getRandomItem(newsVerbs);
            adverb = getRandomItem(newsAdverbs);
            templates = newsTemplates;
            break;
        default:
            noun = "rick astley";
            verb = "never gonna";
            adverb = "give you up";
            templates = ["{verb} {noun} {adverb}"];
    }

    const template = getRandomItem(templates);
    const title = template
        .replace("{verb}", verb)
        .replace("{noun}", noun)
        .replace("{adverb}", adverb)
        .replace(/[^a-zA-Z0-9\s-]/g, '_')
        .replace(/\s+/g, '-')
        .toLowerCase();

    return `${baseUrl}/${title}`;
}

function showNotification(message, mouseEvent) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerText = message;

    document.body.appendChild(notification);

    const notificationWidth = notification.offsetWidth;
    const notificationHeight = notification.offsetHeight;

    let left = mouseEvent.clientX;
    let top = mouseEvent.clientY - notificationHeight - 10;

    if (left + notificationWidth > window.innerWidth) {
        left = window.innerWidth - notificationWidth - 10;
    }
    if (top < 0) {
        top = mouseEvent.clientY + 10;
    }

    notification.style.left = `${left}px`;
    notification.style.top = `${top}px`;

    window.getComputedStyle(notification).opacity;

    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 3000);
}

function copyToClipboard(text, event) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification(`${text}\nwas copied to your clipboard!`, event);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

function handleButtonClick(theme, event) {
    const url = generateUrl(theme);
    console.log('generated url:', url);
    copyToClipboard(url, event);
}

document.getElementById('tech').addEventListener('click', (event) => handleButtonClick('tech', event));
document.getElementById('business').addEventListener('click', (event) => handleButtonClick('business', event));
document.getElementById('news').addEventListener('click', (event) => handleButtonClick('news', event));

// --- Shrek easter-egg video: preload + signed URL + self-heal (mirrors the
//     landing sites' rickroll.js so it loads instantly and recovers from errors).
(function () {
    const CFG = window.RICK_CONFIG || {};
    const REVEAL_AT = (CFG.revealAt != null) ? CFG.revealAt : 0;
    const FALLBACK = CFG.video || './latest-footage.mp4';
    let cachedSrc = CFG.signEndpoint ? null : FALLBACK;
    let preloadEl = null;
    let refreshTimer = null;

    function buildPreload(src) {
        if (!src) return;
        if (!preloadEl) {
            preloadEl = document.createElement('video');
            preloadEl.muted = true; preloadEl.preload = 'auto'; preloadEl.playsInline = true;
            preloadEl.setAttribute('playsinline', '');
            preloadEl.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
            document.body.appendChild(preloadEl);
        }
        if (preloadEl.getAttribute('src') !== src) { preloadEl.src = src; preloadEl.load(); }
    }

    function fetchSigned() {
        if (!CFG.signEndpoint) return Promise.resolve(FALLBACK);
        return fetch(CFG.signEndpoint, { credentials: 'omit', cache: 'no-store' })
            .then(r => { if (!r.ok) throw new Error('sign ' + r.status); return r.json(); })
            .then(j => {
                cachedSrc = j.url;
                buildPreload(cachedSrc);
                if (refreshTimer) clearTimeout(refreshTimer);
                refreshTimer = setTimeout(() => fetchSigned().catch(() => {}), Math.max(15, (j.ttl || 120) - 30) * 1000);
                return cachedSrc;
            });
    }

    function goFullscreen(el) {
        const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if (fn) { try { const p = fn.call(el); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
    }

    fetchSigned().catch(() => {}); // warm up on page load

    document.getElementById('shrek3').addEventListener('click', () => {
        document.querySelector('.button-container').style.display = 'none';
        document.querySelector('.gif-container').style.display = 'none';
        document.querySelector('.shrek-container').style.display = 'none';

        const videoContainer = document.createElement('div');
        videoContainer.className = 'video-container';
        videoContainer.style.cssText = 'position:fixed;inset:0;display:flex;justify-content:center;align-items:center;background:#000;z-index:1000;';
        document.body.appendChild(videoContainer);
        goFullscreen(videoContainer);

        // Reuse the pre-buffered element for an instant start.
        const video = (preloadEl && preloadEl.getAttribute('src') === cachedSrc) ? preloadEl : document.createElement('video');
        if (video === preloadEl) { preloadEl = null; } else if (cachedSrc) { video.src = cachedSrc; }
        video.autoplay = true; video.controls = false; video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.muted = false; video.volume = 1.0;
        video.style.cssText = 'width:100%;height:100%;object-fit:contain;';
        videoContainer.appendChild(video);

        let retried = false;
        const freshen = (then) => fetchSigned().then(src => { if (src) { video.src = src; video.load(); if (then) then(); } }).catch(() => {});
        const seekAndPlay = () => {
            try { if (REVEAL_AT) video.currentTime = REVEAL_AT; } catch (e) {}
            video.muted = false; video.volume = 1.0;
            const a = video.play();
            if (a && a.catch) a.catch(() => freshen(() => video.play()));
        };
        video.addEventListener('error', () => { if (retried) return; retried = true; freshen(seekAndPlay); });
        video.addEventListener('ended', () => { try { video.currentTime = REVEAL_AT || 0; } catch (e) {} video.play(); });
        if (video.readyState >= 1) seekAndPlay(); else video.addEventListener('loadedmetadata', seekAndPlay);
    });
})();