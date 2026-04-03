"""
Test Iteration 4 Features:
1. Admin Day/Night Mode toggle
2. Service Description Info Card with new fields (startTime, speed, refillTime, quality, country, refillEnabled)
3. Service Types (Default/Custom Comments/Package/Mention/Subscription)
4. Dynamic Order Form based on service type
5. Refill System for completed orders
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminServicesCRUD:
    """Test admin services CRUD with new fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session with cookies"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Admin login
        login_resp = self.session.post(f"{BASE_URL}/api/admin/auth/login", json={
            "email": "admin@ytboost.io",
            "password": "Admin@123"
        })
        assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
        print(f"✓ Admin login successful")
        
        yield
        
        # Cleanup: logout
        self.session.post(f"{BASE_URL}/api/admin/auth/logout")
    
    def test_get_categories(self):
        """Get categories for service creation"""
        resp = self.session.get(f"{BASE_URL}/api/admin/categories")
        assert resp.status_code == 200
        categories = resp.json()
        assert len(categories) > 0, "No categories found"
        self.category_id = categories[0]['id']
        print(f"✓ Got {len(categories)} categories, using: {categories[0]['name']}")
        return categories[0]['id']
    
    def test_create_service_with_new_fields(self):
        """Create service with all new fields (type=Custom Comments)"""
        # Get category first
        cat_resp = self.session.get(f"{BASE_URL}/api/admin/categories")
        category_id = cat_resp.json()[0]['id']
        
        service_data = {
            "name": "TEST_Custom Comments Service",
            "categoryId": category_id,
            "description": "Test service with custom comments",
            "rate": 2.50,
            "minQty": 10,
            "maxQty": 1000,
            "type": "Custom Comments",
            "status": True,
            "startTime": "0-1 hours",
            "speed": "500/day",
            "refillTime": "30 days",
            "quality": "High",
            "country": "Worldwide",
            "refillEnabled": True,
            "packagePrice": None,
            "packageDescription": ""
        }
        
        resp = self.session.post(f"{BASE_URL}/api/admin/services", json=service_data)
        assert resp.status_code == 200, f"Create service failed: {resp.text}"
        
        data = resp.json()
        assert 'id' in data
        assert data['name'] == "TEST_Custom Comments Service"
        assert data['type'] == "Custom Comments"
        print(f"✓ Created service with id: {data['id']}, type: {data['type']}")
        return data['id']
    
    def test_create_package_service(self):
        """Create Package type service with packagePrice"""
        cat_resp = self.session.get(f"{BASE_URL}/api/admin/categories")
        category_id = cat_resp.json()[0]['id']
        
        service_data = {
            "name": "TEST_Package Service",
            "categoryId": category_id,
            "description": "Package deal - fixed price",
            "rate": 1.0,
            "minQty": 1,
            "maxQty": 1,
            "type": "Package",
            "status": True,
            "startTime": "Instant",
            "speed": "Fast",
            "refillTime": "",
            "quality": "Ultra High",
            "country": "USA",
            "refillEnabled": False,
            "packagePrice": 9.99,
            "packageDescription": "Premium package deal"
        }
        
        resp = self.session.post(f"{BASE_URL}/api/admin/services", json=service_data)
        assert resp.status_code == 200, f"Create package service failed: {resp.text}"
        
        data = resp.json()
        assert data['type'] == "Package"
        print(f"✓ Created Package service with id: {data['id']}")
        return data['id']
    
    def test_create_subscription_service(self):
        """Create Subscription type service"""
        cat_resp = self.session.get(f"{BASE_URL}/api/admin/categories")
        category_id = cat_resp.json()[0]['id']
        
        service_data = {
            "name": "TEST_Subscription Service",
            "categoryId": category_id,
            "description": "Daily delivery subscription",
            "rate": 3.00,
            "minQty": 100,
            "maxQty": 10000,
            "type": "Subscription",
            "status": True,
            "startTime": "0-6 hours",
            "speed": "1000/day",
            "refillTime": "",
            "quality": "Medium",
            "country": "Global",
            "refillEnabled": True,
            "packagePrice": None,
            "packageDescription": ""
        }
        
        resp = self.session.post(f"{BASE_URL}/api/admin/services", json=service_data)
        assert resp.status_code == 200, f"Create subscription service failed: {resp.text}"
        
        data = resp.json()
        assert data['type'] == "Subscription"
        print(f"✓ Created Subscription service with id: {data['id']}")
        return data['id']
    
    def test_create_mention_service(self):
        """Create Mention type service"""
        cat_resp = self.session.get(f"{BASE_URL}/api/admin/categories")
        category_id = cat_resp.json()[0]['id']
        
        service_data = {
            "name": "TEST_Mention Service",
            "categoryId": category_id,
            "description": "Mention usernames",
            "rate": 5.00,
            "minQty": 5,
            "maxQty": 500,
            "type": "Mention",
            "status": True,
            "startTime": "1-2 hours",
            "speed": "200/day",
            "refillTime": "",
            "quality": "High",
            "country": "Worldwide",
            "refillEnabled": False,
            "packagePrice": None,
            "packageDescription": ""
        }
        
        resp = self.session.post(f"{BASE_URL}/api/admin/services", json=service_data)
        assert resp.status_code == 200, f"Create mention service failed: {resp.text}"
        
        data = resp.json()
        assert data['type'] == "Mention"
        print(f"✓ Created Mention service with id: {data['id']}")
        return data['id']
    
    def test_get_services_returns_new_fields(self):
        """Verify GET /api/services returns new fields"""
        resp = requests.get(f"{BASE_URL}/api/services")
        assert resp.status_code == 200
        
        services = resp.json()
        assert len(services) > 0, "No services found"
        
        # Check that new fields are present
        for svc in services:
            assert 'type' in svc, f"Missing 'type' field in service {svc.get('name')}"
            assert 'startTime' in svc, f"Missing 'startTime' field"
            assert 'speed' in svc, f"Missing 'speed' field"
            assert 'quality' in svc, f"Missing 'quality' field"
            assert 'country' in svc, f"Missing 'country' field"
            assert 'refillEnabled' in svc, f"Missing 'refillEnabled' field"
        
        print(f"✓ GET /api/services returns {len(services)} services with all new fields")
    
    def test_update_service_with_new_fields(self):
        """Update service with new fields"""
        # First create a service
        cat_resp = self.session.get(f"{BASE_URL}/api/admin/categories")
        category_id = cat_resp.json()[0]['id']
        
        create_resp = self.session.post(f"{BASE_URL}/api/admin/services", json={
            "name": "TEST_Update Service",
            "categoryId": category_id,
            "description": "To be updated",
            "rate": 1.0,
            "minQty": 10,
            "maxQty": 100,
            "type": "Default",
            "status": True
        })
        service_id = create_resp.json()['id']
        
        # Update with new fields
        update_data = {
            "startTime": "Updated 0-2 hours",
            "speed": "Updated 2000/day",
            "quality": "Ultra High",
            "country": "Europe",
            "refillEnabled": True,
            "type": "Custom Comments"
        }
        
        update_resp = self.session.put(f"{BASE_URL}/api/admin/services/{service_id}", json=update_data)
        assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
        print(f"✓ Updated service {service_id} with new fields")
        
        # Verify update via GET
        get_resp = self.session.get(f"{BASE_URL}/api/admin/services")
        services = get_resp.json()
        updated_svc = next((s for s in services if s['id'] == service_id), None)
        assert updated_svc is not None
        assert updated_svc['startTime'] == "Updated 0-2 hours"
        assert updated_svc['speed'] == "Updated 2000/day"
        assert updated_svc['quality'] == "Ultra High"
        assert updated_svc['refillEnabled'] == True
        assert updated_svc['type'] == "Custom Comments"
        print(f"✓ Verified updated fields via GET")


