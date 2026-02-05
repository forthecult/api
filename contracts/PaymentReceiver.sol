// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PaymentReceiver
 * @notice Minimal contract that receives ETH or ERC20 payments for a specific order.
 *         Deployed via CREATE2 for deterministic addresses. Only the treasury can withdraw.
 * @dev This is the implementation contract. Clones (EIP-1167 proxies) delegate to this.
 *      Each clone has its own storage and is immutable once deployed.
 *
 * Security considerations:
 * - ReentrancyGuard prevents reentrancy attacks during ETH sweeps
 * - Initialize can only be called by the factory (checked via initializer parameter)
 * - All funds go to treasury regardless of who calls sweep functions
 */
contract PaymentReceiver is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Maximum tokens that can be swept in a single batch call
    uint256 public constant MAX_BATCH_SIZE = 20;

    /// @notice The treasury address that receives all swept funds (set once via initialize)
    address public treasury;
    
    /// @notice The factory address that deployed this receiver
    address public factory;
    
    /// @notice The order ID this receiver is for (for reference/events)
    bytes32 public orderId;
    
    /// @notice Whether this contract has been initialized
    bool public initialized;

    /// @notice Emitted when the receiver is initialized
    event Initialized(address indexed treasury, bytes32 indexed orderId, address indexed factory);
    
    /// @notice Emitted when ETH is received
    event PaymentReceived(address indexed from, uint256 amount);
    
    /// @notice Emitted when funds are swept to treasury
    event Swept(address indexed token, uint256 amount);

    /// @notice Error when contract is already initialized
    error AlreadyInitialized();
    
    /// @notice Error when caller is not the factory
    error OnlyFactory();
    
    /// @notice Error when address is invalid (zero)
    error InvalidAddress();
    
    /// @notice Error when there's nothing to sweep
    error NothingToSweep();
    
    /// @notice Error when ETH transfer fails
    error ETHTransferFailed();
    
    /// @notice Error when batch size exceeds limit
    error BatchTooLarge();

    /// @notice Prevents re-initialization (for clone pattern)
    modifier onlyOnce() {
        if (initialized) revert AlreadyInitialized();
        _;
    }

    /**
     * @notice Initialize the payment receiver (called once per clone by factory only)
     * @param _treasury The address that can sweep funds
     * @param _orderId The order ID for reference
     * @param _factory The factory address (verified to prevent front-running)
     * @dev The factory passes its own address to prevent front-running attacks.
     *      Only the legitimate factory deployment flow will have matching addresses.
     */
    function initialize(address _treasury, bytes32 _orderId, address _factory) external onlyOnce {
        if (_treasury == address(0)) revert InvalidAddress();
        if (_factory == address(0)) revert InvalidAddress();
        
        treasury = _treasury;
        orderId = _orderId;
        factory = _factory;
        initialized = true;
        
        emit Initialized(_treasury, _orderId, _factory);
    }

    /**
     * @notice Receive ETH payments
     */
    receive() external payable {
        emit PaymentReceived(msg.sender, msg.value);
    }

    /**
     * @notice Fallback for ETH sent with data
     */
    fallback() external payable {
        emit PaymentReceived(msg.sender, msg.value);
    }

    /**
     * @notice Sweep all ETH to treasury
     * @dev Anyone can call this - funds always go to treasury.
     *      Uses nonReentrant to prevent reentrancy attacks via treasury.call
     */
    function sweepETH() external nonReentrant {
        if (!initialized) revert AlreadyInitialized();
        
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToSweep();
        
        // Cache treasury to save gas and prevent reentrancy manipulation
        address _treasury = treasury;
        
        // Emit event before external call (checks-effects-interactions pattern)
        emit Swept(address(0), balance);
        
        // Transfer ETH to treasury
        (bool success, ) = _treasury.call{value: balance}("");
        if (!success) revert ETHTransferFailed();
    }

    /**
     * @notice Sweep all of a specific ERC20 token to treasury
     * @param token The ERC20 token address
     * @dev Anyone can call this - funds always go to treasury.
     *      Uses nonReentrant to prevent reentrancy via malicious tokens.
     */
    function sweepToken(address token) external nonReentrant {
        if (!initialized) revert AlreadyInitialized();
        if (token == address(0)) revert InvalidAddress();
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert NothingToSweep();
        
        emit Swept(token, balance);
        
        IERC20(token).safeTransfer(treasury, balance);
    }

    /**
     * @notice Sweep multiple ERC20 tokens to treasury in one transaction
     * @param tokens Array of ERC20 token addresses (max 20)
     * @dev Limited batch size prevents gas griefing attacks
     */
    function sweepTokens(address[] calldata tokens) external nonReentrant {
        if (!initialized) revert AlreadyInitialized();
        if (tokens.length > MAX_BATCH_SIZE) revert BatchTooLarge();
        
        address _treasury = treasury;
        
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            if (token == address(0)) continue;
            
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                emit Swept(token, balance);
                IERC20(token).safeTransfer(_treasury, balance);
            }
        }
    }

    /**
     * @notice Get the ETH balance of this receiver
     */
    function getETHBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get the token balance of this receiver
     * @param token The ERC20 token address
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
