import type { Child, FC, PropsWithChildren } from 'hono/jsx';
import type { SessionUser } from '../services/auth.js';
import { Alert, Csrf } from './ui.js';

export interface Flash {
  kind: 'ok' | 'info' | 'warn' | 'error';
  text: string;
}

export const ASSET_VERSION = '1';

const Head: FC<{ title: string; description?: string | undefined }> = ({ title, description }) => (
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description ?? 'Remarcá: subís la lista del proveedor y obtenés tus precios nuevos listos para tu sistema.'} />
    <meta name="theme-color" content="#0f5f58" />
    <link rel="icon" href="/static/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href={`/static/styles.css?v=${ASSET_VERSION}`} />
    <script src={`/static/app.js?v=${ASSET_VERSION}`} defer></script>
  </head>
);

const Logo: FC = () => (
  <span class="logo">
    <span class="logo__mark" aria-hidden="true">
      %
    </span>
    Remarcá
  </span>
);

export const PublicLayout: FC<PropsWithChildren<{ title: string; description?: string; flash?: Flash | null; wide?: boolean }>> = ({ title, description, flash, wide, children }) => (
  <html lang="es-AR">
    <Head title={title} description={description} />
    <body class="public">
      <a class="skip" href="#main">
        Saltar al contenido
      </a>
      <header class="topbar">
        <div class="topbar__inner">
          <a href="/" class="topbar__brand">
            <Logo />
          </a>
          <nav class="topbar__nav" aria-label="Principal">
            <a href="/#como-funciona">Cómo funciona</a>
            <a href="/#precios">Precios</a>
            <a href="/ingresar">Ingresar</a>
            <a class="btn btn--small" href="/registro">
              Probar gratis
            </a>
          </nav>
        </div>
      </header>
      <main id="main" class={wide ? 'public-main public-main--wide' : 'public-main'}>
        {flash ? <Alert kind={flash.kind}>{flash.text}</Alert> : null}
        {children}
      </main>
      <footer class="footer">
        <div class="footer__inner">
          <span>© 2026 Remarcá · Hecho en Argentina</span>
          <nav aria-label="Legal">
            <a href="/terminos">Términos</a>
            <a href="/privacidad">Privacidad</a>
          </nav>
        </div>
      </footer>
    </body>
  </html>
);

export interface AppChrome {
  user: SessionUser;
  orgName: string;
  active: boolean;
  planName: string;
  daysLeft: number | null;
  isTrial: boolean;
}

const NAV: { href: string; label: string; key: string }[] = [
  { href: '/app', label: 'Inicio', key: 'home' },
  { href: '/app/listas', label: 'Listas', key: 'listas' },
  { href: '/app/proveedores', label: 'Proveedores', key: 'proveedores' },
  { href: '/app/productos', label: 'Productos', key: 'productos' },
  { href: '/app/ajustes', label: 'Ajustes', key: 'ajustes' },
];

export const AppLayout: FC<PropsWithChildren<{ title: string; chrome: AppChrome; section: string; flash?: Flash | null; actions?: Child }>> = ({
  title,
  chrome,
  section,
  flash,
  actions,
  children,
}) => (
  <html lang="es-AR">
    <Head title={`${title} · Remarcá`} />
    <body class="app">
      <a class="skip" href="#main">
        Saltar al contenido
      </a>
      <header class="appbar">
        <div class="appbar__inner">
          <a href="/app" class="topbar__brand">
            <Logo />
          </a>
          <nav class="appnav" aria-label="Secciones">
            {NAV.map((n) => (
              <a href={n.href} aria-current={n.key === section ? 'page' : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
          <div class="appbar__user">
            <a href="/app/cuenta" class="appbar__org" title={chrome.user.email}>
              {chrome.orgName}
            </a>
            <form method="post" action="/salir">
              <Csrf token={chrome.user.csrf} />
              <button type="submit" class="linklike">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      {chrome.isTrial && chrome.active ? (
        <div class="banner">
          Prueba gratis: te quedan <strong>{chrome.daysLeft} días</strong>. <a href="/app/plan">Ver planes</a>
        </div>
      ) : null}
      {!chrome.active ? (
        <div class="banner banner--warn">
          Tu {chrome.isTrial ? 'prueba terminó' : 'plan venció'}. Podés ver y exportar tus datos, pero no subir listas nuevas. <a href="/app/plan">Activar un plan</a>
        </div>
      ) : null}
      <main id="main" class="app-main">
        <div class="pagehead">
          <h1>{title}</h1>
          {actions ? <div class="pagehead__actions">{actions}</div> : null}
        </div>
        {flash ? <Alert kind={flash.kind}>{flash.text}</Alert> : null}
        {children}
      </main>
    </body>
  </html>
);

export const ErrorPage: FC<{ status: number; message: string }> = ({ status, message }) => (
  <PublicLayout title={`${status} · Remarcá`}>
    <section class="narrow center">
      <h1>{status === 404 ? 'No encontramos esa página' : 'Algo salió mal'}</h1>
      <p>{message}</p>
      <p>
        <a class="btn" href="/app">
          Volver al inicio
        </a>
      </p>
    </section>
  </PublicLayout>
);
