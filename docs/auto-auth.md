# Auto-Auth Feature & Sign-Out Button Documentation

## Overview

This document outlines the implementation of two key features:

1. **Auto-Auth**: A feature that allows automatic user registration and login via URL parameters
2. **Sign-Out Button Hiding**: CSS-based solution to hide all sign-out buttons across the application

## Auto-Auth Implementation

### Backend Changes

We created two API endpoints in the authentication system:

1. **Regular User Auto-Auth**:
```python
# File: apiserver/plane/authentication/views/app/auto_auth.py
class AutoAuthEndpoint(APIView):
    permission_classes = [AllowAny]
    
    # Main logic:
    # - Checks instance configuration
    # - Validates email and password
    # - If user exists with correct password, authenticates them
    # - If user doesn't exist or has incorrect password, creates a new user
    # - Returns JSON response with authentication status
```

2. **Admin Auto-Auth**:
```python
# File: apiserver/plane/authentication/views/app/admin_auto_auth.py
class AdminAutoAuthEndpoint(APIView):
    permission_classes = [AllowAny]
    
    # Main logic:
    # - Checks instance configuration
    # - Validates admin credentials
    # - Creates instance if it doesn't exist
    # - Creates or authenticates admin user
    # - Sets up instance admin permissions
    # - Returns JSON response with redirect URL
```

These endpoints were registered in the URL patterns:

```python
# File: apiserver/plane/authentication/urls.py
path("auto-auth/", AutoAuthEndpoint.as_view(), name="auto-auth"),
path("admin-auto-auth/", AdminAutoAuthEndpoint.as_view(), name="admin-auto-auth")
```

### Frontend Implementation

Two dedicated pages were created to handle auto-auth:

1. **Regular User Auto-Auth**:
```typescript
// File: web/app/auto_auth/page.tsx
// Key functionality:
// - Extracts parameters from URL (kadmap_api_url, user_id, etc.)
// - Fetches user details from Kadmap API
// - Makes a direct request to /auth/auto-auth/ endpoint
// - Handles authentication states and errors
// - Redirects to god-mode if no instance exists or guard is admin
// - Redirects to home page on successful authentication
```

2. **Admin Auto-Auth**:
```typescript
// File: admin/app/auto_auth/page.tsx
// Key functionality:
// - Extracts parameters from URL (kadmap_api_url, user_id, etc.)
// - Fetches user details from Kadmap API
// - Makes a request to /auth/admin-auto-auth/ endpoint with additional admin parameters
// - Handles authentication states and errors
// - Redirects to admin dashboard on successful authentication
```

### Auto-Auth Flow

Both regular and admin auto-auth follow a similar flow:

1. **Initial Check**:
   - Extract parameters from URL (kadmap_api_url, user_id, etc.)
   - Fetch CSRF token using AuthService

2. **Kadmap API Integration**:
   - Fetch user details from `${kadmap_api_url}/directory/users/${user_id}`
   - Extract user information:
     - `email` from `userKID`
     - `firstName` and `lastName` from `fullName`
     - `password` from `userId`

3. **Authentication Request**:
   For regular users:
   - Send POST request to `/auth/auto-auth/` with:
     - CSRF token in headers
     - User credentials and details in body
     - `credentials: 'include'` for cookie handling
   
   For admin users:
   - Send POST request to `/auth/admin-auto-auth/` with:
     - CSRF token in headers
     - Admin credentials and details in body
     - Additional parameters: `company_name`, `is_telemetry_enabled`, `guard`
     - `credentials: 'include'` for cookie handling

4. **Response Handling**:
   Regular auto-auth:
   - Check for Location header (immediate redirect)
   - If instance not configured or guard is admin, redirect to `/god-mode/auto_auth`
   - On success, redirect to root path ('/')
   - On error, display error message

   Admin auto-auth:
   - Check for redirect URL in response
   - On success, redirect to provided URL
   - On error, display error message

### Status Messages

Both implementations provide user feedback through status messages:

```typescript
const getStatusMessage = () => {
  switch (status) {
    case "fetching_user_details":
      return "Fetching user details...";
    case "checking":
      return "Checking your account...";
    case "authenticating":
      return "Authenticating...";
    case "reloading":
      return "Authentication is taking longer than expected. Reloading page...";
    case "error":
      return "Error occurred";
    default:
      return "We are preparing your account...";
  }
};
```

### Timeout Handling

The auto-auth implementation includes automatic timeout handling to ensure users aren't stuck in an indefinite authentication state:

1. **Authentication Timeout**:
   - If authentication takes longer than 5 seconds, the system will automatically trigger a page reload
   - Users are informed with a status message before the reload occurs
   - A 1.5-second delay is added before the actual reload to ensure users can read the status message