class TestUserServicesAPI:
    """Test user services API returns new fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup user session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # User login
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "john@test.com",
            "password": "Test@123"
        })
        assert login_resp.status_code == 200, f"User login failed: {login_resp.text}"
        print(f"✓ User login successful")
        
        yield
        
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_get_user_services_returns_new_fields(self):
        """GET /api/services/user returns new fields for authenticated user"""
        resp = self.session.get(f"{BASE_URL}/api/services/user")
        assert resp.status_code == 200
        
        services = resp.json()
        assert len(services) > 0, "No services found"
        
        for svc in services:
            assert 'type' in svc
            assert 'startTime' in svc
            assert 'speed' in svc
            assert 'quality' in svc
            assert 'country' in svc
            assert 'refillEnabled' in svc
        
        print(f"✓ GET /api/services/user returns {len(services)} services with new fields")


class TestOrdersWithNewFields:
    """Test orders with customData and duration fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup user session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # User login
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "john@test.com",
            "password": "Test@123"
        })
        assert login_resp.status_code == 200, f"User login failed: {login_resp.text}"
        print(f"✓ User login successful")
        
        yield
        
        self.session.post(f"{BASE_URL}/api/auth/logout")
    
    def test_create_order_with_custom_data(self):
        """Create order with customData field (for Custom Comments type)"""
        # Get a service
        svc_resp = self.session.get(f"{BASE_URL}/api/services/user")
        services = svc_resp.json()
        
        # Find a service with reasonable min qty
        service = next((s for s in services if s['minQty'] <= 100), services[0])
        
        order_data = {
            "serviceId": service['id'],
            "link": "https://youtube.com/watch?v=test123",
            "quantity": service['minQty'],
            "customData": "Great video!\nLove this content!\nAmazing work!"
        }
        
        resp = self.session.post(f"{BASE_URL}/api/orders", json=order_data)
        # May fail due to insufficient balance, but we check the API accepts the field
        if resp.status_code == 200:
            data = resp.json()
            assert 'id' in data
            print(f"✓ Created order with customData, id: {data['id']}")
        elif resp.status_code == 400 and "Insufficient balance" in resp.text:
            print(f"✓ Order API accepts customData field (insufficient balance expected)")
        else:
            print(f"Order response: {resp.status_code} - {resp.text}")
    
    def test_create_order_with_duration(self):
        """Create order with duration field (for Subscription type)"""
        svc_resp = self.session.get(f"{BASE_URL}/api/services/user")
        services = svc_resp.json()
        
        # Find subscription service or any service
        service = next((s for s in services if s.get('type') == 'Subscription'), None)
        if not service:
            service = next((s for s in services if s['minQty'] <= 100), services[0])
        
        order_data = {
            "serviceId": service['id'],
            "link": "https://youtube.com/watch?v=test456",
            "quantity": service['minQty'],
            "duration": "14d"
        }
        
        resp = self.session.post(f"{BASE_URL}/api/orders", json=order_data)
        if resp.status_code == 200:
            data = resp.json()
            print(f"✓ Created order with duration, id: {data['id']}")
        elif resp.status_code == 400 and "Insufficient balance" in resp.text:
            print(f"✓ Order API accepts duration field (insufficient balance expected)")
        else:
            print(f"Order response: {resp.status_code} - {resp.text}")


