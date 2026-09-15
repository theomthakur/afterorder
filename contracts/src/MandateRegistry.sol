// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MandateRegistry {
    struct Mandate { bytes32 parentId; bytes32 rootId; address owner; address delegate; address token; address evidenceSigner; uint128 maxPerOrder; uint128 maxCumulative; uint128 allocated; uint64 validAfter; uint64 expiresAt; bytes32 supplierRoot; bytes32 policyCommitment; bool revoked; uint8 depth; }
    mapping(bytes32 => Mandate) public mandates;
    address public escrow;
    address public immutable deployer;
    event MandateGranted(bytes32 indexed id, bytes32 indexed parentId, address indexed owner, address delegate, address evidenceSigner, uint256 maxCumulative);
    event MandateRevoked(bytes32 indexed id, address indexed actor);
    event AllocationRestored(bytes32 indexed id, uint256 amount);
    error Unauthorized(); error InvalidMandate(); error LimitExceeded(); error Inactive();
    constructor() { deployer = msg.sender; }
    function bindEscrow(address target) external { if (msg.sender != deployer || escrow != address(0) || target == address(0)) revert Unauthorized(); escrow = target; }
    function grantRoot(bytes32 id, address delegate, address token, address evidenceSigner, uint128 perOrder, uint128 cumulative, uint64 validAfter, uint64 expiresAt, bytes32 supplierRoot, bytes32 policyCommitment) external {
        if (mandates[id].owner != address(0) || delegate == address(0) || token == address(0) || evidenceSigner == address(0) || evidenceSigner == delegate || evidenceSigner == msg.sender || perOrder > cumulative || validAfter >= expiresAt) revert InvalidMandate();
        mandates[id] = Mandate(0, id, msg.sender, delegate, token, evidenceSigner, perOrder, cumulative, 0, validAfter, expiresAt, supplierRoot, policyCommitment, false, 0);
        emit MandateGranted(id, 0, msg.sender, delegate, evidenceSigner, cumulative);
    }
    function delegate(bytes32 id, bytes32 parentId, address childDelegate, uint128 perOrder, uint128 cumulative, uint64 validAfter, uint64 expiresAt) external {
        Mandate storage p = mandates[parentId];
        if (p.owner == address(0) || (msg.sender != p.delegate && msg.sender != p.owner) || p.depth >= 2 || mandates[id].owner != address(0)) revert Unauthorized();
        if (childDelegate == address(0) || childDelegate == p.evidenceSigner || perOrder > p.maxPerOrder || cumulative > p.maxCumulative || validAfter < p.validAfter || expiresAt > p.expiresAt || validAfter >= expiresAt) revert InvalidMandate();
        mandates[id] = Mandate(parentId, p.rootId, p.owner, childDelegate, p.token, p.evidenceSigner, perOrder, cumulative, 0, validAfter, expiresAt, p.supplierRoot, p.policyCommitment, false, p.depth + 1);
        emit MandateGranted(id, parentId, p.owner, childDelegate, p.evidenceSigner, cumulative);
    }
    function revoke(bytes32 id) external { Mandate storage m = mandates[id]; if (m.owner == address(0) || (msg.sender != m.owner && msg.sender != m.delegate)) revert Unauthorized(); m.revoked = true; emit MandateRevoked(id, msg.sender); }
    function authority(bytes32 id) external view returns (address owner, address delegate, address token, address evidenceSigner, bytes32 supplierRoot) {
        Mandate storage m = mandates[id];
        return (m.owner, m.delegate, m.token, m.evidenceSigner, m.supplierRoot);
    }
    function previewSpend(bytes32 id, address token, uint256 amount) public view returns (bool) {
        bytes32 cursor = id;
        for (uint256 i; i < 3; i++) {
            Mandate storage m = mandates[cursor];
            if (m.owner == address(0) || m.revoked || block.timestamp < m.validAfter || block.timestamp >= m.expiresAt || m.token != token || amount > m.maxPerOrder || uint256(m.allocated) + amount > m.maxCumulative) return false;
            if (m.parentId == bytes32(0)) return true;
            cursor = m.parentId;
        }
        return false;
    }
    function consume(bytes32 id, address token, uint128 amount) external {
        if (msg.sender != escrow) revert Unauthorized();
        if (!previewSpend(id, token, amount)) revert Inactive();
        bytes32 cursor = id;
        for (uint256 i; i < 3; i++) { Mandate storage m = mandates[cursor]; m.allocated += amount; if (m.parentId == bytes32(0)) return; cursor = m.parentId; }
        revert InvalidMandate();
    }
    function restore(bytes32 id, address token, uint128 amount) external {
        if (msg.sender != escrow) revert Unauthorized();
        bytes32 cursor = id;
        for (uint256 i; i < 3; i++) {
            Mandate storage m = mandates[cursor];
            if (m.owner == address(0) || m.token != token || m.allocated < amount) revert InvalidMandate();
            m.allocated -= amount;
            if (m.parentId == bytes32(0)) { emit AllocationRestored(id, amount); return; }
            cursor = m.parentId;
        }
        revert InvalidMandate();
    }
}
