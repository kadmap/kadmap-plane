"use client";

import { observer } from "mobx-react";
import { PageHead } from "@/components/common/page-head";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import Image from "next/image";
import { mutate } from "swr";

import { useEffect, useState } from "react";
// services
import { AuthService } from "@plane/services";
// components
import { LogoSpinner } from "@/components/common";
// hooks
import { useInstance, useUser } from "@/hooks/store";
// assets
import BlackHorizontalLogo from "@/public/plane-logos/black-horizontal-with-blue-logo.png";
import WhiteHorizontalLogo from "@/public/plane-logos/white-horizontal-with-blue-logo.png";

const authService = new AuthService();

const AutoAuthPage = observer(() => {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const password = searchParams.get("password");
  const firstname = searchParams.get("firstname");
  const lastname = searchParams.get("lastname");
  const companyname = searchParams.get("companyname");
  const is_telemetry_enabled = searchParams.get("is_telemetry_enabled") === "true";
  const guard = searchParams.get("guard");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("checking");
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);
  const { resolvedTheme } = useTheme();
  // store hooks
  const { fetchInstanceInfo, fetchInstanceAdmins } = useInstance();
  const { fetchCurrentUser } = useUser();

  const logo = resolvedTheme === "light" ? BlackHorizontalLogo : WhiteHorizontalLogo;

  useEffect(() => {
    if (csrfToken === undefined) {
      authService.requestCSRFToken().then((data) => data?.csrf_token && setCsrfToken(data.csrf_token));
    }
  }, [csrfToken]);

  useEffect(() => {
    if (email && password && csrfToken) {
      setStatus("authenticating");
      
      // Use the auto-auth endpoint through nginx with the correct path
      fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/admin-auto-auth/`, {
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
          company_name: companyname,
          is_telemetry_enabled,
          guard
        }),
      })
      .then(response => response.json())
      .then(data => {
        if (data.error) {
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
        } else if (data.redirect_url) {
          // Redirect to the provided URL
          window.location.href = data.redirect_url;
        }
      })
      .catch(err => {
        console.error('Error during authentication:', err);
        setError('Error during authentication: ' + err.message);
        setStatus("error");
      });
    }
  }, [email, password, firstname, lastname, companyname, is_telemetry_enabled, guard, csrfToken, fetchCurrentUser, fetchInstanceAdmins]);

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