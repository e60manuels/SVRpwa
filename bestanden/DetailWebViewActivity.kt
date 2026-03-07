package com.example.svrcampings_v31.dev

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.util.Log
import android.graphics.Typeface
import android.view.MotionEvent
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class DetailWebViewActivity : AppCompatActivity() {

    private val TAG = "DetailWebView"
    private var initialTouchY = 0f
    private var isDragging = false
    private var startedOnHeader = false

    // --- Swipe-to-Close Logic (Activity Level) ---
    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        val webView: WebView = findViewById(R.id.detail_webview)
        val container: FrameLayout = findViewById(R.id.detail_bottom_sheet_container)
        val rootContainer: FrameLayout = findViewById(R.id.detail_root_container)
        val stickyEdge: View = findViewById(R.id.sticky_top_edge)

        when (ev.action) {
            MotionEvent.ACTION_DOWN -> {
                initialTouchY = ev.rawY
                
                // Check of de touch op de witte balk (header) is begonnen
                val location = IntArray(2)
                stickyEdge.getLocationOnScreen(location)
                val headerTop = location[1]
                val headerBottom = headerTop + stickyEdge.height
                startedOnHeader = ev.rawY >= headerTop && ev.rawY <= headerBottom
            }
            MotionEvent.ACTION_MOVE -> {
                val deltaY = ev.rawY - initialTouchY
                
                // Onderschep als:
                // 1. We op de header zijn begonnen (altijd toegestaan)
                // 2. OF we trekken naar beneden en de WebView staat bovenaan
                if (deltaY > 0 && (startedOnHeader || webView.scrollY == 0)) {
                    isDragging = true
                    container.translationY = deltaY
                    // Dim de achtergrond
                    val alpha = 0.5f * (1f - (deltaY / rootContainer.height))
                    rootContainer.setBackgroundColor(Color.argb((alpha * 255).toInt(), 0, 0, 0))
                    return true 
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (isDragging) {
                    val deltaY = ev.rawY - initialTouchY
                    if (deltaY > 300) {
                        container.animate()
                            .translationY(rootContainer.height.toFloat())
                            .setDuration(300)
                            .setListener(object : AnimatorListenerAdapter() {
                                override fun onAnimationEnd(animation: Animator) {
                                    finish()
                                    overridePendingTransition(0, 0)
                                }
                            }).start()
                    } else {
                        container.animate()
                            .translationY(0f)
                            .setDuration(200)
                            .start()
                        rootContainer.setBackgroundColor(Color.parseColor("#80000000"))
                    }
                    isDragging = false
                    startedOnHeader = false
                    return true
                }
                startedOnHeader = false
            }
        }
        return super.dispatchTouchEvent(ev)
    }

    // Close the activity when clicking outside the sheet (on the root container)
    private fun setupClickOutside() {
        findViewById<View>(R.id.detail_root_container).setOnClickListener {
            if (!isDragging) finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    Log.d(TAG, "NATIVE_ANIM: 1. onCreate started.")

    val url = intent.getStringExtra("url") ?: ""
    val isSvrInfoPage = url == "https://www.svr.nl" || url == "https://svr.nl" || url.endsWith("svr.nl/")

    // Set the content view to our new FrameLayout
    setContentView(R.layout.activity_detail_webview)
    Log.d(TAG, "NATIVE_ANIM: 2. setContentView finished.")

    // --- View Initialization ---
    val webView: WebView = findViewById(R.id.detail_webview)
    val titleView: TextView = findViewById(R.id.ephemeral_title)
    val container: FrameLayout = findViewById(R.id.detail_bottom_sheet_container)
    val rootContainer: FrameLayout = findViewById(R.id.detail_root_container)
    val stickyEdge: View = findViewById(R.id.sticky_top_edge)

    // Initieel alles verbergen voor een naadloze overgang later (Stap 4)
    stickyEdge.visibility = View.VISIBLE
    stickyEdge.alpha = 0f
    webView.alpha = 0f

    setupClickOutside()

    // Apply custom font to the title
    try {
        val typeface = Typeface.createFromAsset(assets, "fonts/befalow.ttf")
        titleView.typeface = typeface
        Log.d(TAG, "NATIVE_ANIM: Custom font applied to titleView.")
    } catch (e: Exception) {
        Log.e(TAG, "NATIVE_ANIM: Error applying custom font.", e)
    }

    // --- Background Color Setup ---
    webView.setBackgroundColor(Color.TRANSPARENT)

    // Definieer de overgangs-actie (Stap 4)
    val showContentAction = Runnable {
        if (!isFinishing && webView.alpha == 0f) {
            Log.d(TAG, "SVR_UI: Executing seamless transition to web content.")
            titleView.animate().alpha(0f).setDuration(300).withEndAction { titleView.visibility = View.GONE }.start()
            webView.animate().alpha(1f).setDuration(400).start()
            stickyEdge.animate().alpha(1f).setDuration(400).start()
        }
    }
    
    // Fallback: Als de pagina na 2.5 seconden nog niet geladen is, toon dan toch de UI
    container.postDelayed(showContentAction, 2500)


         webView.settings.javaScriptEnabled = true
         webView.settings.domStorageEnabled = true
         WebView.setWebContentsDebuggingEnabled(true)
         
         webView.addJavascriptInterface(WebAppInterface(), "Android")

         webView.webViewClient = object : WebViewClient() {
            override fun onPageCommitVisible(view: WebView?, url: String?) {
                super.onPageCommitVisible(view, url)
                // Zodra de pixels van de pagina er zijn, voer de overgang uit
                webView.post(showContentAction)
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url.toString()
                
                // If the user clicks the "back to overview" link, finish this activity.
                if (url.endsWith("/objects")) {
                    finish()
                    return true 
                }

                // Handle SVR links internally
                if (url.contains("svr.nl")) {
                    return false
                }

                // All other links (Facebook, Youtube, other external sites, or custom schemes) 
                // should be handled by the Android system (external browser or apps).
                try {
                    Log.d(TAG, "Opening external URL or custom scheme: $url")
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                    return true
                } catch (e: Exception) {
                    Log.e(TAG, "Could not open external URL: $url", e)
                    // If we can't open it externally and it's not HTTP/S, we return true to prevent ERR_UNKNOWN_URL_SCHEME
                    return !url.startsWith("http")
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.d(TAG, "onPageFinished: Page finished loading for URL: $url")

                // JavaScript to find and override "Routebeschrijving" buttons
                val overrideMapsScript = """
                    (function() {
                        function patchMapsButtons() {
                            // Target links that look like Google Maps search links
                            var links = document.querySelectorAll('a[href*="maps.google"], a[href*="google.nl/maps"], a[href*="google.com/maps"]');
                            links.forEach(function(link) {
                                if (link.getAttribute('data-maps-overridden')) return;
                                
                                // Extract coordinates from href (format: search/LAT,LNG)
                                var coordsMatch = link.href.match(/search\/([-+]?\d*\.?\d+),([-+]?\d*\.?\d+)/);
                                if (coordsMatch) {
                                    var lat = coordsMatch[1];
                                    var lng = coordsMatch[2];
                                    var name = document.querySelector('h1')?.innerText || "Camping";
                                    
                                    console.log('SVR_MOD: Patching Maps button for ' + name + ' at ' + lat + ',' + lng);
                                    link.setAttribute('data-maps-overridden', 'true');
                                    link.removeAttribute('target');
                                    link.href = "javascript:void(0);";
                                    link.onclick = function(e) {
                                        e.preventDefault();
                                        if (window.Android && Android.openNavigation) {
                                            Android.openNavigation(parseFloat(lat), parseFloat(lng), name);
                                        }
                                        return false;
                                    };
                                }
                            });
                        }

                        patchMapsButtons();
                        // Monitor for dynamic updates (SVR site uses AJAX frequently)
                        var observer = new MutationObserver(patchMapsButtons);
                        if (document.body) {
                            observer.observe(document.body, { childList: true, subtree: true });
                        }
                    })();
                """.trimIndent()
                view?.evaluateJavascript(overrideMapsScript, null)

                // NOTE: The H1 injection script has been removed as it is now a native TextView.

                // Inject custom_script.js to override bottom sheet
                try {
                    val inputStream = assets.open("custom_script.js")
                    val script = inputStream.bufferedReader().use { it.readText() }
                    view?.evaluateJavascript(script, null)
                    Log.d(TAG, "custom_script.js injected in DetailWebViewActivity.")
                } catch (e: Exception) {
                    Log.e(TAG, "Error injecting custom_script.js in DetailWebViewActivity.", e)
                }

                // Inject Swiper CSS
                view?.evaluateJavascript(
                    """
                    (function() {
                        var link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.type = 'text/css';
                        link.href = 'https://unpkg.com/swiper/swiper-bundle.min.css'; // CDN for Swiper CSS
                        document.head.appendChild(link);
                        console.log('SVR_MOD_DEBUG: Swiper CSS injected in DetailWebViewActivity.');
                    })();
                    """.trimIndent(), null
                )

                // Inject Swiper JS
                view?.evaluateJavascript(
                    """
                    (function() {
                        var script = document.createElement('script');
                        script.src = 'https://unpkg.com/swiper/swiper-bundle.min.js'; // CDN for Swiper JS
                        script.async = false;
                        document.head.appendChild(script);
                        console.log('SVR_MOD_DEBUG: Swiper JS injected in DetailWebViewActivity.');
                    })();
                    """.trimIndent(), null
                )

                // Inject swiper_init.js
                try {
                    val inputStream = assets.open("swiper_init.js")
                    val script = inputStream.bufferedReader().use { it.readText() }
                    view?.evaluateJavascript(script, null)
                    Log.d(TAG, "swiper_init.js injected in DetailWebViewActivity.")
                } catch (e: Exception) {
                    Log.e(TAG, "Error injecting swiper_init.js in DetailWebViewActivity.", e)
                }
            }
        }

                  webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)

                // Inject @font-face rule for the 'befalow' font
                val injectFontFaceScript = """
                    (function() {
                        var css = `
                            @font-face {
                                font-family: 'befalow';
                                src: url('file:///android_asset/fonts/befalow.woff2') format('woff2');
                                font-weight: normal;
                                font-style: normal;
                            }
                        `;
                        if (document.head && !document.getElementById('befalow-font-style')) {
                            var style = document.createElement('style');
                            style.id = 'befalow-font-style';
                            style.type = 'text/css';
                            style.innerHTML = css;
                            document.head.appendChild(style);
                        }
                    })();
                """.trimIndent()
                view?.evaluateJavascript(injectFontFaceScript, null)

                // Inject CSS as early as possible to prevent flicker
                val hideLoginScript = """
                    (function() {
                        if (document.head && !document.getElementById('hide-login-style')) {
                            var style = document.createElement('style');
                            style.id = 'hide-login-style';
                            style.type = 'text/css';
                            style.innerHTML = ':is(div, span):has(> small a[href*="login"], > small a[href*="logout"]) { display: none !important; }';
                            document.head.appendChild(style);
                        }
                    })();
                """.trimIndent()
                view?.evaluateJavascript(hideLoginScript, null)

                // Script to hide the back button as requested
                val hideBackButtonScript = """
                    (function() {
                        var css = `
                            a.btn[href="/objects"], .btn-light:has(.fa-arrow-left) {
                                display: none !important;
                            }
                        `;
                        if (document.head && !document.getElementById('hide-back-button-style')) {
                            var style = document.createElement('style');
                            style.id = 'hide-back-button-style';
                            style.type = 'text/css';
                            style.innerHTML = css;
                            document.head.appendChild(style);
                        }
                    })();
                """.trimIndent()
                view?.evaluateJavascript(hideBackButtonScript, null)

                // Consolidated script to modify the header, overriding !important tags
                val modifyHeaderScript = """
                    (function() {
                        var divs = document.getElementsByTagName('div');
                        for (var i = 0; i < divs.length; i++) {
                            if (divs[i].style.backgroundImage.includes('temp_pic.php')) {
                                // Override inline !important styles using setProperty
                                divs[i].style.setProperty('background-image', 'none', 'important');
                                divs[i].style.setProperty('padding-top', '0', 'important');
                                divs[i].style.setProperty('min-height', 'auto', 'important');
                                divs[i].style.setProperty('margin-bottom', '0', 'important');
                                break;
                            }
                        }
                    })();
                """.trimIndent()
                view?.evaluateJavascript(modifyHeaderScript, null)

                // Script to hide the yellow navbar and reset padding
                val stickyNavbarScript = """
                    (function() {
                        // Inject global CSS to reset body/html margins and paddings
                        var globalResetCss = `
                            html, body {
                                margin: 0 !important;
                                padding: 0 !important;
                                ${if (isSvrInfoPage) "padding-top: 5px !important; background-color: #fff !important;" else ""}
                                overflow-x: hidden !important;
                            }
                        `;
                        if (document.head && !document.getElementById('global-reset-style')) {
                            var style = document.createElement('style');
                            style.id = 'global-reset-style';
                            style.type = 'text/css';
                            style.innerHTML = globalResetCss;
                            document.head.appendChild(style);
                        }

                        // --- Hide the main yellow bar (gele-balk) ---
                        var yellowNavbar = document.querySelector('div[style*="background-color: rgba(253, 204, 1, .7)"]');
                        if (yellowNavbar) {
                            yellowNavbar.style.setProperty('display', 'none', 'important');
                        }

                        // --- Style the "veeg" element (gele-veeg) ---
                        var veegCampings = document.querySelector('.veeg-campings');
                        if (veegCampings) {
                            // Set this element to 95% width as requested
                            veegCampings.style.setProperty('width', '95%', 'important');
                            veegCampings.style.setProperty('max-width', '95%', 'important');
                            veegCampings.style.setProperty('padding-left', '');
                            veegCampings.style.setProperty('padding-right', '');
                            veegCampings.style.setProperty('margin-left', 'auto');
                            veegCampings.style.setProperty('margin-right', 'auto');
                        }
                    })();
                """.trimIndent()
                view?.evaluateJavascript(stickyNavbarScript, null)



                // Inject custom_styles.css for hamburger menu
                try {
                    val cssStream = assets.open("custom_styles.css")
                    val css = cssStream.bufferedReader().use { it.readText() }
                    val cssBase64 = Base64.encodeToString(css.toByteArray(), Base64.NO_WRAP)
                    val cssInjectionScript = """
                        (function() {
                            if (!document.getElementById('custom-svr-styles')) {
                                var style = document.createElement('style');
                                style.id = 'custom-svr-styles';
                                style.type = 'text/css';
                                style.innerHTML = atob('$cssBase64');
                                document.head.appendChild(style);
                                console.log('Custom styles for hamburger injected.');
                            }
                        })();
                    """.trimIndent()
                    view?.evaluateJavascript(cssInjectionScript, null)
                } catch (e: Exception) {
                    Log.e(TAG, "Error loading or injecting custom_styles.css from assets", e)
                }
            }

            override fun onConsoleMessage(message: String?, lineNumber: Int, sourceID: String?) {
                Log.d(TAG, "Console: $message -- From line $lineNumber of $sourceID")
            }
        }

        if (url.isNotEmpty()) {
            Log.d(TAG, "onCreate: Delaying URL load for smooth animation.")
            // Wacht tot de slide-in animatie (500ms) klaar is + 200ms extra rust
            webView.postDelayed({
                if (!isFinishing) {
                    Log.d(TAG, "onCreate: Animation done, loading URL: $url")
                    webView.loadUrl(url)
                }
            }, 700) 
        } else {
            Log.e(TAG, "onCreate: URL is null or empty, cannot load page.")
            finish() // Close the activity if there's nothing to show
        }
    }

    inner class WebAppInterface {
        @android.webkit.JavascriptInterface
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
    }
}
