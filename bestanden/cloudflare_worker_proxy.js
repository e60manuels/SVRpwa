addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

// Helper to allow CORS
function handleOptions(request) {
  const headers = request.headers
  const origin = headers.get('Origin') || '' // Get the actual origin, or empty string

  // For requests with credentials, Access-Control-Allow-Origin cannot be '*' 
  // We must reflect the origin sent by the client.
  const allowOrigin = origin ? origin : 'https://e60manuels.github.io'; // Fallback to PWA origin if no origin header (should not happen for CORS) 
  
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-Requested-With, X-SVR-Session', // Added X-SVR-Session
      'Access-Control-Allow-Credentials': 'true',
    }
  })
}

// Helper to transform Set-Cookie headers for PWA compatibility
function transformSetCookieHeader(setCookieHeader, workerDomain) {
  let parts = setCookieHeader.split(';');
  let newParts = [];
  let hasSameSite = false;
  let hasPath = false;
  let hasDomain = false;

  for (let part of parts) {
    part = part.trim();
    if (part.toLowerCase().startsWith('domain=')) {
      newParts.push(`Domain=${workerDomain}`);
      hasDomain = true;
    } else if (part.toLowerCase().startsWith('samesite=')) {
      newParts.push('SameSite=None');
      hasSameSite = true;
    } else if (part.toLowerCase().startsWith('path=')) {
      newParts.push('Path=/');
      hasPath = true;
    } else {
      newParts.push(part);
    }
  }

  if (!hasDomain) {
    newParts.push(`Domain=${workerDomain}`);
  }
  if (!hasPath) {
    newParts.push('Path=/');
  }
  if (!hasSameSite) {
    newParts.push('SameSite=None');
  }
  if (!setCookieHeader.toLowerCase().includes('secure')) {
    newParts.push('Secure');
  }

  return newParts.join('; ');
}

