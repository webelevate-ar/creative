import { Hono } from 'hono';
import { PublicLayout } from '../layout.js';
import { takeFlash, type AppEnv } from '../context.js';
import { PLANS, TRIAL_DAYS } from '../../lib/plans.js';
import { formatInt } from '../../lib/money.js';

export const publicRoutes = new Hono<AppEnv>();

publicRoutes.get('/health', (c) => {
  try {
    c.var.deps.db.prepare('SELECT 1').get();
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false }, 503);
  }
});

const DemoTable = () => (
  <figure class="demo">
    <div class="demo__bar">
      <strong>Lista de Distribuidora Ejemplo</strong> · 1.248 productos · <span class="change change--up">mediana +6,8 %</span>
    </div>
    <div class="table-wrap" tabindex={0} role="region" aria-label="Tabla (se puede desplazar)">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Descripción</th>
            <th class="r">Var.</th>
            <th class="r">Precio nuevo</th>
            <th>Alertas</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>TOR-0112</code>
            </td>
            <td>Tornillo autoperforante 8x1/2 (x100)</td>
            <td class="r">
              <span class="change change--up num">+7,2 %</span>
            </td>
            <td class="r num strong">$ 5.370,00</td>
            <td></td>
          </tr>
          <tr>
            <td>
              <code>LLA-0040</code>
            </td>
            <td>Llave combinada 13mm</td>
            <td class="r">
              <span class="change change--up num">+18,0 %</span>
            </td>
            <td class="r num strong">$ 16.720,00</td>
            <td>
              <span class="badge badge--warn">Hoy lo vendés bajo costo</span>
            </td>
          </tr>
          <tr>
            <td>
              <code>CIN-0007</code>
            </td>
            <td>Cinta aisladora 20m</td>
            <td class="r">
              <span class="change change--up num">+99.900,0 %</span>
            </td>
            <td class="r num muted">$ 2.137.910,00</td>
            <td>
              <span class="badge badge--warn">¿Error en la lista?</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <figcaption class="small muted">Ejemplo con datos ficticios de cómo se ve la revisión de una lista.</figcaption>
  </figure>
);

