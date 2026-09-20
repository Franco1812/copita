# Proyecto: plataforma de Copas / Brackets 1v1

Construir una aplicación web full-stack donde usuarios registrados puedan crear Copas personalizadas con una cantidad fija de participantes y compartirlas mediante una URL pública.

Cualquier persona que visite una Copa publicada puede iniciar su propia partida. Cada partida genera automáticamente un bracket nuevo y aleatorio utilizando los mismos participantes de la Copa.

El jugador realiza elecciones 1v1 hasta obtener un campeón.

## 1. Reglas fundamentales

Estas reglas son invariantes y no deben poder desactivarse desde la interfaz.

### Brackets

Los tamaños permitidos para el MVP son:

- 4
- 8
- 16
- 32
- 64

Definirlo en una constante:

`ALLOWED_BRACKET_SIZES = [4, 8, 16, 32, 64]`

No aceptar cantidades arbitrarias aunque sean pares.

Ejemplo:

- 6 participantes → inválido
- 10 participantes → inválido
- 24 participantes → inválido
- 32 participantes → válido

La arquitectura debe permitir agregar 128 posteriormente sin modificar el modelo de datos.

### Randomización

Todos los enfrentamientos iniciales deben ser aleatorios.

El creador NO puede:

- definir seeds;
- seleccionar manualmente los cruces;
- arrastrar participantes;
- ordenar el bracket;
- fijar quién enfrenta a quién.

Al comenzar una nueva partida:

1. obtener todos los participantes;
2. aplicar Fisher-Yates utilizando aleatoriedad criptográficamente segura;
3. generar el bracket;
4. guardar el bracket en base de datos.

No usar `Math.random()`.

En servidor Node utilizar una fuente criptográfica como `crypto.randomInt()`.

El bracket se randomiza UNA SOLA VEZ al crear la partida.

Nunca volver a randomizar:

- al refrescar;
- al cerrar y volver a abrir;
- al pasar de ronda;
- al iniciar sesión;
- al cambiar de dispositivo si la partida pertenece a un usuario.

El bracket generado debe quedar persistido.

### Eliminación directa

Siempre eliminación directa.

Cada enfrentamiento tiene exactamente:

- participante A;
- participante B;
- ganador.

El ganador avanza al siguiente enfrentamiento.

No hay:

- empates;
- votos parciales;
- tercer puesto;
- repechaje;
- byes.

La final produce exactamente un campeón.

---

# 2. Conceptos de dominio

## User

Usuario registrado.

Puede:

- crear Copas;
- editar sus Copas;
- publicar Copas;
- archivarlas;
- jugar Copas;
- consultar sus resultados.

## Cup

Plantilla reutilizable.

Ejemplo:

`Top álbumes de Heavy Metal de la historia`

Contiene:

- creador;
- título;
- slug público;
- descripción;
- portada opcional;
- cantidad de participantes;
- participantes;
- estado;
- fecha de creación;
- fecha de publicación.

Estados:

- `draft`
- `published`
- `archived`

## Cup Entry

Cada elemento participante.

Ejemplo:

`Master of Puppets`

Campos:

- nombre;
- imagen opcional;
- descripción opcional;
- URL externa opcional.

## Run

Una partida individual de una Copa.

Ejemplo:

Franco juega `Top álbumes de Heavy Metal`.

Eso crea un Run.

Otro usuario jugando la misma Copa crea otro Run completamente independiente.

Campos principales:

- Copa;
- usuario opcional;
- identificador público;
- estado;
- campeón;
- fecha de inicio;
- fecha de finalización.

Estados:

- `active`
- `completed`

## Match

Un enfrentamiento perteneciente a un Run.

Campos:

- run;
- round;
- position;
- participant_a;
- participant_b;
- winner;
- next_match;
- next_slot.

---

# 3. Stack

Frontend/backend:

- Next.js App Router
- TypeScript strict
- React
- Tailwind CSS
- shadcn/ui

Backend:

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Row Level Security

Validación:

- Zod

Testing:

- Vitest para unit tests
- Playwright para E2E

Deployment:

