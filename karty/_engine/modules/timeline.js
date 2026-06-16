/**
 * timeline.js — Stage Timeline component for biblical maps (v0.5)
 */
'use strict';

const MapTimeline = (function() {

  function createTimeline(container, stages, opts = {}) {
    container.innerHTML = '';
    container.className = 'map-timeline';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;padding:8px 0;';

    stages.forEach((stage, idx) => {
      const chip = document.createElement('button');
      chip.className = 'timeline-chip';
      chip.innerHTML = `
        <span class="n">${stage.n || (idx+1)}</span>
        <span class="t">${stage.t}</span>
      `;
      chip.onclick = () => {
        if (opts.onStageClick) opts.onStageClick(stage, idx);
        document.querySelectorAll('.timeline-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      };
      wrapper.appendChild(chip);
    });

    container.appendChild(wrapper);

    return {
      setActive(index) {
        document.querySelectorAll('.timeline-chip').forEach((c, i) => {
          c.classList.toggle('active', i === index);
        });
      },
      destroy() {
        container.innerHTML = '';
      }
    };
  }

  return { createTimeline };
})();
