"""
BEP20 Monitor Service - uses raw eth_getLogs to avoid ABI argument filter issues
"""
import os
import asyncio
from web3 import Web3
from datetime import datetime, timezone

BSC_RPC_URL = os.environ.get('BSC_RPC_URL', 'https://bsc-dataseed.binance.org')
USDT_BEP20_CONTRACT = os.environ.get('USDT_BEP20_CONTRACT', '0x55d398326f99059fF775485246999027B3197955')
USDT_DECIMALS = 18

ERC20_ABI = [
    {"constant": True, "inputs": [{"name": "_owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "balance", "type": "uint256"}], "type": "function"}
]

def get_web3():
    return Web3(Web3.HTTPProvider(BSC_RPC_URL))

async def check_bep20_payment(session: dict, db, socket_manager=None):
    try:
        w3 = get_web3()
        if not w3.is_connected():
            return None

        deposit_address = session['depositAddress']
        expected_amount = session['expectedAmount']
        session_id = str(session['_id'])
        current_block = w3.eth.block_number

        now = datetime.now(timezone.utc)
        created_at = session.get('createdAt') or now
        try:
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        except Exception:
            created_at = now
        if isinstance(created_at, datetime) and created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        minutes_since_created = max(0.0, (now - created_at).total_seconds() / 60.0)
        blocks_to_scan = int(min(12000, 200 + minutes_since_created * 20))
        from_block = max(0, current_block - blocks_to_scan)

        # Use raw eth_getLogs — avoids ALL ABI argument filter issues
        transfer_topic = w3.keccak(text="Transfer(address,address,uint256)").hex()
        checksum_addr = Web3.to_checksum_address(deposit_address)
        padded_to = "0x" + checksum_addr[2:].zfill(64).lower()

        raw_logs = w3.eth.get_logs({
            "fromBlock": from_block,
            "toBlock": current_block,
            "address": Web3.to_checksum_address(USDT_BEP20_CONTRACT),
            "topics": [transfer_topic, None, padded_to],
        })

        if not raw_logs:
            return None

        for log in raw_logs:
            try:
                data = log["data"]
                value = int(data.hex() if hasattr(data, "hex") else data, 16)
                amount = value / (10 ** USDT_DECIMALS)
            except Exception:
                continue

            if amount < expected_amount * 0.99:
                continue

            tx_hash = log["transactionHash"].hex() if hasattr(log["transactionHash"], "hex") else log["transactionHash"]

            try:
                receipt = w3.eth.get_transaction_receipt(tx_hash)
                confirmations = current_block - receipt["blockNumber"] + 1
            except Exception:
                confirmations = 1

            required_confirms = session.get('requiredConfirms', 1)
            new_status = 'confirmed' if confirmations >= required_confirms else 'detecting'

            await db.crypto_payment_sessions.update_one(
                {'_id': session['_id']},
                {'$set': {
                    'status': new_status,
                    'txHash': tx_hash,
                    'receivedAmount': amount,
                    'confirmations': confirmations,
                    'detectedAt': datetime.now(timezone.utc),
                }}
            )

            if socket_manager:
                try:
                    await socket_manager.emit(
                        'payment_detected',
                        {'sessionId': session_id, 'txHash': tx_hash, 'amount': amount, 'confirmations': confirmations},
                        room=f'payment-session-{session_id}',
                    )
                except Exception:
                    pass

            print(f"✅ Payment detected for session {session_id}: {amount} USDT, TX: {tx_hash}")
            return {'txHash': tx_hash, 'amount': amount, 'confirmations': confirmations}

        return None

    except Exception as e:
        print(f"BEP20 check error for session {session.get('_id')}: {str(e)}")
        return None

async def get_usdt_balance(address: str) -> float:
    try:
        w3 = get_web3()
        contract = w3.eth.contract(address=Web3.to_checksum_address(USDT_BEP20_CONTRACT), abi=ERC20_ABI)
        balance = contract.functions.balanceOf(Web3.to_checksum_address(address)).call()
        return balance / (10 ** USDT_DECIMALS)
    except Exception as e:
        print(f"Error getting USDT balance: {e}")
        return 0.0
