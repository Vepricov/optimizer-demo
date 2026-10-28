'use strict';

globalThis.PFN_LAYOUT = {
  fit(shell, {measure = element => element.scrollHeight} = {}) {
    const width = window.innerWidth;
    const desktop = width > 800;
    document.body.classList.toggle('fit', desktop);
    document.documentElement.style.zoom = '';
    shell.style.width = '';
    shell.style.zoom = '';
    if (!desktop) return;

    const height = Math.max(1, window.innerHeight - 2);
    // Unlike a content-dependent canvas width, this keeps every section's
    // outside edges aligned. A longer section uses a wider logical canvas.
    const place = scale => {
      shell.style.width = `${width / scale}px`;
      return measure(shell) * scale <= height;
    };
    let low = .05;
    let high = Math.min(width / 1600, 1.5);
    if (place(high)) low = high;
    else {
      for (let step = 0; step < 18; step++) {
        const middle = (low + high) / 2;
        if (place(middle)) low = middle;
        else high = middle;
      }
    }
    place(low);
    shell.style.zoom = String(low);
  }
};
