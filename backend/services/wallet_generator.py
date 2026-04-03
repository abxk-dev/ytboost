"""
Wallet Generator Service
Generates unique deposit addresses for BEP20 payments using eth_account
Uses AES-256 encryption for private key storage
"""
import os
import secrets
from eth_account import Account
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
import base64

# Generate a default encryption key if not provided
DEFAULT_ENCRYPTION_KEY = secrets.token_hex(16)  # 32 hex chars = 16 bytes

def get_encryption_key():
    """Get the 16-byte encryption key from environment or default"""
    key_hex = os.environ.get('WALLET_ENCRYPTION_KEY', DEFAULT_ENCRYPTION_KEY)
    # Ensure key is 32 hex characters (16 bytes)
    if len(key_hex) < 32:
        key_hex = key_hex.ljust(32, '0')
    return bytes.fromhex(key_hex[:32])

def encrypt_private_key(private_key: str) -> str:
    """Encrypt private key using AES-256-CBC"""
    try:
        key = get_encryption_key()
        iv = secrets.token_bytes(16)
        cipher = AES.new(key, AES.MODE_CBC, iv)
        padded_data = pad(private_key.encode('utf-8'), AES.block_size)
        encrypted = cipher.encrypt(padded_data)
        # Return as base64: iv:encrypted
        return base64.b64encode(iv).decode() + ':' + base64.b64encode(encrypted).decode()
    except Exception as e:
        print(f"Encryption error: {e}")
        raise

def decrypt_private_key(encrypted_key: str) -> str:
    """Decrypt private key using AES-256-CBC"""
    try:
        key = get_encryption_key()
        iv_b64, enc_b64 = encrypted_key.split(':')
        iv = base64.b64decode(iv_b64)
        encrypted = base64.b64decode(enc_b64)
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted = unpad(cipher.decrypt(encrypted), AES.block_size)
        return decrypted.decode('utf-8')
    except Exception as e:
        print(f"Decryption error: {e}")
        raise

def generate_deposit_address():
    """
    Generate a fresh random wallet for each payment session
    Returns address, private_key, and encrypted private key
    """
    # Enable unaudited HD wallet features
    Account.enable_unaudited_hdwallet_features()
    
    # Create a new random account
    account = Account.create()
    
    return {
        'address': account.address,
        'private_key': account.key.hex(),
        'encrypted_key': encrypt_private_key(account.key.hex())
    }

if __name__ == "__main__":
    # Test wallet generation
    wallet = generate_deposit_address()
    print(f"Address: {wallet['address']}")
    print(f"Encrypted Key: {wallet['encrypted_key'][:50]}...")
    
    # Test decryption
    decrypted = decrypt_private_key(wallet['encrypted_key'])
    print(f"Decryption successful: {decrypted == wallet['private_key']}")
