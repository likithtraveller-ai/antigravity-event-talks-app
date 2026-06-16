import requests
import xml.etree.ElementTree as ET

url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
try:
    response = requests.get(url)
    if response.status_code == 200:
        print("Success! XML downloaded.")
        root = ET.fromstring(response.content)
        # Print namespace information
        print("Root Tag:", root.tag)
        # Print some child tags
        for child in list(root)[:10]:
            print("Child tag:", child.tag)
            # If entry, print its children
            if "entry" in child.tag or child.tag.endswith("entry"):
                for entry_child in list(child)[:5]:
                    print("  Entry child tag:", entry_child.tag, "Text snippet:", (entry_child.text or "")[:100])
    else:
        print(f"Failed to fetch. Status code: {response.status_code}")
except Exception as e:
    print(f"Error: {e}")
