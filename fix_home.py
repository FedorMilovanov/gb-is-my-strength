with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace the single article card with the new series block for "Тайны человеческого сердца"
target = '''          <!-- Иеремия -->
          <li>
            <a href="articles/krajne-li-isporcheno-serdce/" class="h-article-card">
              <div class="h-article-thumb">
                <picture>
  <source srcset="images/og-series-heart.webp" type="image/webp">
  <img src="images/og-series-heart.jpg"
                     alt="Крайне ли испорчено моё сердце — Иеремия 17"
                     decoding="async" loading="lazy" width="160" height="108">
</picture>
              </div>
              <div class="h-article-body">
                <h3 class="h-article-title">Крайне ли испорчено моё сердце — если я уже верующий?</h3>
                <div class="h-article-meta">
                  <span class="h-meta-author">Редактор: Фёдор Милованов</span>
                  <span class="h-meta-sep" aria-hidden="true">·</span>
                  <span class="h-meta-time">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 16 14"/></svg>
                    32 мин
                  </span>
                  <span class="h-meta-tag h-meta-tag--neutral">Авторская статья</span>
                  <span class="h-meta-tag">Экзегеза</span>
                </div>
                <p class="h-article-abstract">Разбор Иеремии 17:9–10: что значит «сердце обманчиво более всего» — и относится ли это к верующему? Экзегеза, богословский синтез и пастырское применение.</p>
              </div>
            </a>
          </li>'''

# Let's just create a completely new home block arrangement.
# Let's insert the featured series "Тайны человеческого сердца" right after or before "pastor-series" 