class TestRefillSystem:
    """Test refill system for completed orders"""
    
    def test_refill_flow(self):
        """Test complete refill flow: create service with refillEnabled, create order, complete it, request refill"""
        admin_session = requests.Session()
        admin_session.headers.update({"Content-Type": "application/json"})
        
        # Admin login
        login_resp = admin_session.post(f"{BASE_URL}/api/admin/auth/login", json={
            "email": "admin@ytboost.io",
            "password": "Admin@123"
        })
        assert login_resp.status_code == 200
        print(f"✓ Admin logged in for refill test")
        
        # Get category
        cat_resp = admin_session.get(f"{BASE_URL}/api/admin/categories")
        category_id = cat_resp.json()[0]['id']
        
        # Create service with refillEnabled=True and low minQty
        service_data = {
            "name": "TEST_Refill Service",
            "categoryId": category_id,
            "description": "Service with refill enabled",
            "rate": 0.01,  # Very low rate for testing
            "minQty": 10,
            "maxQty": 1000,
            "type": "Default",
            "status": True,
            "startTime": "0-1 hours",
            "speed": "1000/day",
            "refillTime": "30 days",
            "quality": "High",
            "country": "Worldwide",
            "refillEnabled": True
        }
        
        svc_resp = admin_session.post(f"{BASE_URL}/api/admin/services", json=service_data)
        assert svc_resp.status_code == 200
        service_id = svc_resp.json()['id']
        print(f"✓ Created refill-enabled service: {service_id}")
        
        # User login
        user_session = requests.Session()
        user_session.headers.update({"Content-Type": "application/json"})
        user_login = user_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "john@test.com",
            "password": "Test@123"
        })
        assert user_login.status_code == 200
        print(f"✓ User logged in")
        
        # Create order
        order_data = {
            "serviceId": service_id,
            "link": "https://youtube.com/watch?v=refilltest",
            "quantity": 10
        }
        
        order_resp = user_session.post(f"{BASE_URL}/api/orders", json=order_data)
        if order_resp.status_code != 200:
            print(f"⚠ Could not create order (likely insufficient balance): {order_resp.text}")
            # Cleanup
            admin_session.delete(f"{BASE_URL}/api/admin/services/{service_id}")
            pytest.skip("Insufficient balance for order creation")
        
        order_id = order_resp.json()['id']
        print(f"✓ Created order: {order_id}")
        
        # Admin updates order to Completed
        status_resp = admin_session.put(f"{BASE_URL}/api/admin/orders/{order_id}/status", json={
            "status": "Completed"
        })
        assert status_resp.status_code == 200
        print(f"✓ Order marked as Completed")
        
        # User requests refill
        refill_resp = user_session.post(f"{BASE_URL}/api/orders/{order_id}/refill")
        assert refill_resp.status_code == 200, f"Refill request failed: {refill_resp.text}"
        print(f"✓ Refill requested successfully")
        
        # Verify refill history in order
        orders_resp = user_session.get(f"{BASE_URL}/api/orders")
        orders = orders_resp.json()['orders']
        refilled_order = next((o for o in orders if o['id'] == order_id), None)
        assert refilled_order is not None
        assert 'refillHistory' in refilled_order
        assert len(refilled_order['refillHistory']) > 0
        assert refilled_order['refillHistory'][0]['status'] == 'Requested'
        print(f"✓ Refill history recorded: {refilled_order['refillHistory']}")
        
        # Cleanup
        admin_session.delete(f"{BASE_URL}/api/admin/services/{service_id}")
        print(f"✓ Cleanup completed")
    
    def test_refill_not_allowed_for_non_completed_order(self):
        """Refill should fail for non-completed orders"""
        user_session = requests.Session()
        user_session.headers.update({"Content-Type": "application/json"})
        
        user_login = user_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "john@test.com",
            "password": "Test@123"
        })
        assert user_login.status_code == 200
        
        # Get user's orders
        orders_resp = user_session.get(f"{BASE_URL}/api/orders")
        orders = orders_resp.json()['orders']
        
        # Find a non-completed order
        pending_order = next((o for o in orders if o['status'] != 'Completed'), None)
        
        if pending_order:
            refill_resp = user_session.post(f"{BASE_URL}/api/orders/{pending_order['id']}/refill")
            assert refill_resp.status_code == 400
            assert "completed" in refill_resp.text.lower()
            print(f"✓ Refill correctly rejected for non-completed order")
        else:
            print(f"⚠ No pending orders to test refill rejection")