- Vercel
- Supabase

No agregar Prisma inicialmente.

Gestionar esquema mediante migraciones SQL de Supabase.

Generar los tipos TypeScript de Supabase.

---

# 4. Autenticación

MVP:

- registro por email/password;
- login;
- logout;
- recuperación de contraseña;
- sesión persistente;
- página de perfil.

El usuario debe estar autenticado para:

- crear Copa;
- modificar Copa;
- publicar Copa;
- archivar Copa.

No debe ser obligatorio iniciar sesión para jugar una Copa pública.

Si el visitante está autenticado, asociar el Run a su `user_id`.

Si no está autenticado, crear un Run anónimo.

No implementar todavía recuperación/claim de partidas anónimas luego de registrarse.

---

# 5. Esquema de base de datos

Crear aproximadamente las siguientes tablas.

## profiles

- id UUID PK, referencia a auth.users
- username unique
- display_name
- avatar_url
- created_at

## cups

- id UUID PK
- owner_id UUID FK profiles
- slug TEXT UNIQUE
- title TEXT
- description TEXT
- cover_url TEXT nullable
- participant_count INTEGER
- status ENUM/text
- created_at
- updated_at
- published_at nullable

Constraints:

participant_count debe pertenecer a:

`4, 8, 16, 32, 64`

## cup_entries

- id UUID PK
- cup_id UUID FK
- name TEXT
- description TEXT nullable
- image_url TEXT nullable
- external_url TEXT nullable
- created_at

Cada Copa debe tener exactamente `participant_count` entradas para poder publicarse.

## runs

- id UUID PK
- cup_id UUID FK
- user_id UUID nullable
- status
- champion_entry_id UUID nullable
- created_at
- completed_at nullable

## matches

- id UUID PK
- run_id UUID FK
- round_number INTEGER
- position INTEGER
- participant_a_id UUID nullable
- participant_b_id UUID nullable
- winner_entry_id UUID nullable
- next_match_id UUID nullable
- next_slot TEXT nullable

Unique:

`(run_id, round_number, position)`

Índices:

- cup_entries.cup_id
- runs.cup_id
- runs.user_id
- matches.run_id
- matches.next_match_id

---

# 6. Publicación e inmutabilidad

Mientras una Copa sea `draft`:

el creador puede modificar todo.

Al pasar a `published`:

la lista de participantes y `participant_count` quedan congelados.

Puede editar:

- título;
- descripción;
- portada.

No puede editar:

- número de participantes;
- participantes.

Motivo:

una Copa publicada puede tener partidas históricas asociadas.

Si el creador quiere cambiar participantes debe existir una acción:

`Duplicar Copa`

que crea un nuevo draft.

---

# 7. Generador de bracket

Crear el motor como lógica independiente de React.

Por ejemplo:

`lib/bracket/`

con:

- `sizes.ts`
- `shuffle.ts`
- `generateBracket.ts`
- `advanceWinner.ts`
- tests

## Creación

Ejemplo con 32 participantes:

- 32 participantes
- 16 matches ronda 1
- 8 matches ronda 2
- 4 cuartos
- 2 semifinales
- 1 final

Total:

31 matches.

Fórmula:

`matches = participants - 1`

Generar todos los matches al crear el Run.

Los matches posteriores empiezan sin participantes.

Los matches de primera ronda reciben los participantes según el resultado del shuffle.

Cada match conoce cuál es su `next_match_id` y en qué slot debe insertar su ganador.

Ejemplo:

R1 Match 1 → R2 Match 1 slot A  
R1 Match 2 → R2 Match 1 slot B

---

# 8. Elección de ganador

Crear endpoint/server action autoritativa.

Input:

- runId
- matchId
- winnerEntryId

El servidor debe comprobar:

1. el Run existe;
2. está activo;
3. el match pertenece al Run;
4. el match todavía no tiene ganador;
5. ambos participantes existen;
6. winnerEntryId es A o B.

Actualizar dentro de una transacción.

Guardar `winner_entry_id`.

Si existe siguiente match:

insertar el ganador en el slot correspondiente.

Si es la final:

