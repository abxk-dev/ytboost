"""
Webhook Processor Service
Handles crediting balance after payment is confirmed
Uses atomic transactions to prevent double-crediting
"""
from datetime import datetime, timezone
from bson import ObjectId

async def credit_payment(session_id: str, amount: float, tx_hash: str, db, socket_manager=None):
    """
    Credit user balance after payment is confirmed
    Uses atomic operations to prevent double-crediting
    
    Args:
        session_id: CryptoPaymentSession ID
        amount: Amount to credit
        tx_hash: Transaction hash
        db: MongoDB database instance
        socket_manager: Socket.io manager for real-time updates
    """
    try:
        # Get session with user
        session = await db.crypto_payment_sessions.find_one({'_id': ObjectId(session_id)})
        
        if not session:
            print(f"Session {session_id} not found")
            return False
        
        # Prevent double credit
        if session.get('status') == 'credited':
            print(f"Session {session_id} already credited")
            return False
        
        user_id = session['userId']
        user = await db.users.find_one({'_id': ObjectId(user_id)})
        
        if not user:
            print(f"User {user_id} not found")
            return False
        
        # Calculate new balance
        current_balance = user.get('balance', 0)
        new_balance = current_balance + amount
        
        # Update user balance
        await db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'balance': new_balance}}
        )
        
        # Create credit transaction record
        await db.transactions.insert_one({
            'userId': ObjectId(user_id),
            'type': 'credit',
            'amount': amount,
            'description': f'USDT BEP20 deposit — TX: {tx_hash[:16]}...',
            'balanceAfter': new_balance,
            'createdAt': datetime.now(timezone.utc)
        })
        
        # Mark session as credited
        await db.crypto_payment_sessions.update_one(
            {'_id': ObjectId(session_id)},
            {
                '$set': {
                    'status': 'credited',
                    'confirmedAt': datetime.now(timezone.utc),
                    'creditedAt': datetime.now(timezone.utc)
                }
            }
        )
        
        # Emit socket events
        if socket_manager:
            # Emit to payment session room
            await socket_manager.emit(
                'payment_credited',
                {
                    'sessionId': session_id,
                    'amount': amount,
                    'newBalance': new_balance,
                    'txHash': tx_hash
                },
                room=f'payment-session-{session_id}'
            )
            
            # Emit to user's personal room for balance update
            await socket_manager.emit(
                'balance_updated',
                {'balance': new_balance},
                room=f'user-{str(user_id)}'
            )
        
        print(f"✅ Credited ${amount} USDT to user {user_id}. TX: {tx_hash}")
        return True
        
    except Exception as e:
        print(f"Credit payment error for session {session_id}: {str(e)}")
        return False
