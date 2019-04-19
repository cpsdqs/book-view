import EventEmitter from 'events';
import { Spring, clamp } from './animation';

// #bv-book-view
// |- .bv-background
// |- .bv-header
// |  |- .bv-content-title
// |- .bv-pages
// |- .bv-footer
const container = document.createElement('div');
container.id = 'bv-book-view';
const background = document.createElement('div');
background.classList.add('bv-background');
const header = document.createElement('header');
header.classList.add('bv-header');
const pageContainer = document.createElement('div');
pageContainer.classList.add('bv-pages');
const footer = document.createElement('footer');
footer.classList.add('bv-footer');

container.style.display = 'none';

container.appendChild(background);
container.appendChild(header);
container.appendChild(pageContainer);
container.appendChild(footer);

const contentTitle = document.createElement('div');
contentTitle.classList.add('bv-content-title');
contentTitle.textContent = document.title;
header.appendChild(contentTitle);

let isOpen = false;
let config = {};
let paragraphs = [];
let typesetPages = [];
let pageNodes = [];
let layout = {};
let context = {};
let lightMode = false;
let currentPage = 0;

// list of mounted page nodes, for easy diffing in onAnimationUpdate
const mountedPageNodes = [];

// open state (0: closed, 1: open)
const openSpring = new Spring(0.85, 0.4);

// current page position
const positionSpring = new Spring(1, 0.4);

// handles book view visibility and page positions
const onAnimationUpdate = () => {
    const open = openSpring.value;
    const currentPage = positionSpring.value;

    background.style.opacity = clamp(open, 0, 1);

    if (open <= 0) {
        container.style.display = 'none';
        return;
    } else {
        container.style.display = '';
    }

    header.style.transform = `translateY(${-100 * (1 - open)}%)`;

    const twoPages = layout.twoPages;
    const cfPage = twoPages ? Math.floor(currentPage / 2) * 2 : Math.floor(currentPage);
    const cnPage = twoPages ? Math.ceil(currentPage / 2) * 2 : Math.ceil(currentPage);
    const isStatic = cfPage === cnPage;

    const least = cfPage;
    const most = cnPage + (twoPages ? 1 : 0);

    const currentNodes = [];

    for (let i = least; i <= most; i++) {
        if (!pageNodes[i]) continue;
        currentNodes.push(pageNodes[i]);
        if (!mountedPageNodes.includes(pageNodes[i])) {
            mountedPageNodes.push(pageNodes[i]);
            pageContainer.appendChild(pageNodes[i]);
        }
    }

    for (const node of mountedPageNodes.slice()) {
        if (!currentNodes.includes(node)) {
            mountedPageNodes.splice(mountedPageNodes.indexOf(node), 1);
            pageContainer.removeChild(node);
        }
    }

    const openP = 1 - open;
    const openDz = Math.pow(Math.max(0, openP), 1.5) * -context.width * 1.3;
    const openDr = Math.min(0.625 * Math.log(4 * openP + 1), 1);

    if (isStatic) {
        for (const node of currentNodes) {
            node.style.transform = '';
            node.style.opacity = '';
        }

        const left = pageNodes[cfPage];
        const right = pageNodes[cfPage + 1];

        if (left) left.dataset.position = twoPages ? 'left' : 'single';
        if (right) right.dataset.position = 'right';

        if (open !== 1) {
            if (left) {
                left.style.transform = `translateZ(${openDz}px) rotateY(${openDr * 90}deg)`;
            }
            if (right) {
                right.style.transform = `translateZ(${openDz}px) rotateY(${openDr * -90}deg)`;
            }
        }

        if (!twoPages && left) {
            left.style.transform += ' translateX(-50%)';
        }
    } else {
        const p = layout.twoPages ? (currentPage % 2) / 2 : (currentPage % 1);

        const prevLeft = pageNodes[cfPage];
        const prevRight = pageNodes[cfPage + 1];
        const nextLeft = pageNodes[cnPage];
        const nextRight = pageNodes[cnPage + 1];

        const setPageTransform = (node, p, openRot) => {
            if (!node) return;
            if (open !== 1) {
                const ry = open * p * 30 + openDr * openRot;
                node.style.transform = `translateZ(${openDz}px) rotateY(${ry}deg)`;
            } else {
                node.style.transform = `rotateY(${p * 30}deg)`;
            }
            node.style.opacity = 1 - Math.abs(p);
        };

        setPageTransform(prevLeft, -p, 90);
        setPageTransform(nextLeft, 1 - p, 90);

        if (!twoPages) {
            if (prevLeft) prevLeft.style.transform += ' translateX(-50%)';
            if (nextLeft) nextLeft.style.transform += ' translateX(-50%)';
        }

        if (prevLeft) prevLeft.dataset.position = twoPages ? 'left' : 'single';
        if (nextLeft) nextLeft.dataset.position = twoPages ? 'left' : 'single';

        if (twoPages) {
            setPageTransform(prevRight, -p, -90);
            setPageTransform(nextRight, 1 - p, -90);

            if (prevRight) prevRight.dataset.position = 'right';
            if (nextRight) nextRight.dataset.position = 'right';
        }
    }
}

