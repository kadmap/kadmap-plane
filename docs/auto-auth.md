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
// - Extracts email, password, firstname, lastname from URL parameters
// - Makes a direct request to /auth/auto-auth/ endpoint
// - Handles authentication states and errors
// - Redirects to home page on successful authentication
```

2. **Admin Auto-Auth**:
```typescript
// File: admin/app/auto_auth/page.tsx
// Key functionality:
// - Extracts admin credentials and instance details from URL parameters
// - Makes a request to /auth/admin-auto-auth/ endpoint
// - Handles authentication states and errors
// - Redirects to admin dashboard on successful authentication
```

### Admin Auto-Auth Flow

The admin authentication process follows these steps:

1. **Initial Check**:
   - Extract parameters from URL (email, password, firstname, lastname, company_name, etc.)
   - Fetch CSRF token using AuthService
   - Check if instance exists and is configured

2. **Authentication Request**:
   - Send POST request to `/auth/admin-auto-auth/` with:
     - CSRF token in headers
     - Admin credentials and instance details in body
     - `credentials: 'include'` for cookie handling

3. **Response Handling**:
   - Parse JSON response
   - Handle two scenarios:
     - Error response: Display error message
     - Success response: Redirect to admin dashboard

### Interaction Between Frontend Pages

The auto-auth system works in two stages:

1. **Initial Request**:
   - User visits `/auto_auth` with credentials
   - If `guard=admin` is present, redirects to `/god-mode/auto_auth`
   - Otherwise, proceeds with regular user authentication

2. **Admin Authentication**:
   - Admin page makes request to `/auth/admin-auto-auth/`
   - On success, redirects to admin dashboard
   - On failure, displays error message

### CSRF Token Handling

To handle CSRF protection, we implemented the following:

1. **CSRF Token Fetching**:
   ```typescript
   // Using AuthService to fetch CSRF token
   authService.requestCSRFToken()
     .then((data) => {
       if (data.csrf_token) {
         setCsrfToken(data.csrf_token);
       }
     })
   ```

2. **Request Headers**:
   ```typescript
   headers: {
     'Content-Type': 'application/json',
     'X-CSRFToken': csrfToken,
   }
   ```

### Authentication Flow

The authentication process follows these steps:

1. **Initial Check**:
   - Extract parameters from URL (email, password, firstname, lastname, etc.)
   - Fetch CSRF token using AuthService
   - Check if user is an admin (redirects to god-mode if true)

2. **Authentication Request**:
   - Send POST request to `/auth/auto-auth/` with:
     - CSRF token in headers
     - User credentials and details in body
     - `credentials: 'include'` for cookie handling

3. **Response Handling**:
   - Check for Location header (immediate redirect)
   - Parse JSON response
   - Handle three scenarios:
     - Error response: Display error message
     - Authenticated response: Redirect to root path ('/')
     - Redirect URL response: Navigate to specified URL

### Usage

The auto-auth feature can be used with the following URL format:

```
http://yourdomain.com/auto_auth?email=user@example.com&password=StrongP@ssw0rd!&firstname=John&lastname=Doe
```

Additional parameters:
- `company_name`: (Optional) Company name for new user
- `is_telemetry_enabled`: (Optional) Boolean flag for telemetry
- `guard`: (Optional) User type (e.g., "admin")

Parameter requirements:
- `email`: Valid email address
- `password`: Strong password (see Password Requirements section)
- `firstname`: (Optional) User's first name
- `lastname`: (Optional) User's last name

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