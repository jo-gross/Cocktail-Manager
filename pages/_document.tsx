import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <meta name="author" content="Johannes Groß" />
        <meta name="description" content="Cocktailverwaltung" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t){t=JSON.parse(t);if(t==='dark')document.documentElement.setAttribute('data-theme','halloween');else if(t==='light')document.documentElement.setAttribute('data-theme','autumn')}}catch(e){}})()`,
          }}
        />

        <link rel="apple-touch-icon" sizes="180x180" href="/images/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon/favicon-16x16.png" />
        <link rel="manifest" href="/images/favicon/site.webmanifest" />
        <link rel="mask-icon" href="/images/favicon/safari-pinned-tab.svg" color="#3e3e3e" />
        <link rel="shortcut icon" href="/images/favicon/favicon.ico" />
        <meta name="msapplication-TileColor" content="#ffffff" />
        <meta name="msapplication-config" content="/images/favicon/browserconfig.xml" />
        <meta name="theme-color" content="#ffffff" />
      </Head>

      <body>
        <noscript
          id="google-tag-manager-noscript"
          dangerouslySetInnerHTML={{
            __html: `<iframe src='https://www.googletagmanager.com/ns.html?id=GTM-TQLT765' height='0' width='0' style='display:none;visibility:hidden'></iframe>`,
          }}
        />

        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
