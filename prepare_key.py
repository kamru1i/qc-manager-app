"""
Prepare Tauri signing key from GitHub Actions secrets.

Reads RAW_KEY and RAW_PASS environment variables (set by the workflow),
decodes the base64 key, and exports TAURI_SIGNING_PRIVATE_KEY and
TAURI_SIGNING_PRIVATE_KEY_PASSWORD into GITHUB_ENV for subsequent steps.
"""
import os
import sys
import base64

def main():
    raw_key = os.environ.get("RAW_KEY", "")
    raw_pass = os.environ.get("RAW_PASS", "")

    if not raw_key:
        print("ERROR: RAW_KEY environment variable is not set or empty.")
        sys.exit(1)

    if not raw_pass:
        print("WARNING: RAW_PASS environment variable is not set or empty.")

    # The key may already be plain text or base64-encoded.
    # Try base64 decode first; if it fails, use the raw value.
    try:
        decoded = base64.b64decode(raw_key).decode("utf-8")
        # Verify it looks like a valid key (not garbage bytes)
        if decoded.isprintable() or "BEGIN" in decoded:
            signing_key = decoded
            print("Successfully decoded base64-encoded signing key.")
        else:
            signing_key = raw_key
            print("Base64 decode produced non-printable output; using raw key value.")
    except Exception:
        signing_key = raw_key
        print("Key is not base64-encoded; using raw value directly.")

    # Write to GITHUB_ENV so downstream steps can read them
    github_env = os.environ.get("GITHUB_ENV", "")
    if github_env:
        with open(github_env, "a") as f:
            # Use heredoc-style delimiter for multi-line values
            f.write(f"TAURI_SIGNING_PRIVATE_KEY<<EOF_KEY\n{signing_key}\nEOF_KEY\n")
            f.write(f"TAURI_SIGNING_PRIVATE_KEY_PASSWORD={raw_pass}\n")
        print("Exported TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD to GITHUB_ENV.")
    else:
        # Local dev fallback: just set in current process (won't persist)
        os.environ["TAURI_SIGNING_PRIVATE_KEY"] = signing_key
        os.environ["TAURI_SIGNING_PRIVATE_KEY_PASSWORD"] = raw_pass
        print("GITHUB_ENV not found (local run). Set variables in current process only.")

    # Print key info (without revealing the actual key)
    print(f"Key length: {len(signing_key)} characters")
    print(f"Key starts with: {signing_key[:20]}...")
    print(f"Password length: {len(raw_pass)} characters")

if __name__ == "__main__":
    main()
