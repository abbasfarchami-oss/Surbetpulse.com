import { createFileRoute, Navigate } from "@tanstack/react-router";
export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Account access — ArbRadar" }, { name: "description", content: "Access your ArbRadar account securely." },
    { property: "og:title", content: "Account access — ArbRadar" }, { property: "og:description", content: "Continue to secure ArbRadar sign-in." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <Navigate to="/login" replace />,
});