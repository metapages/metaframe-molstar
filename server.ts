import { serveDir } from "jsr:@std/http@1.0.21/file-server";

const port = parseInt(Deno.env.get("PORT") || "3000");
// Define the directory to serve files from (e.g., a "public" folder)
const STATIC_FILES_ROOT = "./dist";

// Start the Deno server
Deno.serve(
  async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Requested-With",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Serve files from the specified root directory
    // The 'urlRoot' option can be used to specify a different path prefix in the URL
    const response = await serveDir(req, {
      fsRoot: STATIC_FILES_ROOT,
      urlRoot: "",
    });

    // Add CORS headers to all responses
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );

    return response;
  },
  { port }
); // Listen on port 8000

console.log(
  `Static file server running on http://localhost:${port} serving from ${STATIC_FILES_ROOT}`
);
