import { useEffect } from "react";

import LoadingScreen from "./LoadingScreen";

interface ExternalRedirectProps {
  to: string;
}

export const ExternalRedirect = ({ to }: ExternalRedirectProps) => {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return <LoadingScreen />;
};
