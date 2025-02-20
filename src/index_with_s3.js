export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      const key = url.pathname.slice(1);
      
      if (!request.method || !key) {
        return new Response("Invalid Request", { status: 400 });
      }
  
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 1000;
      const R2_TIMEOUT = 5000; // 5 second timeout for R2
  
      try {
        switch (request.method) {
          case "GET": {
            // First try R2
            let object;
            let useS3Fallback = false;
  
            // Try R2 with retries
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
              try {
                // Add timeout to R2 fetch
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('R2 timeout')), R2_TIMEOUT)
                );
                const r2Promise = env.TESTR2.get(key);
                
                object = await Promise.race([r2Promise, timeoutPromise]);
                
                if (object) break;
                
                if (attempt < MAX_RETRIES - 1) {
                  await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                }
              } catch (fetchError) {
                console.error(`R2 Attempt ${attempt + 1} failed:`, fetchError);
                if (attempt === MAX_RETRIES - 1) {
                  useS3Fallback = true;
                }
              }
            }
  
            // If R2 failed, try S3
            if (useS3Fallback || !object) {
              try {
                const s3Response = await fetch(`${env.S3_ENDPOINT}/${key}`, {
                  headers: {
                    'Authorization': `Bearer ${env.S3_AUTH_TOKEN}`,
                    // Add any other required S3 headers
                  }
                });
  
                if (!s3Response.ok) {
                  throw new Error(`S3 responded with ${s3Response.status}`);
                }
  
                // Create headers for S3 response
                const headers = new Headers();
                const contentType = getContentTypeFromKey(key);
                headers.set("Content-Type", contentType);
                headers.set("X-Content-Type-Options", "nosniff");
                headers.set(
                  "Content-Security-Policy",
                  "default-src 'none'; img-src 'self'"
                );
                headers.set(
                  "Cache-Control",
                  "public, max-age=86400, stale-while-revalidate=86400"
                );
                headers.set("Vary", "Accept-Encoding");
                headers.set("X-Served-By", "S3-Fallback");
  
                return new Response(s3Response.body, { headers });
              } catch (s3Error) {
                console.error("S3 fallback failed:", s3Error);
                return new Response("Object Not Found", {
                  status: 404,
                  headers: { "Content-Type": "text/plain" }
                });
              }
            }
  
            // If we have an R2 object, serve it
            if (object) {
              const headers = new Headers();
              object.writeHttpMetadata(headers);
              headers.set("etag", object.httpEtag);
              headers.set("Content-Type", getContentTypeFromKey(key));
              headers.set("X-Content-Type-Options", "nosniff");
              headers.set(
                "Content-Security-Policy",
                "default-src 'none'; img-src 'self'"
              );
              headers.set(
                "Cache-Control",
                "public, max-age=86400, stale-while-revalidate=86400"
              );
              headers.set("Vary", "Accept-Encoding");
              headers.set("X-Served-By", "R2");
  
              return new Response(object.body, { headers });
            }
  
            return new Response("Object Not Found", {
              status: 404,
              headers: { "Content-Type": "text/plain" }
            });
          }
          default: {
            return new Response("Method Not Allowed", {
              status: 405,
              headers: {
                "Allow": "GET",
                "Content-Type": "text/plain"
              }
            });
          }
        }
      } catch (error) {
        console.error("Error handling request:", error);
        return new Response("Internal Server Error", {
          status: 500,
          headers: { "Content-Type": "text/plain" }
        });
      }
    }
  };
  
  function getContentTypeFromKey(key) {
    const extensions = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp"
    };
    const ext = key.split(".").pop()?.toLowerCase() || "";
    return extensions[ext] || "application/octet-stream";
  }