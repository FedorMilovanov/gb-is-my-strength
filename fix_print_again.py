import re

with open('css/site.css', 'r', encoding='utf-8') as f:
    site_css = f.read()

# Let's remove ALL !important from the print block, period. Because the print block is at the bottom of the file, it has the highest precedence.
print_start = site_css.find('@media print {')
if print_start != -1:
    before = site_css[:print_start]
    print_block = site_css[print_start:]
    
    # Simple regex to remove ' !important' or '!important'
    print_block = re.sub(r'\s*!important', '', print_block)
    
    site_css = before + print_block
    
    with open('css/site.css', 'w', encoding='utf-8') as f:
        f.write(site_css)
    print("Fixed ALL print block important tags")
else:
    print("Print block not found")

