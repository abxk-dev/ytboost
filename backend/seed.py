"""
Database Seed Script
Seeds initial data for YTBoost.io
"""
from datetime import datetime, timezone
from middleware.auth import hash_password
import uuid

async def seed_database(db):
    """Seed initial data"""
    print("🌱 Starting database seed...")
    
    # Seed Admin
    admin_exists = await db.users.find_one({'email': 'admin@ytboost.io'})
    if not admin_exists:
        await db.users.insert_one({
            'name': 'Super Admin',
            'email': 'admin@ytboost.io',
            'password': hash_password('Admin@123'),
            'role': 'admin',
            'adminRole': 'superadmin',
            'twoFactorEnabled': False,
            'twoFactorSecret': None,
            'ipWhitelist': [],
            'balance': 0,
            'apiKey': str(uuid.uuid4()),
            'status': 'active',
            'createdAt': datetime.now(timezone.utc)
        })
        print("✅ Admin user created")
    
    # Seed Test User
    test_user_exists = await db.users.find_one({'email': 'john@test.com'})
    if not test_user_exists:
        await db.users.insert_one({
            'name': 'John Doe',
            'email': 'john@test.com',
            'password': hash_password('Test@123'),
            'role': 'user',
            'balance': 10.00,
            'apiKey': str(uuid.uuid4()),
            'referralCode': uuid.uuid4().hex[:8].upper(),
            'referredBy': None,
            'referralEarnings': 0,
            'status': 'active',
            'createdAt': datetime.now(timezone.utc)
        })
        print("✅ Test user created")
    
    # Seed Categories
    categories_data = [
        {'name': 'YOUTUBE VIEWS', 'slug': 'youtube-views', 'order': 1},
        {'name': 'YOUTUBE SUBSCRIBERS', 'slug': 'youtube-subscribers', 'order': 2},
        {'name': 'YOUTUBE LIKES', 'slug': 'youtube-likes', 'order': 3},
        {'name': 'YOUTUBE WATCH HOURS', 'slug': 'youtube-watch-hours', 'order': 4},
        {'name': 'YOUTUBE COMMENTS', 'slug': 'youtube-comments', 'order': 5},
        {'name': 'YOUTUBE SHARES', 'slug': 'youtube-shares', 'order': 6}
    ]
    
    category_ids = {}
    for cat_data in categories_data:
        existing = await db.categories.find_one({'slug': cat_data['slug']})
        if not existing:
            result = await db.categories.insert_one({
                **cat_data,
                'status': True,
                'createdAt': datetime.now(timezone.utc)
            })
            category_ids[cat_data['slug']] = result.inserted_id
        else:
            if existing.get('order') is None:
                await db.categories.update_one({'_id': existing['_id']}, {'$set': {'order': cat_data['order']}})
            category_ids[cat_data['slug']] = existing['_id']
    
    print("✅ Categories seeded")
    
    # Seed Services
    services_data = [
        # YOUTUBE VIEWS
        {'name': 'YT Views — Social Network | NON DROP | 30d Guarantee', 'category': 'youtube-views', 'rate': 0.70, 'minQty': 1000, 'maxQty': 10000000, 'type': 'Default', 'description': 'Start 10min, Real audience, 2-4min duration, 1k-50k/day'},
        {'name': 'YT Views — HQ Instant | Real Watch Time', 'category': 'youtube-views', 'rate': 0.50, 'minQty': 500, 'maxQty': 5000000, 'type': 'Default', 'description': 'High quality views with real watch time'},
        {'name': 'YT Views — Monetization Safe | Adwords', 'category': 'youtube-views', 'rate': 1.20, 'minQty': 1000, 'maxQty': 1000000, 'type': 'Refill 30d', 'description': 'Safe for monetization, Adwords compatible'},
        {'name': 'YT Views — Budget | Fast', 'category': 'youtube-views', 'rate': 0.25, 'minQty': 1000, 'maxQty': 50000000, 'type': 'Default', 'description': 'Budget friendly fast views'},
        {'name': 'YT Views — USA Targeted', 'category': 'youtube-views', 'rate': 2.50, 'minQty': 500, 'maxQty': 500000, 'type': 'Default', 'description': 'USA geo-targeted views'},
        {'name': 'YT Views — Drip Feed Slow Steady', 'category': 'youtube-views', 'rate': 0.90, 'minQty': 1000, 'maxQty': 10000000, 'type': 'Drip Feed', 'description': 'Slow and steady drip feed views'},
        
        # YOUTUBE SUBSCRIBERS
        {'name': 'YT Subscribers — Real Mix | Non Drop', 'category': 'youtube-subscribers', 'rate': 8.50, 'minQty': 100, 'maxQty': 50000, 'type': 'Refill 60d', 'description': 'Real mix subscribers with 60 day refill'},
        {'name': 'YT Subscribers — HQ Active', 'category': 'youtube-subscribers', 'rate': 12.00, 'minQty': 50, 'maxQty': 10000, 'type': 'Refill 90d', 'description': 'High quality active subscribers'},
        {'name': 'YT Subscribers — Instant Budget', 'category': 'youtube-subscribers', 'rate': 4.00, 'minQty': 100, 'maxQty': 100000, 'type': 'Default', 'description': 'Budget instant subscribers'},
        {'name': 'YT Subscribers — Stable Drip', 'category': 'youtube-subscribers', 'rate': 6.00, 'minQty': 100, 'maxQty': 20000, 'type': 'Drip Feed', 'description': 'Stable drip feed subscribers'},
        
        # YOUTUBE LIKES
        {'name': 'YT Likes — Real Non Drop | 30d Refill', 'category': 'youtube-likes', 'rate': 0.90, 'minQty': 50, 'maxQty': 100000, 'type': 'Refill 30d', 'description': 'Real likes with 30 day refill guarantee'},
        {'name': 'YT Likes — HQ Fast', 'category': 'youtube-likes', 'rate': 0.60, 'minQty': 50, 'maxQty': 500000, 'type': 'Default', 'description': 'High quality fast likes'},
        {'name': 'YT Likes — Budget', 'category': 'youtube-likes', 'rate': 0.30, 'minQty': 100, 'maxQty': 1000000, 'type': 'Default', 'description': 'Budget friendly likes'},
        
        # YOUTUBE WATCH HOURS
        {'name': 'YT Watch Hours — 4000h Monetization Package', 'category': 'youtube-watch-hours', 'rate': 15.00, 'minQty': 1, 'maxQty': 100, 'type': 'Default', 'description': 'Helps reach YouTube monetization threshold of 4000 watch hours'},
        {'name': 'YT Watch Hours — 1000h', 'category': 'youtube-watch-hours', 'rate': 4.00, 'minQty': 1, 'maxQty': 500, 'type': 'Default', 'description': '1000 watch hours package'},
        {'name': 'YT Watch Hours — Real Retention HQ', 'category': 'youtube-watch-hours', 'rate': 20.00, 'minQty': 1, 'maxQty': 50, 'type': 'Default', 'description': 'High quality real retention watch hours'},
        
        # YOUTUBE COMMENTS
        {'name': 'YT Comments — Custom Text', 'category': 'youtube-comments', 'rate': 4.00, 'minQty': 10, 'maxQty': 5000, 'type': 'Custom', 'description': 'Custom text comments - provide your comments'},
        {'name': 'YT Comments — Random Positive', 'category': 'youtube-comments', 'rate': 2.50, 'minQty': 10, 'maxQty': 10000, 'type': 'Default', 'description': 'Random positive comments'},
        
        # YOUTUBE SHARES
        {'name': 'YT Shares — Real Social', 'category': 'youtube-shares', 'rate': 1.20, 'minQty': 100, 'maxQty': 100000, 'type': 'Default', 'description': 'Real social shares'},
        {'name': 'YT Shares — Mix Platform', 'category': 'youtube-shares', 'rate': 0.80, 'minQty': 100, 'maxQty': 500000, 'type': 'Default', 'description': 'Mix platform shares'}
    ]
    
    services_count = await db.services.count_documents({})
    if services_count == 0:
        for svc_data in services_data:
            cat_id = category_ids.get(svc_data['category'])
            if cat_id:
                await db.services.insert_one({
                    'name': svc_data['name'],
                    'categoryId': cat_id,
                    'description': svc_data['description'],
                    'rate': svc_data['rate'],
                    'minQty': svc_data['minQty'],
                    'maxQty': svc_data['maxQty'],
                    'type': svc_data['type'],
                    'status': True,
                    'createdAt': datetime.now(timezone.utc)
                })
        print("✅ Services seeded")
    
    # Seed Crypto Payment Method
    crypto_exists = await db.crypto_payment_methods.find_one({'network': 'BEP20', 'coinName': 'USDT'})
    if not crypto_exists:
        await db.crypto_payment_methods.insert_one({
            'coinName': 'USDT',
            'network': 'BEP20',
            'address': '0x981909a9f8a06a7886bc35b393a66da4f4d30622',
            'qrCodeUrl': None,
            'minAmount': 5,
            'instructions': 'Send only USDT on BEP20 (BSC) network. Do not send other coins.',
            'autoDetect': True,
            'confirmations': 2,
            'status': True,
            'createdAt': datetime.now(timezone.utc)
        })
        print("✅ Crypto payment method seeded")
    else:
        await db.crypto_payment_methods.update_one(
            {'_id': crypto_exists['_id']},
            {'$set': {'address': '0x981909a9f8a06a7886bc35b393a66da4f4d30622', 'confirmations': 2}}
        )
    
    # Seed Site Settings
    default_settings = {
        'site_name': 'YTBoost.io',
        'tagline': 'The #1 YouTube Growth Panel',
        'logo_url': '/uploads/logo.png',
        'favicon_url': '/uploads/favicon.png',
        'maintenance_mode': 'false',
        'allow_registration': 'true',
        'welcome_bonus': '0',
        'footer_text': '© 2026 YTBoost.io. All rights reserved.',
        'support_email': '',
        'telegram_link': '',
        'whatsapp_link': '',
        'whatsapp_enabled': 'false',
        'whatsapp_number': '',
        'announcement_enabled': 'false',
        'announcement_message': '',
        'announcement_type': 'info',
        'seo_meta_title': 'YTBoost.io',
        'seo_meta_description': '',
        'seo_meta_keywords': '',
        'google_analytics_id': '',
        'facebook_pixel_id': '',
        'ip_whitelist_enabled': 'false',
        'ip_whitelist_ips': '',
        'auto_complete_enabled': 'false',
        'auto_complete_hours': '72',
        'referral_enabled': 'false',
        'referral_commission_pct': '5',
        'referral_min_deposit': '0',
        'public_fake_stats_enabled': 'false',
        'public_fake_orders_base': '0',
        'public_fake_users_base': '0',
        'public_fake_orders_inc_per_hour': '0',
        'public_fake_users_inc_per_hour': '0',
        'public_fake_stats_start': '',
        'public_starting_price': '0.002'
    }
    
    for key, value in default_settings.items():
        existing = await db.site_settings.find_one({'key': key})
        if not existing:
            await db.site_settings.insert_one({
                'key': key,
                'value': value,
                'updatedAt': datetime.now(timezone.utc)
            })
    
    print("✅ Site settings seeded")
    
    # Create indexes
    await db.users.create_index('email', unique=True)
    await db.users.create_index('apiKey', unique=True)
    await db.users.create_index('referralCode', unique=True, sparse=True)
    await db.categories.create_index('slug', unique=True)
    await db.orders.create_index('userId')
    await db.orders.create_index('createdAt')
    await db.transactions.create_index('userId')
    await db.notifications.create_index('userId')
    await db.user_activity_logs.create_index([('userId', 1), ('createdAt', -1)])
    await db.crypto_payment_sessions.create_index('userId')
    await db.crypto_payment_sessions.create_index('status')
    await db.crypto_payment_sessions.create_index('expiresAt')
    await db.site_settings.create_index('key', unique=True)
    await db.support_tickets.create_index([('userId', 1), ('updatedAt', -1)])
    await db.support_tickets.create_index([('adminUnread', 1), ('updatedAt', -1)])
    await db.admin_activity_logs.create_index([('createdAt', -1)])
    await db.admin_activity_logs.create_index([('adminId', 1), ('createdAt', -1)])
    await db.email_blasts.create_index([('createdAt', -1)])
    await db.api_call_logs.create_index([('userId', 1), ('createdAt', -1)])
    await db.api_call_logs.create_index([('createdAt', -1)])
    
    print("✅ Database indexes created")
    print("🎉 Database seed completed!")
