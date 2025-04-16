"use client";

import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { PageHead } from "@/components/core";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import Image from "next/image";
// helpers
import { EPageTypes } from "@/helpers/authentication.helper";
// wrappers
import { AuthenticationWrapper } from "@/lib/wrappers";
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
  const email = searchParams.get("email");
  const password = searchParams.get("password");
  const firstname = searchParams.get("firstname");
  const lastname = searchParams.get("lastname");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("checking");
  const { resolvedTheme } = useTheme();

  const logo = resolvedTheme === "light" ? BlackHorizontalLogo : WhiteHorizontalLogo;

  useEffect(() => {
    if (email && password) {
      setStatus("authenticating");
      
      // Use the auto-auth endpoint directly
      fetch('/auth/auto-auth/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          password,
          first_name: firstname,
          last_name: lastname 
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
        } else if (data.authenticated || data.created) {
          // User was authenticated or created successfully, redirect to home
          window.location.href = '/';
        } else {
          setError('Unknown error occurred during authentication');
          setStatus("error");
        }
      })
      .catch(err => {
        console.error('Error during authentication:', err);
        setError('Error during authentication: ' + err.message);
        setStatus("error");
      });
    }
  }, [email, password, firstname, lastname]);

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
    // <AuthenticationWrapper pageType={EPageTypes.NON_AUTHENTICATED}>
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
    // </AuthenticationWrapper>
  );
});

export default AutoAuthPage; 