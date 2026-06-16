import os
import re
import html
import time
import requests
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Atom namespace
ATOM_NS = {'atom': 'http://www.w3.org/2005/Atom'}
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache
cache = {
    'data': None,
    'last_updated': 0
}
CACHE_DURATION = 300  # 5 minutes in seconds

def clean_html_to_text(html_content):
    """Strip HTML tags and format text with line breaks for tweets."""
    text = html_content
    # Insert newlines for lists and paragraphs to make text look good
    text = re.sub(r'</p>\s*<p>', '\n\n', text)
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'<li>', '• ', text)
    text = re.sub(r'</li>', '\n', text)
    text = re.sub(r'<[^>]+>', '', text)
    # Decode HTML entities
    text = html.unescape(text)
    # Clean up whitespace
    text = re.sub(r' +', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def fetch_and_parse_feed():
    """Fetches the Google BigQuery release notes XML and parses it into JSON elements."""
    try:
        response = requests.get(FEED_URL, timeout=10)
        if response.status_code != 200:
            raise Exception(f"Failed to fetch feed, status code: {response.status_code}")
            
        xml_content = response.content
        root = ET.fromstring(xml_content)
        updates = []
        
        entries = root.findall('atom:entry', ATOM_NS)
        for entry in entries:
            # Extract date from title (e.g. "June 15, 2026")
            title_el = entry.find('atom:title', ATOM_NS)
            date_str = title_el.text if title_el is not None else "Unknown Date"
            
            # Extract timestamp
            updated_el = entry.find('atom:updated', ATOM_NS)
            updated_str = updated_el.text if updated_el is not None else ""
            
            # Extract alternate link
            link_el = entry.find("atom:link[@rel='alternate']", ATOM_NS)
            if link_el is None:
                link_el = entry.find("atom:link", ATOM_NS)
            link_href = link_el.attrib.get('href', '') if link_el is not None else ""
            
            content_el = entry.find('atom:content', ATOM_NS)
            if content_el is None or content_el.text is None:
                continue
                
            content_html = content_el.text
            
            # Split the entry content by h3 headers to extract individual updates
            # Each entry can contain multiple updates like <h3>Feature</h3>... <h3>Issue</h3>...
            parts = re.split(r'<h3>(.*?)</h3>', content_html)
            
            if len(parts) <= 1:
                # No h3 tags, treat entire block as one item
                clean_text = clean_html_to_text(content_html)
                safe_date = re.sub(r'[^a-zA-Z0-9]', '_', date_str)
                updates.append({
                    "id": f"{safe_date}_0",
                    "date": date_str,
                    "timestamp": updated_str,
                    "type": "General",
                    "content_html": content_html,
                    "content_text": clean_text,
                    "link": link_href
                })
                continue
                
            # Parts alternates: [whitespace, type1, html1, type2, html2, ...]
            start_idx = 1 if parts[0].strip() == "" else 0
            
            # If the split didn't pair up properly, handle safely
            update_idx = 0
            for i in range(start_idx, len(parts) - 1, 2):
                u_type = parts[i].strip()
                u_html = parts[i+1].strip()
                
                clean_text = clean_html_to_text(u_html)
                
                safe_date = re.sub(r'[^a-zA-Z0-9]', '_', date_str)
                update_id = f"{safe_date}_{update_idx}"
                
                # Link directly to the specific date section
                anchor_link = link_href if link_href and "#" in link_href else (f"{link_href}#{safe_date}" if link_href else "")
                
                updates.append({
                    "id": update_id,
                    "date": date_str,
                    "timestamp": updated_str,
                    "type": u_type,
                    "content_html": u_html,
                    "content_text": clean_text,
                    "link": anchor_link
                })
                update_idx += 1
                
        return updates
    except Exception as e:
        print(f"Error fetching or parsing feed: {e}")
        raise

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    if force_refresh or cache['data'] is None or (current_time - cache['last_updated']) > CACHE_DURATION:
        try:
            data = fetch_and_parse_feed()
            cache['data'] = data
            cache['last_updated'] = current_time
            source = "network"
        except Exception as e:
            # Fallback to cache if network fails, otherwise return error
            if cache['data'] is not None:
                data = cache['data']
                source = "cache_fallback"
            else:
                return jsonify({"error": f"Failed to retrieve release notes: {str(e)}"}), 500
    else:
        data = cache['data']
        source = "cache"
        
    return jsonify({
        "source": source,
        "last_updated": cache['last_updated'],
        "count": len(data),
        "notes": data
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
