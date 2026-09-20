# Copita

Plataforma de Copas 1v1. El proyecto sigue los milestones de la especificación incluida en la raíz.

## Desarrollo local

Requiere Node.js 20.9 o superior.

1. Ejecutar `npm install`.
2. Copiar `.env.example` a `.env.local` y configurar URL y clave publicable del proyecto Supabase.
3. Ejecutar `npm run dev`.

Verificaciones: `npm run lint`, `npm run typecheck`, `npm run test` y `npm run build`.

## Estado

Milestone 1: estructura Next.js App Router, TypeScript strict, Tailwind CSS, configuración de shadcn/ui, landing y clientes Supabase para servidor/navegador con refresco de sesión mediante Proxy.

Milestone 2: migración inicial en `supabase/migrations/20260918000000_initial_schema.sql`, perfiles automáticos, RLS, registro, ingreso, recuperación de contraseña, panel protegido y edición del perfil.

Milestone 3: creación y edición de borradores, participantes, portada e imágenes, publicación, duplicación, archivo, página pública y perfil público. La carga de imágenes requiere aplicar la segunda migración.

Milestone 4: motor puro en `src/lib/bracket/`, con tamaños permitidos, Fisher-Yates mediante `crypto.randomInt`, generación de todos los matches y avance irreversible de ganadores. Las pruebas del motor están verdes para todos los tamaños permitidos.

Milestones 5–7: creación de Runs y matches en una transacción, partidas anónimas con cookie privada o asociadas a usuario, elección irreversible mediante función SQL, juego responsive, resultado compartible, replay y visualización del bracket.

Milestone 8: pruebas unitarias y E2E del flujo de Copa de 8, persistencia, replay, permisos RLS, acceso desde otro dispositivo, juego móvil, teclado e imágenes inválidas.

## Activar el milestone 2 en Supabase

El esquema todavía debe aplicarse al proyecto. En un proyecto nuevo, abrí **SQL Editor**, pegá el contenido completo de `supabase/migrations/20260918000000_initial_schema.sql` y ejecutalo una sola vez. Para trabajo posterior conviene usar Supabase CLI y su historial de migraciones; no vuelvas a ejecutar esta migración manualmente.

En **Authentication → URL Configuration**, configurá `http://localhost:3000` como Site URL y agregá `http://localhost:3000/auth/callback` a los redirect URLs. Para producción, configurá `NEXT_PUBLIC_SITE_URL` con el origen de la app y agregá su callback a los redirect URLs. Confirmá que el proveedor Email esté habilitado.

Después de aplicar la migración, generá los tipos de Supabase con `supabase gen types typescript --project-id <project-ref>` y guardalos en el proyecto. Esto sigue pendiente hasta tener acceso al esquema remoto.

## Activar las imágenes y el editor de Copas

En **SQL Editor**, ejecutá una sola vez `supabase/migrations/20260918010000_storage.sql`. La migración crea los buckets públicos `avatars` y `cup-assets`, limita tipo y tamaño de imagen, agrega políticas de subida por usuario y evita que un borrador exceda el número de participantes elegido.

Después, ingresá a `/create` con tu cuenta para crear una Copa. La página pública permite compartirla y ver participantes.

## Activar las partidas

1. En **SQL Editor**, ejecutá una sola vez `supabase/migrations/20260918020000_runs.sql`.
   Si ya aplicaste el esquema inicial antes del ajuste de matches vacíos, ejecutá también `supabase/migrations/20260918030000_fix_empty_matches.sql`.
2. En **Project Settings → API Keys → Secret keys**, copiá una clave `sb_secret_...` directamente a `SUPABASE_SECRET_KEY` en `.env.local`. Nunca la pongas en variables `NEXT_PUBLIC_`, en el navegador ni en el repositorio.
3. Reiniciá `npm run dev` para que Next.js lea la nueva variable.

Una Copa publicada se juega desde `/cup/[slug]`. Cada clic en **JUGAR COPA** crea un Run nuevo y guarda todos los matches. Las partidas anónimas quedan vinculadas a una cookie privada; las partidas iniciadas con cuenta aparecen en el dashboard y pueden retomarse en otro dispositivo al iniciar sesión. Los resultados terminados son públicos mediante `/result/[runId]`.

## Ranking de una Copa

Ejecutá una sola vez `supabase/migrations/20260918040000_cup_rankings.sql` en el SQL Editor para activar el ranking público de cada Copa. Solo cuenta partidas completadas: **Títulos** es la proporción de Copas ganadas y **Victorias** la proporción de enfrentamientos ganados entre los disputados. Las partidas en curso no alteran las estadísticas.

## Verificaciones

- `npm run lint`
- `npm run typecheck`
- `npm run test`: tests unitarios del motor y validaciones.
- `npm run build`
- `npm run test:e2e`: usa Chrome/Playwright y un proyecto Supabase configurado. Crea una cuenta y una Copa temporales, y las elimina al finalizar. La prueba de signup por email requiere `E2E_SIGNUP_INBOX` y cuota disponible; por defecto se omite para no consumir emails en cada ejecución.

## Despliegue

1. Crear un proyecto Vercel conectado a este código. Configurar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (URL pública de Vercel) y `SUPABASE_SECRET_KEY` como variables de entorno. La clave secreta solo debe existir en el servidor.
2. En Supabase Authentication → URL Configuration, agregar `https://<dominio>/auth/callback` a Redirect URLs y poner `https://<dominio>` como Site URL.
3. Aplicar las migraciones SQL pendientes en orden. En este proyecto se ejecutaron manualmente; antes de usar `supabase db push`, registrar correctamente el historial de migraciones remotas para evitar reejecutarlas.
4. Ejecutar `npm run build` y probar registro, creación de una Copa, partida anónima y resultado público en el dominio final.

La generación de tipos TypeScript desde el esquema remoto sigue pendiente de una sesión de Supabase CLI autorizada para el proyecto.
