// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// The USDT functions this contract calls. Whitechain test USDT is Tether's
/// TetherTokenV2, which has EIP-3009 receiveWithAuthorization.
interface IUSDT {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function transfer(address to, uint256 value) external returns (bool);
}

/// Pay-per-lookup checkout. The payer signs a USDT ReceiveWithAuthorization
/// to this contract off chain; any account (in practice our relayer) submits
/// it with pay() and pays the WBT gas. The payer needs no WBT.
///
/// receiveWithAuthorization (not transferWithAuthorization) requires
/// msg.sender == to, so a signed payment can only settle through pay():
/// nobody can copy it from the mempool and settle it on the token directly,
/// which would skip the Paid event and waste the relayer's gas.
contract LookupPay {
    IUSDT public immutable usdt;
    address public owner;
    uint256 public price;

    event Paid(bytes32 indexed nonce, address indexed payer, uint256 value);
    event PriceSet(uint256 price);

    error NotOwner();
    error BelowPrice();
    error TransferFailed();

    constructor(address usdt_, uint256 price_) {
        usdt = IUSDT(usdt_);
        owner = msg.sender;
        price = price_;
        emit PriceSet(price_);
    }

    /// The nonce is the payment id: the token refuses a nonce twice, so a
    /// payment cannot be replayed.
    function pay(
        address from,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (value < price) revert BelowPrice();
        usdt.receiveWithAuthorization(from, address(this), value, validAfter, validBefore, nonce, v, r, s);
        emit Paid(nonce, from, value);
    }

    function setPrice(uint256 price_) external {
        if (msg.sender != owner) revert NotOwner();
        price = price_;
        emit PriceSet(price_);
    }

    function withdraw(address to, uint256 value) external {
        if (msg.sender != owner) revert NotOwner();
        if (!usdt.transfer(to, value)) revert TransferFailed();
    }
}
