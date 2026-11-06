from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Submit an underwriter settlement payload to the authenticated Core Ledger API."
    )
    parser.add_argument("application_id", help="Firestore application document ID")
    parser.add_argument("payload_file", type=Path, help="JSON file matching POST /settlement")
    args = parser.parse_args()

    api_url = os.environ.get("CORE_API_URL", "http://localhost:8000").rstrip("/")
    id_token = os.environ.get("FIREBASE_ID_TOKEN")
    if not id_token:
        parser.error("Set FIREBASE_ID_TOKEN to a fresh Firebase ID token for an underwriter.")
    if not args.payload_file.is_file():
        parser.error(f"Payload file not found: {args.payload_file}")

    with args.payload_file.open(encoding="utf-8") as payload_file:
        payload = json.load(payload_file)

    request = Request(
        f"{api_url}/v1/applications/{args.application_id}/settlement",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {id_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=180) as response:
            result = json.load(response)
    except HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")
        print(f"Core API returned HTTP {error.code}: {error_body}", file=sys.stderr)
        return 1
    except URLError as error:
        print(f"Cannot reach Core API: {error.reason}", file=sys.stderr)
        return 1

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