publicRoutes.get('/', (c) => {
  if (c.var.user) return c.redirect('/app');
  const plans = (['basico', 'comercio', 'distribuidora'] as const).map((id) => PLANS[id]);
  return c.html(
    <PublicLayout
      title="Remarcá · Las listas de tus proveedores, convertidas en tus precios nuevos"
      description="Subí la lista del proveedor en Excel, CSV o PDF. Remarcá aplica tus bonificaciones, IVA y margen, te muestra qué cambió y te da los precios nuevos listos para tu sistema."
      flash={takeFlash(c)}
      wide
    >
      <section class="hero">
        <div class="hero__text">
          <p class="eyebrow">Para comercios y distribuidoras que trabajan con muchas listas de proveedores</p>
          <h1>Tu proveedor aumentó. Tus precios, al día en minutos.</h1>
          <p class="lead">
            Subí la lista tal como te llega — Excel, CSV o PDF. Remarcá aplica tus bonificaciones, el IVA, el dólar y tu margen, te muestra qué cambió y te da los
            precios nuevos listos para cargar en tu sistema.
          </p>
          <p class="row wrap">
            <a class="btn btn--large" href="/registro">
              Probar gratis {TRIAL_DAYS} días
            </a>
            <a class="btn btn--large btn--secondary" href="#como-funciona">
              Ver cómo funciona
            </a>
          </p>
          <p class="small muted">Sin tarjeta. No reemplaza tu sistema de gestión: lo alimenta.</p>
        </div>
        <DemoTable />
      </section>

      <section class="section">
        <h2>¿Te suena?</h2>
        <ul class="pains">
          <li>La lista llega en PDF, o en un Excel con las columnas cambiadas cada vez.</li>
          <li>Te pasás la tarde con BUSCARV, bonificaciones "30+10", IVA sí o no, y la lista en dólares.</li>
          <li>Para no perder tiempo subís todo un 8 %… y perdés margen en lo que aumentó 15 %.</li>
          <li>Te enterás tarde de que estabas vendiendo algo por debajo de lo que te cuesta reponerlo.</li>
          <li>No sabés qué productos cambiaron, cuánto, ni cuándo.</li>
        </ul>
      </section>

      <section class="section" id="como-funciona">
        <h2>Cómo funciona</h2>
        <ol class="howto">
          <li>
            <h3>1. Subís la lista del proveedor</h3>
            <p>Excel (.xlsx o .xls viejo), CSV o PDF con texto. Detectamos solas las columnas de código y precio. La próxima lista de ese proveedor se lee sin tocar nada.</p>
          </li>
          <li>
            <h3>2. Revisás qué cambió</h3>
            <p>
              Ves cada producto con su costo y precio actual y nuevo. Te avisamos lo que subió mucho, lo que parece un error de la lista, lo que hoy estás vendiendo bajo
              costo y lo que dejó de venir.
            </p>
          </li>
          <li>
            <h3>3. Aplicás y lo pasás a tu sistema</h3>
            <p>Un clic y tus precios quedan actualizados. Descargás el archivo con el formato que importa tu sistema y, si querés, imprimís las etiquetas. Si te equivocaste, lo deshacés.</p>
          </li>
        </ol>
      </section>

      <section class="section">
        <h2>Hecho para cómo se trabaja acá</h2>
        <div class="features">
          <div>
            <h3>Bonificaciones en cascada</h3>
            <p>"30+10+5", recargo por flete, precio por bulto o por unidad.</p>
          </div>
          <div>
            <h3>IVA y dólar</h3>
            <p>Listas con o sin IVA, 21 % o 10,5 %, responsable inscripto o monotributo. Listas en USD con la cotización que te toma el proveedor.</p>
          </div>
          <div>
            <h3>Tu margen, respetado</h3>
            <p>Si el costo sube 7 %, el precio sube 7 %: se mantiene el margen que ya tenía cada producto. O recalculás con el margen que definas.</p>
          </div>
          <div>
            <h3>Redondeo</h3>
            <p>Precios redondeados hacia arriba a $ 10, $ 50 o $ 100, para que queden prolijos en la góndola.</p>
          </div>
          <div>
            <h3>Nada se pisa sin que lo veas</h3>
            <p>Revisás antes de aplicar, elegís qué sí y qué no, y cada actualización se puede deshacer.</p>
          </div>
          <div>
            <h3>Historial</h3>
            <p>Cada producto guarda cuándo y cuánto cambió su costo y su precio, y de qué lista vino.</p>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Funciona con el sistema que ya usás</h2>
        <p>
          Remarcá no es otro sistema de gestión. Te da un archivo CSV o Excel con las columnas, el separador y los decimales que tu sistema necesita para importar
          precios, ya sea un sistema de facturación, tu tienda online o tu propia planilla.
        </p>
        <p class="muted">Ideal para ferreterías, casas de electricidad, sanitarios, pinturerías, repuestos, librerías y distribuidoras.</p>
      </section>

      <section class="section" id="precios">
        <h2>Precios</h2>
        <p>
          Probás {TRIAL_DAYS} días con todo incluido. Después elegís un plan según cuántos proveedores te mandan listas. Precios en pesos, finales, por mes.
        </p>
        <div class="plans">
          {plans.map((p) => (
            <div class={`card plan${p.id === 'comercio' ? ' plan--featured' : ''}`}>
              <h3>{p.name}</h3>
              <p class="plan__price">
                $ {formatInt(p.monthlyArs)} <span>/ mes</span>
              </p>
              <ul class="plain">
                <li>Hasta {formatInt(p.suppliers)} proveedores</li>
                <li>Hasta {formatInt(p.products)} productos</li>
                <li>
                  {p.users} usuario{p.users > 1 ? 's' : ''}
                </li>
              </ul>
              <a class={`btn btn--block${p.id === 'comercio' ? '' : ' btn--secondary'}`} href="/registro">
                Empezar prueba
              </a>
            </div>
          ))}
        </div>
        <p class="small muted">
          Pagando el año: 2 meses sin cargo y puesta en marcha asistida incluida (cargamos tu catálogo y tus primeros 5 proveedores con vos). Puesta en marcha sola:
          $ 35.000 por única vez.
        </p>
      </section>

      <section class="section faq">
        <h2>Preguntas frecuentes</h2>
        <details>
          <summary>¿Tengo que cambiar mi sistema de gestión?</summary>
          <p>No. Remarcá calcula los precios y te da un archivo para importarlos en el sistema que ya usás. Si tu sistema no importa archivos, podés usar Remarcá como tu lista de precios y consultar desde ahí.</p>
        </details>
        <details>
          <summary>¿Qué pasa si la lista viene en PDF?</summary>
          <p>Si el PDF tiene texto (lo podés seleccionar con el mouse), lo leemos. Si es una foto o un escaneo, no: pedile al proveedor la versión en Excel o PDF digital.</p>
        </details>
        <details>
          <summary>¿Y si me equivoco al aplicar?</summary>
          <p>Cada actualización se puede deshacer. Se restauran los costos y precios anteriores de los productos que nadie modificó después.</p>
        </details>
        <details>
          <summary>¿Necesito tener cargados mis productos?</summary>
          <p>Conviene: importás la lista de productos de tu sistema una vez. Si no la tenés, podés crear productos directamente desde la lista del proveedor.</p>
        </details>
        <details>
          <summary>¿Sirve si soy monotributista?</summary>
          <p>Sí. Configurás que tus costos incluyen el IVA y los cálculos se ajustan.</p>
        </details>
        <details>
          <summary>¿Quién ve mis precios?</summary>
          <p>Solo las personas de tu cuenta. No compartimos tus listas ni tus precios con nadie, ni con otros comercios ni con proveedores.</p>
        </details>
        <details>
          <summary>¿Cómo pago?</summary>
          <p>Por transferencia o link de Mercado Pago. Te escribimos antes de que termine la prueba. Si no seguís, tus datos quedan disponibles para exportar.</p>
        </details>
      </section>

      <section class="section cta">
        <h2>Probalo con la próxima lista que te llegue</h2>
        <p>Si no tenés una a mano, adentro hay datos de ejemplo para verlo funcionar en dos minutos.</p>
        <a class="btn btn--large" href="/registro">
          Crear cuenta gratis
        </a>
      </section>
    </PublicLayout>,
  );
});

