/**
 * timeline.js v0.6 — Professional Stage Timeline
 */
'use strict';

const MapTimeline = (function() {

  function createTimeline(container, stages, opts = {}) {
    container.innerHTML = '';
    container.className = 'map-timeline';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      display:flex; gap:8px; flex-wrap:wrap; 
      padding:10px 12px; background:rgba(13,17,26,.85);
      border:1px solid rgba(232,200,121,.18); border-radius:12px;
    `;

    const chips = [];

    stages.forEach((stage, index) => {
      const chip = document.createElement('button');
      chip.className = 'timeline-chip';
      chip.innerHTML = `
        <span class="num">${stage.n || (index + 1)}</span>
        <span class="title">${stage.t}</span>
      `;
      
      chip.onclick = () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        if (opts.onStageClick) opts.onStageClick(stage, index);
      };

      wrapper.appendChild(chip);
      chips.push(chip);
    });

    container.appendChild(wrapper);

    return {
      setActive(index) {
        chips.forEach((chip, i) => {
          chip.classList.toggle('active', i === index);
        });
      },
      destroy() {
        container.innerHTML = '';
      }
    };
  }

  return { createTimeline };
})();