- establecer `runs.champion_entry_id`;
- establecer estado `completed`;
- establecer `completed_at`.

El cliente nunca debe poder escribir directamente un ganador arbitrario en la base.

---

# 9. Concurrencia

Evitar problemas por doble click.

Una elección ya confirmada no debe poder modificarse.

Dos requests simultáneas sobre el mismo match no deben producir dos resultados.

Usar transacción/función SQL o actualización condicional:

`winner_entry_id IS NULL`

Una vez elegido un ganador:

el enfrentamiento queda cerrado.

---

# 10. URLs

Usar rutas similares a:

`/`

Landing.

`/login`

Login.

`/signup`

Registro.

`/dashboard`

Panel del usuario.

`/create`

Crear Copa.

`/cup/[slug]`

Página pública de la Copa.

Ejemplo:

`/cup/top-albumes-heavy-metal-a82k3`

`/play/[runId]`

Partida activa.

`/result/[runId]`

Resultado de la partida.

`/u/[username]`

Perfil público.

---

# 11. Flujo de creación

Dashboard → Crear Copa.

Paso 1:

Título.

Ejemplo:

`Top álbumes de Heavy Metal`

Paso 2:

Descripción opcional.

Paso 3:

Elegir cantidad:

4 / 8 / 16 / 32 / 64.

Paso 4:

Cargar exactamente esa cantidad de participantes.

Cada participante:

- nombre obligatorio;
- imagen opcional;
- descripción opcional;
- link opcional.

Mostrar progreso:

`18 / 32 participantes`

No permitir publicar hasta completar exactamente la cantidad requerida.

Después:

`Publicar Copa`

Generar slug único.

Mostrar:

`Tu Copa está publicada`

con botón:

`Copiar enlace`.

---

# 12. Página pública de una Copa

Ejemplo:

# Top álbumes de Heavy Metal

Creado por @franco

32 participantes

[portadas]

CTA principal:

`JUGAR COPA`

Secundario:

`Ver participantes`

No mostrar el bracket antes de comenzar porque todavía no existe.

Cuando el usuario pulsa JUGAR:

crear un nuevo Run.

Aplicar shuffle seguro.

Crear bracket.

Redirigir:

`/play/[runId]`

---

# 13. UI del 1v1

Esta es la pantalla más importante del producto.

Debe priorizar las dos opciones.

Desktop:

[ PARTICIPANTE A ]    VS    [ PARTICIPANTE B ]

Mobile:

A  
VS  
B

Cada tarjeta muestra:

- imagen;
- nombre;
- descripción breve opcional.

Toda la tarjeta es seleccionable.

Arriba mostrar:

`Ronda 1 · 7 de 16`

o nombres según la ronda:

- Dieciseisavos
- Octavos
- Cuartos
- Semifinal
- Final

Después de elegir:

animación corta opcional.

Cargar inmediatamente el siguiente match pendiente.

No permitir volver atrás y cambiar decisiones.

---

# 14. Pantalla de resultados

Cuando termina:

`TU CAMPEÓN`

Imagen.

Nombre.

Nombre de la Copa.

Botones:

- Compartir resultado
- Jugar de nuevo
- Ver bracket completo
- Volver a la Copa

`Jugar de nuevo` crea un NUEVO Run.

Nunca reutiliza el anterior.

Por lo tanto vuelve a hacer un shuffle nuevo.

---

# 15. Visualización del bracket

Crear componente reusable:

`BracketView`

Debe poder mostrar:

- todas las rondas;
- participantes;
- ganadores;
- campeón.

Desktop:

bracket horizontal tradicional.

Mobile:

mostrar ronda por ronda o utilizar scroll horizontal controlado.

El bracket es solamente visual.

No debe permitir cambiar resultados.

---

# 16. Links diferentes

Debe haber dos conceptos diferentes.

### Compartir Copa

`/cup/[slug]`

La persona que entra inicia su propia partida random.

### Compartir Resultado

`/result/[runId]`

Muestra el resultado específico de una persona.

Ejemplo:

`Franco eligió Master of Puppets como campeón`

