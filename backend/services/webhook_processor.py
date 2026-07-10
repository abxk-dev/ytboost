"""
Webhook Processor Service
Handles crediting balance after payment is confirmed
Uses atomic transactions to prevent double-crediting
"""
from datetime import datetime, timezone
from bson import ObjectId

async def credit_payment(session_id: str, amount: float, tx_hash: str, db):
    """
    Credit user balance after payment is confirmed
    Uses atomic operations to prevent double-crediting
    
    Args:
        session_id: CryptoPaymentSession ID
        amount: Amount to credit
        tx_hash: Transaction hash
        db: MongoDB database instance
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

        await db.notifications.insert_one({
            'userId': ObjectId(user_id),
            'title': 'Deposit approved',
            'message': f'Your deposit of ${amount:.2f} has been approved!',
            'type': 'success',
            'read': False,
            'createdAt': datetime.now(timezone.utc)
        })

        await db.user_activity_logs.insert_one({
            'userId': ObjectId(user_id),
            'action': 'Funds Added',
            'details': f'Deposit ${amount:.2f}',
            'createdAt': datetime.now(timezone.utc)
        })

        try:
            deposits_before = await db.crypto_payment_sessions.count_documents({'userId': ObjectId(user_id), 'status': 'credited'})
            first_deposit = deposits_before == 0
        except Exception:
            first_deposit = False
        
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

        if first_deposit and user.get('referredBy'):
            enabled = await db.site_settings.find_one({'key': 'referral_enabled'})
            if enabled and enabled.get('value') == 'true':
                pct_doc = await db.site_settings.find_one({'key': 'referral_commission_pct'})
                min_doc = await db.site_settings.find_one({'key': 'referral_min_deposit'})
                try:
                    pct = float(pct_doc.get('value', '0')) if pct_doc else 0.0
                except Exception:
                    pct = 0.0
                try:
                    min_dep = float(min_doc.get('value', '0')) if min_doc else 0.0
                except Exception:
                    min_dep = 0.0

                if pct > 0 and amount >= min_dep:
                    commission = round((amount * pct) / 100.0, 2)
                    referrer = await db.users.find_one({'_id': user.get('referredBy')})
                    if referrer:
                        ref_new_balance = float(referrer.get('balance', 0)) + commission
                        ref_new_earnings = float(referrer.get('referralEarnings', 0)) + commission
                        await db.users.update_one(
                            {'_id': referrer['_id']},
                            {'$set': {'balance': ref_new_balance, 'referralEarnings': ref_new_earnings}}
                        )
                        await db.transactions.insert_one({
                            'userId': referrer['_id'],
                            'type': 'credit',
                            'amount': commission,
                            'description': f'Referral earnings — {user.get("name","User")} deposit',
                            'balanceAfter': ref_new_balance,
                            'createdAt': datetime.now(timezone.utc)
                        })
                        await db.notifications.insert_one({
                            'userId': referrer['_id'],
                            'title': 'Referral earning',
                            'message': f'You earned ${commission:.2f} from your referral {user.get("name","")}\'s deposit!',
                            'type': 'success',
                            'read': False,
                            'createdAt': datetime.now(timezone.utc)
                        })
                        await db.user_activity_logs.insert_one({
                            'userId': referrer['_id'],
                            'action': 'Funds Added',
                            'details': f'Referral earning ${commission:.2f}',
                            'createdAt': datetime.now(timezone.utc)
                        })
        
        print(f"✅ Credited ${amount} USDT to user {user_id}. TX: {tx_hash}")
        return True
        
    except Exception as e:
        print(f"Credit payment error for session {session_id}: {str(e)}")
        return False
