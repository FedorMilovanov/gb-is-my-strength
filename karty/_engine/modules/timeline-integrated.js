/**
 * timeline-integrated.js v0.7 — Deeply integrated beautiful timeline
 * Встроен в карту как премиум-элемент
 */
'use strict';

const MapTimelineIntegrated = (function() {

  function createIntegratedTimeline(mapInstance, stages, opts = {}) {
    // Создаём оверлей внутри контейнера карты
    const container = mapInstance.container || document.body;
    
    const timelineWrap = document.createElement('div');
    timelineWrap.className = 'map-timeline-integrated';
    timelineWrap.style.cssText = `
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 200;
      display: flex;
      gap: 8px;
      padding: 10px 18px;
      background: rgba(13, 17, 26, 0.92);
      border: 1px solid rgba(232, 200, 121, 0.18);
      border-radius: 9999px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      backdrop-filter: blur(12px);
    `;

    stages.forEach((stage, index) => {
      const chip = document.createElement('button');
      chip.className = 'timeline-chip-premium';
      chip.innerHTML = `
        <span class="num">${stage.n || (index+1)}</span>
        <span class="title">${stage.t}</span>
      `;
      
      chip.onclick = () => {
        // Деактивируем все
        timelineWrap.querySelectorAll('.timeline-chip-premium').forEach(c => 
          c.classList.remove('active')
        );
        chip.classList.add('active');

        if (opts.onStageClick) opts.onStageClick(stage, index);
        
        // Автоматически летим к первому месту этапа
        const place = opts.route?.places?.find(p => p.stage === index);
        if (place && mapInstance.flyTo) {
          mapInstance.flyTo(place.x, place.y, 0.82, 650);
          if (mapInstance.highlightPlace) mapInstance.highlightPlace(place.id);
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