2. **Implementation Details**:
```typescript
useEffect(() => {
  let timeoutId: NodeJS.Timeout;
  if (status === "authenticating") {
    timeoutId = setTimeout(() => {
      console.log("Authentication taking too long, reloading page...");
      setStatus("reloading");
      setTimeout(() => {
        window.location.reload();
      }, 1500); // Give user 1.5 seconds to see the reload message
    }, 5000);
  }
  return () => {
    if (timeoutId) clearTimeout(timeoutId);
  };
}, [status]);
```

This timeout mechanism helps prevent users from being stuck in a perpetual loading state and provides clear feedback about the system's actions.

### Usage

The auto-auth feature requires the following URL format:

```
http://yourdomain.com/auto_auth?kadmap_api_url=http%3A%2F%2F192.168.30.77%3A19090%2Fapi%2Fv1&vfs_base_url=http%3A%2F%2F192.168.30.77%3A8001&workspace_id=b77911b0-6c89-4136-a1b9-d50ecaed5597&user_id=891e9432-6655-413e-8840-27ad23c9b223&user_KID=adminmanager%40kadmap.kadmap
```

Note: The URL parameters are URL-encoded. Here's what they decode to:
- `kadmap_api_url`: http://192.168.30.77:19090/api/v1
- `vfs_base_url`: http://192.168.30.77:8001
- `workspace_id`: b77911b0-6c89-4136-a1b9-d50ecaed5597
- `user_id`: 891e9432-6655-413e-8840-27ad23c9b223
- `user_KID`: adminmanager@kadmap.kadmap

Required parameters:
- `kadmap_api_url`: Base URL for Kadmap API
- `user_id`: User ID in Kadmap system
- `workspace_id`: Workspace ID in Kadmap system
- `vfs_base_url`: Base URL for VFS system

Optional parameters:
- `company_name`: Company name for new user (admin only)
- `is_telemetry_enabled`: Boolean flag for telemetry (admin only)
- `guard`: User type (e.g., "admin")

Note: Email and password are never set directly in the URL. They are always obtained from the Kadmap API using the provided `kadmap_api_url` and `user_id` parameters.

## Sign-Out Button Hiding

To hide all sign-out buttons across the application, we implemented a CSS-based solution:

```css
/* File: web/styles/hide-signout.css */
/* Hide sign out buttons in workspace sidebar dropdown */
button:has(.lucide-log-out),
button:has([class*="log-out"]),
button:has(svg[class*="log-out"]) {
  display: none !important;
}

/* Hide sign out forms in space user avatar component */
form[action*="sign-out"] {
  display: none !important;
}

/* Hide text content with "Sign out" or "sign_out" text */
*:has(> span:contains("sign_out")),
*:has(> span:contains("Sign out")),
*:has(> div:contains("Sign out")) {
  display: none !important;
}

/* Hide by common class patterns if they exist */
.sign-out-button,
.logout-button,
[class*="sign-out"],
[class*="log-out"] {
  display: none !important;
}
```

This CSS file was imported in the main application layout:

```typescript
// File: web/app/layout.tsx
import "@/styles/hide-signout.css";
```

### Design Decisions

- **Non-intrusive approach**: We chose CSS-based hiding rather than modifying component code
- **Multiple selector strategies**: Used various CSS selectors to catch all sign-out button variations
- **!important flag**: Ensures our hiding rules take precedence over any other styling

## Password Requirements

The system uses the `zxcvbn` library to validate password strength. To pass validation, passwords must:

1. Have a minimum length of 8 characters
2. Score at least 3 out of 4 on the zxcvbn strength test

Example of acceptable strong passwords:
- `3m@ilP@ssw0rd!2024`
- `SuperC0mpl3x!P@ssw0rd`
- `Pl@neAv1at0r$tr0ng2024`
- `Un1qu3P@$$w0rd!Complex`

## Troubleshooting

### Common Issues

1. **INVALID_PASSWORD error**: 
   - Ensure password meets the strength requirements
   - Use one of the example passwords provided above

2. **CSRF Verification Failed**:
   - The frontend automatically fetches and includes CSRF token
   - If you encounter this error:
     - Check if CSRF token is being fetched correctly
     - Verify the token is included in request headers
     - Ensure cookies are being sent with credentials: 'include'

3. **404 Not Found errors**:
   - Verify the correct API endpoint paths are being used
   - Check for any typos in URL parameters

4. **Redirect loops**:
   - Clear browser cookies and try again
   - Ensure the instance is properly configured

5. **Session Issues**:
   - Check if session cookies are being set correctly
   - Verify cookie domain settings in Django configuration
   - Ensure CORS settings allow credentials

### Debugging Tips

1. **Check Network Requests**:
   - Verify CSRF token is being fetched
   - Check if authentication request includes proper headers
   - Look for any CORS or cookie-related issues

2. **Session Verification**:
   - Use browser dev tools to check cookies
   - Verify session cookie is present after authentication
   - Check cookie domain and path settings

3. **Response Handling**:
   - Monitor console for error messages
   - Check response headers for redirects
   - Verify JSON response structure 