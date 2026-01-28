#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class FuneralHomeAPITester:
    def __init__(self, base_url="https://funeral-crm-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.director_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # Test credentials
        self.admin_creds = {"email": "admin@behmfuneral.com", "password": "admin123"}
        self.director_creds = {"email": "eric@behmfuneral.com", "password": "director123"}

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None, description=""):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        if description:
            self.log(f"   {description}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                self.log(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                self.log(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            self.log(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_seed_data(self):
        """Test data seeding"""
        self.log("\n=== TESTING DATA SEEDING ===")
        success, _ = self.run_test(
            "Seed Data",
            "POST",
            "seed",
            200,
            description="Initialize database with sample data"
        )
        return success

    def test_admin_login(self):
        """Test admin login"""
        self.log("\n=== TESTING ADMIN AUTHENTICATION ===")
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data=self.admin_creds,
            description="Login with admin credentials"
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            self.log(f"✅ Admin token obtained")
            return True
        return False

    def test_director_login(self):
        """Test director login"""
        self.log("\n=== TESTING DIRECTOR AUTHENTICATION ===")
        success, response = self.run_test(
            "Director Login",
            "POST",
            "auth/login",
            200,
            data=self.director_creds,
            description="Login with director credentials"
        )
        if success and 'access_token' in response:
            self.director_token = response['access_token']
            self.log(f"✅ Director token obtained")
            return True
        return False

    def test_dashboard_endpoints(self):
        """Test dashboard and reports endpoints"""
        self.log("\n=== TESTING DASHBOARD ENDPOINTS ===")
        
        # Test admin dashboard
        self.run_test(
            "Admin Dashboard",
            "GET",
            "reports/dashboard",
            200,
            token=self.admin_token,
            description="Get dashboard data as admin"
        )
        
        # Test director dashboard
        self.run_test(
            "Director Dashboard",
            "GET",
            "reports/dashboard",
            200,
            token=self.director_token,
            description="Get dashboard data as director"
        )

    def test_cases_crud(self):
        """Test cases CRUD operations"""
        self.log("\n=== TESTING CASES CRUD ===")
        
        # List cases as admin
        success, cases_response = self.run_test(
            "List Cases (Admin)",
            "GET",
            "cases",
            200,
            token=self.admin_token,
            description="Get all cases as admin"
        )
        
        # List cases as director
        self.run_test(
            "List Cases (Director)",
            "GET",
            "cases",
            200,
            token=self.director_token,
            description="Get cases as director (should be filtered)"
        )
        
        # Get directors for case creation
        success, directors_response = self.run_test(
            "List Directors",
            "GET",
            "directors",
            200,
            token=self.admin_token
        )
        
        # Get service types
        success, service_types_response = self.run_test(
            "List Service Types",
            "GET",
            "service-types",
            200,
            token=self.admin_token
        )
        
        if directors_response and service_types_response:
            directors = directors_response if isinstance(directors_response, list) else []
            service_types = service_types_response if isinstance(service_types_response, list) else []
            
            if directors and service_types:
                # Create new case
                new_case_data = {
                    "case_number": f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    "date_of_death": "2024-01-15",
                    "customer_first_name": "Test",
                    "customer_last_name": "Customer",
                    "service_type_id": service_types[0]["id"],
                    "director_id": directors[0]["id"],
                    "total_sale": 5000.00,
                    "payments_received": 1000.00
                }
                
                success, create_response = self.run_test(
                    "Create Case",
                    "POST",
                    "cases",
                    201,
                    data=new_case_data,
                    token=self.admin_token,
                    description="Create a new case"
                )
                
                if success and create_response.get("id"):
                    case_id = create_response["id"]
                    
                    # Get specific case
                    self.run_test(
                        "Get Case",
                        "GET",
                        f"cases/{case_id}",
                        200,
                        token=self.admin_token,
                        description="Get specific case details"
                    )
                    
                    # Update case
                    update_data = {
                        "payments_received": 2000.00
                    }
                    self.run_test(
                        "Update Case",
                        "PUT",
                        f"cases/{case_id}",
                        200,
                        data=update_data,
                        token=self.admin_token,
                        description="Update case payments"
                    )
                    
                    # Delete case (admin only)
                    self.run_test(
                        "Delete Case",
                        "DELETE",
                        f"cases/{case_id}",
                        200,
                        token=self.admin_token,
                        description="Delete test case"
                    )

    def test_directors_crud(self):
        """Test directors CRUD operations"""
        self.log("\n=== TESTING DIRECTORS CRUD ===")
        
        # List directors
        self.run_test(
            "List Directors",
            "GET",
            "directors",
            200,
            token=self.admin_token
        )
        
        # Create director (admin only)
        new_director = {
            "name": f"Test Director {datetime.now().strftime('%H%M%S')}",
            "is_active": True
        }
        
        success, create_response = self.run_test(
            "Create Director",
            "POST",
            "directors",
            201,
            data=new_director,
            token=self.admin_token,
            description="Create new director"
        )
        
        if success and create_response.get("id"):
            director_id = create_response["id"]
            
            # Update director
            update_data = {
                "name": f"Updated Director {datetime.now().strftime('%H%M%S')}",
                "is_active": True
            }
            self.run_test(
                "Update Director",
                "PUT",
                f"directors/{director_id}",
                200,
                data=update_data,
                token=self.admin_token
            )
            
            # Delete director (deactivate)
            self.run_test(
                "Delete Director",
                "DELETE",
                f"directors/{director_id}",
                200,
                token=self.admin_token
            )

    def test_users_management(self):
        """Test user management (admin only)"""
        self.log("\n=== TESTING USER MANAGEMENT ===")
        
        # List users
        self.run_test(
            "List Users",
            "GET",
            "users",
            200,
            token=self.admin_token
        )
        
        # Test director access (should be forbidden)
        self.run_test(
            "List Users (Director - Should Fail)",
            "GET",
            "users",
            403,
            token=self.director_token,
            description="Directors should not access user management"
        )

    def test_service_types_crud(self):
        """Test service types CRUD"""
        self.log("\n=== TESTING SERVICE TYPES CRUD ===")
        
        # List service types
        self.run_test(
            "List Service Types",
            "GET",
            "service-types",
            200,
            token=self.admin_token
        )
        
        # Create service type (admin only)
        new_service_type = {
            "name": f"Test Service {datetime.now().strftime('%H%M%S')}",
            "is_active": True
        }
        
        success, create_response = self.run_test(
            "Create Service Type",
            "POST",
            "service-types",
            201,
            data=new_service_type,
            token=self.admin_token
        )
        
        if success and create_response.get("id"):
            service_type_id = create_response["id"]
            
            # Update service type
            update_data = {
                "name": f"Updated Service {datetime.now().strftime('%H%M%S')}",
                "is_active": True
            }
            self.run_test(
                "Update Service Type",
                "PUT",
                f"service-types/{service_type_id}",
                200,
                data=update_data,
                token=self.admin_token
            )

    def test_sale_types_crud(self):
        """Test sale types CRUD"""
        self.log("\n=== TESTING SALE TYPES CRUD ===")
        
        # List sale types
        self.run_test(
            "List Sale Types",
            "GET",
            "sale-types",
            200,
            token=self.admin_token
        )
        
        # Create sale type (admin only)
        new_sale_type = {
            "name": f"Test Sale {datetime.now().strftime('%H%M%S')}",
            "is_active": True
        }
        
        success, create_response = self.run_test(
            "Create Sale Type",
            "POST",
            "sale-types",
            201,
            data=new_sale_type,
            token=self.admin_token
        )
        
        if success and create_response.get("id"):
            sale_type_id = create_response["id"]
            
            # Update sale type
            update_data = {
                "name": f"Updated Sale {datetime.now().strftime('%H%M%S')}",
                "is_active": True
            }
            self.run_test(
                "Update Sale Type",
                "PUT",
                f"sale-types/{sale_type_id}",
                200,
                data=update_data,
                token=self.admin_token
            )

    def test_export_functionality(self):
        """Test export endpoints"""
        self.log("\n=== TESTING EXPORT FUNCTIONALITY ===")
        
        # Test CSV export
        self.run_test(
            "Export CSV",
            "GET",
            "export/csv",
            200,
            token=self.admin_token,
            description="Export cases as CSV"
        )
        
        # Test PDF export
        self.run_test(
            "Export PDF",
            "GET",
            "export/pdf",
            200,
            token=self.admin_token,
            description="Export cases as PDF"
        )

    def run_all_tests(self):
        """Run all API tests"""
        self.log("🚀 Starting Funeral Home API Tests")
        self.log(f"Base URL: {self.base_url}")
        
        # Seed data first
        self.test_seed_data()
        
        # Authentication tests
        if not self.test_admin_login():
            self.log("❌ Admin login failed - stopping tests")
            return False
            
        if not self.test_director_login():
            self.log("❌ Director login failed - stopping tests")
            return False
        
        # Core functionality tests
        self.test_dashboard_endpoints()
        self.test_cases_crud()
        self.test_directors_crud()
        self.test_users_management()
        self.test_service_types_crud()
        self.test_sale_types_crud()
        self.test_export_functionality()
        
        # Print results
        self.log(f"\n📊 Test Results:")
        self.log(f"Tests run: {self.tests_run}")
        self.log(f"Tests passed: {self.tests_passed}")
        self.log(f"Tests failed: {len(self.failed_tests)}")
        self.log(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            self.log(f"\n❌ Failed Tests:")
            for test in self.failed_tests:
                error_msg = test.get('error', f"Expected {test.get('expected')}, got {test.get('actual')}")
                self.log(f"  - {test['test']}: {error_msg}")
        
        return len(self.failed_tests) == 0

def main():
    tester = FuneralHomeAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())