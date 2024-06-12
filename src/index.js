export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1); // Extract key from URL path

    try {
      switch (request.method) {
        case "GET":
          // GET request: Retrieve the image from KV store
          const object = await env.IMAGES.get(key);

          if (!object) {
            // Image not found in KV store
            return new Response("Object Not Found", { status: 404 });
          }

          // Image found, prepare response headers
          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set("etag", object.httpEtag);

          // Set Content-Type based on file extension
          const contentType = getContentTypeFromKey(key);
          headers.set("Content-Type", contentType);

          // Enable CORS
          headers.set("Access-Control-Allow-Origin", "*");

          // Set Cache-Control for client-side caching
          headers.set("Cache-Control", "public, max-age=86400"); // 24 hours

          // Return the image with appropriate headers
          return new Response(object.body, { headers });

        default:
          // Unsupported method
          return new Response("Method Not Allowed", {
            status: 405,
            headers: {
              Allow: "GET",
            },
          });
      }
    } catch (error) {
      console.error("Error handling request:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};

// Utility function to determine Content-Type based on file extension
function getContentTypeFromKey(key) {
  const extensions = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    // Add more MIME types as needed
  };

  const ext = key.split(".").pop().toLowerCase();
  return extensions[ext] || "application/octet-stream";
}