openSpring.on('update', onAnimationUpdate);
positionSpring.on('update', onAnimationUpdate);

// updates page states
function updatePages () {
    openSpring.target = isOpen ? 1 : 0;
    openSpring.start();

    if (layout.twoPages) {
        currentPage = Math.floor(currentPage / 2) * 2;
    }

    positionSpring.target = currentPage;
    positionSpring.start();

    if (config.light) container.classList.add('light');
    else container.classList.remove('light');
}

// typesets paragraphs and create DOM nodes
function typeset () {
    layout = {
        twoPages: window.innerWidth > 900,
        pageWidth: context.width,
        pageHeight: Math.min(500, window.innerHeight * 0.64),
    };

    pageContainer.style.height = layout.pageHeight + 'px';

    // typeset and split into pages
    let currentPageHeight = 0;
    let currentPage = [];
    typesetPages = [currentPage];

    for (const par of paragraphs) {
        par.typeset();
        for (const line of par.lines) {
            if (currentPageHeight + line.height > layout.pageHeight) {
                currentPageHeight = 0;
                currentPage = [];
                typesetPages.push(currentPage);
            }
            currentPage.push(line);
            currentPageHeight += line.height;
        }
    }

    {
        // add “end of text” line
        let lastLine = new dashset.Line()
        lastLine.source = new dashset.ParagraphNode(context, {})
        lastLine.source.align = 3
        lastLine.content.push(new dashset.TextNode(context, { content: ' ◼' }))
        currentPage.push(lastLine)
    }

    // create DOM nodes
    pageNodes = [];

    // for quote joining (see below)
    let prevLine = null;
    let prevPar = null;

    let pageNumber = 0;

    for (const typesetPage of typesetPages) {
        const page = document.createElement('div');
        page.classList.add('bv-page');
        Object.assign(page.style, {
            fontFamily: context.fontFamily,
            fontSize: context.fontSize + 'px',
            width: context.width + 'px',
            height: layout.pageHeight + 'px',
        });

        page.dataset.pagesLeft = typesetPages.length - pageNumber - 1;
        page.dataset.pageNumber = 1 + pageNumber;
        pageNumber += 1;

        for (const line of typesetPage) {
            const par = line.source;

            const node = document.createElement('div');
            node.classList.add('bv-line');

            let justify = false;

            if (par.align === 0 && line.width > line.context.width * 0.8 && !line.lastInParagraph) {
                node.classList.add('bv-align-justify');
                justify = true;
            } else if (par.align === 2) node.classList.add('bv-align-center');
            else if (par.align === 3) node.classList.add('bv-align-right');
            else node.classList.add('bv-align-left');

            node.style.height = node.style.lineHeight = line.height + 'px';

            if (par.quote && !line.margin) {
                node.classList.add('bv-quote');
                if (par === prevPar || par.join) {
                    if (prevLine) prevLine.classList.add('bv-join-below');
                    node.classList.add('bv-join-above');
                }
            }

            prevLine = node;
            prevPar = !line.margin && par;

            if (par.separator) {
                node.classList.add('bv-separator');
            }

            const contents = line.content.map(item => ({ item }));

            while (contents[0] && contents[0].item.exceptStart) contents.pop();
            // semantically incorrect but this’ll trim spaces after as well
            while (contents[contents.length - 1]
                && contents[contents.length - 1].item.exceptStart) contents.pop();

            if (justify) {
                let totalWidth = 0
                let spaces = 0
                for (const { item } of contents) {
                    if (item.type === 'text' && item.content.match(/^\s+$/)) spaces++;
                    else totalWidth += item.width;
                }

                let x = 0;
                let space = (layout.pageWidth - totalWidth) / spaces;
                if (space > 10) space = 6;
                for (const item of contents) {
                    item.x = x;
                    if (item.item.type === 'text' && item.item.content.match(/^\s+$/)) x += space;
                    else x += item.item.width;
                }
            }

            for (const { item, x } of contents) {
                if (item.type === 'spacer') {
                    const span = document.createElement('span');
                    span.classList.add('bv-spacer');
                    span.style.display = 'inline-block';
                    span.style.width = item.width + 'px';
                    span.style.height = item.height + 'px';
                    node.append(span);
                } else if (item.type === 'text') {
                    const span = document.createElement(item.data.href ? 'a' : 'span');
                    span.classList.add('bv-text');

                    if (item.data.href) span.href = item.data.href;

                    if (item.italic) span.style.fontStyle = 'italic';
                    if (item.bold) span.style.fontWeight = context.boldWeight;
                    if (item.smallcaps) span.style.fontVariantCaps = 'small-caps';
                    if (item.size !== 1) span.style.fontSize = item.size + 'em';
                    if (item.code) {
                        span.style.fontFamily = context.codeFontFamily;
                        span.style.fontSize = context.codeFontSize + 'px';
                    }
                    if (item.data.underline && item.data.strike) {
                        span.style.textDecorationLine = 'underline line-through';
                    } else if (item.data.underline) span.style.textDecorationLine = 'underline';
                    else if (item.data.strike) span.style.textDecorationLine = 'line-through';
                    if (item.data.color) {
                        const hsla = item.data.color.hsl().array();
                        if (hsla.length === 3) hsla.push(1);
                        if ((!lightMode && hsla[2] < 40) || (lightMode && hsla[2] > 80)) {
                            hsla[2] = 100 - hsla[2];
                        }
                        const r = hsla.map(x => Math.round(x));
                        span.style.color = `hsla(${r[0]}, ${r[1]}%, ${r[2]}%, ${
                            hsla[3].toFixed(2)})`;
                    }
                    if (item.data.spoiler) span.classList.add('bv-spoiler');

                    span.textContent = item.content + (item.hyphenEnabled ? '-' : '');

                    if (justify && !CSS.supports('text-align-last', 'justify')) {
                        span.style.position = 'absolute';
                        span.style.left = x + 'px';
                        span.style.bottom = '0';
                        span.style.whiteSpace = 'pre';
                    }

                    node.append(span);
                } else if (item.type === 'image') {
                    let image = new Image();
                    if (!item.__didTryLoad) {
                        item.__didTryLoad = true;
                        image.addEventListener('load', e => {
                            item.imageWidth = image.width;
                            item.imageHeight = image.height;
                            typeset();
                        });
                    }
                    image.src = item.src;
                    image.style.maxWidth = '100%';
                    node.append(image);
                } else {
                    console.warn('[BV] unhandled item type', item.type);
                }
            }

            page.appendChild(node);
        }

        pageNodes.push(page);
    }

    updatePages();
}

