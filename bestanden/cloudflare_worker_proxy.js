addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  const url = new URL(request.url);
  
  // Haal path en query params van de worker URL
  const targetPath = url.pathname + url.search;
  const targetUrl = `https://www.svr.nl${targetPath}`;

  try {
    const apiResponse = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Accept': 'application/json',
      },
      redirect: 'follow'
    });

    const responseHeaders = new Headers(apiResponse.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(apiResponse.body, {
      status: apiResponse.status,
      headers: responseHeaders
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}