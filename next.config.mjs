/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  async redirects() {
    // The graph view was replaced by the solar system.
    return [{ source: "/graph", destination: "/system", permanent: true }];
  },
};
