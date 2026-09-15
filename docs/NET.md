# Kelo net — room en memoria

Pages = cliente. Este folder = verdad de la sesion. Sin DB.

## Levantar

```bash
cd server
npm i
npm start
```

Queda `ws://localhost:2567`.

## Probar dos pestanas

1. Server encendido.
2. http://localhost:... no aplica. El cliente es Pages:
   https://kelffren.github.io/gemini/?v=76&net=ws://127.0.0.1:2567
3. Abre esa URL en dos pestanas o dos telefonos en la misma WiFi (el telefono no alcanza 127.0.0.1 de tu PC; usa la IP LAN `ws://192.168.x.x:2567`).

Sin `?net=` el juego sigue 100% offline. Caminata no cambia.

## Contrato Player (igual el dia que sea Colyseus)

```
id, name, x, y, face, gait, zone
```

Hoy el cliente manda `pose` (relay con clamp). Manana el cliente manda `input` y el server integra. La forma del Player no se tira.

## No es 100% online todavia

- El server no simula fisica ni cafe.
- Quien manda x,y puede mentir (relay).
- Al apagar node, la plaza se borra.
