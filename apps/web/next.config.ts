import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@purpleiris/ui",
    "@purpleiris/shared-types",
    "@purpleiris/monad-indexer",
    "@purpleiris/iris-agent",
  ],
};

export default config;
