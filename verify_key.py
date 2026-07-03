import os
import sys
import base64

def main():
    key = os.environ.get("RAW_KEY", "")
    password = os.environ.get("RAW_PASS", "")

    print("--- DIAGNOSTICS ---")
    print(f"RAW_KEY length: {len(key)}")
    print(f"RAW_PASS length: {len(password)}")

    # Check key lines
    lines = key.splitlines()
    print(f"Number of lines in RAW_KEY: {len(lines)}")
    for i, line in enumerate(lines):
        print(f"  Line {i+1} length: {len(line)}")
        print(f"  Line {i+1} starts with 'untrusted comment': {line.startswith('untrusted comment')}")
        print(f"  Line {i+1} contains whitespace: {' ' in line}")
        print(f"  Line {i+1} has carriage return: {'\r' in line}")
        
        # Test base64 decode of non-comment lines
        try:
            decoded = base64.b64decode(line.strip())
            print(f"  Line {i+1} base64 decode: SUCCESS (decoded length {len(decoded)})")
            
            # Check if decoded data starts with untrusted comment
            if decoded.startswith(b"untrusted comment"):
                print(f"  Line {i+1} DECODED data starts with 'untrusted comment'! This means the secret is double-base64 encoded.")
                try:
                    decoded_str = decoded.decode('utf-8', errors='ignore')
                    print(f"  Decoded content number of lines: {len(decoded_str.splitlines())}")
                except Exception as e:
                    print(f"  Failed to decode decoded data as string: {e}")
        except Exception as e:
            print(f"  Line {i+1} base64 decode: FAILED ({str(e)})")

    # Check password
    if password:
        print(f"RAW_PASS has carriage return: {'\r' in password}")
        print(f"RAW_PASS has newline: {'\n' in password}")
        print(f"RAW_PASS has trailing space: {password.endswith(' ')}")
        print(f"RAW_PASS has leading space: {password.startswith(' ')}")
        print(f"RAW_PASS is alphanumeric: {password.isalnum()}")
    else:
        print("RAW_PASS is empty!")

if __name__ == "__main__":
    main()