publicRoutes.get('/terminos', (c) => {
  const { contactEmail } = c.var.deps.config;
  const entity = process.env.LEGAL_ENTITY || 'el titular de Remarcá';
  return c.html(
    <PublicLayout title="Términos y condiciones · Remarcá">
      <article class="prose narrow">
        <h1>Términos y condiciones</h1>
        <p class="muted">Última actualización: 24/09/2026</p>
        <p>Remarcá es un servicio en línea operado por {entity} (en adelante, "nosotros") que ayuda a calcular costos y precios de venta a partir de listas de precios de proveedores.</p>
        <h2>1. La cuenta</h2>
        <p>Sos responsable de la información que cargás y de mantener tu contraseña en reserva. Cada cuenta corresponde a un comercio.</p>
        <h2>2. Cálculos y responsabilidad</h2>
        <p>
          Remarcá calcula a partir de los datos y reglas que vos configurás (bonificaciones, IVA, cotización, márgenes). Antes de aplicar cambios te mostramos el
          resultado para que lo revises. Las decisiones de precio son tuyas: no respondemos por pérdidas derivadas de listas con errores, reglas mal configuradas o
          precios aplicados sin revisar.
        </p>
        <h2>3. Prueba, planes y pagos</h2>
        <p>
          La prueba gratuita dura 14 días. Luego, el servicio se abona por mes o por año según el plan elegido. Si no pagás, la cuenta pasa a modo solo lectura: podés
          ver y exportar tus datos, pero no procesar listas nuevas. Los precios pueden actualizarse trimestralmente; te avisamos con 15 días de anticipación.
        </p>
        <h2>4. Tus datos</h2>
        <p>Los datos que cargás son tuyos. Podés exportarlos en cualquier momento y pedirnos que borremos tu cuenta. Ver la política de privacidad.</p>
        <h2>5. Disponibilidad</h2>
        <p>Hacemos lo razonable para que el servicio esté disponible y tus datos respaldados, pero puede haber interrupciones por mantenimiento o fallas.</p>
        <h2>6. Contacto</h2>
        <p>
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </p>
      </article>
    </PublicLayout>,
  );
});

publicRoutes.get('/privacidad', (c) => {
  const { contactEmail } = c.var.deps.config;
  return c.html(
    <PublicLayout title="Privacidad · Remarcá">
      <article class="prose narrow">
        <h1>Política de privacidad</h1>
        <p class="muted">Última actualización: 24/09/2026</p>
        <h2>Qué datos guardamos</h2>
        <ul>
          <li>Tu nombre, email y el nombre del comercio, para darte acceso.</li>
          <li>Los archivos de listas que subís, tus productos, costos y precios, para prestar el servicio.</li>
          <li>Registros de uso dentro de la aplicación (por ejemplo, "se aplicó una lista"), para mejorar el producto. No usamos rastreadores de terceros ni publicidad.</li>
        </ul>
        <h2>Para qué los usamos</h2>
        <p>Solo para prestar y mejorar Remarcá y para comunicarnos con vos por tu cuenta. No vendemos ni compartimos tus datos, listas o precios con terceros.</p>
        <h2>Dónde se guardan</h2>
        <p>En servidores de proveedores de infraestructura contratados por nosotros, con copias de seguridad. El acceso está restringido.</p>
        <h2>Tus derechos</h2>
        <p>
          Podés acceder, rectificar o pedir la eliminación de tus datos personales escribiendo a <a href={`mailto:${contactEmail}`}>{contactEmail}</a>, conforme a la Ley
          25.326 de Protección de Datos Personales. La Agencia de Acceso a la Información Pública es el órgano de control de esa ley.
        </p>
      </article>
    </PublicLayout>,
  );
});
