import os
import re

# Logic to verify the share block and structural integrity
def run_audit():
    errors = 0
    html_files = []
    for root, dirs, files in os.walk('articles'):
        for file in files:
            if file == 'index.html':
                html_files.append(os.path.join(root, file))
    
    # Add other key pages
    html_files.append('about/index.html')
    html_files.append('pastor-series/index.html')
    
    for path in html_files:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # 1. Check for list mismatches
        lines = content.splitlines()
        stack = []
        for i, line in enumerate(lines):
            tags = re.findall(r'<(ul|ol|/ul|/ol)(?:\s+.*?)?>', line)
            for tag in tags:
                tag_name = re.match(r'/?(ul|ol)', tag).group(0)
                if tag.startswith('/'):
                    if stack:
                        last = stack.pop()
                        if last != tag_name[1:]:
                            print(f"❌ Mismatch in {path} L{i+1}: <{last}> closed by </{tag_name[1:]}>")
                            errors += 1
                else:
                    stack.append(tag_name)
                    
        # 2. Check for presence of anchor points for JS injection
        anchors = [".sources-block", ".related-articles", ".gb-accuracy-block", ".pastoral-discernment-note", ".author-card"]
        has_anchor = any(f'class="{a[1:]}"' in content or f"class='{a[1:]}'" in content for a in anchors)
        if not has_anchor:
            print(f"⚠️ Warning: No standard anchors in {path}. JS will append to end.")
            
    return errors

if __name__ == "__main__":
    err_count = run_audit()
    if err_count == 0:
        print("✅ Article End Block Audit: PASS")
        exit(0)
    else:
        print(f"❌ Audit failed with {err_count} errors.")
        exit(1)
