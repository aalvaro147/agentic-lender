from __future__ import annotations

import argparse
import os

import firebase_admin
from firebase_admin import auth, credentials


VALID_ROLES = {"borrower", "broker", "underwriter"}


def main() -> None:
    parser = argparse.ArgumentParser(description="Assign an Agentic Lender Firebase custom role.")
    parser.add_argument("uid", help="Firebase Authentication UID")
    parser.add_argument("role", choices=sorted(VALID_ROLES))
    args = parser.parse_args()

    service_account_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")
    if not service_account_path:
        parser.error("Set FIREBASE_SERVICE_ACCOUNT_PATH to the Firebase Admin service-account JSON file.")

    try:
        firebase_app = firebase_admin.get_app()
    except ValueError:
        firebase_app = firebase_admin.initialize_app(credentials.Certificate(service_account_path))

    user = auth.get_user(args.uid, app=firebase_app)
    custom_claims = user.custom_claims or {}
    custom_claims["role"] = args.role
    auth.set_custom_user_claims(args.uid, custom_claims, app=firebase_app)
    print(f"Assigned role '{args.role}' to Firebase UID {args.uid}.")
    print("The user must refresh their Firebase ID token before the new claim is available.")


if __name__ == "__main__":
    main()
