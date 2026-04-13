"""
BscScan Service - Verify BEP20 USDT/BSC-USD transactions via BscScan API V2
"""
import httpx

MIN_CONFIRMATIONS = 1

# V2 API endpoint
BSCSCAN_V2 = "https://api.etherscan.io/v2/api?chainid=56"


async def verify_tx_hash_bscscan(tx_hash: str, expected_wallet: str, api_key: str) -> dict:
    if not tx_hash or not expected_wallet or not api_key:
        return {"success": False, "error": "Missing required parameters"}

    try:
        # Step 1: Get current block
        current_block = 0
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                block_resp = await client.get(
                    f"{BSCSCAN_V2}&module=proxy&action=eth_blockNumber&apikey={api_key}"
                )
            current_block = int(block_resp.json().get("result", "0x0"), 16)
        except Exception:
            current_block = 0

        # Step 2: Search ALL token transfers to wallet (no contract filter)
        matched = None
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"{BSCSCAN_V2}"
                f"&module=account&action=tokentx"
                f"&address={expected_wallet.lower()}"
                f"&page=1&offset=100&sort=desc"
                f"&apikey={api_key}"
            )
        data = resp.json()

        for t in data.get("result", []):
            if isinstance(t, dict) and t.get("hash", "").lower() == tx_hash.lower():
                matched = t
                break

        if not matched:
            return {
                "success": False,
                "error": "Transaction not found. Ensure you sent BSC-USD/USDT to the correct wallet address."
            }

        # Step 3: Verify recipient
        to_address = matched.get("to", "").lower()
        if to_address != expected_wallet.lower():
            return {
                "success": False,
                "error": f"Wrong recipient. Sent to {to_address}, expected {expected_wallet.lower()}"
            }

        # Step 4: Parse amount
        try:
            decimals = int(matched.get("tokenDecimal", "18"))
            amount = int(matched.get("value", "0")) / (10 ** decimals)
        except Exception:
            return {"success": False, "error": "Failed to parse transfer amount"}

        if amount <= 0:
            return {"success": False, "error": "Transfer amount is zero"}

        # Step 5: Calculate confirmations
        try:
            tx_block = int(matched.get("blockNumber", 0))
            if tx_block > 0 and current_block > 0:
                confirmations = max(1, current_block - tx_block)
            elif tx_block > 0:
                confirmations = 999
            else:
                confirmations = 1
        except Exception:
            confirmations = 1

        return {
            "success": True,
            "amount": round(amount, 6),
            "confirmations": confirmations,
            "from": matched.get("from", ""),
            "to": to_address,
            "tokenName": matched.get("tokenName", "USDT"),
            "tokenSymbol": matched.get("tokenSymbol", "USDT"),
            "blockNumber": matched.get("blockNumber"),
            "timeStamp": matched.get("timeStamp"),
        }

    except httpx.TimeoutException:
        return {"success": False, "error": "BscScan API request timed out. Please try again."}
    except httpx.RequestError as e:
        return {"success": False, "error": f"Network error: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"Unexpected error: {str(e)}"}
