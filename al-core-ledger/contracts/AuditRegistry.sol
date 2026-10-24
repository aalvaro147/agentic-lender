// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract AuditRegistry is AccessControl {
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    struct AuditRecord {
        bytes32 sha256Hash;
        uint256 timestamp;
        address committedBy;
    }

    mapping(bytes32 => AuditRecord) public auditRecords;

    event AuditLogged(bytes32 indexed applicationId, bytes32 indexed sha256Hash, uint256 timestamp);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AUDITOR_ROLE, msg.sender);
    }

    function recordAuditHash(bytes32 applicationId, bytes32 sha256Hash) external onlyRole(AUDITOR_ROLE) {
        require(auditRecords[applicationId].timestamp == 0, "Audit record already exists");

        auditRecords[applicationId] = AuditRecord({
            sha256Hash: sha256Hash,
            timestamp: block.timestamp,
            committedBy: msg.sender
        });

        emit AuditLogged(applicationId, sha256Hash, block.timestamp);
    }
}
