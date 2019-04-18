import 'dashset';
import Color from 'color';
import Hypher from 'hypher';
import englishHyphenation from 'hyphenation.en-us';

const dashset = window.dashset;

class ObjectStack {
    constructor (bottom) {
        this.stack = [bottom];
    }

    dup () {
        const deepClone = x => {
            if (Array.isArray(x)) return x.map(deepClone);
            else if (typeof x === 'object' && x !== null) {
                const obj = {};
                for (const k in x) obj[k] = deepClone(x[k]);
                return obj;
            } else return x;
        }
        this.stack.push(deepClone(this.top()));
    }

    pop () {
        this.stack.pop();
    }

    top () {
        return this.stack[this.stack.length - 1];
    }
}

const paragraphyTypes = [
    HTMLParagraphElement,
    HTMLDivElement,
    HTMLBRElement,
    HTMLHRElement,
    HTMLHeadingElement,
    HTMLQuoteElement,
];

const isParagraphy = (node) => {
    for (const type of paragraphyTypes) if (node instanceof type) return true;
    return false;
};

const hyphenator = new Hypher(englishHyphenation);

function walkContent (node, state) {
    if (node.nodeType === 3) {
        // text node
        let line = node.textContent;

        // split at whitespace and dashes
        const parts = [];
        let match;
        while (match = line.match(/\s+|[-–—\u00AD]/)) {
            parts.push(line.substr(0, match.index))
            parts.push(match[0])
            line = line.substr(match.index + match[0].length)
        }
        if (line) parts.push(line);

        // split up words into syllables
        for (let part of parts) {
            const syllables = hyphenator.hyphenate(part)
            for (const i in syllables) {
                const syllable = syllables[i]

                const text = new dashset.TextNode(state.context);
                text.content = syllable;
                text.exceptStart = !!syllable.match(/^\s+$/);
                text.hyphen = i < syllables.length - 1;
                Object.assign(text, state.textStyles.top());
                state.appendInline(text);
            }
        }
    } else if (node instanceof HTMLImageElement) {
        let img = new dashset.ImageNode(state.context);
        img.src = node.src;
        state.appendInline(img);
    } else if (node.nodeType === 1) {
        const style = getComputedStyle(node);

        state.textStyles.dup();

        const textStyle = state.textStyles.top();

        if (style.fontWeight.match(/^\d+$/)) textStyle.bold = +style.fontWeight > 450;
        else if (style.fontWeight === 'normal') textStyle.bold = false;
        else if (style.fontWeight === 'bold') textStyle.bold = true;
        textStyle.italic = style.fontStyle === 'italic';
        textStyle.smallcaps = style.fontVariantCaps === 'small-caps';
        try {
            textStyle.data.color = Color(node.style.color);
        } catch (_) {}
        for (const type of style.textDecorationLine.split(/\s+/)) {
            if (type === 'underline') textStyle.data.underline = true;
            else if (type === 'line-through') textStyle.data.strike = true;
        }
        if (node.style.fontSize) {
            let size = node.style.fontSize;
            if (size.endsWith('em')) {
                textStyle.size = parseFloat(size);
            } else if (size.endsWith('px')) {
                textStyle.size = parseFloat(size) / 16;
            } else {
                // TODO: try with computed style
            }
        }
        if (node.tagName === 'CODE' || node.tagName === 'PRE') textStyle.code = true;
        if (node.tagName === 'A') {
            textStyle.data.href = node.getAttribute('href');
        }
        // heuristic
        if (node.classList.contains('spoiler')) textStyle.data.spoiler = true;

        if (style.display.includes('inline') && !isParagraphy(node)) {
            for (const child of node.childNodes) {
                walkContent(child, state);
            }
        } else {
            state.parStyles.dup();
            const parStyle = state.parStyles.top();
            state.makePar(parStyle);

            const isQuote = node instanceof HTMLQuoteElement;
            if (isQuote) parStyle.quote = true;
            if (node.style.textAlign === 'left' || node.style.textAlign.includes('justify')) {
                parStyle.align = 0;
                if (state.config.doubleParagraphs) parStyle.double = true;
                else parStyle.indent = true;
            } else if (node.style.textAlign === 'center') {
                parStyle.align = 2;
                parStyle.indent = false;
            } else if (node.style.textAlign === 'right') {
                parStyle.align = 3;
                parStyle.indent = false;
            }
            if (node instanceof HTMLParagraphElement) {
                if (state.config.doubleParagraphs) parStyle.double = true;
                else parStyle.indent = true;
            } if (node instanceof HTMLHRElement) {
                state.makeSeparator();
                parStyle.double = false;
                parStyle.indent = false;
                parStyle.align = 2;
                // fake image node for height
                state.appendInline(new dashset.ImageNode(state.context, { height: 32 }));
            }

            if (node instanceof HTMLHeadingElement) {
                textStyle.size = parseFloat(style.fontSize) / 16;
            }

            let first = true;
            for (let child of node.childNodes) {
                if (isQuote) {
                    if (!first) parStyle.join = true;
                    parStyle.joinNext = !!(parStyle.quote && child.nextElementSibling);
                }
                first = false;
                walkContent(child, state);
            }

            state.parStyles.pop();
        }

        state.textStyles.pop();
    }
}

export default function intoTypesettable (sourceContainer, context, config = {}) {
    const paragraphs = [];
    let pendingPar = null;

    const state = {
        context,
        config,
        textStyles: new ObjectStack({
            bold: false,
            italic: false,
            size: 1,
            code: false,
            smallcaps: false,
            data: {},
        }),
        parStyles: new ObjectStack({
            align: 0,
            quote: false,
            join: false,
            joinNext: false,
        }),
        appendInline (node) {
            if (pendingPar || !paragraphs.length) {
                const par = new dashset.ParagraphNode(context);
                Object.assign(par, pendingPar || {});
                paragraphs.push(par);
                pendingPar = null;
            }

            paragraphs[paragraphs.length - 1].content.push(node);
        },
        makePar (styles) {
            pendingPar = styles;
        },
        makeSeparator () {
            pendingPar = null;
            const par = new dashset.ParagraphNode(context);
            par.align = 2;
            par.indent = false;
            par.separator = true;
            paragraphs.push(par);
        },
    };

    walkContent(sourceContainer, state);

    return paragraphs;
}
