import { Html, Head, Main, NextScript } from "next/document"
import Script from "next/script"

export default function Document() {
  const gtag = process.env["GTAG"]
  return (
    <Html lang="en">
      <Head>
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link
          href="https://fonts.googleapis.com/css2?family=Titillium+Web&display=swap"
          rel="stylesheet"
        />
        {gtag != null && (
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gtag}`}
            strategy="afterInteractive"
          />
        )}
        {gtag != null && (
          <Script
            id="google-analytics"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={
              // https://support.google.com/analytics/answer/7201382?hl=en&utm_id=ad#zippy=%2Cgoogle-tag-gtagjs
              process.env["NODE_ENV"] === "production"
                ? {
                    __html: `
                      window.dataLayer = window.dataLayer || [];
                      function gtag(){window.dataLayer.push(arguments);}
                      gtag('js', new Date());
                      gtag('config', '${gtag}', {
                        page_path: window.location.pathname
                      });
                    `,
                  }
                : {
                    __html: `
                      window.dataLayer = window.dataLayer || [];
                      function gtag(){window.dataLayer.push(arguments);}
                      gtag('js', new Date());
                      gtag('config', '${gtag}', {
                        page_path: window.location.pathname,
                        debug_mode: true
                      });
                    `,
                  }
            }
          />
        )}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
