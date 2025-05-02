import { FC } from "react";
import Head from "next/head";

interface PageHeadProps {
  title: string;
}

export const PageHead: FC<PageHeadProps> = ({ title }) => {
  return (
    <Head>
      <title>{title}</title>
    </Head>
  );
}; 