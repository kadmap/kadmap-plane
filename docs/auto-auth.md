# Auto-Auth Feature & Sign-Out Button Documentation

## Overview

This document outlines the implementation of two key features:

1. **Auto-Auth**: A feature that allows automatic user registration and login via URL parameters
2. **Sign-Out Button Hiding**: CSS-based solution to hide all sign-out buttons across the application

## Auto-Auth Implementation

### Backend Changes

We created a new API endpoint in the authentication system:

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

This endpoint was registered in the URL patterns:

```python
# File: apiserver/plane/authentication/urls.py
path("auto-auth/", AutoAuthEndpoint.as_view(), name="auto-auth")
```

And imported in the authentication views:

```python
# File: apiserver/plane/authentication/views/__init__.py
from .app.auto_auth import AutoAuthEndpoint
```

### Frontend Implementation

A dedicated page was created to handle auto-auth:

```typescript
// File: web/app/auto_auth/page.tsx
// Key functionality:
// - Extracts email, password, firstname, lastname from URL parameters
// - Makes a direct request to /auth/auto-auth/ endpoint
// - Handles authentication states and errors
// - Redirects to home page on successful authentication
```

### Usage

The auto-auth feature can be used with the following URL format:

```
http://yourdomain.com/auto-auth?email=user@example.com&password=StrongP@ssw0rd!&firstname=John&lastname=Doe
```

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
   - This is handled automatically by the frontend code
   - If you encounter this error, check the CSRF token implementation

3. **404 Not Found errors**:
   - Verify the correct API endpoint paths are being used
   - Check for any typos in URL parameters

4. **Redirect loops**:
   - Clear browser cookies and try again
   - Ensure the instance is properly configured 