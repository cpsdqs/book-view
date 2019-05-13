const config = {
    fontFamily: 'Baskerville, Palatino, Linux Libertine O, serif',
    fontSize: 13,
    codeFontFamily: 'Menlo, Hack, Fira Mono, monospace',
    codeFontSize: 11,
    openKey: ';',
    doubleParagraphs: false,
    light: true,
};

import intoTypesettable from './dom-to-typesettable';
import view from './book-view';
import './style.less';

view.setConfig(config);

const bookView = window.bookView = {
    config,
    intoTypesettable,
    view,
    render (node) {
        if (!(node instanceof Node)) throw new Error('Can’t render non-DOM node');
        const context = new dashset.Context(config);
        context.width = Math.max(Math.min(context.width, innerWidth / 2.5), context.width * 0.7);
        bookView.view.render(bookView.intoTypesettable(node, context, bookView.config), context);
    },
    knownHosts: {
        'archiveofourown.org' () {
            const selectors = [
                '.userstuff.module',
                '#chapters',
                '#workskin',
            ];
            let contents;
            for (const selector of selectors) {
                if (contents = document.querySelector(selector)) break;
            }
            if (!contents) {
                console.error('[BV] could not find contents');
                return;
            }
            bookView.render(contents);
            const title = document.querySelector('h3.title');
            if (title) bookView.view.setTitle(title.textContent);
            bookView.view.on('prev-chapter', () => {
                document.querySelector('li.chapter.previous > a').click();
            });
            bookView.view.on('next-chapter', () => {
                document.querySelector('li.chapter.next > a').click();
            });
        },
        // TODO: add more i guess
    }
};

let didInit = false;

const handleKnownHosts = () => {
    if (didInit) return;
    didInit = true;
    for (const hostname in bookView.knownHosts) {
        if (location.hostname === hostname) {
            bookView.knownHosts[hostname]();
        }
    }
};

if (document.readyState === 'interactive' || document.readyState === 'complete') {
    // allow external scripts to register known hosts before running
    requestAnimationFrame(handleKnownHosts);
} else {
    window.addEventListener('DOMContentLoaded', handleKnownHosts);
}

window.addEventListener('load', () => {
    if (!didInit) handleKnownHosts();
})
