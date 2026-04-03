#!/usr/bin/env python3
"""
YTBoost.io Backend API Testing
Tests all backend endpoints for functionality
"""
import requests
import sys
import json
from datetime import datetime

class YTBoostAPITester:
    def __init__(self, base_url="https://boost-wallet-pay.preview.emergentagent.com"):
        self.base_url = base_url
        self.user_token = None
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.session = requests.Session()

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, cookies=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=test_headers, cookies=cookies)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers, cookies=cookies)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=test_headers, cookies=cookies)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers, cookies=cookies)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, list):
                        print(f"   Response: List with {len(response_data)} items")
                    else:
                        print(f"   Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'Not a dict'}")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")

            return success, response.json() if response.text and response.status_code < 500 else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test basic health endpoint"""
        return self.run_test("Health Check", "GET", "api/health", 200)

    def test_user_login(self, email, password):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "api/auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success:
            # Extract cookies from session
            self.user_cookies = self.session.cookies
            print(f"   User logged in: {response.get('name', 'Unknown')}")
            return True
        return False

    def test_admin_login(self, email, password):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "api/admin/auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success:
            # Extract admin cookies from session
            self.admin_cookies = self.session.cookies
            print(f"   Admin logged in: {response.get('name', 'Unknown')}")
            return True
        return False

    def test_get_categories(self):
        """Test getting categories (public)"""
        success, response = self.run_test(
            "Get Categories",
            "GET",
            "api/categories",
            200
        )
        if success:
            print(f"   Found {len(response)} categories")
        return success

    def test_get_services(self):
        """Test getting services (public)"""
        success, response = self.run_test(
            "Get Services",
            "GET",
            "api/services",
            200
        )
        if success:
            print(f"   Found {len(response)} services")
        return success

    def test_user_me(self):
        """Test user profile endpoint"""
        return self.run_test(
            "User Profile (/me)",
            "GET",
            "api/auth/me",
            200,
            cookies=self.user_cookies
        )

    def test_admin_me(self):
        """Test admin profile endpoint"""
        return self.run_test(
            "Admin Profile (/me)",
            "GET",
            "api/admin/auth/me",
            200,
            cookies=self.admin_cookies
        )

    def test_user_services(self):
        """Test user-specific services endpoint"""
        return self.run_test(
            "User Services",
            "GET",
            "api/services/user",
            200,
            cookies=self.user_cookies
        )

    def test_admin_categories(self):
        """Test admin categories endpoint"""
        return self.run_test(
            "Admin Categories",
            "GET",
            "api/admin/categories",
            200,
            cookies=self.admin_cookies
        )

    def test_admin_services(self):
        """Test admin services endpoint"""
        return self.run_test(
            "Admin Services",
            "GET",
            "api/admin/services",
            200,
            cookies=self.admin_cookies
        )

    def test_site_settings(self):
        """Test site settings endpoint"""
        return self.run_test(
            "Site Settings",
            "GET",
            "api/settings",
            200
        )

def main():
    print("🚀 Starting YTBoost.io Backend API Tests")
    print("=" * 50)
    
    tester = YTBoostAPITester()
    
    # Test credentials from test_credentials.md
    user_email = "john@test.com"
    user_password = "Test@123"
    admin_email = "admin@ytboost.io"
    admin_password = "Admin@123"
    
    # Basic health check
    print("\n📋 BASIC HEALTH CHECKS")
    tester.test_health_check()
    
    # Authentication tests
    print("\n🔐 AUTHENTICATION TESTS")
    user_login_success = tester.test_user_login(user_email, user_password)
    admin_login_success = tester.test_admin_login(admin_email, admin_password)
    
    # Public API tests
    print("\n🌐 PUBLIC API TESTS")
    tester.test_get_categories()
    tester.test_get_services()
    tester.test_site_settings()
    
    # User authenticated tests
    if user_login_success:
        print("\n👤 USER AUTHENTICATED TESTS")
        tester.test_user_me()
        tester.test_user_services()
    else:
        print("\n❌ Skipping user authenticated tests - login failed")
    
    # Admin authenticated tests
    if admin_login_success:
        print("\n👑 ADMIN AUTHENTICATED TESTS")
        tester.test_admin_me()
        tester.test_admin_categories()
        tester.test_admin_services()
    else:
        print("\n❌ Skipping admin authenticated tests - login failed")
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"Success rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("✅ Backend APIs are working well!")
        return 0
    else:
        print("❌ Backend has significant issues")
        return 1

if __name__ == "__main__":
    sys.exit(main())