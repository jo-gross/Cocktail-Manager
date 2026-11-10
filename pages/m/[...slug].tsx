/**
 * Public guest menu page (SSR, no auth; outside /workspaces so proxy.ts does
 * not intercept it, `guestPage` skips the app boundaries). Only cookie: the
 * HttpOnly access cookie of protected menus (`gma_{menuId}`, see access.ts).
 *
 *   /m/{bar}                 → active menu (or "no menu available")
 *   /m/{bar}/{menuSlug}      → specific menu; inactive → notice/link/redirect per `inactiveBehavior`
 *   ?lang=<locale>  ?preview=<previewToken>  ?q=…&tags=…&alc=…&without=…&max=… (shell state)
 *   Protected menu without access → PIN page (form POST to `/api/public/menus/{bar}/{slug}/unlock`,
 *   enhanced with fetch); `?code=<code>` unlocks directly and redirects to the URL without it;
 *   `?error=invalid|rateLimited&retry=<s>` = result of a plain form POST.
 *
 * Language: ?lang → localStorage (`guestMenuLocale`, client redirect) → Accept-Language → primary.
 */
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createHash } from 'crypto';
import type { PublicMenuDto } from '@lib/guest-menu/schema';
import { DEFAULT_THEME } from '@lib/guest-menu/schema';
import type { RenderedMenu } from '@lib/guest-menu/render';
import type { PublicMenuLock, PublicMenuNotice } from '@lib/guest-menu/public.server';
import { parseShellUrlState, type ShellUrlState } from '@lib/guest-menu/search';
import { translateGuestText, toGuestUiLocale, type GuestUiLocale } from '@lib/guest-menu/render/uiTexts';
import { themeToCssVariables, cssVariablesToDeclarations } from '@lib/guest-menu/theme';
import { GuestMenuShell, SHELL_CSS } from '@components/guest-menu/shell';
import { THEME_INIT_SCRIPT } from '@lib/themeInitScript';
import type { NextPageWithPullToRefresh } from '../../types/next';

const LOCALE_STORAGE_KEY = 'guestMenuLocale';

type LockError = 'invalid' | 'rateLimited' | null;

type PageProps =
  | { kind: 'notFound'; barPath: string | null; uiLocale: GuestUiLocale; title: string | null }
  | {
      kind: 'locked';
      uiLocale: GuestUiLocale;
      lock: Pick<PublicMenuLock, 'title' | 'workspaceName' | 'logoUrl' | 'cssVariables' | 'numeric' | 'unlockPath' | 'locale'>;
      /** Clean URL to return to after unlocking. */
      returnTo: string;
      error: LockError;
      retryAfterSeconds: number | null;
    }
  | { kind: 'noMenu'; barPath: string; uiLocale: GuestUiLocale; title: string }
  | {
      kind: 'menu';
      barPath: string;
      uiLocale: GuestUiLocale;
      dto: PublicMenuDto | null;
      rendered: RenderedMenu | null;
      notice: PublicMenuNotice | null;
      menuName: string;
      workspaceName: string;
      origin: string;
      path: string;
      noindex: boolean;
      initialState: ShellUrlState;
      langFromQuery: boolean;
    };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseAcceptLanguage(header: string | undefined): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return { tag: tag.trim(), q: q ? Number(q.trim().slice(2)) : 1 };
    })
    .filter((entry) => entry.tag && entry.tag !== '*' && entry.q > 0)
    .sort((a, b) => b.q - a.q)
    .map((entry) => entry.tag);
}

