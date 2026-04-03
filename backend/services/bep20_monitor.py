"""
BEP20 Monitor Service
Monitors BSC blockchain for USDT BEP20 transfers to deposit addresses
"""
import os
import asyncio
from web3 import Web3
from datetime import datetime, timezone

# BSC Configuration
BSC_RPC_URL = os.environ.get('BSC_RPC_URL', 'https://bsc-dataseed.binance.org')
USDT_BEP20_CONTRACT = os.environ.get('USDT_BEP20_CONTRACT', '0x55d398326f99059fF775485246999027B3197955')
USDT_DECIMALS = 18

# ERC20 Transfer event ABI
ERC20_TRANSFER_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "from", "type": "address"},
            {"indexed": True, "name": "to", "type": "address"},
            {"indexed": False, "name": "value", "type": "uint256"}
        ],
        "name": "Transfer",
        "type": "event"
    },
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    }
]

def get_web3():
    """Get Web3 instance connected to BSC"""
    return Web3(Web3.HTTPProvider(BSC_RPC_URL))

async def check_bep20_payment(session: dict, db, socket_manager=None):
    """
    Check if a BEP20 USDT payment has been received for a session
    
    Args:
        session: CryptoPaymentSession document
        db: MongoDB database instance
        socket_manager: Socket.io manager for real-time updates
    
    Returns:
        dict with txHash, amount, confirmations if payment found, else None
    """
    try:
        w3 = get_web3()
        
        if not w3.is_connected():
            print(f"Web3 not connected to BSC RPC")
            return None
        
        deposit_address = session['depositAddress']
        expected_amount = session['expectedAmount']
        session_id = str(session['_id'])
        
        # Get current block
        current_block = w3.eth.block_number
        
        # Calculate from_block (BSC ~3 sec/block, check last 30 min = ~600 blocks)
        from_block = max(0, current_block - 650)
        
        # Create contract instance
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(USDT_BEP20_CONTRACT),
            abi=ERC20_TRANSFER_ABI
        )
        
        # Query Transfer events to deposit address
        try:
            events = contract.events.Transfer.get_logs(
                fromBlock=from_block,
                toBlock=current_block,
                argument_filters={'to': Web3.to_checksum_address(deposit_address)}
            )
        except Exception as e:
            print(f"Error fetching events: {e}")
            return None
        
        if not events:
            return None
        
        # Find matching payment
        for event in events:
            amount = event['args']['value'] / (10 ** USDT_DECIMALS)
            
            # Check if amount >= expected (allow 1% tolerance for fees)
            if amount >= expected_amount * 0.99:
                tx_hash = event['transactionHash'].hex()
                
                # Get transaction receipt for confirmations
                receipt = w3.eth.get_transaction_receipt(tx_hash)
                confirmations = current_block - receipt['blockNumber'] + 1
                
                required_confirms = session.get('requiredConfirms', 1)
                new_status = 'confirmed' if confirmations >= required_confirms else 'detecting'
                
                # Update session in database
                await db.crypto_payment_sessions.update_one(
                    {'_id': session['_id']},
                    {
                        '$set': {
                            'status': new_status,
                            'txHash': tx_hash,
                            'receivedAmount': amount,
                            'confirmations': confirmations,
                            'detectedAt': datetime.now(timezone.utc)
                        }
                    }
                )
                
                # Emit socket event if socket manager is available
                if socket_manager:
                    await socket_manager.emit(
                        'payment_detected',
                        {
                            'sessionId': session_id,
                            'txHash': tx_hash,
                            'amount': amount,
                            'confirmations': confirmations
                        },
                        room=f'payment-session-{session_id}'
                    )
                
                print(f"✅ Payment detected for session {session_id}: {amount} USDT, TX: {tx_hash}")
                
                return {
                    'txHash': tx_hash,
                    'amount': amount,
                    'confirmations': confirmations
                }
        
        return None
        
    except Exception as e:
        print(f"BEP20 check error for session {session.get('_id')}: {str(e)}")
        return None

async def get_usdt_balance(address: str) -> float:
    """Get USDT BEP20 balance for an address"""
    try:
        w3 = get_web3()
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(USDT_BEP20_CONTRACT),
            abi=ERC20_TRANSFER_ABI
        )
        balance = contract.functions.balanceOf(Web3.to_checksum_address(address)).call()
        return balance / (10 ** USDT_DECIMALS)
    except Exception as e:
        print(f"Error getting USDT balance: {e}")
        return 0.0
