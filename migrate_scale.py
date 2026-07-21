import sqlite3
import os

db_path = '/opt/baharat otomasyon/instance/baharat.db'

if not os.path.exists(db_path):
    print("Database file not found at", db_path)
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute('ALTER TABLE scale ADD COLUMN connection_type VARCHAR(50) DEFAULT "wired"')
    print("Added connection_type successfully.")
except sqlite3.OperationalError as e:
    print("Warning: connection_type", e)

try:
    cursor.execute('ALTER TABLE scale ADD COLUMN data_format VARCHAR(50) DEFAULT "densi"')
    print("Added data_format successfully.")
except sqlite3.OperationalError as e:
    print("Warning: data_format", e)

conn.commit()
conn.close()
print("Migration completed.")
