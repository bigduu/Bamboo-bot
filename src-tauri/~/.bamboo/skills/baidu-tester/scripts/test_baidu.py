#!/usr/bin/env python3
"""
Baidu.com HTTP Connectivity Tester

This script tests HTTP/HTTPS connectivity to baidu.com and provides
detailed information about the connection status, response time, and any errors.
"""

import argparse
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from socket import timeout as SocketTimeout


# Test URLs
TEST_URLS = [
    ("HTTP", "http://www.baidu.com"),
    ("HTTPS", "https://www.baidu.com"),
]

# Default timeout in seconds
DEFAULT_TIMEOUT = 10


def test_connection(name: str, url: str, timeout: int, verbose: bool = False) -> dict:
    """
    Test connection to a URL and return results.
    
    Args:
        name: Name of the test (e.g., "HTTP", "HTTPS")
        url: URL to test
        timeout: Timeout in seconds
        verbose: Whether to print verbose output
    
    Returns:
        Dictionary with test results
    """
    result = {
        "name": name,
        "url": url,
        "success": False,
        "status_code": None,
        "response_time": None,
        "error": None,
        "redirect_url": None,
    }
    
    if verbose:
        print(f"\nTesting {name}: {url}")
        print("-" * 60)
    
    start_time = time.time()
    
    try:
        request = Request(url, headers={'User-Agent': 'Mozilla/5.0 BaiduTester/1.0'})
        response = urlopen(request, timeout=timeout)
        
        end_time = time.time()
        response_time = end_time - start_time
        
        result["success"] = True
        result["status_code"] = response.getcode()
        result["response_time"] = response_time
        result["redirect_url"] = response.url if response.url != url else None
        
        if verbose:
            print(f"✓ Status Code: {result['status_code']}")
            print(f"✓ Response Time: {result['response_time']:.3f}s")
            if result["redirect_url"]:
                print(f"✓ Redirected to: {result['redirect_url']}")
            print(f"✓ Connection: SUCCESS")
        
    except HTTPError as e:
        end_time = time.time()
        result["status_code"] = e.code
        result["response_time"] = end_time - start_time
        result["error"] = f"HTTP Error: {e.code} {e.reason}"
        
        if verbose:
            print(f"✗ HTTP Error: {e.code} {e.reason}")
            print(f"✗ Response Time: {result['response_time']:.3f}s")
            print(f"✗ Connection: FAILED")
        
    except URLError as e:
        end_time = time.time()
        result["response_time"] = end_time - start_time
        result["error"] = f"URL Error: {e.reason}"
        
        if verbose:
            print(f"✗ URL Error: {e.reason}")
            print(f"✗ Response Time: {result['response_time']:.3f}s")
            print(f"✗ Connection: FAILED")
        
    except SocketTimeout:
        end_time = time.time()
        result["response_time"] = end_time - start_time
        result["error"] = f"Timeout after {timeout}s"
        
        if verbose:
            print(f"✗ Timeout: Connection timed out after {timeout}s")
            print(f"✗ Connection: FAILED")
        
    except Exception as e:
        end_time = time.time()
        result["response_time"] = end_time - start_time
        result["error"] = f"Unexpected error: {str(e)}"
        
        if verbose:
            print(f"✗ Unexpected Error: {str(e)}")
            print(f"✗ Connection: FAILED")
    
    return result


def main():
    """Main function to run connectivity tests."""
    parser = argparse.ArgumentParser(
        description="Test HTTP/HTTPS connectivity to baidu.com"
    )
    parser.add_argument(
        "--timeout", 
        type=int, 
        default=DEFAULT_TIMEOUT,
        help=f"Timeout in seconds (default: {DEFAULT_TIMEOUT})"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose output"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Only show summary (minimal output)"
    )
    
    args = parser.parse_args()
    
    if not args.quiet:
        print("=" * 60)
        print("Baidu.com HTTP Connectivity Tester")
        print("=" * 60)
        print(f"Timeout: {args.timeout}s")
    
    # Run tests
    results = []
    for name, url in TEST_URLS:
        result = test_connection(name, url, args.timeout, args.verbose)
        results.append(result)
    
    # Print summary
    if not args.quiet:
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
    
    success_count = sum(1 for r in results if r["success"])
    total_count = len(results)
    
    for result in results:
        status_icon = "✓" if result["success"] else "✗"
        status_text = "SUCCESS" if result["success"] else "FAILED"
        
        if args.quiet:
            print(f"{result['name']}: {status_text}")
        else:
            print(f"{status_icon} {result['name']}: {status_text}")
            if result["status_code"]:
                print(f"  Status Code: {result['status_code']}")
            if result["response_time"]:
                print(f"  Response Time: {result['response_time']:.3f}s")
            if result["error"]:
                print(f"  Error: {result['error']}")
    
    if not args.quiet:
        print("=" * 60)
        print(f"Tests Passed: {success_count}/{total_count}")
        print("=" * 60)
    
    # Exit with appropriate code
    if success_count == total_count:
        if not args.quiet:
            print("\n✓ All tests passed!\n")
        sys.exit(0)
    elif success_count > 0:
        if not args.quiet:
            print("\n⚠ Some tests passed, but not all\n")
        sys.exit(1)
    else:
        if not args.quiet:
            print("\n✗ All tests failed\n")
        sys.exit(2)


if __name__ == "__main__":
    main()
