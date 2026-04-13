"""
BscScan Service - Verify BEP20 USDT transactions via BscScan API
"""
import httpx

# USDT BEP20 contract address on BSC
USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955"

# Minimum confirmations considered safe
MIN_CONFIRMATIONS = 1


async def verify_tx_hash_bscscan(tx_hash: str, expected_wallet: str, api_key: str) -> dict:
    """
    Verify a BEP20 USDT transfer on BSC via BscScan API.

    Always returns a dict:
      - Success: {"success": True,  "amount": float, "confirmations": int, "from": str, "to": str}
      - Failure: {"success": False, "error": str}
    """
    if not tx_hash or not expected_wallet or not api_key:
        return {"success": False, "error": "Missing required parameters"}

    try:
        # ── Step 1: Get transaction receipt to check status & confirmations ──
        receipt_url = (
            "https://api.bscscan.com/api"
            f"?module=proxy&action=eth_getTransactionByHash"
            f"&txhash={tx_hash}"
            f"&apikey={api_key}"
        )

        async with httpx.AsyncClient(timeout=15) as client:
            receipt_resp = await client.get(receipt_url)

        receipt_data = receipt_resp.json()

        tx = receipt_data.get("result")
        if not tx or tx == "0x" or not isinstance(tx, dict):
            return {"success": False, "error": "Transaction not found on BSC network"}

        # ── Step 2: Get current block to calculate confirmations ──
        block_url = (
            "https://api.bscscan.com/api"
            f"?module=proxy&action=eth_blockNumber"
            f"&apikey={api_key}"
        )

        async with httpx.AsyncClient(timeout=15) as client:
            block_resp = await client.get(block_url)

        block_data = block_resp.json()
        current_block_hex = block_data.get("result", "0x0")

        try:
            current_block = int(current_block_hex, 16)
            tx_block = int(tx.get("blockNumber") or "0x0", 16)
            confirmations = max(0, current_block - tx_block)
        except Exception:
            confirmations = 0

        # ── Step 3: Verify BEP20 token transfer via token tx list ──
        token_url = (
            "https://api.bscscan.com/api"
            f"?module=account&action=tokentx"
            f"&contractaddress={USDT_CONTRACT}"
            f"&address={expected_wallet.lower()}"
            f"&txhash={tx_hash}"  # not officially supported but some versions honour it
            f"&sort=desc"
            f"&apikey={api_key}"
        )

        async with httpx.AsyncClient(timeout=15) as client:
            token_resp = await client.get(token_url)

        token_data = token_resp.json()

        if token_data.get("status") != "1" or not token_data.get("result"):
            # Fallback: search by wallet without txhash filter
            token_url_fallback = (
                "https://api.bscscan.com/api"
                f"?module=account&action=tokentx"
                f"&contractaddress={USDT_CONTRACT}"
                f"&address={expected_wallet.lower()}"
                f"&page=1&offset=50&sort=desc"
                f"&apikey={api_key}"
            )

            async with httpx.AsyncClient(timeout=15) as client:
                token_resp = await client.get(token_url_fallback)

            token_data = token_resp.json()

        if token_data.get("status") != "1":
            msg = token_data.get("message", "No token transfers found")
            return {"success": False, "error": f"BscScan API error: {msg}"}

        transfers = token_data.get("result", [])
        if not isinstance(transfers, list):
            return {"success": False, "error": "Unexpected BscScan response format"}

        # ── Step 4: Find the matching transfer for this txHash ──
        matched = None
        for transfer in transfers:
            if not isinstance(transfer, dict):
                continue
            if transfer.get("hash", "").lower() == tx_hash.lower():
                matched = transfer
                break

        if not matched:
            return {
                "success": False,
                "error": (
                    "Transaction found on BSC but no USDT transfer to the "
                    "expected wallet was detected. Make sure you sent USDT (BEP20)."
                ),
            }

        # ── Step 5: Verify the recipient is our wallet ──
        to_address = matched.get("to", "").lower()
        if to_address != expected_wallet.lower():
            return {
                "success": False,
                "error": (
                    f"Transaction recipient ({to_address}) does not match "
                    f"the expected deposit address."
                ),
            }

        # ── Step 6: Parse amount (USDT has 18 decimals on BEP20) ──
        try:
            raw_value = int(matched.get("value", "0"))
            decimals = int(matched.get("tokenDecimal", "18"))
            amount = raw_value / (10 ** decimals)
        except Exception:
            return {"success": False, "error": "Failed to parse transfer amount"}

        if amount <= 0:
            return {"success": False, "error": "Transfer amount is zero"}

        # ── Step 7: Use confirmations from token transfer if available ──
        try:
            tx_block_from_transfer = int(matched.get("blockNumber", 0))
            if tx_block_from_transfer > 0 and current_block > 0:
                confirmations = max(0, current_block - tx_block_from_transfer)
        except Exception:
            pass  # keep the confirmations calculated earlier

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
        return {"success": False, "error": f"Network error contacting BscScan: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"Unexpected error during verification: {str(e)}"}
