with open('css/site.css', 'r', encoding='utf-8') as f:
    site_css = f.read()

# Find the media print block
print_start = site_css.find('@media print {')
if print_start != -1:
    before = site_css[:print_start]
    print_block = site_css[print_start:]
    
    # We want to keep !important on display: none, visibility: hidden, opacity: 0
    # For everything else, we can strip !important.
    
    # Actually, the simplest is to just remove ALL !important inside print_block, 
    # except for a few specific ones. Or just remove them all and see.
    import re
    # Let's replace ' !important' with '' except for display/visibility/opacity
    lines = print_block.split('\n')
    new_lines = []
    for line in lines:
        if 'display: none' in line or 'visibility: hidden' in line or 'opacity: 0' in line:
            new_lines.append(line)
        else:
            new_lines.append(line.replace(' !important', '').replace('!important', ''))
            
    site_css = before + '\n'.join(new_lines)
    
    with open('css/site.css', 'w', encoding='utf-8') as f:
        f.write(site_css)
    print("Fixed print block important tags")
else:
    print("Print block not found")
