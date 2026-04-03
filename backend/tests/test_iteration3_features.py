"""
Test Suite for Iteration 3 Features:
1. Public stats API endpoint (/api/stats/public)
2. Admin crypto wallet address update flow
3. Crypto methods address field in response
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPublicStatsAPI:
    """Tests for GET /api/stats/public endpoint (no auth required)"""
    
    def test_public_stats_returns_200(self):
        """Public stats endpoint should return 200 without auth"""
        response = requests.get(f"{BASE_URL}/api/stats/public")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Public stats endpoint returns 200")
    
    def test_public_stats_contains_total_orders(self):
        """Response should contain totalOrders field"""
        response = requests.get(f"{BASE_URL}/api/stats/public")
        data = response.json()
        assert 'totalOrders' in data, "Response missing 'totalOrders' field"
        assert isinstance(data['totalOrders'], int), "totalOrders should be an integer"
        print(f"✓ totalOrders field present: {data['totalOrders']}")
    
    def test_public_stats_contains_total_users(self):
        """Response should contain totalUsers field"""
        response = requests.get(f"{BASE_URL}/api/stats/public")
        data = response.json()
        assert 'totalUsers' in data, "Response missing 'totalUsers' field"
        assert isinstance(data['totalUsers'], int), "totalUsers should be an integer"
        print(f"✓ totalUsers field present: {data['totalUsers']}")


class TestCryptoMethodsPublicAPI:
    """Tests for GET /api/crypto/methods endpoint"""
    
    def test_crypto_methods_returns_200(self):
        """Crypto methods endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/crypto/methods")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Crypto methods endpoint returns 200")
    
    def test_crypto_methods_contains_address_field(self):
        """Each method should contain 'address' field"""
        response = requests.get(f"{BASE_URL}/api/crypto/methods")
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        for method in data:
            assert 'address' in method, f"Method {method.get('coinName', 'unknown')} missing 'address' field"
            print(f"✓ Method {method['coinName']} has address: {method['address']}")
    
    def test_crypto_methods_structure(self):
        """Verify crypto method response structure"""
        response = requests.get(f"{BASE_URL}/api/crypto/methods")
        data = response.json()
        
        required_fields = ['id', 'coinName', 'network', 'address', 'minAmount', 'instructions']
        
        for method in data:
            for field in required_fields:
                assert field in method, f"Method missing required field: {field}"
        
        print(f"✓ All {len(data)} crypto methods have correct structure")


class TestAdminCryptoWalletUpdate:
    """Tests for admin wallet address update flow"""
    
    @pytest.fixture(scope="class")
    def admin_session(self):
        """Create admin session with cookies"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/admin/auth/login",
            json={"email": "admin@ytboost.io", "password": "Admin@123"}
        )
        assert login_response.status_code == 200, f"Admin login failed: {login_response.text}"
        print("✓ Admin logged in successfully")
        return session
    
    def test_admin_login_works(self, admin_session):
        """Admin should be able to login"""
        response = admin_session.get(f"{BASE_URL}/api/admin/auth/me")
        assert response.status_code == 200, f"Admin /me failed: {response.text}"
        data = response.json()
        assert data['role'] == 'admin'
        print(f"✓ Admin authenticated: {data['email']}")
    
    def test_admin_can_get_crypto_methods(self, admin_session):
        """Admin should be able to get crypto methods"""
        response = admin_session.get(f"{BASE_URL}/api/admin/crypto-methods")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one crypto method"
        print(f"✓ Admin can view {len(data)} crypto methods")
    
    def test_admin_can_update_wallet_address(self, admin_session):
        """Admin should be able to update wallet address"""
        # Get current methods
        methods_response = admin_session.get(f"{BASE_URL}/api/admin/crypto-methods")
        methods = methods_response.json()
        method_id = methods[0]['id']
        original_address = methods[0]['address']
        
        # Update address
        new_address = "0xTEST_UpdatedWalletAddress_12345"
        update_response = admin_session.put(
            f"{BASE_URL}/api/admin/crypto-methods/{method_id}",
            json={"address": new_address}
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        print(f"✓ Admin updated wallet address to: {new_address}")
        
        # Verify update via public endpoint
        public_response = requests.get(f"{BASE_URL}/api/crypto/methods")
        public_data = public_response.json()
        updated_method = next((m for m in public_data if m['id'] == method_id), None)
        assert updated_method is not None, "Method not found in public response"
        assert updated_method['address'] == new_address, f"Address not updated. Expected {new_address}, got {updated_method['address']}"
        print(f"✓ Public endpoint reflects updated address: {updated_method['address']}")
        
        # Revert to original address
        revert_response = admin_session.put(
            f"{BASE_URL}/api/admin/crypto-methods/{method_id}",
            json={"address": original_address}
        )
        assert revert_response.status_code == 200, f"Revert failed: {revert_response.text}"
        print(f"✓ Reverted wallet address to: {original_address}")


class TestUserAuthAndAddFunds:
    """Tests for user authentication and add funds flow"""
    
    @pytest.fixture(scope="class")
    def user_session(self):
        """Create user session with cookies"""
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "john@test.com", "password": "Test@123"}
        )
        assert login_response.status_code == 200, f"User login failed: {login_response.text}"
        print("✓ User logged in successfully")
        return session
    
    def test_user_login_works(self, user_session):
        """User should be able to login"""
        response = user_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"User /me failed: {response.text}"
        data = response.json()
        assert data['email'] == 'john@test.com'
        print(f"✓ User authenticated: {data['email']}")
    
    def test_user_can_view_crypto_methods(self, user_session):
        """User should be able to view crypto methods with addresses"""
        response = requests.get(f"{BASE_URL}/api/crypto/methods")
        assert response.status_code == 200
        data = response.json()
        
        for method in data:
            assert 'address' in method, "Method should have address field"
            print(f"✓ User can see {method['coinName']} wallet: {method['address']}")


class TestHealthAndBasicEndpoints:
    """Basic health and API tests"""
    
    def test_health_endpoint(self):
        """Health endpoint should return healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
        print("✓ Health endpoint working")
    
    def test_root_api_endpoint(self):
        """Root API endpoint should return version info"""
        response = requests.get(f"{BASE_URL}/api")
        assert response.status_code == 200
        data = response.json()
        assert 'version' in data
        print(f"✓ API version: {data['version']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