function beforeNavigate () {
    if (isOpen) {
        sessionStorage.bvIsInBookMode = true;
    } else {
        delete sessionStorage.bvIsInBookMode;
    }
}

if (sessionStorage.bvIsInBookMode) {
    delete sessionStorage.bvIsInBookMode;
    isOpen = true;
    openSpring.value = 1.2;
    updatePages();
}

const view = new EventEmitter();

let pendingTypeset = false;
const forwardKeys = ['ArrowRight', 'Enter', ' ', 'l', 'd'];
const backwardKeys = ['ArrowLeft', 'h', 'a'];

window.addEventListener('keydown', e => {
    if (document.activeElement !== document.body) return;

    if (e.key === config.openKey) {
        e.preventDefault();

        isOpen = !isOpen;

        if (pendingTypeset) {
            pendingTypeset = false;
            typeset();
        }

        updatePages();
    } else if (forwardKeys.includes(e.key)) {
        e.preventDefault();

        currentPage += layout.twoPages ? 2 : 1;
        if (currentPage >= pageNodes.length) {
            currentPage = pageNodes.length - 1;
            beforeNavigate();
            view.emit('next-chapter');
        }
        if (layout.twoPages) currentPage = Math.floor(currentPage / 2) * 2;
        updatePages();
    } else if (backwardKeys.includes(e.key)) {
        e.preventDefault();

        currentPage -= layout.twoPages ? 2 : 1;
        if (currentPage < 0) {
            currentPage = 0;
            beforeNavigate();
            view.emit('prev-chapter');
        }
        updatePages();
    }
});

window.addEventListener('resize', () => {
    if (isOpen) {
        typeset();
    } else {
        pendingTypeset = true;
    }
});

function render (pars, ctx) {
    paragraphs = pars;
    context = ctx;
    typeset();
}

const mount = function () {
    if (document.body && document.body.appendChild) {
        document.body.appendChild(container);
    } else requestAnimationFrame(mount);
};
mount();

function setTitle (title) {
    contentTitle.textContent = title;
}

Object.assign(view, {
    setConfig: cfg => config = cfg,
    setTitle,
    render,
});

export default view;
