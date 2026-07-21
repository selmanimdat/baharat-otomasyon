import os
import re

app_js_path = '/opt/baharat otomasyon/static/js/app.js'
out_dir = '/opt/baharat otomasyon/static/js/modules'

if not os.path.exists(out_dir):
    os.makedirs(out_dir)

with open(app_js_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

sections = {
    'setup': (0, 242),          # Fallback, Test bridge, State, DOM
    'api': (243, 406),          # API Wrappers, fetchDb, WebSockets
    'routing': (407, 546),      # updateUI, renderLoginSteps, checkAuth, etc.
    'admin': (547, 1764),       # Admin tabs
    'operator': (1765, 2440),   # Operator panel, Scale integration
    'events': (2441, 2877),     # Binding events
    'print': (2878, len(lines)) # Traceability and printing
}

files_to_write = {
    'setup.js': sections['setup'],
    'api.js': sections['api'],
    'routing.js': sections['routing'],
    'admin.js': sections['admin'],
    'operator.js': sections['operator'],
    'events.js': sections['events'],
    'print.js': sections['print']
}

for filename, (start, end) in files_to_write.items():
    content = "".join(lines[start:end])
    with open(os.path.join(out_dir, filename), 'w', encoding='utf-8') as out_f:
        out_f.write(content)
        
print("Successfully split app.js into logical modules.")