async function handleRequest(request) {
  // Add unique ID for tracing requests
  const requestId = Math.random().toString(36).substring(2, 8);
  console.log(`[${requestId}] Incoming request: ${request.method} ${request.url}`);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    console.log(`[${requestId}] Handling OPTIONS preflight for ${request.url}`);
    return handleOptions(request)
  }

  const url = new URL(request.url)
  const headers = new Headers(request.headers)

  // Determine Access-Control-Allow-Origin for the response
  const requestOrigin = headers.get('Origin') || '';
  const allowOrigin = requestOrigin ? requestOrigin : 'https://e60manuels.github.io'; // Fallback to PWA origin

  // Default CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-Requested-With, X-SVR-Session', // Added X-SVR-Session
    'Access-Control-Allow-Credentials': 'true',
  }

  try {
    // 1. Root check (Health check)
    if (url.pathname === '/' || url.pathname === '') {
      console.log(`[${requestId}] Health check successful.`);
      return new Response("SVR Proxy Worker is Running correctly.\nUse /login for authentication or /api/... for data.", { // Corrected newline escape
        status: 200,
        headers: corsHeaders
      })
    }

    // 2. LOGIN ROUTE
    if (url.pathname === '/login' && request.method === 'POST') {
      console.log(`[${requestId}] Handling /login POST request from PWA.`);
      let data
      try {
        data = await request.json() // This is fine for POST, it expects JSON
      } catch(e) {
        console.error(`[${requestId}] Error parsing JSON from PWA for /login: ${e.message}`);
        return new Response(JSON.stringify({error: "Invalid JSON body provided to /login"}), {status: 400, headers: corsHeaders})
      }
      console.log(`[${requestId}] Login data received: email=${data.email}, password_length=${data.password.length}`);
      console.log(`[${requestId}] PWA Cookie header for login (if any): ${headers.get('Cookie')}`);


      // Convert JSON to URL-encoded form data for SVR
      const formData = new URLSearchParams()
      formData.append('email', data.email)
      formData.append('password', data.password)

      console.log(`[${requestId}] Sending login POST to svr.nl/check_password.`);

      // POST to SVR
      const loginResponse = await fetch('https://svr.nl/check_password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://svr.nl',
          'Referer': 'https://svr.nl/login',
          'X-Requested-With': 'XMLHttpRequest',
          // NO COOKIE FROM PWA YET FOR LOGIN, SO WE DON'T FORWARD ONE HERE
        },
        body: formData.toString(),
        redirect: 'manual'
      })
      console.log(`[${requestId}] Received login response status from SVR: ${loginResponse.status}`);
      
      // LOG ALL RESPONSE HEADERS FROM SVR.NL
      console.log(`[${requestId}] SVR login response headers:`);
      for (const [key, value] of loginResponse.headers.entries()) {
          console.log(`[${requestId}]   ${key}: ${value}`);
      }

      // Get response body
      const loginResponseBody = await loginResponse.clone().text()
      console.log(`[${requestId}] SVR login response body (first 200 chars): ${loginResponseBody.substring(0, 200)}`);
      
      // Try to parse JSON
      let jsonBody
      let sessionCookieValue = null;
      try {
        jsonBody = JSON.parse(loginResponseBody)
        console.log(`[${requestId}] SVR login response parsed as JSON.`);
      } catch (e) {
        // SVR might return HTML on error
        jsonBody = { message: "Non-JSON response from SVR", preview: loginResponseBody.substring(0, 100) }
        console.log(`[${requestId}] SVR login response was NOT JSON.`);
      }

      // Extract session cookie value if present
      for (const [key, value] of loginResponse.headers.entries()) {
        if (key.toLowerCase() === 'set-cookie') {
          const match = value.match(/session=([^;]+)/);
          if (match && match[1]) {
            sessionCookieValue = match[1];
            console.log(`[${requestId}] Extracted session cookie value: ${sessionCookieValue.substring(0, 20)}...`);
            break; 
          }
        }
      }

      // Add session cookie value to the JSON response for the PWA
      if (sessionCookieValue) {
        jsonBody.session_id = sessionCookieValue;
      }
      
      // Construct response
      const response = new Response(JSON.stringify(jsonBody), {
        status: loginResponse.status,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      })

      // Forward all Set-Cookie headers from SVR to the PWA
      const workerDomain = new URL(request.url).hostname; // Get the worker's hostname
      for (const [key, value] of loginResponse.headers.entries()) {
        if (key.toLowerCase() === 'set-cookie') {
          const transformedCookie = transformSetCookieHeader(value, workerDomain);
          response.headers.append('Set-Cookie', transformedCookie);
          console.log(`[${requestId}] Transformed and forwarded Set-Cookie from SVR to PWA: ${transformedCookie.substring(0, 50)}...`);
        }
      }
      console.log(`[${requestId}] Login response sent to PWA with status ${response.status}.`);

      return response
    }

    // 3. PROXY NOMINATIM REQUESTS
    // Requests for nominatim.openstreetmap.org will be rewritten to a path like /nominatim.openstreetmap.org/...
    if (url.pathname.startsWith('/nominatim.openstreetmap.org')) {
      // Reconstruct the original Nominatim URL
      const nominatimOriginalPath = url.pathname.substring('/nominatim.openstreetmap.org'.length);
      const nominatimTargetUrl = `https://nominatim.openstreetmap.org${nominatimOriginalPath}${url.search}`;
      console.log(`[${requestId}] Proxying Nominatim request for ${nominatimTargetUrl}`);

      const nominatimHeaders = new Headers(request.headers);
      // Nominatim usually requires a User-Agent header for non-browser requests
      // Using a common desktop browser User-Agent
      nominatimHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36');
      // Set a generic Referer, or delete it if it causes issues. Best to use PWA's actual origin.
      nominatimHeaders.set('Referer', allowOrigin); // Use the PWA's origin as Referer
      
      // Ensure we don't send PWA cookies to Nominatim
      nominatimHeaders.delete('Cookie');

      const nominatimResponse = await fetch(nominatimTargetUrl, {
        method: request.method,
        headers: nominatimHeaders,
        redirect: 'follow' // Nominatim might redirect, let it follow
      });

      // Log the Nominatim response body if it's not successful
      if (!nominatimResponse.ok) {
        const errorText = await nominatimResponse.clone().text();
        console.error(`[${requestId}] Nominatim proxy failed with status ${nominatimResponse.status}. Response: ${errorText.substring(0, 200)}`);
        // Return a JSON error from the Worker
        return new Response(JSON.stringify({ 
          error: "Nominatim Proxy Error", 
          details: `Nominatim returned status ${nominatimResponse.status}`,
          nominatimResponse: errorText.substring(0, 200)
        }), {
          status: 502, // Bad Gateway
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }


      // Prepare response headers, including CORS
      const nominatimNewHeaders = new Headers(nominatimResponse.headers);
      Object.keys(corsHeaders).forEach(key => nominatimNewHeaders.set(key, corsHeaders[key]));
      
      // Nominatim typically returns JSON, but ensure content-type is correct and remove security headers
      nominatimNewHeaders.set('Content-Type', 'application/json; charset=utf-8');
      nominatimNewHeaders.delete('Content-Security-Policy');
      nominatimNewHeaders.delete('X-Frame-Options');

      console.log(`[${requestId}] Proxied Nominatim response status: ${nominatimResponse.status}`);
      return new Response(nominatimResponse.body, {
        status: nominatimResponse.status,
        statusText: nominatimResponse.statusText,
        headers: nominatimNewHeaders
      });
    }


    // 4. PROXY SVR.NL REQUESTS (Simplified)
    let targetPath = url.pathname;
    let svrHostname = 'https://www.svr.nl';

    // No special path manipulation here. The PWA's fetchWithRetry already correctly
    // transforms www.svr.nl API paths to /api/* when needed, and direct SVR object
    // page navigation is now /object/*
    // The worker should simply forward its incoming path directly to svr.nl.
    const targetUrl = `${svrHostname}${targetPath}${url.search}`;
    console.log(`[${requestId}] Proxying SVR content: ${targetUrl}`);
    console.log(`[${requestId}] PWA Cookie header for proxied request: ${headers.get('Cookie')}`); // Log PWA's cookie header


    // Debug header
    corsHeaders['X-Debug-Target-Url'] = targetUrl

    // Filter headers to forward
    const allowedHeaders = ['accept', 'content-type', 'cookie', 'user-agent', 'x-requested-with', 'accept-language', 'x-svr-session'] // Add custom header
    const proxyHeaders = new Headers()
    let pwaCookieHeader = headers.get('Cookie'); // Keep original PWA cookie header for logging
    let customSessionHeader = headers.get('X-SVR-Session'); // Get custom session header

    for (const [key, value] of headers) {
      if (allowedHeaders.includes(key.toLowerCase())) {
        proxyHeaders.set(key, value)
      }
    }
    
    // Override or set the 'Cookie' header for svr.nl if a custom session is provided
    if (customSessionHeader) {
      proxyHeaders.set('Cookie', `session=${customSessionHeader}`);
      console.log(`[${requestId}] Constructed Cookie header for SVR from X-SVR-Session: session=${customSessionHeader.substring(0, 20)}...`);
    } else {
      console.log(`[${requestId}] No custom X-SVR-Session header found. Using PWA Cookie header: ${pwaCookieHeader}`);
      // Fallback to original PWA cookie header if no custom session, but it will likely be null
      if (pwaCookieHeader) {
        proxyHeaders.set('Cookie', pwaCookieHeader);
      }
    }
    if (!proxyHeaders.has('user-agent')) {
      proxyHeaders.set('user-agent', 'SVR-PWA-Proxy/1.0')
    }
    proxyHeaders.set('Origin', 'https://www.svr.nl') // Ensure origin is svr.nl for requests to svr.nl
    proxyHeaders.set('Referer', 'https://www.svr.nl/') // Ensure referer is svr.nl for requests to svr.nl

    const fetchOptions = {
      method: request.method,
      headers: proxyHeaders,
      redirect: 'follow' // Allow fetch to automatically follow redirects
    };

    // Conditionally include body for methods that support it
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      fetchOptions.body = request.body;
      console.log(`[${requestId}] Forwarding request body for ${request.method} request.`);
    }

    const svrResponse = await fetch(targetUrl, fetchOptions)
    console.log(`[${requestId}] Received SVR response status for ${targetUrl}: ${svrResponse.status}`);

    // LOG ALL RESPONSE HEADERS FROM SVR.NL
    console.log(`[${requestId}] SVR proxied response headers:`);
    for (const [key, value] of svrResponse.headers.entries()) {
        console.log(`[${requestId}]   ${key}: ${value}`);
    }


    // Prepare response headers
    const newHeaders = new Headers(svrResponse.headers)
    
    // Apply CORS
    Object.keys(corsHeaders).forEach(key => newHeaders.set(key, corsHeaders[key]))
    
    // Clean up security headers that might block embedding
    newHeaders.delete('Content-Security-Policy')
    newHeaders.delete('X-Frame-Options')

    // Forward all Set-Cookie headers from SVR to the PWA
    const workerDomain = new URL(request.url).hostname; // Get the worker's hostname
    for (const [key, value] of svrResponse.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        const transformedCookie = transformSetCookieHeader(value, workerDomain);
        newHeaders.append('Set-Cookie', transformedCookie);
        console.log(`[${requestId}] Transformed and forwarded Set-Cookie from SVR to PWA (proxied): ${transformedCookie}`);
      }
    }
    console.log(`[${requestId}] Proxied response sent to PWA with status ${svrResponse.status}.`);

    return new Response(svrResponse.body, {
      status: svrResponse.status,
      statusText: svrResponse.statusText,
      headers: newHeaders
    })

  } catch (err) {
    console.error(`[${requestId}] Uncaught Proxy Error: ${err.message}`, err.stack);
    return new Response(JSON.stringify({ 
      error: "Proxy Error", 
      details: err.toString(),
      stack: err.stack 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
}