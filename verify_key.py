"""
Verify that the Tauri signing key was correctly prepared.

Runs after prepare_key.py to validate that the signing key environment
variables are set and appear to be correctly formatted.
"""
import os
import sys
import subprocess

def main():
    signing_key = os.environ.get("TAURI_SIGNING_PRIVATE_KEY", "")
    signing_pass = os.environ.get("TAURI_SIGNING_PRIVATE_KEY_PASSWORD", "")

    print("=" * 60)
    print("SIGNING KEY VERIFICATION DIAGNOSTICS")
    print("=" * 60)

    # Check key presence
    if signing_key:
        print(f"[PASS] TAURI_SIGNING_PRIVATE_KEY is set ({len(signing_key)} chars)")
        print(f"       Preview: {signing_key[:30]}...")

        # Check for common issues
        if signing_key.startswith("dW5"):
            print("[WARN] Key appears to still be base64-encoded (starts with dW5).")
        if "\\n" in signing_key:
            print("[WARN] Key contains literal \\n (backslash-n) instead of real newlines.")
        if "\n" in signing_key:
            lines = signing_key.strip().split("\n")
            print(f"       Key has {len(lines)} line(s)")
    else:
        print("[FAIL] TAURI_SIGNING_PRIVATE_KEY is NOT set!")
        # Try to read from GITHUB_ENV directly
        raw_key = os.environ.get("RAW_KEY", "")
        if raw_key:
            print(f"       RAW_KEY IS available ({len(raw_key)} chars) — prepare_key.py may have failed to export.")
        else:
            print("       RAW_KEY is also not set — secret may not be configured.")

    # Check password presence
    if signing_pass:
        print(f"[PASS] TAURI_SIGNING_PRIVATE_KEY_PASSWORD is set ({len(signing_pass)} chars)")
    else:
        print("[WARN] TAURI_SIGNING_PRIVATE_KEY_PASSWORD is NOT set (may be intentionally empty).")

    # Check for tauri CLI availability
    try:
        result = subprocess.run(
            ["npx", "tauri", "--version"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            print(f"[PASS] Tauri CLI version: {result.stdout.strip()}")
        else:
            print(f"[WARN] Tauri CLI check returned non-zero: {result.stderr.strip()}")
    except Exception as e:
        print(f"[WARN] Could not check Tauri CLI version: {e}")

    print("=" * 60)

    # Fail the step if the key is missing
    if not signing_key:
        print("\nFATAL: Signing key is not available. Build will fail at signing step.")
        sys.exit(1)

    print("\nAll verification checks passed.")

if __name__ == "__main__":
    main()
