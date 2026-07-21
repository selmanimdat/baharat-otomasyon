import re

filename = 'static/js/modules/events.js'
with open(filename, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace .addEventListener with ?.addEventListener
text = re.sub(r'(\w+)\.addEventListener', r'\1?.addEventListener', text)
# Handle cases like document.querySelectorAll('.btn-back').forEach(btn => btn.addEventListener(...))
# The above regex will change btn.addEventListener to btn?.addEventListener which is fine.

with open(filename, 'w', encoding='utf-8') as f:
    f.write(text)

print("Updated events.js")
