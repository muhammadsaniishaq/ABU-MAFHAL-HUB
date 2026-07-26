import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The base authoring type is `PropsWithChildren`.
export default function HTML({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, shrink-to-fit=no, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root {
            touch-action: manipulation !important;
            -webkit-text-size-adjust: 100% !important;
            overflow-x: hidden !important;
          }
          @media screen and (max-width: 768px) {
            input, select, textarea, [role="textbox"], [contenteditable="true"] {
              font-size: 16px !important;
            }
          }
        `}} />

        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('gesturestart', function (e) {
            e.preventDefault();
          });
          document.addEventListener('dblclick', function (e) {
            e.preventDefault();
          }, { passive: false });
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