function buildCsp(): string {
  const themeHash = createHash('sha256').update(THEME_INIT_SCRIPT).digest('base64');
  const dev = process.env.NODE_ENV !== 'production';
  return [
    "default-src 'self'",
    `script-src 'self' 'sha256-${themeHash}'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Bars may embed their menu on their own website.
    'frame-ancestors *',
  ].join('; ');
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (context) => {
  const { loadPublicMenu } = await import('@lib/guest-menu/public.server');
  const { getPublicOrigin } = await import('@lib/guest-menu/server');
  const { appendUnlockQuery, attemptUnlock, collectAccessTokens, createMenuAccess } = await import('@lib/guest-menu/access');
  const { req, res, query } = context;
  const slug = Array.isArray(context.params?.slug) ? (context.params!.slug as string[]) : [];
  const acceptLanguages = parseAcceptLanguage(req.headers['accept-language']);
  const lang = first(query.lang);
  const uiLocale = toGuestUiLocale(lang ?? acceptLanguages[0]);
  const previewToken = first(query.preview) ?? null;

  res.setHeader('Content-Security-Policy', buildCsp());
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Accept-Language');

  if (slug.length < 1 || slug.length > 2) {
    res.statusCode = 404;
    return { props: { kind: 'notFound', barPath: null, uiLocale, title: null } };
  }

  const result = await loadPublicMenu({
    bar: slug[0],
    menuSlug: slug[1] ?? null,
    locale: lang ?? null,
    preferredLocales: acceptLanguages,
    previewToken,
    output: 'web',
    access: createMenuAccess(collectAccessTokens(req)),
  });

  // Clean URL (without code/error state) – return target after unlocking.
  const cleanUrl = appendUnlockQuery(context.resolvedUrl, {});
  const code = first(query.code);
  let lockError: LockError = first(query.error) === 'invalid' ? 'invalid' : first(query.error) === 'rateLimited' ? 'rateLimited' : null;
  let retryAfterSeconds = lockError === 'rateLimited' ? Number(first(query.retry)) || 60 : null;
  if (code !== undefined) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (result.kind !== 'locked') return { redirect: { destination: cleanUrl, permanent: false } };
    const prisma = (await import('../../prisma/prisma')).default;
    const menu = await prisma.guestMenu.findUnique({ where: { id: result.lock.menuId }, select: { id: true, accessCodeHash: true, accessCodeVersion: true } });
    const unlock = menu ? await attemptUnlock(req, menu, code) : null;
    if (unlock?.ok) {
      res.setHeader('Set-Cookie', unlock.cookie);
      return { redirect: { destination: cleanUrl, permanent: false } };
    }
    lockError = unlock?.reason === 'rateLimited' ? 'rateLimited' : 'invalid';
    retryAfterSeconds = unlock?.reason === 'rateLimited' ? (unlock.retryAfterSeconds ?? 60) : null;
  }

  if (result.kind === 'redirect') {
    const search = lang ? `?lang=${encodeURIComponent(lang)}` : '';
    return { redirect: { destination: `${result.location}${search}`, permanent: false } };
  }
  if (result.kind === 'notFound') {
    res.statusCode = 404;
    res.setHeader('X-Robots-Tag', 'noindex');
    return { props: { kind: 'notFound', barPath: result.barPath, uiLocale, title: result.workspaceName } };
  }
  if (result.kind === 'locked') {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    const { title, workspaceName, logoUrl, cssVariables, numeric, unlockPath, locale } = result.lock;
    const props: PageProps = {
      kind: 'locked',
      uiLocale: lang ? uiLocale : toGuestUiLocale(locale),
      lock: { title, workspaceName, logoUrl, cssVariables, numeric, unlockPath, locale },
      returnTo: cleanUrl,
      error: lockError,
      retryAfterSeconds,
    };
    return { props: JSON.parse(JSON.stringify(props)) as PageProps };
  }
  if (result.kind === 'noMenu') {
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.setHeader('X-Robots-Tag', 'noindex');
    return { props: { kind: 'noMenu', barPath: result.barPath, uiLocale, title: result.workspace.name } };
  }

  const dto = result.menu?.dto ?? null;
  const noindex = result.isPreview || !!result.notice || !result.menu || !!dto?.noindex;
  res.setHeader('Cache-Control', result.isPreview || result.isProtected ? 'private, no-store' : 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
  if (noindex) res.setHeader('X-Robots-Tag', 'noindex');

  const props: PageProps = {
    kind: 'menu',
    barPath: result.barPath,
    uiLocale: dto?.uiLocale ?? uiLocale,
    dto,
    rendered: result.menu?.rendered ?? null,
    notice: result.notice,
    menuName: result.menuName,
    workspaceName: result.workspace.name,
    origin: getPublicOrigin(req),
    path: dto?.menu.publicPath ?? `${result.barPath}/${encodeURIComponent(slug[1] ?? '')}`,
    noindex,
    initialState: parseShellUrlState(new URLSearchParams(Object.entries(query).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : []))).toString()),
    langFromQuery: !!lang,
  };
  // Props must be JSON-serializable (no `undefined`).
  return { props: JSON.parse(JSON.stringify(props)) as PageProps };
};

function formatDate(date: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  } catch {
    return date;
  }
}

function weekdayNames(weekdays: number[], locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
  // 2023-01-01 was a Sunday.
  const names = weekdays.map((day) => formatter.format(new Date(Date.UTC(2023, 0, 1 + day))));
  try {
    return new Intl.ListFormat(locale, { type: 'conjunction' }).format(names);
  } catch {
    return names.join(', ');
  }
}

function noticeText(notice: PublicMenuNotice, uiLocale: GuestUiLocale, uiTexts: Record<string, string>): string {
  const t = (key: string, values?: Record<string, unknown>) => translateGuestText(key, uiLocale, values, uiTexts);
  const { validity } = notice;
  switch (notice.reason) {
    case 'notYetValid':
      return validity.startsAt ? t('page.menuStartsAt', { date: formatDate(validity.startsAt, uiLocale) }) : t('page.menuDisabled');
    case 'expired':
      return validity.endedAt ? t('page.menuEndedAt', { date: formatDate(validity.endedAt, uiLocale) }) : t('page.menuDisabled');
    case 'weekday':
      return t('page.menuWeekdays', { days: weekdayNames(validity.weekdays, uiLocale) });
    case 'time':
      if (validity.timeFrom && validity.timeTo) return t('page.menuTime', { from: validity.timeFrom, to: validity.timeTo });
      if (validity.timeFrom) return t('page.menuTimeFrom', { from: validity.timeFrom });
      return t('page.menuTimeTo', { to: validity.timeTo });
    default:
      return t('page.menuDisabled');
  }
}

const FALLBACK_ROOT_STYLE = `.gm-root{${cssVariablesToDeclarations(themeToCssVariables(DEFAULT_THEME.tokens))};font-family:var(--gm-font-body);background:var(--gm-bg);color:var(--gm-text)}`;

function StatusPage({
  title,
  text,
  link,
  linkLabel,
  uiLocale,
}: {
  title: string;
  text: string;
  link: string | null;
  linkLabel: string;
  uiLocale: GuestUiLocale;
}) {
  return (
    <div className="gm-root gm-shell" lang={uiLocale}>
      <style dangerouslySetInnerHTML={{ __html: FALLBACK_ROOT_STYLE + SHELL_CSS }} />
      <main className="gm-shell-page">
        <h1>{title}</h1>
        <p>{text}</p>
        {link && (
          <p>
            <a className="gm-shell-btn gm-shell-btn--primary" href={link}>
              {linkLabel}
            </a>
          </p>
        )}
      </main>
    </div>
  );
}

const LOCK_CSS = `
.gm-lock { max-width: 22rem; width: 100%; margin: 0 auto; }
.gm-lock-logo { max-height: 96px; max-width: 220px; margin: 0 auto; object-fit: contain; }
.gm-lock h1 { font-family: var(--gm-font-heading); margin: 0; }
.gm-lock-sub { color: var(--gm-muted); margin: 0; }
.gm-lock form { display: grid; gap: 0.75rem; margin-top: 0.5rem; text-align: left; }
.gm-lock label { font-size: 0.9rem; font-weight: 600; }
.gm-lock input {
  min-height: 52px; border-radius: var(--gm-radius, 12px); font: inherit; font-size: 1.4rem; letter-spacing: 0.3em; text-align: center;
  border: 1px solid color-mix(in srgb, var(--gm-muted) 40%, transparent); background: var(--gm-surface); color: var(--gm-text);
  padding: 0 0.75rem; width: 100%; box-sizing: border-box; text-transform: uppercase;
}
.gm-lock input[aria-invalid="true"] { border-color: #dc2626; }
.gm-lock-error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.gm-lock .gm-shell-btn { width: 100%; }
`;

function LockPage(props: Extract<PageProps, { kind: 'locked' }>) {
  const t = (key: string, values?: Record<string, unknown>) => translateGuestText(key, props.uiLocale, values);
  const [code, setCode] = useState('');
  const [error, setError] = useState<LockError | 'failed'>(props.error);
  const [retryAfter, setRetryAfter] = useState(props.retryAfterSeconds);
  const [submitting, setSubmitting] = useState(false);
  const rootStyle = `.gm-root{${cssVariablesToDeclarations(props.lock.cssVariables)};font-family:var(--gm-font-body);background:var(--gm-bg);color:var(--gm-text)}html,body{margin:0;background:${props.lock.cssVariables['--gm-bg'] ?? '#fff'}}`;

  // Progressive enhancement: without JS the form posts and the API redirects back.
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(props.lock.unlockPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code, returnTo: props.returnTo }),
      });
      const body = (await response.json().catch(() => null)) as { status?: string; location?: string; retryAfterSeconds?: number } | null;
      if (response.ok && body?.status === 'ok') {
        // Full reload so the server renders the menu with the new cookie.
        window.location.replace(body.location ?? props.returnTo);
        return;
      }
      if (response.status === 429) {
        setError('rateLimited');
        setRetryAfter(body?.retryAfterSeconds ?? (Number(response.headers.get('Retry-After')) || 60));
      } else setError(response.status === 401 ? 'invalid' : 'failed');
      setCode('');
    } catch {
      setError('failed');
    }
    setSubmitting(false);
  };

  const errorText =
    error === 'invalid'
      ? t('page.lockInvalid')
      : error === 'rateLimited'
        ? t('page.lockRateLimited', { seconds: retryAfter ?? 60 })
        : error === 'failed'
          ? t('page.lockFailed')
          : null;

  return (
    <>
      <Head>
        <title>{`${props.lock.title} – ${props.lock.workspaceName}`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="gm-root gm-shell" lang={props.lock.locale}>
        <style dangerouslySetInnerHTML={{ __html: rootStyle + SHELL_CSS + LOCK_CSS }} />
        <main className="gm-shell-page">
          <div className="gm-lock">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {props.lock.logoUrl && <img className="gm-lock-logo" src={props.lock.logoUrl} alt={props.lock.workspaceName} />}
            <h1>{props.lock.title}</h1>
            {props.lock.title !== props.lock.workspaceName && <p className="gm-lock-sub">{props.lock.workspaceName}</p>}
            <form method="post" action={props.lock.unlockPath} onSubmit={submit} noValidate>
              <p className="gm-lock-sub" lang={props.uiLocale}>
                {t('page.lockText')}
              </p>
              <input type="hidden" name="returnTo" value={props.returnTo} />
              <label htmlFor="gm-lock-code" lang={props.uiLocale}>
                {t('page.lockCodeLabel')}
              </label>
              <input
                id="gm-lock-code"
                name="code"
                type="password"
                inputMode={props.lock.numeric ? 'numeric' : 'text'}
                pattern={props.lock.numeric ? '[0-9]*' : undefined}
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                minLength={4}
                maxLength={12}
                required
                autoFocus
                value={code}
                aria-invalid={error === 'invalid'}
                aria-describedby={errorText ? 'gm-lock-error' : undefined}
                onChange={(event) => setCode(props.lock.numeric ? event.target.value.replace(/\D/g, '') : event.target.value)}
              />
              {errorText && (
                <p id="gm-lock-error" className="gm-lock-error" role="alert" lang={props.uiLocale}>
                  {errorText}
                </p>
              )}
              <button type="submit" className="gm-shell-btn gm-shell-btn--primary" disabled={submitting} lang={props.uiLocale}>
                {t('page.lockSubmit')}
              </button>
            </form>
          </div>
        </main>
      </div>
    </>
  );
}

const GuestMenuPage: NextPageWithPullToRefresh<PageProps> = (props) => {
  const router = useRouter();
  const menuUiTexts = props.kind === 'menu' ? props.dto?.uiTexts : undefined;
  const uiTexts = useMemo(() => menuUiTexts ?? {}, [menuUiTexts]);
  const t = useCallback((key: string, values?: Record<string, unknown>) => translateGuestText(key, props.uiLocale, values, uiTexts), [props.uiLocale, uiTexts]);

  const dto = props.kind === 'menu' ? props.dto : null;

  // Language: remembered choice (localStorage only, no cookies) when ?lang is absent.
  useEffect(() => {
    if (props.kind !== 'menu' || !dto || props.langFromQuery) return;
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored && stored !== dto.locale && dto.availableLocales.includes(stored)) {
        void router.replace({ pathname: router.pathname, query: { ...router.query, lang: stored } });
      }
    } catch {
      // storage unavailable (private mode) – ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = dto?.locale ?? props.uiLocale;
  }, [dto?.locale, props.uiLocale]);

  const onLocaleChange = useCallback(
    (locale: string) => {
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      } catch {
        // ignore
      }
      // Keep the shell state (q/tags/…) that was written via replaceState after the SSR request.
      const current = Object.fromEntries(new URLSearchParams(window.location.search));
      void router.replace({ pathname: router.pathname, query: { ...current, slug: router.query.slug, lang: locale } });
    },
    [router],
  );

  const bodyStyle = useMemo(() => (dto ? `html,body{background:${dto.theme.tokens.colors.bg};margin:0}` : 'html,body{margin:0}'), [dto]);

  if (props.kind === 'locked') return <LockPage {...props} />;
  if (props.kind === 'notFound') {
    return (
      <>
        <Head>
          <title>{t('page.notFoundTitle')}</title>
          <meta name="robots" content="noindex" />
        </Head>
        <StatusPage
          title={t('page.notFoundTitle')}
          text={t('page.notFoundText')}
          link={props.barPath}
          linkLabel={t('page.toCurrentMenu')}
          uiLocale={props.uiLocale}
        />
      </>
    );
  }
  if (props.kind === 'noMenu') {
    return (
      <>
        <Head>
          <title>{`${t('page.noMenuTitle')} – ${props.title}`}</title>
          <meta name="robots" content="noindex" />
        </Head>
        <StatusPage title={t('page.noMenuTitle')} text={t('page.noMenuText')} link={null} linkLabel="" uiLocale={props.uiLocale} />
      </>
    );
  }

  const notice = props.notice ? (
    <div className="gm-shell-notice" role="status">
      <p>{noticeText(props.notice, props.uiLocale, uiTexts)}</p>
      <p>
        <a href={props.notice.currentMenuPath ?? props.barPath}>{t('page.toCurrentMenu')}</a>
      </p>
    </div>
  ) : null;

  if (!dto || !props.rendered) {
    return (
      <>
        <Head>
          <title>{`${props.menuName} – ${props.workspaceName}`}</title>
          <meta name="robots" content="noindex" />
        </Head>
        <div className="gm-root gm-shell" lang={props.uiLocale}>
          <style dangerouslySetInnerHTML={{ __html: FALLBACK_ROOT_STYLE + SHELL_CSS }} />
          <main className="gm-shell-page">
            <h1>{props.menuName}</h1>
            {notice}
          </main>
        </div>
      </>
    );
  }

  const url = `${props.origin}${props.path}`;
  const title = dto.menu.title === dto.menu.workspaceName ? dto.menu.title : `${dto.menu.title} – ${dto.menu.workspaceName}`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={dto.menu.subtitle ?? dto.menu.title} />
        <meta name="theme-color" content={dto.theme.tokens.colors.bg} />
        {props.noindex && <meta name="robots" content="noindex" />}
        <link rel="canonical" href={dto.locale === dto.primaryLocale ? url : `${url}?lang=${encodeURIComponent(dto.locale)}`} />
        {dto.availableLocales.map((locale) => (
          <link key={locale} rel="alternate" hrefLang={locale} href={`${url}?lang=${encodeURIComponent(locale)}`} />
        ))}
        <link rel="alternate" hrefLang="x-default" href={url} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        {dto.menu.subtitle && <meta property="og:description" content={dto.menu.subtitle} />}
        <meta property="og:url" content={url} />
        <meta property="og:site_name" content={dto.menu.workspaceName} />
        <meta property="og:locale" content={dto.locale.replace('-', '_')} />
        {dto.theme.logoUrl && <meta property="og:image" content={`${props.origin}${dto.theme.logoUrl}`} />}
      </Head>
      <style dangerouslySetInnerHTML={{ __html: bodyStyle }} />
      <GuestMenuShell
        dto={dto}
        rendered={props.rendered}
        output="web"
        interactive
        onLocaleChange={onLocaleChange}
        initialState={props.initialState}
        syncUrl
        banner={notice}
      />
    </>
  );
};

GuestMenuPage.guestPage = true;

export default GuestMenuPage;
