---
id: connection-tester
name: Connection Tester
description: Test network connectivity to websites and services. Use this skill when users want to check if a website is reachable, test internet connection, verify connectivity to specific URLs, or diagnose network issues.
category: system
tags:
  - network
  - connectivity
  - testing
  - diagnostics
tool_refs:
  - http_request
  - execute_command
workflow_refs: []
visibility: public
version: "1.0.0"
created_at: "2026-02-17T05:22:22Z"
updated_at: "2026-02-17T05:22:22Z"
---

# Connection Tester

## Overview

This skill provides a quick and reliable way to test network connectivity to websites and services, with a default target of google.com for basic internet connectivity checks.

## When to Use

Use this skill when:
- Testing internet connectivity
- Checking if a specific website or URL is reachable
- Diagnosing network connection issues
- Verifying HTTP/HTTPS endpoints are responding
- Measuring response times for web services

## Workflow

### Basic Connectivity Test (Google.com)

For a quick internet connectivity check, test connection to google.com:

```python
# Using http_request tool
http_request(
    url="https://www.google.com",
    method="GET",
    timeout_seconds=10
)
```

**Success indicators:**
- Status code: 200
- Response received within timeout
- No connection errors

### Test Custom URL

To test connectivity to a specific URL:

```python
http_request(
    url="https://example.com",
    method="GET",
    timeout_seconds=30
)
```

### Advanced Diagnostics

For more detailed network diagnostics, use command-line tools:

**Using curl:**
```bash
curl -I -m 10 https://www.google.com
```

**Using ping:**
```bash
ping -c 4 google.com
```

**Using wget:**
```bash
wget --spider --timeout=10 https://www.google.com
```

## Response Analysis

### HTTP Status Codes
- **2xx**: Success - Connection working
- **3xx**: Redirect - Connection working, but URL redirected
- **4xx**: Client error - Connection working, but resource issue
- **5xx**: Server error - Connection working, but server problem
- **Timeout/No response**: Connectivity issue

### Common Issues

1. **Timeout**: Network unreachable or server not responding
2. **DNS Error**: Domain name cannot be resolved
3. **Connection Refused**: Server not accepting connections
4. **SSL Error**: Certificate problem with HTTPS

## Examples

### Example 1: Quick Internet Check
User: "Test my internet connection"
→ Test https://www.google.com and report status

### Example 2: Custom Endpoint
User: "Check if https://api.example.com is reachable"
→ Test the specified URL and report response details

### Example 3: Multiple Tests
User: "Test connectivity to google.com and github.com"
→ Run tests for both URLs and compare results

## Best Practices

1. **Use appropriate timeouts**: 10-30 seconds for most tests
2. **Check both HTTP and HTTPS**: Some sites may redirect
3. **Consider rate limiting**: Don't spam requests
4. **Report meaningful info**: Include status code, response time, and any errors