y permite pulsar:

`Hacé tu propia Copa`

---

# 17. Estadísticas

No hacer un sistema complejo inicialmente, pero diseñar el modelo para permitirlo.

La información ya queda almacenada en `runs` y `matches`.

Posteriormente se podrá calcular:

- cantidad total de partidas;
- campeones más frecuentes;
- porcentaje de campeonatos;
- enfrentamientos más comunes;
- porcentaje histórico A vs B.

Ejemplo futuro:

Master of Puppets — campeón 31%

Paranoid — campeón 21%

No es requisito de la primera iteración.

---

# 18. Imágenes

Usar Supabase Storage.

Buckets:

- avatars
- cup-assets

Restringir uploads a usuarios autenticados.

Validar:

- MIME;
- tamaño;
- extensiones.

Crear nombres únicos.

No confiar en el filename enviado por el navegador.

---

# 19. RLS / seguridad

Activar Row Level Security.

Políticas conceptuales:

### profiles

Lectura pública.

Usuario puede modificar solamente su propio perfil.

### cups

Todos pueden leer Copas `published`.

Propietario puede leer sus drafts.

Solo propietario puede crear/modificar sus Copas.

### cup_entries

Público puede leer entradas pertenecientes a Copas publicadas.

Solo propietario de la Copa puede modificar entradas mientras la Copa sea draft.

### runs / matches

No permitir escrituras arbitrarias desde el browser.

La generación del Run y selección de ganadores deben pasar por lógica server-side controlada.

No exponer nunca:

- service role key;
- secretos;
- claves privadas.

---

# 20. Landing

Diseño simple.

Hero:

`¿Cuál es realmente tu favorito?`

Subtítulo:

`Creá una Copa, enfrentá tus favoritos 1v1 y descubrí cuál termina campeón.`

CTA:

`Crear una Copa`

Mostrar ejemplos.

Ejemplo:

- Mejores álbumes de Metal
- Mejores películas de Tarantino
- Mejores delanteros
- Mejores juegos de Resident Evil

---

# 21. Dashboard

Mostrar:

`Mis Copas`

Cada card:

- portada;
- título;
- participantes;
- estado;
- partidas realizadas.

Acciones:

- Abrir
- Editar si draft
- Compartir
- Duplicar
- Archivar

Botón principal:

`+ Nueva Copa`

---

# 22. Perfil público

URL:

`/u/franco`

Mostrar:

- avatar;
- username;
- Copas públicas creadas;
- cantidad de Copas;
- opcionalmente resultados públicos.

No mostrar datos privados.

---

# 23. Testing obligatorio

## Unit tests

`isAllowedBracketSize`

Casos válidos:

4, 8, 16, 32, 64.

Casos inválidos:

0, 2, 6, 10, 12, 24, 100.

### Shuffle

Verificar:

- mismo número de elementos;
- ningún elemento perdido;
- ningún duplicado;
- ninguna modificación del array original.

Diseñar `shuffle()` para aceptar un RNG inyectable en tests.

Producción utiliza RNG criptográfico.

Tests utilizan RNG determinístico.

No escribir tests que dependan de que dos shuffles random necesariamente sean distintos, porque podrían coincidir legítimamente.

### Bracket

Para N participantes:

exactamente `N - 1` matches.

Probar:

- 4
- 8
- 16
- 32
- 64

Cada participante aparece exactamente una vez en primera ronda.

Todos los matches salvo la final tienen next match.

La final no tiene next match.

### Advance winner

Ganador correcto avanza al slot correcto.

No aceptar participante ajeno al match.

No poder resolver dos veces un mismo match.

La final completa el Run.

---

# 24. E2E

Crear pruebas Playwright para:

### Usuario

registrarse → login → dashboard.

### Crear Copa

crear Copa de 8 → cargar 8 participantes → publicar.

### Jugar

abrir URL pública → iniciar partida → completar 7 enfrentamientos → obtener campeón.

### Persistencia

iniciar partida → votar dos matches → refrescar página → continuar desde exactamente el mismo bracket.

### Nueva partida

