// Small DOM helpers. Imported by components that need terse selectors.
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const on = (el, event, handler) => el && el.addEventListener(event, handler);
