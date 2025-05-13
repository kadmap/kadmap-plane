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
import { useRouter } from "next/navigation";


const authService = new AuthService();

const AutoAuthPage = observer(() => {
  const router = useRouter();
  const searchParams = useSearchParams();
  let email;
  let firstName;
  let lastName;
  let password;
  let company_name = "";
  let is_telemetry_enabled = false;
  const guard = searchParams.get("guard");
  const kadmap_api_url = searchParams.get("kadmap_api_url");
  const vfs_base_url = searchParams.get("vfs_base_url");
  const workspace_id = searchParams.get("workspace_id");
  const user_id = searchParams.get("user_id");
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
    let timeoutId;
    timeoutId = setTimeout(() => {
      console.log("Page has been idle for too long, reloading...");
      setStatus("reloading");
      setTimeout(() => {
        router.refresh();
      }, 1500); // Give user 1.5 seconds to see the reload message
    }, 5000);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    // Call the kadmap api to get the user's details
    if (kadmap_api_url && user_id && csrfToken) {
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

            setStatus("authenticating");
            
            // Use the admin auto-auth endpoint through nginx with the correct path
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
                first_name: firstName,
                last_name: lastName,
                company_name,
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
                  firstName,
                  lastName,
                  error: data.error,
                  message: data.message
                });
                setError(data.message);
                setStatus("error");
              } else if (data.redirect_url) {
                // Redirect to the provided URL
                router.push(data.redirect_url);
              }
            })
            .catch(err => {
              console.error('Error during authentication:', err);
              setError('Error during authentication: ' + err.message);
              setStatus("error");
            });
          }
        })
        .catch(err => {
          console.error('Error fetching user details:', err);
          setError('Error fetching user details: ' + err.message);
          setStatus("error");
        });
    }
  }, [kadmap_api_url, user_id, guard, csrfToken, fetchCurrentUser, fetchInstanceAdmins]);

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