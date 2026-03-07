package com.example.svrcampings_v31.dev

import android.animation.ValueAnimator
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Typeface
import android.location.Geocoder
import android.location.Location
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.animation.doOnEnd
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

// Data class to hold campsite information including the calculated distance
data class Camping(
        val id: String,
        val name: String,
        val latitude: Double,
        val longitude: Double,
        val adres: String,
        val city: String,
        val description: String,
        val imageUrl: String,
        var distance: Float = 0.0f // Distance in meters from the search location
)

class MainActivity : AppCompatActivity() {

    private val TAG = "SVRWebView"
    private var isJustLoggedIn = false
    private var lastSearchQuery: String? = null
    private var fullCampsiteJson: String? = null
    private var backPressedTime: Long = 0
    private var savedTop10Campsites: List<Camping>? = null
    private lateinit var onBackPressedCallback: OnBackPressedCallback
    private var userAgent: String? = null
    private var forceRestoreState = false
    private var isNavigatingHome = false
    private var isLoggingOut = false
    private var shouldTriggerPreload = true
    private var isOverrideScriptInjected = false
    private var lastKnownNavBarHeight: Int = 0

    private var menuPageSlugs: List<String> = emptyList()

    private val isContentReady = AtomicBoolean(false)

    // Track the state of the filter overlay
    private var isFilterOverlayOpen = false

    private var isFirstLoad = true
    private var isLoggingIn = false

    private lateinit var searchManager: SearchManager

    private fun checkLoginStatus() {
        val cookieManager = CookieManager.getInstance()
        val cookies1 = cookieManager.getCookie("https://svr.nl") ?: ""
        val cookies2 = cookieManager.getCookie("https://www.svr.nl") ?: ""
        val allCookies = "$cookies1; $cookies2"

        Log.d(TAG, "Checking cookies for session. Found: $allCookies")

        // SVR gebruikt 'session=' in plaats van PHPSESSID
        if (!allCookies.contains("session=") && !allCookies.contains("PHPSESSID=")) {
            Log.d(TAG, "No session cookie found, launching LoginActivity")
            isLoggingIn = true
            val intent = Intent(this, LoginActivity::class.java)
            startActivity(intent)
        } else {
            Log.d(TAG, "Session found, preparing Headless UI")
            isLoggingIn = false
            loadHeadlessUi() 
        }
    }

    private fun loadHeadlessUi() {
        val webView: WebView = findViewById(R.id.webView)
        
        // Alleen laden als het de eerste keer is of als er nog niets geladen is
        if (!isFirstLoad) {
            webView.visibility = android.view.View.VISIBLE
            return
        }

        try {
            val inputStream = assets.open("local_ui.html")
            val htmlContent = inputStream.bufferedReader().use { it.readText() }

            webView.loadDataWithBaseURL(
                "https://svr.nl/app-view", 
                htmlContent,
                "text/html",
                "UTF-8",
                null
            )
            Log.d(TAG, "Loaded local_ui.html with fake Origin")
            isFirstLoad = false
            webView.visibility = android.view.View.VISIBLE

        } catch (e: Exception) {
            Log.e(TAG, "Error loading HTML", e)
        }
    }

    private fun scrubFilterCookies() {
        val cookieManager = CookieManager.getInstance()
        val domains = arrayOf("https://svr.nl", "svr.nl", ".svr.nl", "www.svr.nl", "https://www.svr.nl")
        Log.d(TAG, "Scrubbing filter cookies from database...")
        for (domain in domains) {
            cookieManager.setCookie(domain, "filters=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/")
            cookieManager.setCookie(domain, "config=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/")
        }
        cookieManager.flush()
    }

    private fun setupWebViewSettings(webView: WebView) {

        ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())

            lastKnownNavBarHeight = systemBars.bottom

