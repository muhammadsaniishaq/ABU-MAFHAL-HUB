import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// This file is web-only and used to configure the root HTML for every web page during static rendering.
export default function HTML({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* Mobile-First Viewport: locks scale, fills notch area (viewport-fit=cover) */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, shrink-to-fit=no"
        />

        {/* PWA / Add-to-Home-Screen (iOS & Android) */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ABU MAFHAL" />
        <meta name="application-name" content="ABU MAFHAL" />

        {/* Theme / Brand Color */}
        <meta name="theme-color" content="#0d1b3e" />
        <meta name="msapplication-TileColor" content="#0d1b3e" />
        <meta name="msapplication-navbutton-color" content="#0d1b3e" />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Favicon & Apple Touch Icons */}
        <link rel="icon" href="/assets/images/logo-icon.png" />
        <link rel="apple-touch-icon" href="/assets/images/logo-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/logo-icon.png" />

        {/* Google Tag Manager */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18403539201" />
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'AW-18403539201');
        `}} />

        <ScrollViewStyleReset />

        {/* Mobile App Shell CSS — makes browser feel like a native app */}
        <style dangerouslySetInnerHTML={{ __html: `
          *, *::before, *::after {
            -webkit-tap-highlight-color: transparent !important;
            -webkit-touch-callout: none !important;
            box-sizing: border-box !important;
          }
          html {
            height: 100% !important;
            height: -webkit-fill-available !important;
            overflow: hidden !important;
            background: #f0f2f8 !important;
          }
          body {
            height: 100% !important;
            height: -webkit-fill-available !important;
            min-height: 100dvh !important;
            overflow: hidden !important;
            overscroll-behavior: none !important;
            -webkit-overflow-scrolling: auto !important;
            touch-action: manipulation !important;
            -webkit-text-size-adjust: 100% !important;
            text-size-adjust: 100% !important;
            background: #f0f2f8 !important;
            margin: 0 !important;
            padding: 0 !important;
            user-select: none !important;
            -webkit-user-select: none !important;
          }
          #root {
            height: 100% !important;
            min-height: 100dvh !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
            overscroll-behavior: none !important;
            background: #f0f2f8 !important;
          }
          @media screen and (max-width: 768px) {
            input, select, textarea, [role="textbox"], [contenteditable="true"] {
              font-size: 16px !important;
            }
            ::-webkit-scrollbar { display: none !important; width: 0 !important; }
            * { scrollbar-width: none !important; }
          }
          video {
            object-fit: contain !important;
            max-width: 100% !important;
            max-height: 100% !important;
          }
        `}} />

        {/* Native-Feel JS Patches */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            // Prevent pinch-to-zoom
            document.addEventListener('gesturestart', function(e) { e.preventDefault(); }, { passive: false });
            document.addEventListener('gesturechange', function(e) { e.preventDefault(); }, { passive: false });
            document.addEventListener('gestureend', function(e) { e.preventDefault(); }, { passive: false });
            // Prevent double-tap zoom
            var lastTouch = 0;
            document.addEventListener('touchend', function(e) {
              var now = Date.now();
              if (now - lastTouch < 300) { e.preventDefault(); }
              lastTouch = now;
            }, { passive: false });
            // Prevent multi-touch scroll (pinch prevention)
            document.addEventListener('touchmove', function(e) {
              if (e.touches.length > 1) { e.preventDefault(); }
            }, { passive: false });
            // Register Service Worker for PWA
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').catch(function() {});
              });
            }
          })();
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