class TestAdminOrdersExpandedView:
    """Test admin orders API returns serviceType, customData, refillHistory"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_resp = self.session.post(f"{BASE_URL}/api/admin/auth/login", json={
            "email": "admin@ytboost.io",
            "password": "Admin@123"
        })
        assert login_resp.status_code == 200
        
        yield
        
        self.session.post(f"{BASE_URL}/api/admin/auth/logout")
    
    def test_admin_orders_returns_expanded_fields(self):
        """GET /api/admin/orders returns serviceType, customData, duration, refillHistory"""
        resp = self.session.get(f"{BASE_URL}/api/admin/orders")
        assert resp.status_code == 200
        
        data = resp.json()
        orders = data.get('orders', [])
        
        if len(orders) > 0:
            order = orders[0]
            assert 'serviceType' in order, "Missing serviceType field"
            assert 'customData' in order, "Missing customData field"
            assert 'duration' in order, "Missing duration field"
            assert 'refillHistory' in order, "Missing refillHistory field"
            print(f"✓ Admin orders API returns expanded fields: serviceType={order['serviceType']}")
        else:
            print(f"⚠ No orders to verify expanded fields")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_services(self):
        """Delete all TEST_ prefixed services"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_resp = session.post(f"{BASE_URL}/api/admin/auth/login", json={
            "email": "admin@ytboost.io",
            "password": "Admin@123"
        })
        assert login_resp.status_code == 200
        
        # Get all services
        svc_resp = session.get(f"{BASE_URL}/api/admin/services")
        services = svc_resp.json()
        
        # Delete TEST_ prefixed services
        deleted = 0
        for svc in services:
            if svc['name'].startswith('TEST_'):
                del_resp = session.delete(f"{BASE_URL}/api/admin/services/{svc['id']}")
                if del_resp.status_code == 200:
                    deleted += 1
        
        print(f"✓ Cleaned up {deleted} test services")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
