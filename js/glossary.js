(function () {
  "use strict";

  if (window.__gbGlossaryInitialized) return;
  window.__gbGlossaryInitialized = true;

  const DEFAULT_POLICY = {
    rootSelectors: ["article", "main[data-pagefind-body]"],
    proseSelectors: ["p", "div.reveal", "[data-glossary-zone='prose']"],
    hydrationForbiddenSelectors: [
      "a",
      "abbr",
      ".gterm",
      "code",
      "pre",
      "kbd",
      "samp",
      "nav",
      "figure",
      "figcaption",
      "caption",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      ".article-header",
      ".author-card",
      ".series-nav",
      ".article-toc",
      ".summary-card",
      ".note-box",
      ".context-bridge",
      ".ancient-epigraph",
      ".reading-list-section",
      ".fact-card",
      ".quick-fact",
      ".key-point",
      ".fn-marker",
      ".tooltip",
      ".btip",
      ".gtip",
      ".quiz-wrapper",
      ".gbs2-timeline",
      ".gbs2-next",
      "[data-glossary-skip]",
      "[hidden]",
      "[data-pagefind-meta]",
      "[data-pagefind-ignore]",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "script",
      "style"
    ],
    placementForbiddenSelectors: [
      "nav",
      "figure",
      "figcaption",
      "caption",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      ".article-header",
      ".author-card",
      ".series-nav",
      ".article-toc",
      ".summary-card",
      ".note-box",
      ".context-bridge",
      ".ancient-epigraph",
      ".reading-list-section",
      ".fact-card",
      ".quick-fact",
      ".key-point",
      ".fn-marker",
      ".tooltip",
      ".btip",
      ".quiz-wrapper",
      ".gbs2-timeline",
      ".gbs2-next",
      "[data-glossary-skip]",
      "[hidden]",
      "[data-pagefind-meta]",
      "[data-pagefind-ignore]",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6"
    ],
    cadence: {
      minWordGap: 1200,
      minBlockGap: 20,
      maxPerArticle: 3
    }
  };

  const runtime = (window.__gbGlossaryRuntime = window.__gbGlossaryRuntime || {
    promise: null,
    dict: null,
    policy: null,
    aliasToCanonical: null,
    aliasAll: null,
    regex: null
  });

  exposeHydrator();

  const root =
    DEFAULT_POLICY.rootSelectors
      .map((selector) => document.querySelector(selector))
      .find(Boolean) || null;

  if (!root) return;

  loadRuntime()
    .then((state) => {
      if (!state || !state.dict || !state.regex) return;
      normalizeManualTerms(root, state);
      hydrateAutomaticTerms(root, state);
      hydrateManualTerms(root, state);
      initializeTooltips(root);
    })
    .catch(() => {
      // Glossary is progressive enhancement. Article reading must never fail.
    });

  document.addEventListener("gb:quiz-rendered", (event) => {
    const quizRoot = event && event.detail && event.detail.root;
    hydrateGlossaryTerms(quizRoot || document);
  });

  function exposeHydrator() {
    window.SiteUtils = window.SiteUtils || {};
    window.SiteUtils.hydrateGlossaryTerms = hydrateGlossaryTerms;
  }

  function hydrateGlossaryTerms(scope) {
    const target = scope && scope.querySelectorAll ? scope : document;
    return loadRuntime().then((state) => {
      if (!state || !state.dict) return;
      normalizeManualTerms(target, state);
      hydrateAutomaticTerms(target, state);
      hydrateManualTerms(target, state);
      initializeTooltips(target);
    });
  }

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[‐‑‒–—−]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  function numberOrNull(value) {
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function getEntryMeta(dict, canonical) {
    const entry = (dict && dict[canonical]) || {};
    const nested =
      entry.definition && typeof entry.definition === "object"
        ? entry.definition
        : {};

    return {
      category: entry.category || nested.category || "",
      categorySlug:
        entry.categorySlug ||
        entry.category_slug ||
        nested.categorySlug ||
        nested.category_slug ||
        "",
      autoHydrate:
        entry.autoHydrate !== false && nested.autoHydrate !== false,
      minWordGap:
        numberOrNull(entry.minWordGap) ?? numberOrNull(nested.minWordGap),
      minBlockGap:
        numberOrNull(entry.minBlockGap) ?? numberOrNull(nested.minBlockGap),
      maxPerArticle:
        numberOrNull(entry.maxPerArticle) ??
        numberOrNull(nested.maxPerArticle)
    };
  }

  function loadRuntime() {
    if (
      runtime.dict &&
      runtime.policy &&
      runtime.aliasToCanonical &&
      runtime.regex
    ) {
      return Promise.resolve(runtime);
    }

    if (runtime.promise) return runtime.promise;

    runtime.promise = Promise.all([
      fetch("/data/glossary.json").then((response) =>
        response.ok ? response.json() : null
      ),
      fetch("/data/glossary-policy.json")
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null)
    ])
      .then(([dict, policy]) => {
        if (!dict || typeof dict !== "object") return null;

        const mergedPolicy = mergePolicy(DEFAULT_POLICY, policy);
        const compiled = compileDictionary(dict);

        runtime.dict = dict;
        runtime.policy = mergedPolicy;
        runtime.aliasToCanonical = compiled.aliasToCanonical;
        runtime.aliasAll = compiled.aliasAll;
        runtime.regex = compiled.regex;

        return runtime;
      })
      .catch(() => null);

    return runtime.promise;
  }

  function mergePolicy(base, override) {
    const safe = override && typeof override === "object" ? override : {};
    const legacyForbidden = Array.isArray(safe.forbiddenSelectors)
      ? safe.forbiddenSelectors
      : null;

    return {
      rootSelectors: Array.isArray(safe.rootSelectors)
        ? safe.rootSelectors
        : base.rootSelectors,
      proseSelectors: Array.isArray(safe.proseSelectors)
        ? safe.proseSelectors
        : base.proseSelectors,
      hydrationForbiddenSelectors: Array.isArray(
        safe.hydrationForbiddenSelectors
      )
        ? safe.hydrationForbiddenSelectors
        : legacyForbidden || base.hydrationForbiddenSelectors,
      placementForbiddenSelectors: Array.isArray(
        safe.placementForbiddenSelectors
      )
        ? safe.placementForbiddenSelectors
        : base.placementForbiddenSelectors,
      cadence: {
        minWordGap:
          numberOrNull(safe.cadence && safe.cadence.minWordGap) ??
          base.cadence.minWordGap,
        minBlockGap:
          numberOrNull(safe.cadence && safe.cadence.minBlockGap) ??
          base.cadence.minBlockGap,
        maxPerArticle:
          numberOrNull(safe.cadence && safe.cadence.maxPerArticle) ??
          base.cadence.maxPerArticle
      }
    };
  }

  function compileDictionary(dict) {
    const aliasToCanonical = {};
    const aliasAll = {};
    const autoAliases = [];

    Object.keys(dict).forEach((canonical) => {
      const entry = dict[canonical] || {};
      const nested =
        entry.definition && typeof entry.definition === "object"
          ? entry.definition
          : {};
      const aliases = Array.isArray(entry.aliases)
        ? entry.aliases.slice()
        : Array.isArray(nested.aliases)
          ? nested.aliases.slice()
          : [];

      if (!aliases.includes(canonical)) aliases.unshift(canonical);

      const meta = getEntryMeta(dict, canonical);

      aliases.forEach((alias) => {
        const key = normalize(alias);
        if (!key) return;

        if (!aliasAll[key]) aliasAll[key] = canonical;

        if (meta.autoHydrate && !aliasToCanonical[key]) {
          aliasToCanonical[key] = canonical;
          if (!autoAliases.includes(alias)) autoAliases.push(alias);
        }
      });
    });

    autoAliases.sort((a, b) => b.length - a.length);

    const source = autoAliases.map(escapeRegExp).join("|");
    let regex = null;

    if (source) {
      try {
        regex = new RegExp(
          `(^|[^\\p{L}\\p{N}_])(${source})(?=$|[^\\p{L}\\p{N}_])`,
          "giu"
        );
      } catch (_) {
        try {
          regex = new RegExp(
            `(^|[^а-яёА-ЯЁa-zA-Z0-9_])(${source})(?=$|[^а-яёА-ЯЁa-zA-Z0-9_])`,
            "gi"
          );
        } catch (_) {
          regex = null;
        }
      }
    }

    return { aliasToCanonical, aliasAll, regex };
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function matchesClosest(element, selectors) {
    if (!element) return false;
    return selectors.some((selector) => {
      try {
        return Boolean(element.closest(selector));
      } catch (_) {
        return false;
      }
    });
  }

  function isHydrationForbidden(node, policy) {
    const element =
      node && node.nodeType === Node.ELEMENT_NODE
        ? node
        : node && node.parentElement;
    return (
      !element ||
      matchesClosest(element, policy.hydrationForbiddenSelectors)
    );
  }

  function isPlacementForbidden(node, policy) {
    const element =
      node && node.nodeType === Node.ELEMENT_NODE
        ? node
        : node && node.parentElement;
    return (
      !element ||
      matchesClosest(element, policy.placementForbiddenSelectors)
    );
  }

  function getProseBlocks(scope, policy) {
    const selector = policy.proseSelectors.join(",");
    const candidates = Array.from(scope.querySelectorAll(selector)).filter(
      (element) => !isHydrationForbidden(element, policy)
    );

    return candidates.filter(
      (element) =>
        !candidates.some(
          (other) => other !== element && element.contains(other)
        )
    );
  }

  function normalizeManualTerms(scope, state) {
    const terms = Array.from(scope.querySelectorAll(".gterm"));

    terms.forEach((term) => {
      if (!isPlacementForbidden(term.parentElement, state.policy)) return;

      const clone = term.cloneNode(true);
      clone.querySelectorAll(".gtip").forEach((tip) => tip.remove());
      term.replaceWith(document.createTextNode(clone.textContent || ""));
    });
  }

  function hydrateAutomaticTerms(scope, state) {
    if (!state.regex) return;

    const blocks = getProseBlocks(scope, state.policy);
    const seen = {};
    let cumulativeWords = 0;

    blocks.forEach((block, blockIndex) => {
      const blockWordStart = cumulativeWords;
      const blockText = block.textContent || "";
      cumulativeWords += countWords(blockText);

      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
        acceptNode(textNode) {
          if (!textNode.nodeValue || !textNode.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          return isHydrationForbidden(textNode, state.policy)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        }
      });

      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);

      let wordsBeforeNode = 0;

      textNodes.forEach((textNode) => {
        const sourceText = textNode.nodeValue;
        const regex = state.regex;
        regex.lastIndex = 0;

        let lastOffset = 0;
        let changed = false;
        let match;
        const fragment = document.createDocumentFragment();

        while ((match = regex.exec(sourceText)) !== null) {
          const prefix = match[1] || "";
          const visible = match[2] || "";
          const canonical = state.aliasToCanonical[normalize(visible)];
          if (!canonical) continue;

          const matchStart = match.index + prefix.length;
          const wordPosition =
            blockWordStart +
            wordsBeforeNode +
            countWords(sourceText.slice(0, matchStart));

          if (
            !shouldHydrate(canonical, blockIndex, wordPosition, seen, state)
          ) {
            continue;
          }

          fragment.appendChild(
            document.createTextNode(sourceText.slice(lastOffset, matchStart))
          );
          fragment.appendChild(createTerm(visible, canonical, state.dict));
          lastOffset = matchStart + visible.length;
          changed = true;
          recordOccurrence(canonical, blockIndex, wordPosition, seen);
        }

        if (changed) {
          fragment.appendChild(
            document.createTextNode(sourceText.slice(lastOffset))
          );
          textNode.replaceWith(fragment);
        }

        wordsBeforeNode += countWords(sourceText);
      });
    });
  }

  function shouldHydrate(canonical, blockIndex, wordPosition, seen, state) {
    const previous = seen[canonical];
    const meta = getEntryMeta(state.dict, canonical);
    const cadence = state.policy.cadence;

    const maxPerArticle = meta.maxPerArticle ?? cadence.maxPerArticle;
    const minBlockGap = meta.minBlockGap ?? cadence.minBlockGap;
    const minWordGap = meta.minWordGap ?? cadence.minWordGap;

    if (!previous) return maxPerArticle > 0;
    if (previous.count >= maxPerArticle) return false;

    return (
      blockIndex - previous.blockIndex >= minBlockGap &&
      wordPosition - previous.wordPosition >= minWordGap
    );
  }

  function recordOccurrence(canonical, blockIndex, wordPosition, seen) {
    const previous = seen[canonical];
    seen[canonical] = {
      count: previous ? previous.count + 1 : 1,
      blockIndex,
      wordPosition
    };
  }

  function countWords(value) {
    const matches = String(value || "").match(/[\p{L}\p{N}]+/gu);
    return matches ? matches.length : 0;
  }

  function createTerm(visible, canonical, dict) {
    const term = document.createElement("abbr");
    term.className = "gterm";
    term.dataset.term = canonical;
    term.tabIndex = 0;
    term.setAttribute("role", "button");
    term.setAttribute("data-term-title", titleCase(canonical));

    applyCategory(term, canonical, dict);
    term.appendChild(document.createTextNode(visible));
    term.appendChild(createTip(dict, canonical));

    return term;
  }

  function hydrateManualTerms(scope, state) {
    const terms = Array.from(scope.querySelectorAll(".gterm"));

    terms.forEach((term) => {
      if (isPlacementForbidden(term.parentElement, state.policy)) return;

      const rawKey =
        term.getAttribute("data-term") ||
        term.getAttribute("data-term-title") ||
        firstText(term);

      const canonical =
        state.aliasAll[normalize(rawKey)] ||
        state.aliasToCanonical[normalize(rawKey)];

      if (!canonical) return;

      term.classList.add("gterm");
      term.dataset.term = canonical;
      term.setAttribute("data-term-title", titleCase(canonical));
      term.setAttribute("role", "button");
      if (!term.hasAttribute("tabindex")) term.tabIndex = 0;

      applyCategory(term, canonical, state.dict);

      if (!term.querySelector(".gtip")) {
        term.appendChild(createTip(state.dict, canonical));
      } else {
        upgradeStaticTip(term, canonical, state.dict);
      }
    });
  }

  function firstText(element) {
    const first = Array.from(element.childNodes).find(
      (node) =>
        node.nodeType === Node.TEXT_NODE &&
        String(node.textContent || "").trim()
    );
    return first ? first.textContent : element.textContent;
  }

  function titleCase(value) {
    return String(value || "").replace(/^[а-яёa-z]/u, (char) =>
      char.toUpperCase()
    );
  }

  function applyCategory(term, canonical, dict) {
    const meta = getEntryMeta(dict, canonical);
    if (meta.category) term.dataset.category = meta.category;
    if (meta.categorySlug) term.dataset.categorySlug = meta.categorySlug;
  }

  function getDefinition(dict, canonical) {
    const entry = dict && dict[canonical];
    if (!entry) return { brief: canonical, detail: "" };

    let brief = canonical;
    if (typeof entry === "string") {
      brief = entry;
    } else if (typeof entry.definition === "string") {
      brief = entry.definition;
    } else if (
      entry.definition &&
      typeof entry.definition.definition === "string"
    ) {
      brief = entry.definition.definition;
    }

    return {
      brief,
      detail:
        entry && typeof entry.detail === "string" ? entry.detail : ""
    };
  }

  function createTip(dict, canonical) {
    const meta = getEntryMeta(dict, canonical);
    const definition = getDefinition(dict, canonical);
    const tip = document.createElement("span");

    tip.className = "gtip";
    if (meta.category) tip.dataset.category = meta.category;
    if (meta.categorySlug) tip.dataset.categorySlug = meta.categorySlug;
    tip.innerHTML = buildTipHtml(definition.brief, definition.detail);

    return tip;
  }

  function buildTipHtml(brief, detail) {
    if (!detail) return escapeHtml(brief);

    return (
      `<span class="gtip-brief">${escapeHtml(brief)}</span>` +
      '<button type="button" class="gtip-expand-btn" aria-label="Подробнее" aria-expanded="false" data-gtip-expand>' +
      '<span class="gtip-expand-txt">Подробнее</span>' +
      '<svg class="gtip-expand-ico" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">' +
      '<path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg></button>" +
      '<span class="gtip-detail-wrap" aria-hidden="true">' +
      '<span class="gtip-detail"><span class="gtip-papyrus">' +
      detail +
      "</span></span></span>"
    );
  }

  function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value || "");
    return element.innerHTML;
  }

  function upgradeStaticTip(term, canonical, dict) {
    if (term.dataset.gtipUpgraded === "1") return;

    const tip = term.querySelector(".gtip");
    if (!tip) return;

    const definition = getDefinition(dict, canonical);
    const host = tip.querySelector(".gtip-luxury__definition") || tip;

    if (host.querySelector(".gtip-brief")) {
      term.dataset.gtipUpgraded = "1";
      return;
    }

    const originalBrief =
      String(host.textContent || "").trim() || definition.brief;

    host.innerHTML = buildTipHtml(originalBrief, definition.detail);
    term.dataset.gtipUpgraded = "1";
  }

  function initializeTooltips(scope) {
    if (
      window.SiteUtils &&
      typeof window.SiteUtils.initGlossaryTooltips === "function"
    ) {
      window.SiteUtils.initGlossaryTooltips(scope);
    }
  }
})();
