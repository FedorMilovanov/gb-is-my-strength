#!/usr/bin/env python3
from pathlib import Path

path = Path('js/site.js')
text = path.read_text(encoding='utf-8')
start_token = '_scrollLockCount:0,_savedScrollY:0,_scrollLockSources:{}'
end_token = ',articleEl:function()'
start = text.index(start_token)
end = text.index(end_token, start)
delegate = '_scrollLockCount:0,_savedScrollY:0,_scrollLockSources:{},_normalizeScrollLockSource:function(e){return"string"==typeof e&&e.trim()?e.trim():"__anonymous__"},_refreshScrollLockCount:function(){var e=window.SiteUtils;return this._scrollLockCount=e&&"number"==typeof e._scrollLockCount?e._scrollLockCount:0,this._scrollLockCount},prefersReducedMotion:function(){return!(!window.matchMedia||!window.matchMedia("(prefers-reduced-motion: reduce)").matches)},scrollToTop:function(){window.scrollTo({top:0,behavior:this.prefersReducedMotion()?"auto":"smooth"})},lockScroll:function(e){var t=window.SiteUtils;return t&&t!==this&&"function"==typeof t.lockScroll?t.lockScroll(e):void 0},unlockScroll:function(e){var t=window.SiteUtils;return t&&t!==this&&"function"==typeof t.unlockScroll?t.unlockScroll(e):void 0},forceUnlockEmergency:function(){var e=window.SiteUtils;return e&&e!==this&&"function"==typeof e.forceUnlockEmergency?e.forceUnlockEmergency():void 0}'
text = text[:start] + delegate + text[end:]
path.write_text(text, encoding='utf-8')
print('site.js private lock store replaced with canonical delegates')
