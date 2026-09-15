# Investigación de Bug

BUG: `BUG-NNNN`
FECHA: `YYYY-MM-DD`
VERSION / BUILD: `version-o-build-exacto`
COMMIT BASE: `sha-o-unknown`
ENTORNO: `LIVE | local | CI | dispositivo / OS / navegador`
ESTADO: `vigente | parcialmente_superada | superada | historica`
INVESTIGADOR: `agente/humano/fuente`

## 1. Pregunta de investigación

¿Qué pregunta concreta intenta resolver esta investigación?

## 2. Contexto del bug

Síntoma observado y flujo donde ocurre. No inventar causa.

## 3. Hechos confirmados de KELO WORLD

Registrar solamente observaciones demostradas por logs, capturas, tests, commits o reproducción real.

## 4. Información externa encontrada

Para cada fuente indicar:

- Fuente / título.
- URL o referencia.
- Fecha/versiones a las que aplica.
- Hallazgo operativo relevante.

No copiar artículos completos.

## 5. Aplicación al bug

Clasificar cada hallazgo externo como:

- `APLICA`: el código/entorno del bug coincide de manera demostrable.
- `POSIBLE`: es compatible con el síntoma pero falta demostrarlo.
- `NO DEMOSTRADO`: información interesante sin enlace causal todavía.
- `DESCARTADO`: una prueba del proyecto contradice esa explicación.

## 6. Hipótesis afectadas

Indicar `H1`, `H2`, etc. del bug canónico cuando existan y explicar si la investigación las fortalece, debilita, descarta o crea una nueva hipótesis que debe añadirse al registro.

## 7. Recomendación para el agente

Acción concreta de mayor valor. Preferir un experimento que diferencie varias hipótesis antes de una reescritura grande.

## 8. No asumir / no repetir

Qué conclusiones no están demostradas y qué intentos no deben repetirse sin evidencia nueva.

## 9. Experimento de validación

ENTRADA:

PASOS:

SEÑAL DE ÉXITO:

SEÑAL DE FALLO:

QUÉ APRENDEMOS EN CADA CASO:

## 10. Resultado posterior

RESULTADO: `PENDING | PASS | FAIL | PARTIAL | BLOCKED`

FECHA RESULTADO: `null`

EVIDENCIA:

CONCLUSIÓN:

## 11. Vigencia

Esta investigación deja de aplicarse automáticamente si cambia de forma material la versión/build indicada, el navegador objetivo, el loader, el owner investigado o el flujo de reproducción. En ese caso debe conservarse y marcarse `parcialmente_superada`, `superada` o `historica`, no borrarse.
