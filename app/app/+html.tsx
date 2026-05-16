import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

const GA_MEASUREMENT_ID = "G-SGDR7Q5RRY";

const gtagInlineScript = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />

        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        />
        <script dangerouslySetInnerHTML={{ __html: gtagInlineScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
