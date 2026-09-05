import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * The web document shell. Static rendering means this runs once at build time -
 * it cannot read app state, so it only carries what must exist before the first
 * paint: the paper ground, so there is no white flash before React mounts.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#FAF9F5" />

        {/* Keeps body scroll on the app shell rather than the document. */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: BACKGROUND }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const BACKGROUND = `
html, body, #root {
  background-color: #FAF9F5;
  color-scheme: light;
}
`;
