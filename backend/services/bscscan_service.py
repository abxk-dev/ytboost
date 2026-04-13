cp /dev/stdin ~/Downloads/YT/ytboost/backend/services/bscscan_service.py << 'EOF'
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
        tx_resp = await rpc_call("eth_getTransactionByHash",