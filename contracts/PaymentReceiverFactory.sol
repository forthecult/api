// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PaymentReceiver.sol";

/**
 * @title PaymentReceiverFactory
 * @notice Factory contract that deploys PaymentReceiver clones using CREATE2.
 *         Each order gets a unique, deterministic payment address.
 * @dev Uses EIP-1167 minimal proxies for gas-efficient deployment (~$1-3 per clone).
 *      Addresses can be computed off-chain before deployment.
 *
 * Security considerations:
 * - Only owner can deploy receivers (prevents front-running)
 * - Batch operations have size limits (prevents gas griefing)
 * - ReentrancyGuard on batch sweeps (prevents reentrancy)
 * - Factory address passed to receivers (prevents initialization hijacking)
 */
contract PaymentReceiverFactory is Ownable, ReentrancyGuard {
    using Clones for address;

    /// @notice Maximum receivers that can be swept in a single batch
    uint256 public constant MAX_BATCH_SIZE = 50;

    /// @notice The PaymentReceiver implementation contract
    address public immutable implementation;
    
    /// @notice The treasury address that receives all payments
    address public treasury;

    /// @notice Mapping of orderId to deployed receiver address
    mapping(bytes32 => address) public receivers;

    /// @notice Emitted when a new receiver is deployed
    event ReceiverDeployed(
        bytes32 indexed orderId,
        address indexed receiver,
        address indexed treasury
    );

    /// @notice Emitted when treasury is updated
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    
    /// @notice Emitted when a batch sweep fails for a specific receiver
    event SweepFailed(bytes32 indexed orderId, address indexed receiver, string reason);

    /// @notice Error when address is invalid (zero)
    error InvalidAddress();
    
    /// @notice Error when receiver already exists
    error ReceiverExists();
    
    /// @notice Error when batch size exceeds limit
    error BatchTooLarge();

    /**
     * @notice Deploy the factory with a new PaymentReceiver implementation
     * @param _treasury The address that will receive all swept funds
     */
    constructor(address _treasury) Ownable(msg.sender) {
        if (_treasury == address(0)) revert InvalidAddress();
        treasury = _treasury;
        
        // Deploy the implementation contract
        implementation = address(new PaymentReceiver());
    }

    /**
     * @notice Update the treasury address
     * @param _treasury The new treasury address
     * @dev Only owner can call. Does not affect already-deployed receivers.
     */
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert InvalidAddress();
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    /**
     * @notice Compute the deterministic address for an order's payment receiver
     * @param orderId The unique order identifier (typically a CUID or UUID)
     * @return The address where the receiver will be/is deployed
     * @dev This address is deterministic and can be computed off-chain
     */
    function computeAddress(bytes32 orderId) public view returns (address) {
        return implementation.predictDeterministicAddress(orderId, address(this));
    }

    /**
     * @notice Deploy a payment receiver for an order
     * @param orderId The unique order identifier
     * @return receiver The address of the deployed receiver
     * @dev Only owner can deploy to prevent front-running attacks.
     *      Reverts if already deployed for this orderId.
     */
    function deployReceiver(bytes32 orderId) external onlyOwner returns (address receiver) {
        if (receivers[orderId] != address(0)) revert ReceiverExists();
        
        // Deploy clone using CREATE2 with orderId as salt
        receiver = implementation.cloneDeterministic(orderId);
        
        // Initialize the receiver with factory address to prevent hijacking
        PaymentReceiver(payable(receiver)).initialize(treasury, orderId, address(this));
        
        // Record deployment
        receivers[orderId] = receiver;
        
        emit ReceiverDeployed(orderId, receiver, treasury);
    }

    /**
     * @notice Deploy a receiver if not already deployed, or return existing
     * @param orderId The unique order identifier
     * @return receiver The address of the receiver (new or existing)
     * @dev Only owner can deploy to prevent front-running attacks.
     */
    function getOrDeployReceiver(bytes32 orderId) external onlyOwner returns (address receiver) {
        receiver = receivers[orderId];
        if (receiver == address(0)) {
            receiver = implementation.cloneDeterministic(orderId);
            PaymentReceiver(payable(receiver)).initialize(treasury, orderId, address(this));
            receivers[orderId] = receiver;
            emit ReceiverDeployed(orderId, receiver, treasury);
        }
    }

    /**
     * @notice Check if a receiver has been deployed for an order
     * @param orderId The order identifier
     * @return True if deployed, false otherwise
     */
    function isDeployed(bytes32 orderId) external view returns (bool) {
        return receivers[orderId] != address(0);
    }

    /**
     * @notice Get the receiver address for an order (zero if not deployed)
     * @param orderId The order identifier
     * @return The receiver address or address(0) if not deployed
     */
    function getReceiver(bytes32 orderId) external view returns (address) {
        return receivers[orderId];
    }

    /**
     * @notice Batch sweep ETH from multiple receivers to treasury
     * @param orderIds Array of order IDs whose receivers should be swept (max 50)
     * @dev Limited batch size prevents gas griefing. Emits SweepFailed for failures.
     */
    function batchSweepETH(bytes32[] calldata orderIds) external nonReentrant {
        if (orderIds.length > MAX_BATCH_SIZE) revert BatchTooLarge();
        
        for (uint256 i = 0; i < orderIds.length; i++) {
            bytes32 oid = orderIds[i];
            address receiver = receivers[oid];
            
            if (receiver == address(0)) continue;
            if (receiver.balance == 0) continue;
            
            try PaymentReceiver(payable(receiver)).sweepETH() {
                // Success - event emitted by PaymentReceiver
            } catch Error(string memory reason) {
                emit SweepFailed(oid, receiver, reason);
            } catch {
                emit SweepFailed(oid, receiver, "Unknown error");
            }
        }
    }

    /**
     * @notice Batch sweep a specific token from multiple receivers
     * @param orderIds Array of order IDs whose receivers should be swept (max 50)
     * @param token The ERC20 token to sweep
     * @dev Limited batch size prevents gas griefing. Emits SweepFailed for failures.
     */
    function batchSweepToken(bytes32[] calldata orderIds, address token) external nonReentrant {
        if (orderIds.length > MAX_BATCH_SIZE) revert BatchTooLarge();
        if (token == address(0)) revert InvalidAddress();
        
        for (uint256 i = 0; i < orderIds.length; i++) {
            bytes32 oid = orderIds[i];
            address receiver = receivers[oid];
            
            if (receiver == address(0)) continue;
            
            try PaymentReceiver(payable(receiver)).sweepToken(token) {
                // Success - event emitted by PaymentReceiver
            } catch Error(string memory reason) {
                emit SweepFailed(oid, receiver, reason);
            } catch {
                emit SweepFailed(oid, receiver, "Unknown error");
            }
        }
    }
}
