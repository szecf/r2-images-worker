export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1); // Extract key from URL path

    switch (request.method) {
      // case "PUT":
      //   // PUT request: Store the image in KV store
      //   await env.IMAGES.put(key, request.body);
      //   return new Response(`Put ${key} successfully!`, { status: 201 });

      case "GET":
        // GET request: Retrieve the image from KV store
        const object = await env.IMAGES.get(key);

        if (object === null) {
          // Image not found in KV store
          return new Response("Object Not Found", { status: 404 });
        }

        // Image found, prepare response headers
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);

        // Return the image with appropriate headers
        return new Response(object.body, { headers });

      // case "DELETE":
      //   // DELETE request: Remove the image from KV store
      //   await env.IMAGES.delete(key);
      //   return new Response("Deleted!", { status: 200 });

      default:
        // Unsupported method
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            Allow: "GET",
          },
        });
    }
  },
};
