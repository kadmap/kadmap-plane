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
  const email = searchParams.get("email");
  const password = searchParams.get("password");
  const firstname = searchParams.get("firstname");
  const lastname = searchParams.get("lastname");
  const company_name = searchParams.get("company_name");
  const is_telemetry_enabled = searchParams.get("is_telemetry_enabled") === "true";
  const guard = searchParams.get("guard");
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

    if (email && password && csrfToken) {
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
          first_name: firstname,
          last_name: lastname,
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
          console.error('Authentication error:', {
            email,
            password,
            firstname,
            lastname,
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
  }, [email, password, firstname, lastname, company_name, is_telemetry_enabled, guard, searchParams, router, csrfToken]);

  const getStatusMessage = () => {
    switch (status) {
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