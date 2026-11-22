import type { NextConfig } from "next";

const isProd = process.env.DEPLOY_ENV === "production";
// must match the repository name in the site address
const repoName = "Fate-Domination-Card-Maker-Rus";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? `/${repoName}` : "",
  assetPrefix: isProd ? `/${repoName}/` : "",
};

export default nextConfig;
