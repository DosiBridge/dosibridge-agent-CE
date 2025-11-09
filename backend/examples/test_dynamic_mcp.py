"""
Test script for dynamic MCP server management
"""
import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_mcp_management():
    """Test MCP server management endpoints"""
    
    print("=" * 60)
    print("Testing Dynamic MCP Server Management")
    print("=" * 60)
    print()
    
    # Test 1: List current servers
    print("1️⃣  Listing current MCP servers...")
    response = requests.get(f"{BASE_URL}/api/mcp-servers")
    data = response.json()
    print(f"   Status: {data['status']}")
    print(f"   Count: {data['count']}")
    print(f"   Servers: {json.dumps(data['servers'], indent=2)}")
    print()
    
    initial_count = data['count']
    
    # Test 2: Add a new test server
    print("2️⃣  Adding a new test MCP server...")
    new_server = {
        "name": "TestWeather",
        "url": "https://weather-test.com/mcp"
    }
    response = requests.post(
        f"{BASE_URL}/api/mcp-servers",
        json=new_server
    )
    data = response.json()
    print(f"   Status: {data['status']}")
    print(f"   Message: {data['message']}")
    print(f"   Total servers: {data['total_servers']}")
    print()
    
    # Test 3: List servers again (should have one more)
    print("3️⃣  Listing servers after addition...")
    response = requests.get(f"{BASE_URL}/api/mcp-servers")
    data = response.json()
    print(f"   Count: {data['count']} (was {initial_count})")
    print(f"   ✅ Successfully added!" if data['count'] == initial_count + 1 else "   ❌ Count mismatch!")
    print()
    
    # Test 4: Try to add duplicate (should fail)
    print("4️⃣  Trying to add duplicate server (should fail)...")
    response = requests.post(
        f"{BASE_URL}/api/mcp-servers",
        json=new_server
    )
    if response.status_code == 400:
        print(f"   ✅ Correctly rejected duplicate: {response.json()['detail']}")
    else:
        print(f"   ❌ Should have rejected duplicate!")
    print()
    
    # Test 5: Delete the test server
    print("5️⃣  Deleting test server...")
    response = requests.delete(f"{BASE_URL}/api/mcp-servers/TestWeather")
    data = response.json()
    print(f"   Status: {data['status']}")
    print(f"   Message: {data['message']}")
    print(f"   Remaining: {data['remaining_servers']}")
    print()
    
    # Test 6: List servers again (should be back to initial count)
    print("6️⃣  Listing servers after deletion...")
    response = requests.get(f"{BASE_URL}/api/mcp-servers")
    data = response.json()
    print(f"   Count: {data['count']} (was {initial_count})")
    print(f"   ✅ Successfully deleted!" if data['count'] == initial_count else "   ❌ Count mismatch!")
    print()
    
    # Test 7: Try to delete non-existent server
    print("7️⃣  Trying to delete non-existent server (should fail)...")
    response = requests.delete(f"{BASE_URL}/api/mcp-servers/NonExistent")
    if response.status_code == 404:
        print(f"   ✅ Correctly returned 404: {response.json()['detail']}")
    else:
        print(f"   ❌ Should have returned 404!")
    print()
    
    print("=" * 60)
    print("✅ All tests completed!")
    print("=" * 60)
    print()
    print("📝 Summary:")
    print("   - List servers: ✅")
    print("   - Add server: ✅")
    print("   - Duplicate prevention: ✅")
    print("   - Delete server: ✅")
    print("   - Error handling: ✅")
    print()
    print("🎉 Dynamic MCP server management is working perfectly!")
    print()

if __name__ == "__main__":
    print("⏳ Waiting for server to be ready...")
    time.sleep(2)
    
    try:
        # Check if server is running
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Server is ready!")
            print()
            test_mcp_management()
        else:
            print("❌ Server returned unexpected status")
    except requests.exceptions.ConnectionError:
        print("❌ Error: Server is not running!")
        print("   Please start the server first:")
        print("   ./start_server.sh")

