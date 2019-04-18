# Book View
<img alt="preview of book view in use" src="https://user-images.githubusercontent.com/5412095/56378955-da1e6500-620e-11e9-895f-22b1614fea66.gif" width="500" />

A rudimentary “reader view” that renders its contents like a book instead of a scroll view.

Currently supported websites include:

- AO3

# Usage
Currently, only keyboard navigation is supported: `;` to open, and arrow keys to navigate.

To use this script on an arbitrary page, run the script and then do e.g. `window.bookView.render(document.querySelector('#article'))` if the contents that should be rendered are in the `#article` DOM node.

### Installation as a userscript
While this is far from an ideal solution, this can be installed as a userscript by creating a one with something like the following:
```js
// ==UserScript==
// @name        Book View
// @description Renders the page as a book.
// @require     https://github.com/cpsdqs/book-view/releases/download/RELEASE_NUMBER_GOES_HERE/main.js
// @match       https://archiveofourown.org/works/**
// ==/UserScript==
```
(replace `RELEASE_NUMBER_GOES_HERE` with a release number in *Releases* above)

This also allows for configuration by setting properties on `window.bookView.config` in the script, which are partially documented [here](https://cpsdqs.github.io/dashset/docs/context.html).

Additional known hosts can be added by simply doing:
```js
window.bookView.knownHosts['website.name'] = () => {
    bookView.render(document.querySelector('#article-contents-or-something'));
    bookView.view.on('prev-chapter', () => { /* do something, maybe */ });
    bookView.view.on('next-chapter', () => { /* do something, maybe */ });
};
```
