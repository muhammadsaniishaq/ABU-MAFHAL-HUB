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
        <meta name="viewport" content="width=device-width, initial-scale=1.0, shrink-to-fit=no, maximum-scale=1.0, user-scalable=no" />

        {/* 
          Disable body scrolling on web. This makes Sheets and modal overlays work more like a native app.
          Filters out extra styles on mobile web.
        */}
        <ScrollViewStyleReset />

        {/* Add any additional <head> elements here */}
      </head>
      <body>{children}</body>
    </html>
  );
}
