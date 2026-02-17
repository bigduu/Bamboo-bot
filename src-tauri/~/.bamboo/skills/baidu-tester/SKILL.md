---
id: baidu-tester
name: Baidu Tester
description: Test HTTP connectivity to baidu.com. Use this skill when users want to check if baidu.com is accessible, test connection to Baidu, or verify network connectivity to Chinese websites.
category: testing
tags:
  - testing
  - http
  - connectivity
  - baidu
  - network
tool_refs:
  - http_request
  - execute_command
workflow_refs: []
visibility: public
version: "1.0.0"
created_at: "2026-02-17T05:34:05Z"
updated_at: "2026-02-17T05:34:05Z"
---

# Baidu Tester

## Overview

This skill provides automated HTTP connectivity testing for baidu.com. It helps verify that the Baidu website is accessible and responds correctly to HTTP requests.

## When to Use

Use this skill when:
- Testing if baidu.com is accessible
- Checking network connectivity to Chinese websites
- Verifying HTTP/HTTPS connections to Baidu
- Running automated connectivity tests
- Troubleshooting network issues related to Baidu services

## Workflow

### Step 1: Run the Test Script

Execute the Python test script to perform connectivity tests:

```bash
python3 ~/.bamboo/skills/baidu-tester/scripts/test_baidu.py
```

This script will:
1. Send HTTP GET requests to baidu.com
2. Check response status codes
3. Measure response time
4. Display detailed results

### Step 2: Analyze Results

The script will output:
- Connection status (Success/Failed)
- HTTP status code (e.g., 200, 301, 302)
- Response time in seconds
- Any error messages if the connection fails

### Step 3: Troubleshoot if Needed

If the test fails, common issues include:
- Network connectivity problems
- DNS resolution issues
- Firewall restrictions
- Baidu service downtime

## Resources

### scripts/
- `scripts/test_baidu.py` - Python script that performs HTTP connectivity tests to baidu.com with detailed output

## Examples

### Example 1: Basic Test
```bash
python3 ~/.bamboo/skills/baidu-tester/scripts/test_baidu.py
```

### Example 2: Verbose Output
```bash
python3 ~/.bamboo/skills/baidu-tester/scripts/test_baidu.py --verbose
```

## Notes

- The script tests both HTTP (port 80) and HTTPS (port 443) connections
- Default timeout is 10 seconds
- The script follows redirects (status codes 301, 302)
- Requires Python 3.6+ with `requests` library
