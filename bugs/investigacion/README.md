# KELO WORLD — Investigación de Bugs

`bugs/investigacion/` es la biblioteca de apoyo para los agentes que trabajan bugs complejos.

Su función es conservar investigaciones técnicas, documentación externa, comparaciones, pruebas diagnósticas y conclusiones que ayudan a resolver un bug sin convertir el registro canónico `bugs/registry/BUG-NNNN.json` en un documento gigante.

## Regla principal

Toda investigación debe indicar claramente, al principio del archivo:

- `BUG`: ID canónico al que ayuda, por ejemplo `BUG-0003`.
- `FECHA`: fecha real de la investigación en `YYYY-MM-DD`.
- `VERSION / BUILD`: versión concreta del juego/build/commit a la que aplica.
- `ENTORNO`: dispositivo, OS, navegador, LIVE/CI/local cuando sea relevante.
- `ESTADO`: `vigente | parcialmente_superada | superada | historica`.

Una investigación sin BUG + FECHA + VERSION no debe usarse para tomar decisiones de código.

## Organización

Cada bug tiene su propia carpeta:

`bugs/investigacion/BUG-NNNN/`

Nombre recomendado:

`YYYY-MM-DD-<version-o-build>-<tema>.md`

Ejemplo:

`bugs/investigacion/BUG-0003/2026-09-13-world-light-20260914-1-safari-freeze.md`

Puede haber varias investigaciones del mismo bug si cambian la fecha, la versión o el tema. No sobrescribir una investigación vieja para hacerla parecer actual.

## Qué debe contener

Una investigación debe separar:

1. Contexto exacto del bug y versión investigada.
2. Pregunta que intenta resolver.
3. Hechos ya confirmados en KELO WORLD.
4. Información externa relevante y sus fuentes.
5. Relación entre esa información y el bug: `APLICA`, `POSIBLE`, `NO DEMOSTRADO` o `DESCARTADO`.
6. Hipótesis que fortalece/debilita.
7. Recomendación concreta para el agente.
8. Qué NO debe asumir el agente.
9. Experimento recomendado para validar la investigación.
10. Resultado posterior, cuando exista.

## Relación con el bug canónico

La investigación **apoya**, pero no sustituye, a `bugs/registry/BUG-NNNN.json`.

- El JSON canónico conserva estado, hechos, hipótesis, intentos y verificación.
- Esta carpeta conserva el razonamiento técnico ampliado y las fuentes.
- Si una investigación produce un hecho nuevo, hipótesis nueva, descarte o intento, el agente debe reflejarlo también en el JSON canónico.
- Una investigación externa nunca convierte por sí sola una hipótesis en causa confirmada.

## Lectura obligatoria para agentes

Antes de modificar código para un bug existente:

1. leer el bug canónico;
2. revisar `bugs/investigacion/BUG-NNNN/`;
3. empezar por la investigación más reciente cuya VERSION/BUILD aplique al runtime actual;
4. revisar también investigaciones anteriores marcadas como vigentes si contienen intentos o descartes todavía aplicables;
5. no aplicar una conclusión de otra versión sin comprobar que sigue siendo válida.

## Regla de vigencia

Una investigación se vuelve `parcialmente_superada` o `superada` cuando cambia de forma material el loader, arquitectura, navegador objetivo, API, build o sistema investigado.

Nunca borrar investigaciones viejas: sirven para entender por qué se tomaron decisiones anteriores.

## Plantilla

Usar `bugs/templates/INVESTIGACION_TEMPLATE.md`.
