// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract LoanToken is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct LoanNote {
        uint256 principal;
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
        uint256 finalApr = baseAprBps;
        
        // Green Mortgage Incentive Discount: 25 bps for BER A1, A2, A3
        bytes32 berHash = keccak256(abi.encodePacked(berRating));
        if (
            berHash == keccak256(abi.encodePacked("A1")) ||
            berHash == keccak256(abi.encodePacked("A2")) ||
            berHash == keccak256(abi.encodePacked("A3"))
        ) {
            finalApr = baseAprBps > 25 ? baseAprBps - 25 : 0;
        }

        loanNotes[tokenId] = LoanNote(principal, finalApr, termMonths, borrowerHash, berRating);
        _safeMint(to, tokenId);

        emit LoanMinted(tokenId, borrowerHash, finalApr);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

