import React, { useEffect } from 'react';
import { CookiesProvider } from 'react-cookie';
import { Trans } from '@lingui/react';
import { useRouter } from 'next/router';
import AuthWrapper from '../components/AuthWrapper';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/globals.css';
import 'react-loading-skeleton/dist/skeleton.css';
import Script from 'next/script';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { activateLocale } from '../lib/i18n';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || ""

export default function MyApp({ Component, pageProps }) {
  const { asPath, locale } = useRouter();
  const insecurePages = ['/login', '/logout', '/no_datasets'];

  useEffect(async () => {
    activateLocale(locale);
  }, [locale])

  return (
    <CookiesProvider>
      <I18nProvider i18n={i18n} forceRenderOnLocaleChange={false}>
        <title><Trans id="HIV Estimates Navigator" /></title>
        {GA_ID.length > 0 &&
          <Script
            strategy='lazyOnload'
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          />
        }
        {GA_ID.length > 0 &&
          <Script id='ga-analytics'>
            {
              `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', '${GA_ID}');
            `
            }
          </Script>
        }
        {insecurePages.includes(asPath)
          ? <Component {...pageProps} />
          : <AuthWrapper {...{ Component, pageProps }} />
        }
      </I18nProvider>
    </CookiesProvider>
  );

}
