import requests
import json

try:
    r = requests.get('http://127.0.0.1:5000/api/release-notes')
    data = r.json()
    print("Success! Notes count:", data['count'])
    print("Source:", data['source'])
    print("First Note:")
    print(json.dumps(data['notes'][0], indent=2))
except Exception as e:
    print("Error:", e)
