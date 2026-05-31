import re

with open('css/home.css', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove all duplicate/junk entries for .h-navbar__inner and .h-nav-links 
# This is tricky because of the junk added by sed. 
# I will search for the start of .h-navbar and replace everything up to .h-mobile-menu-btn
# but wait, that's too much.

# Better: Replace the entire .h-navbar blocks carefully.
# I'll replace from '.h-navbar {' until '.h-mobile-menu-btn {'
start_marker = '.h-navbar {'
end_marker = '.h-mobile-menu-btn {'
if start_marker in content and end_marker in content:
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    navbar_replacement = """
.h-navbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: var(--z-sticky);
  height: 58px;
  display: flex;
  align-items: center;
  transition:
    transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.4s ease,
    box-shadow 0.4s ease,
    border-color 0.4s ease;
  border-bottom: 1px solid transparent;
}
.h-navbar.scrolled {
  background: var(--h-bg, #f8f5f0);
  border-color: var(--h-border);
}
@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
  .h-navbar.scrolled {
    background: var(--h-glass);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    box-shadow: 0 1px 0 var(--h-border);
  }
}
.h-navbar.nav-hidden {
  transform: translateY(-100%);
  pointer-events: none;
  visibility: hidden;
  transition:
    transform 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    visibility 0s linear 0.4s;
}

.h-navbar__inner {
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.h-nav-logo {
  display: flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  cursor: pointer; 
  user-select: none;
  flex-shrink: 0;
}
.h-nav-logo-main {
  font-family: var(--f-serif);
  font-size: 18px;
  font-weight: 700;
  color: var(--h-ink);
  letter-spacing: 0.02em;
  white-space: nowrap;
  transition: letter-spacing 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.h-nav-logo-dash {
  font-family: var(--f-serif);
  font-size: 18px;
  color: var(--h-muted);
  white-space: nowrap;
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  display: inline-block;
}
.h-nav-logo-accent {
  font-family: var(--f-serif);
  font-size: 18px;
  font-weight: 700;
  font-style: italic;
  color: var(--h-accent);
  letter-spacing: 0.02em;
  white-space: nowrap;
  transition: letter-spacing 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
@media (hover: hover) {
  .h-nav-logo:hover .h-nav-logo-main { letter-spacing: 0.08em; }
  .h-nav-logo:hover .h-nav-logo-dash { transform: scaleX(1.4); }
  .h-nav-logo:hover .h-nav-logo-accent { letter-spacing: 0.08em; }
}

.h-nav-links {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 20px;
  list-style: none;
  margin: 0; padding: 0;
}
@media (max-width: 860px) {
  .h-nav-links { gap: 18px; }
}
.h-nav-links a {
  font-family: var(--f-ui);
  font-size: 13px;
  font-weight: 500;
  color: var(--h-muted);
  text-decoration: none;
  white-space: nowrap;
  position: relative;
  transition: color 0.3s ease;
}
.h-nav-links a::after {
  content: "";
  position: absolute;
  bottom: -3px; left: 0;
  width: 100%; height: 1px;
  background: var(--h-accent);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s ease;
}
@media (hover: hover) {
  .h-nav-links a:hover { color: var(--h-ink); }
  .h-nav-links a:hover::after { transform: scaleX(1); }
}

.mobile-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
"""
    content = content[:start_idx] + navbar_replacement + content[end_idx:]

with open('css/home.css', 'w', encoding='utf-8') as f:
    f.write(content)
