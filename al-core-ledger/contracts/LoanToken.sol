// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract LoanToken is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant GREEN_DISCOUNT_BPS = 25;

    struct LoanNote {
        uint256 principal; // Currency minor units (for example, euro cents)
        uint256 aprBps; // Annual Percentage Rate in basis points (e.g., 350 = 3.50%)
        uint256 termMonths;
        bytes32 borrowerHash;
        string berRating;
    }

    mapping(uint256 => LoanNote) public loanNotes;

    event LoanMinted(uint256 indexed tokenId, bytes32 indexed borrowerHash, uint256 finalAprBps);

    constructor() ERC721("AgenticLenderNote", "ALN") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mintLoanToken(
        address to,
        uint256 tokenId,
        uint256 principal,
        uint256 baseAprBps,
        uint256 termMonths,
        bytes32 borrowerHash,
        string memory berRating
    ) external onlyRole(MINTER_ROLE) {
        require(to != address(0), "Recipient cannot be zero");
        require(principal > 0, "Principal must be positive");
        require(baseAprBps <= 10_000, "APR exceeds 100 percent");
        require(termMonths > 0 && termMonths <= 600, "Invalid loan term");
        require(borrowerHash != bytes32(0), "Borrower hash cannot be zero");
        require(_isSupportedBerRating(berRating), "Unsupported BER rating");

        uint256 finalApr = baseAprBps;
        if (_isGreenBerRating(berRating)) {
            finalApr = baseAprBps > GREEN_DISCOUNT_BPS ? baseAprBps - GREEN_DISCOUNT_BPS : 0;
        }

        loanNotes[tokenId] = LoanNote(principal, finalApr, termMonths, borrowerHash, berRating);
        _safeMint(to, tokenId);

        emit LoanMinted(tokenId, borrowerHash, finalApr);
    }

    function _isGreenBerRating(string memory berRating) private pure returns (bool) {
        bytes32 ratingHash = keccak256(bytes(berRating));
        return
            ratingHash == keccak256("A1") ||
            ratingHash == keccak256("A2") ||
            ratingHash == keccak256("A3");
    }

    function _isSupportedBerRating(string memory berRating) private pure returns (bool) {
        bytes32 ratingHash = keccak256(bytes(berRating));
        return
            _isGreenBerRating(berRating) ||
            ratingHash == keccak256("B1") ||
            ratingHash == keccak256("B2") ||
            ratingHash == keccak256("B3") ||
            ratingHash == keccak256("C1") ||
            ratingHash == keccak256("C2") ||
            ratingHash == keccak256("C3") ||
            ratingHash == keccak256("D1") ||
            ratingHash == keccak256("D2") ||
            ratingHash == keccak256("E1") ||
            ratingHash == keccak256("E2") ||
            ratingHash == keccak256("F") ||
            ratingHash == keccak256("G") ||
            ratingHash == keccak256("UNKNOWN");
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
