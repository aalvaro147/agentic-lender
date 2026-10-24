import hashlib
import json
from web3 import Web3

# Connect to local Hardhat node
w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))

def process_underwriter_approval(application_id, borrower_hash, principal, base_apr_bps, term_months, ber_rating, credit_memo_text):
    # 1. Generate SHA-256 hash of credit memo
    sha256_hash = "0x" + hashlib.sha256(credit_memo_text.encode('utf-8')).hexdigest()
    app_id_bytes = "0x" + hashlib.sha256(application_id.encode('utf-8')).hexdigest()
    
    print(f"Computed SHA-256 Credit Memo Hash: {sha256_hash}")
    
    # 2. Interact with Smart Contracts (Targeting local network addresses)
    # Note: Replace contract_address and ABI with actual values post-deployment
    return {
        "status": "SUCCESS",
        "applicationId": application_id,
        "sha256Hash": sha256_hash,
        "appIdBytes": app_id_bytes,
        "berRating": ber_rating,
        "discountEligible": ber_rating in ["A1", "A2", "A3"]
    }

if __name__ == "__main__":
    sample_memo = "UNDERWRITER APPROVAL: Income verified. LTV 75%. Risk Tier Low."
    result = process_underwriter_approval("APP-10042", "0x123...abc", 350000, 350, 360, "A2", sample_memo)
    print(json.dumps(result, indent=2))

