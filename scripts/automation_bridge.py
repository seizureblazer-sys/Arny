import requests
import json
import sys

def trigger_ai_stream(prompt, system_prompt=None, base_url="http://localhost:3000"):
    """
    Triggers the AI streaming API from Python.
    This acts as a bridge for automation scripts.
    """
    url = f"{base_url}/api/ai/stream"
    payload = {
        "prompt": prompt,
        "systemPrompt": system_prompt
    }
    
    print(f"--- Triggering AI Stream for: {prompt[:50]}... ---")
    
    try:
        # Use stream=True to handle the chunked response
        response = requests.post(url, json=payload, stream=True, timeout=30)
        response.raise_for_status()
        
        full_response = ""
        print("AI Response: ", end="", flush=True)
        
        for line in response.iter_lines():
            if line:
                # The Vercel AI SDK data stream format usually starts with a type prefix (e.g., '0:"text"')
                # We need to parse the data stream protocol if using pipeDataStreamToResponse
                decoded_line = line.decode('utf-8')
                
                # Simple parsing for the data stream protocol (0: is text)
                if decoded_line.startswith('0:"'):
                    # Extract the string content
                    try:
                        # The format is 0:"text content"\n
                        content = json.loads(decoded_line[2:])
                        print(content, end="", flush=True)
                        full_response += content
                    except:
                        pass
        
        print("\n--- Stream Complete ---")
        return full_response

    except requests.exceptions.RequestException as e:
        print(f"\nError connecting to API: {e}")
        return None

if __name__ == "__main__":
    test_prompt = "Explain the importance of BCS exam in 3 bullet points."
    if len(sys.argv) > 1:
        test_prompt = " ".join(sys.argv[1:])
        
    trigger_ai_stream(test_prompt)
