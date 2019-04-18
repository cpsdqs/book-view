# Book View
<img alt="preview of book view in use" src="https://user-images.githubusercontent.com/5412095/56378955-da1e6500-620e-11e9-895f-22b1614fea66.gif" width="500" />

A rudimentary “reader view” that renders its contents like a book instead of a scroll view.

Currently supported websites include:

- AO3

# Usage
Currently, only keyboard navigation is supported: `;` to open, and arrow keys to navigate.

To use this script on an arbitrary page, run the script and then do e.g. `window.bookView.render(document.querySelector('#article'))` if the contents that should be rendered are in the `#article` DOM node.
