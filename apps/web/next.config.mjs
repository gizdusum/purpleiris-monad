/** @type {import('next').NextConfig} */
const config = {
  output: "standalone",
  transpilePackages: [
    "@purpleiris/ui",
    "@purpleiris/shared-types",
    "@purpleiris/monad-indexer",
    "@purpleiris/iris-agent",
    "react-markdown",
    "remark-gfm",
  ],
};

export default config;
