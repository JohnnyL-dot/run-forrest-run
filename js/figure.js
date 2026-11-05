/*
 * RUN-FORREST-RUN – figure.js
 * Filversion: 1.2.0
 * Ändringsnotering:
 *  1.2.0 – Ny fil: egenritad figur (inbäddad SVG, inga externa resurser) med löpande och vilande pose
 *          (TRN-SIG-010 till 014). Animeringen görs med CSS (se css/style.css) och påverkar inte tidtagningen.
 * Modulen innehåller bara ritningen och ett litet gränssnitt för att välja pose och om den rör sig.
 */

/* Figuren vetter åt höger. Leder (höft, axel, armbåge, knä) är origo för respektive grupp i CSS. */
const SVG = `
<svg class="fig" viewBox="12 4 76 88" aria-hidden="true" focusable="false">
  <g class="f-all">
    <g class="f-leg f-legB"><g class="f-thigh"><line x1="50" y1="56" x2="50" y2="72"/><g class="f-shin"><line x1="50" y1="72" x2="50" y2="88"/></g></g></g>
    <g class="f-lean">
      <g class="f-arm f-armB"><g class="f-upper"><line x1="50" y1="32" x2="50" y2="46"/><g class="f-fore"><line x1="50" y1="46" x2="50" y2="58"/></g></g></g>
      <circle class="f-head" cx="50" cy="16" r="9"/>
      <line x1="50" y1="27" x2="50" y2="56"/>
      <g class="f-arm f-armF"><g class="f-upper"><line x1="50" y1="32" x2="50" y2="46"/><g class="f-fore"><line x1="50" y1="46" x2="50" y2="58"/></g></g></g>
    </g>
    <g class="f-leg f-legF"><g class="f-thigh"><line x1="50" y1="56" x2="50" y2="72"/><g class="f-shin"><line x1="50" y1="72" x2="50" y2="88"/></g></g></g>
  </g>
</svg>`;

/** Lägger in figuren i ett element. */
export function mountFigure(el) {
  el.innerHTML = SVG;
  return el.querySelector('svg');
}

/**
 * Ställer in figuren.
 * @param {Element} el  elementet som innehåller figuren (data-pose och data-state sätts där)
 * @param {'run'|'rest'} pose  löpande eller vilande pose
 * @param {'play'|'pause'|'still'} state  play = animeras, pause = animeringen stannar i sitt läge (TRN-SIG-012),
 *        still = stillbild utan animering (slutvyn). Avstängda animationer ger alltid stillbild (hanteras i CSS).
 */
export function setFigure(el, pose, state) {
  if (el.dataset.pose !== pose) el.dataset.pose = pose;
  if (el.dataset.state !== state) el.dataset.state = state;
}