terminar partida → Jugar otra vez → crear otro Run diferente.

---

# 25. Estados de error

Cubrir:

- Copa inexistente;
- Copa archivada;
- Copa no publicada;
- participante faltante;
- Run inexistente;
- Run terminado;
- match ya respondido;
- imagen inválida;
- error de red;
- usuario sin autorización.

No mostrar stack traces al usuario.

---

# 26. Diseño responsive

Mobile-first.

La experiencia principal debe funcionar perfectamente en teléfono.

El usuario debe poder completar una Copa solamente tocando tarjetas.

Objetivos mínimos:

- targets táctiles grandes;
- imágenes optimizadas;
- textos legibles;
- transiciones rápidas;
- ninguna interacción dependiente de hover.

---

# 27. Accesibilidad

Usar:

- HTML semántico;
- botones reales;
- labels;
- estados focus;
- navegación por teclado;
- alt en imágenes;
- contraste accesible.

Las dos opciones de un enfrentamiento deben poder seleccionarse mediante teclado.

---

# 28. MVP: alcance exacto

Construir primero solamente:

1. auth;
2. perfiles;
3. CRUD de draft Cup;
4. participantes;
5. publicación;
6. URL pública;
7. creación de Run;
8. randomización;
9. bracket;
10. elecciones;
11. resultado;
12. compartir;
13. dashboard;
14. tests.

NO implementar todavía:

- comentarios;
- likes;
- seguidores;
- chat;
- rankings globales;
- notificaciones;
- votación colectiva;
- seeds;
- brackets manuales;
- torneos de doble eliminación;
- pagos;
- sistema de moderación avanzado.

---

# 29. Orden de implementación

Trabajar por milestones.

## Milestone 1 — Foundation

Crear proyecto.

Configurar:

- TypeScript strict;
- ESLint;
- Tailwind;
- shadcn;
- variables de entorno;
- Supabase clients server/browser.

Crear layout principal.

## Milestone 2 — Database + Auth

Crear migraciones.

Configurar Auth.

Crear profile automáticamente al registrar usuario.

Implementar:

- signup;
- login;
- logout;
- forgot password;
- dashboard protegido.

Agregar RLS.

## Milestone 3 — Cup creator

CRUD drafts.

Selector de bracket size.

Editor de participantes.

Uploads.

Validaciones.

Publicación.

## Milestone 4 — Bracket engine

Implementar lógica pura y tests.

No construir UI hasta que los tests del motor estén verdes.

## Milestone 5 — Runs

Crear Runs server-side.

Generar bracket.

Persistir matches.

Implementar selección de ganador.

## Milestone 6 — Gameplay

Construir `/play/[runId]`.

Responsive.

Progreso de rondas.

Final.

## Milestone 7 — Resultados y compartir

Página de resultado.

BracketView.

Compartir Copa.

Compartir resultado.

Replay.

## Milestone 8 — QA

Unit tests.

E2E.

RLS tests.

Validaciones.

Responsive.

Accesibilidad.

## Milestone 9 — Deploy

Supabase production.

Vercel.

Environment variables.

Migraciones.

Smoke tests.

---

# 30. Reglas para Codex

No intentar construir toda la aplicación en un único cambio.

Antes de cada milestone:

1. inspeccionar el repositorio;
2. explicar brevemente qué se va a modificar;
3. implementar;
4. correr lint;
5. correr typecheck;
6. correr tests relevantes;
7. corregir errores;
8. resumir archivos modificados.

No continuar si los tests del motor de bracket fallan.

Mantener la lógica del bracket separada de componentes React.

No duplicar lógica de autorización entre distintas páginas.

Preferir Server Components por defecto y Client Components solo cuando exista una necesidad interactiva.

Usar server-side validation aunque también exista validación frontend.

No confiar en parámetros enviados por el cliente para determinar propiedad o autorización.

No exponer secretos al frontend.

No sustituir el random criptográfico por `Math.random()`.

Nunca implementar una opción para ordenar manualmente el bracket.

Nunca randomizar un Run ya creado.

Estas últimas tres reglas son requisitos de producto y no sugerencias.