import re

with open('css/home.css', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix .h-navbar__inner
content = re.sub(
    r'\.h-navbar__inner\s*\{[^}]*?max-width:\s*[^;]+;[^}]*?\}',
    '.h-navbar__inner {\n  max-width: 1000px;\n  width: 100%;\n  margin: 0 auto;\n  padding: 0 28px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 24px;\n}',
    content
)

# Fix .h-nav-links
content = re.sub(
    r'\.h-nav-links\s*\{[^}]*?\}',
    '.h-nav-links {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex: 1;\n  gap: 20px;\n  list-style: none;\n  margin: 0; padding: 0;\n}',
    content
)

# Clean up the duplicate 'flex: 1; justify-content: center;' that sed added
content = content.replace('  flex: 1;\n  justify-content: center;', '')
# Wait, the above line might remove the one I just added.
# I'll just do a global cleanup of the junk I added earlier.
content = re.sub(r'\n\s*flex: 1;\n\s*justify-content: center;', '', content)
# Now apply the correct one
content = content.replace('.h-nav-links {', '.h-nav-links {\n  flex: 1;\n  justify-content: center;')

# Fix .h-nav-logo and .mobile-controls shrink
content = content.replace('.h-nav-logo {', '.h-nav-logo {\n  flex-shrink: 0;')
content = content.replace('.mobile-controls {', '.mobile-controls {\n  flex-shrink: 0;')

# Add a narrow-desktop optimization
content += '\n\n@media (min-width: 761px) and (max-width: 1100px) {\n  .h-nav-links { gap: 12px; }\n  .h-nav-links a { font-size: 12px; }\n}\n'

with open('css/home.css', 'w', encoding='utf-8') as f:
    f.write(content)
