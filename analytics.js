// Analytics — replace placeholder IDs with your real ones
// GA4: https://analytics.google.com → Admin → Data Streams → copy Measurement ID
// Meta Pixel: https://business.facebook.com → Events Manager → copy Pixel ID

(function() {
  var GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';
  var META_PIXEL_ID = '000000000000000';

  // --- Google Analytics 4 (gtag) ---
  if (GA_MEASUREMENT_ID !== 'G-XXXXXXXXXX') {
    var gaScript = document.createElement('script');
    gaScript.async = true;
    gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(gaScript);

    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, {
      send_page_view: true,
      anonymize_ip: true
    });
  }

  // --- Meta Pixel ---
  if (META_PIXEL_ID !== '000000000000000') {
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', META_PIXEL_ID);
    fbq('track', 'PageView');
  }
})();
