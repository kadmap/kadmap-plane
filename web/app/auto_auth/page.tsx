"use client";

import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { PageHead } from "@/components/core";
import { useSearchParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import Image from "next/image";

import { useEffect, useState } from "react";
// services
import { AuthService } from "@/services/auth.service";
// components
import { LogoSpinner } from "@/components/common";
// assets
import BlackHorizontalLogo from "@/public/plane-logos/black-horizontal-with-blue-logo.png";
import WhiteHorizontalLogo from "@/public/plane-logos/white-horizontal-with-blue-logo.png";

const authService = new AuthService();

const AutoAuthPage = observer(() => {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  let email;
  let firstName;
  let lastName;
  let password;
  let guard = searchParams.get("guard");
  const kadmap_api_url = searchParams.get("kadmap_api_url");
  const vfs_base_url = searchParams.get("vfs_base_url");
  const workspace_id = searchParams.get("workspace_id");
  const user_id = searchParams.get("user_id");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("checking");
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);
  const { resolvedTheme } = useTheme();

  const logo = resolvedTheme === "light" ? BlackHorizontalLogo : WhiteHorizontalLogo;

  useEffect(() => {
    // Get CSRF token using AuthService
    authService.requestCSRFToken()
      .then((data) => {
        if (data.csrf_token) {
          setCsrfToken(data.csrf_token);
        }
      })
      .catch(err => {
        console.error('Error fetching CSRF token:', err);
        setError('Error fetching CSRF token');
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    // Redirect to god-mode/auto_auth if guard is admin
    if (guard === "admin") {
      const params = new URLSearchParams(searchParams.toString());
      router.push(`/god-mode/auto_auth?${params.toString()}`);
      return;
    }

    // Call the kadmap api to get the user's details
    if (kadmap_api_url && user_id) {
      setStatus("fetching_user_details");
      fetch(`${kadmap_api_url}/directory/users/${user_id}`)
        .then(response => response.json())
        .then(data => {
          if (data.error) {
            console.error('Error fetching user details:', data.error);
            setError('Error fetching user details');
            setStatus("error");
          } else {
            // Get the user's details
            const userDetails = data.data;
            const fullName = userDetails.fullName;
            email = userDetails.userKID;
            firstName = fullName.split(' ')[0];
            lastName = fullName.split(' ')[1];
            password = userDetails.userId;

            // Now that we have the user details, proceed with auto-auth
            if (csrfToken) {
              setStatus("authenticating");
              
              // Use the auto-auth endpoint directly
              fetch('/auth/auto-auth/', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-CSRFToken': csrfToken,
                },
                credentials: 'include',
                body: JSON.stringify({ 
                  email, 
                  password,
                  first_name: firstName,
                  last_name: lastName,
                }),
              })
              .then(response => {
                // Get the redirect URL from the response headers
                const redirectUrl = response.headers.get('Location');
                if (redirectUrl) {
                  // Use Next.js router to navigate
                  router.push(redirectUrl);
                  return;
                }
                return response.json();
              })
              .then(data => {
                if (data && data.error) {
                  // If instance is not configured or guard is admin, redirect to god-mode
                  if (data.error === "INSTANCE_NOT_CONFIGURED" || guard === "admin") {
                    const params = new URLSearchParams(searchParams.toString());
                    router.push(`/god-mode/auto_auth?${params.toString()}`);
                    return;
                  }
                  
                  console.error('Authentication error:', {
                    email,
                    password,
                    firstName,
                    lastName,
                    error: data.error,
                    message: data.message
                  });
                  setError(data.message);
                  setStatus("error");
                } else if (data && data.authenticated) {
                  // User is authenticated, redirect to root path
                  router.push('/');
                } else if (data && data.redirect_url) {
                  // Use Next.js router to navigate
                  router.push(data.redirect_url);
                }
              })
              .catch(err => {
                console.error('Error during authentication:', err);
                setError('Error during authentication: ' + err.message);
                setStatus("error");
              });
            }
          }
        })
        .catch(err => {
          console.error('Error fetching user details:', err);
          setError('Error fetching user details: ' + err.message);
          setStatus("error");
        });
    }
  }, [kadmap_api_url, user_id, guard, searchParams, router, csrfToken]);

  const getStatusMessage = () => {
    switch (status) {
      case "fetching_user_details":
        return "Fetching user details...";
      case "checking":
        return "Checking your account...";
      case "authenticating":
        return "Authenticating...";
      case "error":
        return "Error occurred";
      default:
        return "We are preparing your account...";
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center">
      <PageHead title="Auto Auth" />
      <div className="flex flex-col items-center gap-6">
        <Image src={logo} alt="Plane logo" className="h-[30px] w-[133px]" />
        <LogoSpinner />
        {error ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-lg text-red-600">{error}</p>
            <p className="text-sm text-gray-500">Check console for details</p>
          </div>
        ) : (
          <p className="text-lg text-gray-600">{getStatusMessage()}</p>
        )}
      </div>
    </div>
  );
});

export default AutoAuthPage; 