            insets
        }

        webView.settings.javaScriptEnabled = true

        webView.settings.domStorageEnabled = true

        webView.settings.loadWithOverviewMode = true

        webView.settings.useWideViewPort = true

        webView.settings.setDefaultTextEncodingName("utf-8")

        WebView.setWebContentsDebuggingEnabled(true)

        userAgent = webView.settings.userAgentString

        webView.addJavascriptInterface(WebAppInterface(webView), "Android")
    }

    private fun setupWebViewClients(webView: WebView) {

        // Set a custom WebViewClient to inject JavaScript and handle errors

        webView.webViewClient =
                object : WebViewClient() {

                    override fun shouldOverrideUrlLoading(
                            view: WebView?,
                            request: WebResourceRequest?
                    ): Boolean {

                        val url = request?.url?.toString() ?: return false

                        // Detect logout to handle redirection
                        if (url.contains("logout")) {
                            Log.d(TAG, "Logout detected. Clearing session data and setting flag.")
                            isLoggingOut = true
                            fullCampsiteJson = null // Clear old data
                        }

                        // Open svr.nl in external browser

                        if (url == "https://www.svr.nl/") {

                            val browserIntent = Intent(Intent.ACTION_VIEW, request?.url)

                            startActivity(browserIntent)

                            return true
                        }
                        return false
                    }

                    override fun shouldInterceptRequest(
                            view: WebView?,
                            request: WebResourceRequest?
                    ): WebResourceResponse? {

                        val url =
                                request?.url?.toString()
                                        ?: return super.shouldInterceptRequest(view, request)

                        if (url.endsWith("local_style.css")) {
                            return try {
                                WebResourceResponse("text/css", "UTF-8", assets.open("local_style.css"))
                            } catch (e: Exception) {
                                Log.e(TAG, "Failed to load local_style.css", e)
                                null
                            }
                        }
                        if (url.endsWith("local_app.js")) {
                            return try {
                                WebResourceResponse("text/javascript", "UTF-8", assets.open("local_app.js"))
                            } catch (e: Exception) {
                                Log.e(TAG, "Failed to load local_app.js", e)
                                null
                            }
                        }

                        // Log SVR non-HTML requests for debugging, if needed

                        if (url.contains("svr.nl") && !url.endsWith(".html")) {

                            Log.d(TAG, "Intercepting SVR non-HTML request: $url")
                        }
                        return super.shouldInterceptRequest(view, request)
                    }

                    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {

                        super.onPageStarted(view, url, favicon)

                        // Reset the injection flag for each new page load

                        isOverrideScriptInjected = false
                    }

                    override fun onPageFinished(view: WebView?, url: String?) {

                        super.onPageFinished(view, url)
                        Log.d(TAG, "Page finished loading: $url")

                        // BLOCK INJECTIONS FOR HEADLESS UI
                        if (url == "https://svr.nl/app-view") {
                            Log.d(TAG, "Headless UI loaded. Skipping legacy script injections.")
                            isContentReady.set(true)
                            return
                        }

                        // NEW: Clear campsite data if we navigate away from the objects page
                        if (url != null && !url.contains("svr.nl/objects")) {
                            Log.d(
                                    TAG,
                                    "Navigated away from objects page. Clearing fullCampsiteJson."
                            )
                            fullCampsiteJson = null
                        }

                        // Handle post-logout redirection
                        if (isLoggingOut &&
                                        (url?.endsWith("svr.nl/") == true ||
                                                url?.endsWith("svr.nl/home") == true)
                        ) {
                            Log.d(TAG, "Post-logout homepage detected. Redirecting to /login.")
                            isLoggingOut = false // Reset the flag
                            view?.loadUrl("https://svr.nl/login")
                            return // Stop further script injection on this intermediate page
                        }

                        // Ensure the back press callback is enabled

                        onBackPressedCallback.isEnabled = true

                        // Inject page-specific scripts and handle logic
                        injectPageSpecificScripts(view, url)

                        // Dismiss splash screen once any SVR page has finished loading
                        if (url?.contains("svr.nl") == true) {
                            isContentReady.set(true)
                        }
                    }

                    override fun onReceivedError(
                            view: WebView?,
                            request: WebResourceRequest?,
                            error: WebResourceError?
                    ) {

                        super.onReceivedError(view, request, error)

                        Log.e(
                                TAG,
                                "WebView Error: ${error?.description} (Code: ${error?.errorCode})"
                        )
                    }
                }

        // Set a WebChromeClient to handle alerts, prompts, and console messages

        webView.webChromeClient =
                object : WebChromeClient() {

                    override fun onGeolocationPermissionsShowPrompt(
                        origin: String?,
                        callback: android.webkit.GeolocationPermissions.Callback?
                    ) {
                        // Toestemming geven aan de WebView context
                        callback?.invoke(origin, true, false)
                    }

                    override fun onProgressChanged(view: WebView?, newProgress: Int) {

                        super.onProgressChanged(view, newProgress)

                        // BLOCK INJECTIONS FOR HEADLESS UI
                        if (view?.url == "https://svr.nl/app-view") {
                            return
                        }

                        if (view?.url?.contains("svr.nl") == true && !isOverrideScriptInjected) {

                            try {

                                val inputStream = assets.open("override_script.js")

                                val script = inputStream.bufferedReader().use { it.readText() }

                                view.evaluateJavascript(script, null)

                                isOverrideScriptInjected = true

                                Log.d(TAG, "Injected override_script.js on ${view.url}")
                            } catch (e: Exception) {

                                Log.e(TAG, "Error injecting override_script.js", e)
                            }
                        }

                        // Inject CSS as early as possible to prevent flicker

                        val hideLoginScript =
                                """

                        (function() {

                            if (document.head && !document.getElementById('hide-login-style')) {

                                var style = document.createElement('style');

                                style.id = 'hide-login-style';

                                style.type = 'text/css';

                                style.innerHTML = ':is(div, span):has(> small a[href*="login"], > small a[href*="logout"]) { display: none !important; } #view_map, #view_tegels { opacity: 0; transition: opacity 0.5s ease-in-out; }';

                                document.head.appendChild(style);

                            }

                        })();

                    """.trimIndent()

                        view?.evaluateJavascript(hideLoginScript, null)
                    }

                    override fun onConsoleMessage(
                            message: String?,
                            lineNumber: Int,
                            sourceID: String?
                    ) {

                        Log.d(TAG, "Console: $message -- From line $lineNumber of $sourceID")
                    }
                }
    }

    private fun loadMenuSlugsFromAssets() {

        try {

            val inputStream = assets.open("menu_slugs.json")

            val jsonString = inputStream.bufferedReader().use { it.readText() }

            val jsonArray = JSONArray(jsonString)

            val slugs = mutableListOf<String>()

            for (i in 0 until jsonArray.length()) {

                slugs.add(jsonArray.getString(i))
            }

            menuPageSlugs = slugs

            Log.d(
                    TAG,
                    "Successfully loaded ".plus(menuPageSlugs.size).plus(" menu slugs from assets.")
            )
        } catch (e: Exception) {

            Log.e(TAG, "Error loading menu_slugs.json from assets", e)

            // Keep the list empty as a fallback

            menuPageSlugs = emptyList()
        }
    }

    /**
     *
     * Interface to allow JavaScript to call Kotlin code.
     */
    inner class WebAppInterface(private val webView: WebView) {

        @JavascriptInterface
        fun processSearch(query: String) {

            Log.d(TAG, "JavaScript initiated search for: '$query'")

            lastSearchQuery = query // Store the last search query

            shouldTriggerPreload = true // Set the flag for a new search

            if (fullCampsiteJson == null) {

                Log.e(TAG, "Full campsite JSON not available yet. Cannot process search.")

                // NEW: We might need to trigger the fetch override here if the page is already
                // loaded

                // For now, we just log. The override should trigger on page load anyway.

                return
            }

            // Perform Geocoding on a background thread

            reRunLastSearch()
        }

        @JavascriptInterface
        fun processCampsiteJson(json: String) {

            Log.d(TAG, "Received campsite JSON from JS override. Length: ${json.length}")

            // Immediately switch to the main thread

            runOnUiThread {
                try {

                    // ALWAYS store the received JSON. This is the master list.

                    fullCampsiteJson = json

                    val root = JSONObject(json)

                    val objects = root.getJSONArray("objects")

                    Log.d(TAG, "Total campsites received: ${objects.length()}")

                    val webView: WebView = findViewById(R.id.webView)

                    val currentUrl = webView.url ?: ""

                    // NEW, SIMPLER LOGIC:

                    // Condition 1: Is this the initial, huge load on the main objects page?

                    if (currentUrl.contains("svr.nl/objects") &&
                                    objects.length() > 1000 &&
                                    lastSearchQuery == null
                    ) {

                        Log.w(
                                TAG,
                                "Initial large dataset loaded (${objects.length()} campsites). Suppressing immediate display and running default Top 10 search instead."
                        )

                        initiateTop10Search() // Show the default view, not all 1303 markers.
                    }

                    // Condition 2: Is this a faulty reset? (A huge load AFTER a search has
                    // occurred)

                    else if (currentUrl.contains("svr.nl/objects") &&
                                    objects.length() > 1000 &&
                                    lastSearchQuery != null
                    ) {

                        Log.w(
                                TAG,
                                "Faulty reset detected! Received ${objects.length()} campsites. Forcing a clean search to recover."
                        )

                        reRunLastSearch() // Re-run the last good search.
                    }

                    // Condition 3: This is a normal, filtered load. Process it.

                    else {

                        Log.d(
                                TAG,
                                "Processing a normal dataset with ${objects.length()} campsites."
                        )

                        if (lastSearchQuery != null) {

                            reRunLastSearch()
                        } else {

                            // This case might not even be reachable anymore, but is a safe
                            // fallback.

                            initiateTop10Search()
                        }
                    }

                    // Optional: Save the data for debugging. Using a fixed filename to prevent storage bloat.

                    try {

                        val fileName = "campsite_data_latest.json"

                        val file = File(filesDir, fileName)

                        file.writeText(json)

                        Log.d(TAG, "Saved latest campsite JSON data to file: ${file.absolutePath}")
                    } catch (e: Exception) {

                        Log.e(TAG, "Error saving JSON to file: ${e.message}", e)
                    }
                } catch (e: JSONException) {

                    Log.e(TAG, "Error processing campsite JSON on main thread: ${e.message}", e)
                }
            }
        }

        @JavascriptInterface fun receiveDebugInfo(info: String) {}

        @JavascriptInterface
        fun openDetailInNewWebView(url: String) {

            Log.d(TAG, "JS Bridge: openDetailInNewWebView called with URL: $url")

            runOnUiThread {
                val intent = Intent(this@MainActivity, DetailWebViewActivity::class.java)

                intent.putExtra("url", "https://www.svr.nl" + url)

                startActivity(intent)
            }
        }

        @JavascriptInterface
        fun fetchAndShowInBottomSheet(url: String) {

            Log.d(TAG, "JS Bridge: fetchAndShowInBottomSheet called with URL: $url")

            Thread {
                        try {

                            val fullUrl = URL("https://www.svr.nl" + url)

                            val connection = fullUrl.openConnection() as HttpURLConnection

                            connection.connect()

                            val htmlContent =
                                    connection.inputStream.bufferedReader().use { it.readText() }

                            Log.d(
                                    TAG,
                                    "Successfully fetched HTML content (${htmlContent.length} chars)."
                            )

                            // Step 4: Show the bottom sheet with the fetched content

                            runOnUiThread {
                                val webView: WebView = findViewById(R.id.webView)

                                // Use Base64 encoding to safely pass the HTML string to JavaScript

                                val base64Html =
                                        Base64.encodeToString(
                                                htmlContent.toByteArray(Charsets.UTF_8),
                                                Base64.NO_WRAP
                                        )

                                val script = "showBottomSheet(atob('$base64Html'))"

                                webView.evaluateJavascript(script, null)

                                Log.d(TAG, "Called showBottomSheet via JS.")
                            }
                        } catch (e: Exception) {

                            Log.e(TAG, "Error fetching URL for BottomSheet", e)
                        }
                    }
                    .start()
        }

        // --- AANGEPAST: Functie voor preloading met WebView ---

        @JavascriptInterface
        fun preloadTopTenDetails(campsitesJson: String) {

            // Preloading is temporarily disabled for performance analysis.

            Log.d(TAG, "preloadTopTenDetails called, but preloading is currently disabled.")
        }

        @JavascriptInterface
        fun showDetailActivity(url: String) {

            Log.d(TAG, "showDetailActivity called for url: $url. Loading URL directly.")

            val intent =
                    Intent(this@MainActivity, DetailWebViewActivity::class.java).apply {
                        putExtra("url", url)
                    }

            startActivity(intent)
        }

        @JavascriptInterface
        fun navigateToHome() {

            runOnUiThread {
                val webView: WebView = findViewById(R.id.webView)

                val currentUrl = webView.url ?: ""

                // Check if we are already on the objects page

                if (currentUrl.contains("svr.nl/objects")) {

                    Log.d(
                            TAG,
                            "JS bridge: navigateToHome called while already on objects page. Doing nothing as requested."
                    )

                    // Do nothing, the menu will close automatically.

                } else {

                    Log.d(
                            TAG,
                            "JS bridge: navigateToHome called from another page. Setting flag and loading objects page."
                    )

                    isNavigatingHome = true

                    shouldTriggerPreload = false // Prevent preload on menu navigation

                    webView.loadUrl("https://svr.nl/objects")
                }
            }
        }

        @JavascriptInterface
        fun processSearchWithFilters(query: String, filtersJson: String) {

            Log.d(
                    TAG,
                    "JavaScript initiated search with filters for query: '$query', filters: $filtersJson"
            )

            lastSearchQuery = query // Store the last search query

            shouldTriggerPreload = true // Set the flag for a new search

            // Parse the filters JSON to extract facility IDs and other filter parameters
            var facilityIds: List<String>? = null // NEW: Declare outside try-catch
            var countryId: String? = null // NEW: Declare outside try-catch

            try {
                val filtersArray = JSONArray(filtersJson)
                val facilityFilterItems = mutableListOf<String>()
                var localCountryId: String? =
                        null // Temporary variable to hold countryId inside the loop

                Log.d(TAG, "Processing filters JSON array with ${filtersArray.length()} items")

                for (i in 0 until filtersArray.length()) {
                    val filterItem = filtersArray.getJSONObject(i)
                    val filterType = filterItem.optString("type")
                    val filterId = filterItem.optString("id")
                    val filterName =
                            filterItem.optString(
                                    "name"
                            ) // Adding this to see the name of the filter

                    Log.d(
                            TAG,
                            "Processing filter - type: $filterType, id: $filterId, name: $filterName"
                    )

                    // Type "2" is for facilities according to the JavaScript
                    if (filterType == "2" && filterId.isNotEmpty()) {
                        facilityFilterItems.add(filterId)
                        Log.d(TAG, "Added facility filter: $filterId")
                    } else if (filterType == "1" && filterId.isNotEmpty()) { // Country filter
                        localCountryId = filterId // Assign to local temporary variable
                        Log.d(TAG, "Added country filter: $localCountryId ($filterName)")
                    }
                }

                if (facilityFilterItems.isNotEmpty()) {
                    facilityIds = facilityFilterItems
                    Log.d(TAG, "Final list of facility IDs to be applied: $facilityIds")
                } else {
                    Log.d(TAG, "No facility IDs found in filters")
                }
                countryId = localCountryId // Assign to the outer scope countryId
            } catch (e: JSONException) {
                Log.e(TAG, "Error parsing filters JSON: ${e.message}")
            }

            if (fullCampsiteJson == null) {

                Log.e(
                        TAG,
                        "Full campsite JSON not available yet. Cannot process search with filters."
                )

                return
            }

            Log.d(TAG, "Calling reRunLastSearchWithFilters with facility IDs: $facilityIds")

            // Perform Geocoding on a background thread

            reRunLastSearchWithFilters(facilityIds, countryId)
        }

        @JavascriptInterface
        fun getSuggestions(query: String): String {
            Log.d("SearchManager", "getSuggestions called with query: '$query'")

            if (query.length < 3) {
                Log.d("SearchManager", "Query length < 3, returning empty array")
                return "[]"
            }

            // Using runBlocking to handle the suspend function synchronously
            // This is acceptable in this context but should be used carefully
            val suggestions = runBlocking { searchManager.suggestPlaces(query) }

            Log.d("SearchManager", "Found ${suggestions.size} suggestions for query '$query'")

            // Convert the list to JSON
            val jsonArray = org.json.JSONArray()
            suggestions.forEach { suggestion ->
                Log.d("SearchManager", "Adding suggestion: $suggestion")
                jsonArray.put(suggestion)
            }

            val result = jsonArray.toString()
            Log.d("SearchManager", "Returning JSON result: $result")
            return result
        }

        @JavascriptInterface
        fun getLocationCoordinates(selectedPlace: String): String {
            // Extract the location name by removing the province part in parentheses
            val locationName =
                    if (selectedPlace.contains(" (")) {
                        selectedPlace.substring(0, selectedPlace.indexOf(" ("))
                    } else {
                        selectedPlace
                    }

            // Try to get coordinates
            val coordinates = runBlocking { searchManager.getCoordinates(selectedPlace) }

            return if (coordinates != null) {
                val result = org.json.JSONObject()
                result.put("latitude", coordinates.first)
                result.put("longitude", coordinates.second)
                result.toString()
            } else {
                // Return an empty object if coordinates not found
                "{}"
            }
        }

        @JavascriptInterface
        fun setFilterOverlayState(isOpen: Boolean) {
            Log.d(TAG, "Filter overlay state changed to: $isOpen")
            this@MainActivity.isFilterOverlayOpen = isOpen
        }

        @JavascriptInterface
        fun getFilterOverlayState(): Boolean {
            return this@MainActivity.isFilterOverlayOpen
        }

        @JavascriptInterface
        fun openDetailActivity(url: String) {
            Log.d(TAG, "JS Bridge: openDetailActivity called with URL: $url")
            val intent = Intent(this@MainActivity, DetailWebViewActivity::class.java)
            // Zorg dat de URL compleet is (https://www.svr.nl...)
            val fullUrl = if (url.startsWith("http")) url else "https://www.svr.nl$url"
            intent.putExtra("url", fullUrl)
            startActivity(intent)
        }

        @JavascriptInterface
        fun onMarkersLoaded() {
            Log.d(TAG, "JS reported that markers have been loaded.")
        }

        @JavascriptInterface
        fun log(message: String) {
            Log.d("SVR_JS_CONSOLE", message)
        }

        @JavascriptInterface
        fun openNavigation(lat: Double, lng: Double, label: String) {
            Log.d(TAG, "JS Bridge: openNavigation called for $label at $lat,$lng")
            val uri = "geo:$lat,$lng?q=$lat,$lng($label)"
            val intent = Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(uri))
            try {
                startActivity(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Could not open navigation app", e)
            }
        }

        @JavascriptInterface
        fun applyFilters(filtersJson: String) {
            val cookieManager = CookieManager.getInstance()
            val domains = arrayOf("https://svr.nl", "svr.nl", ".svr.nl", "www.svr.nl", "https://www.svr.nl")
            Log.d(TAG, "Cleaning up old filter cookies via Bridge...")
            for (domain in domains) {
                cookieManager.setCookie(domain, "filters=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/")
                cookieManager.setCookie(domain, "config=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/")
            }
            cookieManager.flush()
        }
    }

    private fun initiateTop10Search() {

        Log.d(TAG, "Initiating a new Top 10 search (defaulting to 'Nederland').")

        lastSearchQuery = "Nederland" // Use a real location

        reRunLastSearch()
    }

    private fun reRunLastSearch() {

        if (lastSearchQuery == null) {

            return
        }

        // Voor de Geocoder maken we de zoekterm rijker als er een provincie bekend is.
        // "Soest (Utrecht)" wordt "Soest, Utrecht, Nederland".
        // Een kale "Nice" blijft gewoon "Nice".
        val geocodeQuery = if (lastSearchQuery!!.contains(" (")) {
            val city = lastSearchQuery!!.substringBefore(" (")
            val province = lastSearchQuery!!.substringAfter(" (").substringBefore(")")
            "$city, $province, Nederland"
        } else {
            lastSearchQuery!!
        }
        
        Log.d(TAG, "reRunLastSearch: Original: '$lastSearchQuery', Geocode query: '$geocodeQuery'")

        Thread {
                    try {

                        val geocoder = Geocoder(this@MainActivity)

                        val addresses = geocoder.getFromLocationName(geocodeQuery, 1)

                        runOnUiThread {
                            if (addresses != null && addresses.isNotEmpty()) {

                                val address = addresses[0]

                                val searchLocation =
                                        Location("").apply {
                                            latitude = address.latitude

                                            longitude = address.longitude
                                        }

                                calculateAndSortDistances(searchLocation)
                            }
                        }
                    } catch (e: Exception) {

                        Log.e(TAG, "Geocoder failed for query: $lastSearchQuery", e)
                    }
                }
                .start()
    }

    private fun reRunLastSearchWithFilters(facilityIds: List<String>?, countryId: String?) {

        Log.d(TAG, "reRunLastSearchWithFilters called with facilityIds: $facilityIds")

        if (lastSearchQuery == null) {
            Log.e(TAG, "lastSearchQuery is null, cannot proceed with facility filtering")
            return
        }

        // Rijke context voor Geocoder
        val geocodeQuery = if (lastSearchQuery!!.contains(" (")) {
            val city = lastSearchQuery!!.substringBefore(" (")
            val province = lastSearchQuery!!.substringAfter(" (").substringBefore(")")
            "$city, $province, Nederland"
        } else {
            lastSearchQuery!!
        }

        // For facility filters, we need to make a new API request to get filtered data
        // This approach will fetch filtered data directly from the backend
        Thread {
                    try {
                        Log.d(TAG, "Starting geocoding for query: $geocodeQuery (orig: $lastSearchQuery)")
                        val geocoder = Geocoder(this@MainActivity)
                        val addresses = geocoder.getFromLocationName(geocodeQuery, 1)

                        if (addresses != null && addresses.isNotEmpty()) {
                            val address = addresses[0]
                            Log.d(
                                    TAG,
                                    "Geocoding successful: lat=${address.latitude}, lng=${address.longitude}"
                            )

                            // Build the API URL with facility filters
                            var apiUrl = "https://www.svr.nl/api/objects"
                            val params = mutableListOf<String>()

                            // Add location parameters
                            params.add("lat=${address.latitude}")
                            params.add("lng=${address.longitude}")
                            params.add("distance=50000") // 50km radius, adjust as needed

                            // Add facility filters if any
                            if (!facilityIds.isNullOrEmpty()) {
                                Log.d(TAG, "Adding facility filters to API request: $facilityIds")
                                for (facilityId in facilityIds) {
                                    params.add("filter[facilities][]=${facilityId}")
                                }
                            } else {
                                Log.d(TAG, "No facility filters to add to API request")
                            }

                            // Add other common parameters that might be needed
                            params.add("page=1")
                            params.add(
                                    "limit=500"
                            ) // Request more than 10 to have enough for clustering

                            apiUrl += "?" + params.joinToString("&")

                            Log.d(TAG, "Making filtered API request to: $apiUrl")

                            // Make the API request to get filtered data
                            val url = URL(apiUrl)
                            val connection = url.openConnection() as HttpURLConnection
                            connection.requestMethod = "GET"
                            connection.setRequestProperty(
                                    "User-Agent",
                                    userAgent
                                            ?: "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36"
                            )
                            connection.setRequestProperty("Accept", "application/json")
                            connection.setRequestProperty("Referer", "https://www.svr.nl/objects")

                            val responseCode = connection.responseCode
                            Log.d(TAG, "API request response code: $responseCode")

                            if (responseCode == HttpURLConnection.HTTP_OK) {
                                val response = connection.inputStream.bufferedReader().readText()
                                Log.d(
                                        TAG,
                                        "Successfully fetched filtered data from API: ${response.length} chars"
                                )

                                // Analyze the response for facility filtering effectiveness
                                try {
                                    val root = JSONObject(response)
                                    val objects = root.getJSONArray("objects")
                                    Log.d(
                                            TAG,
                                            "API response contains ${objects.length()} campsites after applying filters"
                                    )

                                    // Count facilities in the API response to confirm server-side
                                    // filtering
                                    var wintercampingCount = 0
                                    var wifiCount = 0
                                    var totalFacilitiesCount = 0

                                    for (i in 0 until minOf(10, objects.length())) {
                                        val campObject = objects.getJSONObject(i)
                                        val propertiesObject =
                                                campObject.getJSONObject("properties")
                                        val facilitiesArray =
                                                propertiesObject.optJSONArray("facilities")
                                                        ?: JSONArray()

                                        for (j in 0 until facilitiesArray.length()) {
                                            val facilityId = facilitiesArray.getString(j)

                                            // Count specific facilities
                                            if (facilityId == "a30ea17b-5ed8-40ce-93c1-13783b6b1029"
                                            )
                                                    wintercampingCount++
                                            if (facilityId == "f17d1c39-ad13-420e-bf2f-31c6977e52a8"
                                            )
                                                    wifiCount++
                                        }
                                        totalFacilitiesCount += facilitiesArray.length()

                                        if (i < 3) { // Log details for first 3 campsites
                                            Log.d(
                                                    TAG,
                                                    "Filtered campsite ${propertiesObject.optString("name")}: ${facilitiesArray.length()} facilities, includes Wintercamping: ${facilitiesArray.toString().contains("a30ea17b-5ed8-40ce-93c1-13783b6b1029")}, WiFi: ${facilitiesArray.toString().contains("f17d1c39-ad13-420e-bf2f-31c6977e52a8")}"
                                            )
                                        }
                                    }

                                    Log.d(
                                            TAG,
                                            "API Response Summary - Wintercamping filtered: $wintercampingCount, WiFi filtered: $wifiCount, Total facilities: $totalFacilitiesCount"
                                    )
                                    Log.d(TAG, "Facility filter IDs requested: $facilityIds")
                                } catch (e: Exception) {
                                    Log.e(
                                            TAG,
                                            "Error analyzing filtered API response: ${e.message}",
                                            e
                                    )
                                }

                                // Update the full JSON data with the filtered response
                                fullCampsiteJson = response

                                // Now process the filtered data
                                runOnUiThread {
                                    Log.d(
                                            TAG,
                                            "Processing filtered data on UI thread, updating campsite list"
                                    )
                                    val searchLocation =
                                            Location("").apply {
                                                latitude = address.latitude
                                                longitude = address.longitude
                                            }
                                    calculateAndSortDistances(
                                            searchLocation
                                    ) // Use original without additional filtering
                                }
                            } else {
                                Log.e(TAG, "API request failed with response code: $responseCode")
                                // If API request failed, fallback to local filtering
                                runOnUiThread {
                                    if (addresses.isNotEmpty()) {
                                        val fallbackSearchLocation =
                                                Location("").apply {
                                                    latitude = address.latitude
                                                    longitude = address.longitude
                                                }
                                        Log.d(TAG, "Using fallback local filtering")
                                        calculateAndSortDistancesWithFilters(
                                                fallbackSearchLocation,
                                                facilityIds,
                                                countryId
                                        )
                                    }
                                }
                            }

                            connection.disconnect()
                        } else {
                            Log.e(
                                    TAG,
                                    "Could not geocode search query: $lastSearchQuery, addresses is null or empty"
                            )
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error in reRunLastSearchWithFilters: ${e.message}", e)
                        // Fallback to local filtering if API request fails
                        runOnUiThread {
                            try {
                                val geocoder = Geocoder(this@MainActivity)
                                val addresses = geocoder.getFromLocationName(lastSearchQuery!!, 1)
                                if (addresses != null && addresses.isNotEmpty()) {
                                    val fallbackAddress = addresses[0]
                                    val fallbackSearchLocation =
                                            Location("").apply {
                                                latitude = fallbackAddress.latitude
                                                longitude = fallbackAddress.longitude
                                            }
                                    Log.d(TAG, "Using fallback after exception")
                                    calculateAndSortDistancesWithFilters(
                                            fallbackSearchLocation,
                                            facilityIds,
                                            countryId
                                    )
                                }
                            } catch (ge: Exception) {
                                Log.e(TAG, "Fallback geocoding also failed: ${ge.message}", ge)
                            }
                        }
                    }
                }
                .start()
    }

    private fun calculateAndSortDistances(searchLocation: Location) {

        Log.d(TAG, "calculateAndSortDistances called (no facility filters applied)")

        if (fullCampsiteJson == null) {

            Log.e(TAG, "Cannot calculate distances, JSON data is missing.")

            return
        }

        val allCampsites = mutableListOf<Camping>()

        try {

            val root = JSONObject(fullCampsiteJson!!)

            val objects = root.getJSONArray("objects")

            Log.d(TAG, "Processing ${objects.length()} total campsites without filters")

            for (i in 0 until objects.length()) {

                val campObject = objects.getJSONObject(i)

                val propertiesObject = campObject.getJSONObject("properties")

                val latString = propertiesObject.optString("lat")

                val lngString = propertiesObject.optString("lng")

                // Check the type_camping field - we should only include campsites where
                // type_camping is 0, 1, or 2
                // type_camping = 3 indicates the campsite does not apply to the current filters
                val typeCamping =
                        propertiesObject.optInt("type_camping", -1) // Default to -1 if not found

                if (typeCamping == 3) {
                    // Skip this campsite as it doesn't match the current filters
                    continue
                }

                val lat = latString.toDoubleOrNull()

                val lng = lngString.toDoubleOrNull()

                if (lat != null && lng != null) {

                    // For analysis, let's check if this campsite has the Wintercamping facility (or
                    // any facilities)
                    val facilitiesArray = propertiesObject.optJSONArray("facilities") ?: JSONArray()
                    val campsiteFacilityIds = mutableSetOf<String>()

                    for (j in 0 until facilitiesArray.length()) {
                        campsiteFacilityIds.add(facilitiesArray.getString(j))
                    }

                    // Log the first few campsites with their facilities for analysis
                    if (i < 5) {
                        Log.d(
                                TAG,
                                "Unfiltered campsite $i: ${propertiesObject.optString("name")}, facilities: $campsiteFacilityIds, type_camping: $typeCamping"
                        )
                    }

                    val camping =
                            Camping(
                                    id = campObject.getString("id"),
                                    name = propertiesObject.optString("name"),
                                    latitude = lat,
                                    longitude = lng,
                                    adres = propertiesObject.optString("adres"),
                                    city = propertiesObject.optString("city"),
                                    description = propertiesObject.optString("description"),
                                    imageUrl = propertiesObject.optString("image_url_thumb")
                            )

                    val campsiteLocation =
                            Location("").apply {
                                latitude = camping.latitude

                                longitude = camping.longitude
                            }

                    camping.distance = searchLocation.distanceTo(campsiteLocation)

                    allCampsites.add(camping)
                }
            }

            Log.d(
                    TAG,
                    "Successfully parsed and calculated distances for ${allCampsites.size} campsites after filtering by type_camping."
            )

            val sortedCampsites = allCampsites.sortedBy { it.distance }

            val top10Campsites = sortedCampsites.take(10)

            val remainingCampsites = sortedCampsites.drop(10)

            // Injecteer de top 10 onmiddellijk

            injectInitialData(top10Campsites, searchLocation)

            // Injecteer de rest asynchroon met een kleine vertraging

            Handler(Looper.getMainLooper())
                    .postDelayed(
                            { injectRemainingClusteringData(remainingCampsites) },
                            1000
                    ) // 1 seconde vertraging

            // Sla de top 10 op voor state restoration

            savedTop10Campsites = top10Campsites

            try {

                val sharedPref = getSharedPreferences("SVRAppPrefs", MODE_PRIVATE)

                with(sharedPref.edit()) {
                    putString("lastSearchQuery", lastSearchQuery)

                    val jsonArray = org.json.JSONArray()

                    savedTop10Campsites?.forEach { camping ->
                        val jsonObject = org.json.JSONObject()

                        jsonObject.put("id", camping.id)

                        jsonObject.put("name", camping.name)

                        jsonObject.put("latitude", camping.latitude)

                        jsonObject.put("longitude", camping.longitude)

                        jsonObject.put("adres", camping.adres)

                        jsonObject.put("city", camping.city)

                        jsonObject.put("description", camping.description)

                        jsonObject.put("imageUrl", camping.imageUrl)

                        jsonObject.put("distance", camping.distance.toDouble())

                        jsonArray.put(jsonObject)
                    }

                    putString("savedTop10CampsitesJson", jsonArray.toString())

                    apply()
                }
            } catch (e: Exception) {

                Log.e(TAG, "Error saving state to SharedPreferences: ${e.message}", e)
            }
        } catch (e: Exception) {

            Log.e(TAG, "Error parsing JSON or calculating distances", e)
        }
    }

    private fun calculateAndSortDistancesWithFilters(
            searchLocation: Location,
            facilityIds: List<String>?,
            countryId: String?
    ) {

        Log.d(TAG, "calculateAndSortDistancesWithFilters called with facilityIds: $facilityIds")

        if (fullCampsiteJson == null) {
            Log.e(TAG, "Cannot calculate distances with filters, JSON data is missing.")
            return
        }

        val allCampsites = mutableListOf<Camping>()
        var campsitesFilteredOut = 0

        try {
            val root = JSONObject(fullCampsiteJson!!)
            val objects = root.getJSONArray("objects")

            Log.d(
                    TAG,
                    "Starting local filtering for ${objects.length()} total campsites with facility IDs: $facilityIds"
            )

            for (i in 0 until objects.length()) {
                val campObject = objects.getJSONObject(i)
                val propertiesObject = campObject.getJSONObject("properties")

                val latString = propertiesObject.optString("lat")
                val lngString = propertiesObject.optString("lng")

                // Check the type_camping field - we should only include campsites where
                // type_camping is 0, 1, or 2
                // type_camping = 3 indicates the campsite does not apply to the current filters
                val typeCamping =
                        propertiesObject.optInt("type_camping", -1) // Default to -1 if not found

                if (typeCamping == 3) {
                    // Skip this campsite as it doesn't match the current filters
                    campsitesFilteredOut++
                    continue
                }

                val lat = latString.toDoubleOrNull()
                val lng = lngString.toDoubleOrNull()

                if (lat != null && lng != null) {
                    // First check if the campsite passes the facility filters
                    var passesFacilityFilter = true

                    if (!facilityIds.isNullOrEmpty()) {
                        // Get facilities for this campsite
                        val facilitiesArray =
                                propertiesObject.optJSONArray("facilities") ?: JSONArray()
                        val campsiteFacilityIds = mutableSetOf<String>()

                        for (j in 0 until facilitiesArray.length()) {
                            campsiteFacilityIds.add(facilitiesArray.getString(j))
                        }

                        // Check if campsite has all required facilities
                        passesFacilityFilter = facilityIds.all { it in campsiteFacilityIds }

                        if (!passesFacilityFilter) {
                            campsitesFilteredOut++
                        }

                        // Log detailed facility information for the first few campsites if we're
                        // looking for specific facilities
                        if (i < 3 && facilityIds != null) {
                            Log.d(
                                    TAG,
                                    "Campsite ${propertiesObject.optString("name")} facilities: $campsiteFacilityIds, required: $facilityIds, passes: $passesFacilityFilter, type_camping: $typeCamping"
                            )
                        }
                    }

                    if (passesFacilityFilter) {
                        val camping =
                                Camping(
                                        id = campObject.getString("id"),
                                        name = propertiesObject.optString("name"),
                                        latitude = lat,
                                        longitude = lng,
                                        adres = propertiesObject.optString("adres"),
                                        city = propertiesObject.optString("city"),
                                        description = propertiesObject.optString("description"),
                                        imageUrl = propertiesObject.optString("image_url_thumb")
                                )

                        val campsiteLocation =
                                Location("").apply {
                                    latitude = camping.latitude
                                    longitude = camping.longitude
                                }

                        camping.distance = searchLocation.distanceTo(campsiteLocation)
                        allCampsites.add(camping)
                    }
                }
            }

            Log.d(
                    TAG,
                    "After applying filters: ${allCampsites.size} campsites passed filters, $campsitesFilteredOut campsites were filtered out."
            )

            if (allCampsites.isEmpty() && !facilityIds.isNullOrEmpty()) {
                Log.w(
                        TAG,
                        "WARNING: All campsites were filtered out. This might indicate facility IDs are incorrect or no campsites have the selected facilities."
                )
            }

            val sortedCampsites = allCampsites.sortedBy { it.distance }
            val top10Campsites = sortedCampsites.take(10)
            val remainingCampsites = sortedCampsites.drop(10)

            // Injecteer de top 10 onmiddellijk
            injectInitialData(top10Campsites, searchLocation)

            // Injecteer de rest asynchroon met een kleine vertraging
            Handler(Looper.getMainLooper())
                    .postDelayed(
                            { injectRemainingClusteringData(remainingCampsites) },
                            1000
                    ) // 1 seconde vertraging

            // Sla de top 10 op voor state restoration
            savedTop10Campsites = top10Campsites

            try {
                val sharedPref = getSharedPreferences("SVRAppPrefs", MODE_PRIVATE)
                with(sharedPref.edit()) {
                    putString("lastSearchQuery", lastSearchQuery)
                    val jsonArray = org.json.JSONArray()
                    savedTop10Campsites?.forEach { camping ->
                        val jsonObject = org.json.JSONObject()
                        jsonObject.put("id", camping.id)
                        jsonObject.put("name", camping.name)
                        jsonObject.put("latitude", camping.latitude)
                        jsonObject.put("longitude", camping.longitude)
                        jsonObject.put("adres", camping.adres)
                        jsonObject.put("city", camping.city)
                        jsonObject.put("description", camping.description)
                        jsonObject.put("imageUrl", camping.imageUrl)
                        jsonObject.put("distance", camping.distance.toDouble())
                        jsonArray.put(jsonObject)
                    }
                    putString("savedTop10CampsitesJson", jsonArray.toString())
                    apply()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error saving state to SharedPreferences: ${e.message}", e)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing JSON or calculating distances with filters", e)
        }
    }

    private fun injectInitialData(campsites: List<Camping>, searchLocation: Location) {

        val data = JSONObject()

        data.put("campsites", JSONArray(campsites.map { it.toJSONObject() }))

        data.put("searchLat", searchLocation.latitude)

        data.put("searchLng", searchLocation.longitude)

        val base64Json =
                Base64.encodeToString(data.toString().toByteArray(Charsets.UTF_8), Base64.NO_WRAP)

        val jsToInject =
                """

                window.initialCampsiteDataB64 = "$base64Json";

                window.displayInitialData();

            """.trimIndent()

        runOnUiThread {
            val webView: WebView = findViewById(R.id.webView)

            Log.d(TAG, "Injecting initial top 10 data.")

            webView.evaluateJavascript(jsToInject, null)
        }
    }

    private fun injectRemainingClusteringData(campsites: List<Camping>) {

        val data = JSONObject()

        data.put("campsites", JSONArray(campsites.map { it.toJSONObject() }))

        val base64Json =
                Base64.encodeToString(data.toString().toByteArray(Charsets.UTF_8), Base64.NO_WRAP)

        val jsToInject =
                """

                window.remainingCampsiteDataB64 = "$base64Json";

                window.addRemainingMarkersToCluster();

            """.trimIndent()

        runOnUiThread {
            val webView: WebView = findViewById(R.id.webView)

            Log.d(TAG, "Injecting remaining ${campsites.size} campsites for clustering.")

            webView.evaluateJavascript(jsToInject, null)
        }
    }

    // Helper extension function to convert Camping to JSONObject

    fun Camping.toJSONObject(): JSONObject {

        return JSONObject(
                mapOf(
                        "id" to this.id,
                        "name" to this.name,
                        "lat" to this.latitude,
                        "lng" to this.longitude,
                        "adres" to this.adres,
                        "city" to this.city,
                        "distance" to this.distance,
                        "description" to this.description,
                        "imageUrl" to this.imageUrl
                )
        )
    }

    private fun restoreLastState() {

        if (savedTop10Campsites != null && lastSearchQuery != null) {

            Log.d(TAG, "Attempting to restore last state for query: $lastSearchQuery")

            Thread {
                        try {

                            val geocoder = Geocoder(this@MainActivity)

                            val addresses = geocoder.getFromLocationName(lastSearchQuery!!, 1)

                            runOnUiThread {
                                if (addresses != null && addresses.isNotEmpty()) {

                                    val address = addresses[0]

                                    val searchLocation =
                                            Location("").apply {
                                                latitude = address.latitude

                                                longitude = address.longitude
                                            }

                                    injectInitialData(savedTop10Campsites!!, searchLocation)

                                    Log.d(TAG, "Successfully restored last state.")
                                } else {

                                    Log.e(TAG, "Could not re-geocode last query: $lastSearchQuery")
                                }
                            }
                        } catch (e: Exception) {

                            Log.e(
                                    TAG,
                                    "Geocoder failed during state restoration for query: $lastSearchQuery",
                                    e
                            )
                        }
                    }
                    .start()
        } else {

            Log.d(TAG, "No saved state to restore.")
        }
    }

    private fun setupBackPressedHandler() {

        onBackPressedCallback =
                object : OnBackPressedCallback(true) {

                    override fun handleOnBackPressed() {

                        Log.d(TAG, "handleOnBackPressed triggered!")

                        val webView: WebView = findViewById(R.id.webView)

                        val currentUrl = webView.url ?: ""

                        // Check if the current URL is one of the menu pages that should always go
                        // back to the map
                        val isMenuPage = menuPageSlugs.any { currentUrl.contains(it) }

                        // Check if the filter overlay is currently open using our state variable
                        if (isFilterOverlayOpen) {
                            // Close the filter overlay via JavaScript
                            Log.d(TAG, "Filter overlay is open, closing it via JavaScript")
                            webView.evaluateJavascript("closeFilterOverlay();", null)
                        } else if (isMenuPage) {
                            Log.d(
                                    TAG,
                                    "Back from a menu page, setting flag and navigating to objects page to restore state."
                            )
                            forceRestoreState = true
                            webView.loadUrl("https://svr.nl/objects")
                        } else if (webView.canGoBack()) {
                            webView.goBack()
                        } else {
                            // If there's no history left, exit the app with a double-press
                            if (backPressedTime + 2000 > System.currentTimeMillis()) {
                                finish()
                            } else {
                                Toast.makeText(
                                                this@MainActivity,
                                                "Druk nogmaals op terug om de app te verlaten",
                                                Toast.LENGTH_SHORT
                                        )
                                        .show()
                                backPressedTime = System.currentTimeMillis()
                            }
                        }
                    }
                }

        onBackPressedDispatcher.addCallback(this, onBackPressedCallback)
    }

    private fun injectScriptFromAssets(
            view: WebView?,
            scriptName: String,
            onComplete: (() -> Unit)? = null
    ) {

        if (view == null) {

            Log.e(TAG, "WebView is null, cannot inject script: $scriptName")

            onComplete?.invoke()

            return
        }

        try {

            assets.open(scriptName).bufferedReader().use {
                val script = it.readText()

                view.evaluateJavascript(script) {
                    Log.d(TAG, "Successfully injected script: $scriptName")

                    onComplete?.invoke()
                }
            }
        } catch (e: Exception) {

            Log.e(TAG, "Error injecting script from assets: $scriptName", e)

            onComplete?.invoke()
        }
    }

    private fun injectCssFile(view: WebView?, fileName: String) {

        if (view == null) return

        try {

            val css = assets.open(fileName).bufferedReader().use { it.readText() }

            val base64Css = Base64.encodeToString(css.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)

            val script =
                    """

                    (function() {

                        var style = document.createElement('style');

                        style.innerHTML = atob('$base64Css');

                        document.head.appendChild(style);

                        console.log('Injected $fileName');

                    })();

                """.trimIndent()

            view.evaluateJavascript(script, null)
        } catch (e: Exception) {

            Log.e(TAG, "Error injecting CSS file: $fileName", e)
        }
    }

    private fun injectPageSpecificScripts(view: WebView?, url: String?) {

        if (url?.contains("#close") == true) {

            Log.d(TAG, "Skipping script injection for URL containing #close: $url")

            return
        }

        if (url?.contains("svr.nl") == true) {

            // Inject cluster assets first, as custom_script.js will depend on them.

            injectCssFile(view, "MarkerCluster.css")

            injectCssFile(view, "MarkerCluster.Default.css")

            injectScriptFromAssets(view, "leaflet.markercluster.js") {

                // This callback ensures that the cluster script is loaded before our custom script.

                injectScriptFromAssets(view, "custom_script.js") {
                    Log.d(TAG, "custom_script.js injected on $url.")

                    val navBarHeightScript =
                            "window.setAndroidNavBarHeight(${lastKnownNavBarHeight});"
                    view?.evaluateJavascript(navBarHeightScript, null)
                    Log.d(TAG, "Passed nav bar height (${lastKnownNavBarHeight}px) to JS.")

                    view?.evaluateJavascript("overrideCampingSearchLink();", null)

                    // Inject the precise filter toggle script
                    injectScriptFromAssets(view, "precise_filter_toggle.js")

                    // Inject the new filter overlay script
                    injectScriptFromAssets(view, "filter_overlay.js")

                    // Inject the reset filters handler to prevent page reload
                    injectScriptFromAssets(view, "reset_filters_handler.js")

                    injectScriptFromAssets(view, "override_script.js") {
                        Log.d(TAG, "override_script.js injected on $url.")
                        handleObjectsPageLogic(view, url)
                    }

                    // Inject our custom styles
                    injectCssFile(view, "custom_styles.css")
                }
            }
        }
        injectGlobalScripts(view, url)
    }

    private fun handleObjectsPageLogic(view: WebView?, url: String?) {

        if (view == null || url == null) return

        if (url.contains("svr.nl/objects")) {

            Log.d(TAG, "Now running logic specific to objects page.")

            // The search logic (reRunLastSearch/initiateTop10Search) should now ONLY be triggered

            // from processCampsiteJson once the data is available.

            // We remove the direct calls here to prevent race conditions.

            if (lastSearchQuery != null) {
                // Visuele opschoning: toon alleen de stad in het tekstvak (haal haakjes weg)
                val uiDisplayQuery = lastSearchQuery!!.replace(Regex("\\s*\\([^)]*\\)"), "").trim()
                val setSearchFieldScript =
                        "document.getElementById('query_input').value = '$uiDisplayQuery';"

                view.evaluateJavascript(setSearchFieldScript, null)

                Log.d(TAG, "Set search input field to: $uiDisplayQuery (full context was: $lastSearchQuery)")
            }

            injectScriptFromAssets(view, "footer_cleanup.js")
        }
    }

    private fun injectGlobalScripts(view: WebView?, url: String?) {

        if (view == null) return

        injectScriptFromAssets(view, "sticky_navbar.js")

        // DROPDOWN_CLEANUP_SCRIPT is a constant in the master branch, but not in this branch.

        // For now, I will hardcode the script here. Later, we can decide if we want to make it a
        // constant.

        val dropdownCleanupScript =
                """

                (function() {

                    const dropdowns = document.querySelectorAll('.dropdown-menu');

                    dropdowns.forEach(dropdown => {

                        dropdown.addEventListener('click', function(event) {

                            event.stopPropagation();

                        });

                    });

                })();

            """.trimIndent()

        view.evaluateJavascript(dropdownCleanupScript, null)

        Log.d(TAG, "Dropdown menu cleanup script injected.")

        if (url != null && url.contains("svr.nl/home")) {

            injectScriptFromAssets(view, "clone_map_section.js")
        }
    }

    override fun onStart() {
        super.onStart()
        // We doen de initiële check hier alleen als we NIET aan het inloggen zijn
        if (!isLoggingIn) {
            checkLoginStatus()
        }
    }

    override fun onResume() {
        super.onResume()
        if (isLoggingIn) {
            Log.d(TAG, "Returned from LoginActivity, resetting flag and checking status")
            isLoggingIn = false
            checkLoginStatus()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {

        // Handle the splash screen transition.

        val splashScreen = installSplashScreen()

        splashScreen.setOnExitAnimationListener { splashView ->
            // Create an overlay with a yellow background
            val overlay =
                    android.widget.FrameLayout(this).apply {
                        setBackgroundColor(android.graphics.Color.parseColor("#FDCC01"))
                        alpha = 1f
                    }
            val textView =
                    android.widget.TextView(this).apply {
                        textSize = 40f
                        setTextColor(android.graphics.Color.BLACK)
                        typeface =
                                android.graphics.Typeface.createFromAsset(
                                        assets,
                                        "fonts/befalow.ttf"
                                )
                        gravity = android.view.Gravity.CENTER
                    }
            overlay.addView(
                    textView,
                    android.widget.FrameLayout.LayoutParams(
                            android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                            android.widget.FrameLayout.LayoutParams.MATCH_PARENT
                    )
            )
            (window.decorView as android.view.ViewGroup).addView(overlay)

            // Typewriter effect
            val text = "Kamperen bij de boer"
            val animator =
                    android.animation.ValueAnimator.ofInt(0, text.length).apply {
                        duration = 2000L
                        addUpdateListener {
                            textView.text = text.substring(0, it.animatedValue as Int)
                        }
                        doOnEnd {
                            overlay.animate()
                                    .alpha(0f)
                                    .setDuration(500L)
                                    .withEndAction {
                                        (window.decorView as android.view.ViewGroup).removeView(
                                                overlay
                                        )
                                    }
                                    .start()
                        }
                    }
            animator.start()

            // Remove the original splash screen view now that our overlay is in place.
            splashView.remove()
        }

        super.onCreate(savedInstanceState)

        Log.d(TAG, "MainActivity onCreate called.")

        // Keep the splash screen on-screen until the content is ready.

        splashScreen.setKeepOnScreenCondition { isContentReady.get() }

        setContentView(R.layout.activity_main)

        // Vraag om locatie-permissies
        val permissions = arrayOf(
            android.Manifest.permission.ACCESS_FINE_LOCATION,
            android.Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (androidx.core.content.ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            androidx.core.app.ActivityCompat.requestPermissions(this, permissions, 1001)
        }

        // Initialize search manager
        val repository = CsvLocationRepository(this)
        searchManager = SearchManager(repository)

        loadMenuSlugsFromAssets()

        val webView: WebView = findViewById(R.id.webView)

        setupWebViewSettings(webView)

        setupWebViewClients(webView)

        // Forceer een schone lei voor filters bij koude start
        scrubFilterCookies()

        // Load saved state
        val sharedPref = getSharedPreferences("SVRAppPrefs", MODE_PRIVATE)
        val savedQuery = sharedPref.getString("lastSearchQuery", null)
        val savedCampsitesJson = sharedPref.getString("savedTop10CampsitesJson", null)

        if (savedQuery != null && savedCampsitesJson != null) {
            lastSearchQuery = savedQuery
            try {
                val jsonArray = org.json.JSONArray(savedCampsitesJson)
                val loadedCampsites = mutableListOf<Camping>()
                for (i in 0 until jsonArray.length()) {
                    val jsonObject = jsonArray.getJSONObject(i)
                    loadedCampsites.add(
                            Camping(
                                    id = jsonObject.getString("id"),
                                    name = jsonObject.getString("name"),
                                    latitude = jsonObject.getDouble("latitude"),
                                    longitude = jsonObject.getDouble("longitude"),
                                    adres = jsonObject.getString("adres"),
                                    city = jsonObject.getString("city"),
                                    description = jsonObject.getString("description"),
                                    imageUrl = jsonObject.getString("imageUrl"),
                                    distance = jsonObject.getDouble("distance").toFloat()
                            )
                    )
                }
                savedTop10Campsites = loadedCampsites
                Log.d(TAG, "Loaded ${loadedCampsites.size} campsites from saved state.")
            } catch (e: Exception) {
                Log.e(TAG, "Error loading saved campsites JSON", e)
                savedTop10Campsites = null // Clear corrupted data
            }
        }

        setupBackPressedHandler()
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush() // Ensure cookies are saved
    }
}
