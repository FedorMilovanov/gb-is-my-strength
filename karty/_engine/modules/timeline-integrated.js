/**
 * timeline-integrated.js v0.8 — Deep premium timeline
 */
'use strict';

const MapTimelineIntegrated = (function() {

  function createIntegratedTimeline(container, stages, opts = {}) {
    const timelineWrap = document.createElement('div');
    timelineWrap.className = 'map-timeline-integrated';
    timelineWrap.style.cssText = `
      position: absolute;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 250;
      display: flex;
      gap: 6px;
      padding: 9px 20px;
      background: rgba(13, 17, 26, 0.94);
      border: 1px solid rgba(232, 200, 121, 0.22);
      border-radius: 9999px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.65);
      backdrop-filter: blur(16px);
    `;

    stages.forEach((stage, index) => {
      const chip = document.createElement('button');
      chip.className = 'timeline-chip-premium';
      chip.innerHTML = `
        <span class="num">${stage.n || (index+1)}</span>
        <span class="title">${stage.t}</span>
      `;
      
      chip.onclick = () => {
        timelineWrap.querySelectorAll('.timeline-chip-premium').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        if (opts.onStageClick) opts.onStageClick(stage, index);

        const place = opts.route?.places?.find(p => p.stage === index);
        if (place && opts.map) {
          opts.map.flyTo(place.x, place.y, 0.85, 680);
          if (opts.map.highlightPlace) opts.map.highlightPlace(place.id);
        }
      };

      timelineWrap.appendChild(chip);
    });

    container.style.position = 'relative';
    container.appendChild(timelineWrap);

    return {
      setActive(index) {
        timelineWrap.querySelectorAll('.timeline-chip-premium').forEach((chip, i) => {
          chip.classList.toggle('active', i === index);
        });
      },
      destroy() {
        timelineWrap.remove();
      }
    };
  }

  return { createIntegratedTimeline };
})();
