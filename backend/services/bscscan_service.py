"""
BEP20 Payment Verification Service - Uses BSC RPC directly (no API key needed)
"""
import os
import httpx

BSC_RPC_URL = os.environ.get("BSC_RPC_URL", "https://rpc.ankr.com/bsc")
USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955"
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


async def rpc_call(method: str, params: list) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(BSC_RPC_URL, json={
            "jsonrpc": "2.0", "id": 1,
            "method": method, "params": params
        })
    return resp.json()


async def verify_tx_hash_bscscan(tx_hash: str, expected_wallet: str, api_key: str = "") -> dict:
    if not tx_hash or not expected_wallet:
        return {"success": False, "error": "Missing required parameters"}

    try:
        tx_resp = await rpc_call("eth_getTransactionByHash", [tx_hash])
        tx = tx_resp.get("result")
        if not tx:
            return {"success": False, "error": "Transaction not found on blockchain. It may be too old or invalid."}

        receipt_resp = await rpc_call("eth_getTransactionReceipt", [tx_hash])
        receipt = receipt_resp.get("result")
        if not receipt:
            return {"success": False, "error": "Transaction receipt not available yet. Please wait and try again."}

        if receipt.get("status") != "0x1":
            return {"success": False, "error": "Transaction failed on blockchain."}

        expected_wallet_lower = expected_wallet.lower()
        matched_log = None

        for log in receipt.get("logs", []):
            topics = log.get("topics", [])
            if len(topics) < 3:
                continue
            if topics[0].lower() != TRANSFER_TOPIC.lower():
                continue
            to_addr = "0x" + topics[2][-40:]
            if to_addr.lower() == expected_wallet_lower:
                matched_log = log
                break

        if not matched_log:
            return {"success": False, "error": "Transaction not found. Ensure you sent BSC-USD/USDT to the correct wallet address."}

        try:
            value_hex = matched_log.get("data", "0x0")
            value_int = int(value_hex, 16)
            amount = value_int / (10 ** 18)
        except Exception:
            return {"success": False, "error": "Failed to parse transfer amount"}

        if amount <= 0:
            return {"success": False, "error": "Transfer amount is zero"}

        try:
            current_block_resp = await rpc_call("eth_blockNumber", [])
            current_block = int(current_block_resp.get("result", "0x0"), 16)
            tx_block = int(receipt.get("blockNumber", "0x0"), 16)
            confirmations = max(1, current_block - tx_block)
        except Exception:
            confirmations = 1

        contract_addr = matched_log.get("address", "").lower()
        token_symbol = "BSC-USD" if contract_addr != USDT_CONTRACT.lower() else "USDT"

        return {
            "success": True,
            "amount": round(amount, 6),
            "confirmations": confirmations,
            "from": tx.get("from", ""),
            "to": expected_wallet_lower,
            "tokenName": token_symbol,
            "tokenSymbol": token_symbol,
            "blockNumber": str(int(receipt.get("blockNumber", "0x0"), 16)),
            "timeStamp": None,
        }

    except httpx.TimeoutException:
        return {"success": False, "error": "RPC request timed out. Please try again."}
    except httpx.RequestError as e:
        return {"success": False, "error": f"Network error: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"Unexpected error: {str(e)}"}
