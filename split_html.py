import os

filepath = 'templates/index.html'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Define boundaries
login_start = content.find('<!-- ==================== 1. LOGIN VIEW ==================== -->')
admin_start = content.find('<!-- ==================== 2. ADMIN PANEL VIEW ==================== -->')
operator_start = content.find('<!-- ==================== 3. OPERATOR VIEW ==================== -->')
operator_end = content.find('    <!-- Traceability Detail Modal Overlay -->')
modal_start = content.find('    <!-- Traceability Detail Modal Overlay -->')
modal_end = content.find('    <!-- Lucide Icons CDN -->')

if -1 in [login_start, admin_start, operator_start, operator_end, modal_start, modal_end]:
    print("Could not find all markers.")
    print(login_start, admin_start, operator_start, operator_end, modal_start, modal_end)
    exit(1)

# Find the end of operator view precisely which is before the closing </div> of app-root
app_root_end = content.rfind('</div>', operator_start, modal_start)

login_html = content[login_start:admin_start]
admin_html = content[admin_start:operator_start]
operator_html = content[operator_start:app_root_end]
modal_html = content[modal_start:modal_end]

with open('templates/partials/login.html', 'w', encoding='utf-8') as f:
    f.write(login_html)
with open('templates/partials/admin.html', 'w', encoding='utf-8') as f:
    f.write(admin_html)
with open('templates/partials/operator.html', 'w', encoding='utf-8') as f:
    f.write(operator_html)
with open('templates/partials/modals.html', 'w', encoding='utf-8') as f:
    f.write(modal_html)

new_index = content[:login_start] + """{% include 'partials/login.html' %}
        {% include 'partials/admin.html' %}
        {% include 'partials/operator.html' %}
    </div>

    {% include 'partials/modals.html' %}

""" + content[modal_end:]

with open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(new_index)

print("Split completed successfully!")
