"""
Test Iteration 5 Features:
1. Categories CRUD with slug field and auto-generation
2. API Providers CRUD with test connection and balance fetching
3. Services CRUD with fulfillmentType, providerId, providerServiceId fields
4. Delete category rejection when services exist
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCategoriesCRUD:
    """Test categories CRUD with slug field"""
    
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
    
    def test_create_category_with_slug(self):
        """POST /api/admin/categories creates category with slug field"""
        category_data = {
            "name": "TEST_Category With Slug",
            "slug": "test-category-slug",
            "status": True
        }
        
        resp = self.session.post(f"{BASE_URL}/api/admin/categories", json=category_data)
        assert resp.status_code == 200, f"Create category failed: {resp.text}"
        
        data = resp.json()
        assert 'id' in data
        assert data['name'] == "TEST_Category With Slug"
        assert data['slug'] == "test-category-slug"
        assert data['status'] == True
        print(f"✓ Created category with slug: {data['slug']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/categories/{data['id']}")
        return data['id']
    
    def test_create_category_auto_generates_slug(self):
        """POST /api/admin/categories auto-generates slug from name if not provided"""
        category_data = {
            "name": "TEST Auto Slug Category",
            "status": True
        }
        
        resp = self.session.post(f"{BASE_URL}/api/admin/categories", json=category_data)
        assert resp.status_code == 200, f"Create category failed: {resp.text}"
        
        data = resp.json()
        assert 'slug' in data
        assert data['slug'] == "test-auto-slug-category"  # Auto-generated from name
        print(f"✓ Auto-generated slug: {data['slug']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/categories/{data['id']}")
    
    def test_update_category_with_slug(self):
        """PUT /api/admin/categories/{id} updates category with slug"""
        # Create first
        create_resp = self.session.post(f"{BASE_URL}/api/admin/categories", json={
            "name": "TEST_Update Category",
            "slug": "test-update-category",
            "status": True
        })
        category_id = create_resp.json()['id']
        
        # Update
        update_data = {
            "name": "TEST_Updated Category Name",
            "slug": "test-updated-slug",
            "status": False
        }
        
        update_resp = self.session.put(f"{BASE_URL}/api/admin/categories/{category_id}", json=update_data)
        assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
        
        data = update_resp.json()
        assert data['name'] == "TEST_Updated Category Name"
        assert data['slug'] == "test-updated-slug"
        assert data['status'] == False
        print(f"✓ Updated category with new slug: {data['slug']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/categories/{category_id}")
    
    def test_get_categories_returns_slug(self):
        """GET /api/admin/categories returns slug field"""
        resp = self.session.get(f"{BASE_URL}/api/admin/categories")
        assert resp.status_code == 200
        
        categories = resp.json()
        assert len(categories) > 0, "No categories found"
        
        for cat in categories:
            assert 'slug' in cat, f"Missing slug field in category {cat.get('name')}"
            assert 'servicesCount' in cat, f"Missing servicesCount field"
        
        print(f"✓ GET /api/admin/categories returns {len(categories)} categories with slug field")
    
    def test_delete_category_rejects_if_services_exist(self):
        """DELETE /api/admin/categories/{id} rejects deletion if services exist"""
        # Get categories with services
        resp = self.session.get(f"{BASE_URL}/api/admin/categories")
        categories = resp.json()
        
        # Find a category with services
        cat_with_services = next((c for c in categories if c.get('servicesCount', 0) > 0), None)
        
        if cat_with_services:
            delete_resp = self.session.delete(f"{BASE_URL}/api/admin/categories/{cat_with_services['id']}")
            assert delete_resp.status_code == 400, f"Expected 400, got {delete_resp.status_code}"
            assert "services" in delete_resp.text.lower()
            print(f"✓ Delete correctly rejected for category with {cat_with_services['servicesCount']} services")
        else:
            print(f"⚠ No category with services found to test delete rejection")
    
    def test_delete_category_succeeds_if_no_services(self):
        """DELETE /api/admin/categories/{id} succeeds if no services linked"""
        # Create a new category (no services)
        create_resp = self.session.post(f"{BASE_URL}/api/admin/categories", json={
            "name": "TEST_Delete Category",
            "slug": "test-delete-category",
            "status": True
        })
        category_id = create_resp.json()['id']
        
        # Delete it
        delete_resp = self.session.delete(f"{BASE_URL}/api/admin/categories/{category_id}")
        assert delete_resp.status_code == 200, f"Delete failed: {delete_resp.text}"
        
        data = delete_resp.json()
        assert 'message' in data
        print(f"✓ Successfully deleted category with no services")


class TestApiProvidersCRUD:
    """Test API Providers CRUD with test connection and balance fetching"""
    
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
        print(f"✓ Admin login successful")
        
        yield
        
        self.session.post(f"{BASE_URL}/api/admin/auth/logout")
    
    def test_get_api_providers(self):
        """GET /api/admin/api-providers returns list of providers"""
        resp = self.session.get(f"{BASE_URL}/api/admin/api-providers")
        assert resp.status_code == 200
        
        providers = resp.json()
        assert isinstance(providers, list)
        print(f"✓ GET /api/admin/api-providers returns {len(providers)} providers")
    
    def test_create_api_provider(self):
        """POST /api/admin/api-providers creates a provider"""
        provider_data = {
            "name": "TEST_Provider",
            "apiUrl": "https://test-smm-provider.com/api/v2",
            "apiKey": "test_api_key_12345",
            "markup": 20.0,
            "status": True
        }
        
        resp = self.session.post(f"{BASE_URL}/api/admin/api-providers", json=provider_data)
        assert resp.status_code == 200, f"Create provider failed: {resp.text}"
        
        data = resp.json()
        assert 'id' in data
        assert data['name'] == "TEST_Provider"
        assert data['apiUrl'] == "https://test-smm-provider.com/api/v2"
        assert data['markup'] == 20.0
        assert data['status'] == True
        print(f"✓ Created API provider: {data['id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/api-providers/{data['id']}")
        return data['id']
    
    def test_update_api_provider(self):
        """PUT /api/admin/api-providers/{id} updates provider"""
        # Create first
        create_resp = self.session.post(f"{BASE_URL}/api/admin/api-providers", json={
            "name": "TEST_Update Provider",
            "apiUrl": "https://old-provider.com/api",
            "apiKey": "old_key",
            "markup": 10.0,
            "status": True
        })
        provider_id = create_resp.json()['id']
        
        # Update
        update_data = {
            "name": "TEST_Updated Provider",
            "apiUrl": "https://new-provider.com/api/v3",
            "markup": 25.0,
            "status": False
        }
        
        update_resp = self.session.put(f"{BASE_URL}/api/admin/api-providers/{provider_id}", json=update_data)
        assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
        
        data = update_resp.json()
        assert data['name'] == "TEST_Updated Provider"
        assert data['apiUrl'] == "https://new-provider.com/api/v3"
        assert data['markup'] == 25.0
        assert data['status'] == False
        print(f"✓ Updated API provider: {provider_id}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/api-providers/{provider_id}")
    
    def test_delete_api_provider(self):
        """DELETE /api/admin/api-providers/{id} deletes provider"""
        # Create first
        create_resp = self.session.post(f"{BASE_URL}/api/admin/api-providers", json={
            "name": "TEST_Delete Provider",
            "apiUrl": "https://delete-provider.com/api",
            "apiKey": "delete_key",
            "markup": 15.0,
            "status": True
        })
        provider_id = create_resp.json()['id']
        
        # Delete
        delete_resp = self.session.delete(f"{BASE_URL}/api/admin/api-providers/{provider_id}")
        assert delete_resp.status_code == 200, f"Delete failed: {delete_resp.text}"
        
        data = delete_resp.json()
        assert 'message' in data
        print(f"✓ Deleted API provider: {provider_id}")
        
        # Verify deletion
        get_resp = self.session.get(f"{BASE_URL}/api/admin/api-providers")
        providers = get_resp.json()
        assert not any(p['id'] == provider_id for p in providers)
        print(f"✓ Verified provider no longer exists")
    
    def test_test_connection(self):
        """POST /api/admin/api-providers/test tests connection (returns success or error)"""
        # Test with a fake URL - should return success:false
        test_data = {
            "apiUrl": "https://fake-smm-provider.com/api",
            "apiKey": "fake_key"
        }
        
        resp = self.session.post(f"{BASE_URL}/api/admin/api-providers/test", json=test_data)
        assert resp.status_code == 200, f"Test connection failed: {resp.text}"
        
        data = resp.json()
        assert 'success' in data
        # With fake URL, success should be false
        assert data['success'] == False
        assert 'error' in data
        print(f"✓ Test connection returns success:false for fake URL (expected behavior)")


class TestServicesWithFulfillment:
    """Test services CRUD with fulfillmentType, providerId, providerServiceId"""
    
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
        print(f"✓ Admin login successful")
        
        yield
        
        self.session.post(f"{BASE_URL}/api/admin/auth/logout")
    
    def test_create_service_with_auto_fulfillment(self):
        """POST /api/admin/services with fulfillmentType=auto, providerId, providerServiceId"""
        # First create a provider
        provider_resp = self.session.post(f"{BASE_URL}/api/admin/api-providers", json={
            "name": "TEST_Fulfillment Provider",
            "apiUrl": "https://fulfillment-provider.com/api",
            "apiKey": "fulfillment_key",
            "markup": 20.0,
            "status": True
        })
        provider_id = provider_resp.json()['id']
        
        # Get category
        cat_resp = self.session.get(f"{BASE_URL}/api/admin/categories")
        category_id = cat_resp.json()[0]['id']
        
        # Create service with auto fulfillment
        service_data = {
            "name": "TEST_Auto Fulfillment Service",
            "categoryId": category_id,
            "description": "Service with auto fulfillment",
            "rate": 1.50,
            "minQty": 100,
            "maxQty": 10000,
            "type": "Default",
            "status": True,
            "fulfillmentType": "auto",
            "providerId": provider_id,
            "providerServiceId": "12345"
        }
        
        resp = self.session.post(f"{BASE_URL}/api/admin/services", json=service_data)
        assert resp.status_code == 200, f"Create service failed: {resp.text}"
        
        data = resp.json()
        assert 'id' in data
        print(f"✓ Created service with auto fulfillment: {data['id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/admin/services/{data['id']}")
        self.session.delete(f"{BASE_URL}/api/admin/api-providers/{provider_id}")
        return data['id']
    
    def test_get_services_returns_fulfillment_fields(self):
        """GET /api/admin/services returns fulfillmentType, providerId, providerServiceId fields"""
        resp = self.session.get(f"{BASE_URL}/api/admin/services")
        assert resp.status_code == 200
        
        services = resp.json()
        assert len(services) > 0, "No services found"
        
        for svc in services:
            assert 'fulfillmentType' in svc, f"Missing fulfillmentType in service {svc.get('name')}"
            assert 'providerId' in svc, f"Missing providerId in service {svc.get('name')}"
            assert 'providerServiceId' in svc, f"Missing providerServiceId in service {svc.get('name')}"
        
        print(f"✓ GET /api/admin/services returns {len(services)} services with fulfillment fields")
    
    def test_create_service_with_new_types(self):
        """Test creating services with new types: Refill 30d, Refill 60d, Refill 90d, Drip Feed, Custom"""
        cat_resp = self.session.get(f"{BASE_URL}/api/admin/categories")
        category_id = cat_resp.json()[0]['id']
        
        new_types = ["Refill 30d", "Refill 60d", "Refill 90d", "Drip Feed", "Custom"]
        created_ids = []
        
        for svc_type in new_types:
            service_data = {
                "name": f"TEST_{svc_type.replace(' ', '_')}_Service",
                "categoryId": category_id,
                "description": f"Test {svc_type} service",
                "rate": 2.00,
                "minQty": 50,
                "maxQty": 5000,
                "type": svc_type,
                "status": True,
                "fulfillmentType": "manual"
            }
            
            resp = self.session.post(f"{BASE_URL}/api/admin/services", json=service_data)
            assert resp.status_code == 200, f"Create {svc_type} service failed: {resp.text}"
            
            data = resp.json()
            assert data['type'] == svc_type
            created_ids.append(data['id'])
            print(f"✓ Created {svc_type} service: {data['id']}")
        
        # Cleanup
        for svc_id in created_ids:
            self.session.delete(f"{BASE_URL}/api/admin/services/{svc_id}")
        
        print(f"✓ All new service types created successfully")


class TestPublicCategoriesAPI:
    """Test public categories API returns slug"""
    
    def test_public_categories_returns_slug(self):
        """GET /api/categories returns slug field"""
        resp = requests.get(f"{BASE_URL}/api/categories")
        assert resp.status_code == 200
        
        categories = resp.json()
        assert len(categories) > 0, "No categories found"
        
        for cat in categories:
            assert 'slug' in cat, f"Missing slug field in category {cat.get('name')}"
            assert 'id' in cat
            assert 'name' in cat
        
        print(f"✓ GET /api/categories returns {len(categories)} categories with slug field")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_data(self):
        """Delete all TEST_ prefixed data"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_resp = session.post(f"{BASE_URL}/api/admin/auth/login", json={
            "email": "admin@ytboost.io",
            "password": "Admin@123"
        })
        assert login_resp.status_code == 200
        
        # Cleanup services
        svc_resp = session.get(f"{BASE_URL}/api/admin/services")
        services = svc_resp.json()
        deleted_services = 0
        for svc in services:
            if svc['name'].startswith('TEST_'):
                session.delete(f"{BASE_URL}/api/admin/services/{svc['id']}")
                deleted_services += 1
        
        # Cleanup providers
        prov_resp = session.get(f"{BASE_URL}/api/admin/api-providers")
        providers = prov_resp.json()
        deleted_providers = 0
        for prov in providers:
            if prov['name'].startswith('TEST_'):
                session.delete(f"{BASE_URL}/api/admin/api-providers/{prov['id']}")
                deleted_providers += 1
        
        # Cleanup categories
        cat_resp = session.get(f"{BASE_URL}/api/admin/categories")
        categories = cat_resp.json()
        deleted_categories = 0
        for cat in categories:
            if cat['name'].startswith('TEST_'):
                session.delete(f"{BASE_URL}/api/admin/categories/{cat['id']}")
                deleted_categories += 1
        
        print(f"✓ Cleaned up {deleted_services} services, {deleted_providers} providers, {deleted_categories} categories")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
