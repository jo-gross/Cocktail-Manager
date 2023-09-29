import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <meta name="author" content="Johannes Groß" />
        <meta name="description" content="Cocktailverwaltung" />

        <link rel="apple-touch-icon" sizes="180x180" href="/images/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon/favicon-16x16.png" />
        <link rel="manifest" href="/images/favicon/site.webmanifest" />
        <link rel="mask-icon" href="/images/favicon/safari-pinned-tab.svg" color="#4f4c4c" />
        <meta name="msapplication-TileColor" content="#da532c" />
        <meta name="theme-color" content="#4f4c4c" />
      </Head>

      <body>
        <noscript
          id="google-tag-manager-noscript"
          dangerouslySetInnerHTML={{
            __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-TQLT765" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
          }}
        />

        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
