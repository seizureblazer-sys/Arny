import requests
import json
import os

# Configuration
API_URL = "https://ais-dev-3q55kdpzo2irjvtvcgfnm4-50128653243.asia-southeast1.run.app/api/ai/stream"
NEWS_URL = "https://example.com/latest-news-article" # Replace with actual news URL

def trigger_ai_pipeline(url):
    print(f"Triggering AI pipeline for: {url}")
    
    # 1. Fetch content (optional, or let the server do it)
    # The server has /api/fetch-url, but we can also just send the URL to the stream endpoint
    # if we modify it to handle URLs. For now, let's assume we send a prompt.
    
    payload = {
        "prompt": f"Analyze this news article and extract 5 GK points and 2 MCQs: {url}",
        "systemPrompt": "Act as a senior BCS examiner. Return JSON format."
    }
    
    try:
        # Since it's a streaming response, we use stream=True
        response = requests.post(API_URL, json=payload, stream=True)
        
        if response.status_code == 200:
            print("Streaming response started...")
            accumulated_text = ""
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    # Vercel AI SDK format: 0:"text"
                    if decoded_line.startswith('0:'):
                        try:
                            text = json.loads(decoded_line[2:])
                            accumulated_text += text
                            print(text, end='', flush=True)
                        except:
                            pass
            
            print("\n\nGeneration Complete.")
            # Here you would implement the "Human-in-the-loop" approval
            # e.g., send to a Slack channel or a dashboard for review.
            
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    trigger_ai_pipeline(NEWS_URL)
