"use client";

import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { PageHead } from "@/components/core";
// helpers
import { EPageTypes } from "@/helpers/authentication.helper";
// wrappers
import { AuthenticationWrapper } from "@/lib/wrappers";

const AutoAuthPage = observer(() => {
  const { t } = useTranslation();

  return (
    <AuthenticationWrapper pageType={EPageTypes.NON_AUTHENTICATED}>
      <div className="h-screen w-full flex flex-col items-center justify-center">
        <PageHead title="Auto Auth" />
        <h1 className="text-3xl font-bold mb-4">Auto Auth</h1>
        <p className="text-lg text-gray-600">We are signing you in...</p>
      </div>
    </AuthenticationWrapper>
  );
});

export default AutoAuthPage; 