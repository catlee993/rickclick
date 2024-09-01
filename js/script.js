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

document.getElementById('shrek3').addEventListener('click', () => {
    // Hide the existing content
    document.querySelector('.button-container').style.display = 'none';
    document.querySelector('.gif-container').style.display = 'none';
    document.querySelector('.shrek-container').style.display = 'none';

    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    videoContainer.style.position = 'absolute';
    videoContainer.style.top = '0';
    videoContainer.style.left = '0';
    videoContainer.style.width = '100%';
    videoContainer.style.height = '100%';
    videoContainer.style.display = 'flex';
    videoContainer.style.justifyContent = 'center';
    videoContainer.style.alignItems = 'center';
    videoContainer.style.backgroundColor = 'black';
    videoContainer.style.zIndex = '1000';

    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.style.width = '80%';
    videoElement.style.height = 'auto';
    videoElement.style.maxWidth = '1200px';
    videoElement.style.maxHeight = '90%';

    const sourceElement = document.createElement('source');
    sourceElement.src = './shrek-clip-compilation.mp4';
    sourceElement.type = 'video/mp4';

    videoElement.appendChild(sourceElement);

    videoContainer.appendChild(videoElement);

    document.body.appendChild(videoContainer);
    
    videoElement.addEventListener('loadedmetadata', () => {
        videoElement.currentTime = 43;
        videoElement.play().catch(err => {
            console.error('Autoplay failed:', err);
        });
    });
});